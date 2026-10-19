import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './pii-scan.mjs';

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
});

test('credit card only with a valid Luhn checksum', () => {
  const valid = scanText('card 4242 4242 4242 4242', 'x.txt');   // valid Luhn
  const invalid = scanText('id 1234 5678 1234 5678', 'x.txt');    // invalid Luhn
  assert.ok(valid.some((x) => x.type === 'Credit card'));
  assert.ok(!invalid.some((x) => x.type === 'Credit card'));
});

test('redaction masks the value', () => {
  const f = scanText('mail: maxmustermann@firma.de', 'x.txt');
  assert.ok(f[0].match.includes('…') && !f[0].match.includes('maxmustermann'));
});
