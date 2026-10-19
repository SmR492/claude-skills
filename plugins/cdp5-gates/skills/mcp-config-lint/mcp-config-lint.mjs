#!/usr/bin/env node
// CDP5 §32.9 / §33.3 T1 skill — mcp-config-lint (read-only): heuristic risk checks of an
// MCP server configuration (.mcp.json / mcpServers block). Covers the threats from the MCP booklet:
// injection patterns in configuration strings, rug-pull (unpinned), cleartext secrets, unvetted third-party servers.
// Exit: 0 = no 🔴 · 1 = ≥1 🔴 (injection signal / cleartext secret) · 2 = usage error.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { guardPaths } from '../../lib/args.mjs';

const INJECTION = /(ignore (the )?(previous|above|prior)|disregard .*instruction|exfiltrat|\bid_rsa\b|\.ssh\b|BEGIN [A-Z ]*PRIVATE KEY|base64 |curl\s+-|\bwget\b|process\.env|\.env\b)/i;
const SECRET_VAL = /^[A-Za-z0-9_\-]{20,}$/;                    // long token, not a ${...} placeholder
const SECRET_KEY = /(KEY|TOKEN|SECRET|PASS|AUTH|CREDENTIAL)/i;   // key name that suggests a credential
const BEARER = /Bearer\s+\S{16,}/;                               // literal bearer token in a header value
const PLACEHOLDER = /\$\{/;                                      // ${ENV_VAR} reference → not a literal
// docker run flags that consume the next argument (so it is not the image name)
const DOCKER_VALUE_FLAGS = new Set(['-e', '--env', '--env-file', '-v', '--volume', '--mount', '-p', '--publish', '--name', '--network', '-w', '--workdir', '-u', '--user', '--entrypoint', '--platform', '-l', '--label', '--add-host']);

/** Scan a key/value map (env or headers) for literal credentials. */
function scanLiterals(section, map, name, findings) {
  for (const [k, v] of Object.entries(map || {})) {
    if (typeof v !== 'string' || PLACEHOLDER.test(v)) continue;
    if (section === 'headers' && BEARER.test(v)) {
      findings.push({ sev: '🔴', server: name, issue: `Cleartext bearer token in headers.${k} — reference it via \${ENV_VAR}` });
      continue;
    }
    if (!SECRET_VAL.test(v)) continue;
    if (SECRET_KEY.test(k)) findings.push({ sev: '🔴', server: name, issue: `Cleartext secret in ${section}.${k} — reference it via \${ENV_VAR}` });
    else findings.push({ sev: '🟡', server: name, issue: `long literal in ${section}.${k} — if it is a credential, reference it via \${ENV_VAR}` });
  }
}

/** First positional argument (not a flag) — the package for npx/uvx. */
const firstPositional = (args) => args.find((x) => typeof x === 'string' && !x.startsWith('-'));

/** Image name of a `docker run …` invocation (skips flags and their values). */
function dockerImage(args) {
  const i = args.indexOf('run');
  if (i < 0) return undefined;
  for (let j = i + 1; j < args.length; j++) {
    const a = args[j];
    if (typeof a !== 'string') continue;
    if (a.startsWith('-')) { if (DOCKER_VALUE_FLAGS.has(a)) j++; continue; }
    return a;
  }
  return undefined;
}

export function lintMcp(configText) {
  let cfg;
  try { cfg = JSON.parse(configText); } catch (e) { return { error: `JSON parse error: ${e.message}`, findings: [] }; }
  const servers = cfg.mcpServers || cfg.servers || cfg['mcp.servers'] || {};
  const findings = [];
  for (const [name, s] of Object.entries(servers)) {
    const blob = JSON.stringify(s);
    if (INJECTION.test(blob)) findings.push({ sev: '🔴', server: name, issue: 'Injection signal in the server configuration strings (tool poisoning?)' });
    const args = Array.isArray(s.args) ? s.args : [];
    const cmd = typeof s.command === 'string' ? s.command.split(/[\\/]/).pop() : '';
    // npx: unpinned package (scoped or unscoped) → rug-pull/supply chain; non-MCP-org package → third party
    if (/^npx/.test(cmd)) {
      const pkg = firstPositional(args);
      if (pkg) {
        const pinned = pkg.startsWith('@') ? /^@[^/]+\/[^@]+@./.test(pkg) : /^[^@]+@./.test(pkg);
        if (!pinned) findings.push({ sev: '🟡', server: name, issue: `unpinned package "${pkg}" (rug-pull/supply chain) — pin the version` });
        if (!/modelcontextprotocol/.test(pkg)) findings.push({ sev: '🟡', server: name, issue: `third-party server "${pkg}" — vet the trust source (registry/signature)` });
      }
    }
    // uvx: `pkg==1.2.3` or `pkg@1.2.3` counts as pinned
    if (/^uvx/.test(cmd)) {
      const pkg = firstPositional(args);
      if (pkg && !/==|@./.test(pkg)) findings.push({ sev: '🟡', server: name, issue: `unpinned package "${pkg}" (rug-pull/supply chain) — pin with ==version` });
    }
    // docker: image without :tag or @sha256 digest
    if (/^docker/.test(cmd)) {
      const image = dockerImage(args);
      if (image && !image.includes('@sha256:') && !image.split('/').pop().includes(':'))
        findings.push({ sev: '🟡', server: name, issue: `unpinned docker image "${image}" (rug-pull/supply chain) — pin a :tag or @sha256 digest` });
    }
    // remote server (url) → third party by definition
    if (typeof s.url === 'string' && s.url)
      findings.push({ sev: '🟡', server: name, issue: `third-party remote server "${s.url}" — vet the trust source (operator/TLS/auth)` });
    // cleartext secrets in env + headers
    scanLiterals('env', s.env, name, findings);
    scanLiterals('headers', s.headers, name, findings);
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
