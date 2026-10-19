#!/usr/bin/env node
// CDP5 §32.9 T1 skill — mcp-doc-drift-gate (read-only): checks that MCP tool descriptions
// mention every input field and (when declared) every output field. Closes the ADR-0016
// consumer-sycophancy class (an LLM invents meanings for undocumented fields).
//
// Exit: 0 = no drift · 1 = drift found · 2 = usage error.

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

// Dynamic import of the MCP server — convention: `export const TOOLS = [...]`.
let TOOLS;
try {
  const mod = await import(pathToFileURL(resolvePath(ARGS.mcp)).href);
  TOOLS = mod.TOOLS;
  if (!Array.isArray(TOOLS)) {
    console.error(`not found: export TOOLS in ${ARGS.mcp}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`import failed: ${e.message}`);
  process.exit(2);
}

// Tokenize: alphanumeric + underscore, case-insensitive — robust against Markdown/backticks/punctuation.
function mentions(description, field) {
  if (typeof description !== 'string' || typeof field !== 'string' || field.length === 0) return false;
  // Word boundary around the field; underscore is part of the word, hence explicit [^\w] as boundary.
  const re = new RegExp(`(^|[^\\w])${field.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')}([^\\w]|$)`, 'i');
  return re.test(description);
}

const findings = [];
let toolsWithoutOutputContract = 0;

for (const t of TOOLS) {
  if (!t || typeof t !== 'object') {
    findings.push({ tool: '?', kind: 'shape', detail: 'tool is not an object' });
    continue;
  }
  if (typeof t.name !== 'string' || !t.name) {
    findings.push({ tool: '?', kind: 'shape', detail: 'name missing or empty' });
    continue;
  }
  if (typeof t.description !== 'string' || !t.description) {
    findings.push({ tool: t.name, kind: 'shape', detail: 'description missing or empty' });
    continue;
  }
  const desc = t.description;
  const inputProps = t.inputSchema?.properties ?? {};
  for (const field of Object.keys(inputProps)) {
    if (!mentions(desc, field)) {
      findings.push({ tool: t.name, kind: 'input', detail: `Input field \`${field}\` not in description` });
    }
  }
  if (Array.isArray(t.outputContract)) {
    for (const field of t.outputContract) {
      if (typeof field !== 'string') continue;
      if (!mentions(desc, field)) {
        findings.push({ tool: t.name, kind: 'output', detail: `Output field \`${field}\` not in description` });
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
  console.log(`mcp-doc-drift-gate — ${summary.tools_checked} tools checked, ${summary.findings} drift spots\n`);
  for (const f of findings) console.log(`  ✗ ${f.tool} — ${f.detail}`);
  if (toolsWithoutOutputContract > 0) {
    console.log(`\n  Note: ${toolsWithoutOutputContract} tools without outputContract — output drift was NOT checked.`);
  }
  if (findings.length === 0) console.log('\nno drift.');
}

process.exit(findings.length === 0 ? 0 : 1);
