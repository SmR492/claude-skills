import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scanText } from './secrets-scan.mjs';

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
