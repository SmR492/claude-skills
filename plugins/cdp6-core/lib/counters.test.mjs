import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CountersError, addPending, bindPending, boundSpawn, closePending, countersPath, initCounters, readCounters } from './counters.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const H = 'c'.repeat(64);

function state(content = { version: 1 }) {
  const S = tempDir('cdp6-counters-');
  if (content !== null) writeFileSync(countersPath(S), typeof content === 'string' ? content : `${JSON.stringify(content, null, 2)}\n`);
  return S;
}

function spawn(over = {}) {
  return { tool_use_id: 'toolu_1', agent_type: 'cdp6-core:devils-advocate', task: 'S-1', role: 'devils-advocate', targets: [{ path: 'a.md', sha256: H }], header: 'ok', at: '2026-11-03T10:00:00.000Z', ...over };
}

function raw(S) {
  return JSON.parse(readFileSync(countersPath(S), 'utf8'));
}

function codeOf(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof CountersError, String(e));
    return e.code;
  }
  return null;
}

test('the SL-1 shape reads as no pending spawns', () => {
  const S = state();
  assert.deepEqual(readCounters(S).pending, {});
  assert.equal(readCounters(S).version, 1);
});

test('addPending stores the record under its tool_use_id and keeps the other keys', () => {
  const S = state({ version: 1, other: { n: 2 } });
  addPending(S, spawn());
  addPending(S, spawn({ tool_use_id: 'toolu_2', role: 'review-verify', agent_type: 'cdp6-core:review-verify' }));
  const doc = raw(S);
  assert.deepEqual(doc.other, { n: 2 });
  assert.equal(doc.version, 1);
  assert.deepEqual(Object.keys(doc.pending), ['toolu_1', 'toolu_2']);
  assert.deepEqual(doc.pending.toolu_1, { ...spawn(), agent_id: null });
  assert.equal(statSync(countersPath(S)).mode & 0o777, 0o600);
  assert.deepEqual(readdirSync(S), ['counters.json']);
});

test('a second record with the same tool_use_id does not replace the first', () => {
  const S = state();
  addPending(S, spawn());
  addPending(S, spawn({ task: 'S-9' }));
  assert.equal(raw(S).pending.toolu_1.task, 'S-1');
});

test('bindPending binds the one unbound pending spawn of the agent type to the agent id', () => {
  const S = state();
  addPending(S, spawn());
  addPending(S, spawn({ tool_use_id: 'toolu_2', agent_type: 'cdp6-core:review-verify' }));
  const r = bindPending(S, 'cdp6-core:devils-advocate', 'agent-7');
  assert.equal(r.status, 'bound');
  assert.equal(r.tool_use_id, 'toolu_1');
  assert.equal(r.spawn.agent_id, 'agent-7');
  assert.deepEqual(r.spawn.targets, [{ path: 'a.md', sha256: H }]);
  const doc = raw(S);
  assert.equal(doc.pending.toolu_1.agent_id, 'agent-7');
  assert.equal(typeof doc.pending.toolu_1.bound_at, 'string');
  assert.equal(doc.pending.toolu_2.agent_id, null);
});

test('bindPending reports none when no unbound spawn of the type exists and leaves the file as it was', () => {
  const S = state();
  assert.deepEqual(bindPending(S, 'cdp6-core:devils-advocate', 'agent-7'), { status: 'none' });
  addPending(S, spawn({ agent_type: 'cdp6-core:review-verify' }));
  assert.deepEqual(bindPending(S, 'cdp6-core:devils-advocate', 'agent-7'), { status: 'none' });
  addPending(S, spawn({ tool_use_id: 'toolu_3' }));
  assert.equal(bindPending(S, 'cdp6-core:devils-advocate', 'agent-7').status, 'bound');
  assert.deepEqual(bindPending(S, 'cdp6-core:devils-advocate', 'agent-8'), { status: 'none' });
  addPending(S, spawn({ tool_use_id: 'toolu_4', void: true }));
  assert.deepEqual(bindPending(S, 'cdp6-core:devils-advocate', 'agent-9'), { status: 'none' });
});

test('bindPending binds none and reports the count when several unbound spawns of the type exist', () => {
  const S = state();
  addPending(S, spawn());
  addPending(S, spawn({ tool_use_id: 'toolu_2' }));
  const before = readFileSync(countersPath(S), 'utf8');
  assert.deepEqual(bindPending(S, 'cdp6-core:devils-advocate', 'agent-7'), { status: 'many', count: 2 });
  assert.equal(readFileSync(countersPath(S), 'utf8'), before);
});

test('fires: a missing, unreadable or malformed counters file throws a structured error', () => {
  assert.equal(codeOf(() => readCounters(state(null))), 'counters-missing');
  assert.equal(codeOf(() => readCounters(state('{ "version": '))), 'counters-malformed');
  assert.equal(codeOf(() => readCounters(state('[]'))), 'counters-malformed');
  assert.equal(codeOf(() => readCounters(state('null'))), 'counters-malformed');
  assert.equal(codeOf(() => readCounters(state({ version: 1, pending: 'x' }))), 'counters-malformed');
  assert.equal(codeOf(() => readCounters(state({ version: 1, pending: { a: 'x' } }))), 'counters-malformed');
  const dir = state(null);
  mkdirSync(countersPath(dir));
  assert.equal(codeOf(() => readCounters(dir)), 'counters-unreadable');
  assert.equal(codeOf(() => addPending(state(null), spawn())), 'counters-missing');
  assert.equal(codeOf(() => bindPending(state('{'), 'cdp6-core:x', 'a')), 'counters-malformed');
});

test('fires: a busy lock throws lock-busy and leaves the file untouched', () => {
  const S = state();
  writeFileSync(join(S, 'counters.lock'), '{}');
  const before = readFileSync(countersPath(S), 'utf8');
  assert.equal(codeOf(() => addPending(S, spawn(), { waitMs: 80 })), 'lock-busy');
  assert.equal(codeOf(() => bindPending(S, 'cdp6-core:x', 'a', { waitMs: 80 })), 'lock-busy');
  assert.equal(readFileSync(countersPath(S), 'utf8'), before);
});

test('boundSpawn finds the pending spawn bound to an agent id and nothing for an unbound or void one', () => {
  const S = state();
  addPending(S, spawn());
  addPending(S, spawn({ tool_use_id: 'toolu_2', agent_type: 'cdp6-core:review-verify' }));
  assert.equal(boundSpawn(S, 'agent-7'), null);
  bindPending(S, 'cdp6-core:devils-advocate', 'agent-7');
  const found = boundSpawn(S, 'agent-7');
  assert.equal(found.tool_use_id, 'toolu_1');
  assert.equal(found.spawn.task, 'S-1');
  assert.equal(boundSpawn(S, 'agent-8'), null);
  assert.equal(boundSpawn(S, ''), null);
  assert.equal(boundSpawn(S, null), null);
  const doc = raw(S);
  doc.pending.toolu_1.void = true;
  writeFileSync(countersPath(S), JSON.stringify(doc));
  assert.equal(boundSpawn(S, 'agent-7'), null);
});

test('boundSpawn reads a missing or malformed counters.json as a CountersError', () => {
  assert.equal(codeOf(() => boundSpawn(state(null), 'agent-7')), 'counters-missing');
  assert.equal(codeOf(() => boundSpawn(state('{ "x": '), 'agent-7')), 'counters-malformed');
});

test('closePending runs the work under the lock, then marks the spawn closed with the capture hash and keeps the other keys', () => {
  const S = state({ version: 1, other: { n: 2 } });
  addPending(S, spawn());
  bindPending(S, 'cdp6-core:devils-advocate', 'agent-7');
  let ran = 0;
  const r = closePending(S, 'toolu_1', () => {
    ran += 1;
    assert.equal(raw(S).pending.toolu_1.closed_at, undefined);
    assert.ok(readdirSync(S).includes('counters.lock'));
    return 'work-result';
  }, { captureSha256: H });
  assert.equal(ran, 1);
  assert.equal(r, 'work-result');
  const done = raw(S).pending.toolu_1;
  assert.equal(done.capture_sha256, H);
  assert.equal(typeof done.closed_at, 'string');
  assert.equal(done.agent_id, 'agent-7');
  assert.deepEqual(raw(S).other, { n: 2 });
  assert.deepEqual(readdirSync(S).sort(), ['counters.json']);
});

test('closePending leaves the record untouched when the work throws, and refuses an unknown or closed spawn without running the work', () => {
  const S = state();
  addPending(S, spawn());
  bindPending(S, 'cdp6-core:devils-advocate', 'agent-7');
  const before = readFileSync(countersPath(S), 'utf8');
  assert.throws(() => closePending(S, 'toolu_1', () => { throw new Error('boom'); }, { captureSha256: H }), /boom/);
  assert.equal(readFileSync(countersPath(S), 'utf8'), before);
  assert.ok(!readdirSync(S).includes('counters.lock'));
  let ran = 0;
  assert.equal(codeOf(() => closePending(S, 'toolu_9', () => { ran += 1; }, { captureSha256: H })), 'spawn-unknown');
  closePending(S, 'toolu_1', () => {}, { captureSha256: H });
  assert.equal(codeOf(() => closePending(S, 'toolu_1', () => { ran += 1; }, { captureSha256: H })), 'spawn-closed');
  assert.equal(ran, 0);
});

test('closePending reports a busy lock without running the work', () => {
  const S = state();
  addPending(S, spawn());
  writeFileSync(join(S, 'counters.lock'), '{}');
  let ran = 0;
  assert.equal(codeOf(() => closePending(S, 'toolu_1', () => { ran += 1; }, { captureSha256: H, waitMs: 50 })), 'lock-busy');
  assert.equal(ran, 0);
});

test('initCounters creates counters.json with mode 0600 that readCounters reads, and refuses to replace an existing one', () => {
  const S = state(null);
  initCounters(S);
  assert.equal(statSync(countersPath(S)).mode & 0o777, 0o600);
  assert.equal(readCounters(S).version, 1);
  assert.deepEqual(readCounters(S).pending, {});
  addPending(S, spawn());
  assert.equal(codeOf(() => initCounters(S)), 'counters-exists');
  assert.equal(Object.keys(raw(S).pending).length, 1);
  assert.deepEqual(readdirSync(S), ['counters.json']);
});
