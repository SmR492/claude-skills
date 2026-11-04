import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chmodSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { PHASES } from '../lib/phases.mjs';
import { verify } from '../lib/contract.mjs';
import { addPending, bindPending } from '../lib/counters.mjs';
import { markerPath, reasonOf } from './check-handback.mjs';
import { CaptureError } from '../lib/capture.mjs';
import { CountersError } from '../lib/counters.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const HANDBACK = join(HERE, 'check-handback.mjs');
const SPAWN = join(HERE, 'guard-spawn.mjs');
const INJECT = join(HERE, 'inject-contract.mjs');
const PLUGIN = dirname(HERE);
const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);
const RUN = 'RUN-20261103-1';
const TYPE = 'cdp6-core:devils-advocate';
const HASH = verify(PLUGIN).hash;

function git(cwd, ...args) {
  const r = spawnSync('git', ['-C', cwd, '-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
}

function world({ run = true, spawn = {}, bind = true } = {}) {
  const base = tempDir('cdp6-handback-');
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
    writeFileSync(join(w.S, 'counters.json'), '{"version":1}\n');
    if (bind !== null) {
      addPending(w.S, { tool_use_id: 'toolu_1', agent_type: TYPE, task: 'D-1', role: 'devils-advocate', targets: [{ path: 'docs/a.md', sha256: H1 }, { path: 'docs/b.md', sha256: H2 }], header: 'ok', at: '2026-11-03T10:00:00.000Z', ...spawn });
      if (bind) bindPending(w.S, TYPE, 'agent-7');
    }
  }
  return w;
}

const BODY = [
  'fresh context: yes',
  'rejected alternative provided: yes',
  'conflict of interest: none',
  'severity scale: 🔴 blocks the task, 🟡 defect with a workaround, 🟢 polish',
  'verdict mapping: a = pass, a-with-conditions = pass-with-conditions, b = block, c = block, not-decidable = no pass',
  'premises: none, no existing code or data touched',
  'verdict: a',
  '',
].join('\n');

function msg({ ack = `cdp6-contract: v1 ${HASH}`, second = `run: ${RUN} task: D-1`, body = BODY } = {}) {
  return [ack, second, body].filter((l) => l !== null).join('\n');
}

function fire(w, over = {}) {
  const { message = msg(), agentId = 'agent-7', type = TYPE, tool = 'SubagentHandback', raw, root = PLUGIN, data = w.data } = over;
  const doc = { session_id: 'sess-1', cwd: w.repo, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { message }, agent_type: type, agent_id: agentId };
  if (agentId === null) delete doc.agent_id;
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: root };
  if (data !== null) env.CLAUDE_PLUGIN_DATA = data;
  const r = spawnSync(process.execPath, [HANDBACK], { input: raw ?? JSON.stringify(doc), encoding: 'utf8', env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
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

function observed(w) {
  const file = join(w.data, 'hooks-fired.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((l) => l.hook === 'check-handback.mjs') : [];
}

function index(w) {
  const file = join(w.S, 'verdicts', 'index.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
}

function captured(w) {
  return existsSync(join(w.S, 'verdicts')) ? readdirSync(join(w.S, 'verdicts')).filter((n) => n.endsWith('.md')) : [];
}

function pending(w) {
  return JSON.parse(readFileSync(join(w.S, 'counters.json'), 'utf8')).pending;
}

function brokenRoot(w, how) {
  const root = join(w.base, `root-${how}`);
  cpSync(join(PLUGIN, 'skills', 'worker-contract'), join(root, 'skills', 'worker-contract'), { recursive: true });
  const core = join(root, 'skills', 'worker-contract', 'core.md');
  const text = readFileSync(core, 'utf8');
  if (how === 'missing') rmSync(core);
  if (how === 'corrupt') writeFileSync(core, text.replace('C1.', 'C1!'));
  if (how === 'garbage') writeFileSync(core, 'not a contract\n');
  if (how === 'drift') writeFileSync(core, text.replace('CDP6-CONTRACT v1', 'CDP6-CONTRACT v2'));
  if (how === 'skill-missing') rmSync(join(root, 'skills', 'worker-contract', 'SKILL.md'));
  return root;
}

test('an accepted handback is captured: file, index line, closed spawn, and a hooks observed line with agent_id and capture_sha256', () => {
  const w = world();
  const message = msg();
  allowed(fire(w, { message }));
  assert.deepEqual(captured(w), ['D-1-devils-advocate-agent-7.md']);
  assert.equal(readFileSync(join(w.S, 'verdicts', captured(w)[0]), 'utf8'), message);
  const [line] = index(w);
  assert.equal(line.sha256, createHash('sha256').update(message).digest('hex'));
  assert.equal(line.agent_type, TYPE);
  assert.equal(line.task, 'D-1');
  assert.equal(line.decision, 'D-1');
  assert.equal(line.validator, 'valid');
  assert.equal(line.verdict, 'a');
  assert.equal(pending(w).toolu_1.capture_sha256, line.sha256);
  const [obs] = observed(w);
  assert.equal(obs.decision, 'none');
  assert.equal(obs.agent_id, 'agent-7');
  assert.equal(obs.capture_sha256, line.sha256);
  assert.equal(obs.session_id, 'sess-1');
});

test('fires: a handback that fails the capture form is denied once with the reasons, the second failing handback is captured with validator rejected, verdict null and the reasons', () => {
  const w = world();
  const bad = msg({ body: 'Verdict (a).\n' });
  denied(fire(w, { message: bad }), /capture form.*premises section is missing/);
  assert.deepEqual(captured(w), []);
  assert.deepEqual(index(w), []);
  assert.equal(pending(w).toolu_1.closed_at, undefined);
  allowed(fire(w, { message: bad }));
  assert.deepEqual(captured(w), ['D-1-devils-advocate-agent-7.md']);
  const [line] = index(w);
  assert.equal(line.validator, 'rejected');
  assert.equal(line.verdict, null);
  assert.ok(line.reasons.length >= 1);
  assert.equal(pending(w).toolu_1.capture_sha256, line.sha256);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', line.sha256]]);
});

test('a handback that restates a valid capture form after the deny is captured valid', () => {
  const w = world();
  denied(fire(w, { message: msg({ body: 'Verdict (a).\n' }) }), /capture form/);
  allowed(fire(w));
  assert.equal(index(w)[0].validator, 'valid');
  assert.equal(index(w)[0].verdict, 'a');
});

test('a task that is not D-n records decision null', () => {
  const w = world({ spawn: { task: 'S-1' } });
  allowed(fire(w, { message: msg({ second: `run: ${RUN} task: S-1` }) }));
  assert.equal(index(w)[0].decision, null);
  assert.deepEqual(captured(w), ['S-1-devils-advocate-agent-7.md']);
});

test('fires: missing acknowledgement', () => {
  const w = world();
  const bad = msg({ ack: 'Here is my report.' });
  denied(fire(w, { message: bad }), /cdp6-contract: v1/);
  assert.deepEqual(captured(w), []);
  allowed(fire(w, { message: bad }));
  assert.deepEqual(captured(w), []);
  assert.deepEqual(index(w), []);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null]]);
});

test('fires: an acknowledgement with a wrong hash, a wrong version or the CDP5 form is denied once', () => {
  for (const ack of [`cdp6-contract: v1 ${'0'.repeat(12)}`, `cdp6-contract: v2 ${HASH}`, `contract: v2 ${HASH}`, `cdp6-contract: v1 ${HASH} extra`]) {
    const w = world();
    denied(fire(w, { message: msg({ ack }) }), /cdp6-contract/);
    assert.deepEqual(captured(w), [], ack);
  }
});

test('fires: missing run line', () => {
  const w = world();
  denied(fire(w, { message: msg({ second: null }) }), /run:/);
  assert.deepEqual(captured(w), []);
  allowed(fire(w, { message: msg({ second: null }) }));
  assert.deepEqual(captured(w), []);
  assert.deepEqual(observed(w).map((l) => l.decision), ['deny', 'none']);
});

test('fires: a malformed second line or a run id other than the active run is denied once', () => {
  for (const second of ['run: RUN-20261103-1', `run: ${RUN} task:`, `run ${RUN} task D-1`, 'run: RUN-20261103-9 task: D-1', `task: D-1 run: ${RUN}`]) {
    const w = world();
    denied(fire(w, { message: msg({ second }) }), /run/);
    allowed(fire(w, { message: msg({ second }) }));
    assert.deepEqual(captured(w), [], second);
    assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null]], second);
    assert.deepEqual(index(w), [], second);
  }
});

test('fires: task line mismatch', () => {
  const w = world();
  denied(fire(w, { message: msg({ second: `run: ${RUN} task: D-2` }) }), /task/);
  assert.deepEqual(captured(w), []);
  allowed(fire(w, { message: msg({ second: `run: ${RUN} task: D-2` }) }));
  assert.deepEqual(captured(w), []);
  assert.deepEqual(index(w), []);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null]]);
});

test('fires: unverifiable contract denies', () => {
  for (const how of ['missing', 'corrupt', 'garbage', 'drift', 'skill-missing']) {
    const w = world();
    const root = brokenRoot(w, how);
    for (let i = 0; i < 3; i++) denied(fire(w, { root }), /contract/);
    assert.deepEqual(captured(w), [], how);
    assert.deepEqual(observed(w).map((l) => l.decision), ['deny', 'deny', 'deny'], how);
  }
});

test('an unverifiable contract denies with no active run and with no data directory too', () => {
  const none = world({ run: false });
  denied(fire(none, { root: brokenRoot(none, 'corrupt') }), /contract/);
  denied(fire(none, { root: brokenRoot(none, 'corrupt') }), /contract/);
  const bare = world({ run: false });
  denied(fire(bare, { root: brokenRoot(bare, 'missing'), data: null }), /contract/);
});

test('the capture carries the target hashes of the spawn bound at SubagentStart', () => {
  const w = world({ bind: null });
  const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: w.data };
  const prompt = [`run: ${RUN}`, 'phase: concept', 'task: D-1', 'role: devils-advocate', 'round: 1', 'brief: /r/briefs/da.md', 'env: none', `target: docs/a.md@${H1}`, `target: docs/b.md@${H2}`, 'writes: none', '', 'Read your brief at /r/briefs/da.md.'].join('\n');
  const spawned = spawnSync(process.execPath, [SPAWN], { input: JSON.stringify({ session_id: 'sess-1', cwd: w.repo, tool_name: 'Agent', tool_use_id: 'toolu_1', tool_input: { subagent_type: TYPE, prompt, description: 'd' } }), encoding: 'utf8', env });
  assert.equal(spawned.status, 0, spawned.stderr);
  const started = spawnSync(process.execPath, [INJECT], { input: JSON.stringify({ session_id: 'sess-1', cwd: w.repo, agent_id: 'agent-7', agent_type: TYPE }), encoding: 'utf8', env });
  assert.equal(started.status, 0, started.stderr);
  allowed(fire(w));
  const [line] = index(w);
  assert.deepEqual(line.targets, [{ path: 'docs/a.md', sha256: H1 }, { path: 'docs/b.md', sha256: H2 }]);
  assert.equal(line.agent_id, 'agent-7');
  assert.equal(line.task, 'D-1');
});

test('fires: hook input missing, unreadable or not JSON is denied', () => {
  const w = world();
  for (const raw of ['', 'not json', '[1]', 'null', '"x"']) denied(fire(w, { raw }));
  assert.deepEqual(captured(w), []);
  assert.equal(observed(w).length, 5);
  assert.ok(observed(w).every((l) => l.decision === 'deny'));
});

test('a tool other than SubagentHandback and an agent type outside cdp6-core: get no decision and no line', () => {
  const w = world();
  allowed(fire(w, { tool: 'Bash' }));
  allowed(fire(w, { tool: 'Agent' }));
  for (const type of ['cdp5-agents:impl-uc', 'general-purpose', '', 'cdp6-corex:impl']) allowed(fire(w, { type, message: 'no acknowledgement' }));
  allowed(fire(w, { raw: JSON.stringify({ tool_name: 'SubagentHandback', tool_input: { message: 'x' } }) }));
  assert.deepEqual(observed(w), []);
  assert.deepEqual(captured(w), []);
});

test('fires: agent_id missing is denied every time', () => {
  const w = world();
  for (let i = 0; i < 3; i++) denied(fire(w, { agentId: null }), /agent_id/);
  denied(fire(w, { agentId: '' }), /agent_id/);
  assert.deepEqual(captured(w), []);
  assert.equal(existsSync(join(w.data, 'handback-asked')), false);
});

test('fires: no bound spawn for the agent id is denied once, then neither denied nor captured', () => {
  const w = world({ bind: false });
  denied(fire(w), /spawn/);
  allowed(fire(w));
  assert.deepEqual(captured(w), []);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null]]);
  const other = world({ bind: null });
  denied(fire(other), /spawn/);
});

test('fires: a spawn whose header is invalid is denied once, then neither denied nor captured', () => {
  const w = world({ spawn: { header: 'invalid', task: null, role: null, targets: [] } });
  denied(fire(w), /header/);
  allowed(fire(w));
  assert.deepEqual(captured(w), []);
  assert.deepEqual(index(w), []);
});

test('fires: a task with characters outside [A-Za-z0-9._-] is treated like an invalid header', () => {
  for (const task of ['../evil', 'a b', 'x/y']) {
    const w = world({ spawn: { task } });
    const message = msg({ second: `run: ${RUN} task: ${task.includes(' ') ? 'a' : task}` });
    denied(fire(w, { message }), /header|task/);
    allowed(fire(w, { message }));
    assert.deepEqual(captured(w), [], task);
    assert.equal(existsSync(join(w.S, 'verdicts')), false, task);
  }
});

test('the first failure of one agent id does not excuse another agent id', () => {
  const w = world();
  const bad = msg({ ack: 'nope' });
  denied(fire(w, { message: bad }));
  denied(fire(w, { message: bad, agentId: 'agent-8' }));
  allowed(fire(w, { message: bad }));
  allowed(fire(w, { message: bad, agentId: 'agent-8' }));
});

test('a later handback of the same agent id that passes is captured', () => {
  const w = world();
  denied(fire(w, { message: msg({ ack: 'nope' }) }));
  allowed(fire(w));
  assert.deepEqual(captured(w), ['D-1-devils-advocate-agent-7.md']);
  assert.deepEqual(observed(w).map((l) => l.decision), ['deny', 'none']);
  assert.equal(observed(w)[1].capture_sha256, index(w)[0].sha256);
});

test('fires: an unreadable or malformed second-attempt marker is treated as a first attempt', () => {
  for (const content of ['not json', '[]', '{"asked":"yes"}', '']) {
    const w = world();
    const file = markerPath(w.data, 'agent-7');
    mkdirSync(dirname(file), { recursive: true });
    writeFileSync(file, content);
    denied(fire(w, { message: msg({ ack: 'nope' }) }));
    allowed(fire(w, { message: msg({ ack: 'nope' }) }));
  }
  const dir = world();
  mkdirSync(markerPath(dir.data, 'agent-7'), { recursive: true });
  denied(fire(dir, { message: msg({ ack: 'nope' }) }));
});

test('no active run: the acknowledgement check only, no capture and no counters.json access', () => {
  const w = world({ run: false });
  allowed(fire(w, { message: `cdp6-contract: v1 ${HASH}\nanything` }));
  denied(fire(w, { message: 'no ack', agentId: 'agent-9' }), /cdp6-contract/);
  allowed(fire(w, { message: 'no ack', agentId: 'agent-9' }));
  assert.equal(existsSync(join(w.S, 'counters.json')), false);
  assert.equal(existsSync(join(w.S, 'verdicts')), false);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['none', null], ['deny', null], ['none', null]]);
});

test('no data directory: no decision for a failed acknowledgement, an unverifiable contract still denies', () => {
  const w = world({ run: false });
  allowed(fire(w, { data: null, message: `cdp6-contract: v1 ${HASH}\nanything` }));
  allowed(fire(w, { data: null, message: 'no ack' }));
  allowed(fire(w, { data: null, message: 'no ack' }));
  allowed(fire(w, { data: 'relative/dir', message: 'no ack' }));
  denied(fire(w, { data: null, root: brokenRoot(w, 'corrupt') }), /contract/);
  denied(fire(w, { data: 'relative/dir', root: brokenRoot(w, 'corrupt') }), /contract/);
  assert.equal(existsSync(w.data), false);
});

function deniedOnce(w, needle, over = {}) {
  denied(fire(w, over), needle);
  allowed(fire(w, over));
  allowed(fire(w, over));
  assert.deepEqual(captured(w), []);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null], ['none', null]]);
}

test('fires: an unreadable run record is denied once, then neither denied nor captured', () => {
  const w = world();
  writeFileSync(join(w.S, 'run.json'), '{ "run_id": ');
  deniedOnce(w, /run/);
  assert.deepEqual(captured(w), []);
});

test('fires: counters.json missing or malformed is denied once, then neither denied nor captured', () => {
  const missing = world();
  rmSync(join(missing.S, 'counters.json'));
  deniedOnce(missing, /counters/);
  const bad = world();
  writeFileSync(join(bad.S, 'counters.json'), '{ "version": ');
  deniedOnce(bad, /counters/);
  assert.deepEqual(captured(bad), []);
});

test('fires: a malformed index refuses the capture, denies once and leaves the index as it was', () => {
  const w = world();
  mkdirSync(join(w.S, 'verdicts'));
  writeFileSync(join(w.S, 'verdicts', 'index.jsonl'), '{"a":1}\nnot json\n');
  deniedOnce(w, /index/);
  assert.equal(readFileSync(join(w.S, 'verdicts', 'index.jsonl'), 'utf8'), '{"a":1}\nnot json\n');
  assert.deepEqual(captured(w), []);
  assert.equal(pending(w).toolu_1.closed_at, undefined);
});

test('fires: a capture file of the same name refuses the capture, denies once and is not overwritten', () => {
  const w = world();
  mkdirSync(join(w.S, 'verdicts'));
  writeFileSync(join(w.S, 'verdicts', 'D-1-devils-advocate-agent-7.md'), 'earlier text');
  denied(fire(w), /exists|capture/);
  allowed(fire(w));
  allowed(fire(w));
  assert.equal(readFileSync(join(w.S, 'verdicts', 'D-1-devils-advocate-agent-7.md'), 'utf8'), 'earlier text');
  assert.deepEqual(index(w), []);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null], ['none', null]]);
});

test('fires: a busy lock on counters.json denies once with the reason and writes nothing', () => {
  const w = world();
  writeFileSync(join(w.S, 'counters.lock'), '{}');
  deniedOnce(w, /lock/);
  assert.deepEqual(captured(w), []);
  assert.deepEqual(index(w), []);
  assert.equal(existsSync(join(w.S, 'verdicts')), false);
});

test('fires: a busy lock on the verdict index denies once with the reason and writes nothing', () => {
  const w = world();
  writeFileSync(join(w.S, 'verdicts.lock'), '{}');
  deniedOnce(w, /lock/);
  assert.deepEqual(captured(w), []);
  assert.equal(pending(w).toolu_1.closed_at, undefined);
});

test('fires: a capture write that fails leaves no capture file, denies once and keeps the spawn open', () => {
  const w = world();
  mkdirSync(join(w.S, 'verdicts'));
  writeFileSync(join(w.S, 'verdicts', 'index.jsonl'), '');
  chmodSync(join(w.S, 'verdicts', 'index.jsonl'), 0o400);
  denied(fire(w), /could not be captured/);
  allowed(fire(w));
  assert.deepEqual(captured(w), []);
  assert.equal(pending(w).toolu_1.closed_at, undefined);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['deny', null], ['none', null]]);
});

test('a retry of a captured handback with the same message gets no decision and no second capture', () => {
  const w = world();
  const message = msg();
  allowed(fire(w, { message }));
  const first = index(w)[0];
  allowed(fire(w, { message }));
  allowed(fire(w, { message }));
  assert.equal(index(w).length, 1);
  assert.deepEqual(captured(w), ['D-1-devils-advocate-agent-7.md']);
  assert.equal(pending(w).toolu_1.capture_sha256, first.sha256);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['none', first.sha256], ['none', first.sha256], ['none', first.sha256]]);
  assert.equal(existsSync(join(w.data, 'handback-asked')), false);
});

test('fires: a handback whose spawn is closed with another message sha256 is denied once, then neither denied nor captured', () => {
  const w = world();
  allowed(fire(w));
  const first = index(w)[0];
  const other = msg({ body: BODY.replace('verdict: a', 'verdict: a-with-conditions') });
  denied(fire(w, { message: other }), /capture|exists/);
  allowed(fire(w, { message: other }));
  assert.equal(index(w).length, 1);
  assert.equal(index(w)[0].sha256, first.sha256);
  assert.deepEqual(observed(w).map((l) => [l.decision, l.capture_sha256]), [['none', first.sha256], ['deny', null], ['none', null]]);
});

test('the deny reason names no path and no internal error text', () => {
  const w = world();
  const res = fire(w, { message: msg({ ack: 'nope' }) });
  assert.doesNotMatch(res.stderr, new RegExp(w.base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  assert.doesNotMatch(res.stderr, /at .*\.mjs:\d+/);
});

test('fires: each refusal cause has its own deny reason, spawn-closed, spawn-unknown and lock-error included', () => {
  const reasons = new Map();
  for (const [E, code] of [[CountersError, 'lock-busy'], [CountersError, 'lock-error'], [CountersError, 'spawn-closed'], [CountersError, 'spawn-unknown'], [CountersError, 'counters-malformed'], [CaptureError, 'lock-busy'], [CaptureError, 'lock-error'], [CaptureError, 'index-unreadable'], [CaptureError, 'capture-exists'], [CaptureError, 'capture-failed'], [CaptureError, 'name-unsafe']]) {
    reasons.set(`${E.name}:${code}`, reasonOf(new E(code, 'internal text')));
  }
  assert.equal(new Set(reasons.values()).size, reasons.size, JSON.stringify([...reasons]));
  assert.match(reasons.get('CountersError:spawn-closed'), /already closed/);
  assert.match(reasons.get('CountersError:spawn-unknown'), /no pending spawn/);
  assert.match(reasons.get('CountersError:lock-error'), /lock file of counters\.json/);
  assert.match(reasons.get('CaptureError:lock-error'), /lock file of the verdict index/);
  for (const reason of reasons.values()) assert.doesNotMatch(reason, /internal text/);
});

test('fires: a lock file that cannot be created denies once with the lock-file reason, not the index reason', () => {
  const w = world();
  chmodSync(w.S, 0o500);
  try {
    denied(fire(w), /lock file/);
  } finally {
    chmodSync(w.S, 0o700);
  }
  assert.deepEqual(captured(w), []);
});

test('fires: a form failure after an acknowledgement failure is still denied once, so the role can restate', () => {
  const w = world();
  denied(fire(w, { message: msg({ ack: 'no ack' }) }));
  const res = fire(w, { message: msg({ body: BODY.replace('premises: none, no existing code or data touched\n', '') }) });
  denied(res, /capture form fails/);
});

test('fires: the deny-once marker keeps the capture-form deny apart from every other cause, one deny each and then the capture', () => {
  const bad = msg({ body: BODY.replace('premises: none, no existing code or data touched\n', '') });
  const w = world();
  denied(fire(w, { message: bad }), /capture form fails/);
  denied(fire(w, { message: msg({ ack: 'no ack' }) }), /cdp6-contract/);
  allowed(fire(w, { message: msg({ ack: 'no ack' }) }));
  allowed(fire(w, { message: bad }));
  assert.deepEqual(captured(w), ['D-1-devils-advocate-agent-7.md']);
  assert.equal(index(w)[0].validator, 'rejected');
  assert.deepEqual(observed(w).map((l) => l.decision), ['deny', 'deny', 'none', 'none']);
  const marker = JSON.parse(readFileSync(markerPath(w.data, 'agent-7'), 'utf8'));
  assert.deepEqual(Object.keys(marker).sort(), ['form', 'other']);
  assert.equal(marker.form.asked, true);
  assert.equal(marker.other.asked, true);
  const v = world();
  denied(fire(v, { message: msg({ ack: 'no ack' }) }));
  denied(fire(v, { message: bad }), /capture form fails/);
  allowed(fire(v, { message: bad }));
  assert.equal(index(v)[0].validator, 'rejected');
});
