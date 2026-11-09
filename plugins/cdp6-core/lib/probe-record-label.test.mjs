import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac } from 'node:crypto';
import { ensureHostKey, readHostKey } from './hook-key.mjs';
import { canonicalBytes, readProbeRecord, signRecord } from './probe-record.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

test('fires: record mac under a label other than cdp6-core probe-record v1', () => {
  const base = tempDir('cdp6-prec-label-');
  const env = { HOME: join(base, 'home') };
  const data = join(base, 'data');
  mkdirSync(env.HOME);
  ensureHostKey(env);
  const key = readHostKey(env);
  const doc = { claude_version: '2.1.318', rows: { 'A-5': { passed: true, modes: { auto: { prompt: true } } } }, accepted: { sha256: 'a'.repeat(64), at: '2026-11-06T09:00:00.000Z' } };
  const macUnder = (label) => createHmac('sha256', key).update(Buffer.concat([Buffer.from(label, 'utf8'), Buffer.from([0]), canonicalBytes(doc)])).digest('hex');
  assert.equal(signRecord(key, doc).accepted.mac, macUnder('cdp6-core probe-record v1'));
  mkdirSync(join(data, 'probes'), { recursive: true });
  writeFileSync(join(data, 'probes', '2.1.318.json'), JSON.stringify({ ...doc, accepted: { ...doc.accepted, mac: macUnder('cdp6-core probe-record v2') } }));
  assert.equal(readProbeRecord(data, '2.1.318', env), null);
  writeFileSync(join(data, 'probes', '2.1.318.json'), JSON.stringify({ ...doc, accepted: { ...doc.accepted, mac: macUnder('cdp6-core probe-record v1') } }));
  assert.ok(readProbeRecord(data, '2.1.318', env));
});
