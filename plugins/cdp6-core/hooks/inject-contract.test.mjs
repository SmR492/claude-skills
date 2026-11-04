import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PHASES } from '../lib/phases.mjs';
import { verify } from '../lib/contract.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const INJECT = join(HERE, 'inject-contract.mjs');
const GUARD = join(HERE, 'guard-spawn.mjs');
const PLUGIN = dirname(HERE);
const H1 = 'a'.repeat(64);
const RUN = 'RUN-20261103-1';
const TYPE = 'cdp6-core:devils-advocate';

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function world({ run = true, counters = { version: 1 } } = {}) {
  const base = tempDir('cdp6-inject-');
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

function envOf(w, { root = PLUGIN, data = w.data } = {}) {
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: root };
  if (data !== null) env.CLAUDE_PLUGIN_DATA = data;
  return env;
}

function fire(w, over = {}) {
  const { type = TYPE, agentId = 'agent-7', raw, root, data } = over;
  const doc = { session_id: 'sess-1', cwd: w.repo, hook_event_name: 'SubagentStart', agent_id: agentId, agent_type: type };
  if (agentId === null) delete doc.agent_id;
  if (type === null) delete doc.agent_type;
  const r = spawnSync(process.execPath, [INJECT], { input: raw ?? JSON.stringify(doc), encoding: 'utf8', env: envOf(w, { root, data }) });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

function spawnIt(w, { toolUseId = 'toolu_1', type = TYPE, prompt } = {}) {
  const header = [`run: ${RUN}`, 'phase: concept', 'task: P3-gate', 'role: devils-advocate', 'round: 1', 'brief: /r/b.md', 'env: none', `target: docs/a.md@${H1}`].join('\n');
  const doc = { session_id: 'sess-1', cwd: w.repo, tool_name: 'Agent', tool_use_id: toolUseId, tool_input: { subagent_type: type, prompt: prompt ?? `${header}\n\nRead your brief at /r/b.md.\n` } };
  const r = spawnSync(process.execPath, [GUARD], { input: JSON.stringify(doc), encoding: 'utf8', env: envOf(w) });
  assert.equal(r.status, 0, r.stderr);
}

function counters(w) {
  return JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8'));
}

function observed(w) {
  const file = join(w.data, 'hooks-fired.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)) : [];
}

function context(res) {
  const out = JSON.parse(res.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, 'SubagentStart');
  return out.hookSpecificOutput.additionalContext;
}

function injected(res) {
  assert.equal(res.status, 0, res.stderr);
  const text = context(res);
  const v = verify(PLUGIN);
  assert.ok(text.startsWith(`CDP6-CONTRACT v1 sha256:${v.hash}\n`), text.slice(0, 80));
  assert.ok(text.includes(v.body));
}

function silent(res) {
  assert.equal(res.status, 0, res.stderr);
  assert.equal(res.stdout, '');
}

test('injects the CDP6 contract into a cdp6-core agent', () => {
  const w = world({ run: false });
  const res = fire(w);
  injected(res);
  assert.equal(res.stderr, '');
  assert.match(context(res), /cdp6-contract: v1 <hash>/);
});

test('fires: foreign agent type gets no output', () => {
  const w = world({ run: false });
  for (const type of ['cdp5-agents:impl-uc', 'domain-agents:x', 'general-purpose', '', 'cdp6-corex:impl', 'cdp6-core:', null]) silent(fire(w, { type }));
  assert.deepEqual(observed(w).map((l) => l.decision), Array(7).fill('none'));
});

test('fires: unverifiable contract gives a cdp6-core agent the CONTRACT-MISSING instruction', () => {
  const w = world({ run: false });
  const empty = tempDir('cdp6-noroot-');
  const res = fire(w, { root: empty });
  assert.equal(res.status, 0);
  assert.match(context(res), /CONTRACT-MISSING/);
  assert.doesNotMatch(context(res), /CDP6-CONTRACT v1 sha256/);
  assert.match(res.stderr, /contract not injected/);
  silent(fire(w, { root: empty, type: 'cdp5-agents:impl-uc' }));
});

test('binds spawn to agent id', () => {
  const w = world();
  spawnIt(w);
  injected(fire(w));
  const spawn = counters(w).pending.toolu_1;
  assert.equal(spawn.agent_id, 'agent-7');
  assert.equal(spawn.agent_type, TYPE);
  assert.equal(spawn.task, 'P3-gate');
  assert.deepEqual(spawn.targets, [{ path: 'docs/a.md', sha256: H1 }]);
  assert.equal(typeof spawn.bound_at, 'string');
  assert.equal(observed(w).at(-1).hook, 'inject-contract.mjs');
});

test('a spawn with an invalid header binds as usual', () => {
  const w = world();
  spawnIt(w, { prompt: 'no header' });
  const res = fire(w);
  injected(res);
  assert.equal(res.stderr, '');
  assert.equal(counters(w).pending.toolu_1.agent_id, 'agent-7');
  assert.equal(counters(w).pending.toolu_1.header, 'invalid');
});

test('fires: hook input missing, unreadable or not JSON gives no output and a stderr line', () => {
  const w = world();
  for (const raw of ['', 'not json', '[1]', 'null']) {
    const res = fire(w, { raw });
    silent(res);
    assert.ok(res.stderr.trim().length > 0, raw);
  }
});

test('fires: agent_id missing injects the contract, binds nothing and writes a stderr line', () => {
  const w = world();
  spawnIt(w);
  const res = fire(w, { agentId: null });
  injected(res);
  assert.match(res.stderr, /agent_id/);
  assert.equal(counters(w).pending.toolu_1.agent_id, null);
});

test('fires: counters.json missing, unreadable or malformed injects the contract, binds nothing and writes a stderr line', () => {
  const missing = world({ counters: null });
  const res = fire(missing);
  injected(res);
  assert.match(res.stderr, /counters/);
  const malformed = world({ counters: '{ "version": ' });
  const bad = fire(malformed);
  injected(bad);
  assert.match(bad.stderr, /counters/);
  const unreadable = world({ counters: null });
  mkdirSync(join(unreadable.S, 'counters.json'));
  const dir = fire(unreadable);
  injected(dir);
  assert.match(dir.stderr, /counters/);
});

test('counters.json of the SL-1 shape or without a pending spawn of the type: contract injected, no binding, no error', () => {
  const w = world();
  const res = fire(w);
  injected(res);
  assert.equal(res.stderr, '');
  assert.deepEqual(counters(w), { version: 1 });
  spawnIt(w, { type: 'cdp6-core:review-verify' });
  const other = fire(w);
  injected(other);
  assert.equal(other.stderr, '');
  assert.equal(counters(w).pending.toolu_1.agent_id, null);
});

test('fires: more than one unbound pending spawn of the type binds none and names the count', () => {
  const w = world();
  spawnIt(w, { toolUseId: 'toolu_1' });
  spawnIt(w, { toolUseId: 'toolu_2' });
  spawnIt(w, { toolUseId: 'toolu_3', type: 'cdp6-core:review-verify' });
  const res = fire(w);
  injected(res);
  assert.match(res.stderr, /2 unbound/);
  const p = counters(w).pending;
  assert.equal(p.toolu_1.agent_id, null);
  assert.equal(p.toolu_2.agent_id, null);
  assert.equal(p.toolu_3.agent_id, null);
});

test('fires: a busy lock on counters.json injects the contract, binds nothing and writes a stderr line', () => {
  const w = world();
  spawnIt(w);
  writeFileSync(join(w.S, 'counters.lock'), '{}');
  const res = fire(w);
  injected(res);
  assert.match(res.stderr, /locked/);
  assert.equal(counters(w).pending.toolu_1.agent_id, null);
});

test('no active run or no data directory: contract by namespace only, no binding', () => {
  const none = world({ run: false });
  const res = fire(none);
  injected(res);
  assert.equal(res.stderr, '');
  assert.equal(existsSync(join(none.S, 'counters.json')), false);
  const bare = world({ run: false });
  const noData = fire(bare, { data: null });
  injected(noData);
  assert.equal(noData.stderr, '');
  assert.equal(existsSync(bare.data), false);
});

test('an unreadable run record injects the contract, binds nothing and writes a stderr line', () => {
  const w = world();
  spawnIt(w);
  writeFileSync(join(w.S, 'run.json'), '{ "run_id": ');
  const res = fire(w);
  injected(res);
  assert.match(res.stderr, /run/);
  assert.equal(counters(w).pending.toolu_1.agent_id, null);
});
