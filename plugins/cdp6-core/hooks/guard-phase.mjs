#!/usr/bin/env node
import { readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { PHASES, predecessorOpen } from '../lib/phases.mjs';
import { CountersError, readCounters } from '../lib/counters.mjs';
import { ArgvError, SHELL_TOOLS, readRunCall } from '../lib/run-argv.mjs';
import { openCaptureBound, runFor, stopFor } from '../lib/stop-guard.mjs';
import { isDevilsAdvocate } from '../lib/verdict-index.mjs';

const TARGET_FIELDS = ['file_path', 'notebook_path'];
const WRITE_TOOLS = ['Edit', 'Write', 'NotebookEdit'];
const STOP_TOOLS = ['Agent', 'Task', 'SendMessage', 'EnterWorktree', 'Skill', ...WRITE_TOOLS];
const stopTool = (name) => STOP_TOOLS.includes(name) || (typeof name === 'string' && name.startsWith('mcp__'));

function deny(reason) {
  return { decision: 'deny', reason };
}

function ask(reason) {
  return { decision: 'ask', reason };
}

function targetOf(input) {
  for (const field of TARGET_FIELDS) {
    const value = input.tool_input?.[field];
    if (typeof value === 'string' && isAbsolute(value)) return value;
  }
  return undefined;
}

function real(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function identity(path) {
  try {
    const st = statSync(path, { bigint: true });
    return `${st.dev}:${st.ino}`;
  } catch {
    return null;
  }
}

function spellings(path) {
  return [resolve(path), real(path)];
}

function openTargetTask(input, found) {
  if (!WRITE_TOOLS.includes(input.tool_name)) return null;
  const cwd = input.cwd ?? process.cwd();
  const paths = TARGET_FIELDS.map((field) => input.tool_input?.[field]).filter((v) => typeof v === 'string' && v !== '').map((v) => resolve(cwd, v));
  const written = paths.flatMap(spellings);
  if (!written.length) return null;
  const files = new Set(paths.map(identity).filter((id) => id !== null));
  let pending;
  try {
    pending = Object.values(readCounters(found.S).pending);
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    return { unreadable: true };
  }
  for (const spawn of pending) {
    if (!isDevilsAdvocate(spawn) || spawn.closed_at || spawn.void) continue;
    for (const t of Array.isArray(spawn.targets) ? spawn.targets : []) {
      if (typeof t?.path !== 'string') continue;
      const at = resolve(found.R, t.path);
      if (spellings(at).some((p) => written.includes(p)) || files.has(identity(at))) return { task: spawn.task, path: t.path };
    }
  }
  return null;
}

function enterPhase(input, env) {
  if (!SHELL_TOOLS.includes(input.tool_name)) return null;
  const command = input.tool_input?.command;
  if (typeof command !== 'string') return null;
  try {
    const read = readRunCall(command, env);
    if (!read) return null;
    const { call } = read;
    const phase = call.positionals[0];
    return call.sub === 'enter' && PHASES.includes(phase) ? phase : null;
  } catch (e) {
    if (e instanceof ArgvError) return null;
    throw e;
  }
}

export function decide(input, env) {
  const run = runFor(input, env, targetOf(input));
  if (run.deny) return deny(run.deny);
  if (!run.found) return { decision: 'none' };
  const found = run.found;
  const stop = stopTool(input.tool_name) ? stopFor(input, env, targetOf(input)) : null;
  if (stop) return deny(stop);
  if (input.tool_name === 'TaskStop') {
    const open = openCaptureBound(found.S);
    if (open.deny) return deny(open.deny);
    if (open.spawns.length) return ask(`TaskStop would end a capture-bound agent before its verdict is captured: ${open.spawns.join('; ')}; the owner decides, a stopped agent leaves no capture`);
    return { decision: 'none' };
  }
  const open = openTargetTask(input, found);
  if (open?.unreadable) return deny('counters.json of the active run is missing or not readable');
  if (open) return deny(`${open.path} is the target of the open devils-advocate spawn of ${open.task}: it is not edited until the capture is made`);
  const phase = enterPhase(input, env);
  if (phase) {
    const missing = predecessorOpen(found.run, phase);
    if (missing) return deny(`run.mjs enter ${phase} is refused: ${missing} has no exit record`);
  }
  return { decision: 'none' };
}

export function main(env = process.env) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    input = null;
  }
  const valid = input !== null && typeof input === 'object' && !Array.isArray(input);
  let result;
  try {
    result = valid ? decide(input, env) : deny('guard-phase.mjs could not read its input');
  } catch {
    result = deny('guard-phase.mjs could not decide');
  }
  recordFired(env.CLAUDE_PLUGIN_DATA, 'guard-phase.mjs', valid ? input : null, result.decision);
  if (result.decision === 'ask') {
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: `guard-phase.mjs: ${result.reason}` } }));
    return 0;
  }
  if (result.decision === 'deny') {
    process.stderr.write(`guard-phase.mjs: ${result.reason}\n`);
    return 2;
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
