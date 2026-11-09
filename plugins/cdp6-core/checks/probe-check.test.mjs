import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ensureHostKey } from '../lib/hook-key.mjs';
import { calibrationOf, modePrompts, probePassed, readProbeRecord } from '../lib/probe-record.mjs';
import { AGENT, PLUGIN_VERSION, firedLine, goodRows, markdown, sha, stubClaude } from '../test-support/probe-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';
import { fakeHost } from '../test-support/claude-host.mjs';
import { acceptRecord } from './probe-check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const CHECK = join(HERE, 'probe-check.mjs');

function world({ version = '2.1.318', key = true, host = version ?? '2.1.318' } = {}) {
  const base = tempDir('cdp6-pcheck-');
  const w = { base, home: join(base, 'home'), bin: join(base, 'bin'), data: join(base, 'data') };
  mkdirSync(w.home);
  stubClaude(w.bin, version);
  if (key) ensureHostKey({ HOME: w.home });
  w.env = { HOME: w.home, PATH: `${w.bin}:${process.env.PATH}` };
  w.host = fakeHost(base, host);
  return w;
}

function accept(w, rows, { line = true, expect, host = w.host, session } = {}) {
  if (line) firedLine(w.data);
  const text = session === undefined ? markdown(rows) : markdown(rows, { session });
  return { text, result: acceptRecord(text, { dataDir: w.data, env: w.env, expect: expect ?? sha(text), ...host }) };
}

function refused(res, error) {
  assert.equal(res.result.ok, false, JSON.stringify(res.result));
  assert.equal(res.result.error, error, JSON.stringify(res.result));
}

function untouched(w) {
  assert.ok(!existsSync(join(w.data, 'probes')), 'a refused record wrote the probes directory');
}

test('a good record is accepted, written under the version with a mac the reader verifies, and holds the three rows only', () => {
  const w = world();
  const res = accept(w, goodRows());
  assert.equal(res.result.ok, true, JSON.stringify(res.result));
  const file = join(w.data, 'probes', '2.1.318.json');
  assert.equal(res.result.file, file);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const rec = readProbeRecord(w.data, '2.1.318', w.env);
  assert.ok(rec, 'the reader does not verify the written record');
  assert.deepEqual(Object.keys(rec.rows).sort(), ['A-12', 'A-23', 'A-5']);
  assert.equal(rec.accepted.sha256, sha(res.text));
  assert.equal(probePassed(rec, 'A-5'), true);
  assert.equal(modePrompts(rec, 'auto'), true);
  assert.equal(modePrompts(rec, 'default'), true);
  assert.equal(rec.rows['A-12'].modes.auto.refused, true);
  assert.deepEqual(rec.rows['A-23'].modes.auto, { handback: true, agent_id: AGENT, cdp6_version: PLUGIN_VERSION, claude_version: '2.1.318', settings_sha256: 'c'.repeat(64) });
  assert.equal(rec.rows['A-23'].modes.default.handback, false);
});

test('fires: record for another version', () => {
  const w = world({ version: '2.1.318' });
  const res = accept(w, goodRows('2.1.314'));
  refused(res, 'record-version');
  untouched(w);
});

test('fires: one row of another version in an otherwise matching record', () => {
  const w = world();
  const rows = goodRows();
  rows[1] = { ...rows[1], claude_version: '2.1.314' };
  refused(accept(w, rows), 'record-version');
  untouched(w);
});

for (const [field, error, title] of [['mode', 'row-mode', 'mode'], ['claude_version', 'row-version', 'version'], ['settings_sha256', 'row-settings-sha256', 'settings sha256']]) {
  test(`fires: probe row without ${title}`, () => {
    for (const id of ['A-5', 'A-12', 'A-23']) {
      const w = world();
      const rows = goodRows();
      const at = rows.findIndex((r) => r.row === id);
      rows[at] = { ...rows[at], [field]: '' };
      refused(accept(w, rows), error);
      untouched(w);
    }
  });
}

test('fires: a settings sha256 that is not 64 hex characters', () => {
  const w = world();
  const rows = goodRows();
  rows[0] = { ...rows[0], settings_sha256: 'abc' };
  refused(accept(w, rows), 'row-settings-sha256');
  untouched(w);
});

test('fires: a verdict outside the row vocabulary', () => {
  const w = world();
  const rows = goodRows();
  rows[2] = { ...rows[2], verdict: 'prompt' };
  refused(accept(w, rows), 'row-verdict');
  untouched(w);
});

test('fires: the same row and mode twice', () => {
  const w = world();
  const rows = [...goodRows(), goodRows()[0]];
  refused(accept(w, rows), 'row-duplicate');
  untouched(w);
});

test('fires: record without A-23 in auto', () => {
  const w = world();
  const rows = goodRows().filter((r) => !(r.row === 'A-23' && r.mode === 'auto'));
  refused(accept(w, rows), 'a23-auto-missing');
  untouched(w);
});

test('fires: A-23 auto row that is red', () => {
  const w = world();
  const rows = goodRows();
  rows[3] = { ...rows[3], verdict: 'no-handback' };
  refused(accept(w, rows), 'a23-auto-red');
  untouched(w);
});

test('fires: team row accepted in stage 1', () => {
  const w = world();
  const base = goodRows()[0];
  const rows = [...goodRows(), { ...base, row: 'A-11', mode: 'auto', verdict: 'prompt' }, { ...base, row: 'A-16', mode: 'auto', verdict: 'prompt' }];
  const res = accept(w, rows);
  assert.equal(res.result.ok, true, JSON.stringify(res.result));
  assert.deepEqual(res.result.left_for_sl8, ['A-11', 'A-16']);
  const rec = readProbeRecord(w.data, '2.1.318', w.env);
  assert.deepEqual(Object.keys(rec.rows).sort(), ['A-12', 'A-23', 'A-5']);
});

test('fires: A-23 row without handback hook line', () => {
  const cases = {
    'no hooks-fired file': undefined,
    'another agent id': { agent_id: 'agent-zz' },
    'default mode': { permission_mode: 'default' },
    'another plugin version': { version: '9.9.9' },
    'another hook': { hook: 'guard-shell.mjs' },
  };
  for (const [name, fired] of Object.entries(cases)) {
    const w = world();
    if (fired) firedLine(w.data, fired);
    const res = accept(w, goodRows(), { line: false });
    assert.equal(res.result.error, 'a23-hook-line-missing', name);
    assert.equal(res.result.ok, false, name);
    untouched(w);
  }
});

test('an A-23 hook line among other lines is found', () => {
  const w = world();
  firedLine(w.data, { agent_id: 'agent-zz' });
  firedLine(w.data, { hook: 'guard-shell.mjs' });
  firedLine(w.data);
  const res = accept(w, goodRows(), { line: false });
  assert.equal(res.result.ok, true, JSON.stringify(res.result));
});

test('fires: a file without the rows table', () => {
  const w = world();
  const res = { result: acceptRecord('# nothing\n', { dataDir: w.data, env: w.env, expect: sha('# nothing\n') }) };
  refused(res, 'record-no-table');
  untouched(w);
});

test('fires: the file differs from the hash the owner approved', () => {
  const w = world();
  refused(accept(w, goodRows(), { expect: 'd'.repeat(64) }), 'expect-sha256-mismatch');
  untouched(w);
});

test('fires: no readable host key', () => {
  const w = world({ key: false });
  refused(accept(w, goodRows()), 'host-key-missing');
  untouched(w);
});

test('fires: claude --version unreadable', () => {
  const w = world({ version: null });
  refused(accept(w, goodRows()), 'claude-version-unreadable');
  untouched(w);
});

test('a second acceptance for the same version replaces the record', () => {
  const w = world();
  assert.equal(accept(w, goodRows()).result.ok, true);
  const rows = goodRows().map((r) => (r.row === 'A-5' && r.mode === 'auto' ? { ...r, verdict: 'no-prompt' } : r));
  assert.equal(accept(w, rows, { line: false }).result.ok, true);
  const rec = readProbeRecord(w.data, '2.1.318', w.env);
  assert.equal(modePrompts(rec, 'auto'), false);
  assert.equal(probePassed(rec, 'A-5'), false);
});

test('fires: probe-check.mjs run directly signs and writes no record', () => {
  const w = world();
  firedLine(w.data);
  const text = markdown(goodRows());
  const file = join(w.base, 'rec.md');
  writeFileSync(file, text);
  const r = spawnSync(process.execPath, [CHECK, '--accept', file, '--data-dir', w.data, '--expect-sha256', sha(text)], { encoding: 'utf8', env: w.env });
  assert.equal(r.stdout, '');
  untouched(w);
  assert.equal(readProbeRecord(w.data, '2.1.318', w.env), null);
});

test('the accepted record carries accepted.by owner and accepted.at under the mac, and a changed stamp no longer verifies', () => {
  const w = world();
  const before = Date.now();
  assert.equal(accept(w, goodRows()).result.ok, true);
  const rec = readProbeRecord(w.data, '2.1.318', w.env);
  assert.equal(rec.accepted.by, 'owner');
  assert.ok(Date.parse(rec.accepted.at) >= before - 1000);
  const file = join(w.data, 'probes', '2.1.318.json');
  const raw = JSON.parse(readFileSync(file, 'utf8'));
  for (const accepted of [{ ...raw.accepted, by: 'operator' }, { ...raw.accepted, at: '2020-01-01T00:00:00.000Z' }]) {
    writeFileSync(file, JSON.stringify({ ...raw, accepted }));
    assert.equal(readProbeRecord(w.data, '2.1.318', w.env), null);
  }
});

test('fires: rows that are neither accepted in stage 1 nor team rows are named as left for SL-8', () => {
  const w = world();
  const base = goodRows()[0];
  const rows = [...goodRows(), { ...base, row: 'A-19', mode: 'auto', verdict: 'prompt' }, { ...base, row: 'A-11', mode: 'auto', verdict: 'prompt' }];
  const res = accept(w, rows);
  assert.equal(res.result.ok, true, JSON.stringify(res.result));
  assert.deepEqual(res.result.left_for_sl8, ['A-11', 'A-19']);
  assert.deepEqual(Object.keys(readProbeRecord(w.data, '2.1.318', w.env).rows).sort(), ['A-12', 'A-23', 'A-5']);
});

test('a launch-refused verdict is accepted only for an A-5 bypassPermissions row', () => {
  const base = goodRows()[0];
  for (const bad of [{ ...base, mode: 'auto', verdict: 'launch-refused' }, { ...goodRows()[2], verdict: 'launch-refused' }]) {
    const w = world();
    refused(accept(w, [...goodRows().filter((r) => !(r.row === bad.row && r.mode === bad.mode)), bad]), 'row-verdict');
    untouched(w);
  }
});

test('the rows of one probe session are keyed by row, mode and settings sha256: the same triple twice is refused, a launch-refused row does not make bypassPermissions prompt', () => {
  const w = world();
  const base = goodRows()[0];
  const session = [...goodRows(), { ...base, mode: 'bypassPermissions', verdict: 'prompt', settings_sha256: 'd'.repeat(64) }, { ...base, mode: 'bypassPermissions', verdict: 'launch-refused' }];
  refused(accept(w, [...session, session[session.length - 1]]), 'row-duplicate');
  untouched(w);
  const w2 = world();
  assert.equal(accept(w2, session).result.ok, true);
  const rec = readProbeRecord(w2.data, '2.1.318', w2.env);
  assert.equal(probePassed(rec, 'A-5'), true);
  assert.equal(modePrompts(rec, 'bypassPermissions'), true);
  const refusedOnly = [...goodRows(), { ...base, mode: 'bypassPermissions', verdict: 'launch-refused' }];
  const w3 = world();
  assert.equal(accept(w3, refusedOnly).result.ok, true);
  const rec3 = readProbeRecord(w3.data, '2.1.318', w3.env);
  assert.equal(modePrompts(rec3, 'bypassPermissions'), false);
  assert.equal(probePassed(rec3, 'A-5'), true);
  const refusedA12 = [...goodRows(), { ...goodRows()[2], settings_sha256: 'd'.repeat(64), verdict: 'not-refused' }];
  const w4 = world();
  assert.equal(accept(w4, refusedA12).result.ok, true);
  assert.equal(probePassed(readProbeRecord(w4.data, '2.1.318', w4.env), 'A-12'), false);
});

test('fires: record for the PATH binary, not the running process', () => {
  const w = world({ version: '2.1.319', host: '2.1.318' });
  for (const version of ['2.1.319', '2.1.318']) {
    refused(accept(w, goodRows(version)), 'path-version-differs');
    untouched(w);
  }
});

test('fires: running version not established', () => {
  const w = world();
  refused(accept(w, goodRows(), { host: { procRoot: join(w.base, 'no-proc'), pid: 12 } }), 'running-version-unestablished');
  untouched(w);
});

test('fires: A-24 row accepted in stage 1', () => {
  const w = world();
  const base = goodRows()[0];
  const res = accept(w, [...goodRows(), { ...base, row: 'A-24', mode: 'auto', verdict: 'prompt' }, { ...base, row: 'A-11', mode: 'auto', verdict: 'prompt' }]);
  assert.equal(res.result.ok, true, JSON.stringify(res.result));
  assert.deepEqual(res.result.recorded_only, ['A-24']);
  assert.deepEqual(res.result.left_for_sl8, ['A-11']);
  assert.deepEqual(Object.keys(readProbeRecord(w.data, '2.1.318', w.env).rows).sort(), ['A-12', 'A-23', 'A-5']);
});

test('fires: A-12 auto row without calibration columns', () => {
  for (const column of ['bwrap_args', 'counted_paths']) {
    const w = world();
    const rows = goodRows().map((r) => (r.row === 'A-12' && r.settings_sha256 !== 'c'.repeat(64) ? { ...r, [column]: '' } : r));
    const res = accept(w, rows);
    refused(res, 'a12-calibration-columns');
    assert.match(res.result.message, /A-12 auto/);
    untouched(w);
  }
  const w = world();
  refused(accept(w, goodRows().filter((r) => !(r.row === 'A-12' && r.settings_sha256 !== 'c'.repeat(64)))), 'a12-calibration-rows');
  untouched(w);
});

test('fires: calibration rows with equal path counts', () => {
  const w = world();
  const rows = goodRows().map((r) => (r.row === 'A-12' && r.settings_sha256 !== 'c'.repeat(64) ? { ...r, counted_paths: '1196', bwrap_args: '9530' } : r));
  const res = accept(w, rows);
  refused(res, 'a12-calibration-equal');
  assert.match(res.result.message, /A-12 auto/);
  untouched(w);
});

test('a record accepted through probe-check holds per_path and base derived from the two A-12 auto rows', () => {
  const w = world();
  assert.equal(accept(w, goodRows()).result.ok, true);
  assert.deepEqual(calibrationOf(readProbeRecord(w.data, '2.1.318', w.env)), { per_path: 7, base: 1153 });
});

test('fires: A-23 hook line of another session or decision counted', () => {
  const cases = { 'another session': { session_id: 'sess-other' }, 'decision allow': { decision: 'allow' }, 'decision lock-busy': { decision: 'lock-busy' } };
  for (const [name, fired] of Object.entries(cases)) {
    const w = world();
    firedLine(w.data, fired);
    refused(accept(w, goodRows(), { line: false }), 'a23-hook-line-missing');
    untouched(w);
    assert.ok(name);
  }
  for (const decision of ['none', 'deny']) {
    const w = world();
    firedLine(w.data, { decision });
    assert.equal(accept(w, goodRows(), { line: false }).result.ok, true, decision);
  }
  const noSession = world();
  refused(accept(noSession, goodRows(), { session: null }), 'session-id-missing');
  untouched(noSession);
});

test('fires: a record with two different session ids is refused, and the session line reads in its three forms', () => {
  const w = world();
  firedLine(w.data);
  const text = markdown(goodRows());
  const two = text.replace('Status: draft.', 'Status: draft.\n\nSession id: other-session');
  const refusal = acceptRecord(two, { dataDir: w.data, env: w.env, expect: sha(two), ...w.host });
  assert.equal(refusal.error, 'session-id-ambiguous');
  untouched(w);
  const session = /Session id: (\S+)/.exec(text)[1];
  for (const form of [`Probe session id: ${session}`, `Session id: \`${session}\``, `Probe session id: \`${session}\``]) {
    const other = world();
    firedLine(other.data);
    const variant = text.replace(`Session id: ${session}`, form);
    assert.equal(acceptRecord(variant, { dataDir: other.data, env: other.env, expect: sha(variant), ...other.host }).ok, true, form);
  }
});
