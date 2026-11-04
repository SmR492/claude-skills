import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ensureHostKey, hostKeyPath, readHostKey, verifyToken } from '../lib/hook-key.mjs';
import { parseCall, stripAppended, tokenize } from '../lib/run-argv.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const GUARD = join(HERE, 'guard-shell.mjs');
const PLUGIN = dirname(HERE);
const RUNJS = join(PLUGIN, 'scripts', 'run.mjs');

function world() {
  const base = tempDir('cdp6-guard-');
  const w = { base, home: join(base, 'home'), data: join(base, 'data'), work: join(base, 'work'), bin: join(base, 'bin') };
  mkdirSync(w.work, { recursive: true });
  mkdirSync(w.bin);
  setVersion(w, VERSION);
  ensureHostKey({ HOME: w.home });
  return w;
}

const VERSION = '2.1.314';

function setVersion(w, version) {
  const file = join(w.bin, 'claude');
  writeFileSync(file, version === null ? '#!/bin/sh\nexit 1\n' : `#!/bin/sh\necho "${version} (Claude Code)"\n`);
  chmodSync(file, 0o755);
}

function record(w, modes, { version = VERSION, accepted = true } = {}) {
  mkdirSync(join(w.data, 'probes'), { recursive: true });
  const rows = { 'A-5': { passed: true, modes: Object.fromEntries(Object.entries(modes).map(([mode, prompt]) => [mode, { prompt }])) } };
  const doc = { claude_version: version, rows };
  if (accepted) doc.accepted = { sha256: 'a'.repeat(64) };
  writeFileSync(join(w.data, 'probes', `${version}.json`), JSON.stringify(doc));
}

function fire(w, command, over = {}) {
  const { tool = 'Bash', mode = 'default', toolUseId, agent, session = 'sess-1', cwd = w.work, root = PLUGIN, dataEnv = w.data } = over;
  const input = { session_id: session, cwd, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command, description: 'd' }, permission_mode: mode };
  if (toolUseId) input.tool_use_id = toolUseId;
  if (mode === null) delete input.permission_mode;
  if (agent) {
    input.agent_id = agent;
    input.agent_type = 'cdp6-core:impl-uc';
  }
  const env = { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home, CLAUDE_PLUGIN_ROOT: root };
  if (dataEnv !== null) env.CLAUDE_PLUGIN_DATA = dataEnv;
  const r = spawnSync(process.execPath, [GUARD], { input: JSON.stringify(input), encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { out, stderr: r.stderr };
}

const run = (args) => `node ${RUNJS} ${args}`;

function bind(w, mode, { session = 'sess-1', truncate = false } = {}) {
  const runId = 'RUN-20261102-bound';
  const S = join(w.data, 'runs', runId);
  mkdirSync(S, { recursive: true });
  const doc = JSON.stringify({ run_id: runId, status: 'active', mode, root: w.work, run_dir: join(w.work, 'docs', 'cdp6', 'runs', runId), journal_offset: 0, phases: {} });
  writeFileSync(join(S, 'run.json'), truncate ? doc.slice(0, 20) : doc);
  writeFileSync(join(w.data, 'active-runs.json'), JSON.stringify({ sessions: { [session]: { run_id: runId, project_root: w.work } }, projects: { [w.work]: runId } }));
  return S;
}

function denied(res) {
  assert.ok(res.out, 'the hook returned no decision');
  assert.equal(res.out.permissionDecision, 'deny', res.out.permissionDecisionReason);
  assert.ok(res.out.permissionDecisionReason.length > 0);
}

function appended(res) {
  const tokens = tokenize(res.out.updatedInput.command).map((t) => t.text);
  assert.equal(tokens[0], 'node');
  assert.equal(tokens[1], RUNJS);
  return tokens.slice(2);
}

function flagValue(argv, flag) {
  const i = argv.indexOf(flag);
  return i === -1 ? undefined : argv[i + 1];
}

test('fires: autonomy ask', () => {
  const w = world();
  const res = fire(w, run('set-autonomy A1 --tokens 1000 --loops 2'));
  assert.equal(res.out.permissionDecision, 'ask');
  assert.match(res.out.permissionDecisionReason, /set-autonomy A1 --tokens 1000 --loops 2/);
  const argv = appended(res);
  assert.equal(flagValue(argv, '--session-id'), 'sess-1');
  assert.equal(flagValue(argv, '--data-dir'), w.data);
});

test('fires: forged owner decider', () => {
  const w = world();
  const cmd = run('decision D-1 decided --decider owner');
  assert.equal(fire(w, cmd).out.permissionDecision, 'ask');
  denied(fire(w, cmd, { mode: 'plan' }));
  denied(fire(w, cmd, { mode: 'dontAsk' }));
  denied(fire(w, cmd, { mode: null }));
  denied(fire(w, cmd, { agent: 'a-1' }));
  bind(w, 'multi');
  const own = fire(w, run('decision D-1 decided --decider orchestrator'));
  assert.equal(own.out.permissionDecision, 'ask');
  assert.equal(own.out.permissionDecisionReason, 'run.mjs decision D-1 decided --decider orchestrator');
});

test('fires: decision decided by a role other than the executor of the run mode', () => {
  const w = world();
  const ownerReason = (decider) => `owner command: decision D-1 decided --decider ${decider}`;
  const routineReason = (decider) => `run.mjs decision D-1 decided --decider ${decider}`;
  const decideAs = (decider) => fire(w, run(`decision D-1 decided --decider ${decider}`)).out;
  bind(w, 'single');
  assert.deepEqual([decideAs('orchestrator').permissionDecision, decideAs('orchestrator').permissionDecisionReason], ['ask', ownerReason('orchestrator')]);
  assert.equal(decideAs('operator').permissionDecisionReason, routineReason('operator'));
  bind(w, 'multi');
  assert.equal(decideAs('orchestrator').permissionDecisionReason, routineReason('orchestrator'));
  assert.equal(decideAs('operator').permissionDecisionReason, ownerReason('operator'));
});

test('fires: decision decided without a readable bound run is an owner form', () => {
  const w = world();
  const cmd = run('decision D-1 decided --decider orchestrator');
  assert.equal(fire(w, cmd).out.permissionDecisionReason, 'owner command: decision D-1 decided --decider orchestrator');
  bind(w, 'multi', { truncate: true });
  assert.equal(fire(w, cmd).out.permissionDecisionReason, 'owner command: decision D-1 decided --decider orchestrator');
});

test('fires: forged session binding', () => {
  const w = world();
  denied(fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single --session-id x')));
  denied(fire(w, run('status --data-dir /elsewhere')));
  const ok = fire(w, run('status'), { session: 'sess-real' });
  assert.equal(flagValue(appended(ok), '--session-id'), 'sess-real');
  assert.equal(appended(ok).filter((t) => t === '--session-id').length, 1);
});

test('fires: --session-id=x form', () => {
  const w = world();
  denied(fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single --session-id=x')));
  denied(fire(w, run('status --data-dir=/elsewhere')));
  denied(fire(w, run('status --hook-token=abc')));
});

test('fires: init without run gets no session id', () => {
  const w = world();
  const res = fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single'), { session: 'sess-new' });
  assert.equal(res.out.permissionDecision, 'ask');
  const argv = appended(res);
  assert.equal(flagValue(argv, '--session-id'), 'sess-new');
  assert.equal(flagValue(argv, '--data-dir'), w.data);
  assert.ok(flagValue(argv, '--hook-token'));
  assert.ok(res.out.updatedInput.description === 'd');
});

test('fires: standalone init without run gets no ask', () => {
  const w = world();
  writeFileSync(join(w.work, 'a.md'), 'imported\n');
  const sha = createHash('sha256').update('imported\n').digest('hex');
  const res = fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single --start concept --import a.md'));
  assert.equal(res.out.permissionDecision, 'ask');
  assert.ok(res.out.permissionDecisionReason.includes('a.md'), res.out.permissionDecisionReason);
  assert.ok(res.out.permissionDecisionReason.includes(sha), res.out.permissionDecisionReason);
  const argv = appended(res);
  assert.equal(flagValue(argv, '--expect-sha256'), sha);
  const plain = fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single'));
  assert.doesNotMatch(plain.out.permissionDecisionReason, /owner command/);
  assert.match(res.out.permissionDecisionReason, /owner command/);
});

test('fires: forged data dir', () => {
  const w = world();
  denied(fire(w, run('status --data-dir /forged')));
  const ok = fire(w, run('status'));
  assert.equal(flagValue(appended(ok), '--data-dir'), w.data);
  denied(fire(w, run('status'), { dataEnv: null }));
  denied(fire(w, run('status'), { dataEnv: 'relative/dir' }));
});

test('fires: approve from foreign cwd', () => {
  const w = world();
  const foreign = join(w.base, 'foreign', 'nested');
  mkdirSync(foreign, { recursive: true });
  bind(w, 'multi');
  const res = fire(w, run('approve refinement'), { cwd: foreign });
  assert.equal(res.out.permissionDecision, 'ask');
  assert.equal(flagValue(appended(res), '--session-id'), 'sess-1');
});

test('fires: approve under bypass mode', () => {
  const w = world();
  record(w, { default: true, acceptEdits: false, auto: true, bypassPermissions: true });
  const cmd = run('approve refinement');
  for (const mode of ['default', 'auto']) assert.equal(fire(w, cmd, { mode }).out.permissionDecision, 'ask', mode);
  const accept = fire(w, cmd, { mode: 'acceptEdits' });
  denied(accept);
  assert.match(accept.out.permissionDecisionReason, /acceptEdits/);
  for (const mode of ['bypassPermissions', 'plan', 'dontAsk', 'unknownMode', null]) denied(fire(w, cmd, { mode }));
});

test('fires: owner command in a mode other than default without an accepted record for the running version', () => {
  const w = world();
  const cmd = run('approve refinement');
  denied(fire(w, cmd, { mode: 'auto' }));
  denied(fire(w, cmd, { mode: 'acceptEdits' }));
  assert.equal(fire(w, cmd, { mode: 'default' }).out.permissionDecision, 'ask');
  record(w, { auto: true }, { version: '2.1.999' });
  denied(fire(w, cmd, { mode: 'auto' }));
  record(w, { auto: true }, { accepted: false });
  denied(fire(w, cmd, { mode: 'auto' }));
  record(w, { auto: true });
  assert.equal(fire(w, cmd, { mode: 'auto' }).out.permissionDecision, 'ask');
  setVersion(w, null);
  denied(fire(w, cmd, { mode: 'auto' }));
  assert.equal(fire(w, cmd, { mode: 'default' }).out.permissionDecision, 'ask');
});

test('fires: routine run.mjs call needs no probe record in any listed mode', () => {
  const w = world();
  for (const mode of ['default', 'acceptEdits', 'auto']) assert.equal(fire(w, run('status'), { mode }).out.permissionDecision, 'ask', mode);
});

test('fires: approve from teammate', () => {
  const w = world();
  denied(fire(w, run('approve refinement'), { agent: 'agent-7' }));
});

test('fires: compound owner command', () => {
  const w = world();
  denied(fire(w, run('veto exit:concept --why x; echo ok')));
  const res = fire(w, run('veto exit:concept --why "x"'));
  assert.equal(res.out.permissionDecision, 'ask');
  assert.equal(res.out.permissionDecisionReason, 'owner command: veto exit:concept --why x');
});

test('fires: objection from agent', () => {
  const w = world();
  const cmd = run('object F-P3-2 accept --why x');
  assert.equal(fire(w, cmd).out.permissionDecision, 'ask');
  denied(fire(w, cmd, { agent: 'agent-7' }));
});

test('fires: objection on a premise id from agent', () => {
  const w = world();
  const cmd = run('object D-1-devils-advocate-agent-7:premise-1 accept --why x');
  assert.equal(fire(w, cmd).out.permissionDecision, 'ask');
  assert.match(fire(w, cmd).out.permissionDecisionReason, /owner command: object D-1-devils-advocate-agent-7:premise-1/);
  denied(fire(w, cmd, { agent: 'agent-7' }));
});

test('fires: --decider=owner gets allow', () => {
  const w = world();
  denied(fire(w, run('decision D-1 decided --decider=owner')));
});

test('fires: init --mode=team without ask', () => {
  const w = world();
  denied(fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode=team')));
  const res = fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode team'));
  assert.equal(res.out.permissionDecision, 'ask');
  assert.match(res.out.permissionDecisionReason, /owner command/);
});

test("fires: quoted subcommand gr''ant", () => {
  const w = world();
  denied(fire(w, run("gr''ant --agent x")));
  denied(fire(w, run("'status'")));
  denied(fire(w, run('grant --agent x')));
});

test('fires: unknown subcommand gets allow', () => {
  const w = world();
  denied(fire(w, run('frobnicate')));
  denied(fire(w, run('status --bogus 1')));
});

test('fires: owner flag form without ask', () => {
  const w = world();
  const res = fire(w, run('rule x --why y --human'));
  assert.equal(res.out.permissionDecision, 'ask');
  assert.match(res.out.permissionDecisionReason, /owner command/);
  const routine = fire(w, run('rule x --why y'));
  assert.equal(routine.out.permissionDecision, 'ask');
  assert.doesNotMatch(routine.out.permissionDecisionReason, /owner command/);
});

test('fires: allow for compound run.mjs call', () => {
  const w = world();
  const ok = fire(w, run('enter idea'));
  assert.equal(ok.out.permissionDecision, 'ask');
  assert.equal(flagValue(appended(ok), '--session-id'), 'sess-1');
  assert.equal(flagValue(appended(ok), '--data-dir'), w.data);
  assert.ok(flagValue(appended(ok), '--hook-token'));
  denied(fire(w, run('enter idea'), { agent: 'agent-7' }));
  denied(fire(w, run('enter idea; echo x')));
  denied(fire(w, run('enter idea && echo x')));
  denied(fire(w, run('enter idea | cat')));
  denied(fire(w, run('enter idea $(id)')));
  denied(fire(w, `${run('enter idea')} > out.txt`));
  assert.notEqual(ok.out.permissionDecision, 'allow');
});

test('fires: brace-expanded --human gets routine decision', () => {
  const w = world();
  denied(fire(w, run('rule {--human,x} --why y')));
});

test('fires: double-quoted expansion in run.mjs value', () => {
  const w = world();
  denied(fire(w, run('rule x --why "$(id)"')));
  denied(fire(w, run('rule x --why "`id`"')));
  denied(fire(w, run('rule x --why "$HOME"')));
  assert.equal(fire(w, run("rule x --why 'a $b'")).out.permissionDecision, 'ask');
});

test('fires: own argv hash token', () => {
  const w = world();
  denied(fire(w, run('status --argv-sha256 abc')));
  denied(fire(w, run('status --hook-token abc.1.def')));
  denied(fire(w, run('status --expect-sha256 abc')));
});

test('fires: Monitor run.mjs owner flag with forged tokens', () => {
  const w = world();
  denied(fire(w, run('rule --human x --why y --session-id S --data-dir D --argv-sha256 H'), { tool: 'Monitor' }));
  const ok = fire(w, run('status'), { tool: 'Monitor' });
  assert.equal(ok.out.permissionDecision, 'ask');
  assert.ok(flagValue(appended(ok), '--hook-token'));
  const ps = fire(w, run('status'), { tool: 'PowerShell' });
  assert.equal(ps.out.permissionDecision, 'ask');
});

test('fires: env prefix before run.mjs', () => {
  const w = world();
  denied(fire(w, `FOO=1 ${run('status')}`));
  denied(fire(w, `NODE_OPTIONS=--require=./x.cjs ${run('status')}`));
});

test('fires: wrapper before run.mjs', () => {
  const w = world();
  denied(fire(w, `timeout 5 ${run('status')}`));
  for (const interpreter of ['bash', 'sh', 'nodejs', 'python3']) denied(fire(w, `${interpreter} ${RUNJS} status`));
});

test('fires: node option before script path', () => {
  const w = world();
  denied(fire(w, `node --require ./x.cjs ${RUNJS} status`));
  denied(fire(w, `node --inspect ${RUNJS} status`));
});

test('fires: relative script path', () => {
  const w = world();
  denied(fire(w, 'node scripts/run.mjs status', { cwd: PLUGIN }));
  denied(fire(w, 'node ./scripts/run.mjs status', { cwd: PLUGIN }));
  denied(fire(w, `node ${RUNJS}x status`));
});

test('fires: newline-separated second run.mjs call', () => {
  const w = world();
  denied(fire(w, `${run('status')}\n${run('rule --human x --why y')}`));
  denied(fire(w, `${run('status')}\r\n${run('status')}`));
  denied(fire(w, `${run('status')}\t`));
});

test('fires: stripped wrapper before run.mjs', () => {
  const w = world();
  for (const wrapper of ['timeout', 'time', 'nice', 'nohup', 'stdbuf', 'command', 'builtin', 'noglob', 'env', 'exec']) {
    const res = fire(w, `${wrapper} ${run('status')}`);
    assert.ok(res.out, wrapper);
    assert.equal(res.out.permissionDecision, 'deny', wrapper);
  }
  assert.equal(fire(w, `timeout 5 ${run('status')}`).out.permissionDecision, 'deny');
});

test('fires: run.mjs allowed without key', () => {
  const w = world();
  rmSync(hostKeyPath({ HOME: w.home }));
  for (const cmd of [run('status'), run('approve refinement')]) {
    const res = fire(w, cmd);
    denied(res);
    assert.match(res.out.permissionDecisionReason, /host key/);
  }
});

test('the appended hook token verifies over the parsed tokens, the session, the data dir and the hashes', () => {
  const w = world();
  writeFileSync(join(w.work, 'a.md'), 'imported\n');
  const res = fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single --start concept --import a.md'));
  const argv = appended(res);
  const { bare, expect } = stripAppended(argv);
  parseCall(argv);
  const fields = { sessionId: 'sess-1', dataDir: w.data, tokens: bare, expect };
  const key = readHostKey({ HOME: w.home });
  assert.equal(verifyToken(key, flagValue(argv, '--hook-token'), fields).ok, true);
  assert.equal(verifyToken(key, flagValue(argv, '--hook-token'), { ...fields, expect: [] }).ok, undefined);
});

test('a command that does not name run.mjs or a token flag gets no decision, and other tools are ignored', () => {
  const w = world();
  assert.equal(fire(w, 'ls -la').out, null);
  assert.equal(fire(w, 'git status', { tool: 'Monitor' }).out, null);
  assert.equal(fire(w, run('status'), { tool: 'Read' }).out, null);
  denied(fire(w, 'grep run.mjs notes.md'));
  denied(fire(w, 'echo --hook-token'));
});

test('records hooks observed', () => {
  const w = world();
  const version = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8')).version;
  fire(w, 'ls -la', { toolUseId: 'toolu_1' });
  fire(w, run('status'), { toolUseId: 'toolu_2', mode: 'acceptEdits' });
  fire(w, run('status --data-dir /elsewhere'), { toolUseId: 'toolu_3' });
  const lines = readFileSync(join(w.data, 'hooks-fired.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => ({ ...l, at: typeof l.at })), [
    { hook: 'guard-shell.mjs', version, at: 'string', session_id: 'sess-1', tool_use_id: 'toolu_1', permission_mode: 'default', decision: 'none', agent_id: null, capture_sha256: null },
    { hook: 'guard-shell.mjs', version, at: 'string', session_id: 'sess-1', tool_use_id: 'toolu_2', permission_mode: 'acceptEdits', decision: 'ask', agent_id: null, capture_sha256: null },
    { hook: 'guard-shell.mjs', version, at: 'string', session_id: 'sess-1', tool_use_id: 'toolu_3', permission_mode: 'default', decision: 'deny', agent_id: null, capture_sha256: null },
  ]);
});

test('fires: PowerShell curly quote ends a quoted run.mjs value', () => {
  const w = world();
  denied(fire(w, run(`decision D-1 proposed --decider 'x’; Write-Output ‘y'`), { tool: 'PowerShell' }));
  denied(fire(w, run(`decision D-1 proposed --decider "x”; Write-Output “y"`), { tool: 'PowerShell' }));
});

test('fires: guard-shell started through a symlinked plugin root stays silent', () => {
  const w = world();
  const link = join(w.base, 'plugin-link');
  symlinkSync(PLUGIN, link);
  const input = { session_id: 'sess-1', cwd: w.work, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node ${link}/scripts/run.mjs approve idea` }, permission_mode: 'default' };
  const r = spawnSync(process.execPath, [join(link, 'hooks', 'guard-shell.mjs')], { input: JSON.stringify(input), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: link, CLAUDE_PLUGIN_DATA: w.data } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim(), 'guard-shell.mjs produced no decision');
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});

test('fires: a failing hooks observed write leaves the decision of guard-shell unchanged', () => {
  const w = world();
  const cmd = run('approve refinement');
  const plain = fire(w, cmd).out;
  const bad = fire(w, run('status --data-dir /elsewhere')).out;
  const none = fire(w, 'ls -la').out;
  mkdirSync(w.data, { recursive: true });
  rmSync(join(w.data, 'hooks-fired.jsonl'));
  mkdirSync(join(w.data, 'hooks-fired.jsonl'));
  const blocked = fire(w, cmd).out;
  assert.equal(blocked.permissionDecision, 'ask');
  assert.equal(blocked.permissionDecisionReason, plain.permissionDecisionReason);
  assert.equal(tokenize(blocked.updatedInput.command).length, tokenize(plain.updatedInput.command).length);
  assert.equal(fire(w, run('status --data-dir /elsewhere')).out.permissionDecisionReason, bad.permissionDecisionReason);
  assert.equal(fire(w, 'ls -la').out, none);
});

test('fires: an --import that is a symbolic link is not hashed through the link', () => {
  const w = world();
  writeFileSync(join(w.work, 'real.md'), 'imported\n');
  symlinkSync(join(w.work, 'real.md'), join(w.work, 'a.md'));
  const res = fire(w, run('init --intake i.txt --kind idea --origin conversation --class own --mode single --start concept --import a.md'));
  assert.equal(flagValue(appended(res), '--expect-sha256'), undefined);
  assert.ok(!res.out.permissionDecisionReason.includes('sha256'), res.out.permissionDecisionReason);
});
