import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PHASES } from '../lib/phases.mjs';
import { stopFor } from '../lib/stop-guard.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HOOK = join(HERE, 'observe-stop.mjs');
const PLUGIN = dirname(HERE);
const RUN = 'RUN-20261106-1';
const TYPE = 'cdp6-core:devils-advocate';

function bound(over = {}) {
  return { tool_use_id: 'toolu_1', agent_type: TYPE, task: 'D-1', role: 'devils-advocate', targets: [], header: 'ok', at: '2026-11-06T09:00:00.000Z', agent_id: 'agent-1', bound_at: '2026-11-06T09:00:01.000Z', ...over };
}

function world({ run = true, pending = { toolu_1: bound() }, counters } = {}) {
  const base = tempDir('cdp6-stop-');
  const w = { base, repo: join(base, 'repo'), data: join(base, 'data'), home: join(base, 'home') };
  mkdirSync(w.repo, { recursive: true });
  mkdirSync(w.home);
  spawnSync('git', ['init', '-q', w.repo]);
  w.S = join(w.data, 'runs', RUN);
  if (run) {
    mkdirSync(w.S, { recursive: true });
    const phases = {};
    for (const p of PHASES) phases[p] = { state: 'pending', cycle: 1 };
    writeFileSync(join(w.S, 'run.json'), JSON.stringify({ run_id: RUN, status: 'active', mode: 'single', root: w.repo, run_dir: join(w.repo, 'docs', 'cdp6', 'runs', RUN), journal_offset: 0, phases }));
    writeFileSync(join(w.data, 'active-runs.json'), JSON.stringify({ sessions: { 'sess-1': { run_id: RUN, project_root: w.repo } }, projects: { [w.repo]: RUN } }));
    if (counters !== null) writeFileSync(join(w.S, 'counters.json'), counters ?? JSON.stringify({ version: 1, pending }));
  }
  return w;
}

function fire(w, over = {}) {
  const { agentId = 'agent-1', type = TYPE, data = w.data, raw, mode = 'auto' } = over;
  const doc = { session_id: 'sess-1', cwd: w.repo, hook_event_name: 'SubagentStop', agent_id: agentId, agent_type: type, last_assistant_message: 'done', permission_mode: mode };
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN };
  if (data !== null) env.CLAUDE_PLUGIN_DATA = data;
  const r = spawnSync(process.execPath, [HOOK], { input: raw ?? JSON.stringify(doc), encoding: 'utf8', env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function pending(w) {
  return JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8')).pending;
}

function observed(w) {
  const file = join(w.data, 'hooks-fired.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
}

function quiet(res) {
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '');
}

test('a finished capture-bound agent without a capture gets finished_at on its bound spawn, one hooks-fired line, exit 0 and no decision', () => {
  const w = world();
  const before = Date.now();
  quiet(fire(w));
  const spawn = pending(w).toolu_1;
  assert.ok(Date.parse(spawn.finished_at) >= before - 1000);
  assert.equal(spawn.closed_at, undefined);
  assert.equal(spawn.agent_id, 'agent-1');
  assert.equal(spawn.task, 'D-1');
  const lines = observed(w);
  assert.equal(lines.length, 1);
  assert.equal(lines[0].hook, 'observe-stop.mjs');
  assert.equal(lines[0].agent_id, 'agent-1');
  assert.equal(lines[0].permission_mode, 'auto');
  assert.equal(lines[0].decision, 'finished');
});

test('fires: finished agent without capture unmarked', () => {
  for (const mode of ['default', 'acceptEdits', 'auto', 'bypassPermissions', 'plan']) {
    const w = world();
    quiet(fire(w, { mode }));
    assert.ok(pending(w).toolu_1.finished_at, mode);
  }
});

test('fires: stop observer decides', () => {
  const cases = {
    'unreadable input': { raw: 'not json' },
    'array input': { raw: '[1]' },
    'empty input': { raw: '' },
    'unknown agent id': { agentId: 'agent-9' },
    'no agent id': { agentId: '' },
    'foreign agent type': { type: 'cdp5-agents:devils-advocate' },
    'no agent type': { type: '' },
  };
  for (const [name, over] of Object.entries(cases)) {
    const w = world();
    const res = fire(w, over);
    assert.equal(res.status, 0, name);
    assert.equal(res.stdout, '', name);
    assert.equal(pending(w).toolu_1.finished_at, undefined, name);
  }
  const w = world();
  const res = fire(w);
  assert.equal(res.stdout, '');
  assert.equal(res.stderr, '');
});

test('fires: a captured spawn, a void spawn and a role that is not capture-bound get no finished_at', () => {
  const closed = world({ pending: { toolu_1: bound({ closed_at: '2026-11-06T09:05:00.000Z', capture_sha256: 'a'.repeat(64) }) } });
  quiet(fire(closed));
  assert.equal(pending(closed).toolu_1.finished_at, undefined);
  const voided = world({ pending: { toolu_1: bound({ void: true }) } });
  quiet(fire(voided));
  assert.equal(pending(voided).toolu_1.finished_at, undefined);
  const worker = world({ pending: { toolu_1: bound({ agent_type: 'cdp6-core:impl-uc', role: 'impl-uc' }) } });
  quiet(fire(worker, { type: 'cdp6-core:impl-uc' }));
  assert.equal(pending(worker).toolu_1.finished_at, undefined);
});

test('fires: the type of the input decides, not the type of the spawn bound to the agent id', () => {
  const w = world({ pending: { toolu_1: bound({ agent_type: 'cdp6-core:impl-uc' }) } });
  quiet(fire(w, { type: 'cdp6-core:impl-uc' }));
  assert.equal(pending(w).toolu_1.finished_at, undefined);
});

test('no active run, no data directory, a missing or malformed counters.json: exit 0, no decision, nothing written', () => {
  const none = world({ run: false });
  quiet(fire(none));
  assert.equal(existsSync(join(none.S, 'counters.json')), false);
  const bare = world({ run: false });
  quiet(fire(bare, { data: null }));
  quiet(fire(bare, { data: 'relative/dir' }));
  assert.equal(existsSync(bare.data), false);
  const missing = world({ counters: null });
  quiet(fire(missing));
  assert.equal(existsSync(join(missing.S, 'counters.json')), false);
  const malformed = world({ counters: '{ "version": ' });
  quiet(fire(malformed));
  assert.equal(readFileSync(join(malformed.S, 'counters.json'), 'utf8'), '{ "version": ');
  const busy = world();
  writeFileSync(join(busy.S, 'counters.lock'), '{}');
  quiet(fire(busy));
  assert.equal(pending(busy).toolu_1.finished_at, undefined);
});

test('a second stop of the same agent keeps the first finished_at and adds a second line', () => {
  const w = world();
  quiet(fire(w));
  const first = pending(w).toolu_1.finished_at;
  quiet(fire(w));
  assert.equal(pending(w).toolu_1.finished_at, first);
  assert.equal(observed(w).length, 2);
});

test('fires: the spawn is found by agent_id in the counters of the run found by session and cwd', () => {
  const w = world({ pending: { toolu_1: bound(), toolu_2: bound({ tool_use_id: 'toolu_2', agent_id: 'agent-2' }) } });
  quiet(fire(w, { agentId: 'agent-2' }));
  assert.equal(pending(w).toolu_1.finished_at, undefined);
  assert.notEqual(pending(w).toolu_2.finished_at, undefined);
  quiet(fire(w, { agentId: 'agent-9' }));
  assert.equal(pending(w).toolu_1.finished_at, undefined);
  const other = world();
  const foreign = JSON.stringify({ session_id: 'sess-other', cwd: other.base, hook_event_name: 'SubagentStop', agent_id: 'agent-1', agent_type: TYPE });
  quiet(fire(w, { raw: foreign }));
  assert.equal(pending(w).toolu_1.finished_at, undefined);
});

const outcomes = (w) => observed(w).map((l) => l.decision);

test('fires: non-capture-bound cdp6-core agent marked', () => {
  const w = world({ pending: { toolu_1: bound({ agent_type: 'cdp6-core:impl-uc', role: 'impl-uc' }) } });
  quiet(fire(w, { type: 'cdp6-core:impl-uc' }));
  assert.equal(pending(w).toolu_1.finished_at, undefined);
  assert.equal(JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8')).stops, undefined);
  assert.deepEqual(outcomes(w), ['none']);
});

test('fires: busy lock at SubagentStop leaves no hook line', () => {
  const w = world();
  writeFileSync(join(w.S, 'counters.lock'), '{}');
  const res = fire(w);
  assert.equal(res.status, 0);
  assert.equal(res.stdout, '');
  assert.equal(pending(w).toolu_1.finished_at, undefined);
  assert.deepEqual(outcomes(w), ['lock-busy']);
  assert.equal(observed(w)[0].agent_id, 'agent-1');
});

test('the outcome of every observed stop is on its hooks-fired line', () => {
  const closed = world({ pending: { toolu_1: bound({ closed_at: '2026-11-06T09:05:00.000Z', capture_sha256: 'a'.repeat(64) }) } });
  quiet(fire(closed));
  assert.deepEqual(outcomes(closed), ['captured']);
  const missing = world({ counters: null });
  quiet(fire(missing));
  assert.deepEqual(outcomes(missing), ['unreadable']);
  const malformed = world({ counters: '{ "version": ' });
  quiet(fire(malformed));
  assert.deepEqual(outcomes(malformed), ['unreadable']);
  const noId = world();
  quiet(fire(noId, { agentId: '' }));
  assert.deepEqual(outcomes(noId), ['unreadable']);
  const unreadableInput = world();
  quiet(fire(unreadableInput, { raw: 'not json' }));
  assert.deepEqual(outcomes(unreadableInput), ['none']);
  const foreign = world();
  quiet(fire(foreign, { type: 'cdp5-agents:devils-advocate' }));
  assert.deepEqual(outcomes(foreign), ['none']);
  const norun = world({ run: false });
  quiet(fire(norun));
  assert.deepEqual(outcomes(norun), ['none']);
});

test('fires: finished agent without a bound spawn records no stop', () => {
  const w = world({ pending: { toolu_u: bound({ tool_use_id: 'toolu_u', agent_id: null, bound_at: undefined }) } });
  const before = Date.now();
  quiet(fire(w, { agentId: 'agent-9' }));
  const doc = JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8'));
  assert.equal(doc.pending.toolu_u.finished_at, undefined);
  assert.equal(doc.stops['agent-9'].agent_type, TYPE);
  assert.ok(Date.parse(doc.stops['agent-9'].finished_at) >= before - 1000);
  assert.deepEqual(outcomes(w), ['no-spawn']);
  const reason = stopFor({ session_id: 'sess-1', cwd: w.repo }, { CLAUDE_PLUGIN_DATA: w.data });
  assert.match(reason, /agent-9/);
  quiet(fire(w, { agentId: 'agent-9' }));
  assert.equal(JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8')).stops['agent-9'].finished_at, doc.stops['agent-9'].finished_at);
  const guard = spawnSync(process.execPath, [join(HERE, 'guard-phase.mjs')], { input: JSON.stringify({ session_id: 'sess-1', cwd: w.repo, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: TYPE, prompt: 'x', description: 'd' }, tool_use_id: 'toolu_n' }), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: w.data } });
  assert.equal(guard.status, 2);
  assert.match(guard.stderr, /agent-9/);
  assert.match(guard.stderr, /no bound spawn/);
  const voided = JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8'));
  voided.stops['agent-9'].void = true;
  writeFileSync(join(w.S, 'counters.json'), JSON.stringify(voided));
  assert.equal(stopFor({ session_id: 'sess-1', cwd: w.repo }, { CLAUDE_PLUGIN_DATA: w.data }), null);
});

test('fires: run looked up by agent id alone', () => {
  const w = world();
  const other = world({ run: false });
  const foreign = JSON.stringify({ session_id: 'sess-other', cwd: other.base, hook_event_name: 'SubagentStop', agent_id: 'agent-1', agent_type: TYPE });
  quiet(fire(w, { raw: foreign }));
  assert.equal(pending(w).toolu_1.finished_at, undefined);
  assert.equal(JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8')).stops, undefined);
  assert.deepEqual(outcomes(w), ['none']);
});

test('fires: the finish of an agent whose bound spawn is void records the outcome void and writes nothing', () => {
  const w = world({ pending: { toolu_1: bound({ void: true }) } });
  const before = readFileSync(join(w.S, 'counters.json'), 'utf8');
  quiet(fire(w));
  assert.equal(readFileSync(join(w.S, 'counters.json'), 'utf8'), before);
  assert.deepEqual(outcomes(w), ['void']);
});
