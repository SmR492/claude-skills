import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOKS = dirname(fileURLToPath(import.meta.url));
const FILE = join(HOOKS, 'hooks.json');

function load() {
  return JSON.parse(readFileSync(FILE, 'utf8'));
}

function entries(config) {
  const out = [];
  for (const [event, groups] of Object.entries(config.hooks)) {
    for (const group of groups) for (const hook of group.hooks) out.push({ event, matcher: group.matcher, hook });
  }
  return out;
}

const isGuard = (e) => /hooks\/guard-[a-z]+\.mjs/.test(e.hook.command);

function guardsWithoutBlock(config) {
  return entries(config).filter((e) => isGuard(e) && e.hook.onFailure !== 'block');
}

test('registers bootstrap, the contract injection on every SubagentStart, the three guards and the handback check on PreToolUse with the named matchers', () => {
  const found = entries(load()).map((e) => ({ event: e.event, matcher: e.matcher, script: /hooks\/([a-z-]+\.mjs)/.exec(e.hook.command)?.[1] }));
  assert.deepEqual(found, [
    { event: 'SessionStart', matcher: 'startup|resume|clear|compact', script: 'bootstrap.mjs' },
    { event: 'PreToolUse', matcher: 'Bash|PowerShell|Monitor', script: 'guard-shell.mjs' },
    { event: 'PreToolUse', matcher: 'Agent|Task|Bash|PowerShell|Monitor|Edit|Write|NotebookEdit', script: 'guard-phase.mjs' },
    { event: 'PreToolUse', matcher: 'Agent|Task', script: 'guard-spawn.mjs' },
    { event: 'PreToolUse', matcher: 'SubagentHandback', script: 'check-handback.mjs' },
    { event: 'SubagentStart', matcher: '*', script: 'inject-contract.mjs' },
  ]);
});

test('every command goes through the plugin root and names a script that exists', () => {
  for (const { hook } of entries(load())) {
    assert.equal(hook.type, 'command');
    const m = /^node "\$\{CLAUDE_PLUGIN_ROOT\}\/(hooks\/[a-z-]+\.mjs)"$/.exec(hook.command);
    assert.ok(m, hook.command);
    assert.ok(existsSync(join(HOOKS, '..', m[1])), m[1]);
    assert.equal(typeof hook.timeout, 'number');
  }
});

test('fires: guard without onFailure block', () => {
  const config = load();
  assert.equal(entries(config).filter(isGuard).length, 3);
  assert.deepEqual(guardsWithoutBlock(config), []);
  for (const target of ['guard-shell.mjs', 'guard-phase.mjs', 'guard-spawn.mjs']) {
    const broken = structuredClone(config);
    for (const e of entries(broken)) if (e.hook.command.includes(target)) delete e.hook.onFailure;
    assert.equal(guardsWithoutBlock(broken).length, 1, target);
    const wrong = structuredClone(config);
    for (const e of entries(wrong)) if (e.hook.command.includes(target)) e.hook.onFailure = 'continue';
    assert.equal(guardsWithoutBlock(wrong).length, 1, target);
  }
});

test('fires: handback check without onFailure block', () => {
  const config = load();
  const isCheck = (e) => e.hook.command.includes('check-handback.mjs');
  const checksWithoutBlock = (c) => entries(c).filter((e) => isCheck(e) && e.hook.onFailure !== 'block');
  assert.equal(entries(config).filter(isCheck).length, 1);
  assert.deepEqual(checksWithoutBlock(config), []);
  const broken = structuredClone(config);
  for (const e of entries(broken)) if (isCheck(e)) delete e.hook.onFailure;
  assert.equal(checksWithoutBlock(broken).length, 1);
  const wrong = structuredClone(config);
  for (const e of entries(wrong)) if (isCheck(e)) e.hook.onFailure = 'continue';
  assert.equal(checksWithoutBlock(wrong).length, 1);
});
