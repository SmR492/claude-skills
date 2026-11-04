import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { CaptureError, capture } from './capture.mjs';
import { readIndex } from './verdict-index.mjs';
import { initRun } from './run-store.mjs';
import { checkDecisions } from '../checks/decision-check.mjs';
import { CountersError, addPending, bindPending } from './counters.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const TYPE = 'cdp6-core:devils-advocate';
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

function state({ task = 'D-1', toolUseId = 'toolu_1', agentId = 'agent-7' } = {}) {
  const S = tempDir('cdp6-capture-');
  writeFileSync(join(S, 'counters.json'), '{"version":1}\n');
  addPending(S, { tool_use_id: toolUseId, agent_type: TYPE, task, role: 'devils-advocate', targets: [{ path: 'docs/a.md', sha256: H1 }, { path: 'docs/b.md', sha256: H2 }], header: 'ok', at: '2026-11-03T10:00:00.000Z' });
  bindPending(S, TYPE, agentId);
  return S;
}

const VALID = [
  'cdp6-contract: v1 abc',
  'run: RUN-1 task: D-1',
  'fresh context: yes',
  'rejected alternative provided: yes',
  'conflict of interest: none',
  'severity scale: 🔴 blocks the task, 🟡 defect with a workaround, 🟢 polish',
  'verdict mapping: a = pass, a-with-conditions = pass-with-conditions, b = block, c = block, not-decidable = no pass',
  'premises:',
  '- run.mjs init writes counters.json -- checked: scripts/run.mjs:290',
  '- nobody else writes verdicts/ -- checked: command: grep -rn verdicts plugins',
  'objection: F-P1-1 | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: shown',
  'verdict: a',
  '',
].join('\n');

function args(S, over = {}) {
  const spawn = JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending[over.toolUseId ?? 'toolu_1'];
  return { message: VALID, agentType: TYPE, agentId: 'agent-7', toolUseId: 'toolu_1', spawn, ...over };
}

function codeOf(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof CaptureError || e instanceof CountersError, String(e));
    return e.code;
  }
  return null;
}

const snapshot = (S) => ({ counters: readFileSync(join(S, 'counters.json'), 'utf8'), files: readdirSync(S).sort(), verdicts: existsSync(join(S, 'verdicts')) ? readdirSync(join(S, 'verdicts')).sort() : null });

test('capture writes the message to verdicts/<task>-<role>-<agent-id>.md and one index line with the line-1190 fields', () => {
  const S = state();
  const a = args(S);
  const before = Date.now();
  const r = capture(S, a);
  assert.equal(r.file, 'D-1-devils-advocate-agent-7.md');
  assert.equal(r.sha256, sha(a.message));
  const file = join(S, 'verdicts', r.file);
  assert.equal(readFileSync(file, 'utf8'), a.message);
  assert.equal(statSync(file).mode & 0o777, 0o600);
  const lines = readFileSync(join(S, 'verdicts', 'index.jsonl'), 'utf8').split('\n');
  assert.equal(lines.length, 2);
  assert.equal(lines[1], '');
  const line = JSON.parse(lines[0]);
  assert.deepEqual(Object.keys(line), ['id', 'sha256', 'agent_type', 'agent_id', 'task', 'file', 'targets', 'decision', 'verdict', 'objections', 'premises', 'conflicted', 'stamp', 'validator', 'reasons']);
  assert.equal(line.id, 'D-1-devils-advocate-agent-7');
  assert.equal(line.id, r.file.replace(/\.md$/, ''));
  assert.equal(line.sha256, sha(a.message));
  assert.equal(line.agent_type, TYPE);
  assert.equal(line.agent_id, 'agent-7');
  assert.equal(line.task, 'D-1');
  assert.equal(line.file, r.file);
  assert.deepEqual(line.targets, [{ path: 'docs/a.md', sha256: H1 }, { path: 'docs/b.md', sha256: H2 }]);
  assert.equal(line.decision, 'D-1');
  assert.equal(line.verdict, 'a');
  assert.deepEqual(line.objections, ['F-P1-1']);
  assert.deepEqual(line.premises, ['D-1-devils-advocate-agent-7:premise-1', 'D-1-devils-advocate-agent-7:premise-2']);
  assert.equal(line.conflicted, false);
  assert.equal(line.validator, 'valid');
  assert.deepEqual(line.reasons, []);
  assert.ok(Date.parse(line.stamp) >= before - 1000);
  assert.deepEqual(readIndex(S), [line]);
});

test('capture marks the bound pending spawn closed through counters.mjs, with the capture hash', () => {
  const S = state();
  const r = capture(S, args(S));
  const p = JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_1;
  assert.equal(p.capture_sha256, r.sha256);
  assert.equal(typeof p.closed_at, 'string');
  assert.equal(p.agent_id, 'agent-7');
  assert.ok(!readdirSync(S).some((n) => n.endsWith('.lock')));
});

test('the index decision is the task when it has the form D-n, else null', () => {
  for (const [task, decision] of [['D-12', 'D-12'], ['S-1', null], ['P3-gate', null], ['D-1x', null], ['D-', null], ['d-1', null]]) {
    const S = state({ task });
    capture(S, args(S));
    assert.equal(readIndex(S)[0].decision, decision, task);
  }
});

test('a second capture appends a line, also after an index that lacks its final newline', () => {
  const S = state();
  capture(S, args(S));
  addPending(S, { tool_use_id: 'toolu_2', agent_type: TYPE, task: 'D-2', role: 'devils-advocate', targets: [], header: 'ok', at: '2026-11-03T10:00:01.000Z' });
  bindPending(S, TYPE, 'agent-8');
  const idx = join(S, 'verdicts', 'index.jsonl');
  writeFileSync(idx, readFileSync(idx, 'utf8').trimEnd());
  capture(S, args(S, { agentId: 'agent-8', toolUseId: 'toolu_2' }));
  assert.deepEqual(readIndex(S).map((l) => [l.task, l.agent_id]), [['D-1', 'agent-7'], ['D-2', 'agent-8']]);
});

test('fires: a malformed index refuses the capture and is not rewritten', () => {
  const S = state();
  capture(S, args(S));
  const idx = join(S, 'verdicts', 'index.jsonl');
  writeFileSync(idx, '{"a":1}\nnot json\n');
  addPending(S, { tool_use_id: 'toolu_2', agent_type: TYPE, task: 'D-2', role: 'devils-advocate', targets: [], header: 'ok', at: '2026-11-03T10:00:01.000Z' });
  bindPending(S, TYPE, 'agent-8');
  const before = snapshot(S);
  const index = readFileSync(idx, 'utf8');
  assert.equal(codeOf(() => capture(S, args(S, { agentId: 'agent-8', toolUseId: 'toolu_2' }))), 'index-unreadable');
  assert.equal(readFileSync(idx, 'utf8'), index);
  assert.deepEqual(snapshot(S), before);
});

test('fires: a capture file of the same name refuses the capture and is not overwritten', () => {
  const S = state();
  const dir = join(S, 'verdicts');
  capture(S, args(S));
  const before = snapshot(S);
  const index = readFileSync(join(dir, 'index.jsonl'), 'utf8');
  const file = readFileSync(join(dir, 'D-1-devils-advocate-agent-7.md'), 'utf8');
  assert.equal(codeOf(() => capture(S, args(S, { message: 'other text' }))), 'capture-exists');
  assert.equal(readFileSync(join(dir, 'D-1-devils-advocate-agent-7.md'), 'utf8'), file);
  assert.equal(readFileSync(join(dir, 'index.jsonl'), 'utf8'), index);
  assert.equal(snapshot(S).counters, before.counters);
});

test('fires: a task, role or agent id with characters outside [A-Za-z0-9._-] refuses the capture and writes nothing', () => {
  const S = state();
  const before = snapshot(S);
  const spawn = args(S).spawn;
  assert.equal(codeOf(() => capture(S, args(S, { spawn: { ...spawn, task: '../x' } }))), 'name-unsafe');
  assert.equal(codeOf(() => capture(S, args(S, { spawn: { ...spawn, task: 'a b' } }))), 'name-unsafe');
  assert.equal(codeOf(() => capture(S, args(S, { spawn: { ...spawn, task: '' } }))), 'name-unsafe');
  assert.equal(codeOf(() => capture(S, args(S, { agentId: 'a/b' }))), 'name-unsafe');
  assert.equal(codeOf(() => capture(S, args(S, { agentType: 'cdp6-core:a/b' }))), 'name-unsafe');
  assert.equal(codeOf(() => capture(S, args(S, { agentType: 'cdp6-core:' }))), 'name-unsafe');
  assert.deepEqual(snapshot(S), before);
});

test('fires: a busy lock on the index refuses the capture and writes nothing', () => {
  const S = state();
  writeFileSync(join(S, 'verdicts.lock'), '{}');
  const before = snapshot(S);
  assert.equal(codeOf(() => capture(S, args(S, { waitMs: 50 }))), 'lock-busy');
  assert.deepEqual(snapshot(S), before);
  assert.equal(existsSync(join(S, 'verdicts')), false);
});

test('fires: a busy lock on counters.json refuses the capture and writes no capture file and no index line', () => {
  const S = state();
  writeFileSync(join(S, 'counters.lock'), '{}');
  const before = snapshot(S);
  assert.equal(codeOf(() => capture(S, args(S, { waitMs: 50 }))), 'lock-busy');
  assert.deepEqual(snapshot(S), before);
  assert.equal(existsSync(join(S, 'verdicts')), false);
});

test('capture creates S/verdicts/ when it is missing', () => {
  const S = state();
  assert.equal(existsSync(join(S, 'verdicts')), false);
  capture(S, args(S));
  assert.equal(statSync(join(S, 'verdicts')).isDirectory(), true);
});

test('fires: an index append that fails removes the capture file and leaves the index and the spawn as they were', () => {
  const S = state();
  capture(S, args(S));
  addPending(S, { tool_use_id: 'toolu_2', agent_type: TYPE, task: 'D-2', role: 'devils-advocate', targets: [], header: 'ok', at: '2026-11-03T10:00:01.000Z' });
  bindPending(S, TYPE, 'agent-8');
  const idx = join(S, 'verdicts', 'index.jsonl');
  chmodSync(idx, 0o400);
  const before = snapshot(S);
  const index = readFileSync(idx, 'utf8');
  const refused = () => capture(S, args(S, { agentId: 'agent-8', toolUseId: 'toolu_2' }));
  assert.throws(refused);
  assert.deepEqual(snapshot(S), before);
  assert.equal(readFileSync(idx, 'utf8'), index);
  assert.equal(codeOf(refused), 'capture-failed');
  assert.ok(!readdirSync(S).some((n) => n.endsWith('.lock')));
});

test('fires: a partial index append is rolled back to the index as it was, with or without an index before', () => {
  const partial = (file, data, options) => {
    appendFileSync(file, data.slice(0, 12), options);
    throw new Error('disk full');
  };
  const S = state();
  capture(S, args(S));
  addPending(S, { tool_use_id: 'toolu_2', agent_type: TYPE, task: 'D-2', role: 'devils-advocate', targets: [], header: 'ok', at: '2026-11-03T10:00:01.000Z' });
  bindPending(S, TYPE, 'agent-8');
  const idx = join(S, 'verdicts', 'index.jsonl');
  const before = snapshot(S);
  const index = readFileSync(idx, 'utf8');
  assert.equal(codeOf(() => capture(S, args(S, { agentId: 'agent-8', toolUseId: 'toolu_2', append: partial }))), 'capture-failed');
  assert.equal(readFileSync(idx, 'utf8'), index);
  assert.deepEqual(snapshot(S), before);
  const fresh = state();
  const first = snapshot(fresh);
  assert.equal(codeOf(() => capture(fresh, args(fresh, { append: partial }))), 'capture-failed');
  assert.deepEqual(snapshot(fresh), first);
  assert.equal(existsSync(join(fresh, 'verdicts')), false);
});

test('fires: an error during the rollback does not replace the error that caused it, and the capture file is still removed', () => {
  const S = state();
  const idx = join(S, 'verdicts', 'index.jsonl');
  const lockAfterAppend = (file, data, options) => {
    appendFileSync(file, data, options);
    chmodSync(file, 0o400);
  };
  mkdirSync(join(S, 'verdicts'));
  writeFileSync(idx, '');
  mkdirSync(join(S, `counters.json.${process.pid}.tmp`));
  assert.equal(codeOf(() => capture(S, args(S, { append: lockAfterAppend }))), 'capture-failed');
  assert.equal(existsSync(join(S, 'verdicts', 'D-1-devils-advocate-agent-7.md')), false);
  assert.equal(JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_1.closed_at, undefined);
});

test('fires: an error during the rollback does not replace the error that caused it, whose own code is kept', () => {
  for (const cause of [new CaptureError('capture-exists', 'the original error'), new CountersError('spawn-closed', 'the original error')]) {
    const S = state();
    const idx = join(S, 'verdicts', 'index.jsonl');
    const lockIndex = (file, data, options) => {
      appendFileSync(file, data, options);
      chmodSync(file, 0o400);
      throw cause;
    };
    mkdirSync(join(S, 'verdicts'));
    writeFileSync(idx, '');
    assert.equal(codeOf(() => capture(S, args(S, { append: lockIndex }))), cause.code);
    assert.equal(existsSync(join(S, 'verdicts', 'D-1-devils-advocate-agent-7.md')), false);
    assert.equal(JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_1.closed_at, undefined);
  }
});

test('fires: a counters write that fails after the index append removes the capture file and the index line', () => {
  const S = state();
  mkdirSync(join(S, `counters.json.${process.pid}.tmp`));
  const before = snapshot(S);
  assert.throws(() => capture(S, args(S)));
  assert.deepEqual(snapshot(S), before);
  assert.equal(existsSync(join(S, 'verdicts', 'index.jsonl')), false);
  assert.equal(codeOf(() => capture(S, args(S))), 'capture-failed');
  assert.equal(JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_1.closed_at, undefined);
});

test('a rejected capture is still captured and its spawn closed, with verdict null, no objections and the reasons on the index line', () => {
  const S = state();
  const message = VALID.replace('fresh context: yes', 'fresh context: no');
  const r = capture(S, args(S, { message }));
  assert.equal(readFileSync(join(S, 'verdicts', r.file), 'utf8'), message);
  const [line] = readIndex(S);
  assert.equal(line.validator, 'rejected');
  assert.equal(line.verdict, null);
  assert.deepEqual(line.objections, []);
  assert.deepEqual(line.premises, []);
  assert.ok(line.reasons.length >= 1 && line.reasons.every((x) => typeof x === 'string'));
  assert.equal(line.decision, 'D-1');
  assert.equal(JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_1.capture_sha256, r.sha256);
});

test('a capture whose conflict line names a stake is recorded conflicted with its verdict and items kept', () => {
  const S = state();
  capture(S, args(S, { message: VALID.replace('conflict of interest: none', 'conflict of interest: author of D-2') }));
  const [line] = readIndex(S);
  assert.equal(line.validator, 'valid');
  assert.equal(line.conflicted, true);
  assert.equal(line.verdict, 'a');
  assert.deepEqual(line.objections, ['F-P1-1']);
  assert.equal(line.premises.length, 2);
});

test('an unchecked premise under verdict a is recorded as not-decidable', () => {
  const S = state();
  capture(S, args(S, { message: VALID.replace('- nobody else writes verdicts/ -- checked: command: grep -rn verdicts plugins', '- nobody else writes verdicts/ -- unchecked') }));
  const [line] = readIndex(S);
  assert.equal(line.validator, 'valid');
  assert.equal(line.verdict, 'not-decidable');
  assert.ok(line.reasons.some((x) => /unchecked/.test(x)));
});

test('a role outside the triad set is captured as not-checked with verdict null', () => {
  const S = state();
  addPending(S, { tool_use_id: 'toolu_2', agent_type: 'cdp6-core:impl-uc', task: 'S-1', role: 'impl-uc', targets: [], header: 'ok', at: '2026-11-03T10:00:01.000Z' });
  bindPending(S, 'cdp6-core:impl-uc', 'agent-9');
  capture(S, args(S, { agentType: 'cdp6-core:impl-uc', agentId: 'agent-9', toolUseId: 'toolu_2', message: 'cdp6-contract: v1 abc\nrun: RUN-1 task: S-1\nDone.\n' }));
  const [line] = readIndex(S);
  assert.equal(line.validator, 'not-checked');
  assert.equal(line.verdict, null);
  assert.deepEqual(line.reasons, []);
});

test('fires: a gate that reads the index between the append and a failing counters write counts a capture that the rollback then removes', () => {
  const S = tempDir('cdp6-capture-gate-');
  writeFileSync(join(S, 'counters.json'), '{"version":1}\n');
  const target = { path: 'idea/idea.md', sha256: sha('current\n') };
  addPending(S, { tool_use_id: 'toolu_g', agent_type: TYPE, task: 'D-1', role: 'devils-advocate', targets: [target], header: 'ok', at: '2026-11-03T10:00:00.000Z' });
  bindPending(S, TYPE, 'agent-g');
  initRun(S, { run_id: 'RUN-1', status: 'active', ids: { next: { D: 2 } }, decisions: { 'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: '2026-01-01T00:00:00.000Z', decider: 'operator' }, { status: 'decided', at: '2099-01-01T00:00:00.000Z', decider: 'owner' }] } }, owner_records: [], phases: {} });
  const snap = tempDir('cdp6-capture-snap-');
  mkdirSync(join(snap, 'idea'));
  writeFileSync(join(snap, 'idea', 'idea.md'), 'current\n');
  mkdirSync(join(S, `counters.json.${process.pid}.tmp`));
  let seen;
  const appendThenGate = (file, data, options) => {
    appendFileSync(file, data, options);
    seen = checkDecisions(S, snap);
  };
  const spawn = JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_g;
  assert.equal(codeOf(() => capture(S, { message: VALID, agentType: TYPE, agentId: 'agent-g', toolUseId: 'toolu_g', spawn, append: appendThenGate })), 'capture-failed');
  assert.equal(existsSync(join(S, 'verdicts', 'D-1-devils-advocate-agent-g.md')), false);
  assert.notDeepEqual(seen, [], 'the gate passed D-1 on a capture that the rollback removed');
});

test('a rejected conflicted capture records on its index line every objection id of its file that is outside quote and disposition lines', () => {
  const S = state();
  const message = VALID.replace('conflict of interest: none', 'conflict of interest: author of D-2').replace('verdict: a\n', 'verdict: b\nF-P1-2 is the larger defect.\n> quoted F-P1-3\n');
  capture(S, args(S, { message }));
  const [line] = readIndex(S);
  assert.equal(line.validator, 'rejected');
  assert.equal(line.conflicted, true);
  assert.deepEqual(line.objections, ['F-P1-1', 'F-P1-2']);
});
