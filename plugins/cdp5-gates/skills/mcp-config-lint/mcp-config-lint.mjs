#!/usr/bin/env node
// CDP5 §32.9 / §33.3 T1 skill — mcp-config-lint (read-only): heuristic risk checks of an
// MCP server configuration (.mcp.json / mcpServers block). Covers the threats from the MCP booklet:
// injection patterns in configuration strings, rug-pull (unpinned), cleartext secrets, unvetted third-party servers.
// Exit: 0 = no 🔴 · 1 = ≥1 🔴 (injection signal / cleartext secret) · 2 = usage error.

import { readFileSync } from 'node:fs';
import { guardPaths } from '../../lib/args.mjs';

const INJECTION = /(ignore (the )?(previous|above|prior)|disregard .*instruction|exfiltrat|\bid_rsa\b|\.ssh\b|BEGIN [A-Z ]*PRIVATE KEY|base64 |curl\s+-|\bwget\b|process\.env|\.env\b)/i;
const SECRET_VAL = /^[A-Za-z0-9_\-]{20,}$/; // long token, not a ${...} placeholder

export function lintMcp(configText) {
  let cfg;
  try { cfg = JSON.parse(configText); } catch (e) { return { error: `JSON parse error: ${e.message}`, findings: [] }; }
  const servers = cfg.mcpServers || cfg.servers || cfg['mcp.servers'] || {};
  const findings = [];
  for (const [name, s] of Object.entries(servers)) {
    const blob = JSON.stringify(s);
    if (INJECTION.test(blob)) findings.push({ sev: '🔴', server: name, issue: 'Injection signal in the server configuration strings (tool poisoning?)' });
    // unpinned npx package → rug-pull/supply chain
    const args = Array.isArray(s.args) ? s.args : [];
    const pkg = args.find((x) => typeof x === 'string' && x.startsWith('@') && x.includes('/'));
    if ((s.command === 'npx' || /npx/.test(s.command || '')) && pkg && !/@[^/]+\/[^@]+@/.test(pkg) && !pkg.includes('@', 1))
      findings.push({ sev: '🟡', server: name, issue: `unpinned package "${pkg}" (rug-pull/supply chain) — pin the version` });
    // cleartext secret in env
    for (const [k, v] of Object.entries(s.env || {})) {
      if (typeof v === 'string' && !v.startsWith('${') && SECRET_VAL.test(v))
        findings.push({ sev: '🔴', server: name, issue: `Cleartext secret in env.${k} — reference it via \${ENV_VAR}` });
    }
    // third party without recognisable pinning/trust
    if (pkg && !/modelcontextprotocol/.test(pkg))
      findings.push({ sev: '🟡', server: name, issue: `third-party server "${pkg}" — vet the trust source (registry/signature)` });
  }
  return { servers: Object.keys(servers).length, findings, hasCritical: findings.some((f) => f.sev === '🔴') };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.config) { console.error('Usage: mcp-config-lint.mjs --config=<.mcp.json> [--json]'); process.exit(2); }
  guardPaths([[a.config, 'file']]);
  const r = lintMcp(readFileSync(a.config, 'utf8'));
  if (r.error) { console.error(r.error); process.exit(2); }   // malformed config = input error → exit 2 (not 1)
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.hasCritical ? 1 : 0); }
  console.log(`mcp-config-lint — ${r.servers} servers, ${r.findings.length} findings\n`);
  for (const f of r.findings) console.log(`  ${f.sev} [${f.server}] ${f.issue}`);
  if (!r.findings.length) console.log('  no risk signals.');
  process.exit(r.hasCritical ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
