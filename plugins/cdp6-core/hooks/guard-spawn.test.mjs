import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PHASES } from '../lib/phases.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'guard-spawn.mjs');
const PLUGIN = dirname(HERE);
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const RUN = 'RUN-20261103-1';

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function world({ run = true, counters = { version: 1 } } = {}) {
  const base = tempDir('cdp6-spawn-');
  const w = { base, repo: join(base, 'repo'), data: join(base, 'data'), home: join(base, 'home') };
  mkdirSync(w.repo, { recursive: true });
  mkdirSync(w.home);
  spawnSync('git', ['init', '-q', w.repo]);
  writeFileSync(join(w.repo, 'README.md'), 'x\n');
  git(w.repo, 'add', '-A');
  git(w.repo, 'commit', '-q', '-m', 'i');
  w.S = join(w.data, 'runs', RUN);
  if (run) {
    mkdirSync(w.S, { recursive: true });
    const phases = {};
    for (const p of PHASES) phases[p] = { state: 'pending', cycle: 1 };
    writeFileSync(join(w.S, 'run.json'), JSON.stringify({ run_id: RUN, status: 'active', mode: 'single', root: w.repo, run_dir: join(w.repo, 'docs', 'cdp6', 'runs', RUN), journal_offset: 0, phases }));
    writeFileSync(join(w.data, 'active-runs.json'), JSON.stringify({ sessions: { 'sess-1': { run_id: RUN, project_root: w.repo } }, projects: { [w.repo]: RUN } }));
    if (counters !== null) writeFileSync(join(w.S, 'counters.json'), typeof counters === 'string' ? counters : JSON.stringify(counters));
  }
  return w;
}

const HEADER = [
  `run: ${RUN}`,
  'phase: concept',
  'task: P3-gate',
  'role: devils-advocate',
  'round: 1',
  'brief: /r/briefs/da.md',
  'env: none',
  `target: docs/a.md@${H1}`,
  `target: docs/b.md@${H2}`,
  'writes: none',
].join('\n');

const PROMPT = `${HEADER}\n\nRead your brief at /r/briefs/da.md.\n`;

function fire(w, over = {}) {
  const { type = 'cdp6-core:devils-advocate', prompt = PROMPT, toolUseId = 'toolu_1', data = w.data, raw, tool = 'Agent', omitId = false } = over;
  const doc = { session_id: 'sess-1', cwd: w.repo, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { subagent_type: type, prompt, description: 'd' }, permission_mode: 'default' };
  if (!omitId) doc.tool_use_id = toolUseId;
  if (type === null) delete doc.tool_input.subagent_type;
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN };
  if (data !== null) env.CLAUDE_PLUGIN_DATA = data;
  const r = spawnSync(process.execPath, [GUARD], { input: raw ?? JSON.stringify(doc), encoding: 'utf8', env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function counters(w) {
  return JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8'));
}

function observed(w) {
  const file = join(w.data, 'hooks-fired.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
}

function denied(res, needle) {
  assert.equal(res.status, 2, `${res.stdout}${res.stderr}`);
  assert.ok(res.stderr.trim().length > 0, 'the deny carries no reason');
  if (needle) assert.match(res.stderr, needle);
}

function allowed(res) {
  assert.equal(res.status, 0, `${res.stdout}${res.stderr}`);
  assert.equal(res.stdout, '');
}

test('fires: headerless foreign spawn', () => {
  const w = world();
  const bare = fire(w, { type: 'general-purpose', prompt: 'do the thing' });
  denied(bare, /cdp6-core/);
  const withHeader = fire(w, { type: 'general-purpose', toolUseId: 'toolu_2' });
  denied(withHeader, /cdp6-core/);
  denied(fire(w, { type: 'cdp5-agents:impl-uc', toolUseId: 'toolu_3' }), /cdp6-core/);
  denied(fire(w, { type: 'cdp5-agents:impl-uc', prompt: 'no header', toolUseId: 'toolu_4' }), /cdp6-core/);
  denied(fire(w, { type: 'cdp6-corex:impl', toolUseId: 'toolu_5' }), /cdp6-core/);
  assert.deepEqual(counters(w), { version: 1 });
  assert.deepEqual(observed(w).map((l) => [l.tool_use_id, l.decision]), [['toolu_1', 'deny'], ['toolu_2', 'deny'], ['toolu_3', 'deny'], ['toolu_4', 'deny'], ['toolu_5', 'deny']]);
});

test('an allowed cdp6-core spawn records a pending spawn with the header fields and target hashes', () => {
  const w = world();
  const before = Date.now();
  allowed(fire(w));
  const spawn = counters(w).pending.toolu_1;
  assert.equal(spawn.tool_use_id, 'toolu_1');
  assert.equal(spawn.agent_type, 'cdp6-core:devils-advocate');
  assert.equal(spawn.task, 'P3-gate');
  assert.equal(spawn.role, 'devils-advocate');
  assert.equal(spawn.header, 'ok');
  assert.deepEqual(spawn.targets, [{ path: 'docs/a.md', sha256: H1 }, { path: 'docs/b.md', sha256: H2 }]);
  assert.equal(spawn.agent_id, null);
  assert.ok(Date.parse(spawn.at) >= before - 1000);
  assert.equal(counters(w).version, 1);
  const [line] = observed(w);
  assert.equal(line.hook, 'guard-spawn.mjs');
  assert.equal(line.tool_use_id, 'toolu_1');
  assert.equal(line.decision, 'none');
});

test('a missing or malformed header allows the spawn and records header invalid with no targets', () => {
  const w = world();
  allowed(fire(w, { prompt: 'Read your brief at x.', toolUseId: 'toolu_a' }));
  allowed(fire(w, { prompt: `${HEADER}\ntarget: docs/c.md@short`, toolUseId: 'toolu_b' }));
  allowed(fire(w, { prompt: HEADER.replace(`@${H2}`, '@xyz'), toolUseId: 'toolu_c' }));
  allowed(fire(w, { prompt: null, toolUseId: 'toolu_d' }));
  const p = counters(w).pending;
  for (const id of ['toolu_a', 'toolu_b', 'toolu_c', 'toolu_d']) {
    assert.equal(p[id].header, 'invalid', id);
    assert.deepEqual(p[id].targets, [], id);
    assert.equal(p[id].agent_type, 'cdp6-core:devils-advocate', id);
  }
});

test('fires: a task outside [A-Za-z0-9._-] records header invalid at the spawn', () => {
  const w = world();
  const tasks = ['../evil', 'a b', 'x/y'];
  tasks.forEach((task, n) => allowed(fire(w, { prompt: PROMPT.replace('task: P3-gate', `task: ${task}`), toolUseId: `toolu_t${n}` })));
  const p = counters(w).pending;
  tasks.forEach((task, n) => {
    assert.equal(p[`toolu_t${n}`].header, 'invalid', task);
    assert.equal(p[`toolu_t${n}`].task, null, task);
  });
});

test('fires: unreadable hook input is denied', () => {
  const w = world();
  for (const raw of ['', 'not json', '[1]', 'null', '"x"']) {
    denied(fire(w, { raw }));
  }
  assert.deepEqual(counters(w), { version: 1 });
  assert.ok(observed(w).every((l) => l.decision === 'deny'));
  assert.equal(observed(w).length, 5);
});

test('fires: missing tool_use_id is denied in an active run', () => {
  const w = world();
  denied(fire(w, { omitId: true }), /tool_use_id/);
  denied(fire(w, { toolUseId: '' }), /tool_use_id/);
  assert.deepEqual(counters(w), { version: 1 });
});

test('fires: counters.json missing, unreadable or malformed is denied in an active run', () => {
  const missing = world({ counters: null });
  denied(fire(missing), /counters/);
  const malformed = world({ counters: '{ "version": ' });
  denied(fire(malformed), /counters/);
  const wrongShape = world({ counters: '[]' });
  denied(fire(wrongShape), /counters/);
  const badPending = world({ counters: { version: 1, pending: 'x' } });
  denied(fire(badPending), /counters/);
  const unreadable = world({ counters: null });
  mkdirSync(join(unreadable.S, 'counters.json'));
  denied(fire(unreadable), /counters/);
  assert.equal(existsSync(join(missing.S, 'counters.json')), false);
});

test('counters.json of the SL-1 shape reads as no pending spawns and the record is added', () => {
  const w = world({ counters: { version: 1 } });
  allowed(fire(w));
  assert.deepEqual(Object.keys(counters(w).pending), ['toolu_1']);
});

test('several unbound pending spawns of the role: the new spawn is allowed and recorded', () => {
  const w = world();
  allowed(fire(w, { toolUseId: 'toolu_1' }));
  allowed(fire(w, { toolUseId: 'toolu_2' }));
  allowed(fire(w, { toolUseId: 'toolu_3' }));
  assert.deepEqual(Object.keys(counters(w).pending), ['toolu_1', 'toolu_2', 'toolu_3']);
});

test('fires: a busy lock on counters.json is denied', () => {
  const w = world();
  writeFileSync(join(w.S, 'counters.lock'), '{}');
  denied(fire(w), /locked/);
  assert.deepEqual(counters(w), { version: 1 });
});

test('fires: an empty or namespace-less subagent_type is denied in an active run', () => {
  const w = world();
  denied(fire(w, { type: '' }), /cdp6-core/);
  denied(fire(w, { type: null, toolUseId: 'toolu_2' }), /cdp6-core/);
  denied(fire(w, { type: 'devils-advocate', toolUseId: 'toolu_3' }), /cdp6-core/);
  denied(fire(w, { type: 'cdp6-core:', toolUseId: 'toolu_4' }), /cdp6-core/);
  assert.deepEqual(counters(w), { version: 1 });
});

test('no active run: no decision and no record, also without a data directory', () => {
  const none = world({ run: false });
  allowed(fire(none, { type: 'general-purpose' }));
  allowed(fire(none, { toolUseId: 'toolu_2' }));
  assert.equal(existsSync(join(none.S, 'counters.json')), false);
  assert.deepEqual(observed(none).map((l) => l.decision), ['none', 'none']);
  const bare = world({ run: false });
  allowed(fire(bare, { data: null, type: 'general-purpose' }));
  allowed(fire(bare, { data: 'relative/dir', type: 'general-purpose' }));
  assert.equal(existsSync(bare.data), false);
  rmSync(bare.base, { recursive: true, force: true });
});

test('a tool other than Agent gets no decision', () => {
  const w = world();
  allowed(fire(w, { tool: 'Bash', type: 'general-purpose' }));
  assert.deepEqual(counters(w), { version: 1 });
});

test('an unreadable run record in an active project is denied', () => {
  const w = world();
  writeFileSync(join(w.S, 'run.json'), '{ "run_id": ');
  denied(fire(w), /run/);
});

test('fires: a foreign subagent_type through the Task tool name is denied in an active run', () => {
  const w = world();
  denied(fire(w, { tool: 'Task', type: 'general-purpose' }), /cdp6-core/);
  denied(fire(w, { tool: 'Task', type: 'cdp5-agents:impl-uc', toolUseId: 'toolu_2' }), /cdp6-core/);
  assert.deepEqual(counters(w), { version: 1 });
  allowed(fire(w, { tool: 'Task', toolUseId: 'toolu_3' }));
  assert.equal(counters(w).pending.toolu_3.agent_type, 'cdp6-core:devils-advocate');
});
