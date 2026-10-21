import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, iban97, PLACEHOLDER } from './pii-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('ReDoS protection: 500k-character non-matching line scans fast (<1s)', () => {
  const evil = 'a'.repeat(500_000);                 // greedy local-part trap without @ → pre-fix O(n²)
  const t0 = Date.now();
  assert.equal(scanText(evil, 'x').length, 0);
  assert.ok(Date.now() - t0 < 1000, `too slow: ${Date.now() - t0}ms (ReDoS?)`);
});

test('finds email + IBAN, ignores placeholders/example.com', () => {
  const t = [
    'user contact: max.muster@firma.de',
    'iban = DE89370400440532013000',
    'admin: test@example.com',         // example → ignore
    'mail = "${SUPPORT_EMAIL}"',        // placeholder → ignore
  ].join('\n');
  const f = scanText(t, 'x.txt');
  assert.ok(f.some((x) => x.type === 'Email'));
  assert.ok(f.some((x) => x.type === 'IBAN'));
  assert.ok(!f.some((x) => x.match.includes('example')));   // redacted, but in any case not example
  assert.equal(f.filter((x) => x.type === 'Email').length, 1); // only the real one
  assert.ok(f.every((x) => x.sev === '🔴'));
});

test('credit card only with a valid Luhn checksum', () => {
  const valid = scanText('card 4242 4242 4242 4242', 'x.txt');   // valid Luhn
  const invalid = scanText('id 1234 5678 1234 5678', 'x.txt');    // invalid Luhn
  assert.ok(valid.some((x) => x.type === 'Credit card'));
  assert.ok(!invalid.some((x) => x.type === 'Credit card'));
});

test('IBAN only with a valid mod-97 checksum', () => {
  assert.equal(iban97('DE89370400440532013000'), true);
  assert.equal(iban97('GB82WEST12345698765432'), true);
  assert.equal(iban97('DE00370400440532013000'), false);
  assert.equal(iban97('GB82WEST12345698765433'), false);
  const valid = scanText('iban DE89370400440532013000', 'x.txt');
  const invalid = scanText('ref GB82WEST12345698765433 looks like an IBAN but is not', 'x.txt');
  assert.ok(valid.some((x) => x.type === 'IBAN'));
  assert.ok(!invalid.some((x) => x.type === 'IBAN'));
});

test('placeholder list covers ${…} interpolation', () => {
  assert.ok(PLACEHOLDER.test('${SUPPORT_EMAIL}'));
  assert.ok(PLACEHOLDER.test('your_email'));
  assert.ok(PLACEHOLDER.test('<email>'));
  assert.ok(!PLACEHOLDER.test('max.muster@firma.de'));
});

test('redaction masks the value', () => {
  const f = scanText('mail: maxmustermann@firma.de', 'x.txt');
  assert.ok(f[0].match.includes('…') && !f[0].match.includes('maxmustermann'));
});

test('CLI: runs from a path containing a space and prints output', () => {
  const base = mkdtempSync(join(tmpdir(), 'cdp5 gates '));
  try {
    cpSync(resolve(HERE, '../../lib'), join(base, 'lib'), { recursive: true });
    const skillDir = join(base, 'skills', 'pii-scan');
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(join(HERE, 'pii-scan.mjs'), join(skillDir, 'pii-scan.mjs'));
    const repo = join(base, 'repo'); mkdirSync(repo);
    writeFileSync(join(repo, 'data.txt'), 'contact: max.muster@firma.de\n');
    const r = spawnSync('node', [join(skillDir, 'pii-scan.mjs'), `--repo=${repo}`], { encoding: 'utf8' });
    assert.match(r.stdout, /pii-scan — 1 possible PII findings/);
    assert.match(r.stdout, /🔴 Email/);
    assert.equal(r.status, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
