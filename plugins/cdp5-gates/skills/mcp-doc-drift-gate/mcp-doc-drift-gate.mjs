#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — mcp-doc-drift-gate (read-only): prüft dass MCP-Tool-Descriptions
// alle Input- und (wenn deklariert) Output-Felder erwähnen. Schließt die ADR-0016-
// Konsumenten-Sycophancy-Klasse (LLM erfindet undokumentierte Felder).
//
// Exit: 0 = keine Drift · 1 = Drift gefunden · 2 = Nutzungsfehler.

import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import { guardPaths } from '../../lib/args.mjs';

const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  if (!a.startsWith('--')) return [a, true];
  const parts = a.slice(2).split('=');
  return parts.length === 1 ? [parts[0], true] : [parts[0], parts.slice(1).join('=')];
}));
if (!ARGS.mcp) {
  console.error('Usage: mcp-doc-drift-gate.mjs --mcp=<path-to-mcp-server.mjs> [--json]');
  process.exit(2);
}
guardPaths([[ARGS.mcp, 'file']]);

// Dynamic import des MCP-Servers — Konvention: `export const TOOLS = [...]`.
let TOOLS;
try {
  const mod = await import(pathToFileURL(resolvePath(ARGS.mcp)).href);
  TOOLS = mod.TOOLS;
  if (!Array.isArray(TOOLS)) {
    console.error(`nicht gefunden: export TOOLS in ${ARGS.mcp}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`import fehlgeschlagen: ${e.message}`);
  process.exit(2);
}

// Tokenize: alphanumeric+Underscore, case-insensitive — robust gegen Markdown/Backticks/Punctuation.
function mentions(description, field) {
  if (typeof description !== 'string' || typeof field !== 'string' || field.length === 0) return false;
  // Wortgrenze um das Feld; Underscore ist Teil des Wortes, deshalb explizit [^\w] als Boundary.
  const re = new RegExp(`(^|[^\\w])${field.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}([^\\w]|$)`, 'i');
  return re.test(description);
}

const findings = [];
let toolsWithoutOutputContract = 0;

for (const t of TOOLS) {
  if (!t || typeof t !== 'object') {
    findings.push({ tool: '?', kind: 'shape', detail: 'Tool ist kein Objekt' });
    continue;
  }
  if (typeof t.name !== 'string' || !t.name) {
    findings.push({ tool: '?', kind: 'shape', detail: 'name fehlt oder leer' });
    continue;
  }
  if (typeof t.description !== 'string' || !t.description) {
    findings.push({ tool: t.name, kind: 'shape', detail: 'description fehlt oder leer' });
    continue;
  }
  const desc = t.description;
  const inputProps = t.inputSchema?.properties ?? {};
  for (const field of Object.keys(inputProps)) {
    if (!mentions(desc, field)) {
      findings.push({ tool: t.name, kind: 'input', detail: `Input-Feld \`${field}\` nicht in description` });
    }
  }
  if (Array.isArray(t.outputContract)) {
    for (const field of t.outputContract) {
      if (typeof field !== 'string') continue;
      if (!mentions(desc, field)) {
        findings.push({ tool: t.name, kind: 'output', detail: `Output-Feld \`${field}\` nicht in description` });
      }
    }
  } else {
    toolsWithoutOutputContract++;
  }
}

const summary = { tools_checked: TOOLS.length, findings: findings.length, tools_without_output_contract: toolsWithoutOutputContract };

if (ARGS.json) {
  console.log(JSON.stringify({ ...summary, findings }, null, 2));
} else {
  console.log(`mcp-doc-drift-gate — ${summary.tools_checked} Tools geprüft, ${summary.findings} Drift-Stellen\n`);
  for (const f of findings) console.log(`  ✗ ${f.tool} — ${f.detail}`);
  if (toolsWithoutOutputContract > 0) {
    console.log(`\n  Hinweis: ${toolsWithoutOutputContract} Tools ohne outputContract — Output-Drift wurde NICHT geprüft.`);
  }
  if (findings.length === 0) console.log('\nkeine Drift.');
}

process.exit(findings.length === 0 ? 0 : 1);
