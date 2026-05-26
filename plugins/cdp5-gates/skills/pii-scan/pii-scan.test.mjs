import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './pii-scan.mjs';

test('ReDoS-Schutz: 500k-Zeichen-Nicht-Treffer-Zeile scannt schnell (<1s)', () => {
  const evil = 'a'.repeat(500_000);                 // greedy Local-Part-Falle ohne @ → pre-fix O(n²)
  const t0 = Date.now();
  assert.equal(scanText(evil, 'x').length, 0);
  assert.ok(Date.now() - t0 < 1000, `zu langsam: ${Date.now() - t0}ms (ReDoS?)`);
});

test('findet E-Mail + IBAN, ignoriert Platzhalter/example.com', () => {
  const t = [
    'user contact: max.muster@firma.de',
    'iban = DE89370400440532013000',
    'admin: test@example.com',         // example → ignorieren
    'mail = "${SUPPORT_EMAIL}"',        // Platzhalter → ignorieren
  ].join('\n');
  const f = scanText(t, 'x.txt');
  assert.ok(f.some((x) => x.type === 'E-Mail'));
  assert.ok(f.some((x) => x.type === 'IBAN'));
  assert.ok(!f.some((x) => x.match.includes('example')));   // redacted, aber jedenfalls nicht example
  assert.equal(f.filter((x) => x.type === 'E-Mail').length, 1); // nur die echte
});

test('Kreditkarte nur bei gültiger Luhn-Prüfsumme', () => {
  const valid = scanText('card 4242 4242 4242 4242', 'x.txt');   // gültige Luhn
  const invalid = scanText('id 1234 5678 1234 5678', 'x.txt');    // ungültige Luhn
  assert.ok(valid.some((x) => x.type === 'Kreditkarte'));
  assert.ok(!invalid.some((x) => x.type === 'Kreditkarte'));
});

test('Redaction maskiert den Wert', () => {
  const f = scanText('mail: maxmustermann@firma.de', 'x.txt');
  assert.ok(f[0].match.includes('…') && !f[0].match.includes('maxmustermann'));
});
