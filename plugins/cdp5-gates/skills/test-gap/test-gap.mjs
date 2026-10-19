#!/usr/bin/env node
// CDP5 §32.9 T1 skill — test-gap finder (read-only): which security-critical classes
// (Voter / StateProcessor / Authenticator) have NO test? Pure detection.
// Test scaffolding (code generation) remains agent/human work (it would block).
// Exit: 0 = no gap · 1 = ≥1 untested security-critical class · 2 = usage error.

import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { collectFiles, relative } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

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
  guardPaths([[args.repo, 'dir']]);
  const r = findTestGaps(args.repo);
  if (args.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.gaps.length ? 1 : 0); }
  console.log(`Test-gap finder — ${r.scanned} PHP files, ${r.covered.length} security-critical classes tested, ${r.gaps.length} without test\n`);
  for (const g of r.gaps) console.log(`  ✗ ${g.class}  (${g.file})`);
  if (!r.gaps.length) console.log('  no untested security-critical classes found.');
  process.exit(r.gaps.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
