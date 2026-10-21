import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setup, briefLines, parseArgs, grantOptions } from '../scripts/worktree-setup.mjs';
import { activeGrant, DEFAULT_TTL_MS } from '../lib/grants.mjs';

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
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
  const a = parseArgs(['--repo=.', '--baseline=npm test', '--baseline=npm run lint', '--grant=adversarial-auditor', '--uses=2', '--json']);
  assert.deepEqual(a.baseline, ['npm test', 'npm run lint']);
  assert.equal(a.grant, 'adversarial-auditor');
  assert.equal(a.uses, '2');
  assert.equal(a.json, true);
});

test('grantOptions validates agent name, ttl, uses and the session up front', () => {
  const noPointer = { HOME: join(tmpdir(), 'no-such-home-for-cdp5') };
  assert.deepEqual(grantOptions({}, noPointer), { ttlMs: DEFAULT_TTL_MS, uses: 1, session: null });
  assert.deepEqual(grantOptions({ grant: 'review-verify', ttl: '30m', uses: '3', session: 's1' }, noPointer), { ttlMs: 1_800_000, uses: 3, session: 's1' });
  assert.match(grantOptions({ grant: 'cdp5-agents:review-verify', session: 's1' }, noPointer).error, /plain agent name/);
  assert.match(grantOptions({ grant: 'review-verify', ttl: '3d', session: 's1' }, noPointer).error, /ttl/);
  assert.match(grantOptions({ grant: 'review-verify', uses: '0', session: 's1' }, noPointer).error, /uses/);
  assert.match(grantOptions({ grant: 'review-verify' }, noPointer).error, /needs a session/, 'a grant without --session and without the bootstrap pointer is refused');
  assert.equal(grantOptions({ baseline: ['npm test'] }, noPointer).error, undefined, 'no grant requested: no session needed');
});

test('creates a detached worktree on the exact base, runs the baseline, issues the grant bound to the repository when green', () => {
  const { root, r, first, env } = repo();
  try {
    const wt = join(root, 'wt');
    const res = setup({ repo: r, base: first, path: wt, baseline: ['node -e "process.exit(0)"'], grant: 'adversarial-auditor', uses: '2', session: 's1' }, env);
    assert.equal(res.error, undefined, res.error);
    assert.equal(res.base, first);
    assert.ok(existsSync(join(wt, 'a.txt')));
    assert.equal(spawnSync('git', ['rev-parse', 'HEAD'], { cwd: wt, encoding: 'utf8' }).stdout.trim(), first, 'worktree sits on the base commit, not on HEAD');
    assert.equal(res.green, true);
    assert.equal(res.grant.agent, 'adversarial-auditor');
    assert.equal(res.grant.uses, 2);
    const grant = activeGrant('adversarial-auditor', env);
    assert.equal(grant.root, wt);
    assert.equal(grant.project, realpathSync.native(r), 'the grant is bound to the repository, not to the caller\'s cwd');
    const lines = briefLines(res);
    assert.match(lines[0], /^disposable environment: /);
    assert.match(lines[1], new RegExp(`^base commit: ${first}`));
    assert.match(lines[2], /baseline: node -e .* → exit 0/);
    assert.match(lines[3], /^  last output: \(none\)$/);
    assert.match(lines[4], /^run grant: adversarial-auditor until .* \(2 uses, project /);
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: r });
    rmSync(root, { recursive: true, force: true });
  }
});

test('the grant is bound to the session: --session wins, otherwise the bootstrap pointer is used', () => {
  const { root, r, first, env } = repo();
  try {
    const a = setup({ repo: r, base: first, path: join(root, 'wt-a'), baseline: [], grant: 'review-verify', session: 'sess-flag' }, env);
    assert.equal(a.error, undefined, a.error);
    assert.equal(activeGrant('review-verify', env).session, 'sess-flag');
    mkdirSync(join(root, '.cache', 'cdp5-agents'), { recursive: true });
    writeFileSync(join(root, '.cache', 'cdp5-agents', 'session'), 'sess-pointer\n');
    const b = setup({ repo: r, base: first, path: join(root, 'wt-b'), baseline: [], grant: 'adversarial-auditor' }, env);
    assert.equal(b.error, undefined, b.error);
    assert.equal(activeGrant('adversarial-auditor', env).session, 'sess-pointer');
    assert.match(briefLines(b).join('\n'), /session sess-pointer/);
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: r });
    rmSync(root, { recursive: true, force: true });
  }
});

test('a red baseline keeps the worktree, issues no grant and exits 1; usage errors exit 2', () => {
  const { root, r, first, env } = repo();
  try {
    const wt = join(root, 'wt-red');
    const run = spawnSync('node', [SCRIPT, `--repo=${r}`, `--base=${first}`, `--path=${wt}`, '--baseline=node -e "console.log(1)"', '--baseline=node -e "console.error(\'boom\'); process.exit(3)"', '--grant=review-verify', '--session=s1'], { env, encoding: 'utf8' });
    assert.equal(run.status, 1, run.stdout + run.stderr);
    assert.match(run.stdout, /baseline: .*→ exit 0 \(\d+ s\)\n  last output: 1\nbaseline: .*→ exit 3 \(\d+ s\)\n  last output: boom/);
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

test('a bad --grant, --ttl or --uses is rejected before the worktree is created', () => {
  const { root, r, first, env } = repo();
  try {
    for (const [name, flag] of [['ttl', '--ttl=3d'], ['grant', '--grant=cdp5-agents:review-verify'], ['uses', '--uses=0']]) {
      const wt = join(root, `wt-${name}`);
      const args = [SCRIPT, `--repo=${r}`, `--base=${first}`, `--path=${wt}`, flag];
      if (name !== 'grant') args.push('--grant=review-verify');
      args.push('--session=s1');
      const run = spawnSync('node', args, { env, encoding: 'utf8' });
      assert.equal(run.status, 2, `${flag}: ${run.stdout}${run.stderr}`);
      assert.match(run.stderr, new RegExp(name === 'grant' ? 'plain agent name' : name));
      assert.ok(!existsSync(wt), `${flag}: no stray worktree`);
      assert.equal(activeGrant('review-verify', env), null);
    }
    const noSession = spawnSync('node', [SCRIPT, `--repo=${r}`, `--base=${first}`, `--path=${join(root, 'wt-nosession')}`, '--grant=review-verify'], { env, encoding: 'utf8' });
    assert.equal(noSession.status, 2, noSession.stdout + noSession.stderr);
    assert.match(noSession.stderr, /needs a session/);
    assert.ok(!existsSync(join(root, 'wt-nosession')), 'no stray worktree without a session');
    assert.equal(spawnSync('git', ['worktree', 'list'], { cwd: r, encoding: 'utf8' }).stdout.trim().split('\n').length, 1, 'only the main worktree exists');
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: r });
    rmSync(root, { recursive: true, force: true });
  }
});

test('a pipeline that hides a failing command stays red, also inside a nested bash -c', { skip: process.platform === 'win32' }, () => {
  const { root, r, first, env } = repo();
  try {
    const plain = setup({ repo: r, base: first, path: join(root, 'wt-pipe'), baseline: ['node -e "process.exit(4)" | tail -1'] }, env);
    assert.equal(plain.green, false);
    assert.equal(plain.baseline[0].exit, 4);
    const nested = setup({ repo: r, base: first, path: join(root, 'wt-nested'), baseline: [`bash -c 'node -e "process.exit(5)" | tail -1'`] }, env);
    assert.equal(nested.green, false);
    assert.equal(nested.baseline[0].exit, 5);
    const green = setup({ repo: r, base: first, path: join(root, 'wt-green'), baseline: ['node -e "console.log(\'904 passed\')" | tail -1'] }, env);
    assert.equal(green.green, true);
    assert.match(briefLines(green).join('\n'), /→ exit 0 \(\d+ s\)\n  last output: 904 passed/);
  } finally {
    spawnSync('git', ['worktree', 'prune'], { cwd: r });
    rmSync(root, { recursive: true, force: true });
  }
});
