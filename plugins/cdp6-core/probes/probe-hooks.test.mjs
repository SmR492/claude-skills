import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const hooks = JSON.parse(readFileSync(join(PLUGIN, 'probes', 'probe-hooks.json'), 'utf8')).hooks;
const entries = (event) => (hooks[event] || []).flatMap((g) => g.hooks.map((h) => ({ matcher: g.matcher, command: h.command })));

test('every event of the kit has a catch-all probe-log registration', () => {
  for (const event of ['SessionStart', 'SubagentStart', 'SubagentStop', 'PreToolUse', 'PostToolUse', 'PostToolUseFailure', 'TeammateIdle', 'TaskCompleted']) {
    const hit = entries(event).filter((e) => /probe-log\.mjs/.test(e.command) && [undefined, '', '*'].includes(e.matcher));
    assert.equal(hit.length, 1, event);
  }
});

test('every command runs an existing script of the plugin through CLAUDE_PLUGIN_ROOT', () => {
  for (const event of Object.keys(hooks)) {
    for (const { command } of entries(event)) {
      const m = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/(probes\/[\w-]+\.mjs)"/.exec(command);
      assert.ok(m, command);
      assert.ok(existsSync(join(PLUGIN, m[1])), m[1]);
    }
  }
});

test('A-19: a second PreToolUse logger is registered on Bash, PowerShell and Monitor', () => {
  const hit = entries('PreToolUse').filter((e) => e.matcher === 'Bash|PowerShell|Monitor' && /probe-log\.mjs" a19/.test(e.command));
  assert.equal(hit.length, 1);
});

test('A-5, A-18 and A-22: the guard, the key reader and the marker search are registered', () => {
  assert.equal(entries('PreToolUse').filter((e) => e.matcher === '*' && /probe-guard\.mjs/.test(e.command)).length, 1);
  assert.equal(entries('PreToolUse').filter((e) => e.matcher === 'Bash' && /probe-read\.mjs" key/.test(e.command)).length, 1);
  assert.equal(entries('PostToolUse').filter((e) => e.matcher === 'Bash' && /probe-read\.mjs" marker/.test(e.command)).length, 1);
  assert.equal(entries('SessionStart').filter((e) => /probe-key\.mjs" write/.test(e.command)).length, 1);
});

test('A-11 and A-16: the acknowledgement hook is on SubagentStart and the team reader on PreToolUse', () => {
  assert.equal(entries('SubagentStart').filter((e) => /probe-ack\.mjs"/.test(e.command)).length, 1);
  assert.equal(entries('PreToolUse').filter((e) => e.matcher === '*' && /probe-read\.mjs" team/.test(e.command)).length, 1);
});

test('A-8 and A-17: usage runs on SubagentStop and the mailbox read on TeammateIdle', () => {
  assert.equal(entries('SubagentStop').filter((e) => /probe-read\.mjs" usage/.test(e.command)).length, 1);
  assert.equal(entries('TeammateIdle').filter((e) => /probe-read\.mjs" mailbox/.test(e.command)).length, 1);
});

test('the manifest names cdp6-core and loads the probe hooks file', () => {
  const manifest = JSON.parse(readFileSync(join(PLUGIN, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(manifest.name, 'cdp6-core');
  assert.equal(manifest.hooks, './probes/probe-hooks.json');
});

function agent(file) {
  const text = readFileSync(join(PLUGIN, 'agents', file), 'utf8');
  return /^---\n([\s\S]*?)\n---/.exec(text)[1];
}

test('the probe agent has exactly the tools rows A-2, A-19 and A-22 call and says it is the SL-0 kit copy', () => {
  const front = agent('probe.md');
  assert.match(front, /^name: probe$/m);
  assert.match(front, /^tools: Read, Bash, Monitor, Edit, Write, MultiEdit, NotebookEdit, Grep, Glob$/m);
  assert.match(front, /^description: SL-0 kit copy.*Use /m);
});

test('A-18: a second role file has the same tools and a different name', () => {
  const a = agent('probe.md');
  const b = agent('probe-b.md');
  assert.match(b, /^name: probe-b$/m);
  assert.equal(/^tools: .*$/m.exec(b)[0], /^tools: .*$/m.exec(a)[0]);
  assert.match(b, /^description: .*SL-0 kit copy/m);
});
