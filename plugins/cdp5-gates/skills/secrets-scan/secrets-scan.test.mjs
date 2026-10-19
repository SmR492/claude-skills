import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { scanText, scanRepo } from './secrets-scan.mjs';

test('ReDoS protection: 500k-character non-matching line scans fast (<1s)', () => {
  const evil = 'a'.repeat(500_000);
  const t0 = Date.now();
  assert.equal(scanText(evil, 'x').length, 0);
  assert.ok(Date.now() - t0 < 1000, `too slow: ${Date.now() - t0}ms (ReDoS?)`);
});

test('symlink is skipped during the walk (no out-of-tree read)', () => {
  const outside = mkdtempSync(join(tmpdir(), 'ss-out-'));
  writeFileSync(join(outside, 'leak.txt'), 'const k = "AKIAABCDEFGHIJKLMNOP";\n');
  const root = mkdtempSync(join(tmpdir(), 'ss-root-'));
  try { symlinkSync(outside, join(root, 'link')); } catch { return; }   // symlink possibly not permitted → skip
  assert.ok(scanRepo(outside).hasSecrets, 'setup: secret in the target folder is detected directly');
  assert.equal(scanRepo(root).findings.length, 0, 'nothing must be scanned through the symlink');
});

test('finds AWS key, private key, secret assignment; ignores placeholder + ${}', () => {
  const text = [
    'const k = "AKIAABCDEFGHIJKLMNOP";',
    '-----BEGIN RSA PRIVATE KEY-----',
    'api_key: "sk_live_abcdef0123456789xyz"',
    'password = "${DB_PASSWORD}"',          // placeholder → ignore
    'token = "your_token_here"',            // placeholder → ignore
  ].join('\n');
  const f = scanText(text, 'x.txt');
  const types = f.map((x) => x.type);
  assert.ok(types.includes('AWS-Access-Key'));
  assert.ok(types.includes('Private-Key'));
  assert.ok(types.includes('Secret-Assignment'));
  // placeholder/env ref must not show up as a secret assignment
  assert.ok(!f.some((x) => x.match.startsWith('$')));
  assert.ok(!f.some((x) => /your/.test(x.match)));
});

test('redaction masks the value', () => {
  const f = scanText('aws = AKIAABCDEFGHIJKLMNOP', 'x.txt');
  assert.ok(f[0].match.includes('…'));
  assert.ok(!f[0].match.includes('GHIJKLMN'));
});
