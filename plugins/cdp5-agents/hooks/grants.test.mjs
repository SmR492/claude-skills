import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addGrant, activeGrant, consumeGrant, removeGrant, grantApplies, isWithin, parseTtl, parseUses, readGrants } from '../lib/grants.mjs';
import { verify } from '../lib/contract.mjs';
import { decide } from './guard-bash.mjs';

const PLUGIN = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const GRANT = join(PLUGIN, 'scripts', 'grant-run.mjs');
const CHECK = join(PLUGIN, 'hooks', 'check-ack.mjs');
const GENERATE = join(PLUGIN, 'scripts', 'generate-contract.mjs');

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-grants-'));
  const wt = join(root, 'wt-audit');
  mkdirSync(wt);
  const skillDir = join(root, 'skills', 'worker-contract');
  mkdirSync(skillDir, { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), join(skillDir, 'SKILL.md'));
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  return { root, wt, env };
}

// The hook input of an agent working in `cwd` (default: the sandbox project root).
const auditor = (command, env, cwd) => decide({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command }, cwd }, env);
const denied = (d) => d?.hookSpecificOutput.permissionDecision === 'deny';

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

test('isWithin and grantApplies compare path prefixes on directory boundaries', () => {
  assert.ok(isWithin('/repo', '/repo'));
  assert.ok(isWithin('/repo/src', '/repo'));
  assert.ok(isWithin('/repo/', '/repo'));
  assert.ok(!isWithin('/repo-other', '/repo'));
  assert.ok(!isWithin('/other', '/repo'));
  assert.ok(!isWithin(undefined, '/repo'));
  assert.ok(isWithin('C:\\repo\\src', 'C:/repo'), 'separators are normalised');
  const grant = { project: '/repo', root: '/tmp/wt' };
  assert.ok(grantApplies(grant, '/repo/sub'));
  assert.ok(grantApplies(grant, '/tmp/wt'));
  assert.ok(!grantApplies(grant, '/elsewhere'));
  assert.ok(!grantApplies(grant, undefined), 'no cwd, no grant');
});

test('without a grant the auditor is read-only; with a grant it gets the worker tier; git stays bounded', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.ok(denied(auditor('vendor/bin/phpunit', env, root)));
    assert.match(auditor('vendor/bin/phpunit', env, root).hookSpecificOutput.permissionDecisionReason, /grant/);
    assert.ok(denied(auditor('node -e "console.log(1)"', env, root)));
    const g = addGrant({ agent: 'adversarial-auditor', root: wt, project: root, note: 'counter-test' }, env);
    assert.equal(g.root, wt);
    assert.equal(g.project, root);
    assert.equal(g.uses, 1);
    assert.equal(activeGrant('adversarial-auditor', env).root, wt);
    assert.equal(auditor('vendor/bin/phpunit', env, root), null);
    assert.equal(auditor('vendor/bin/phpunit', env, wt), null, 'inside the granted root');
    assert.equal(auditor('node -e "console.log(1)"', env, root), null);
    assert.equal(auditor('docker exec app vendor/bin/phpunit', env, root), null);
    assert.equal(auditor('echo x > /tmp/probe.txt', env, root), null);
    for (const c of ['git commit -m x', 'git push', 'git -C ../wt commit -m x', 'git reset --hard HEAD~1', 'git stash', 'gh pr merge 1', 'curl -X POST https://x.y']) {
      const d = auditor(c, env, root);
      assert.ok(denied(d), `should deny with grant: ${c}`);
      assert.match(d.hookSpecificOutput.permissionDecisionReason, /run grant is active/);
    }
    // the grant is per agent type
    assert.ok(denied(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' }, cwd: root }, env)));
    // workers are unaffected by grants
    assert.equal(decide({ agent_type: 'cdp5-agents:impl-uc', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: root }, env), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('a grant does not leak across projects: another cwd stays on the judgment tier and the deny text says so', () => {
  const { root, wt, env } = sandbox();
  try {
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root }, env);
    const other = auditor('vendor/bin/phpunit', env, join(tmpdir(), 'another-project'));
    assert.ok(denied(other));
    assert.match(other.hookSpecificOutput.permissionDecisionReason, /grant exists for another project/);
    assert.ok(denied(auditor('vendor/bin/phpunit', env, undefined)), 'no cwd in the hook input: the grant does not apply');
    assert.ok(denied(auditor('vendor/bin/phpunit', env, `${root}-sibling`)), 'prefix match stops at the directory boundary');
    assert.equal(auditor('git log -1', env, join(tmpdir(), 'another-project')), null, 'read-only commands still pass elsewhere');
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
    assert.ok(denied(auditor('vendor/bin/phpunit', env, root)));
    addGrant({ agent: 'review-verify', root: wt, project: root }, env);
    assert.deepEqual(readGrants(env).map((g) => g.agent), ['review-verify']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('addGrant refuses a missing root, a prefixed agent name and bad uses; a new grant replaces the old one for the same agent', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.throws(() => addGrant({ agent: 'adversarial-auditor', root: join(root, 'nope'), project: root }, env), /does not exist/);
    assert.throws(() => addGrant({ agent: 'cdp5-agents:adversarial-auditor', root: wt, project: root }, env), /plain agent name/);
    assert.throws(() => addGrant({ agent: 'adversarial-auditor', root: wt, project: root, uses: 0 }, env), /uses/);
    addGrant({ agent: 'adversarial-auditor', root: wt, project: root }, env);
    addGrant({ agent: 'adversarial-auditor', root: root, project: root }, env);
    assert.equal(readGrants(env).length, 1);
    assert.equal(activeGrant('adversarial-auditor', env).root, root);
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
    assert.equal(auditor('vendor/bin/phpunit', env, root), null, 'still armed for the second run');
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

test('CLI: grant, list, revoke; --project, --uses; usage errors exit 1', () => {
  const { root, wt, env } = sandbox();
  const run = (...args) => spawnSync('node', [GRANT, ...args], { env, encoding: 'utf8', cwd: root });
  try {
    const g = run('grant', '--agent', 'adversarial-auditor', '--root', wt, '--ttl', '30m', '--note', 'slice 7');
    assert.equal(g.status, 0, g.stderr);
    assert.match(g.stdout, /adversarial-auditor may run in .*wt-audit until .* for project .*cdp5-grants-.*, 1 use /);
    assert.equal(activeGrant('adversarial-auditor', env).project, root, '--project defaults to the current directory');
    const l = run('list');
    assert.match(l.stdout, /adversarial-auditor → .*wt-audit until .*\(1 use left, project .*\) \(slice 7\)/);
    const r = run('revoke', '--agent', 'adversarial-auditor');
    assert.match(r.stdout, /revoked adversarial-auditor/);
    assert.match(run('list').stdout, /none active/);
    const other = join(root, 'other-project');
    mkdirSync(other);
    const g2 = run('grant', '--agent', 'review-verify', '--root', wt, '--project', other, '--uses', '3');
    assert.equal(g2.status, 0, g2.stderr);
    assert.match(g2.stdout, /3 uses/);
    assert.equal(activeGrant('review-verify', env).project, other);
    assert.match(run('list').stdout, /3 uses left/);
    assert.ok(denied(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: root }, env)));
    assert.equal(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'npm test' }, cwd: other }, env), null);
    assert.equal(run('revoke', '--agent', 'review-verify').status, 0);
    assert.match(run('list').stdout, /none active/, 'revoke removes a grant with remaining uses');
    assert.equal(run('grant', '--agent', 'x', '--root', join(root, 'missing')).status, 1);
    assert.equal(run('grant', '--agent', 'x', '--root', wt, '--ttl', '3d').status, 1);
    assert.equal(run('grant', '--agent', 'x', '--root', wt, '--uses', '0').status, 1);
    assert.equal(run().status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SubagentStop spends one use of the finished agent, whether the acknowledgement passed or the stop hook already ran', () => {
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
    const log = readFileSync(join(root, 'data', 'usage-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(log.map((e) => e.result), ['ok', 'no-ack', 'no-ack']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
