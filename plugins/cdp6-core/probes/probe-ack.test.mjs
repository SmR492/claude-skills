import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'probe-ack.mjs');

const call = (env) => spawnSync('node', [SCRIPT], { input: JSON.stringify({ hook_event_name: 'SubagentStart', agent_id: 'a1' }), encoding: 'utf8', env: { PATH: process.env.PATH, ...env } });

test('A-11: on that row the hook returns SubagentStart additionalContext with a fixed acknowledgement line', () => {
  const r = call({ CDP6_PROBE_ROW: 'A-11' });
  assert.equal(r.status, 0);
  const out = JSON.parse(r.stdout).hookSpecificOutput;
  assert.equal(out.hookEventName, 'SubagentStart');
  assert.match(out.additionalContext, /PROBE-ACK-CDP6/);
  assert.match(out.additionalContext, /first line/);
});

test('fires: no output on any other row or without a row', () => {
  assert.notEqual(call({ CDP6_PROBE_ROW: 'A-11' }).stdout, '');
  assert.equal(call({}).stdout, '');
  assert.equal(call({ CDP6_PROBE_ROW: 'A-5' }).stdout, '');
});
