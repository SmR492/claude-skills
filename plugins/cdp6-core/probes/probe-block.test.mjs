import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'probe-block.mjs');
const TEMPLATE = join(dirname(fileURLToPath(import.meta.url)), 'probe-hooks-block.json');

function withHome(fn) {
  const home = mkdtempSync(join(tmpdir(), 'probe-block-'));
  try {
    return fn(home, (args, env = {}) => {
      const t0 = Date.now();
      const r = spawnSync('node', [SCRIPT, ...args], { input: '{"hook_event_name":"PreToolUse"}', encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home, ...env } });
      let lines = [];
      try {
        lines = readFileSync(join(home, '.cache', 'cdp6-probe', 'probe-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
      } catch {}
      return { r, lines, ms: Date.now() - t0 };
    });
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

test('ok logs that the guard ran and returns at once', () => {
  withHome((home, run) => {
    const { r, lines, ms } = run(['ok'], { CDP6_PROBE_SLEEP_MS: '5000' });
    assert.equal(r.status, 0);
    assert.equal(lines[0].tag, 'block-ran');
    assert.ok(ms < 4000);
  });
});

test('sleep waits for CDP6_PROBE_SLEEP_MS before it logs', () => {
  withHome((home, run) => {
    const { r, lines, ms } = run(['sleep'], { CDP6_PROBE_SLEEP_MS: '600' });
    assert.equal(r.status, 0);
    assert.ok(ms >= 600, String(ms));
    assert.equal(lines[0].tag, 'block-ran');
  });
});

test('the settings template blocks on failure and keeps the placeholders for plugin path, script and argument', () => {
  const text = readFileSync(TEMPLATE, 'utf8');
  const hook = JSON.parse(text).hooks.PreToolUse[0].hooks[0];
  assert.equal(hook.onFailure, 'block');
  assert.equal(hook.timeout, 10);
  assert.equal(hook.command, 'node "<PLUGIN>/probes/<SCRIPT>" <ARG>');
});
