import { isAbsolute, join } from 'node:path';
import { CountersError, readCounters, uncapturedBound, uncapturedFinished, uncapturedStop } from './counters.mjs';
import { agentName, captureBound } from './agent-name.mjs';
import { findRun } from './run-store.mjs';

const WAY_OUT = (S, what) => `end the session, record the cause in ledger 0021, and outside Claude Code mark ${what} void in ${join(S, 'counters.json')} by hand`;
const CAUSE = 'finished without a captured verdict: no SubagentHandback call reached check-handback.mjs, or its handback was refused';

const RUN_DENIES = {
  'pointer-missing': 'the run pointer active-runs.json is missing while an active run.json exists in a state directory',
  'pointer-unreadable': 'the run pointer active-runs.json is not readable',
};

export function runFor(input, env, targetPath) {
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return { none: true };
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd(), targetPath });
  if (found.error) return { deny: RUN_DENIES[found.error] ?? 'run.json of the active run is not readable' };
  if (found.none || !found.run) return { none: true };
  return { found };
}

export function activeStop(S) {
  let doc;
  try {
    doc = readCounters(S);
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    if (e.code === 'counters-missing') return `stop guard: counters.json of the active run is missing; end the session and repair ${join(S, 'counters.json')} outside Claude Code`;
    return `stop guard: counters.json of the active run is not readable (${e.message}); end the session and repair ${join(S, 'counters.json')} outside Claude Code`;
  }
  const hit = uncapturedFinished(doc);
  if (hit) {
    const { spawn } = hit;
    const role = agentName(spawn.agent_type) ?? spawn.role ?? 'unknown role';
    return `stop guard: agent ${spawn.agent_id} (${role}, task ${spawn.task ?? 'unknown'}) ${CAUSE}; ${WAY_OUT(S, `the spawn ${hit.tool_use_id}`)}`;
  }
  const unbound = uncapturedStop(doc);
  if (unbound) {
    const role = agentName(unbound.entry.agent_type) ?? 'unknown role';
    return `stop guard: agent ${unbound.agent_id} (${role}, no bound spawn, so no task) ${CAUSE}; ${WAY_OUT(S, `the stop entry ${unbound.agent_id}`)}`;
  }
  return null;
}

export function stopFor(input, env, targetPath) {
  const run = runFor(input, env, targetPath);
  if (run.deny) return run.deny;
  return run.found ? activeStop(run.found.S) : null;
}

export function openCaptureBound(S) {
  let doc;
  try {
    doc = readCounters(S);
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    return { deny: `stop guard: counters.json of the active run is not readable (${e.message}); end the session and repair ${join(S, 'counters.json')} outside Claude Code` };
  }
  const spawns = uncapturedBound(doc, captureBound).map(({ tool_use_id: id, spawn }) => `${spawn.agent_id ?? `not yet bound (spawn ${id})`} (${agentName(spawn.agent_type)}, task ${spawn.task ?? 'unknown'})`);
  return { spawns };
}
