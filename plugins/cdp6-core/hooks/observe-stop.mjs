#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { captureBound } from '../lib/agent-name.mjs';
import { CountersError, markFinished } from '../lib/counters.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { findRun } from '../lib/run-store.mjs';

const BY_STATUS = { marked: 'finished', already: 'finished', none: 'finished', closed: 'captured', unbound: 'no-spawn' };

function observe(input, env) {
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return 'none';
  if (!captureBound(input.agent_type)) return 'none';
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd() });
  if (found.error) return 'unreadable';
  if (found.none || !found.run) return 'none';
  if (typeof input.agent_id !== 'string' || input.agent_id === '') return 'unreadable';
  try {
    const marked = markFinished(found.S, input.agent_id, { agentType: input.agent_type });
    return marked.voided ? 'void' : BY_STATUS[marked.status];
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    process.stderr.write(`observe-stop.mjs: counters.json not usable (${e.code}); the stop is not recorded\n`);
    return e.code === 'lock-busy' ? 'lock-busy' : 'unreadable';
  }
}

export function main(env = process.env) {
  let input = null;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    input = null;
  }
  const valid = input !== null && typeof input === 'object' && !Array.isArray(input);
  let outcome = 'none';
  try {
    if (valid) outcome = observe(input, env);
  } catch {
    outcome = 'unreadable';
    process.stderr.write('observe-stop.mjs: the stop could not be recorded\n');
  }
  recordFired(env.CLAUDE_PLUGIN_DATA, 'observe-stop.mjs', valid ? input : null, outcome);
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
