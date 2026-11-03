#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { PHASES, predecessorOpen } from '../lib/phases.mjs';
import { ArgvError, SHELL_TOOLS, readRunCall } from '../lib/run-argv.mjs';
import { findRun } from '../lib/run-store.mjs';

const TARGET_FIELDS = ['file_path', 'notebook_path'];

function deny(reason) {
  return { decision: 'deny', reason };
}

function targetOf(input) {
  for (const field of TARGET_FIELDS) {
    const value = input.tool_input?.[field];
    if (typeof value === 'string' && isAbsolute(value)) return value;
  }
  return undefined;
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
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return { decision: 'none' };
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd(), targetPath: targetOf(input) });
  if (found.error === 'pointer-missing') return deny('the run pointer active-runs.json is missing while an active run.json exists in a state directory');
  if (found.error === 'pointer-unreadable') return deny('the run pointer active-runs.json is not readable');
  if (found.error) return deny('run.json of the active run is not readable');
  if (found.none || !found.run) return { decision: 'none' };
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
  if (result.decision === 'deny') {
    process.stderr.write(`guard-phase.mjs: ${result.reason}\n`);
    return 2;
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
