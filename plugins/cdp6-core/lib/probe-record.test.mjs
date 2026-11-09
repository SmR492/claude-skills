import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHmac, randomBytes } from 'node:crypto';
import { ensureHostKey, mintToken, readHostKey } from './hook-key.mjs';
import { calibrationOf, canonicalBytes, modePrompts, probePassed, readProbeRecord, rowHolds, signRecord } from './probe-record.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const VERSION = '2.1.318';

function world() {
  const base = tempDir('cdp6-prec-');
  const w = { env: { HOME: join(base, 'home') }, data: join(base, 'data') };
  mkdirSync(w.env.HOME);
  ensureHostKey(w.env);
  return w;
}

function body(over = {}) {
  return {
    claude_version: VERSION,
    rows: { 'A-5': { passed: true, modes: { default: { prompt: true }, auto: { prompt: true } } } },
    accepted: { sha256: 'a'.repeat(64), at: '2026-11-06T09:00:00.000Z' },
    ...over,
  };
}

function place(w, doc, version = VERSION) {
  mkdirSync(join(w.data, 'probes'), { recursive: true });
  writeFileSync(join(w.data, 'probes', `${version}.json`), JSON.stringify(doc));
}

test('fires: a record whose accepted.sha256 holds 64 characters and that has no mac is not read', () => {
  const w = world();
  place(w, body());
  assert.equal(readProbeRecord(w.data, VERSION, w.env), null);
});

test('fires: a record with a mac that does not verify under the host key is not read', () => {
  const w = world();
  const doc = body();
  doc.accepted.mac = 'b'.repeat(64);
  place(w, doc);
  assert.equal(readProbeRecord(w.data, VERSION, w.env), null);
});

test('a record signed with the host key is read, and carries its rows', () => {
  const w = world();
  place(w, signRecord(readHostKey(w.env), body()));
  const rec = readProbeRecord(w.data, VERSION, w.env);
  assert.ok(rec);
  assert.equal(probePassed(rec, 'A-5'), true);
  assert.equal(modePrompts(rec, 'auto'), true);
  assert.equal(modePrompts(rec, 'acceptEdits'), false);
});

test('fires: a row changed after signing is not read', () => {
  const w = world();
  const doc = signRecord(readHostKey(w.env), body());
  doc.rows['A-5'].modes.acceptEdits = { prompt: true };
  place(w, doc);
  assert.equal(readProbeRecord(w.data, VERSION, w.env), null);
});

test('fires: a record signed under another key is not read', () => {
  const w = world();
  place(w, signRecord(randomBytes(32), body()));
  assert.equal(readProbeRecord(w.data, VERSION, w.env), null);
});

test('fires: a record without a host key on the reading side is not read', () => {
  const w = world();
  const doc = signRecord(readHostKey(w.env), body());
  place(w, doc);
  assert.equal(readProbeRecord(w.data, VERSION, { HOME: join(w.data, 'nohome') }), null);
});

test('fires: a signed record read for another version is not read', () => {
  const w = world();
  place(w, signRecord(readHostKey(w.env), body()), '2.1.319');
  assert.equal(readProbeRecord(w.data, '2.1.319', w.env), null);
});

test('fires: token MAC accepted as record MAC', () => {
  const w = world();
  const key = readHostKey(w.env);
  const doc = body();
  const minted = mintToken(key, { sessionId: 'sess-1', dataDir: w.data, tokens: [canonicalBytes(doc).toString('utf8')], expect: [] });
  doc.accepted.mac = minted.split('.')[2];
  place(w, doc);
  assert.equal(readProbeRecord(w.data, VERSION, w.env), null);
});

test('the mac is over the label, a NUL and the canonical bytes, not over the bytes alone', () => {
  const w = world();
  const key = readHostKey(w.env);
  const doc = body();
  const bare = signRecord(key, doc);
  assert.match(bare.accepted.mac, /^[0-9a-f]{64}$/);
  const again = signRecord(key, { ...doc, rows: { ...doc.rows } });
  assert.equal(again.accepted.mac, bare.accepted.mac);
  const reordered = { accepted: { at: doc.accepted.at, sha256: doc.accepted.sha256 }, rows: doc.rows, claude_version: doc.claude_version };
  assert.equal(signRecord(key, reordered).accepted.mac, bare.accepted.mac);
  assert.ok(!canonicalBytes(bare).toString('utf8').includes('"mac"'));
});

test('fires: a mac over the canonical bytes without the label is not read', () => {
  const w = world();
  const doc = body();
  doc.accepted.mac = createHmac('sha256', readHostKey(w.env)).update(canonicalBytes(doc)).digest('hex');
  place(w, doc);
  assert.equal(readProbeRecord(w.data, VERSION, w.env), null);
  place(w, signRecord(readHostKey(w.env), body()));
  assert.ok(readProbeRecord(w.data, VERSION, w.env));
});

const PLUGIN_ROOT = join(import.meta.dirname, '..');

function sources(dirs) {
  const out = [];
  for (const dir of dirs) {
    for (const name of readdirSync(join(PLUGIN_ROOT, dir)).filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs'))) {
      out.push({ file: `${dir}/${name}`, text: readFileSync(join(PLUGIN_ROOT, dir, name), 'utf8') });
    }
  }
  return out;
}

test('rowHolds and calibrationOf read the row shape of an accepted record', () => {
  const rec = {
    rows: {
      'A-5': { passed: true, modes: { auto: { prompt: true }, default: { prompt: false } } },
      'A-12': { passed: true, modes: { auto: { refused: true, calibration: { base: 1153, per_path: 7 } } } },
      'A-23': { passed: true, modes: { auto: { handback: true } } },
      'A-11': { passed: true },
    },
  };
  assert.equal(rowHolds(rec, 'A-5', 'auto'), true);
  assert.equal(rowHolds(rec, 'A-5', 'default'), false);
  assert.equal(rowHolds(rec, 'A-5', 'acceptEdits'), false);
  assert.equal(rowHolds(rec, 'A-12', 'auto'), true);
  assert.equal(rowHolds(rec, 'A-23', 'auto'), true);
  assert.equal(rowHolds(rec, 'A-11'), true);
  assert.equal(rowHolds(rec, 'A-14'), false);
  assert.equal(rowHolds(null, 'A-5', 'auto'), false);
  assert.deepEqual(calibrationOf(rec), { base: 1153, per_path: 7 });
  assert.equal(calibrationOf({ rows: { 'A-12': { modes: { auto: { calibration: { base: 'x', per_path: 7 } } } } } }), null);
  assert.equal(calibrationOf({ rows: { 'A-12': { calibration: { base: 1, per_path: 2 } } } }), null);
  assert.equal(calibrationOf(null), null);
});

test('fires: second writer of probe records', () => {
  const writers = sources(['lib', 'hooks', 'scripts', 'test-support', 'checks']).filter((s) => /export function writeProbeRecord/.test(s.text));
  assert.deepEqual(writers.map((s) => s.file), ['checks/probe-check.mjs']);
  const writes = sources(['lib', 'hooks', 'scripts', 'test-support']).filter((s) => /\b(writeFileSync|renameSync|copyFileSync|appendFileSync|mkdirSync|cpSync)\b/.test(s.text) && /['"`]probes['"`]/.test(s.text));
  assert.deepEqual(writes.map((s) => s.file), []);
});

test('fires: fixture record written outside acceptRecord', () => {
  const fixture = sources(['test-support']).find((s) => s.file === 'test-support/probe-fixture.mjs').text;
  assert.doesNotMatch(fixture, /import \{[^}]*\bwriteProbeRecord\b[^}]*\} from '\.\.\/lib\//);
  assert.match(fixture, /acceptRecord\(/);
  for (const s of sources(['test-support'])) assert.doesNotMatch(s.text, /\bprobeRecordPath\b/, s.file);
});

test('fires: row shape read outside the accessors', () => {
  const readers = sources(['hooks', 'scripts']).concat(sources(['lib']).filter((s) => /^lib\/preflight-/.test(s.file)));
  for (const s of readers) assert.doesNotMatch(s.text, /\brecord\??\.rows\b|\.rows\??\.?\[|\.modes\b|\.calibration\b|\bprobePassed\b|\bmodePrompts\b/, s.file);
});

function callsOf(text) {
  return [...text.matchAll(/(?<!function )\bwriteProbeRecord\(/g)].length;
}

test('fires: writeProbeRecord called outside probe-check and signedRecord', () => {
  const files = sources(['lib', 'hooks', 'scripts', 'test-support']);
  const outside = files.filter((s) => s.file !== 'test-support/probe-fixture.mjs' && callsOf(s.text) > 0);
  assert.deepEqual(outside.map((s) => s.file), []);
  const fixture = files.find((s) => s.file === 'test-support/probe-fixture.mjs').text;
  const body = /export function signedRecord\([^)]*\) \{\n[\s\S]*?\n\}\n/.exec(fixture)?.[0] ?? '';
  assert.equal(callsOf(body), 1);
  assert.equal(callsOf(fixture), 1);
  const checks = sources(['checks']).find((s) => s.file === 'checks/probe-check.mjs').text;
  assert.ok(callsOf(checks) > 0);
});

test('fires: a test file writes probe records outside signedRecord', () => {
  const writers = [];
  for (const dir of ['checks', 'lib', 'hooks', 'scripts', 'test-support']) {
    for (const name of readdirSync(join(PLUGIN_ROOT, dir)).filter((n) => n.endsWith('.mjs'))) {
      if (callsOf(readFileSync(join(PLUGIN_ROOT, dir, name), 'utf8')) > 0) writers.push(`${dir}/${name}`);
    }
  }
  assert.deepEqual(writers.sort(), ['checks/probe-check.mjs', 'test-support/probe-fixture.mjs']);
});
