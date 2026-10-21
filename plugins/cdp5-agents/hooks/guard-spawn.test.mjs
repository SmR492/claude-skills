import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const GUARD = join(PLUGIN, 'hooks', 'guard-spawn.mjs');

function run(input) {
  const r = spawnSync('node', [GUARD], { input: JSON.stringify(input), encoding: 'utf8', env: { PATH: process.env.PATH, CLAUDE_PLUGIN_ROOT: PLUGIN } });
  return { status: r.status, out: r.stdout ? JSON.parse(r.stdout) : null };
}

const spawn = (tool_input) => ({ hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input });

test('a named spawn of a cdp5 or domain worker is denied with the reason and the way out', () => {
  for (const t of ['cdp5-agents:impl-uc', 'domain-agents:psy-grenzwaechter']) {
    const r = run(spawn({ subagent_type: t, name: 'w0a-bench', prompt: 'x', description: 'd' }));
    assert.equal(r.status, 0);
    assert.equal(r.out.hookSpecificOutput.permissionDecision, 'deny');
    assert.match(r.out.hookSpecificOutput.permissionDecisionReason, /without `name`/);
    assert.match(r.out.hookSpecificOutput.permissionDecisionReason, /CONTRACT-MISSING/);
  }
  const team = run(spawn({ subagent_type: 'cdp5-agents:review-verify', team_name: 's9', prompt: 'x' }));
  assert.equal(team.out.hookSpecificOutput.permissionDecision, 'deny');
});

test('an unnamed worker spawn, a named non-worker spawn and other tools pass without output', () => {
  for (const input of [
    spawn({ subagent_type: 'cdp5-agents:impl-uc', prompt: 'x' }),
    spawn({ subagent_type: 'cdp5-agents:impl-uc', name: '', prompt: 'x' }),
    spawn({ subagent_type: 'Explore', name: 'scout', prompt: 'x' }),
    { hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: 'ls' } },
  ]) {
    const r = run(input);
    assert.equal(r.status, 0);
    assert.equal(r.out, null);
  }
});
