import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { captureBound } from './agent-name.mjs';
import { CountersError, readCounters, unboundPending, uncapturedFinished, uncapturedStop } from './counters.mjs';
import { readClaudeVersion } from './claude-version.mjs';
import { probeRecordPath, readProbeRecord, rowHolds } from './probe-record.mjs';
import { isClaudeProcess } from './preflight-proc.mjs';
import { isActiveRun, stateDirOf } from './run-store.mjs';

export function probeRecord(x, fail) {
  const pid = x.proc.orchestratorPid;
  if (!x.orchestrator || !isClaudeProcess(x.orchestrator)) {
    fail('probe-record', `pid ${pid}`, `the process ${pid} is ${x.orchestrator ? 'not recognised as Claude Code' : 'not in the process table'}, so the running version is unknown`, 'pass the pid of the orchestrator Claude Code process');
    return;
  }
  if (!x.running) {
    fail('probe-record', `pid ${pid}`, `the version of the Claude Code process ${pid} cannot be read from its executable`, 'run the preflight as the user of the orchestrator');
    return;
  }
  const v = x.running.text;
  const onPath = readClaudeVersion(x.env);
  if (!onPath) {
    fail('probe-record', 'claude --version', 'claude --version gave no version', 'make claude --version runnable from this shell');
    return;
  }
  if (onPath.text !== v) {
    fail('probe-record', 'claude --version', `claude --version on PATH is ${onPath.text}, the running Claude Code is ${v}`, 'put the binary of the running version first on PATH, or start the session from the PATH binary');
    return;
  }
  if (!x.record) {
    const file = probeRecordPath(x.args.dataDir, v);
    fail('probe-record', v, existsSync(file) ? `the record ${file} exists but its MAC does not verify` : `no accepted record for ${v} in ${x.args.dataDir}/probes`, `run the probe session on ${v} and accept it with run.mjs probe --accept`);
    return;
  }
  const missing = [];
  if (!rowHolds(x.record, 'A-5', 'auto')) missing.push('A-5 in auto does not show the prompt');
  if (!rowHolds(x.record, 'A-12', 'auto')) missing.push('A-12 in auto does not show the refusal');
  if (!rowHolds(x.record, 'A-23', 'auto')) missing.push('A-23 in auto does not show the handback');
  for (const m of missing) fail('probe-record', v, m, `repeat the probe session on ${v} and accept the record`);
}

function otherActiveRuns(dataDir, run, fail) {
  const pointer = join(dataDir, 'active-runs.json');
  if (!existsSync(pointer)) return;
  let ids;
  try {
    const doc = JSON.parse(readFileSync(pointer, 'utf8'));
    ids = [...new Set([...Object.values(doc.sessions ?? {}), ...Object.values(doc.projects ?? {})].map((e) => (typeof e === 'string' ? e : e?.run_id)))];
  } catch {
    fail('data-directory', 'active-runs.json', 'not readable', 'repair or remove it outside Claude Code');
    return;
  }
  for (const id of ids.filter((i) => i !== run)) {
    let active = true;
    try {
      active = isActiveRun(JSON.parse(readFileSync(join(stateDirOf(dataDir, id), 'run.json'), 'utf8')));
    } catch {
      active = true;
    }
    if (active) fail('data-directory', `active run ${id}`, `active run ${id} in active-runs.json, not the run named by --run`, `finish or abandon ${id}, or pass it as --run`);
  }
}

export function dataDirectory(x, fail) {
  const { dataDir, run } = x.args;
  otherActiveRuns(dataDir, run, fail);
  if (run) {
    try {
      const doc = readCounters(stateDirOf(dataDir, run));
      const hit = uncapturedFinished(doc);
      if (hit) fail('data-directory', `spawn ${hit.tool_use_id}`, `spawn ${hit.tool_use_id} of ${run} has finished_at and no capture`, `mark the spawn void in counters.json of ${run} outside Claude Code, or capture its verdict`);
      const stop = uncapturedStop(doc);
      if (stop) fail('data-directory', `stop entry ${stop.agent_id}`, `agent ${stop.agent_id} (${stop.entry.agent_type}) finished in ${run} with no bound spawn and no capture`, `mark the stop entry ${stop.agent_id} void in counters.json of ${run} outside Claude Code (UC-12 step 7)`);
      const types = [...new Set(Object.values(doc.pending).map((p) => p.agent_type).filter((t) => captureBound(t)))];
      for (const type of types) {
        for (const u of unboundPending(doc, type)) fail('data-directory', `unbound spawn ${u.tool_use_id}`, `spawn ${u.tool_use_id} of ${type} for task ${u.task ?? 'unknown'} in ${run} is pending and bound to no agent`, `mark the spawn ${u.tool_use_id} void in counters.json of ${run} outside Claude Code (UC-12 step 2)`);
      }
    } catch (e) {
      if (!(e instanceof CountersError && e.code === 'counters-missing')) fail('data-directory', `counters of ${run}`, 'counters.json is not readable', 'repair it outside Claude Code');
    }
  }
  const probes = join(dataDir, 'probes');
  if (!existsSync(probes)) return;
  for (const name of readdirSync(probes).filter((n) => n.endsWith('.json'))) {
    if (readProbeRecord(dataDir, name.slice(0, -5), x.env) === null) fail('data-directory', `probes/${name}`, `probes/${name} does not verify (MAC, version or hash)`, `remove probes/${name} outside Claude Code and accept the record again`);
  }
}
