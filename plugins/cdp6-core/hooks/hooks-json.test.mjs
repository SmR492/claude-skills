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

test('registers bootstrap, the contract injection on every SubagentStart, the stop observer on SubagentStop of cdp6-core agents, the three guards and the handback check on PreToolUse with the named matchers', () => {
  const found = entries(load()).map((e) => ({ event: e.event, matcher: e.matcher, script: /hooks\/([a-z-]+\.mjs)/.exec(e.hook.command)?.[1] }));
  assert.deepEqual(found, [
    { event: 'SessionStart', matcher: 'startup|resume|clear|compact', script: 'bootstrap.mjs' },
    { event: 'PreToolUse', matcher: 'Bash|PowerShell|Monitor', script: 'guard-shell.mjs' },
    { event: 'PreToolUse', matcher: 'Agent|Task|Bash|PowerShell|Monitor|Edit|Write|NotebookEdit|SendMessage|EnterWorktree|Skill|TaskStop', script: 'guard-phase.mjs' },
    { event: 'PreToolUse', matcher: '^mcp__.*', script: 'guard-phase.mjs' },
    { event: 'PreToolUse', matcher: 'Agent|Task', script: 'guard-spawn.mjs' },
    { event: 'PreToolUse', matcher: 'SubagentHandback', script: 'check-handback.mjs' },
    { event: 'SubagentStart', matcher: '*', script: 'inject-contract.mjs' },
    { event: 'SubagentStop', matcher: '^cdp6-core:', script: 'observe-stop.mjs' },
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
  assert.equal(entries(config).filter(isGuard).length, 4);
  assert.deepEqual(guardsWithoutBlock(config), []);
  for (const target of ['guard-shell.mjs', 'guard-phase.mjs', 'guard-spawn.mjs']) {
    const broken = structuredClone(config);
    for (const e of entries(broken)) if (e.hook.command.includes(target)) delete e.hook.onFailure;
    const count = target === 'guard-phase.mjs' ? 2 : 1;
    assert.equal(guardsWithoutBlock(broken).length, count, target);
    const wrong = structuredClone(config);
    for (const e of entries(wrong)) if (e.hook.command.includes(target)) e.hook.onFailure = 'continue';
    assert.equal(guardsWithoutBlock(wrong).length, count, target);
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

const EXACT = /^[\w\- ,|]+$/;

function matcherHits(matcher, tool) {
  if (matcher === '*' || matcher === '') return true;
  if (EXACT.test(matcher)) return matcher.split(/[|,]/).map((m) => m.trim()).includes(tool);
  return new RegExp(matcher).test(tool);
}

const phaseHits = (config, tool) => entries(config).filter((e) => e.hook.command.includes('guard-phase.mjs')).some((e) => matcherHits(e.matcher, tool));

function withPhaseMatchers(config, matchers) {
  const broken = structuredClone(config);
  const groups = broken.hooks.PreToolUse.filter((g) => g.hooks.some((h) => h.command.includes('guard-phase.mjs')));
  groups.forEach((g, i) => {
    g.matcher = matchers[i];
  });
  return broken;
}

test('fires: stop matchers miss EnterWorktree or MCP tools', () => {
  const config = load();
  for (const tool of ['Agent', 'Task', 'SendMessage', 'Edit', 'Write', 'NotebookEdit', 'EnterWorktree', 'mcp__fixture__write', 'mcp__claude_ai_Orbit__insert']) assert.equal(phaseHits(config, tool), true, tool);
  for (const tool of ['Read', 'Grep', 'Glob', 'EnterWorktreeX', 'XEnterWorktree', 'Xmcp__fixture__write']) assert.equal(phaseHits(config, tool), false, tool);
  const named = 'Agent|Task|Bash|PowerShell|Monitor|Edit|Write|NotebookEdit|SendMessage|Skill|TaskStop';
  const broken = withPhaseMatchers(config, [named, '^mcpx__.*']);
  assert.equal(phaseHits(broken, 'EnterWorktree'), false);
  assert.equal(phaseHits(broken, 'mcp__fixture__write'), false);
});

test('fires: stop matchers miss Skill or TaskStop', () => {
  const config = load();
  for (const tool of ['Skill', 'TaskStop']) assert.equal(phaseHits(config, tool), true, tool);
  for (const tool of ['TaskOutput', 'SkillX', 'XSkill']) assert.equal(phaseHits(config, tool), false, tool);
  const broken = withPhaseMatchers(config, ['Agent|Task|Bash|PowerShell|Monitor|Edit|Write|NotebookEdit|SendMessage|EnterWorktree', '^mcp__.*']);
  assert.equal(phaseHits(broken, 'Skill'), false);
  assert.equal(phaseHits(broken, 'TaskStop'), false);
});
