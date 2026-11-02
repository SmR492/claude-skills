import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'run.mjs');

function withDirs(fn) {
  const dir = mkdtempSync(join(tmpdir(), 'probe-run-'));
  try {
    const run = (args, env = {}) => spawnSync('node', [SCRIPT, ...args], { cwd: dir, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: dir, ...env } });
    return fn(dir, run);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

test('prints its argv and writes R/run.json with the argv, including appended hook arguments', () => {
  withDirs((dir, run) => {
    const args = ['status', '--session-id', 's1', '--data-dir', '/d', '--hook-token', 'PROBE-MARKER-s1'];
    const r = run(args);
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(r.stdout.trim().split('\n')[0]).argv, args);
    const written = JSON.parse(readFileSync(join(dir, 'R', 'run.json'), 'utf8'));
    assert.deepEqual(written.argv, args);
    assert.equal(written.cwd, dir);
  });
});

test('honours CDP6_PROBE_R for the run directory', () => {
  withDirs((dir, run) => {
    const r = run(['status'], { CDP6_PROBE_R: join(dir, 'elsewhere') });
    assert.equal(r.status, 0);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'elsewhere', 'run.json'), 'utf8')).argv, ['status']);
  });
});

test('A-19 and A-22: records whether it could read the key, without the key itself', () => {
  withDirs((dir, run) => {
    run(['status']);
    assert.deepEqual(JSON.parse(readFileSync(join(dir, 'R', 'run.json'), 'utf8')).key, { readable: false, error: 'ENOENT' });
    mkdirSync(join(dir, '.config', 'cdp6-core'), { recursive: true });
    writeFileSync(join(dir, '.config', 'cdp6-core', 'hook.key'), 'PROBE-KEY-0123456789abcdef');
    run(['status']);
    const text = readFileSync(join(dir, 'R', 'run.json'), 'utf8');
    assert.deepEqual(JSON.parse(text).key, { readable: true, bytes: 26 });
    assert.equal(text.includes('0123456789abcdef'), false);
  });
});

test('fires: a refused write exits 1 and names the error code', () => {
  withDirs((dir, run) => {
    writeFileSync(join(dir, 'R'), 'a file where the directory should be');
    const r = run(['status']);
    assert.equal(r.status, 1);
    assert.match(r.stderr, /run\.json not written \(E[A-Z]+\)/);
  });
});

test('A-20: records the process chain from the stub up, with exe real path and cmdline per ancestor', { skip: process.platform !== 'linux' }, () => {
  withDirs((dir, run) => {
    const r = run(['status']);
    const chain = JSON.parse(readFileSync(join(dir, 'R', 'run.json'), 'utf8')).chain;
    assert.equal(chain[0].pid, r.pid);
    assert.equal(chain[1].pid, process.pid);
    assert.match(chain[0].cmdline, /run\.mjs status/);
    assert.ok(chain[1].exe.length > 0);
    assert.ok(chain.length >= 3);
  });
});
