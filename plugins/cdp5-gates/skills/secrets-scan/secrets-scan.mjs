#!/usr/bin/env node
// CDP5 §32.9 / §33.5 T1-Skill — Secrets-Scan (read-only, dependency-frei): findet Klartext-
// Secrets im Repo (Keys, Tokens, Private Keys, .env-Leaks). Exit: 0 = sauber · 1 = Funde · 2 = Nutzungsfehler.

import { readFileSync, readdirSync, lstatSync } from 'node:fs';

const MAX_LINE = 4000;   // ReDoS-Schutz: überlange Einzelzeilen vor dem Regex-Matching kappen (s. scanText)
import { join, relative, extname, basename } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'var', 'cache', '.idea', 'dist', 'build', '.tmp']);
const SCAN_EXT = new Set(['.php', '.js', '.mjs', '.ts', '.py', '.rb', '.go', '.java', '.yaml', '.yml', '.json', '.sh', '.txt', '.md', '.ini', '.conf', '.properties', '.xml']);
const PLACEHOLDER = /^(your|example|changeme|placeholder|xxx+|dummy|test|sample|\$\{|<)/i;

const PATTERNS = [
  { type: 'AWS-Access-Key', re: /\bAKIA[0-9A-Z]{16}\b/ },
  { type: 'Private-Key', re: /-----BEGIN [A-Z ]*PRIVATE KEY-----/ },
  { type: 'OpenAI-Key', re: /\bsk-[A-Za-z0-9]{20,}\b/ },
  { type: 'GitHub-Token', re: /\b(ghp_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{22,})\b/ },
  { type: 'Slack-Token', re: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/ },
  { type: 'Google-API-Key', re: /\bAIza[0-9A-Za-z\-_]{35}\b/ },
  { type: 'JWT', re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/ },
  { type: 'Secret-Assignment', re: /(?:api[_-]?key|secret|token|password|passwd|access[_-]?key)['"]?\s*[:=]\s*['"]?([A-Za-z0-9_\-./+]{12,})['"]?/i, group: 1 },
];

function isEnvFile(name) { return name === '.env' || /\.env(\.|$)/.test(name); }

function collect(root) {
  const out = [];
  const walk = (d) => {
    let e; try { e = readdirSync(d); } catch { return; }
    for (const n of e) {
      if (SKIP_DIRS.has(n)) continue;
      const f = join(d, n); let st; try { st = lstatSync(f); } catch { continue; }
      if (st.isSymbolicLink()) continue;            // keine Symlinks verfolgen (Out-of-tree-Read / Loop)
      if (st.isDirectory()) walk(f);
      else if (st.size < 1_000_000 && (SCAN_EXT.has(extname(n)) || isEnvFile(n))) out.push(f);
    }
  };
  walk(root);
  return out;
}

const redact = (s) => (s.length <= 8 ? s[0] + '…' : s.slice(0, 4) + '…' + s.slice(-2));

export function scanText(text, file) {
  const findings = [];
  text.split('\n').forEach((line, i) => {
    if (line.length > MAX_LINE) line = line.slice(0, MAX_LINE);   // ReDoS-Schutz: überlange Zeile kappen
    for (const p of PATTERNS) {
      const m = line.match(p.re);
      if (!m) continue;
      const val = p.group ? m[p.group] : m[0];
      if (p.group && PLACEHOLDER.test(val)) continue;
      findings.push({ file, line: i + 1, type: p.type, match: redact(val) });
    }
  });
  return findings;
}

export function scanRepo(root) {
  const files = collect(root);
  const findings = [];
  for (const f of files) findings.push(...scanText(readFileSync(f, 'utf8'), relative(root, f)));
  return { findings, scanned: files.length, hasSecrets: findings.length > 0 };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.repo) { console.error('Usage: secrets-scan.mjs --repo=<root> [--json]'); process.exit(2); }
  const r = scanRepo(a.repo);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.hasSecrets ? 1 : 0); }
  console.log(`Secrets-Scan — ${r.scanned} Dateien, ${r.findings.length} Funde\n`);
  for (const f of r.findings) console.log(`  ✗ ${f.type}  ${f.file}:${f.line}  (${f.match})`);
  if (!r.hasSecrets) console.log('  keine Klartext-Secrets gefunden.');
  process.exit(r.hasSecrets ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
