#!/usr/bin/env node
// CDP5 §15.6/§15.7/§2.7 T1 skill — pii-scan (read-only): finds CLEARTEXT PII in repo/test data/
// traces (email, IBAN, phone, credit card). Dependency-free, redacted output.
// HYBRID: the regex part is deterministic; the semantic classification (real name vs.
// random string) belongs in a review-verify overlay — not a final truth gate on its own.
// Exit: 0 = clean · 1 = ≥1 finding · 2 = usage error.

import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { guardPaths } from '../../lib/args.mjs';
import { join, relative, extname, basename } from 'node:path';

const SKIP = new Set(['.git', 'node_modules', 'vendor', 'var', 'cache', '.idea', 'dist', 'build', '.tmp']);
const EXT = new Set(['.php', '.js', '.mjs', '.ts', '.py', '.rb', '.go', '.java', '.json', '.yaml', '.yml', '.xml', '.csv', '.sql', '.txt', '.md', '.env', '.ini', '.toml']);
// PLACEHOLDER is tested against the MATCHED value (not the whole line) so that real PII
// next to a placeholder is not lost. 0{12,} = all-zero test cards (does NOT exclude IBANs containing zeros).
const PLACEHOLDER = /\byour[_-]|example\.(com|org)|@example\.|\bxxx+\b|0{12,}|changeme|<[^>]+>/i;
const MAX_LINE = 4000;   // PII never sits in overlong single tokens — cap against quadratic regex backtracking (ReDoS)

// Quantifiers deliberately bounded (close to RFC) → no O(n²) backtracking on long non-matching lines.
const PATTERNS = [
  { type: 'Email', re: /[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,255}\.[A-Za-z]{2,24}/g },
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { type: 'Phone', re: /\+\d{2,3}[\s\-/]?\d[\d\s\-/]{7,40}\d/g },
  { type: 'Credit card', re: /\b(?:\d[ -]?){13,16}\b/g, luhn: true },
];

function luhn(s) {
  const d = s.replace(/\D/g, '');
  if (d.length < 13) return false;
  let sum = 0, alt = false;
  for (let i = d.length - 1; i >= 0; i--) { let n = +d[i]; if (alt) { n *= 2; if (n > 9) n -= 9; } sum += n; alt = !alt; }
  return sum % 10 === 0;
}

const redact = (m) => m.length <= 4 ? '…' : m.slice(0, 2) + '…' + m.slice(-2);

export function scanText(text, file) {
  const out = [];
  text.split('\n').forEach((line, i) => {
    if (line.length > MAX_LINE) line = line.slice(0, MAX_LINE);   // ReDoS protection: truncate overlong line
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        if (PLACEHOLDER.test(m[0])) continue;        // per match, not per line
        if (p.luhn && !luhn(m[0])) continue;
        out.push({ file, line: i + 1, type: p.type, match: redact(m[0]) });
      }
    }
  });
  return out;
}

function collect(root) {
  const out = [];
  const walk = (d) => {
    let e; try { e = readdirSync(d); } catch { return; }
    for (const n of e) {
      if (SKIP.has(n)) continue;
      const f = join(d, n); let st; try { st = lstatSync(f); } catch { continue; }
      if (st.isSymbolicLink()) continue;              // do not follow symlink loops
      if (st.isDirectory()) walk(f);
      else if ((EXT.has(extname(n)) || /^\.env/.test(basename(n))) && st.size <= 1_000_000) out.push(f);
    }
  };
  walk(root);
  return out;
}

export function scanRepo(root) {
  const findings = [];
  for (const f of collect(root)) {
    let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }  // binary/invalid UTF-8 → skip, no crash
    for (const x of scanText(txt, relative(root, f))) findings.push(x);
  }
  return findings;
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (!a.repo) { console.error('Usage: pii-scan.mjs --repo=<root> [--json]'); process.exit(2); }
  guardPaths([[a.repo, 'dir']]);
  const f = scanRepo(a.repo);
  if (a.json) { console.log(JSON.stringify(f, null, 2)); process.exit(f.length ? 1 : 0); }
  console.log(`pii-scan — ${f.length} possible PII findings (redacted)\n`);
  for (const x of f) console.log(`  ✗ ${x.type}  ${x.file}:${x.line}  (${x.match})`);
  if (!f.length) console.log('  no cleartext PII found.');
  else console.log('\nHybrid: verify semantically (review-verify) — regex can be a false positive.');
  process.exit(f.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
