#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { agentName } from '../lib/agent-name.mjs';
import { parseBrief } from '../lib/brief.mjs';
import { CountersError, addPending } from '../lib/counters.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { findRun } from '../lib/run-store.mjs';

const SPAWN_TOOLS = ['Agent', 'Task'];

const RUN_DENIES = {
  'pointer-missing': 'the run pointer active-runs.json is missing while an active run.json exists in a state directory',
  'pointer-unreadable': 'the run pointer active-runs.json is not readable',
};

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
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return { decision: 'none' };
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd() });
  if (found.error) return deny(RUN_DENIES[found.error] ?? 'run.json of the active run is not readable');
  if (found.none || !found.run) return { decision: 'none' };
  const type = input.tool_input?.subagent_type;
  if (!agentName(type)) return deny('in an active run only agents of the cdp6-core: namespace may be spawned');
  if (typeof input.tool_use_id !== 'string' || input.tool_use_id === '') return deny('the Agent call carries no tool_use_id');
  try {
    addPending(found.S, pendingOf(input, now));
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    if (e.code === 'lock-busy') return deny('counters.json is locked by another writer');
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
