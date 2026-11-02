import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'probe-guard.mjs');
const RUN = '/cache/cdp6-core/scripts/run.mjs';

function call(input, env) {
  const home = mkdtempSync(join(tmpdir(), 'probe-guard-'));
  try {
    const r = spawnSync('node', [SCRIPT], { input: JSON.stringify(input), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: home, ...env } });
    let log = [];
    try {
      log = readFileSync(join(home, '.cache', 'cdp6-probe', 'probe-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
    } catch {}
    return { r, home, log, out: r.stdout ? JSON.parse(r.stdout).hookSpecificOutput : null };
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
}

const bash = (command) => ({ session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command, description: 'd' } });

test('A-5: approve and enter ask, with --session-id and --data-dir appended and other fields kept', () => {
  for (const sub of ['approve', 'enter']) {
    const { r, home, out } = call(bash(`node ${RUN} ${sub}`), { CDP6_PROBE_ROW: 'A-5' });
    assert.equal(r.status, 0);
    assert.equal(out.hookEventName, 'PreToolUse');
    assert.equal(out.permissionDecision, 'ask');
    assert.equal(out.updatedInput.command, `node ${RUN} ${sub} --session-id s1 --data-dir ${join(home, '.cache', 'cdp6-probe', 'data')}`);
    assert.equal(out.updatedInput.description, 'd');
  }
});

test('A-5: status allows with the same appended arguments', () => {
  const { out, home } = call(bash(`node ${RUN} status`), { CDP6_PROBE_ROW: 'A-5' });
  assert.equal(out.permissionDecision, 'allow');
  assert.equal(out.updatedInput.command, `node ${RUN} status --session-id s1 --data-dir ${join(home, '.cache', 'cdp6-probe', 'data')}`);
});

test('A-22: the marker --hook-token is appended last', () => {
  const { out } = call(bash(`node ${RUN} status`), { CDP6_PROBE_ROW: 'A-22' });
  assert.match(out.updatedInput.command, / --hook-token PROBE-MARKER-s1$/);
  assert.match(out.updatedInput.command, / --session-id s1 --data-dir /);
});

test('the decision and the modified input are logged', () => {
  const { log } = call(bash(`node ${RUN} enter`), { CDP6_PROBE_ROW: 'A-5' });
  assert.equal(log.length, 1);
  assert.equal(log[0].tag, 'guard');
  assert.equal(log[0].decision, 'ask');
  assert.match(log[0].updatedInput.command, /--session-id s1/);
});

test('fires: no decision without the row, and none for compound, prefixed or other subcommands', () => {
  assert.equal(call(bash(`node ${RUN} status`), {}).out, null);
  assert.equal(call(bash(`node ${RUN} status`), { CDP6_PROBE_ROW: 'A-5' }).out.permissionDecision, 'allow');
  const forms = [`node ${RUN} status; touch R/verdicts/x`, `node ${RUN} status && echo more`, `FOO=1 node ${RUN} status`, `timeout 5 node ${RUN} status`, `node ${RUN} grant`, 'ls'];
  for (const command of forms) {
    assert.equal(call(bash(command), { CDP6_PROBE_ROW: 'A-5' }).out, null, command);
  }
});

test('A-18: an Agent call whose prompt holds PROBE-DENY is denied, any other is not', () => {
  const agent = (prompt) => ({ session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { prompt, subagent_type: 'cdp6-core:probe' } });
  const denied = call(agent('please PROBE-DENY this'), {});
  assert.equal(denied.out.permissionDecision, 'deny');
  assert.ok(denied.out.permissionDecisionReason);
  assert.equal(call(agent('plain'), {}).out, null);
});

test('A-12: in bypassPermissions the guard denies every tool call, in no other mode and on no other row', () => {
  const tool = (name, mode) => ({ session_id: 's1', hook_event_name: 'PreToolUse', tool_name: name, permission_mode: mode, tool_input: { command: 'ls', file_path: '/x' } });
  for (const name of ['Bash', 'Read', 'Agent', 'Monitor']) {
    const { out } = call(tool(name, 'bypassPermissions'), { CDP6_PROBE_ROW: 'A-12' });
    assert.equal(out.permissionDecision, 'deny', name);
    assert.match(out.permissionDecisionReason, /A-12/);
  }
  assert.equal(call(tool('Bash', 'default'), { CDP6_PROBE_ROW: 'A-12' }).out, null);
  assert.equal(call(tool('Bash', 'bypassPermissions'), {}).out, null);
  assert.equal(call(tool('Bash', 'bypassPermissions'), { CDP6_PROBE_ROW: 'A-5' }).out, null);
});

test('A-12: the deny is logged', () => {
  const { log } = call({ session_id: 's1', hook_event_name: 'PreToolUse', tool_name: 'Read', permission_mode: 'bypassPermissions', tool_input: {} }, { CDP6_PROBE_ROW: 'A-12' });
  assert.equal(log[0].tag, 'guard');
  assert.equal(log[0].decision, 'deny');
});
