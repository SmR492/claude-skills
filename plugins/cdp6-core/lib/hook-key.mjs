import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { appendFileSync, chmodSync, closeSync, existsSync, mkdirSync, openSync, readFileSync, writeSync } from 'node:fs';
import { join } from 'node:path';
import { hostKeyDir } from './data-dir.mjs';
import { StoreError, withLock } from './run-store.mjs';

export const KEY_BYTES = 32;
export const MAX_AGE_MS = 10 * 60 * 1000;
const TOKEN = /^([0-9a-f]{32})\.(\d{13})\.([0-9a-f]{64})$/;

export function hostKeyPath(env = process.env) {
  return join(hostKeyDir(env), 'hook.key');
}

export function ensureHostKey(env = process.env) {
  const file = hostKeyPath(env);
  mkdirSync(hostKeyDir(env), { recursive: true, mode: 0o700 });
  chmodSync(hostKeyDir(env), 0o700);
  try {
    const fd = openSync(file, 'wx', 0o600);
    try {
      writeSync(fd, randomBytes(KEY_BYTES));
    } finally {
      closeSync(fd);
    }
    return { created: true };
  } catch (e) {
    if (e.code === 'EEXIST') return { created: false };
    throw e;
  }
}

export function readHostKey(env = process.env) {
  try {
    const key = readFileSync(hostKeyPath(env));
    return key.length === KEY_BYTES ? key : null;
  } catch {
    return null;
  }
}

function macOf(key, nonce, issued, { sessionId, dataDir, tokens, expect }) {
  const parts = [nonce, String(issued), sessionId, dataDir, String(tokens.length), ...tokens, ...expect];
  return createHmac('sha256', key).update(parts.join('\u0000')).digest('hex');
}

export function mintToken(key, fields, now = Date.now()) {
  const nonce = randomBytes(16).toString('hex');
  return `${nonce}.${now}.${macOf(key, nonce, now, fields)}`;
}

export function verifyToken(key, text, fields, now = Date.now()) {
  const m = TOKEN.exec(typeof text === 'string' ? text : '');
  if (!m) return { error: 'hook-token-malformed' };
  const [, nonce, issued, mac] = m;
  const want = Buffer.from(macOf(key, nonce, issued, fields), 'hex');
  const got = Buffer.from(mac, 'hex');
  if (want.length !== got.length || !timingSafeEqual(want, got)) return { error: 'hook-token-mac' };
  if (now - Number(issued) > MAX_AGE_MS || Number(issued) > now) return { error: 'hook-token-expired' };
  return { ok: true, nonce };
}

export function recordNonce(dataDir, nonce) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = join(dataDir, 'hook-nonces.jsonl');
  return withLock(`${file}.lock`, () => {
    if (existsSync(file)) {
      for (const line of readFileSync(file, 'utf8').split('\n')) {
        if (!line) continue;
        let seen;
        try {
          seen = JSON.parse(line).nonce;
        } catch {
          throw new StoreError('nonce-record-unreadable', 'the nonce record is not readable');
        }
        if (seen === nonce) return false;
      }
    }
    appendFileSync(file, `${JSON.stringify({ nonce, at: new Date().toISOString() })}\n`, { mode: 0o600 });
    return true;
  });
}
