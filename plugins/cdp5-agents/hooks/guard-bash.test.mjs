import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { isWriteCommand, isVcsCommand, decide, agentName } from './guard-bash.mjs';

const SCRIPT = join(new URL('.', import.meta.url).pathname, 'guard-bash.mjs');

const READ_ONLY = [
  'git diff HEAD~1', 'git log --oneline -5', 'git rev-parse HEAD', 'git status --short', 'git show abc123:src/Foo.php',
  'grep -rn "Voter" src/', 'rg -n foo src', 'cat composer.json', 'ls -la vendor/bin',
  'node -e "console.log(typeof [].at)"', 'php -r "var_dump(PHP_VERSION);"',
  'node plugins/cdp5-gates/skills/mcp-config-lint/mcp-config-lint.mjs --config=.mcp.json',
  'curl -sI https://example.org', 'find . -name "*.php" | head', 'wc -l src/Foo.php', 'echo $HOME', 'docker ps', 'cat a.txt 2>&1 | head',
];

const WRITES = [
  'git commit -m x', 'git push origin main', 'git add -A', 'git checkout -- .', 'rm -rf build', 'mv a b', 'echo hi > out.txt', 'cat a >> b',
  'sed -i "s/a/b/" file.php', 'npm install', 'composer require foo/bar', 'docker run --rm alpine sh',
  'curl -X POST https://api.example.org -d "{}"', 'curl --data @payload.json https://x.y', 'wget https://x.y/file',
  'php bin/console doctrine:migrations:migrate', 'tee out.log', 'pkill node', 'touch marker', 'git stash',
];

const WORKER_ALLOWED = ['docker exec app vendor/bin/phpunit', 'npm test', 'npm run lint', 'vendor/bin/phpstan analyse', 'git add -A', 'git diff --stat', 'git worktree add ../wt HEAD', 'echo x > /tmp/probe'];
const WORKER_BLOCKED = ['git commit -m "fix"', 'git push', 'git pull --rebase', 'git fetch origin', 'git rebase main', 'git reset --hard HEAD~1', 'git branch -D feature', 'git clean -fd'];

test('agentName accepts both plugin prefixes only', () => {
  assert.equal(agentName('cdp5-agents:review-verify'), 'review-verify');
  assert.equal(agentName('domain-agents:psy-grenzwaechter'), 'psy-grenzwaechter');
  assert.equal(agentName('Explore'), null);
  assert.equal(agentName(''), null);
});

test('read-only commands pass the full guard', () => {
  for (const c of READ_ONLY) assert.equal(isWriteCommand(c), false, c);
});

test('writing or mutating commands are detected by the full guard', () => {
  for (const c of WRITES) assert.equal(isWriteCommand(c), true, c);
});

test('judgment agents: deny writes; other agent types and tools untouched', () => {
  const base = { tool_name: 'Bash', tool_input: { command: 'git push' } };
  const denied = decide({ ...base, agent_type: 'cdp5-agents:review-verify' });
  assert.equal(denied.hookSpecificOutput.permissionDecision, 'deny');
  assert.match(denied.hookSpecificOutput.permissionDecisionReason, /read-only/);
  assert.equal(decide({ ...base, agent_type: 'Explore' }), null);
  assert.equal(decide({ ...base, agent_type: 'cdp5-agents:review-verify', tool_name: 'Read' }), null);
  assert.equal(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Bash', tool_input: { command: 'git diff' } }), null);
});

test('implementation workers: tests, builds and worktree writes pass; commit, push and history rewrites are denied', () => {
  for (const name of ['impl-debug', 'impl-uc', 'impl-refactor']) {
    for (const c of WORKER_ALLOWED) assert.equal(decide({ agent_type: `cdp5-agents:${name}`, tool_name: 'Bash', tool_input: { command: c } }), null, `${name}: ${c}`);
    for (const c of WORKER_BLOCKED) {
      const d = decide({ agent_type: `cdp5-agents:${name}`, tool_name: 'Bash', tool_input: { command: c } });
      assert.equal(d?.hookSpecificOutput.permissionDecision, 'deny', `${name}: ${c}`);
      assert.match(d.hookSpecificOutput.permissionDecisionReason, /diff/);
    }
  }
  for (const c of WORKER_BLOCKED) assert.equal(isVcsCommand(c), true, c);
});

test('CLI: deny JSON on stdout for a write, nothing for a read, exit 0 both times', () => {
  const run = (input) => spawnSync('node', [SCRIPT], { input: JSON.stringify(input), encoding: 'utf8' });
  const w = run({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' } });
  assert.equal(w.status, 0);
  assert.equal(JSON.parse(w.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const r = run({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command: 'git log -1' } });
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
});
