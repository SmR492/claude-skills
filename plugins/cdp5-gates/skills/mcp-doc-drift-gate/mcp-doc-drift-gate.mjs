#!/usr/bin/env node
// CDP5 §32.9 T1 skill — mcp-doc-drift-gate: checks that MCP tool descriptions
// mention every input field and (when declared) every output field. Closes the ADR-0016
// consumer-sycophancy class (an LLM invents meanings for undocumented fields).
// NOTE: the target module is loaded via import(), which EXECUTES its top-level code —
// run only on code built in this repository (§33.1).
//
// Exit: 0 = no 🔴 · 1 = ≥1 🔴 (drift / shape) · 2 = usage error.

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

// Whole-word match: alphanumeric + underscore form the word, case-insensitive — robust against
// Markdown/backticks/punctuation. No whitespace normalisation (a field name never contains spaces).
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
    findings.push({ sev: '🔴', tool: '?', kind: 'shape', detail: 'tool is not an object' });
    continue;
  }
  if (typeof t.name !== 'string' || !t.name) {
    findings.push({ sev: '🔴', tool: '?', kind: 'shape', detail: 'name missing or empty' });
    continue;
  }
  if (typeof t.description !== 'string' || !t.description) {
    findings.push({ sev: '🔴', tool: t.name, kind: 'shape', detail: 'description missing or empty' });
    continue;
  }
  if (!t.inputSchema || typeof t.inputSchema !== 'object') {
    findings.push({ sev: '🔴', tool: t.name, kind: 'shape', detail: 'inputSchema missing' });
  }
  const desc = t.description;
  const inputProps = t.inputSchema?.properties ?? {};
  for (const field of Object.keys(inputProps)) {
    if (!mentions(desc, field)) {
      findings.push({ sev: '🔴', tool: t.name, kind: 'input', detail: `Input field \`${field}\` not in description` });
    }
  }
  if (Array.isArray(t.outputContract)) {
    for (const field of t.outputContract) {
      if (typeof field !== 'string') continue;
      if (!mentions(desc, field)) {
        findings.push({ sev: '🔴', tool: t.name, kind: 'output', detail: `Output field \`${field}\` not in description` });
      }
    }
  } else {
    toolsWithoutOutputContract++;
    findings.push({ sev: '🟡', tool: t.name, kind: 'coverage', detail: 'tool without outputContract — output drift was NOT checked' });
  }
}

const critical = findings.filter((f) => f.sev === '🔴').length;
const exitCode = critical === 0 ? 0 : 1;
const summary = { tools_checked: TOOLS.length, findings: findings.length, drift: critical, tools_without_output_contract: toolsWithoutOutputContract, exit: exitCode };

if (ARGS.json) {
  console.log(JSON.stringify({ ...summary, findings }, null, 2));
} else {
  console.log(`mcp-doc-drift-gate — ${summary.tools_checked} tools checked, ${critical} drift spots\n`);
  for (const f of findings) console.log(`  ${f.sev} ${f.tool} — ${f.detail}`);
  if (findings.length) console.log('');
  console.log(critical === 0 ? `no drift  ·  exit ${exitCode}` : `${critical} drift  ·  exit ${exitCode}`);
}

process.exit(exitCode);
