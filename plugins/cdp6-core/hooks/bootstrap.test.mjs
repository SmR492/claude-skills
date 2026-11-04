import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, chmodSync, readFileSync, statSync, symlinkSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tempDir } from '../test-support/temp-dir.mjs';

const BOOTSTRAP = join(dirname(fileURLToPath(import.meta.url)), 'bootstrap.mjs');

function start(home) {
  return spawnSync(process.execPath, [BOOTSTRAP], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's-1' }),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: home },
  });
}

test('bootstrap creates a missing host key with mode 0600 in a 0700 directory and prints nothing of it', () => {
  const home = tempDir('cdp6-boot-');
  const r = start(home);
  assert.equal(r.status, 0, r.stderr);
  const file = join(home, '.config', 'cdp6-core', 'hook.key');
  assert.equal(statSync(file).mode & 0o777, 0o600);
  assert.equal(statSync(dirname(file)).mode & 0o777, 0o700);
  const key = readFileSync(file);
  assert.equal(key.length, 32);
  assert.ok(!r.stdout.includes(key.toString('hex')) && !r.stderr.includes(key.toString('hex')));
  assert.ok(!r.stdout.includes(key.toString('base64')) && !r.stderr.includes(key.toString('base64')));
});

test('fires: existing key overwritten', () => {
  const home = tempDir('cdp6-boot-');
  mkdirSync(join(home, '.config', 'cdp6-core'), { recursive: true });
  const file = join(home, '.config', 'cdp6-core', 'hook.key');
  const known = Buffer.alloc(32, 9);
  writeFileSync(file, known, { mode: 0o600 });
  const r = start(home);
  assert.equal(r.status, 0, r.stderr);
  assert.ok(readFileSync(file).equals(known), 'the host key file changed');
  const again = start(home);
  assert.equal(again.status, 0);
  assert.ok(readFileSync(file).equals(known), 'the host key file changed');
});

test('bootstrap leaves an existing key of another length untouched', () => {
  const home = tempDir('cdp6-boot-');
  mkdirSync(join(home, '.config', 'cdp6-core'), { recursive: true });
  const file = join(home, '.config', 'cdp6-core', 'hook.key');
  writeFileSync(file, 'short', { mode: 0o600 });
  start(home);
  assert.equal(readFileSync(file, 'utf8'), 'short');
});

function runWorld(over = {}) {
  const base = tempDir('cdp6-boot-run-');
  const w = { base, home: join(base, 'home'), data: join(base, 'data'), repo: join(base, 'repo') };
  mkdirSync(w.repo, { recursive: true });
  mkdirSync(w.data, { recursive: true });
  const R = join(w.repo, 'docs', 'cdp6', 'runs', 'RUN-20261102-x');
  const S = join(w.data, 'runs', 'RUN-20261102-x');
  mkdirSync(S, { recursive: true });
  const phases = {};
  for (const p of ['idea', 'exploration', 'concept', 'refinement', 'implementation', 'verification', 'retro', 'loop-back']) phases[p] = { state: 'pending', cycle: 1 };
  Object.assign(phases, over.phases ?? {});
  writeFileSync(join(S, 'run.json'), JSON.stringify({ run_id: 'RUN-20261102-x', status: over.status ?? 'active', mode: 'single', root: w.repo, run_dir: R, journal_offset: 0, phases }));
  writeFileSync(join(w.data, 'active-runs.json'), JSON.stringify({ sessions: { 's-1': { run_id: 'RUN-20261102-x', project_root: w.repo } }, projects: { [w.repo]: 'RUN-20261102-x' } }));
  return { ...w, R, S };
}

function startIn(w, source, over = {}) {
  const env = { PATH: process.env.PATH, HOME: w.home };
  if (over.data !== null) env.CLAUDE_PLUGIN_DATA = over.data ?? w.data;
  return spawnSync(process.execPath, [BOOTSTRAP], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source, session_id: 's-1', cwd: w.repo }),
    encoding: 'utf8',
    env,
  });
}

function context(r) {
  assert.equal(r.status, 0, r.stderr);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'SessionStart');
  return out.additionalContext;
}

test('prints run status after compact', () => {
  const w = runWorld({ phases: { idea: { state: 'entered', cycle: 1 } } });
  const text = context(startIn(w, 'compact'));
  assert.match(text, /run: RUN-20261102-x\n/);
  assert.match(text, /phase: idea entered\n/);
  assert.match(text, /next: work in idea, then run\.mjs exit idea\n/);
  assert.ok(text.includes(`ledger: ${join(w.S, 'ledger.md')}`), text);
  assert.ok(!text.includes(w.R), text);
  assert.ok(existsSync(join(w.home, '.config', 'cdp6-core', 'hook.key')));
});

test('prints run status for the sources startup, resume and clear', () => {
  const w = runWorld();
  for (const source of ['startup', 'resume', 'clear']) {
    const text = context(startIn(w, source));
    assert.match(text, /phase: none entered\n/, source);
    assert.match(text, /next: run\.mjs enter idea\n/, source);
  }
});

test('prints the gate state and the owner step of a phase waiting for approval', () => {
  const w = runWorld({ phases: { idea: { state: 'gate-pending', cycle: 1, gate: { passed: true } } } });
  const text = context(startIn(w, 'resume'));
  assert.match(text, /phase: idea gate-pending\n/);
  assert.match(text, /next: run\.mjs approve idea \(owner\)\n/);
});

test('stays silent without an active run and with an unknown data directory', () => {
  const none = runWorld({ status: 'DONE' });
  assert.equal(startIn(none, 'compact').stdout, '');
  const lost = runWorld();
  assert.equal(startIn(lost, 'compact', { data: join(lost.base, 'elsewhere') }).stdout, '');
  assert.equal(startIn(lost, 'compact', { data: null }).stdout, '');
  assert.ok(existsSync(join(lost.home, '.config', 'cdp6-core', 'hook.key')));
});

test('bootstrap started through a symlinked plugin root still creates the host key', () => {
  const home = tempDir('cdp6-boot-');
  const link = join(home, 'plugin-link');
  symlinkSync(dirname(dirname(BOOTSTRAP)), link);
  const r = spawnSync(process.execPath, [join(link, 'hooks', 'bootstrap.mjs')], {
    input: JSON.stringify({ hook_event_name: 'SessionStart', source: 'startup', session_id: 's-1' }),
    encoding: 'utf8',
    env: { PATH: process.env.PATH, HOME: home },
  });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(home, '.config', 'cdp6-core', 'hook.key')));
});

test('every firing appends a hooks observed line, also for a source that prints nothing', () => {
  const w = runWorld();
  startIn(w, 'startup');
  startIn(w, 'other');
  const lines = readFileSync(join(w.data, 'hooks-fired.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const version = JSON.parse(readFileSync(join(dirname(BOOTSTRAP), '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;
  assert.deepEqual(lines.map((l) => ({ ...l, at: typeof l.at })), [
    { hook: 'bootstrap.mjs', version, at: 'string', session_id: 's-1', tool_use_id: null, permission_mode: null, decision: 'none', agent_id: null, capture_sha256: null },
    { hook: 'bootstrap.mjs', version, at: 'string', session_id: 's-1', tool_use_id: null, permission_mode: null, decision: 'none', agent_id: null, capture_sha256: null },
  ]);
});

test('fires: bootstrap resets an existing key directory to mode 0700 and keeps the key', () => {
  const home = tempDir('cdp6-boot-');
  const dir = join(home, '.config', 'cdp6-core');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, 'hook.key');
  const known = Buffer.alloc(32, 7);
  writeFileSync(file, known, { mode: 0o600 });
  chmodSync(dir, 0o755);
  const r = start(home);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(statSync(dir).mode & 0o777, 0o700);
  assert.ok(readFileSync(file).equals(known), 'the host key file changed');
});

test('stays silent for a source other than the four', () => {
  const w = runWorld();
  assert.equal(startIn(w, 'other').stdout, '');
});
