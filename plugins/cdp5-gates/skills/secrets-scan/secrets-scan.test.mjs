import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, copyFileSync, writeFileSync, symlinkSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { scanText, scanRepo, PLACEHOLDER } from './secrets-scan.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

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
  assert.ok(f.every((x) => x.sev === '🔴'));
});

test('placeholder word forms need a separator — a credential starting with test…/sample…/dummy… is reported', () => {
  const real = scanText([
    'token = "test8f3kd9s0a1b2c3d4e5"',
    'secret = "sampleQx9Lm2Vb7Zt4Kp"',
    'password = "dummyA1b2C3d4E5f6G7"',
  ].join('\n'), 'x.txt');
  assert.equal(real.filter((x) => x.type === 'Secret-Assignment').length, 3);
  const fake = scanText([
    'token = "test_token_here_1234"',
    'secret = "sample-secret-value"',
    'password = "dummy_password_123"',
    'api_key = "xxxxxxxxxxxxxxxx"',
    'api_key = "<your-api-key-here>"',
  ].join('\n'), 'x.txt');
  assert.equal(fake.length, 0);
  assert.ok(PLACEHOLDER.test('placeholder_value'));
  assert.ok(!PLACEHOLDER.test('placeholderX9Lm2Vb7Zt4Kp'));
});

test('unreadable file is skipped and counted, not a crash', (t) => {
  if (typeof process.getuid === 'function' && process.getuid() === 0) { t.skip('root reads everything'); return; }
  if (process.platform === 'win32') { t.skip('chmod 000 has no effect on Windows'); return; }
  const root = mkdtempSync(join(tmpdir(), 'ss-unread-'));
  try {
    writeFileSync(join(root, 'ok.txt'), 'nothing here\n');
    const locked = join(root, 'locked.txt');
    writeFileSync(locked, 'const k = "AKIAABCDEFGHIJKLMNOP";\n');
    chmodSync(locked, 0o000);
    const r = scanRepo(root);
    assert.deepEqual(r.unreadable, ['locked.txt']);
    assert.equal(r.scanned, 1);
    assert.equal(r.hasSecrets, false);
  } finally { try { chmodSync(join(root, 'locked.txt'), 0o600); } catch {} rmSync(root, { recursive: true, force: true }); }
});

test('redaction masks the value', () => {
  const f = scanText('aws = AKIAABCDEFGHIJKLMNOP', 'x.txt');
  assert.ok(f[0].match.includes('…'));
  assert.ok(!f[0].match.includes('GHIJKLMN'));
});

test('CLI: runs from a path containing a space and prints output', () => {
  const base = mkdtempSync(join(tmpdir(), 'cdp5 gates '));
  try {
    cpSync(resolve(HERE, '../../lib'), join(base, 'lib'), { recursive: true });
    const skillDir = join(base, 'skills', 'secrets-scan');
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(join(HERE, 'secrets-scan.mjs'), join(skillDir, 'secrets-scan.mjs'));
    const repo = join(base, 'repo'); mkdirSync(repo);
    writeFileSync(join(repo, 'cfg.txt'), 'aws = AKIAABCDEFGHIJKLMNOP\n');
    const r = spawnSync('node', [join(skillDir, 'secrets-scan.mjs'), `--repo=${repo}`], { encoding: 'utf8' });
    assert.match(r.stdout, /secrets-scan — 1 files, 1 findings, 0 unreadable/);
    assert.match(r.stdout, /🔴 AWS-Access-Key/);
    assert.equal(r.status, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
