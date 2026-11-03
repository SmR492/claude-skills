import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ensureHostKey, hostKeyPath, mintToken, readHostKey, recordNonce, verifyToken } from './hook-key.mjs';

function home() {
  const base = mkdtempSync(join(tmpdir(), 'cdp6-key-'));
  return { base, env: { HOME: join(base, 'home') } };
}

const FIELDS = { sessionId: 's-1', dataDir: '/d', tokens: ['enter', 'idea'], expect: [] };

test('ensureHostKey creates 32 bytes with mode 0600 in a 0700 directory and never overwrites', () => {
  const { env } = home();
  assert.ok(readHostKey(env) === null, 'a key was returned before it was created');
  assert.deepEqual(ensureHostKey(env), { created: true });
  const file = hostKeyPath(env);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync(join(file, '..')).mode & 0o777, 0o700);
  const first = readFileSync(file);
  assert.equal(first.length, 32);
  assert.deepEqual(ensureHostKey(env), { created: false });
  assert.ok(readFileSync(file).equals(first), 'the host key file changed');
});

test('readHostKey treats a key of the wrong length as unreadable', () => {
  const { env } = home();
  mkdirSync(join(env.HOME, '.config', 'cdp6-core'), { recursive: true });
  writeFileSync(hostKeyPath(env), 'short');
  assert.ok(readHostKey(env) === null, 'a key of the wrong length was returned');
});

test('a minted token verifies and has the form nonce.issued.mac', () => {
  const { env } = home();
  ensureHostKey(env);
  const key = readHostKey(env);
  const token = mintToken(key, FIELDS);
  assert.ok(/^[0-9a-f]{32}\.\d{13}\.[0-9a-f]{64}$/.test(token), 'the minted token has the wrong form');
  const checked = verifyToken(key, token, FIELDS);
  assert.ok(checked.ok === true, 'the minted token did not verify');
  assert.ok(checked.nonce === token.split('.')[0], 'the checked nonce differs from the minted nonce');
  assert.ok(mintToken(key, FIELDS) !== token, 'two minted tokens are equal');
});

test('verifyToken fails on other key, session, data dir, tokens, hashes, malformed text and age', () => {
  const { env } = home();
  ensureHostKey(env);
  const key = readHostKey(env);
  const other = home();
  ensureHostKey(other.env);
  const token = mintToken(key, { ...FIELDS, expect: ['aa'] });
  const bad = (fields, t = token, key2 = key, now) => verifyToken(key2, t, fields, now).error;
  const f = { ...FIELDS, expect: ['aa'] };
  assert.equal(bad(f, token, readHostKey(other.env)), 'hook-token-mac');
  assert.equal(bad({ ...f, sessionId: 's-2' }), 'hook-token-mac');
  assert.equal(bad({ ...f, dataDir: '/e' }), 'hook-token-mac');
  assert.equal(bad({ ...f, tokens: ['enter', 'idea', 'x'] }), 'hook-token-mac');
  assert.equal(bad({ ...f, tokens: ['enter'], expect: ['idea', 'aa'] }), 'hook-token-mac');
  assert.equal(bad({ ...f, expect: ['bb'] }), 'hook-token-mac');
  assert.equal(bad(f, 'garbage'), 'hook-token-malformed');
  assert.equal(bad(f, `${token}.x`), 'hook-token-malformed');
  assert.equal(bad(f, token.toUpperCase()), 'hook-token-malformed');
  assert.equal(bad(f, token, key, Date.now() + 599000), undefined);
  assert.equal(bad(f, token, key, Date.now() + 601000), 'hook-token-expired');
});

test('verifyToken refuses a token issued later than the current time like a stale one', () => {
  const { env } = home();
  ensureHostKey(env);
  const key = readHostKey(env);
  const now = Date.now();
  const token = mintToken(key, FIELDS, now + 5000);
  assert.equal(verifyToken(key, token, FIELDS, now).error, 'hook-token-expired');
  const later = verifyToken(key, token, FIELDS, now + 5000);
  assert.ok(later.ok === true && later.nonce === token.split('.')[0], 'the token did not verify at its issue time');
});

test('recordNonce accepts a nonce once and refuses its reuse', () => {
  const { base } = home();
  const data = join(base, 'data');
  assert.equal(recordNonce(data, 'a'.repeat(32)), true);
  assert.equal(recordNonce(data, 'a'.repeat(32)), false);
  assert.equal(recordNonce(data, 'b'.repeat(32)), true);
  const lines = readFileSync(join(data, 'hook-nonces.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.nonce), ['a'.repeat(32), 'b'.repeat(32)]);
});
