import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { recordFired } from './hooks-observed.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const VERSION = JSON.parse(readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', '.claude-plugin', 'plugin.json'), 'utf8')).version;

function lines(dir) {
  return readFileSync(join(dir, 'hooks-fired.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

test('recordFired appends one line with hook name, plugin version, time, session, tool use, permission mode and decision', () => {
  const dir = join(tempDir('cdp6-obs-'), 'data');
  const input = { session_id: 's-1', tool_use_id: 'toolu_1', permission_mode: 'default', tool_name: 'Bash' };
  assert.equal(recordFired(dir, 'guard-phase.mjs', input, 'deny'), true);
  assert.equal(recordFired(dir, 'guard-shell.mjs', input, 'none'), true);
  const [first, second] = lines(dir);
  assert.deepEqual(Object.keys(first), ['hook', 'version', 'at', 'session_id', 'tool_use_id', 'permission_mode', 'decision', 'agent_id', 'capture_sha256']);
  assert.deepEqual({ ...first, at: typeof first.at }, { hook: 'guard-phase.mjs', version: VERSION, at: 'string', session_id: 's-1', tool_use_id: 'toolu_1', permission_mode: 'default', decision: 'deny', agent_id: null, capture_sha256: null });
  assert.ok(!Number.isNaN(Date.parse(first.at)));
  assert.equal(second.hook, 'guard-shell.mjs');
  assert.equal(statSync(join(dir, 'hooks-fired.jsonl')).mode & 0o777, 0o600);
});

test('a field absent from the hook input is written as null', () => {
  const dir = join(tempDir('cdp6-obs-'), 'data');
  recordFired(dir, 'guard-phase.mjs', { tool_name: 'Edit' }, 'none');
  const [line] = lines(dir);
  assert.equal(line.session_id, null);
  assert.equal(line.tool_use_id, null);
  assert.equal(line.permission_mode, null);
  recordFired(dir, 'guard-phase.mjs', null, 'none');
  assert.equal(lines(dir)[1].session_id, null);
});

test('recordFired returns false and throws nothing when the data directory is unusable', () => {
  assert.equal(recordFired(null, 'guard-phase.mjs', {}, 'none'), false);
  assert.equal(recordFired('relative/dir', 'guard-phase.mjs', {}, 'none'), false);
  const file = join(tempDir('cdp6-obs-'), 'plain');
  writeFileSync(file, 'x');
  assert.equal(recordFired(join(file, 'data'), 'guard-phase.mjs', {}, 'none'), false);
});

test('recordFired carries agent_id from the hook input and capture_sha256 from the caller, null when absent', () => {
  const dir = join(tempDir('cdp6-obs-'), 'data');
  const hash = 'c'.repeat(64);
  recordFired(dir, 'check-handback.mjs', { session_id: 's-1', agent_id: 'agent-7' }, 'none', { capture_sha256: hash });
  recordFired(dir, 'check-handback.mjs', { session_id: 's-1', agent_id: 'agent-7' }, 'none');
  recordFired(dir, 'check-handback.mjs', { agent_id: 7 }, 'none', { capture_sha256: 5 });
  const [first, second, third] = lines(dir);
  assert.equal(first.agent_id, 'agent-7');
  assert.equal(first.capture_sha256, hash);
  assert.equal(second.agent_id, 'agent-7');
  assert.equal(second.capture_sha256, null);
  assert.equal(third.agent_id, null);
  assert.equal(third.capture_sha256, null);
});
