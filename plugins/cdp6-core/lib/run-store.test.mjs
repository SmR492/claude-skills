import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, utimesSync, existsSync, realpathSync, renameSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  initRun,
  readRun,
  updateRun,
  allocId,
  runPaths,
  isActiveRun,
  bindSession,
  findRun,
  projectRootOf,
  TERMINAL_STATUSES,
} from './run-store.mjs';

const STORE = fileURLToPath(new URL('./run-store.mjs', import.meta.url));

function tmp(prefix) {
  return mkdtempSync(join(tmpdir(), `cdp6-rs-${prefix}-`));
}

function newRun() {
  const R = join(tmp('run'), 'RUN-20260101-x');
  initRun(R, { run_id: 'RUN-20260101-x', status: 'active', counter: 0, ids: { next: {} }, phases: {} });
  return R;
}

function child(code) {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, ['--input-type=module', '-e', code], { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (status) => resolve({ status, out, err }));
  });
}

test('fires: concurrent writers', async () => {
  const R = newRun();
  const code = (tag) => `
    import { updateRun } from ${JSON.stringify(STORE)};
    for (let i = 0; i < 25; i++) updateRun(${JSON.stringify(R)}, '${tag}', (run) => { run.counter += 1; });
  `;
  const results = await Promise.all([child(code('a')), child(code('b'))]);
  for (const r of results) assert.equal(r.status, 0, r.err);
  const run = JSON.parse(readFileSync(runPaths(R).runJson, 'utf8'));
  assert.equal(run.counter, 50);
  const lines = readFileSync(runPaths(R).journal, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.filter((l) => l.op === 'a').length, 25);
  assert.equal(lines.filter((l) => l.op === 'b').length, 25);
  const seqs = lines.map((l) => l.seq);
  assert.deepEqual(seqs, [...seqs].sort((x, y) => x - y));
  assert.equal(new Set(seqs).size, seqs.length);
  assert.equal(run.journal_offset, lines.at(-1).seq);
});

test('fires: duplicate id under concurrency', async () => {
  const R = newRun();
  const code = `
    import { allocId } from ${JSON.stringify(STORE)};
    const ids = [];
    for (let i = 0; i < 40; i++) ids.push(allocId(${JSON.stringify(R)}, 'D'));
    console.log(JSON.stringify(ids));
  `;
  const results = await Promise.all([child(code), child(code), child(code)]);
  for (const r of results) assert.equal(r.status, 0, r.err);
  const all = results.flatMap((r) => JSON.parse(r.out));
  assert.equal(all.length, 120);
  assert.equal(new Set(all).size, 120);
  assert.equal(readRun(R).ids.next.D, 121);
});

test('allocId allocates per kind and rejects an unknown kind', () => {
  const R = newRun();
  assert.equal(allocId(R, 'D'), 'D-1');
  assert.equal(allocId(R, 'D'), 'D-2');
  assert.equal(allocId(R, 'I'), 'I-1');
  assert.throws(() => allocId(R, 'ZZ'), /kind/);
});

test('fires: unknown terminal status', () => {
  const R = newRun();
  assert.ok(TERMINAL_STATUSES.includes('HALT-STOP'));
  assert.throws(() => updateRun(R, 'bad', (run) => { run.status = 'HALT-WHATEVER'; }), /status/);
  assert.equal(readRun(R).status, 'active');
  updateRun(R, 'halt', (run) => { run.status = 'HALT-STOP'; });
  assert.equal(readRun(R).status, 'HALT-STOP');
});

test('fires: unreadable run record', () => {
  const R = newRun();
  writeFileSync(runPaths(R).runJson, '{"run_id": "RUN-2026');
  assert.throws(() => readRun(R), (e) => e.code === 'run-unreadable');
  assert.throws(() => updateRun(R, 'x', () => {}), (e) => e.code === 'run-unreadable');
});

test('a failing mutation leaves run.json and the journal untouched', () => {
  const R = newRun();
  const before = readFileSync(runPaths(R).journal, 'utf8');
  assert.throws(() => updateRun(R, 'boom', () => { throw new Error('boom'); }), /boom/);
  assert.equal(readFileSync(runPaths(R).journal, 'utf8'), before);
  assert.equal(readRun(R).counter, 0);
});

test('fires: lock held by a live writer younger than the timeout', () => {
  const R = newRun();
  writeFileSync(runPaths(R).lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  assert.throws(() => updateRun(R, 'x', () => {}, { waitMs: 150, staleMs: 60_000 }), (e) => e.code === 'lock-busy');
});

test('breaks a stale lock and writes a journal line for it', () => {
  const R = newRun();
  const lock = runPaths(R).lock;
  writeFileSync(lock, JSON.stringify({ pid: 999999, at: 1 }));
  const old = new Date(Date.now() - 120_000);
  utimesSync(lock, old, old);
  updateRun(R, 'after-stale', (run) => { run.counter = 7; }, { waitMs: 150, staleMs: 1000 });
  const lines = readFileSync(runPaths(R).journal, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.ok(lines.some((l) => l.op === 'lock-broken'));
  assert.equal(readRun(R).counter, 7);
  assert.ok(!existsSync(lock));
});

test('active run notion: every status except DONE and an ABANDONED run after its P8 exit', () => {
  assert.equal(isActiveRun({ status: 'active' }), true);
  assert.equal(isActiveRun({ status: 'HALT-STOP' }), true);
  assert.equal(isActiveRun({ status: 'PARKED' }), true);
  assert.equal(isActiveRun({ status: 'DONE' }), false);
  assert.equal(isActiveRun({ status: 'ABANDONED', phases: { 'loop-back': { state: 'pending' } } }), true);
  assert.equal(isActiveRun({ status: 'ABANDONED', phases: { 'loop-back': { state: 'exited' } } }), false);
});

function gitRepo() {
  const dir = tmp('repo');
  spawnSync('git', ['init', '-q', dir]);
  spawnSync('git', ['-C', dir, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '--allow-empty', '-m', 'i']);
  return dir;
}

function stateRun(data, repo, name, over = {}) {
  const runId = `RUN-20260101-${name}`;
  const R = over.run_dir ?? join(repo, 'docs', 'cdp6', 'runs', runId);
  const S = join(data, 'runs', runId);
  initRun(S, { run_id: runId, status: 'active', root: repo, run_dir: R, phases: {}, ids: { next: {} }, ...over });
  return { runId, R, S };
}

test('run lookup: by the bound session id first', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const { runId, S, R } = stateRun(data, repo, 'x');
  bindSession(data, { sessionId: 'sess-1', runId, projectRoot: repo });
  const found = findRun({ dataDir: data, sessionId: 'sess-1', cwd: tmp('elsewhere') });
  assert.equal(found.S, S);
  assert.equal(found.R, R);
  assert.equal(found.via, 'session');
  const none = findRun({ dataDir: data, sessionId: 'other', cwd: tmp('elsewhere') });
  assert.equal(none.S, undefined);
  assert.equal(none.none, true);
});

test('run lookup: by cwd prefix, a linked worktree maps to the main checkout, a hidden nested repo does not escape the session binding', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const { runId, S } = stateRun(data, repo, 'x');
  bindSession(data, { sessionId: 'sess-1', runId, projectRoot: repo });
  assert.equal(findRun({ dataDir: data, sessionId: 'unbound', cwd: join(repo, 'src') }).S, S);
  const wt = join(tmp('wt'), 'w1');
  const r = spawnSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'w1', wt]);
  assert.equal(r.status, 0, String(r.stderr));
  const viaWt = findRun({ dataDir: data, sessionId: 'unbound', cwd: wt });
  assert.equal(viaWt.S, S);
  assert.equal(viaWt.via, 'path');
  const nested = join(repo, 'sub');
  mkdirSync(nested);
  spawnSync('git', ['init', '-q', nested]);
  assert.equal(findRun({ dataDir: data, sessionId: 'sess-1', cwd: nested }).S, S);
});

test('run lookup: a session binding to a run that is not active falls through to the path lookup', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const done = stateRun(data, repo, 'a', { status: 'DONE' });
  const live = stateRun(data, repo, 'b');
  bindSession(data, { sessionId: 'sess-1', runId: done.runId, projectRoot: repo });
  bindSession(data, { sessionId: 'sess-2', runId: live.runId, projectRoot: repo });
  const found = findRun({ dataDir: data, sessionId: 'sess-1', cwd: repo });
  assert.equal(found.S, live.S);
  assert.equal(found.via, 'path');
  assert.equal(findRun({ dataDir: data, sessionId: 'sess-2', cwd: tmp('elsewhere') }).via, 'session');
});

test('run lookup: a session binding to an unreadable run stays an error', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const { runId, S } = stateRun(data, repo, 'a');
  bindSession(data, { sessionId: 'sess-1', runId, projectRoot: repo });
  writeFileSync(join(S, 'run.json'), '{');
  assert.equal(findRun({ dataDir: data, sessionId: 'sess-1', cwd: repo }).error, 'run-unreadable');
});

test('run lookup: a pointer entry that names an invalid run id is an error', () => {
  const data = tmp('data');
  const repo = gitRepo();
  writeFileSync(join(data, 'active-runs.json'), JSON.stringify({ sessions: { 'sess-1': { run_id: '../../etc' } }, projects: {} }));
  assert.equal(findRun({ dataDir: data, sessionId: 'sess-1', cwd: repo }).error, 'pointer-unreadable');
});

test('fires: missing pointer scan reads the state directories for an active run of the project', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const { S, R } = stateRun(data, repo, 'x');
  const found = findRun({ dataDir: data, sessionId: 'sess-1', cwd: repo });
  assert.deepEqual([found.error, found.S, found.R], ['pointer-missing', S, R]);
  const inside = findRun({ dataDir: data, sessionId: 'sess-1', cwd: join(repo, 'src') });
  assert.equal(inside.error, 'pointer-missing');
});

test('fires: run lookup by the target path of a file inside R from a cwd outside the project', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const { S, R } = stateRun(data, repo, 'a');
  const found = findRun({ dataDir: data, sessionId: 'sess-1', cwd: tmp('elsewhere'), targetPath: join(R, 'idea', 'idea.md') });
  assert.deepEqual([found.error, found.S], ['pointer-missing', S]);
  const fresh = findRun({ dataDir: data, sessionId: 'sess-1', cwd: tmp('elsewhere'), targetPath: join(R, 'idea', 'not-yet', 'x.md') });
  assert.equal(fresh.error, 'pointer-missing');
});

test('fires: missing pointer scan matches a company run directory outside the project through the R in run.json', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const home = tmp('home');
  const R = join(home, '.claude', 'projects', repo.replace(/[^A-Za-z0-9]/g, '-'), 'memory', 'cdp6', 'runs', 'RUN-20260101-c');
  const { S } = stateRun(data, repo, 'c', { run_dir: R });
  const viaTarget = findRun({ dataDir: data, sessionId: 's', cwd: tmp('elsewhere'), targetPath: join(R, 'idea', 'idea.md') });
  assert.deepEqual([viaTarget.error, viaTarget.S], ['pointer-missing', S]);
});

test('run lookup: the missing pointer scan ignores a run of another project, a finished run and run files in the project tree', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const other = gitRepo();
  stateRun(data, other, 'o');
  stateRun(data, repo, 'd', { status: 'DONE' });
  const old = join(repo, 'docs', 'cdp6', 'runs', 'RUN-20260101-old');
  mkdirSync(old, { recursive: true });
  writeFileSync(join(old, 'run.json'), JSON.stringify({ run_id: 'RUN-20260101-old', status: 'active' }));
  assert.equal(findRun({ dataDir: data, sessionId: 's', cwd: repo }).none, true);
});

test('run lookup: the missing pointer scan skips an entry without run.json and denies an unreadable run.json', () => {
  const data = tmp('data');
  const repo = gitRepo();
  mkdirSync(join(data, 'runs', 'RUN-20260101-empty'), { recursive: true });
  writeFileSync(join(data, 'runs', 'notes.md'), 'x\n');
  assert.equal(findRun({ dataDir: data, sessionId: 's', cwd: repo }).none, true);
  const bad = join(data, 'runs', 'RUN-20260101-bad');
  mkdirSync(bad);
  writeFileSync(join(bad, 'run.json'), '{');
  const found = findRun({ dataDir: data, sessionId: 's', cwd: repo });
  assert.deepEqual([found.error, found.S], ['pointer-missing', bad]);
});


test('project root: a linked worktree maps to its main checkout', () => {
  const repo = realpathSync(gitRepo());
  const wt = join(realpathSync(tmp('wt')), 'w1');
  const r = spawnSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'w1', wt]);
  assert.equal(r.status, 0, String(r.stderr));
  assert.equal(projectRootOf(wt), repo);
});

test('fires: a repository whose commondir names another repository keeps its own top level', () => {
  const victim = realpathSync(gitRepo());
  const mine = realpathSync(gitRepo());
  writeFileSync(join(mine, '.git', 'commondir'), `${join(victim, '.git')}\n`);
  assert.equal(projectRootOf(mine), mine);
});

test('fires: a worktree-looking .git file that the common directory does not name back keeps its own top level', () => {
  const victim = realpathSync(gitRepo());
  const wt = join(realpathSync(tmp('fake')), 'w1');
  mkdirSync(wt);
  const admin = join(victim, '.git', 'worktrees', 'ghost');
  mkdirSync(admin, { recursive: true });
  writeFileSync(join(admin, 'gitdir'), `${join(wt, 'elsewhere', '.git')}\n`);
  writeFileSync(join(admin, 'HEAD'), 'ref: refs/heads/master\n');
  writeFileSync(join(admin, 'commondir'), '../..\n');
  writeFileSync(join(wt, '.git'), `gitdir: ${admin}\n`);
  assert.equal(projectRootOf(wt), wt);
});

test('pointer: active-runs.json maps the session id and the project root to the run id, S follows from the run id and R from run.json', () => {
  const data = tmp('data');
  const repo = gitRepo();
  const runId = 'RUN-20260101-p';
  const R = join(repo, 'docs', 'cdp6', 'runs', runId);
  const S = join(data, 'runs', runId);
  initRun(S, { run_id: runId, status: 'active', root: repo, run_dir: R, phases: {}, ids: { next: {} } });
  bindSession(data, { sessionId: 'sess-1', runId, projectRoot: repo });
  const pointer = JSON.parse(readFileSync(join(data, 'active-runs.json'), 'utf8'));
  assert.equal(pointer.sessions['sess-1'].run_id, runId);
  assert.equal(pointer.projects[repo], runId);
  assert.ok(!JSON.stringify(pointer).includes(R), 'the pointer holds the run directory');
  const bySession = findRun({ dataDir: data, sessionId: 'sess-1', cwd: tmp('elsewhere') });
  assert.equal(bySession.S, S);
  assert.equal(bySession.R, R);
  assert.equal(bySession.via, 'session');
  const byPath = findRun({ dataDir: data, sessionId: 'unbound', cwd: join(repo, 'src') });
  assert.equal(byPath.S, S);
  assert.equal(byPath.R, R);
  assert.equal(byPath.via, 'path');
});

test('fires: core.worktree of a nested repository does not move the project root outside the working directory', () => {
  const base = realpathSync(tmp('wt'));
  const proj = join(base, 'proj');
  const outside = join(base, 'outside');
  mkdirSync(outside);
  spawnSync('git', ['init', '-q', proj]);
  spawnSync('git', ['init', '-q', join(proj, 'sub')]);
  spawnSync('git', ['-C', join(proj, 'sub'), 'config', 'core.worktree', outside]);
  assert.equal(projectRootOf(join(proj, 'sub')), join(proj, 'sub'));
});

test('project root: a top level that contains the working directory is accepted', () => {
  const repo = realpathSync(gitRepo());
  mkdirSync(join(repo, 'src', 'deep'), { recursive: true });
  assert.equal(projectRootOf(join(repo, 'src', 'deep')), repo);
});

test('fires: a .git file that is a symbolic link is not read, so the working tree keeps its own top level', () => {
  const repo = realpathSync(gitRepo());
  const wt = join(realpathSync(tmp('wt')), 'w1');
  const r = spawnSync('git', ['-C', repo, 'worktree', 'add', '-q', '-b', 'w1', wt]);
  assert.equal(r.status, 0, String(r.stderr));
  assert.equal(projectRootOf(wt), repo);
  const elsewhere = join(realpathSync(tmp('elsewhere')), 'dotgit');
  renameSync(join(wt, '.git'), elsewhere);
  symlinkSync(elsewhere, join(wt, '.git'));
  assert.equal(projectRootOf(wt), wt);
});
