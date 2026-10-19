import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setup, briefLines, parseArgs } from '../scripts/worktree-setup.mjs';
import { activeGrant } from '../lib/grants.mjs';

const PLUGIN = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const SCRIPT = join(PLUGIN, 'scripts', 'worktree-setup.mjs');

function repo() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-wt-'));
  const r = join(root, 'repo');
  mkdirSync(r);
  const g = (...a) => spawnSync('git', a, { cwd: r, encoding: 'utf8' });
  g('init', '-q');
  g('config', 'user.email', 't@example.org');
  g('config', 'user.name', 'T');
  writeFileSync(join(r, 'a.txt'), 'one\n');
  g('add', 'a.txt');
  g('commit', '-q', '-m', 'one');
  const first = g('rev-parse', 'HEAD').stdout.trim();
  writeFileSync(join(r, 'a.txt'), 'two\n');
  g('commit', '-q', '-am', 'two');
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  return { root, r, first, env };
}

test('parseArgs collects repeated --baseline and plain flags', () => {
  const a = parseArgs(['--repo=.', '--baseline=npm test', '--baseline=npm run lint', '--grant=adversarial-auditor', '--json']);
  assert.deepEqual(a.baseline, ['npm test', 'npm run lint']);
  assert.equal(a.grant, 'adversarial-auditor');
  assert.equal(a.json, true);
});

test('creates a detached worktree on the exact base, runs the baseline, issues the grant when green', () => {
  const { root, r, first, env } = repo();
  try {
    const wt = join(root, 'wt');
    const res = setup({ repo: r, base: first, path: wt, baseline: ['node -e "process.exit(0)"'], grant: 'adversarial-auditor' }, env);
    assert.equal(res.error, undefined, res.error);
    assert.equal(res.base, first);
    assert.ok(existsSync(join(wt, 'a.txt')));
    assert.equal(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).stdout.trim(), first, 'worktree sits on the base commit, not on HEAD');
    assert.equal(res.green, true);
    assert.equal(res.grant.agent, 'adversarial-auditor');
    assert.equal(activeGrant('adversarial-auditor', env).root, wt);
    const lines = briefLines(res);
    assert.match(lines[0], /^disposable environment: /);
    assert.match(lines[1], new RegExp(`^base commit: ${first}`));
    assert.match(lines[2], /baseline: node -e .* → exit 0/);
    assert.match(lines[3], /^run grant: adversarial-auditor until/);
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: r });
    rmSync(root, { recursive: true, force: true });
  }
});

test('a red baseline keeps the worktree, issues no grant and exits 1; usage errors exit 2', () => {
  const { root, r, first, env } = repo();
  try {
    const wt = join(root, 'wt-red');
    const run = spawnSync('node', [SCRIPT, `--repo=${r}`, `--base=${first}`, `--path=${wt}`, '--baseline=node -e "console.log(1)"', '--baseline=node -e "console.error(\'boom\'); process.exit(3)"', '--grant=review-verify'], { env, encoding: 'utf8' });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stdout, /baseline: .*→ exit 0\nbaseline: .*→ exit 3/);
    assert.match(run.stdout, /run grant: not issued for review-verify \(baseline red\)/);
    assert.match(run.stdout, /boom/);
    assert.ok(existsSync(wt), 'the worktree stays for inspection');
    assert.equal(activeGrant('review-verify', env), null);
    assert.equal(spawnSync('node', [SCRIPT], { env, encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync('node', [SCRIPT, `--repo=${r}`, '--base=deadbeef', `--path=${join(root, 'x')}`], { env, encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync('node', [SCRIPT, `--repo=${root}`, `--path=${join(root, 'y')}`], { env, encoding: 'utf8' }).status, 2, 'not a repository');
    assert.equal(spawnSync('node', [SCRIPT, `--repo=${r}`, `--base=${first}`, `--path=${wt}`], { env, encoding: 'utf8' }).status, 2, 'existing path');
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: r });
    rmSync(root, { recursive: true, force: true });
  }
});
