import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, rmSync, copyFileSync, existsSync, readdirSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { verify } from '../lib/contract.mjs';
import { readMarker, writeMarker, clearMarker, markerDir } from '../lib/handback.mjs';

const PLUGIN = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const HANDBACK = join(PLUGIN, 'hooks', 'check-handback.mjs');
const CHECK = join(PLUGIN, 'hooks', 'check-ack.mjs');
const GENERATE = join(PLUGIN, 'scripts', 'generate-contract.mjs');

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-handback-'));
  const dir = join(root, 'skills', 'worker-contract');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), join(dir, 'SKILL.md'));
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  return { root, dir, env };
}

function run(script, env, input) {
  const r = spawnSync('node', [script], { env, input: JSON.stringify(input ?? {}), encoding: 'utf8' });
  let json = null;
  try { json = r.stdout ? JSON.parse(r.stdout) : null; } catch {}
  return { status: r.status, out: r.stdout, err: r.stderr, json };
}

function generated(env) {
  const r = run(GENERATE, env);
  assert.equal(r.status, 0, r.err);
  const v = verify(env.CLAUDE_PLUGIN_ROOT);
  assert.ok(v.ok, v.error);
  return v;
}

function usageLog(root) {
  const file = join(root, 'data', 'usage-log.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

// The PreToolUse input Claude Code 2.1.304 sends when a subagent calls SubagentHandback.
function handback(message, extra = {}) {
  return {
    hook_event_name: 'PreToolUse', tool_name: 'SubagentHandback', tool_input: { message },
    agent_type: 'cdp5-agents:review-verify', agent_id: 'a4b3668f2b40bb9cb', session_id: 's1', cwd: '/repo',
    ...extra,
  };
}

test('handback: other tools and agents outside the two plugins pass without output or log line', () => {
  const { root, env } = sandbox();
  try {
    generated(env);
    const bash = run(HANDBACK, env, { ...handback('no ack'), tool_name: 'Bash', tool_input: { command: 'ls' } });
    assert.equal(bash.status, 0, bash.err);
    assert.equal(bash.out, '');
    const foreign = run(HANDBACK, env, handback('no ack', { agent_type: 'Explore' }));
    assert.equal(foreign.status, 0, foreign.err);
    assert.equal(foreign.out, '');
    const none = run(HANDBACK, env, handback('no ack', { agent_type: undefined }));
    assert.equal(none.out, '');
    assert.deepEqual(usageLog(root), []);
    assert.ok(!existsSync(markerDir(env)));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('handback: an acknowledged report passes, is logged once via handback, and the stop hook stays silent', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const r = run(HANDBACK, env, handback(`contract: v${v.version} ${v.hash}\nfresh context: yes\nVerdict: bestätigt.`));
    assert.equal(r.status, 0, r.err);
    assert.equal(r.out, '', 'the handback is allowed');
    const log = usageLog(root);
    assert.equal(log.length, 1);
    assert.equal(log[0].result, 'ok');
    assert.equal(log[0].via, 'handback');
    assert.equal(log[0].agent_type, 'cdp5-agents:review-verify');
    assert.equal(log[0].agent_id, 'a4b3668f2b40bb9cb');
    assert.equal(log[0].contract, `v${v.version} ${v.hash}`);
    assert.ok(readMarker('a4b3668f2b40bb9cb', env).logged, 'the marker tells the stop hook the run is logged');
    // The stop then fires with a blank last_assistant_message and no transcript: no block, no second line.
    const stop = run(CHECK, env, { hook_event_name: 'SubagentStop', agent_type: 'cdp5-agents:review-verify', agent_id: 'a4b3668f2b40bb9cb', session_id: 's1', stop_hook_active: false, last_assistant_message: '' });
    assert.equal(stop.status, 0, stop.err);
    assert.equal(stop.out, '', 'the stop hook neither blocks nor logs');
    assert.equal(usageLog(root).length, 1);
    assert.deepEqual(readMarker('a4b3668f2b40bb9cb', env), { asked: false, logged: false }, 'the marker is removed at the stop');
    assert.deepEqual(readdirSync(markerDir(env)), []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('handback: a missing acknowledgement is denied once with the reason; the second handback goes through and is logged no-ack', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const first = run(HANDBACK, env, handback('Verdict: bestätigt. No contract line.'));
    assert.equal(first.status, 0, first.err);
    assert.equal(first.json.hookSpecificOutput.hookEventName, 'PreToolUse');
    assert.equal(first.json.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(first.json.hookSpecificOutput.permissionDecisionReason, new RegExp(`contract: v${v.version} ${v.hash}`));
    assert.deepEqual(usageLog(root), [], 'a denied handback is not logged yet');
    assert.ok(readMarker('a4b3668f2b40bb9cb', env).asked);
    const second = run(HANDBACK, env, handback('Verdict: bestätigt. Still no contract line.'));
    assert.equal(second.out, '', 'never denied twice');
    assert.deepEqual(usageLog(root).map((e) => [e.result, e.via]), [['no-ack', 'handback']]);
    const repairedElsewhere = run(HANDBACK, env, handback(`contract: v${v.version} ${v.hash}\nVerdict: bestätigt.`));
    assert.equal(repairedElsewhere.out, '');
    assert.equal(usageLog(root).length, 1, 'a third handback of the same agent adds nothing');
    const stop = run(CHECK, env, { agent_type: 'cdp5-agents:review-verify', agent_id: 'a4b3668f2b40bb9cb', stop_hook_active: false, last_assistant_message: '' });
    assert.equal(stop.out, '');
    assert.equal(usageLog(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('handback: a hedged completion claim is denied once; the restated report is logged with its own result', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const ack = `contract: v${v.version} ${v.hash}`;
    const first = run(HANDBACK, env, handback(`${ack}\nOutcome: the fix is in place and should work now.\nTests should pass after the change.`));
    assert.equal(first.json.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(first.json.hookSpecificOutput.permissionDecisionReason, /hedged completion claim/);
    const second = run(HANDBACK, env, handback(`${ack}\nOutcome: the fix is in place; node --test printed 12 pass, 0 fail.`));
    assert.equal(second.out, '');
    assert.deepEqual(usageLog(root).map((e) => e.result), ['ok']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('handback: without an agent id nothing is denied (no way to recognise the retry); the run is still logged', () => {
  const { root, env } = sandbox();
  try {
    generated(env);
    const r = run(HANDBACK, env, handback('no contract line', { agent_id: undefined }));
    assert.equal(r.status, 0, r.err);
    assert.equal(r.out, '');
    assert.deepEqual(usageLog(root).map((e) => e.result), ['no-ack']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('handback: an unverifiable contract lets the handback through and logs contract-missing once', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    rmSync(join(dir, 'core.md'));
    const r = run(HANDBACK, env, handback('anything'));
    assert.equal(r.status, 0, r.err);
    assert.equal(r.out, '');
    assert.deepEqual(usageLog(root).map((e) => e.result), ['contract-missing']);
    assert.match(usageLog(root)[0].contract, /^unverified/);
    const again = run(HANDBACK, env, handback('anything'));
    assert.equal(again.out, '');
    assert.equal(usageLog(root).length, 1);
    const stop = run(CHECK, env, { agent_type: 'cdp5-agents:review-verify', agent_id: 'a4b3668f2b40bb9cb', stop_hook_active: false, last_assistant_message: 'anything' });
    assert.equal(stop.out, '', 'the stop hook does not block or log a second contract-missing');
    assert.equal(usageLog(root).length, 1);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('handback markers: ids are sanitised, writes merge, stale markers are pruned, clear is idempotent', () => {
  const { root, env } = sandbox();
  try {
    assert.equal(writeMarker('', { asked: true }, env), null, 'an empty id has no marker');
    const file = writeMarker('../x/..', { asked: true }, env);
    assert.match(file, /[\\/]handback[\\/]x\.json$/, 'path characters are stripped from the id');
    writeMarker('a1', { asked: true }, env, Date.parse('2026-10-20T10:00:00Z'));
    writeMarker('a1', { logged: true }, env, Date.parse('2026-10-20T10:01:00Z'));
    assert.deepEqual(readMarker('a1', env), { asked: true, logged: true });
    // A later write prunes marker files older than a day (mtime is the real one, so make one old by hand).
    const old = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    utimesSync(join(markerDir(env), 'x.json'), old, old);
    writeMarker('b2', { asked: true }, env);
    assert.ok(!existsSync(join(markerDir(env), 'x.json')), 'stale marker pruned');
    assert.ok(existsSync(join(markerDir(env), 'a1.json')));
    clearMarker('a1', env);
    clearMarker('a1', env);
    assert.deepEqual(readMarker('a1', env), { asked: false, logged: false });
    assert.deepEqual(readMarker('missing', env), { asked: false, logged: false });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
