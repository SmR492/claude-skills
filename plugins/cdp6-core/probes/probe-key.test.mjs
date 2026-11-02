import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, statSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'probe-key.mjs');

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'probe-key-'));
  try {
    const run = (mode, input = '{}', env = {}) => spawnSync('node', [SCRIPT, mode], { input, encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home, ...env } });
    return fn(home, run, join(home, '.config', 'cdp6-core', 'hook.key'));
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test('write creates a probe key with mode 0600 on the A-22 row only', () => {
  withHome((home, run, key) => {
    assert.equal(run('write').status, 0);
    assert.equal(existsSync(key), false);
    const r = run('write', '{}', { CDP6_PROBE_ROW: 'A-22' });
    assert.equal(r.status, 0);
    assert.match(readFileSync(key, 'utf8'), /^PROBE-KEY-[0-9a-f]{32}$/);
    assert.equal(statSync(key).mode & 0o777, 0o600);
  });
});

test('fires: write never replaces an existing key', () => {
  withHome((home, run, key) => {
    mkdirSync(dirname(key), { recursive: true });
    writeFileSync(key, 'REAL-KEY-IN-USE');
    run('write', '{}', { CDP6_PROBE_ROW: 'A-22' });
    assert.equal(readFileSync(key, 'utf8'), 'REAL-KEY-IN-USE');
    rmSync(key);
    run('write', '{}', { CDP6_PROBE_ROW: 'A-22' });
    assert.match(readFileSync(key, 'utf8'), /^PROBE-KEY-[0-9a-f]{32}$/);
  });
});

test('delete removes a probe key', () => {
  withHome((home, run, key) => {
    run('write', '{}', { CDP6_PROBE_ROW: 'A-22' });
    const r = run('delete');
    assert.equal(r.status, 0);
    assert.equal(existsSync(key), false);
    assert.match(r.stdout, /deleted/);
  });
});

test('fires: delete refuses a key that is not a probe key', () => {
  withHome((home, run, key) => {
    mkdirSync(dirname(key), { recursive: true });
    writeFileSync(key, 'REAL-KEY-IN-USE');
    const r = run('delete');
    assert.equal(r.status, 1);
    assert.equal(readFileSync(key, 'utf8'), 'REAL-KEY-IN-USE');
    assert.match(r.stderr, /not a probe key/);
  });
});

test('delete of an absent key exits 0 and says so', () => {
  withHome((home, run) => {
    const r = run('delete');
    assert.equal(r.status, 0);
    assert.match(r.stdout, /absent/);
  });
});
