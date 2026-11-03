import { join } from 'node:path';

export const PHASES = ['idea', 'exploration', 'concept', 'refinement', 'implementation', 'verification', 'retro', 'loop-back'];
export const CLOSED_STATES = ['exited', 'imported', 'skipped'];

export function currentPhase(run) {
  return PHASES.find((p) => ['entered', 'gate-pending', 'blocked'].includes(run.phases[p]?.state));
}

export function nextAction(run) {
  if (run.status !== 'active') return 'run.mjs resume or run.mjs abandon (owner)';
  const cur = currentPhase(run);
  if (cur && run.phases[cur].state === 'gate-pending') {
    return run.phases[cur].gate?.passed ? `run.mjs approve ${cur} (owner)` : `fix the gate finding, then run.mjs exit ${cur}`;
  }
  if (cur) return `work in ${cur}, then run.mjs exit ${cur}`;
  const next = PHASES.find((p) => run.phases[p].state === 'pending');
  return next ? `run.mjs enter ${next}` : 'none';
}

export function statusText(S, run) {
  const cur = currentPhase(run);
  return [
    `run: ${run.run_id}`,
    `status: ${run.status}`,
    `phase: ${cur ? `${cur} ${run.phases[cur].state}` : 'none entered'}`,
    `next: ${nextAction(run)}`,
    `ledger: ${join(S, 'ledger.md')}`,
  ].join('\n');
}

export function predecessorOpen(run, phase) {
  const idx = PHASES.indexOf(phase);
  if (idx <= 0) return null;
  const prev = PHASES[idx - 1];
  return CLOSED_STATES.includes(run.phases[prev]?.state) ? null : prev;
}
