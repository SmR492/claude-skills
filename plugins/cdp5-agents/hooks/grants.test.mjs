import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, writeFileSync, copyFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as G from '../lib/grants.mjs';
import { verify } from '../lib/contract.mjs';
import { decide } from './guard-bash.mjs';

const { addGrant, activeGrant, consumeGrant, removeGrant, grantApplies, isWithin, parseTtl, parseUses, readGrants, grantsPath } = G;
const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const GRANT = join(PLUGIN, 'scripts', 'grant-run.mjs');
const CHECK = join(PLUGIN, 'hooks', 'check-ack.mjs');
const GENERATE = join(PLUGIN, 'scripts', 'generate-contract.mjs');

// A project that is a git repository with two linked worktrees (wt-audit, wt-two); HOME is the sandbox root.
function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-grants-'));
  const g = (...a) => spawnSync('git', a, { cwd: root, encoding: 'utf8' });
  g('init', '-q');
  g('config', 'user.email', 't@example.org');
  g('config', 'user.name', 'T');
  writeFileSync(join(root, 'a.txt'), 'one\n');
  g('add', 'a.txt');
  g('commit', '-q', '-m', 'one');
  const wt = join(root, 'wt-audit');
  const wt2 = join(root, 'wt-two');
  g('worktree', 'add', '-q', '--detach', wt);
  g('worktree', 'add', '-q', '--detach', wt2);
  const skillDir = join(root, 'skills', 'worker-contract');
  mkdirSync(skillDir, { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), join(skillDir, 'SKILL.md'));
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  return { root, wt, wt2, env };
}

// The hook input of an agent working in `cwd`.
const auditor = (command, env, cwd, session_id) => decide({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command }, cwd, session_id }, env);
const denied = (d) => d?.hookSpecificOutput.permissionDecision === 'deny';
const usage = (env) => {
  const file = join(env.CLAUDE_PLUGIN_DATA, 'usage-log.jsonl');
  return existsSync(file) ? readFileSync(file, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [];
};

test('parseTtl accepts minutes and hours within 24h; parseUses accepts small whole numbers', () => {
  assert.equal(parseTtl('30m'), 1_800_000);
  assert.equal(parseTtl('2h'), 7_200_000);
  assert.throws(() => parseTtl('25h'));
  assert.throws(() => parseTtl('soon'));
  assert.equal(parseUses('3'), 3);
  assert.throws(() => parseUses('0'));
  assert.throws(() => parseUses('1.5'));
  assert.throws(() => parseUses('many'));
});

test('isWithin compares path prefixes on directory boundaries; the filesystem root contains nothing', () => {
  assert.ok(isWithin('/repo', '/repo'));
  assert.ok(isWithin('/repo/src', '/repo'));
  assert.ok(isWithin('/repo/', '/repo'));
  assert.ok(!isWithin('/repo-other', '/repo'));
  assert.ok(!isWithin('/other', '/repo'));
  assert.ok(!isWithin(undefined, '/repo'));
  assert.ok(isWithin('C:\\repo\\src', 'C:/repo'), 'separators are normalised');
  assert.ok(!isWithin('/repo', '/'), 'a base of / does not contain everything');
  assert.ok(!isWithin('/', '/'));
  assert.ok(!isWithin('/repo', '//'));
  assert.ok(!isWithin('C:\\repo', 'C:\\'));
});

test('grantApplies: only inside the root (not the project), and only in the session the grant was issued in', () => {
  const grant = { project: '/repo', root: '/tmp/wt' };
  assert.ok(!grantApplies(grant, '/repo/sub'), 'the project is not the environment');
  assert.ok(grantApplies(grant, '/tmp/wt'));
  assert.ok(grantApplies(grant, '/tmp/wt/src'));
  assert.ok(!grantApplies(grant, '/elsewhere'));
  assert.ok(!grantApplies(grant, undefined), 'no cwd, no grant');
  const bound = { project: '/repo', root: '/tmp/wt', session: 's1' };
  assert.ok(grantApplies(bound, '/tmp/wt', 's1'));
  assert.ok(!grantApplies(bound, '/tmp/wt', 's2'), 'another session');
  assert.ok(!grantApplies(bound, '/tmp/wt', undefined), 'no session id in the hook input');
  assert.ok(grantApplies(grant, '/tmp/wt', 's2'), 'a grant without session (older format) still applies');
});

test('addGrant rejects the project, the filesystem root, the home directory and a directory that is not a worktree of the project (injected check)', () => {
  const { root, wt, env } = sandbox();
  try {
    const yes = () => true;
    const calls = [];
    const spy = (r, p) => { calls.push([r, p]); return true; };
    const proj = join(root, 'proj');
    mkdirSync(proj);
    assert.throws(() => addGrant({ agent: 'review-verify', root: proj, project: proj, isWorktree: yes }, env), /project itself/);
    assert.throws(() => addGrant({ agent: 'review-verify', root: '/', project: proj, isWorktree: yes }, env), /filesystem root/);
    assert.throws(() => addGrant({ agent: 'review-verify', root: root, project: proj, isWorktree: yes }, env), /home directory/);
    assert.throws(() => addGrant({ agent: 'review-verify', root: wt, project: proj, isWorktree: () => false }, env), /not a git worktree of the project/);
    const g = addGrant({ agent: 'review-verify', root: wt, project: proj, isWorktree: spy }, env);
    assert.equal(g.project, proj, 'project is still recorded');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][1], proj);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('addGrant real worktree check: a plain directory is refused, a linked worktree of the project is accepted, another repository is refused', () => {
  const { root, wt, env } = sandbox();
  try {
    const plain = join(root, 'plain');
    mkdirSync(plain);
    const elsewhere = mkdtempSync(join(tmpdir(), 'cdp5-other-'));
    assert.throws(() => addGrant({ agent: 'review-verify', root: plain, project: root }, env), /not a git worktree of the project/);
    assert.throws(() => addGrant({ agent: 'review-verify', root: wt, project: elsewhere }, env), /not a git worktree of the project/, 'a directory outside the repository');
    assert.equal(addGrant({ agent: 'review-verify', root: wt, project: root }, env).root, wt);
    assert.equal(addGrant({ agent: 'adversarial-auditor', root: wt, project: plain }, env).root, wt, 'a subdirectory of the repository is the same project');
    rmSync(elsewhere, { recursive: true, force: true });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('without a grant the auditor is read-only; with a grant it gets the worker tier inside the root only; git stays bounded', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.ok(denied(auditor('vendor/bin/phpunit', env, wt)));
    assert.match(auditor('vendor/bin/phpunit', env, wt).hookSpecificOutput.permissionDecisionReason, /grant/);
    const g = addGrant({ agent: 'adversarial-auditor', root: wt, project: root, note: 'counter-test' }, env);
    assert.equal(g.root, wt);
    assert.equal(g.project, root);
    assert.equal(g.uses, 1);
    assert.equal(activeGrant('adversarial-auditor', env).root, wt);
    assert.equal(auditor('vendor/bin/phpunit', env, wt), null, 'inside the granted root');
    assert.equal(auditor('node -e "console.log(1)"', env, join(wt, 'src')), null);
    assert.equal(auditor('docker exec app vendor/bin/phpunit', env, wt), null);
    assert.equal(auditor('echo x > /tmp/probe.txt', env, wt), null);
    const inProject = auditor('vendor/bin/phpunit', env, root);
    assert.ok(denied(inProject), 'the project is not the environment');
    assert.match(inProject.hookSpecificOutput.permissionDecisionReason, /does not apply here.*outside the environment/);
    for (const c of ['git commit -m x', 'git push', 'git -C ../wt commit -m x', 'git reset --hard HEAD~1', 'git stash', 'gh pr merge 1', 'curl -X POST https://x.y']) {
      const d = auditor(c, env, wt);
      assert.ok(denied(d), `should deny with grant: ${c}`);
      assert.match(d.hookSpecificOutput.permissionDecisionReason, /run grant active \(project .*, environment .*wt-audit\); the environment is the boundary, not this hook/i);
    }
    const self = auditor(`node ${PLUGIN}/scripts/grant-run.mjs grant --agent adversarial-auditor --root ${wt} --uses 20`, env, wt);
    assert.ok(denied(self), 'a granted agent cannot extend its own grant');
    assert.match(self.hookSpecificOutput.permissionDecisionReason, /orchestrator tools/);
    // the grant is per agent type
    assert.ok(denied(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' }, cwd: wt }, env)));
    // workers are unaffected by grants
    assert.equal(decide({ agent_type: 'cdp5-agents:impl-uc', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: root }, env), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a grant does not leak: another cwd stays on the judgment tier and the deny text says so', () => {
  const { root, wt, env } = sandbox();
  try {
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root }, env);
    const other = auditor('vendor/bin/phpunit', env, join(tmpdir(), 'another-project'));
    assert.ok(denied(other));
    assert.match(other.hookSpecificOutput.permissionDecisionReason, /grant exists .* but does not apply here/);
    assert.ok(denied(auditor('vendor/bin/phpunit', env, undefined)), 'no cwd in the hook input: the grant does not apply');
    assert.ok(denied(auditor('vendor/bin/phpunit', env, `${wt}-sibling`)), 'prefix match stops at the directory boundary');
    assert.equal(auditor('git log -1', env, join(tmpdir(), 'another-project')), null, 'read-only commands still pass elsewhere');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('session binding: the grant applies and is consumed only in the session it was issued in', () => {
  const { root, wt, env } = sandbox();
  try {
    const g = addGrant({ agent: 'adversarial-auditor', root: wt, project: root, session: 's1', uses: 2 }, env);
    assert.equal(g.session, 's1');
    assert.equal(auditor('vendor/bin/phpunit', env, wt, 's1'), null);
    const other = auditor('vendor/bin/phpunit', env, wt, 's2');
    assert.ok(denied(other));
    assert.match(other.hookSpecificOutput.permissionDecisionReason, /another session/);
    assert.equal(consumeGrant('adversarial-auditor', env, Date.now(), 's2'), null, 'another session does not consume');
    assert.equal(readGrants(env)[0].uses, 2);
    assert.equal(consumeGrant('adversarial-auditor', env, Date.now(), 's1').uses, 2);
    assert.equal(readGrants(env)[0].uses, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an expired grant does not count and is pruned on the next write', () => {
  const { root, wt, env } = sandbox();
  try {
    const past = Date.now() - 10_000;
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root, ttlMs: 1_000 }, env, past);
    assert.equal(activeGrant('adversarial-auditor', env), null);
    assert.ok(denied(auditor('vendor/bin/phpunit', env, wt)));
    addGrant({ agent: 'review-verify', root: wt, project: root }, env);
    assert.deepEqual(readGrants(env).map((g) => g.agent), ['review-verify']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('addGrant refuses a missing root, a prefixed agent name and bad uses; a new grant replaces the old one for the same agent', () => {
  const { root, wt, wt2, env } = sandbox();
  try {
    assert.throws(() => addGrant({ agent: 'adversarial-auditor', root: join(root, 'nope'), project: root }, env), /does not exist/);
    assert.throws(() => addGrant({ agent: 'cdp5-agents:adversarial-auditor', root: wt, project: root }, env), /plain agent name/);
    assert.throws(() => addGrant({ agent: 'adversarial-auditor', root: wt, project: root, uses: 0 }, env), /uses/);
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root }, env);
    addGrant({ agent: 'adversarial-auditor', root: wt2, project: root }, env);
    assert.equal(readGrants(env).length, 1);
    assert.equal(activeGrant('adversarial-auditor', env).root, wt2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('uses: consumeGrant spends one use per run and removes the grant at zero; removeGrant drops it outright', () => {
  const { root, wt, env } = sandbox();
  try {
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root, uses: 2 }, env);
    assert.equal(consumeGrant('adversarial-auditor', env).uses, 2, 'returns the grant as it was before the use');
    assert.equal(activeGrant('adversarial-auditor', env).uses, 1);
    assert.equal(auditor('vendor/bin/phpunit', env, wt), null, 'still armed for the second run');
    consumeGrant('adversarial-auditor', env);
    assert.equal(activeGrant('adversarial-auditor', env), null);
    assert.equal(consumeGrant('adversarial-auditor', env), null);
    addGrant({ agent: 'review-verify', root: wt, project: root, uses: 5 }, env);
    assert.equal(removeGrant('review-verify', env).agent, 'review-verify');
    assert.deepEqual(readGrants(env), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('concurrency: writes go through a lock file and a temp-file rename; a held lock fails closed with a clear error', () => {
  const { root, wt, env } = sandbox();
  try {
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root, uses: 3 }, env);
    const lock = `${grantsPath(env)}.lock`;
    writeFileSync(lock, 'held by a test');
    const started = Date.now();
    assert.throws(() => consumeGrant('adversarial-auditor', env), (e) => e.message.includes(lock) && /locked/.test(e.message));
    assert.ok(Date.now() - started >= 1_500, 'retries for about two seconds before giving up');
    assert.equal(readGrants(env)[0].uses, 3, 'nothing changed while the lock was held');
    rmSync(lock);
    consumeGrant('adversarial-auditor', env);
    consumeGrant('adversarial-auditor', env);
    assert.equal(readGrants(env)[0].uses, 1);
    assert.ok(!existsSync(lock), 'the lock is released');
    assert.deepEqual(readdirSync(dirname(grantsPath(env))).filter((f) => /\.tmp$/.test(f)), [], 'no temp files left behind');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('audit trail: issue, consume and revoke each append a usage-log line', () => {
  const { root, wt, env } = sandbox();
  try {
    addGrant({ agent: 'review-verify', root: wt, project: root, uses: 2, session: 's1' }, env);
    consumeGrant('review-verify', env, Date.now(), 's1');
    removeGrant('review-verify', env);
    const lines = usage(env);
    assert.deepEqual(lines.map((l) => l.agent_type), ['grant:issue', 'grant:consume', 'grant:revoke']);
    for (const l of lines) {
      assert.equal(l.agent, 'review-verify');
      assert.equal(l.root, wt);
      assert.equal(l.project, root);
      assert.equal(l.session, 's1');
      assert.ok(Date.parse(l.ts));
    }
    assert.deepEqual(lines.map((l) => l.uses_left), [2, 1, 0]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a corrupt grants.json makes readGrants throw an error that names the file', () => {
  const { root, env } = sandbox();
  try {
    mkdirSync(env.CLAUDE_PLUGIN_DATA, { recursive: true });
    writeFileSync(grantsPath(env), '{ not json');
    assert.throws(() => readGrants(env), (e) => e.message.includes(grantsPath(env)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI: grant, list, revoke; --project, --uses, --session and the session pointer; usage errors exit 1', () => {
  const { root, wt, wt2, env } = sandbox();
  const run = (...args) => spawnSync('node', [GRANT, ...args], { env, encoding: 'utf8', cwd: root });
  try {
    const g = run('grant', '--agent', 'adversarial-auditor', '--root', wt, '--ttl', '30m', '--note', 'slice 7', '--session', 'sess-a');
    assert.equal(g.status, 0, g.stderr);
    assert.match(g.stdout, /adversarial-auditor may run in .*wt-audit until .* for project .*cdp5-grants-.*, 1 use, session sess-a /);
    assert.equal(activeGrant('adversarial-auditor', env).project, root, '--project defaults to the current directory');
    assert.equal(activeGrant('adversarial-auditor', env).session, 'sess-a');
    const l = run('list');
    assert.match(l.stdout, /adversarial-auditor → .*wt-audit until .*\(1 use left, project .*\) \(slice 7\)/);
    const r = run('revoke', '--agent', 'adversarial-auditor');
    assert.match(r.stdout, /revoked adversarial-auditor/);
    assert.match(run('list').stdout, /none active/);
    // without --session the id written by the SessionStart bootstrap is used
    mkdirSync(join(root, '.cache', 'cdp5-agents'), { recursive: true });
    writeFileSync(join(root, '.cache', 'cdp5-agents', 'session'), 'sess-from-pointer\n');
    const g2 = run('grant', '--agent', 'review-verify', '--root', wt2, '--uses', '3');
    assert.equal(g2.status, 0, g2.stderr);
    assert.match(g2.stdout, /3 uses/);
    assert.equal(activeGrant('review-verify', env).session, 'sess-from-pointer');
    assert.match(run('list').stdout, /3 uses left/);
    assert.equal(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: wt2, session_id: 'sess-from-pointer' }, env), null);
    assert.ok(denied(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: root, session_id: 'sess-from-pointer' }, env)));
    assert.equal(run('revoke', '--agent', 'review-verify').status, 0);
    assert.match(run('list').stdout, /none active/, 'revoke removes a grant with remaining uses');
    const other = mkdtempSync(join(tmpdir(), 'cdp5-other-project-'));
    const bad = run('grant', '--agent', 'review-verify', '--root', wt, '--project', other);
    rmSync(other, { recursive: true, force: true });
    assert.equal(bad.status, 1);
    assert.match(bad.stderr, /not a git worktree of the project/);
    assert.equal(run('grant', '--agent', 'x', '--root', root).status, 1, 'the project itself');
    assert.equal(run('grant', '--agent', 'x', '--root', join(root, 'missing')).status, 1);
    assert.equal(run('grant', '--agent', 'x', '--root', wt, '--ttl', '3d').status, 1);
    assert.equal(run('grant', '--agent', 'x', '--root', wt, '--uses', '0').status, 1);
    assert.equal(run().status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SubagentStop spends one use of the finished agent, whether the acknowledgement passed or the stop hook already ran; only in the grant\'s session', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.equal(spawnSync('node', [GENERATE], { env, encoding: 'utf8' }).status, 0);
    const v = verify(root);
    assert.ok(v.ok, v.error);
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root }, env);
    addGrant({ agent: 'review-verify', root: wt, project: root, uses: 2 }, env);
    const ok = spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:adversarial-auditor', stop_hook_active: false, last_assistant_message: `contract: v${v.version} ${v.hash}\nSPERRE` }) });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(readGrants(env).map((g) => g.agent), ['review-verify'], 'only the finished agent loses its grant');
    const second = spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:review-verify', stop_hook_active: true, last_assistant_message: 'no ack' }) });
    assert.equal(second.status, 0);
    assert.equal(readGrants(env)[0].uses, 1, 'one of two uses spent');
    const third = spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:review-verify', stop_hook_active: true, last_assistant_message: 'no ack' }) });
    assert.equal(third.status, 0);
    assert.deepEqual(readGrants(env), []);
    assert.ok(existsSync(join(root, 'data', 'grants.json')));
    assert.equal(consumeGrant('nobody', env), null);
    const runs = usage(env).filter((e) => e.result !== undefined);
    assert.deepEqual(runs.map((e) => e.result), ['ok', 'no-ack', 'no-ack']);
    // session-bound grant: a stop from another session leaves it, a stop from its session spends it
    addGrant({ agent: 'review-verify', root: wt, project: root, session: 's1' }, env);
    spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:review-verify', session_id: 's2', stop_hook_active: true, last_assistant_message: 'no ack' }) });
    assert.equal(readGrants(env).length, 1, 'another session does not spend the grant');
    spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:review-verify', session_id: 's1', stop_hook_active: true, last_assistant_message: 'no ack' }) });
    assert.deepEqual(readGrants(env), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
