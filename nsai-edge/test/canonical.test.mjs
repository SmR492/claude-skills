import { test } from 'node:test';
import assert from 'node:assert/strict';
import { tripleHash, canonicalInput } from '../src/canonical.mjs';

test('Hash hat sha256:-Präfix und ist deterministisch', () => {
  const a = tripleHash('Glatteis', 'verursacht', 'Unfall');
  const b = tripleHash('Glatteis', 'verursacht', 'Unfall');
  assert.equal(a, b);
  assert.match(a, /^sha256:[0-9a-f]{64}$/);
});

test('Kanonische Serialisierung nutzt 0x1F-Trennzeichen + NFC', () => {
  // NFC: vorkomponiert == dekomponiert
  const composed = canonicalInput('Café', 'p', 'o'); // e + combining acute
  const precomposed = canonicalInput('Café', 'p', 'o'); // é
  assert.equal(composed, precomposed);
  assert.ok(canonicalInput('a', 'b', 'c').includes('\x1f'));
});

test('Verschiedene Tripel → verschiedene Hashes', () => {
  assert.notEqual(tripleHash('A', 'p', 'B'), tripleHash('A', 'p', 'C'));
});
