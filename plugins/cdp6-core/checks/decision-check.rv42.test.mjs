import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initRun } from '../lib/run-store.mjs';
import { backCaptures, captureText } from '../lib/capture-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'decision-check.mjs');
const T1 = '2026-01-01T10:00:00.000Z';
const T15 = '2026-01-01T10:30:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const live = { path: 'idea/idea.md', sha256: sha('current\n') };
const old = { path: 'idea/idea.md', sha256: sha('older\n') };

function snapshot() {
  const dir = tempDir('cdp6-rv42-snap-');
  mkdirSync(join(dir, 'idea'));
  writeFileSync(join(dir, 'idea', 'idea.md'), 'current\n');
  return dir;
}

function run(captures, ownerRecords = []) {
  const R = join(tempDir('cdp6-rv42-'), 'RUN-20260101-x');
  initRun(R, {
    run_id: 'RUN-20260101-x',
    status: 'active',
    ids: { next: { D: 2 } },
    decisions: { 'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'decided', at: T2, decider: 'owner' }] } },
    owner_records: ownerRecords,
    phases: {},
  });
  backCaptures(R, captures);
  return R;
}

function cap(over = {}) {
  return { id: 'V-cap-1', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', decision: 'D-1', verdict: 'a', objections: [], targets: [live], stamp: T1, ...over };
}

function check(R) {
  const r = spawnSync(process.execPath, [CHECK, '--run-dir', R, '--snapshot', snapshot()], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('rv42: object records for the items of a rejected conflicted capture clear it, as UC-12 step 5 counts them whatever its validator result', () => {
  const text = captureText({ verdict: 'a', conflicted: true, objections: ['F-P1-1'] }).replace('rejected alternative provided: yes', 'rejected alternative provided: no');
  const rec = { kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T2 };
  const r = check(run([cap({ conflicted: true, text }), cap({ id: 'V-cap-2', stamp: T15 })], [rec]));
  assert.equal(r.status, 0, `a rejected conflicted capture cannot be cleared by its object records: ${r.out}`);
});

test('rv42: a conflicted capture whose target changed before the exit still keeps its decision open, since C13 lists no stale path among the ways it clears', () => {
  const conflicted = cap({ conflicted: true, targets: [old], text: captureText({ verdict: 'a', conflicted: true, objections: ['F-P1-1'] }) });
  const r = check(run([conflicted, cap({ id: 'V-cap-2', stamp: T15 })]));
  assert.equal(r.status, 1, `editing the target cured the conflict: ${r.out}`);
  assert.match(r.out, /V-cap-1:F-P1-1 of a conflicted capture/);
});

test('rv42: an index line whose id is not its file name without .md is a finding', () => {
  const R = run([cap()]);
  const index = join(R, 'verdicts', 'index.jsonl');
  const line = JSON.parse(readFileSync(index, 'utf8'));
  writeFileSync(index, `${JSON.stringify({ ...line, id: 'V-cap-9' })}\n`);
  const r = check(R);
  assert.equal(r.status, 1, `an index id that is not the capture file name was counted: ${r.out}`);
});
