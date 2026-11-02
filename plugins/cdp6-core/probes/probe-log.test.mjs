import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'probe-log.mjs');

function run(input, args, env) {
  return spawnSync('node', [SCRIPT, ...args], { input, encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });
}

test('logs the full hook input of an event as one JSON line under HOME, not in the repository', () => {
  const home = mkdtempSync(join(tmpdir(), 'probe-log-'));
  try {
    const input = { session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt: 'p', subagent_type: 'cdp6-core:probe', name: 'n' }, extra: { deep: [1, 2] } };
    const r = run(JSON.stringify(input), ['pre'], { HOME: home });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    const file = join(home, '.cache', 'cdp6-probe', 'probe-log.jsonl');
    const lines = readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.equal(lines.length, 1);
    assert.deepEqual(lines[0].input, input);
    assert.equal(lines[0].tag, 'pre');
    assert.equal(lines[0].event, 'PreToolUse');
    assert.match(lines[0].ts, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('appends one line per call and honours CDP6_PROBE_LOG', () => {
  const home = mkdtempSync(join(tmpdir(), 'probe-log-'));
  try {
    const target = join(home, 'elsewhere', 'x.jsonl');
    run('{"hook_event_name":"SessionStart"}', ['a'], { HOME: home, CDP6_PROBE_LOG: target });
    run('{"hook_event_name":"SubagentStop"}', ['b'], { HOME: home, CDP6_PROBE_LOG: target });
    const lines = readFileSync(target, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    assert.deepEqual(lines.map((l) => l.event), ['SessionStart', 'SubagentStop']);
    assert.equal(existsSync(join(home, '.cache')), false);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('fires: unparsable stdin is logged raw and the hook still exits 0 without a decision', () => {
  const home = mkdtempSync(join(tmpdir(), 'probe-log-'));
  try {
    const r = run('not json', ['x'], { HOME: home });
    assert.equal(r.status, 0);
    assert.equal(r.stdout, '');
    const line = JSON.parse(readFileSync(join(home, '.cache', 'cdp6-probe', 'probe-log.jsonl'), 'utf8').trim());
    assert.equal(line.raw, 'not json');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
