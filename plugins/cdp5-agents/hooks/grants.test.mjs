import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, rmSync, existsSync, readFileSync, copyFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addGrant, activeGrant, consumeGrant, parseTtl, readGrants } from '../lib/grants.mjs';
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

const auditor = (command, env) => decide({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command } }, env);
const denied = (d) => d?.hookSpecificOutput.permissionDecision === 'deny';

test('parseTtl accepts minutes and hours within 24h', () => {
  assert.equal(parseTtl('30m'), 1_800_000);
  assert.equal(parseTtl('2h'), 7_200_000);
  assert.throws(() => parseTtl('25h'));
  assert.throws(() => parseTtl('soon'));
});

test('without a grant the auditor is read-only; with a grant it gets the worker tier; git stays bounded', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.ok(denied(auditor('vendor/bin/phpunit', env)));
    assert.match(auditor('vendor/bin/phpunit', env).hookSpecificOutput.permissionDecisionReason, /grant/);
    assert.ok(denied(auditor('node -e "console.log(1)"', env)));
    const g = addGrant({ agent: 'adversarial-auditor', root: wt, note: 'counter-test' }, env);
    assert.equal(g.root, wt);
    assert.equal(activeGrant('adversarial-auditor', env).root, wt);
    assert.equal(auditor('vendor/bin/phpunit', env), null);
    assert.equal(auditor('node -e "console.log(1)"', env), null);
    assert.equal(auditor('docker exec app vendor/bin/phpunit', env), null);
    assert.equal(auditor('echo x > /tmp/probe.txt', env), null);
    for (const c of ['git commit -m x', 'git push', 'git -C ../wt commit -m x', 'git reset --hard HEAD~1', 'git stash']) {
      const d = auditor(c, env);
      assert.ok(denied(d), `should deny with grant: ${c}`);
      assert.match(d.hookSpecificOutput.permissionDecisionReason, /run grant is active/);
    }
    // the grant is per agent type
    assert.ok(denied(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'vendor/bin/phpunit' } }, env)));
    // workers are unaffected by grants
    assert.equal(decide({ agent_type: 'cdp5-agents:impl-uc', tool_name: 'Bash', tool_input: { command: 'npm test' } }, env), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('an expired grant does not count and is pruned on the next write', () => {
  const { root, wt, env } = sandbox();
  try {
    const past = Date.now() - 10_000;
    addGrant({ agent: 'adversarial-auditor', root: wt, ttlMs: 1_000 }, env, past);
    assert.equal(activeGrant('adversarial-auditor', env), null);
    assert.ok(denied(auditor('vendor/bin/phpunit', env)));
    addGrant({ agent: 'review-verify', root: wt }, env);
    assert.deepEqual(readGrants(env).map((g) => g.agent), ['review-verify']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('addGrant refuses a missing root and a prefixed agent name; a new grant replaces the old one for the same agent', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.throws(() => addGrant({ agent: 'adversarial-auditor', root: join(root, 'nope') }, env), /does not exist/);
    assert.throws(() => addGrant({ agent: 'cdp5-agents:adversarial-auditor', root: wt }, env), /plain agent name/);
    addGrant({ agent: 'adversarial-auditor', root: wt }, env);
    addGrant({ agent: 'adversarial-auditor', root: root }, env);
    assert.equal(readGrants(env).length, 1);
    assert.equal(activeGrant('adversarial-auditor', env).root, root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('CLI: grant, list, revoke; usage errors exit 1', () => {
  const { root, wt, env } = sandbox();
  const run = (...args) => spawnSync('node', [GRANT, ...args], { env, encoding: 'utf8' });
  try {
    const g = run('grant', '--agent', 'adversarial-auditor', '--root', wt, '--ttl', '30m', '--note', 'slice 7');
    assert.equal(g.status, 0, g.stderr);
    assert.match(g.stdout, /adversarial-auditor may run in .*wt-audit until/);
    const l = run('list');
    assert.match(l.stdout, /adversarial-auditor → .*wt-audit until .*\(slice 7\)/);
    const r = run('revoke', '--agent', 'adversarial-auditor');
    assert.match(r.stdout, /revoked adversarial-auditor/);
    assert.match(run('list').stdout, /none active/);
    assert.equal(run('grant', '--agent', 'x', '--root', join(root, 'missing')).status, 1);
    assert.equal(run('grant', '--agent', 'x', '--root', wt, '--ttl', '3d').status, 1);
    assert.equal(run().status, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('SubagentStop consumes the grant of the finished agent, whether the acknowledgement passed or the stop hook already ran', () => {
  const { root, wt, env } = sandbox();
  try {
    assert.equal(spawnSync('node', [GENERATE], { env, encoding: 'utf8' }).status, 0);
    const hash = readFileSync(join(root, 'skills', 'worker-contract', 'core.md'), 'utf8').match(/sha256:([0-9a-f]{12})/)[1];
    addGrant({ agent: 'adversarial-auditor', root: wt }, env);
    addGrant({ agent: 'review-verify', root: wt }, env);
    const ok = spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:adversarial-auditor', stop_hook_active: false, last_assistant_message: `contract: v1 ${hash}\nSPERRE` }) });
    assert.equal(ok.status, 0, ok.stderr);
    assert.deepEqual(readGrants(env).map((g) => g.agent), ['review-verify'], 'only the finished agent loses its grant');
    const second = spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:review-verify', stop_hook_active: true, last_assistant_message: 'no ack' }) });
    assert.equal(second.status, 0);
    assert.deepEqual(readGrants(env), []);
    assert.ok(existsSync(join(root, 'data', 'grants.json')));
    assert.equal(consumeGrant('nobody', env), null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
