#!/usr/bin/env node
// CDP5 §32.9 / §33.3 T1-Skill — MCP-Config-Lint (read-only): heuristische Risiko-Checks einer
// MCP-Server-Konfiguration (.mcp.json / mcpServers-Block). Deckt die Heft-Bedrohungen ab:
// Tool-Description-Injection, Rug-Pull (unpinned), Cleartext-Secrets, ungevettete Fremd-Server.
// Exit: 0 = keine 🔴 · 1 = ≥1 🔴 (Injection-Signal / Cleartext-Secret) · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { guardPaths } from '../../lib/args.mjs';

const INJECTION = /(ignore (the )?(previous|above|prior)|disregard .*instruction|exfiltrat|\bid_rsa\b|\.ssh\b|BEGIN [A-Z ]*PRIVATE KEY|base64 |curl\s+-|\bwget\b|process\.env|\.env\b)/i;
const SECRET_VAL = /^[A-Za-z0-9_\-]{20,}$/; // langer Token, kein ${...}-Placeholder

export function lintMcp(configText) {
  let cfg;
  try { cfg = JSON.parse(configText); } catch (e) { return { error: `JSON-Parse-Fehler: ${e.message}`, findings: [] }; }
  const servers = cfg.mcpServers || cfg.servers || cfg['mcp.servers'] || {};
  const findings = [];
  for (const [name, s] of Object.entries(servers)) {
    const blob = JSON.stringify(s);
    if (INJECTION.test(blob)) findings.push({ sev: '🔴', server: name, issue: 'Injection-Signal in der Server-/Tool-Beschreibung (Tool-Poisoning?)' });
    // unpinned npx-Paket → Rug-Pull/Supply-Chain
    const args = Array.isArray(s.args) ? s.args : [];
    const pkg = args.find((x) => typeof x === 'string' && x.startsWith('@') && x.includes('/'));
    if ((s.command === 'npx' || /npx/.test(s.command || '')) && pkg && !/@[^/]+\/[^@]+@/.test(pkg) && !pkg.includes('@', 1))
      findings.push({ sev: '🟡', server: name, issue: `ungepinntes Paket „${pkg}" (Rug-Pull/Supply-Chain) — Version pinnen` });
    // Cleartext-Secret in env
    for (const [k, v] of Object.entries(s.env || {})) {
      if (typeof v === 'string' && !v.startsWith('${') && SECRET_VAL.test(v))
        findings.push({ sev: '🔴', server: name, issue: `Cleartext-Secret in env.${k} — über \${ENV_VAR} referenzieren` });
    }
    // Drittanbieter ohne erkennbares Pinning/Trust
    if (pkg && !/modelcontextprotocol/.test(pkg))
      findings.push({ sev: '🟡', server: name, issue: `Drittanbieter-Server „${pkg}" — Trust-Source vetten (Registry/Signatur)` });
  }
  return { servers: Object.keys(servers).length, findings, hasCritical: findings.some((f) => f.sev === '🔴') };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.config) { console.error('Usage: mcp-config-lint.mjs --config=<.mcp.json> [--json]'); process.exit(2); }
  guardPaths([[a.config, 'file']]);
  const r = lintMcp(readFileSync(a.config, 'utf8'));
  if (r.error) { console.error(r.error); process.exit(2); }   // malformed Config = Input-Fehler → Exit 2 (nicht 1)
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.hasCritical ? 1 : 0); }
  console.log(`MCP-Config-Lint — ${r.servers} Server, ${r.findings.length} Befunde\n`);
  for (const f of r.findings) console.log(`  ${f.sev} [${f.server}] ${f.issue}`);
  if (!r.findings.length) console.log('  keine Risiko-Signale.');
  process.exit(r.hasCritical ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
