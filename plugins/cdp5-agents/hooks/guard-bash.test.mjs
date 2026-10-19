import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import { decide, verdict, agentName } from './guard-bash.mjs';

const SCRIPT = join(new URL('.', import.meta.url).pathname, 'guard-bash.mjs');
// An empty data directory: no run grants exist, so judgment agents are strictly read-only here (grants are tested in grants.test.mjs).
const ENV = { CLAUDE_PLUGIN_DATA: join(new URL('.', import.meta.url).pathname, 'no-such-data-dir') };
const J = (command, tool = 'Bash') => decide({ agent_type: 'cdp5-agents:review-verify', tool_name: tool, tool_input: { command } }, ENV);
const W = (command, tool = 'Bash') => decide({ agent_type: 'cdp5-agents:impl-uc', tool_name: tool, tool_input: { command } }, ENV);
const denied = (d) => d?.hookSpecificOutput.permissionDecision === 'deny';

const JUDGMENT_ALLOWED = [
  'git diff HEAD~1', 'git log --oneline -5', 'git rev-parse HEAD', 'git status --short', 'git show abc123:src/Foo.php', 'git -C ../wt log -1',
  'git -c core.pager=cat log -3', 'git --no-pager diff --stat', 'git branch -a', 'git branch --show-current', 'git tag -l', 'git stash list', 'git worktree list',
  'git remote -v', 'git config --get user.name', 'git ls-files | wc -l',
  'grep -rn "Voter" src/', 'grep -q foo file 2>/dev/null', 'rg -n foo src', 'cat composer.json', 'ls -la vendor/bin', 'find . -name "*.php" | head',
  'wc -l src/Foo.php', 'echo $HOME', 'docker ps', 'cat a.txt 2>&1 | head', 'sha256sum hooks.json', 'curl -sI https://example.org',
  'node plugins/cdp5-gates/skills/mcp-config-lint/mcp-config-lint.mjs --config=.mcp.json', 'php vendor/bin/phpstan.php --version',
  'node "${CLAUDE_PLUGIN_ROOT}/skills/mcp-config-lint/mcp-config-lint.mjs" --config=.mcp.json', 'node $CLAUDE_PLUGIN_ROOT/skills/konzept-lint/konzept-lint.mjs --konzept=docs/konzept.md',
  'node /home/u/.claude/plugins/cache/claude-skills/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --root=.',
  'wsl -e bash -c "cd ~/repo && git rev-parse HEAD"', 'sed -n 1,20p file.txt', 'awk \'{print $1}\' file.txt', 'npm ls --depth=0', 'composer show',
];

const JUDGMENT_DENIED = [
  // canonical writes
  'git commit -m x', 'git push origin main', 'git add -A', 'git checkout -- .', 'rm -rf build', 'mv a b', 'echo hi > out.txt', 'cat a >> b',
  'sed -i "s/a/b/" file.php', 'npm install', 'composer require foo/bar', 'docker run --rm alpine sh', 'curl -X POST https://api.example.org -d "{}"',
  'curl --data @payload.json https://x.y', 'wget https://x.y/file', 'php bin/console doctrine:migrations:migrate', 'tee out.log', 'pkill node', 'touch marker', 'git stash',
  // auditor cases: git with global options, aliases, unlisted subcommands
  'git -C ../wt commit -m fix', 'git -c user.name=x commit -m "fix"', 'git --git-dir=.git --work-tree=. commit', 'git -c alias.ci=commit ci -m fix',
  'git config alias.ci commit', 'git -C ../wt push origin HEAD', 'git remote update', 'git revert HEAD', 'git reset HEAD~1', 'git reset --soft HEAD~3',
  'git reset HEAD~1 --hard', 'git branch -f main HEAD~3', 'git branch --delete feature', 'git update-ref refs/heads/main HEAD~5', 'git reflog expire --expire=now --all',
  'git filter-repo --force', 'git "commit" -m fix', 'git com\\mit -m fix', 'g=git; $g commit', '$(which git) commit', 'git config user.email x@y', 'git remote add o url',
  'git submodule update --init', 'git gc --prune=now', 'git notes add -m x', 'git fetch origin', 'git pull', 'git rebase main', 'git clean -fd', 'git switch -c x', 'git checkout -b feature/x',
  // interpreters and scripts
  'node -e "require(\'fs\').writeFileSync(\'pwn.txt\',\'x\')"', 'php -r "file_put_contents(\'x\',\'y\');"', 'python3 -c "open(\'pwn.txt\',\'w\')"', 'perl -i -pe s/a/b/ file',
  'ruby -e "File.write(\'x\',\'y\')"', 'node script.js', 'bash payload.sh', 'npx some-package', 'bin/console doctrine:migrations:migrate', 'vendor/bin/doctrine orm:schema-tool:drop --force',
  'wsl -e bash /tmp/x.sh', 'wsl -e bash -c "cd ~/repo && git commit -m x"', 'docker exec app git log', 'docker exec app vendor/bin/phpunit',
  // quoting, substitution, indirection
  'r\\m -rf build', '/bin/r""m -rf build', '$(printf \'r\\x6d\') -rf build', 'eval "$(echo cm0gLXJmIC8K | base64 -d)"', 'bash -c "$(cat payload.txt)"', 'X=1 rm -rf build',
  // unlisted writers
  'echo pwned >& /tmp/out.txt', 'find . -delete', 'find . -name x -exec rm {} \\;', 'rsync --delete a b', 'install a b', 'tar xf a.tar', 'unzip a.zip', 'patch -p1 < fix.diff',
  'gzip file', 'sed --in-place s/a/b/ f', 'curl -o f https://x.y', 'curl --request DELETE https://x.y', 'curl --json \'{}\' https://x.y', 'sqlite3 db "DELETE FROM t"', 'make', 'yarn build',
  'composer dump-autoload', 'awk \'BEGIN{system("rm x")}\'', 'grep foo file > out.txt',
];

const WORKER_ALLOWED = [
  'docker exec app vendor/bin/phpunit', 'npm test', 'npm run lint', 'vendor/bin/phpstan analyse', 'git add -A', 'git diff --stat', 'git worktree add ../wt HEAD',
  'echo x > /tmp/probe', 'git checkout -- src/Foo.php', 'git restore --staged x', 'git -C ../wt status', 'wsl -e bash -c "cd ~/wt && npm test"', 'git stash list', 'node -e "console.log(1)"',
];
const WORKER_BLOCKED = [
  'git commit -m "fix"', 'git push', 'git pull --rebase', 'git fetch origin', 'git rebase main', 'git reset --hard HEAD~1', 'git branch -D feature', 'git clean -fd',
  'git -C ../wt commit -m fix', 'git -c user.name=x commit -m fix', 'git -c alias.ci=commit ci -m fix', 'git config alias.ci commit', 'git revert HEAD', 'git reset HEAD~1',
  'git branch -f main HEAD~3', 'git update-ref refs/heads/main HEAD~5', 'git reflog expire --expire=now --all', 'git stash', 'git stash pop', 'git checkout -b feature/x', 'git switch -c x',
  'g=git; $g commit -m x', '$(which git) commit -m x', 'wsl -e bash -c "cd ~/wt && git commit -m x"', 'docker exec app git push', 'git remote update', 'git filter-repo --force',
  'GIT_EDITOR=true git commit', 'git tag v1',
];

test('agentName accepts both plugin prefixes only', () => {
  assert.equal(agentName('cdp5-agents:review-verify'), 'review-verify');
  assert.equal(agentName('domain-agents:psy-grenzwaechter'), 'psy-grenzwaechter');
  assert.equal(agentName('Explore'), null);
  assert.equal(agentName(''), null);
});

test('judgment tier: read-only commands pass', () => {
  for (const c of JUDGMENT_ALLOWED) assert.equal(J(c), null, `${c} → ${verdict(c, 'judgment')}`);
});

test('judgment tier: every write, bypass and indirection form from the audit is denied', () => {
  for (const c of JUDGMENT_DENIED) assert.ok(denied(J(c)), `should deny: ${c}`);
});

test('worker tier: tests, builds, worktree writes and git worktree-local commands pass', () => {
  for (const c of WORKER_ALLOWED) assert.equal(W(c), null, `${c} → ${verdict(c, 'worker')}`);
});

test('worker tier: commit, push, fetch, history rewrites and their prefixed or wrapped forms are denied', () => {
  for (const c of WORKER_BLOCKED) {
    const d = W(c);
    assert.ok(denied(d), `should deny: ${c}`);
    assert.match(d.hookSpecificOutput.permissionDecisionReason, /diff/);
  }
});

test('PowerShell tool: same rules; cmdlets that write are denied for judgment agents', () => {
  assert.equal(J('Get-Content hooks.json', 'PowerShell'), null);
  assert.equal(J('git log -3', 'PowerShell'), null);
  assert.equal(J('wsl -e bash -c "cd ~/repo && git rev-parse HEAD"', 'PowerShell'), null);
  for (const c of ['Remove-Item -Recurse build', 'Set-Content x.txt "a"', 'echo a > out.txt', 'Invoke-WebRequest -Method Post https://x.y', 'del x', 'wsl -e bash -c "cd ~/repo && git commit -m x"', 'iex (gc payload.ps1)', 'Start-Process notepad']) {
    assert.ok(denied(J(c, 'PowerShell')), `should deny (PowerShell): ${c}`);
  }
  assert.ok(denied(W('git push', 'PowerShell')));
  assert.equal(W('Set-Content x.txt "a"', 'PowerShell'), null, 'workers may write in their worktree');
});

test('other agent types and other tools are untouched', () => {
  assert.equal(decide({ agent_type: 'Explore', tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }, ENV), null);
  assert.equal(decide({ agent_type: '', tool_name: 'Bash', tool_input: { command: 'rm -rf /' } }, ENV), null);
  assert.equal(decide({ agent_type: 'cdp5-agents:review-verify', tool_name: 'Read', tool_input: { file_path: 'x' } }, ENV), null);
});

test('CLI: deny JSON on stdout for a write, nothing for a read, exit 2 (fail closed) on unreadable input', () => {
  const run = (input) => spawnSync('node', [SCRIPT], { input, encoding: 'utf8', env: { ...process.env, ...ENV } });
  const w = run(JSON.stringify({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command: 'rm -rf /tmp/x' } }));
  assert.equal(w.status, 0);
  assert.equal(JSON.parse(w.stdout).hookSpecificOutput.permissionDecision, 'deny');
  const r = run(JSON.stringify({ agent_type: 'cdp5-agents:adversarial-auditor', tool_name: 'Bash', tool_input: { command: 'git log -1' } }));
  assert.equal(r.status, 0);
  assert.equal(r.stdout, '');
  const bad = run('not json');
  assert.equal(bad.status, 2);
  assert.match(bad.stderr, /failing closed/);
  const empty = run('');
  assert.equal(empty.status, 2);
});
