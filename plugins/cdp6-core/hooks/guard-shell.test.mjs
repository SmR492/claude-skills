import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ensureHostKey, hostKeyPath, readHostKey, verifyToken } from '../lib/hook-key.mjs';
import { parseCall, stripAppended, tokenize } from '../lib/run-argv.mjs';
import { AGENT, PLUGIN_VERSION, SETTINGS_SHA, acceptedRecord, goodRows, markdown, stubClaude } from '../test-support/probe-fixture.mjs';
import { npmHost, orphaned, underClaude } from '../test-support/claude-host.mjs';
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

function record(w, modes, { version = VERSION } = {}) {
  const base = { claude_version: version, settings_sha256: SETTINGS_SHA, agent_id: '', cdp6_version: '' };
  const rows = [
    ...Object.entries(modes).map(([mode, prompt]) => ({ ...base, row: 'A-5', mode, verdict: prompt ? 'prompt' : 'no-prompt' })),
    ...goodRows(version).filter((r) => r.row === 'A-12'),
    { ...base, row: 'A-23', mode: 'auto', verdict: 'handback', agent_id: AGENT, cdp6_version: PLUGIN_VERSION },
  ];
  const env = { HOME: w.home, PATH: `${w.bin}:${process.env.PATH}` };
  stubClaude(w.bin, version);
  try {
    acceptedRecord({ env, data: w.data, version, rows });
  } finally {
    setVersion(w, VERSION);
  }
}

function handPlaced(w, version = VERSION) {
  mkdirSync(join(w.data, 'probes'), { recursive: true });
  const rows = { 'A-5': { passed: true, modes: { default: { prompt: true }, auto: { prompt: true } } } };
  writeFileSync(join(w.data, 'probes', `${version}.json`), JSON.stringify({ claude_version: version, rows, accepted: { sha256: 'a'.repeat(64) } }));
}

function fire(w, command, over = {}) {
  const { tool = 'Bash', mode = 'default', toolUseId, agent, session = 'sess-1', cwd = w.work, root = PLUGIN, dataEnv = w.data, host = null, bare = false } = over;
  const input = { session_id: session, cwd, hook_event_name: 'PreToolUse', tool_name: tool, tool_input: { command, description: 'd' }, permission_mode: mode };
  if (toolUseId) input.tool_use_id = toolUseId;
  if (mode === null) delete input.permission_mode;
  if (agent) {
    input.agent_id = agent;
    input.agent_type = 'cdp6-core:impl-uc';
  }
  const env = { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home, CLAUDE_PLUGIN_ROOT: root };
  if (dataEnv !== null) env.CLAUDE_PLUGIN_DATA = dataEnv;
  const options = { input: JSON.stringify(input), encoding: 'utf8', env };
  const r = bare ? orphaned(GUARD, options.input, { env }) : host === null ? spawnSync(process.execPath, [GUARD], options) : underClaude(npmHost(w.base, host), GUARD, [], options);
  assert.equal(r.status, 0, r.stderr);
  const out = r.stdout.trim() ? JSON.parse(r.stdout).hookSpecificOutput : null;
  return { out, stderr: r.stderr };
}

const run = (args) => `node ${RUNJS} ${args}`;

function bind(w, mode, { session = 'sess-1', truncate = false, counters = true } = {}) {
  const runId = 'RUN-20261102-bound';
  const S = join(w.data, 'runs', runId);
  mkdirSync(S, { recursive: true });
  const doc = JSON.stringify({ run_id: runId, status: 'active', mode, root: w.work, run_dir: join(w.work, 'docs', 'cdp6', 'runs', runId), journal_offset: 0, phases: {} });
  writeFileSync(join(S, 'run.json'), truncate ? doc.slice(0, 20) : doc);
  if (counters) writeFileSync(join(S, 'counters.json'), JSON.stringify({ version: 1 }));
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
  const res = fire(w, cmd);
  denied(res);
  assert.equal(res.out.permissionDecisionReason, 'run.json of the active run is not readable');
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
  for (const mode of ['default', 'auto']) assert.equal(fire(w, cmd, { mode, host: VERSION }).out.permissionDecision, 'ask', mode);
  const accept = fire(w, cmd, { mode: 'acceptEdits', host: VERSION });
  denied(accept);
  assert.match(accept.out.permissionDecisionReason, /acceptEdits/);
  for (const mode of ['bypassPermissions', 'plan', 'dontAsk', 'unknownMode', null]) denied(fire(w, cmd, { mode, host: VERSION }));
});

test('fires: owner command in a mode other than default without an accepted record for the running version', () => {
  const w = world();
  const cmd = run('approve refinement');
  denied(fire(w, cmd, { mode: 'auto' }));
  denied(fire(w, cmd, { mode: 'acceptEdits' }));
  assert.equal(fire(w, cmd, { mode: 'default' }).out.permissionDecision, 'ask');
  record(w, { auto: true }, { version: '2.1.999' });
  denied(fire(w, cmd, { mode: 'auto' }));
  handPlaced(w);
  denied(fire(w, cmd, { mode: 'auto' }));
  rmSync(join(w.data, 'probes'), { recursive: true });
  record(w, { auto: true });
  assert.equal(fire(w, cmd, { mode: 'auto', host: VERSION }).out.permissionDecision, 'ask');
  setVersion(w, null);
  denied(fire(w, cmd, { mode: 'auto', host: VERSION }));
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

function recordFile(w, rows = goodRows(VERSION), name = 'rec.md') {
  const text = markdown(rows);
  writeFileSync(join(w.work, name), text);
  return createHash('sha256').update(text).digest('hex');
}

test('fires: probe accept without file hash', () => {
  const w = world();
  const hash = recordFile(w);
  const res = fire(w, run('probe --accept rec.md'));
  assert.equal(res.out.permissionDecision, 'ask');
  const argv = appended(res);
  assert.deepEqual(argv.filter((t) => t === '--expect-sha256').length, 1);
  assert.equal(flagValue(argv, '--expect-sha256'), hash);
  assert.match(res.out.permissionDecisionReason, new RegExp(`^owner command: probe --accept rec\\.md; files: rec\\.md sha256 ${hash}`));
  const { bare, expect } = stripAppended(argv);
  assert.deepEqual(expect, [hash]);
  const fields = { sessionId: 'sess-1', dataDir: w.data, tokens: bare, expect };
  assert.equal(verifyToken(readHostKey({ HOME: w.home }), flagValue(argv, '--hook-token'), fields).ok, true);
});

test('fires: accept reason shows hash only', () => {
  const w = world();
  const base = goodRows(VERSION)[0];
  const rows = [...goodRows(VERSION), { ...base, row: 'A-11', mode: 'auto', verdict: 'prompt' }];
  recordFile(w, rows);
  const reason = fire(w, run('probe --accept rec.md')).out.permissionDecisionReason;
  for (const want of ['A-5 default prompt', 'A-5 auto prompt', 'A-12 auto refused', 'A-23 auto handback', 'A-23 default no-handback', 'A-11 auto prompt (left for SL-8)']) {
    assert.ok(reason.includes(want), `${want} missing in: ${reason}`);
  }
  recordFile(w, goodRows(VERSION).map((r) => (r.row === 'A-5' && r.mode === 'auto' ? { ...r, verdict: 'no-prompt' } : r)));
  assert.ok(fire(w, run('probe --accept rec.md')).out.permissionDecisionReason.includes('A-5 auto no-prompt'));
});

test('fires: accept reason marks a row that is neither accepted in stage 1 nor a team row as left for SL-8', () => {
  const w = world();
  const base = goodRows(VERSION)[0];
  recordFile(w, [...goodRows(VERSION), { ...base, row: 'A-19', mode: 'auto', verdict: 'prompt' }]);
  const reason = fire(w, run('probe --accept rec.md')).out.permissionDecisionReason;
  assert.ok(reason.includes('A-19 auto prompt (left for SL-8)'), reason);
  assert.ok(!reason.includes('A-5 auto prompt (left for SL-8)'), reason);
});

test('fires: probe accept from agent', () => {
  const w = world();
  recordFile(w);
  denied(fire(w, run('probe --accept rec.md'), { agent: 'agent-7' }));
});

test('fires: probe accept as a compound command or with its own hash', () => {
  const w = world();
  const hash = recordFile(w);
  denied(fire(w, `${run('probe --accept rec.md')}; echo ok`));
  denied(fire(w, `${run('probe --accept rec.md')} --expect-sha256 ${hash}`));
  denied(fire(w, `${run('probe --accept rec.md')} | cat`));
});

test('fires: probe accept of a file that cannot be hashed, or without --accept', () => {
  const w = world();
  denied(fire(w, run('probe --accept missing.md')));
  denied(fire(w, run('probe')));
  recordFile(w);
  symlinkSync(join(w.work, 'rec.md'), join(w.work, 'link.md'));
  denied(fire(w, run('probe --accept link.md')));
});

test('fires: probe accept in a mode other than default without an accepted record', () => {
  const w = world();
  recordFile(w);
  const cmd = run('probe --accept rec.md');
  denied(fire(w, cmd, { mode: 'auto' }));
  assert.equal(fire(w, cmd, { mode: 'default' }).out.permissionDecision, 'ask');
});

test('fires: hand-placed probe record opens auto', () => {
  const w = world();
  const cmd = run('approve refinement');
  handPlaced(w);
  denied(fire(w, cmd, { mode: 'auto' }));
  denied(fire(w, cmd, { mode: 'acceptEdits' }));
  writeFileSync(join(w.data, 'probes', `${VERSION}.json`), JSON.stringify({ claude_version: VERSION, rows: { 'A-5': { passed: true, modes: { auto: { prompt: true } } } }, accepted: { sha256: 'a'.repeat(64), mac: 'b'.repeat(64) } }));
  denied(fire(w, cmd, { mode: 'auto' }));
  assert.equal(fire(w, cmd, { mode: 'default' }).out.permissionDecision, 'ask');
});

test('fires: a record accepted for the running version admits auto only for a mode its A-5 row shows to prompt', () => {
  const w = world();
  record(w, { default: true, auto: true, acceptEdits: false });
  const cmd = run('approve refinement');
  assert.equal(fire(w, cmd, { mode: 'auto', host: VERSION }).out.permissionDecision, 'ask');
  denied(fire(w, cmd, { mode: 'acceptEdits', host: VERSION }));
  denied(fire(w, cmd, { mode: 'bypassPermissions', host: VERSION }));
});

test('fires: PATH version differs from running version', () => {
  const w = world();
  record(w, { default: true, auto: true }, { version: '2.1.319' });
  setVersion(w, '2.1.319');
  denied(fire(w, run('approve refinement'), { mode: 'auto', host: VERSION }));
  assert.equal(fire(w, run('approve refinement'), { mode: 'auto', host: '2.1.319' }).out.permissionDecision, 'ask');
});

const MODES = ['default', 'acceptEdits', 'auto', 'bypassPermissions', 'plan'];
const TOOLS = ['Bash', 'PowerShell', 'Monitor'];

function stopWorld(over = {}) {
  const w = world();
  const S = bind(w, 'multi');
  const spawn = { tool_use_id: 'toolu_s', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', role: 'devils-advocate', targets: [], header: 'ok', at: '2026-11-06T09:00:00.000Z', agent_id: 'agent-7', bound_at: '2026-11-06T09:00:01.000Z', finished_at: '2026-11-06T09:01:00.000Z', ...over };
  writeFileSync(join(S, 'counters.json'), JSON.stringify({ version: 1, pending: { toolu_s: spawn } }));
  return w;
}

function stopDenied(res) {
  denied(res);
  const reason = res.out.permissionDecisionReason;
  for (const part of ['agent-7', 'devils-advocate', 'D-1', 'finished without a captured verdict', 'end the session', 'void']) assert.ok(reason.includes(part), `${part} missing in: ${reason}`);
}

function stopDeniedEverywhere(command) {
  for (const tool of TOOLS) {
    for (const mode of MODES) stopDenied(fire(stopWorld(), command, { tool, mode }));
  }
}

test('fires: gate run after uncaptured finished agent', () => {
  stopDeniedEverywhere(run('exit idea'));
  stopDeniedEverywhere(run('enter idea'));
  stopDeniedEverywhere(run('id D'));
});

test('fires: owner decision after uncaptured finished agent', () => {
  stopDeniedEverywhere(run('decision D-1 decided --decider owner'));
  stopDeniedEverywhere(run('set-autonomy A1 --tokens 1 --loops 1'));
  stopDeniedEverywhere(run('probe --accept rec.md'));
});

test('fires: approve after uncaptured finished agent', () => {
  stopDeniedEverywhere(run('approve idea'));
});

test('run.mjs status passes after uncaptured finished agent', () => {
  for (const tool of TOOLS) {
    for (const mode of MODES) {
      const res = fire(stopWorld(), run('status'), { tool, mode });
      assert.equal(res.out.permissionDecision, 'ask', res.out.permissionDecisionReason);
      assert.match(res.out.permissionDecisionReason, /^run\.mjs status/);
    }
  }
});

test('fires: a call that names run.mjs without being a run.mjs status call is denied during the stop', () => {
  for (const command of ['cat scripts/run.mjs', 'grep x run.mjs', `${run('status')} | cat`, `${run('status')}; ${run('exit idea')}`, `${run('status')} > out.txt`, `node ${RUNJS}`, 'node run.mjs status']) {
    stopDenied(fire(stopWorld(), command));
  }
});

const WRITES = {
  'fires: redirect during uncaptured stop': 'echo x > f',
  'fires: append redirect during uncaptured stop': 'echo x >> f',
  'fires: tee during uncaptured stop': 'echo x | tee f',
  'fires: cp during uncaptured stop': 'cp a b',
  'fires: mv during uncaptured stop': 'mv a b',
  'fires: ln during uncaptured stop': 'ln -s a b',
  'fires: sed -i during uncaptured stop': 'sed -i s/a/b/ f',
  'fires: rm during uncaptured stop': 'rm f',
  'fires: touch during uncaptured stop': 'touch f',
  'fires: mkdir during uncaptured stop': 'mkdir d',
  'fires: node -e during uncaptured stop': 'node -e x',
  'fires: nested claude during stop': 'claude -p x',
};

for (const [title, command] of Object.entries(WRITES)) {
  test(title, () => {
    stopDeniedEverywhere(command);
    stopDenied(fire(stopWorld(), command, { agent: 'agent-3' }));
  });
}

test('fires: a redirect, a pipe, a chain, a substitution or an assignment around an allowed command is denied during the stop', () => {
  const commands = [
    'cat a > b',
    'cat a >b',
    'ls >> f',
    'cat < f',
    'cat f | sh',
    'cat f | tee g',
    'cat f | xargs rm',
    'ls; touch f',
    'ls && rm f',
    'ls || rm f',
    'ls & rm f',
    'ls\nrm f',
    'ls $(touch f)',
    'ls `touch f`',
    'cat <(touch f)',
    'ls "$(touch f)"',
    'FOO=1 ls',
    '/bin/ls',
    'ls | /bin/sh',
    'env ls',
    'command ls',
    'git push',
    'git commit -m x',
    'git checkout x',
    'git -C d log',
    'git',
    'rg x f',
    'rg --pre sh x f',
    '',
    '   ',
  ];
  for (const command of commands) stopDenied(fire(stopWorld(), command));
});

test('fires: an allowed command with a flag that writes a file or runs a program is denied during the stop', () => {
  const commands = [
    'git diff --output=f',
    'git diff --output f',
    'git log --output=f',
    'git show --output=f HEAD',
    'git diff --ext-diff',
    'git diff --ext-diff HEAD',
    'git log -p --textconv',
    'git show --textconv HEAD',
    'git -c core.pager=x log',
    'git log --config x',
    'git diff --exec x',
    'git diff --ex',
    'git diff --ou=f',
    'git log --o=f',
    'git --exec-path=/x status',
    'grep --config x f',
    'ls --exec x',
    'cat -c f',
    'head --output f',
  ];
  for (const command of commands) stopDenied(fire(stopWorld(), command));
});

const DENIED_IN_STOP = {
  'git status during uncaptured stop': 'git status',
  'git log in a pipe during uncaptured stop': 'git log --oneline | head',
  'date -s during uncaptured stop': 'date -s x',
  'date with a date string during uncaptured stop': 'date -d tomorrow',
  'long option during uncaptured stop': 'ls --all',
  'long option with a value during uncaptured stop': 'grep --filt=x y f',
  'unnamed flag during uncaptured stop': 'ls -S',
  'glob during uncaptured stop': 'cat *.md',
  'background job during uncaptured stop': 'ls &',
  'quote inside double quotes hides a command substitution during uncaptured stop': `cat "'" $(touch p) "'"`,
  'quoted unnamed flag during uncaptured stop': "ls '-S'",
  'quoted abbreviated long option during uncaptured stop': "grep ''--filt=x y f",
  'parameter expansion during uncaptured stop': 'date -u +%s$IFS-d$IFS@0',
  'double-quoted parameter during uncaptured stop': 'cat "$HOME/f"',
  'date with two tokens during uncaptured stop': 'date -u -R',
  'date -I during uncaptured stop': 'date -I',
  'date with a long option during uncaptured stop': 'date --utc',
  'date with an ISO long option during uncaptured stop': 'date --iso-8601=seconds',
  'brace expansion during uncaptured stop': 'cat {a,b}',
  'ansi-c quoting during uncaptured stop': "ls $'-l'",
  'locale quoting during uncaptured stop': 'ls $"-l"',
};

for (const [title, command] of Object.entries(DENIED_IN_STOP)) {
  test(`fires: ${title}`, () => {
    stopDeniedEverywhere(command);
  });
}

test('named flags pass during uncaptured stop', () => {
  const commands = ['ls -la', 'ls -l -a -h -1 -R -t -r', 'cat -n f', 'head -n 5 f', 'tail -n 20 f', 'wc -lwcm f', 'grep -niclvFEwxrH x f', 'sha256sum f', 'cat \'a b\'', 'date -Iseconds', 'date -Is', 'date -u', 'date -R', "date '+%F %T'", 'grep x f | wc -l; ls && pwd || date'];
  for (const command of commands) assert.equal(fire(stopWorld(), command).out, null, command);
  for (const command of ['head -n f', 'head -n', 'head -n5 f', 'head -x 5 f', 'tail -5 f', 'pwd x', 'sha256sum -b f', 'ls -', 'ls --', 'cat -- f', 'wc -x f', 'date +%s -d @0']) stopDenied(fire(stopWorld(), command));
});

test('read-only shell calls pass during uncaptured stop', () => {
  const commands = [
    'ls',
    'ls -la /tmp',
    'cat f',
    'head -n 5 f',
    'tail -n 5 f',
    'wc -l f',
    'grep x f',
    'grep -rn "a|b" f',
    "grep 'a > b' f",
    'sha256sum f',
    'date',
    'date -Is',
    'pwd',
    'date -u',
    'date -R',
    'date +%s',
    "date '+%F'",
    'grep -c x f',
    'wc -c f',
    'grep x f | wc -l',
    'cat f | grep x | wc -l',
    'ls | head -n 3',
  ];
  for (const tool of TOOLS) {
    for (const mode of MODES) {
      for (const command of commands) {
        const res = fire(stopWorld(), command, { tool, mode });
        assert.equal(res.out, null, `${command}: ${res.out?.permissionDecisionReason}`);
      }
    }
  }
});

test('shell write gets its normal decision after the stop is cleared', () => {
  for (const over of [{ closed_at: '2026-11-06T09:05:00.000Z', capture_sha256: 'a'.repeat(64) }, { void: true }]) {
    for (const command of ['echo x > f', 'rm f', 'touch f', 'claude -p x', 'node -e x']) {
      assert.equal(fire(stopWorld(over), command).out, null, command);
    }
    const res = fire(stopWorld(over), run('exit idea'));
    assert.equal(res.out.permissionDecision, 'ask');
    assert.match(res.out.permissionDecisionReason, /^run\.mjs exit idea/);
    assert.equal(fire(stopWorld(over), run('approve idea')).out.permissionDecision, 'ask');
  }
  assert.equal(fire(stopWorld({ finished_at: undefined }), 'rm f').out, null);
});

test('the stop guard needs an active run with a readable counters.json', () => {
  const none = world();
  assert.equal(fire(none, 'rm f').out, null);
  const noCounters = world();
  bind(noCounters, 'multi', { counters: false });
  const missing = fire(noCounters, 'rm f');
  denied(missing);
  assert.match(missing.out.permissionDecisionReason, /stop guard: counters\.json of the active run is missing/);
  const broken = world();
  writeFileSync(join(bind(broken, 'multi'), 'counters.json'), '{ "x": ');
  const res = fire(broken, 'rm f');
  denied(res);
  assert.match(res.out.permissionDecisionReason, /stop guard: counters\.json of the active run is not readable/);
  assert.equal(fire(broken, run('status')).out.permissionDecision, 'ask');
  assert.equal(fire(none, run('exit idea'), { dataEnv: null }).out.permissionDecision, 'deny');
});

test('fires: arithmetic expansion during uncaptured stop', () => {
  for (const tool of ['Bash', 'Monitor']) {
    const res = fire(stopWorld(), "cat 'a[$(touch x)]' ; cat $[_]", { tool });
    assert.equal(res.out?.permissionDecision, 'deny');
    assert.match(res.out.permissionDecisionReason, /agent-7/);
  }
});

test('fires: lookup error fails open', () => {
  const pointer = world();
  bind(pointer, 'multi');
  writeFileSync(join(pointer.data, 'active-runs.json'), '{ "x": ');
  const broken = world();
  bind(broken, 'multi', { truncate: true });
  const absent = world();
  bind(absent, 'multi', { counters: false });
  for (const w of [pointer, broken, absent]) {
    for (const command of ['rm f', run('approve idea'), run('exit idea')]) {
      for (const tool of ['Bash', 'Monitor']) {
        const res = fire(w, command, { tool });
        denied(res);
        assert.doesNotMatch(res.out.permissionDecisionReason, /^run\.mjs /, command);
      }
    }
    assert.equal(fire(w, run('status')).out.permissionDecision, 'ask');
  }
  assert.match(fire(pointer, 'rm f').out.permissionDecisionReason, /active-runs\.json/);
  assert.match(fire(broken, 'rm f').out.permissionDecisionReason, /run\.json of the active run/);
  assert.match(fire(absent, 'rm f').out.permissionDecisionReason, /counters\.json of the active run is missing/);
});

test('fires: comment hides a write during uncaptured stop', () => {
  for (const tool of ['Bash', 'PowerShell', 'Monitor']) {
    const res = fire(stopWorld(), "ls #'\ntouch p\n#'", { tool });
    assert.equal(res.out?.permissionDecision, 'deny');
    assert.match(res.out.permissionDecisionReason, /agent-7/);
  }
});

test('fires: a record for the PATH binary does not admit auto when the running version is not established', () => {
  const w = world();
  record(w, { default: true, auto: true }, { version: '2.1.319' });
  setVersion(w, '2.1.319');
  assert.equal(fire(w, run('approve refinement'), { mode: 'auto', bare: true }).out?.permissionDecision, 'deny');
});

test('fires: accept reason hides the A-12 calibration columns check (a) uses', () => {
  const w = world();
  recordFile(w, goodRows(VERSION));
  const reason = fire(w, run('probe --accept rec.md')).out.permissionDecisionReason;
  for (const want of ['9525', '1196', '9532', '1197']) assert.ok(reason.includes(want), `${want} missing in: ${reason}`);
});

test('fires: dangerouslyDisableSandbox passes the stop allowlist', () => {
  const w = stopWorld();
  const env = { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: w.data };
  const call = (extra) => {
    const input = { session_id: 'sess-1', cwd: w.work, hook_event_name: 'PreToolUse', tool_name: 'Bash', permission_mode: 'auto', tool_input: { command: 'cat /etc/hostname', description: 'd', ...extra } };
    const r = spawnSync(process.execPath, [GUARD], { input: JSON.stringify(input), encoding: 'utf8', env });
    return r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null;
  };
  assert.equal(call({}), null);
  assert.equal(call({ dangerouslyDisableSandbox: true })?.permissionDecision, 'deny');
});


test('fires: accept reason hides the derived per_path and base', () => {
  const w = world();
  recordFile(w, goodRows(VERSION));
  const reason = fire(w, run('probe --accept rec.md')).out.permissionDecisionReason;
  assert.match(reason, /per_path 7/);
  assert.match(reason, /base 1153/);
  recordFile(w, goodRows(VERSION).map((r) => (r.row === 'A-12' && r.counted_paths === '1197' ? { ...r, counted_paths: '1196' } : r)));
  assert.match(fire(w, run('probe --accept rec.md')).out.permissionDecisionReason, /calibration refused/);
});
