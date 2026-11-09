import { existsSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { StoreError, withLock } from './run-store.mjs';

const WAIT_MS = 2000;

export class CountersError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function countersPath(S) {
  return join(S, 'counters.json');
}

export function readCounters(S) {
  const file = countersPath(S);
  if (!existsSync(file)) throw new CountersError('counters-missing', 'counters.json is missing');
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new CountersError('counters-unreadable', 'counters.json is not readable');
  }
  let doc;
  try {
    doc = JSON.parse(text);
  } catch {
    throw new CountersError('counters-malformed', 'counters.json is not valid JSON');
  }
  if (!doc || typeof doc !== 'object' || Array.isArray(doc)) throw new CountersError('counters-malformed', 'counters.json is not an object');
  const pending = doc.pending ?? {};
  if (typeof pending !== 'object' || Array.isArray(pending) || Object.values(pending).some((p) => !p || typeof p !== 'object' || Array.isArray(p))) {
    throw new CountersError('counters-malformed', 'counters.json holds a malformed pending key');
  }
  const stops = doc.stops ?? {};
  if (typeof stops !== 'object' || Array.isArray(stops) || Object.values(stops).some((p) => !p || typeof p !== 'object' || Array.isArray(p))) {
    throw new CountersError('counters-malformed', 'counters.json holds a malformed stops key');
  }
  return { ...doc, pending };
}

function write(S, doc) {
  const file = countersPath(S);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
}

function locked(S, waitMs, fn) {
  try {
    return withLock(join(S, 'counters.lock'), fn, { waitMs });
  } catch (e) {
    if (e instanceof StoreError) throw new CountersError(e.code, e.message);
    throw e;
  }
}

export function unboundPending(doc, agentType) {
  return Object.entries(doc.pending ?? {})
    .filter(([, p]) => p.agent_type === agentType && !p.agent_id && !p.closed_at && !p.void)
    .map(([id, p]) => ({ tool_use_id: id, task: p.task ?? null }));
}

export function addPending(S, spawn, { waitMs = WAIT_MS, exclusiveRole = false } = {}) {
  return locked(S, waitMs, () => {
    const doc = readCounters(S);
    if (doc.pending[spawn.tool_use_id]) return doc.pending[spawn.tool_use_id];
    if (exclusiveRole) {
      const open = Object.entries(doc.pending).find(([, p]) => p.agent_type === spawn.agent_type && p.agent_id && !p.closed_at && !p.void);
      if (open) {
        const error = new CountersError('role-pending', `the spawn ${open[0]} of ${spawn.agent_type} for task ${open[1].task ?? 'unknown'} (agent ${open[1].agent_id}) is bound and has no capture`);
        error.unbound = unboundPending(doc, spawn.agent_type);
        throw error;
      }
    }
    doc.pending[spawn.tool_use_id] = { ...spawn, agent_id: null };
    write(S, doc);
    return doc.pending[spawn.tool_use_id];
  });
}

export function bindPending(S, agentType, agentId, { waitMs = WAIT_MS } = {}) {
  return locked(S, waitMs, () => {
    const doc = readCounters(S);
    const open = Object.entries(doc.pending).filter(([, p]) => p.agent_type === agentType && !p.agent_id && !p.void);
    if (open.length === 0) return { status: 'none' };
    if (open.length > 1) return { status: 'many', count: open.length };
    const [id, spawn] = open[0];
    doc.pending[id] = { ...spawn, agent_id: agentId, bound_at: new Date().toISOString() };
    write(S, doc);
    return { status: 'bound', tool_use_id: id, spawn: doc.pending[id] };
  });
}

export function boundSpawn(S, agentId) {
  if (typeof agentId !== 'string' || agentId === '') return null;
  const hit = Object.entries(readCounters(S).pending).find(([, p]) => p.agent_id === agentId && !p.void);
  return hit ? { tool_use_id: hit[0], spawn: hit[1] } : null;
}

export function closePending(S, toolUseId, work, { captureSha256, waitMs = WAIT_MS } = {}) {
  return locked(S, waitMs, () => {
    const doc = readCounters(S);
    const spawn = doc.pending[toolUseId];
    if (!spawn) throw new CountersError('spawn-unknown', 'no pending spawn with this tool_use_id');
    if (spawn.closed_at) throw new CountersError('spawn-closed', 'the pending spawn is already closed');
    const result = work();
    doc.pending[toolUseId] = { ...spawn, closed_at: new Date().toISOString(), capture_sha256: captureSha256 };
    write(S, doc);
    return result;
  });
}

export function initCounters(S) {
  try {
    writeFileSync(countersPath(S), `${JSON.stringify({ version: 1 }, null, 2)}\n`, { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (e.code === 'EEXIST') throw new CountersError('counters-exists', 'counters.json exists');
    throw new CountersError('counters-unwritable', 'counters.json could not be created');
  }
}

export function markFinished(S, agentId, { waitMs = WAIT_MS, agentType } = {}) {
  if (typeof agentId !== 'string' || agentId === '') return { status: 'none' };
  return locked(S, waitMs, () => {
    const doc = readCounters(S);
    const hit = Object.entries(doc.pending).find(([, p]) => p.agent_id === agentId && !p.void);
    if (!hit) {
      const voided = Object.values(doc.pending).some((p) => p.agent_id === agentId);
      if (agentType === undefined) return { status: 'none' };
      if (voided) return { status: 'none', voided: true };
      const stops = { ...doc.stops };
      stops[agentId] = stops[agentId] ?? { agent_type: agentType, finished_at: new Date().toISOString() };
      write(S, { ...doc, stops });
      return { status: 'unbound', entry: stops[agentId] };
    }
    const [id, spawn] = hit;
    if (spawn.closed_at) return { status: 'closed' };
    if (spawn.finished_at) return { status: 'already' };
    doc.pending[id] = { ...spawn, finished_at: new Date().toISOString() };
    write(S, doc);
    return { status: 'marked', tool_use_id: id, spawn: doc.pending[id] };
  });
}

export function uncapturedFinished(doc) {
  const hit = Object.entries(doc.pending ?? {}).find(([, p]) => p.finished_at && !p.closed_at && !p.void);
  return hit ? { tool_use_id: hit[0], spawn: hit[1] } : null;
}

export function uncapturedBound(doc, isCaptureBound) {
  return Object.entries(doc.pending ?? {})
    .filter(([, p]) => isCaptureBound(p.agent_type) && !p.closed_at && !p.void)
    .map(([tool_use_id, spawn]) => ({ tool_use_id, spawn }));
}

export function uncapturedStop(doc) {
  const hit = Object.entries(doc.stops ?? {}).find(([, e]) => e.finished_at && !e.void);
  return hit ? { agent_id: hit[0], entry: hit[1] } : null;
}
