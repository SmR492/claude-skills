#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { agentName, captureBound } from '../lib/agent-name.mjs';
import { parseBrief } from '../lib/brief.mjs';
import { CountersError, addPending } from '../lib/counters.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { runFor, stopFor } from '../lib/stop-guard.mjs';

const SPAWN_TOOLS = ['Agent', 'Task'];

function unboundNote(S, unbound) {
  if (!unbound?.length) return '';
  const list = unbound.map((u) => `${u.tool_use_id} (task ${u.task ?? 'unknown'})`).join(', ');
  return `; unbound pending spawns of the role, never launched or not yet bound: ${list}; outside Claude Code mark each one void in ${join(S, 'counters.json')} by hand`;
}

function deny(reason) {
  return { decision: 'deny', reason };
}

function pendingOf(input, now) {
  const tool = input.tool_input;
  const parsed = parseBrief(tool.prompt);
  const header = parsed.ok ? parsed.header : null;
  return {
    tool_use_id: input.tool_use_id,
    agent_type: tool.subagent_type,
    task: header?.task ?? null,
    role: header?.role ?? null,
    targets: header?.targets ?? [],
    header: header ? 'ok' : 'invalid',
    at: now.toISOString(),
  };
}

export function decide(input, env, now = new Date()) {
  if (!SPAWN_TOOLS.includes(input.tool_name)) return { decision: 'none' };
  const run = runFor(input, env);
  if (run.deny) return deny(run.deny);
  if (!run.found) return { decision: 'none' };
  const found = run.found;
  const stop = stopFor(input, env);
  if (stop) return deny(stop);
  const type = input.tool_input?.subagent_type;
  if (!agentName(type)) return deny('in an active run only agents of the cdp6-core: namespace may be spawned');
  if (typeof input.tool_use_id !== 'string' || input.tool_use_id === '') return deny('the Agent call carries no tool_use_id');
  try {
    addPending(found.S, pendingOf(input, now), { exclusiveRole: captureBound(type) });
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    if (e.code === 'lock-busy') return deny('counters.json is locked by another writer');
    if (e.code === 'role-pending') return deny(`a second spawn of ${type} is denied: ${e.message}${unboundNote(found.S, e.unbound)}`);
    return deny(`counters.json cannot be used: ${e.message}`);
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
    result = valid ? decide(input, env) : deny('guard-spawn.mjs could not read its input');
  } catch {
    result = deny('guard-spawn.mjs could not decide');
  }
  recordFired(env.CLAUDE_PLUGIN_DATA, 'guard-spawn.mjs', valid ? input : null, result.decision);
  if (result.decision === 'deny') {
    process.stderr.write(`guard-spawn.mjs: ${result.reason}\n`);
    return 2;
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
