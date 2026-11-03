import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initRun } from '../lib/run-store.mjs';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'decision-check.mjs');

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';
const T3 = '2026-01-01T12:00:00.000Z';

function fixture({ decidedAt = T2, captures = [], ownerRecords = [], status = 'decided', decisionsMd } = {}) {
  const R = join(mkdtempSync(join(tmpdir(), 'cdp6-dc-')), 'RUN-20260101-x');
  const stamps = [{ status: 'proposed', at: T1, decider: 'operator' }];
  if (status !== 'proposed') stamps.push({ status, at: decidedAt, decider: 'owner' });
  initRun(R, {
    run_id: 'RUN-20260101-x',
    status: 'active',
    ids: { next: { D: 2 } },
    decisions: { 'D-1': { status, decider: 'owner', stamps } },
    owner_records: ownerRecords,
    phases: {},
  });
  mkdirSync(join(R, 'verdicts'), { recursive: true });
  writeFileSync(join(R, 'verdicts', 'index.jsonl'), captures.map((c) => JSON.stringify(c)).join('\n') + (captures.length ? '\n' : ''));
  if (decisionsMd !== undefined) writeFileSync(join(R, 'decisions.md'), decisionsMd);
  return R;
}

function capture(over = {}) {
  return { id: 'V-cap-1', agent_type: 'cdp6-core:devils-advocate', task: 'gate', decision: 'D-1', verdict: 'a', objections: [], stamp: T1, ...over };
}

function check(R) {
  const r = spawnSync(process.execPath, [CHECK, '--run-dir', R], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('passes a decided D-n whose devils-advocate capture came first', () => {
  const r = check(fixture({ captures: [capture()] }));
  assert.equal(r.status, 0, r.out);
});

test('accepts verdict a with conditions', () => {
  assert.equal(check(fixture({ captures: [capture({ verdict: 'a-with-conditions' })] })).status, 0);
});

test('ignores a D-n that is not decided', () => {
  assert.equal(check(fixture({ status: 'proposed' })).status, 0);
});

test('fires: owner pick before counter-role', () => {
  const r = check(fixture({ decidedAt: T2, captures: [capture({ stamp: T3 })] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /D-1/);
  assert.ok(r.out.includes(T2) && r.out.includes(T3), r.out);
});

test('fires: decided without any capture', () => {
  const r = check(fixture({ captures: [] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /D-1: no devils-advocate capture/);
});

test('fires: capture of another role does not count', () => {
  const r = check(fixture({ captures: [capture({ agent_type: 'cdp6-core:review-verify' })] }));
  assert.equal(r.status, 1);
});

test('fires: capture for another D-n does not count', () => {
  assert.equal(check(fixture({ captures: [capture({ decision: 'D-2' })] })).status, 1);
});

test('fires: not decidable is no pass', () => {
  const r = check(fixture({ captures: [capture({ verdict: 'not-decidable' })] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /not a pass/);
});

test('fires: block without human record', () => {
  const r = check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /F-P1-1/);
});

test('a block verdict passes when every objection has an owner record in run.json', () => {
  const rec = { kind: 'object', id: 'F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T2 };
  const r = check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], ownerRecords: [rec] }));
  assert.equal(r.status, 0, r.out);
});

test('fires: verdict c is not cleared by an accept record and is cleared by a reject record', () => {
  const rec = (verdict) => ({ kind: 'object', id: 'F-P1-1', verdict, why: 'x', decider: 'owner', at: T2 });
  const caps = [capture({ verdict: 'c', objections: ['F-P1-1'] })];
  const accepted = check(fixture({ captures: caps, ownerRecords: [rec('accept')] }));
  assert.equal(accepted.status, 1, accepted.out);
  assert.match(accepted.out, /F-P1-1.*reject/);
  assert.equal(check(fixture({ captures: caps, ownerRecords: [rec('reject')] })).status, 0);
  assert.equal(check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], ownerRecords: [rec('accept')] })).status, 0);
});

test('fires: objection record outside run.json', () => {
  const md = '# Decisions\n\n| D-1 | pick A | user | decided | owner |\n\nObjection F-P1-1: accept, decider owner, 2026-01-01\n';
  const R = fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], decisionsMd: md });
  const r = check(R);
  assert.equal(r.status, 1);
  assert.match(r.out, /F-P1-1.*run\.json|run\.json.*F-P1-1/);
});

test('fires: conflicted capture needs owner records', () => {
  const r = check(fixture({ captures: [capture({ conflicted: true, objections: ['F-P1-2'] })] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /F-P1-2/);
});

test('usage, unreadable run record and unreadable index exit 2', () => {
  assert.equal(spawnSync(process.execPath, [CHECK], { encoding: 'utf8' }).status, 2);
  const R = fixture({ captures: [capture()] });
  writeFileSync(join(R, 'verdicts', 'index.jsonl'), 'not json\n');
  assert.equal(check(R).status, 2);
  writeFileSync(join(R, 'run.json'), '{');
  assert.equal(check(R).status, 2);
});
