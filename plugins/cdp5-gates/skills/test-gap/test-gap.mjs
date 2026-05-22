#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — Test-Gap-Finder (read-only): welche sicherheitskritischen Klassen
// (Voter / State-Processor / Authenticator) haben KEINEN Test? Reine Detektion.
// Das Test-Scaffolding (Code-Generierung) bleibt Agent-/Mensch-Arbeit (würde blocken).
// Exit: 0 = keine Lücke · 1 = ≥1 ungetestete sicherheitskritische Klasse · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { collectFiles, relative } from '../../lib/scan.mjs';

const SEC_FILE = /(Voter|StateProcessor|Authenticator)\.php$/;
const SEC_CONTENT = /(extends\s+\w*Voter\b|implements[^\n]*\b(Authenticator|StateProcessor|ProcessorInterface|AuthenticatorInterface)\w*\b)/;

export function findTestGaps(repoRoot) {
  const php = collectFiles(repoRoot, ['.php']);
  const testFiles = php.filter((f) => /Tests?\//.test(f) || /Test\.php$/.test(basename(f)));
  const testedNames = new Set(testFiles.map((f) => basename(f).replace(/Test\.php$/, '')));
  const testBlob = testFiles.map((f) => readFileSync(f, 'utf8')).join('\n');

  const gaps = [];
  const covered = [];
  for (const f of php) {
    if (/Test\.php$/.test(basename(f))) continue;
    const text = readFileSync(f, 'utf8');
    const isSec = SEC_FILE.test(f) || SEC_CONTENT.test(text);
    if (!isSec) continue;
    const cls = (text.match(/\bclass\s+(\w+)/) || [])[1] || basename(f).replace(/\.php$/, '');
    const hasNamedTest = testedNames.has(cls);
    const referenced = new RegExp(`\\b${cls}\\b`).test(testBlob);
    const entry = { class: cls, file: relative(repoRoot, f) };
    if (hasNamedTest || referenced) covered.push(entry); else gaps.push(entry);
  }
  return { gaps, covered, scanned: php.length };
}

function main(argv) {
  const args = Object.fromEntries(argv.slice(2).map((a) => { const [k, v] = a.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!args.repo) { console.error('Usage: test-gap.mjs --repo=<repo-root> [--json]'); process.exit(2); }
  const r = findTestGaps(args.repo);
  if (args.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.gaps.length ? 1 : 0); }
  console.log(`Test-Gap-Finder — ${r.scanned} PHP-Dateien, ${r.covered.length} sicherheitskritische getestet, ${r.gaps.length} ohne Test\n`);
  for (const g of r.gaps) console.log(`  ✗ ${g.class}  (${g.file})`);
  if (!r.gaps.length) console.log('  keine ungetesteten sicherheitskritischen Klassen gefunden.');
  process.exit(r.gaps.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
