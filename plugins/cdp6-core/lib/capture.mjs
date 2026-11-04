import { createHash } from 'node:crypto';
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, rmdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { agentName } from './agent-name.mjs';
import { validateCapture } from '../checks/verdict-check.mjs';
import { CountersError, closePending } from './counters.mjs';
import { StoreError, withLock } from './run-store.mjs';
import { IndexError, indexPath, readIndex } from './verdict-index.mjs';

const WAIT_MS = 2000;
const SAFE = /^[A-Za-z0-9._-]+$/;
const DECISION = /^D-\d+$/;

export class CaptureError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function verdictsDir(S) {
  return join(S, 'verdicts');
}

function readIndexOrFail(S) {
  try {
    return readIndex(S);
  } catch (e) {
    if (e instanceof IndexError) throw new CaptureError(e.code, e.message);
    throw e;
  }
}

function restoreIndex(index, existed, existing) {
  const now = existsSync(index) ? readFileSync(index, 'utf8') : null;
  if (existed) {
    if (now !== existing) writeFileSync(index, existing);
  } else if (now !== null) {
    rmSync(index, { force: true });
  }
}

function rollback({ dir, file, index, existed, existing, dirExisted }) {
  const steps = [
    () => rmSync(join(dir, file), { force: true }),
    () => restoreIndex(index, existed, existing),
    () => {
      if (!dirExisted) rmdirSync(dir);
    },
  ];
  for (const step of steps) {
    try {
      step();
    } catch {
      continue;
    }
  }
}

function indexLine(spawn, { agentType, agentId, sha256, file, result }) {
  return {
    id: file.replace(/\.md$/, ''),
    sha256,
    agent_type: agentType,
    agent_id: agentId,
    task: spawn.task,
    file,
    targets: spawn.targets ?? [],
    decision: DECISION.test(spawn.task) ? spawn.task : null,
    verdict: result.verdict,
    objections: result.objections,
    premises: result.premises,
    conflicted: result.conflicted,
    stamp: new Date().toISOString(),
    validator: result.validator,
    reasons: result.reasons,
  };
}

export function capture(S, { message, agentType, agentId, toolUseId, spawn, waitMs = WAIT_MS, append = appendFileSync }) {
  const role = agentName(agentType);
  if (![spawn?.task, role, agentId].every((n) => typeof n === 'string' && SAFE.test(n))) {
    throw new CaptureError('name-unsafe', 'task, role or agent id holds characters outside [A-Za-z0-9._-]');
  }
  const file = `${spawn.task}-${role}-${agentId}.md`;
  const sha256 = createHash('sha256').update(message, 'utf8').digest('hex');
  const result = validateCapture(message, { agentType, captureId: file.replace(/\.md$/, '') });
  try {
    return withLock(
      join(S, 'verdicts.lock'),
      () => {
        readIndexOrFail(S);
        if (existsSync(join(verdictsDir(S), file))) throw new CaptureError('capture-exists', 'a capture of this task, role and agent id exists');
        const dir = verdictsDir(S);
        const index = indexPath(S);
        const dirExisted = existsSync(dir);
        const existed = existsSync(index);
        const existing = existed ? readFileSync(index, 'utf8') : '';
        let wrote = false;
        try {
          closePending(
            S,
            toolUseId,
            () => {
              mkdirSync(dir, { recursive: true, mode: 0o700 });
              writeFileSync(join(dir, file), message, { flag: 'wx', mode: 0o600 });
              wrote = true;
              const prefix = existing !== '' && !existing.endsWith('\n') ? '\n' : '';
              append(index, `${prefix}${JSON.stringify(indexLine(spawn, { agentType, agentId, sha256, file, result }))}\n`, { mode: 0o600 });
            },
            { captureSha256: sha256, waitMs },
          );
        } catch (e) {
          if (wrote) rollback({ dir, file, index, existed, existing, dirExisted });
          if (e instanceof StoreError || e instanceof CountersError || e instanceof CaptureError) throw e;
          throw new CaptureError('capture-failed', 'the capture could not be written');
        }
        return { file, sha256 };
      },
      { waitMs },
    );
  } catch (e) {
    if (e instanceof StoreError) throw new CaptureError(e.code, e.message);
    throw e;
  }
}
