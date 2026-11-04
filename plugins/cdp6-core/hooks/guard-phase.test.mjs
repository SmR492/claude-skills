import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readFileSync, existsSync, writeFileSync, rmSync, symlinkSync, linkSync, copyFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { PHASES } from '../lib/phases.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'guard-phase.mjs');
const PLUGIN = dirname(HERE);
const RUNJS = join(PLUGIN, 'scripts', 'run.mjs');
const VERSION = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8')).version;

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function world() {
  const base = tempDir('cdp6-phase-');
  const w = { base, repo: join(base, 'repo'), data: join(base, 'data'), home: join(base, 'home') };
  mkdirSync(w.repo, { recursive: true });
  mkdirSync(w.home);
  spawnSync('git', ['init', '-q', w.repo]);
  writeFileSync(join(w.repo, 'README.md'), 'x\n');
  git(w.repo, 'add', '-A');
  git(w.repo, 'commit', '-q', '-m', 'i');
  return w;
}

function makeRun(w, { states = {}, status = 'active', bind = 'session', truncate = false, name = 'RUN-20261102-1', runDir } = {}) {
  const R = runDir ?? join(w.repo, 'docs', 'cdp6', 'runs', name);
  const S = join(w.data, 'runs', name);
  mkdirSync(S, { recursive: true });
  const phases = {};
  for (const p of PHASES) phases[p] = { state: states[p] ?? 'pending', cycle: 1 };
  const doc = JSON.stringify({ run_id: name, status, mode: 'single', root: w.repo, run_dir: R, journal_offset: 0, phases });
  writeFileSync(join(S, 'run.json'), truncate ? doc.slice(0, 25) : doc);
  if (bind) {
    const pointer = { sessions: { 'sess-1': { run_id: name, project_root: w.repo } }, projects: bind === 'session' ? { [w.repo]: name } : {} };
    writeFileSync(join(w.data, 'active-runs.json'), JSON.stringify(pointer));
  }
  return R;
}

function stateOf(w, name = 'RUN-20261102-1') {
  return join(w.data, 'runs', name);
}

function fire(w, over = {}) {
  const { tool = 'Bash', input = {}, cwd = w.repo, session = 'sess-1', mode = 'default', toolUseId = 'toolu_1', data = w.data, raw } = over;
  const doc = { session_id: session, cwd, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: input, tool_use_id: toolUseId, permission_mode: mode };
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN };
  if (data !== null) env.CLAUDE_PLUGIN_DATA = data;
  const r = spawnSync(process.execPath, [GUARD], { input: raw ?? JSON.stringify(doc), encoding: 'utf8', env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
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

function silent(res) {
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '');
}

const enter = (phase) => ({ command: `node ${RUNJS} enter ${phase}` });

test('silent without run', () => {
  const w = world();
  silent(fire(w, { input: enter('exploration') }));
  silent(fire(w, { tool: 'Edit', input: { file_path: join(w.repo, 'README.md') } }));
  makeRun(w, { status: 'DONE', bind: null });
  silent(fire(w, { input: enter('exploration') }));
  assert.deepEqual(observed(w).map((l) => l.decision), ['none', 'none', 'none']);
});

test('silent for a tool call that touches no phase rule while a run is active', () => {
  const w = world();
  makeRun(w);
  writeFileSync(join(stateOf(w), 'counters.json'), JSON.stringify({ version: 1, pending: {} }));
  silent(fire(w, { tool: 'Edit', input: { file_path: join(w.repo, 'README.md') } }));
  silent(fire(w, { input: { command: 'ls -la' } }));
  silent(fire(w, { input: enter('idea') }));
  silent(fire(w, { input: { command: `node ${RUNJS} status` } }));
});

test('records hooks observed', () => {
  const w = world();
  makeRun(w);
  writeFileSync(join(stateOf(w), 'counters.json'), JSON.stringify({ version: 1, pending: {} }));
  silent(fire(w, { input: { command: 'ls' }, toolUseId: 'toolu_a', mode: 'acceptEdits' }));
  denied(fire(w, { input: enter('exploration'), toolUseId: 'toolu_b' }));
  const lines = observed(w);
  assert.equal(lines.length, 2);
  assert.deepEqual(lines.map((l) => ({ ...l, at: typeof l.at })), [
    { hook: 'guard-phase.mjs', version: VERSION, at: 'string', session_id: 'sess-1', tool_use_id: 'toolu_a', permission_mode: 'acceptEdits', decision: 'none', agent_id: null, capture_sha256: null },
    { hook: 'guard-phase.mjs', version: VERSION, at: 'string', session_id: 'sess-1', tool_use_id: 'toolu_b', permission_mode: 'default', decision: 'deny', agent_id: null, capture_sha256: null },
  ]);
  const bare = JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Edit', tool_input: { file_path: join(w.repo, 'README.md') }, cwd: w.repo });
  silent(fire(w, { raw: bare }));
  const last = observed(w).at(-1);
  assert.deepEqual([last.session_id, last.tool_use_id, last.permission_mode], [null, null, null]);
});

test('fires: unreadable run record', () => {
  const w = world();
  makeRun(w, { truncate: true });
  denied(fire(w, { input: { command: 'ls' } }), /run\.json/);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(w.repo, 'README.md') } }), /run\.json/);
  assert.deepEqual(observed(w).map((l) => l.decision), ['deny', 'deny']);
  const pointerBroken = world();
  makeRun(pointerBroken);
  writeFileSync(join(pointerBroken.data, 'active-runs.json'), '{ "sessions": ');
  denied(fire(pointerBroken, { input: { command: 'ls' } }), /active-runs\.json/);
});

test('fires: pointer missing with active run', () => {
  const w = world();
  const R = makeRun(w, { bind: null });
  const res = fire(w, { tool: 'Edit', input: { file_path: join(R, 'idea', 'idea.md') } });
  denied(res, /pointer/);
  assert.equal(observed(w).at(-1).decision, 'deny');
  denied(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'idea.md') } }), /pointer/);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(stateOf(w), 'run.json') } }), /pointer/);
  rmSync(join(stateOf(w), 'run.json'));
  writeFileSync(join(stateOf(w), 'run.json'), JSON.stringify({ run_id: 'RUN-20261102-1', status: 'DONE', root: w.repo, run_dir: R, journal_offset: 0, phases: {} }));
  silent(fire(w, { tool: 'Edit', input: { file_path: join(R, 'idea', 'idea.md') } }));
});

test('fires: pointer missing with active run, edit of a file in R from a cwd outside the project', () => {
  const w = world();
  const R = makeRun(w, { bind: null });
  const outside = join(w.base, 'outside');
  mkdirSync(outside);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(R, 'idea', 'idea.md') }, cwd: outside }), /pointer/);
  silent(fire(w, { tool: 'Edit', input: { file_path: join(outside, 'x.txt') }, cwd: outside }));
});

test('fires: pointer missing with an active run under the company default run root', () => {
  const w = world();
  const R = join(w.home, '.claude', 'projects', w.repo.replace(/[^A-Za-z0-9]/g, '-'), 'memory', 'cdp6', 'runs', 'RUN-20261102-1');
  makeRun(w, { bind: null, runDir: R });
  denied(fire(w, { input: { command: 'ls' } }), /pointer/);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(R, 'idea', 'idea.md') }, cwd: w.base }), /pointer/);
});

test('fires: worktree cwd', () => {
  const w = world();
  const R = makeRun(w, { bind: null });
  const tree = join(w.base, 'tree');
  git(w.repo, 'worktree', 'add', '-q', tree, '-b', 'wt');
  denied(fire(w, { tool: 'Edit', input: { file_path: join(R, 'idea', 'idea.md') }, cwd: tree }), /pointer/);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(stateOf(w), 'run.json') }, cwd: tree }), /pointer/);
  denied(fire(w, { tool: 'Bash', input: { command: 'ls' }, cwd: join(tree) }), /pointer/);
});

test('fires: nested repo cwd with pointer missing', () => {
  const w = world();
  const R = makeRun(w, { bind: null });
  const nested = join(w.repo, 'vendor', 'inner');
  mkdirSync(nested, { recursive: true });
  spawnSync('git', ['init', '-q', nested]);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(R, 'idea', 'idea.md') }, cwd: nested }), /pointer/);
  denied(fire(w, { tool: 'Edit', input: { file_path: join(stateOf(w), 'run.json') }, cwd: nested }), /pointer/);
  denied(fire(w, { input: { command: 'ls' }, cwd: nested }), /pointer/);
  const outside = join(w.base, 'outside');
  mkdirSync(join(outside, 'inner'), { recursive: true });
  spawnSync('git', ['init', '-q', join(outside, 'inner')]);
  silent(fire(w, { input: { command: 'ls' }, cwd: join(outside, 'inner') }));
});

test('fires: predecessor missing', () => {
  const w = world();
  makeRun(w);
  const res = fire(w, { input: enter('exploration') });
  denied(res, /idea has no exit record/);
  assert.equal(observed(w).at(-1).decision, 'deny');
  denied(fire(w, { tool: 'PowerShell', input: enter('concept') }), /exploration has no exit record/);
  denied(fire(w, { tool: 'Monitor', input: enter('exploration') }), /idea has no exit record/);
  silent(fire(w, { input: enter('idea') }));
  for (const state of ['exited', 'imported', 'skipped']) {
    const ok = world();
    makeRun(ok, { states: { idea: state } });
    silent(fire(ok, { input: enter('exploration') }));
  }
  const open = world();
  makeRun(open, { states: { idea: 'gate-pending' } });
  denied(fire(open, { input: enter('exploration') }), /idea has no exit record/);
});

test('fires: nested repo cwd', () => {
  const w = world();
  makeRun(w, { bind: 'session-only', states: { idea: 'exited' } });
  const nested = join(w.repo, 'vendor', 'inner');
  mkdirSync(nested, { recursive: true });
  spawnSync('git', ['init', '-q', nested]);
  const res = fire(w, { input: enter('concept'), cwd: nested });
  denied(res, /exploration has no exit record/);
  silent(fire(w, { input: enter('exploration'), cwd: nested }));
});

test('an unknown data directory gives no decision because no state directory can be read', () => {
  const w = world();
  makeRun(w);
  silent(fire(w, { input: { command: 'ls' }, data: null }));
  silent(fire(w, { input: { command: 'ls' }, data: 'relative/data' }));
  assert.deepEqual(observed(w).map((l) => l.decision), []);
});

test('fires: guard-phase started through a symlinked plugin root still decides', () => {
  const w = world();
  makeRun(w, { truncate: true });
  const link = join(w.base, 'plugin-link');
  symlinkSync(PLUGIN, link);
  const doc = { session_id: 'sess-1', cwd: w.repo, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' }, tool_use_id: 'toolu_1', permission_mode: 'default' };
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: link, ['CLAUDE_PLUGIN_' + 'DATA']: w.data };
  const r = spawnSync(process.execPath, [join(link, 'hooks', 'guard-phase.mjs')], { input: JSON.stringify(doc), encoding: 'utf8', env });
  assert.equal(r.status, 2, `${r.stdout}${r.stderr}`);
  assert.match(r.stderr, /run\.json/);
});

test('fires: a failing hooks observed write leaves the decision of guard-phase unchanged', () => {
  const w = world();
  makeRun(w);
  const plain = fire(w, { input: enter('exploration') });
  const quiet = fire(w, { input: { command: 'ls' } });
  denied(plain, /idea has no exit record/);
  silent(quiet);
  rmSync(join(w.data, 'hooks-fired.jsonl'));
  mkdirSync(join(w.data, 'hooks-fired.jsonl'));
  const blocked = fire(w, { input: enter('exploration') });
  denied(blocked, /idea has no exit record/);
  assert.equal(blocked.stderr, plain.stderr);
  silent(fire(w, { input: { command: 'ls' } }));
});

test('fires: hook input not readable', () => {
  const w = world();
  makeRun(w);
  denied(fire(w, { raw: 'not json' }), /input/);
  denied(fire(w, { raw: '[]' }), /input/);
});

test('fires: a Write to idea/idea.md while a devils-advocate spawn naming it as target is open is denied', () => {
  const w = world();
  const R = makeRun(w, { states: { idea: 'entered' } });
  const sha = createHash('sha256').update('A\n').digest('hex');
  writeFileSync(join(stateOf(w), 'counters.json'), JSON.stringify({ version: 1, pending: { toolu_9: { tool_use_id: 'toolu_9', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', role: 'devils-advocate', targets: [{ path: 'idea/idea.md', sha256: sha }], header: 'ok', at: new Date().toISOString(), agent_id: 'agent-9' } } }));
  const res = fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'idea.md'), content: 'B\n' } });
  assert.equal(res.status, 2, `${res.stdout}${res.stderr}`);
});

function withSpawns(w, pending) {
  const R = makeRun(w, { states: { idea: 'entered' } });
  const sha = createHash('sha256').update('A\n').digest('hex');
  const base = { agent_type: 'cdp6-core:devils-advocate', task: 'D-1', role: 'devils-advocate', targets: [{ path: 'idea/idea.md', sha256: sha }], header: 'ok', at: new Date().toISOString(), agent_id: null };
  const doc = { version: 1, pending: Object.fromEntries(Object.entries(pending).map(([id, over]) => [id, { tool_use_id: id, ...base, ...over }])) };
  writeFileSync(join(stateOf(w), 'counters.json'), JSON.stringify(doc));
  return R;
}

test('fires: Edit, Write and NotebookEdit on the target of an open devils-advocate spawn are denied with the spawn task, bound or not, and other paths and closed spawns pass', () => {
  for (const binding of [{}, { agent_id: 'agent-1' }]) {
    const w = world();
    const R = withSpawns(w, { toolu_a: { task: 'D-3', ...binding } });
    const target = join(R, 'idea', 'idea.md');
    for (const [tool, input] of [['Edit', { file_path: target, old_string: 'a', new_string: 'b' }], ['Write', { file_path: target, content: 'b' }], ['NotebookEdit', { notebook_path: target, new_source: 'b' }], ['Write', { file_path: join(R, 'idea', '..', 'idea', 'idea.md'), content: 'b' }]]) {
      denied(fire(w, { tool, input }), /D-3/);
    }
    denied(fire(w, { tool: 'Write', input: { file_path: 'idea/idea.md', content: 'b' }, cwd: R }), /devils-advocate/);
    for (const [tool, input] of [['Write', { file_path: join(R, 'idea', 'other.md'), content: 'b' }], ['Edit', { file_path: join(R, 'idea.md'), old_string: 'a', new_string: 'b' }], ['Read', { file_path: target }], ['Write', { file_path: join(w.repo, 'idea', 'idea.md'), content: 'b' }]]) {
      silent(fire(w, { tool, input }));
    }
  }
});

test('fires: closed, void and foreign spawns do not block the target, a missing or malformed counters.json denies the write tools', () => {
  for (const pending of [{ toolu_c: { closed_at: '2026-11-04T10:00:00.000Z', agent_id: 'agent-1' } }, { toolu_v: { void: true } }, { toolu_r: { agent_type: 'cdp6-core:review-verify', role: 'review-verify' } }, {}]) {
    const w = world();
    const R = withSpawns(w, pending);
    silent(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'idea.md'), content: 'b' } }));
  }
  const none = world();
  const R = makeRun(none, { states: { idea: 'entered' } });
  for (const tool of ['Write', 'Edit', 'NotebookEdit']) denied(fire(none, { tool, input: { file_path: join(R, 'idea', 'idea.md'), content: 'b', old_string: 'a', new_string: 'b', notebook_path: join(R, 'idea', 'idea.md'), new_source: 'b' } }), /counters\.json/);
  silent(fire(none, { tool: 'Read', input: { file_path: join(R, 'idea', 'idea.md') } }));
  const broken = world();
  const Rb = withSpawns(broken, { toolu_x: {} });
  writeFileSync(join(stateOf(broken), 'counters.json'), '{ "pending": ');
  denied(fire(broken, { tool: 'Write', input: { file_path: join(Rb, 'idea', 'idea.md'), content: 'b' } }), /counters\.json/);
  silent(fire(broken, { tool: 'Read', input: { file_path: join(Rb, 'idea', 'idea.md') } }));
});

test('fires: a Write to the open target through a hard link or another letter case is denied', (t) => {
  const w = world();
  const R = withSpawns(w, { toolu_a: { task: 'D-3' } });
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'A\n');
  const alias = join(w.base, 'alias.md');
  linkSync(join(R, 'idea', 'idea.md'), alias);
  denied(fire(w, { tool: 'Write', input: { file_path: alias, content: 'B\n' } }), /D-3/);
  if (existsSync(join(R, 'IDEA', 'IDEA.MD'))) denied(fire(w, { tool: 'Edit', input: { file_path: join(R, 'IDEA', 'IDEA.MD'), old_string: 'A', new_string: 'B' } }), /D-3/);
  else t.diagnostic('case branch not reached: file system is case-sensitive');
});

test('fires: a trailing slash, dot and doubled separators and a symlinked directory still hit the open spawn target', () => {
  const w = world();
  const R = withSpawns(w, { toolu_t: { task: 'D-5' } });
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'A\n');
  symlinkSync(join(R, 'idea'), join(w.base, 'link'));
  denied(fire(w, { tool: 'Write', input: { file_path: `${join(R, 'idea', 'idea.md')}/`, content: 'b' } }), /D-5/);
  denied(fire(w, { tool: 'Edit', input: { file_path: `${R}/./idea//idea.md`, old_string: 'a', new_string: 'b' } }), /D-5/);
  denied(fire(w, { tool: 'NotebookEdit', input: { notebook_path: join(w.base, 'link', 'idea.md'), new_source: 'b' } }), /D-5/);
});

test('fires: while the open target exists, a write to another existing file or to a copy of the target passes', () => {
  const w = world();
  const R = withSpawns(w, { toolu_a: { task: 'D-3' } });
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'A\n');
  writeFileSync(join(R, 'idea', 'other.md'), 'A\n');
  copyFileSync(join(R, 'idea', 'idea.md'), join(w.base, 'copy.md'));
  silent(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'other.md'), content: 'B\n' } }));
  silent(fire(w, { tool: 'Edit', input: { file_path: join(w.base, 'copy.md'), old_string: 'A', new_string: 'B' } }));
  denied(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'idea.md'), content: 'B\n' } }), /D-3/);
});
