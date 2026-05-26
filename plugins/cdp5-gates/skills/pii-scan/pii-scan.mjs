#!/usr/bin/env node
// CDP5 §15.6/§15.7/§2.7 T1-Skill — pii-scan (read-only): findet KLARTEXT-PII in Repo/Testdaten/
// Traces (E-Mail, IBAN, Telefon, Kreditkarte). Dependency-frei, redacted Output.
// HYBRID: der Regex-Teil ist deterministisch; die semantische Einstufung (echter Name vs.
// Zufallsstring) gehört in ein review-verify-Overlay — kein finaler Wahrheits-Gate allein.
// Exit: 0 = sauber · 1 = ≥1 Fund · 2 = Nutzungsfehler.

import { readFileSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

const SKIP = new Set(['.git', 'node_modules', 'vendor', 'var', 'cache', '.idea', 'dist', 'build', '.tmp']);
const EXT = new Set(['.php', '.js', '.mjs', '.ts', '.py', '.rb', '.go', '.java', '.json', '.yaml', '.yml', '.xml', '.csv', '.sql', '.txt', '.md', '.env', '.ini', '.toml']);
// PLACEHOLDER wird gegen den GEMATCHTEN Wert geprüft (nicht die ganze Zeile), damit echte PII
// neben einem Platzhalter nicht verloren geht. 0{12,} = all-zero-Testkarten (engt IBANs mit Nullen NICHT aus).
const PLACEHOLDER = /\byour[_-]|example\.(com|org)|@example\.|\bxxx+\b|0{12,}|changeme|<[^>]+>/i;

const PATTERNS = [
  { type: 'E-Mail', re: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { type: 'IBAN', re: /\b[A-Z]{2}\d{2}[A-Z0-9]{11,30}\b/g },
  { type: 'Telefon', re: /\+\d{2,3}[\s\-/]?\d[\d\s\-/]{7,}\d/g },
  { type: 'Kreditkarte', re: /\b(?:\d[ -]?){13,16}\b/g, luhn: true },
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
    for (const p of PATTERNS) {
      for (const m of line.matchAll(p.re)) {
        if (PLACEHOLDER.test(m[0])) continue;        // pro Match, nicht pro Zeile
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
      if (st.isSymbolicLink()) continue;              // keine Symlink-Loops verfolgen
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
    let txt; try { txt = readFileSync(f, 'utf8'); } catch { continue; }  // Binary/Invalid-UTF8 → skip, kein Crash
    for (const x of scanText(txt, relative(root, f))) findings.push(x);
  }
  return findings;
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (!a.repo) { console.error('Usage: pii-scan.mjs --repo=<root> [--json]'); process.exit(2); }
  const f = scanRepo(a.repo);
  if (a.json) { console.log(JSON.stringify(f, null, 2)); process.exit(f.length ? 1 : 0); }
  console.log(`pii-scan — ${f.length} mögliche PII-Funde (redacted)\n`);
  for (const x of f) console.log(`  ✗ ${x.type}  ${x.file}:${x.line}  (${x.match})`);
  if (!f.length) console.log('  keine Klartext-PII gefunden.');
  else console.log('\nHybrid: semantisch verifizieren (review-verify) — Regex kann false-positive sein.');
  process.exit(f.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
