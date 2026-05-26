import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanText, scanRepo } from './secrets-scan.mjs';

test('ReDoS-Schutz: 500k-Zeichen-Nicht-Treffer-Zeile scannt schnell (<1s)', () => {
  const evil = 'a'.repeat(500_000);
  const t0 = Date.now();
  assert.equal(scanText(evil, 'x').length, 0);
  assert.ok(Date.now() - t0 < 1000, `zu langsam: ${Date.now() - t0}ms (ReDoS?)`);
});

test('Symlink wird beim Walk übersprungen (kein Out-of-tree-Read)', () => {
  const outside = mkdtempSync(join(tmpdir(), 'ss-out-'));
  writeFileSync(join(outside, 'leak.txt'), 'const k = "AKIAABCDEFGHIJKLMNOP";\n');
  const root = mkdtempSync(join(tmpdir(), 'ss-root-'));
  try { symlinkSync(outside, join(root, 'link')); } catch { return; }   // Symlink evtl. nicht erlaubt → skip
  assert.ok(scanRepo(outside).hasSecrets, 'Setup: Secret im Zielordner wird direkt erkannt');
  assert.equal(scanRepo(root).findings.length, 0, 'über den Symlink darf nichts gescannt werden');
});

test('findet AWS-Key, Private-Key, Secret-Assignment; ignoriert Placeholder + ${}', () => {
  const text = [
    'const k = "AKIAABCDEFGHIJKLMNOP";',
    '-----BEGIN RSA PRIVATE KEY-----',
    'api_key: "sk_live_abcdef0123456789xyz"',
    'password = "${DB_PASSWORD}"',          // Placeholder → ignorieren
    'token = "your_token_here"',            // Placeholder → ignorieren
  ].join('\n');
  const f = scanText(text, 'x.txt');
  const types = f.map((x) => x.type);
  assert.ok(types.includes('AWS-Access-Key'));
  assert.ok(types.includes('Private-Key'));
  assert.ok(types.includes('Secret-Assignment'));
  // Placeholder/Env-Ref dürfen nicht als Secret-Assignment auftauchen
  assert.ok(!f.some((x) => x.match.startsWith('$')));
  assert.ok(!f.some((x) => /your/.test(x.match)));
});

test('Redaction maskiert den Wert', () => {
  const f = scanText('aws = AKIAABCDEFGHIJKLMNOP', 'x.txt');
  assert.ok(f[0].match.includes('…'));
  assert.ok(!f[0].match.includes('GHIJKLMN'));
});
