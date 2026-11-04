#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { agentName } from '../lib/agent-name.mjs';
import { CaptureError, capture } from '../lib/capture.mjs';
import { normalizeText, pluginRoot, verify } from '../lib/contract.mjs';
import { CountersError, boundSpawn } from '../lib/counters.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { findRun } from '../lib/run-store.mjs';
import { validateCapture } from '../checks/verdict-check.mjs';

const HANDBACK_TOOL = 'SubagentHandback';
const SECOND_LINE = /^run: (\S+) task: (\S+)$/;
const SAFE_TASK = /^[A-Za-z0-9._-]+$/;

export function markerPath(dataDir, agentId) {
  return join(dataDir, 'handback-asked', `${createHash('sha256').update(String(agentId), 'utf8').digest('hex')}.json`);
}

function deny(reason) {
  return { decision: 'deny', reason };
}

function markerDoc(dataDir, agentId) {
  try {
    const doc = JSON.parse(readFileSync(markerPath(dataDir, agentId), 'utf8'));
    return doc !== null && typeof doc === 'object' && !Array.isArray(doc) ? doc : {};
  } catch {
    return {};
  }
}

function asked(dataDir, agentId, cause) {
  return markerDoc(dataDir, agentId)[cause]?.asked === true;
}

function markAsked(dataDir, agentId, cause, now) {
  const file = markerPath(dataDir, agentId);
  try {
    mkdirSync(join(dataDir, 'handback-asked'), { recursive: true, mode: 0o700 });
    writeFileSync(file, `${JSON.stringify({ ...markerDoc(dataDir, agentId), [cause]: { asked: true, at: now.toISOString() } })}\n`, { mode: 0o600 });
  } catch {
    return;
  }
}

function denyOnce(reason, dataDir, agentId, now, cause = 'other') {
  if (asked(dataDir, agentId, cause)) return { decision: 'none' };
  markAsked(dataDir, agentId, cause, now);
  return deny(reason);
}

function acknowledgement(lines, v) {
  const expected = `cdp6-contract: v${v.version} ${v.hash}`;
  return lines[0]?.trimEnd() === expected ? null : `the first line of the final answer must be "${expected}"`;
}

const RUN_DENIES = {
  'pointer-missing': 'the run pointer is missing while an active run exists',
  'pointer-unreadable': 'the run pointer is not readable',
};

const COUNTERS_DENIES = {
  'lock-busy': 'counters.json is locked by another writer',
  'lock-error': 'the lock file of counters.json cannot be created',
  'spawn-closed': 'the spawn bound to this agent id is already closed with another capture',
  'spawn-unknown': 'no pending spawn matches this agent id any more',
};

const CAPTURE_DENIES = {
  'name-unsafe': 'the spawn bound to this agent id has no valid brief header',
  'lock-busy': 'the verdict index is locked by another writer',
  'lock-error': 'the lock file of the verdict index cannot be created',
  'capture-exists': 'a capture of this task, role and agent id already exists',
  'capture-failed': 'the handback could not be captured',
  'index-unreadable': 'the verdict index is not readable, so the handback cannot be captured',
};

export function reasonOf(e) {
  if (e instanceof CountersError) return COUNTERS_DENIES[e.code] ?? `counters.json cannot be used (${e.code})`;
  return CAPTURE_DENIES[e.code] ?? 'the handback could not be captured';
}

function binding(S, lines, runId, agentId, sha256) {
  const second = SECOND_LINE.exec((lines[1] ?? '').trimEnd());
  if (!second) return { refusal: 'the second line of the final answer must be "run: <run-id> task: <task>" with the run id and the task id of your brief header' };
  if (second[1] !== runId) return { refusal: 'the run id on the second line is not the id of the active run' };
  const bound = boundSpawn(S, agentId);
  if (!bound) return { refusal: 'no spawn is bound to this agent id' };
  const spawn = bound.spawn;
  if (spawn.header !== 'ok' || typeof spawn.task !== 'string' || !SAFE_TASK.test(spawn.task)) return { refusal: 'the spawn bound to this agent id has no valid brief header' };
  if (second[2] !== spawn.task) return { refusal: 'the task on the second line differs from the task of the spawn bound to this agent id' };
  if (spawn.closed_at && spawn.capture_sha256 === sha256) return { already: sha256 };
  return { toolUseId: bound.tool_use_id, spawn };
}

export function decide(input, env, now = new Date()) {
  if (input.tool_name !== HANDBACK_TOOL || !agentName(input.agent_type)) return { skip: true };
  const agentId = input.agent_id;
  if (typeof agentId !== 'string' || agentId === '') return deny('the hook input has no agent_id');
  const v = verify(pluginRoot(env));
  if (!v.ok) return deny('the CDP6 worker contract could not be verified, so the handback is not accepted');
  const message = typeof input.tool_input?.message === 'string' ? input.tool_input.message : '';
  const lines = normalizeText(message).split('\n');
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return { decision: 'none' };
  const ack = acknowledgement(lines, v);
  if (ack) return denyOnce(ack, dataDir, agentId, now);
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd() });
  if (found.error) return denyOnce(RUN_DENIES[found.error] ?? 'the run record of the active run is not readable', dataDir, agentId, now);
  if (found.none || !found.run) return { decision: 'none' };
  let bound;
  try {
    bound = binding(found.S, lines, found.run.run_id, agentId, createHash('sha256').update(message, 'utf8').digest('hex'));
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    return denyOnce(reasonOf(e), dataDir, agentId, now);
  }
  if (bound.refusal) return denyOnce(bound.refusal, dataDir, agentId, now);
  if (bound.already) return { decision: 'none', capture_sha256: bound.already };
  const form = validateCapture(message, { agentType: input.agent_type, captureId: `${bound.spawn.task}-${agentName(input.agent_type)}-${agentId}` });
  if (form.validator === 'rejected' && !asked(dataDir, agentId, 'form')) return denyOnce(`the capture form fails: ${form.reasons.join('; ')}`, dataDir, agentId, now, 'form');
  try {
    const r = capture(found.S, { message, agentType: input.agent_type, agentId, toolUseId: bound.toolUseId, spawn: bound.spawn });
    return { decision: 'none', capture_sha256: r.sha256 };
  } catch (e) {
    if (!(e instanceof CountersError || e instanceof CaptureError)) throw e;
    return denyOnce(reasonOf(e), dataDir, agentId, now);
  }
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
    result = valid ? decide(input, env) : deny('check-handback.mjs could not read its input');
  } catch {
    result = deny('check-handback.mjs could not decide');
  }
  if (result.skip) return 0;
  recordFired(env.CLAUDE_PLUGIN_DATA, 'check-handback.mjs', valid ? input : null, result.decision, { capture_sha256: result.capture_sha256 });
  if (result.decision === 'deny') {
    process.stderr.write(`check-handback.mjs: ${result.reason}\n`);
    return 2;
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
