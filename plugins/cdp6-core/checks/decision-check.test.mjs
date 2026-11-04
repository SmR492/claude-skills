import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initRun } from '../lib/run-store.mjs';
import { backCaptures, captureText } from '../lib/capture-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'decision-check.mjs');

const T1 = '2026-01-01T10:00:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';
const T3 = '2026-01-01T12:00:00.000Z';

const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

function snapshotWith(files) {
  const dir = tempDir('cdp6-dc-snap-');
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const live = { path: 'idea/idea.md', sha256: sha('current\n') };
const old = { path: 'idea/idea.md', sha256: sha('older\n') };

const NO_SNAPSHOT = Symbol('no snapshot argument');
const defaultSnapshot = snapshotWith({ 'idea/idea.md': 'current\n' });

function fixture({ decidedAt = T2, captures = [], ownerRecords = [], status = 'decided', decisionsMd } = {}) {
  const R = join(tempDir('cdp6-dc-'), 'RUN-20260101-x');
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
  backCaptures(R, captures);
  if (decisionsMd !== undefined) writeFileSync(join(R, 'decisions.md'), decisionsMd);
  return R;
}

function capture(over = {}) {
  return { id: 'V-cap-1', agent_type: 'cdp6-core:devils-advocate', task: 'gate', decision: 'D-1', verdict: 'a', objections: [], targets: [live], stamp: T1, ...over };
}

function check(R, snapshot) {
  const snap = snapshot === undefined ? defaultSnapshot : snapshot;
  const r = spawnSync(process.execPath, [CHECK, '--run-dir', R, ...(snap === NO_SNAPSHOT ? [] : ['--snapshot', snap])], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('passes a decided D-n whose devils-advocate capture came first', () => {
  const r = check(fixture({ captures: [capture()] }));
  assert.equal(r.status, 0, r.out);
});

test('accepts verdict a with conditions', () => {
  assert.equal(check(fixture({ captures: [capture({ verdict: 'a-with-conditions' })] })).status, 0);
});

test('fires: a D-n still proposed fails the gate with a finding naming it, a superseded one does not', () => {
  const proposed = check(fixture({ status: 'proposed' }));
  assert.equal(proposed.status, 1, proposed.out);
  assert.match(proposed.out, /decision-check FAIL D-1: still proposed/);
  const superseded = check(fixture({ status: 'superseded' }));
  assert.equal(superseded.status, 0, superseded.out);
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
  const rec = { kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T2 };
  const r = check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], ownerRecords: [rec] }));
  assert.equal(r.status, 0, r.out);
});

test('fires: verdict c is not cleared by an accept record and is cleared by a reject record', () => {
  const rec = (verdict) => ({ kind: 'object', id: 'V-cap-1:F-P1-1', verdict, why: 'x', decider: 'owner', at: T2 });
  const caps = [capture({ verdict: 'c', objections: ['F-P1-1'] })];
  const accepted = check(fixture({ captures: caps, ownerRecords: [rec('accept')] }));
  assert.equal(accepted.status, 1, accepted.out);
  assert.match(accepted.out, /F-P1-1.*reject/);
  assert.equal(check(fixture({ captures: caps, ownerRecords: [rec('reject')] })).status, 0);
  assert.equal(check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], ownerRecords: [rec('accept')] })).status, 0);
});

test('fires: an objection is cleared only by a record scoped by its own capture id, never by a bare id or the id of another capture', () => {
  const rec = (id) => ({ kind: 'object', id, verdict: 'accept', why: 'x', decider: 'owner', at: T2 });
  const caps = [capture({ verdict: 'b', objections: ['F-P1-1'] })];
  for (const id of ['F-P1-1', 'V-cap-2:F-P1-1', 'V-cap-1:F-P1-2', 'V-cap-1:premise-1']) {
    const r = check(fixture({ captures: caps, ownerRecords: [rec(id)] }));
    assert.equal(r.status, 1, `${id}: ${r.out}`);
    assert.match(r.out, /V-cap-1:F-P1-1/);
  }
  assert.equal(check(fixture({ captures: caps, ownerRecords: [rec('V-cap-1:F-P1-1')] })).status, 0);
  const conflicted = [capture({ conflicted: true, objections: ['F-P1-2'], premises: ['V-cap-1:premise-1'] })];
  const partial = check(fixture({ captures: conflicted, ownerRecords: [rec('F-P1-2'), rec('V-cap-1:premise-1')] }));
  assert.equal(partial.status, 1, partial.out);
  assert.match(partial.out, /objection V-cap-1:F-P1-2/);
  assert.equal(check(fixture({ captures: conflicted, ownerRecords: [rec('V-cap-1:F-P1-2'), rec('V-cap-1:premise-1')] })).status, 0);
});

test('fires: the gate re-reads the capture file, it must match the index line by sha256 and the verdict fields come from the file', () => {
  const R = fixture({ captures: [capture()] });
  assert.equal(check(R).status, 0);
  writeFileSync(join(R, 'verdicts', 'V-cap-1.md'), captureText({ verdict: 'a', premises: ['x'] }));
  const changed = check(R);
  assert.equal(changed.status, 1, changed.out);
  assert.match(changed.out, /V-cap-1: the capture file V-cap-1\.md differs from the sha256 of its index line/);
  assert.match(changed.out, /D-1: no devils-advocate capture/);
  const lying = check(fixture({ captures: [capture({ verdict: 'a', text: captureText({ verdict: 'b', objections: ['F-P1-1'] }) })] }));
  assert.equal(lying.status, 1, lying.out);
  assert.match(lying.out, /V-cap-1:F-P1-1 has no run\.mjs object record/);
  const invalid = check(fixture({ captures: [capture({ validator: 'valid', text: 'verdict: a\n' })] }));
  assert.equal(invalid.status, 1, invalid.out);
  assert.match(invalid.out, /D-1: every devils-advocate capture is rejected/);
  const conflictedFile = check(fixture({ captures: [capture({ conflicted: false, text: captureText({ verdict: 'a', conflicted: true, objections: ['F-P1-3'] }) })] }));
  assert.equal(conflictedFile.status, 1, conflictedFile.out);
  assert.match(conflictedFile.out, /V-cap-1:F-P1-3 of a conflicted capture/);
});

test('fires: an index line without its capture file and a capture file without its index line are findings', () => {
  const R = fixture({ captures: [capture(), capture({ id: 'V-cap-2', stamp: T2 })] });
  rmSync(join(R, 'verdicts', 'V-cap-2.md'));
  const missing = check(R);
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /V-cap-2: the capture file V-cap-2\.md is missing/);
  const R2 = fixture({ captures: [capture()] });
  writeFileSync(join(R2, 'verdicts', 'D-1-devils-advocate-ag5.md'), captureText({ verdict: 'a' }));
  const orphan = check(R2);
  assert.equal(orphan.status, 1, orphan.out);
  assert.match(orphan.out, /D-1-devils-advocate-ag5\.md: capture file without an index line/);
  const R3 = fixture({ captures: [capture({ file: '../escape.md', sha256: sha('x') })] });
  const unsafe = check(R3);
  assert.equal(unsafe.status, 1, unsafe.out);
  assert.match(unsafe.out, /V-cap-1: the index line names no usable capture file/);
  const R4 = fixture({ captures: [capture({ file: undefined })] });
  writeFileSync(join(R4, 'verdicts', 'index.jsonl'), JSON.stringify({ ...capture(), file: undefined }) + '\n');
  assert.equal(check(R4).status, 1);
});

test('fires: a conflicted capture keeps its decision open whatever its validator result', () => {
  const stake = captureText({ verdict: 'a', conflicted: true });
  const rejectedStake = stake.replace('rejected alternative provided: yes', 'rejected alternative provided: no');
  const clean = capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z' });
  const valid = check(fixture({ captures: [capture({ conflicted: true, text: stake }), clean] }));
  assert.equal(valid.status, 1, valid.out);
  assert.match(valid.out, /D-1: conflicted capture V-cap-1 lists no objection or premise and has no run\.mjs object V-cap-1:conflict record/);
  const rejected = check(fixture({ captures: [capture({ conflicted: true, validator: 'rejected', text: rejectedStake }), clean] }));
  assert.equal(rejected.status, 1, rejected.out);
  assert.match(rejected.out, /D-1: conflicted capture V-cap-1 lists no objection or premise and has no run\.mjs object V-cap-1:conflict record/);
  const unconflicted = check(fixture({ captures: [capture({ validator: 'rejected', text: rejectedStake.replace('author of D-2', 'none') }), clean] }));
  assert.equal(unconflicted.status, 0, unconflicted.out);
  const after = check(fixture({ captures: [capture({ conflicted: true, text: stake, stamp: T3 }), clean], decidedAt: T2 }));
  assert.equal(after.status, 0, after.out);
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

test('fires: a devils-advocate capture of a decision with no target is stale, with or without a snapshot argument', () => {
  const bare = capture({ targets: [] });
  for (const snap of [undefined, NO_SNAPSHOT]) {
    const r = check(fixture({ captures: [bare] }), snap);
    assert.equal(r.status, 1, r.out);
    assert.match(r.out, /D-1: every devils-advocate capture is stale/);
  }
  assert.equal(check(fixture({ captures: [bare, capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z' })] })).status, 0);
  const worse = check(fixture({ captures: [capture({ id: 'V-cap-2' }), { ...bare, verdict: 'b', objections: ['F-P1-1'], stamp: '2026-01-01T10:30:00.000Z' }] }));
  assert.equal(worse.status, 1, worse.out);
  assert.match(worse.out, /V-cap-1:F-P1-1/);
  const answered = check(fixture({ captures: [capture({ id: 'V-cap-2' }), { ...bare, verdict: 'b', objections: ['F-P1-1'], stamp: '2026-01-01T10:30:00.000Z' }], ownerRecords: [{ kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(answered.status, 0, answered.out);
});

test('fires: a stale target is dropped before the latest capture is picked, a stale block still needs its records', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const onlyStale = check(fixture({ captures: [capture({ targets: [old] })] }), snap);
  assert.equal(onlyStale.status, 1, onlyStale.out);
  assert.match(onlyStale.out, /D-1.*stale/);
  const fresh = capture({ id: 'V-1', targets: [live], stamp: T1 });
  const staleBlock = capture({ id: 'V-2', targets: [old], verdict: 'b', objections: ['F-P1-1'], stamp: '2026-01-01T10:30:00.000Z' });
  const kept = check(fixture({ captures: [fresh, staleBlock] }), snap);
  assert.equal(kept.status, 1, kept.out);
  assert.match(kept.out, /V-2:F-P1-1/);
  const keptCleared = check(fixture({ captures: [fresh, staleBlock], ownerRecords: [{ kind: 'object', id: 'V-2:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }), snap);
  assert.equal(keptCleared.status, 0, keptCleared.out);
  const freshBlock = capture({ id: 'V-3', targets: [live], verdict: 'b', objections: ['F-P1-1'], stamp: '2026-01-01T10:30:00.000Z' });
  const blocked = check(fixture({ captures: [fresh, freshBlock] }), snap);
  assert.equal(blocked.status, 1, blocked.out);
  const missing = check(fixture({ captures: [capture({ targets: [{ path: 'idea/gone.md', sha256: sha('x') }] })] }), snap);
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /stale/);
  assert.equal(check(fixture({ captures: [capture({ targets: [live] })] }), snap).status, 0);
});

test('fires: a snapshot directory that is missing or unreadable exits 2, as does a target without a snapshot argument', () => {
  const R = fixture({ captures: [capture({ targets: [live] })] });
  const gone = join(tempDir('cdp6-dc-gone-'), 'nope');
  const missing = check(R, gone);
  assert.equal(missing.status, 2, missing.out);
  assert.match(missing.out, /decision-check: snapshot-unreadable/);
  const file = join(tempDir('cdp6-dc-file-'), 'f');
  writeFileSync(file, 'x');
  assert.equal(check(R, file).status, 2);
  assert.equal(check(fixture({ captures: [capture()] }), gone).status, 2);
  const noArgument = check(R, NO_SNAPSHOT);
  assert.equal(noArgument.status, 2, noArgument.out);
  assert.match(noArgument.out, /snapshot-missing/);
  assert.equal(spawnSync(process.execPath, [CHECK, '--run-dir', R, '--snapshot'], { encoding: 'utf8' }).status, 2);
});

test('fires: a rejected capture is not counted, so a decision resting only on it stays open', () => {
  const rejected = capture({ id: 'V-2', verdict: null, validator: 'rejected', reasons: ['the premises section is missing'], stamp: '2026-01-01T10:30:00.000Z' });
  const only = check(fixture({ captures: [rejected] }));
  assert.equal(only.status, 1, only.out);
  assert.match(only.out, /D-1: every devils-advocate capture is rejected/);
  const earlier = check(fixture({ captures: [capture({ id: 'V-1' }), rejected] }));
  assert.equal(earlier.status, 0, earlier.out);
  const notBuilt = check(fixture({ captures: [capture({ verdict: null, validator: 'not-built' })] }));
  assert.equal(notBuilt.status, 1, notBuilt.out);
});

test('fires: target-less devils-advocate capture counts against any artefact', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'rewritten after the verdict\n' });
  const r = check(fixture({ captures: [capture({ targets: [] })] }), snap);
  assert.equal(r.status, 1, `a capture bound to no artefact passed: ${r.out}`);
});

test('fires: objection id of another decision cleared by its owner record', () => {
  const R = join(tempDir('cdp6-dc-'), 'RUN-20260101-x');
  const stamps = [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'decided', at: T3, decider: 'owner' }];
  initRun(R, {
    run_id: 'RUN-20260101-x', status: 'active', ids: { next: { D: 3 } },
    decisions: { 'D-1': { status: 'decided', decider: 'owner', stamps }, 'D-2': { status: 'decided', decider: 'owner', stamps } },
    owner_records: [{ kind: 'object', id: 'F-P1-1', verdict: 'accept', why: 'judged for D-1 only', decider: 'owner', at: T2 }],
    phases: {},
  });
  mkdirSync(join(R, 'verdicts'), { recursive: true });
  const caps = [
    capture({ id: 'D-1-devils-advocate-ag1', task: 'D-1', decision: 'D-1', verdict: 'b', objections: ['F-P1-1'], stamp: T1 }),
    capture({ id: 'D-2-devils-advocate-ag2', task: 'D-2', decision: 'D-2', verdict: 'b', objections: ['F-P1-1'], stamp: T2 }),
  ];
  writeFileSync(join(R, 'verdicts', 'index.jsonl'), caps.map((c) => JSON.stringify(c)).join('\n') + '\n');
  const r = check(R);
  assert.equal(r.status, 1, `D-2's F-P1-1 passed on D-1's record: ${r.out}`);
  assert.match(r.out, /D-2/);
});

test('fires: index line not backed by its capture file', () => {
  const R = fixture({ captures: [capture({ id: 'D-1-devils-advocate-ag9', file: 'D-1-devils-advocate-ag9.md', sha256: sha('verdict: b\n'), verdict: 'a' })] });
  writeFileSync(join(R, 'verdicts', 'D-1-devils-advocate-ag9.md'), 'verdict: b\n');
  const r = check(R);
  assert.equal(r.status, 1, `index verdict a counted while the capture file says b: ${r.out}`);
});

test('fires: a conflicted capture is not dropped by an edit of its target followed by a fresh devils-advocate capture', () => {
  const R = fixture({ captures: [capture({ conflicted: true, objections: ['F-P1-1'], targets: [old], stamp: T1 }), capture({ id: 'V-cap-2', targets: [live], stamp: '2026-01-01T10:30:00.000Z' })] });
  const r = check(R);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /V-cap-1:F-P1-1 of a conflicted capture/);
});

test('fires: a conflicted capture that lists no item fails the gate without a <capture id>:conflict record, passes after accept and does not count after reject', () => {
  const rec = (verdict) => ({ kind: 'object', id: 'V-cap-1:conflict', verdict, why: 'x', decider: 'owner', at: T2 });
  const conflicted = () => capture({ conflicted: true, text: captureText({ verdict: 'a', conflicted: true }) });
  const without = check(fixture({ captures: [conflicted()] }));
  assert.equal(without.status, 1, without.out);
  assert.match(without.out, /D-1: conflicted capture V-cap-1 .*V-cap-1:conflict/);
  const accepted = check(fixture({ captures: [conflicted()], ownerRecords: [rec('accept')] }));
  assert.equal(accepted.status, 0, accepted.out);
  const rejected = check(fixture({ captures: [conflicted()], ownerRecords: [rec('reject')] }));
  assert.equal(rejected.status, 1, rejected.out);
  assert.match(rejected.out, /D-1: the owner rejected .*another devils-advocate pass/);
  const other = capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z', verdict: 'b', objections: ['F-P1-1'] });
  const worse = check(fixture({ captures: [conflicted(), other], ownerRecords: [rec('reject')] }));
  assert.equal(worse.status, 1, worse.out);
  assert.match(worse.out, /V-cap-2:F-P1-1/);
  const wrongId = check(fixture({ captures: [conflicted()], ownerRecords: [{ ...rec('accept'), id: 'V-cap-2:conflict' }] }));
  assert.equal(wrongId.status, 1, wrongId.out);
});

test('fires: records on all items of a conflicted capture clear only its conflict block, and the capture then counts by its verdict', () => {
  const rec = (id, verdict) => ({ kind: 'object', id, verdict, why: 'x', decider: 'owner', at: T2 });
  const items = ['V-cap-1:F-P1-1', 'V-cap-1:premise-1'];
  const conflicted = (verdict) => capture({ conflicted: true, verdict, objections: ['F-P1-1'], premises: ['V-cap-1:premise-1'] });
  const all = (verdict) => items.map((id) => rec(id, verdict));
  const passA = check(fixture({ captures: [conflicted('a')], ownerRecords: all('accept') }));
  assert.equal(passA.status, 0, passA.out);
  const partialA = check(fixture({ captures: [conflicted('a')], ownerRecords: [rec(items[0], 'accept')] }));
  assert.equal(partialA.status, 1, partialA.out);
  assert.match(partialA.out, /V-cap-1:premise-1 of a conflicted capture has no run\.mjs object record/);
  const withoutObjectionB = check(fixture({ captures: [conflicted('b')], ownerRecords: [rec(items[1], 'accept')] }));
  assert.equal(withoutObjectionB.status, 1, withoutObjectionB.out);
  assert.match(withoutObjectionB.out, /objection V-cap-1:F-P1-1 has no run\.mjs object record|V-cap-1:F-P1-1 of a conflicted capture has no run\.mjs object record/);
  const passB = check(fixture({ captures: [conflicted('b')], ownerRecords: all('accept') }));
  assert.equal(passB.status, 0, passB.out);
  const acceptedC = check(fixture({ captures: [conflicted('c')], ownerRecords: all('accept') }));
  assert.equal(acceptedC.status, 1, acceptedC.out);
  assert.match(acceptedC.out, /objection V-cap-1:F-P1-1 of verdict c has no run\.mjs object reject record/);
  const rejectedC = check(fixture({ captures: [conflicted('c')], ownerRecords: all('reject') }));
  assert.equal(rejectedC.status, 0, rejectedC.out);
});

function supersededFixture({ ownerRecords = [], captures }) {
  const R = join(tempDir('cdp6-dc-'), 'RUN-20260101-x');
  initRun(R, {
    run_id: 'RUN-20260101-x',
    status: 'active',
    ids: { next: { D: 3 } },
    decisions: {
      'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'decided', at: T2, decider: 'owner' }] },
      'D-2': { status: 'superseded', decider: 'operator', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'superseded', at: T3, decider: 'operator' }] },
    },
    owner_records: ownerRecords,
    phases: {},
  });
  backCaptures(R, captures);
  return R;
}

test('auditor F2: a D-n with a live verdict c capture and no owner record does not leave the gate by being superseded', () => {
  const R = join(tempDir('cdp6-dc-'), 'RUN-20260101-x');
  initRun(R, {
    run_id: 'RUN-20260101-x',
    status: 'active',
    ids: { next: { D: 3 } },
    decisions: {
      'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'decided', at: T2, decider: 'owner' }] },
      'D-2': { status: 'superseded', decider: 'operator', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'superseded', at: T3, decider: 'operator' }] },
    },
    owner_records: [],
    phases: {},
  });
  backCaptures(R, [capture(), capture({ id: 'V-cap-2', task: 'D-2', decision: 'D-2', verdict: 'c', objections: ['F-P1-1'], stamp: T2 })]);
  const r = check(R);
  assert.equal(r.status, 1, r.out);
});

test('fires: a superseded D-n with a live block or conflicted capture needs the owner records, one with records or only passing captures does not, and a stale block needs them as well', () => {
  const block = capture({ id: 'V-cap-2', task: 'D-2', decision: 'D-2', verdict: 'b', objections: ['F-P1-1'], stamp: T2 });
  const missing = check(supersededFixture({ captures: [capture(), block] }));
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /D-2: objection V-cap-2:F-P1-1 has no run\.mjs object record/);
  assert.doesNotMatch(missing.out, /superseded/);
  const conflicted = check(supersededFixture({ captures: [capture(), capture({ id: 'V-cap-2', task: 'D-2', decision: 'D-2', verdict: 'a', conflicted: true, stamp: T2 })] }));
  assert.equal(conflicted.status, 1, conflicted.out);
  assert.match(conflicted.out, /D-2: conflicted capture V-cap-2 lists no objection or premise/);
  const recorded = check(supersededFixture({ captures: [capture(), block], ownerRecords: [{ kind: 'object', id: 'V-cap-2:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(recorded.status, 0, recorded.out);
  const stale = check(supersededFixture({ captures: [capture(), { ...block, targets: [old] }] }));
  assert.equal(stale.status, 1, stale.out);
  assert.match(stale.out, /D-2: objection V-cap-2:F-P1-1 has no run\.mjs object record/);
  const staleRecorded = check(supersededFixture({ captures: [capture(), { ...block, targets: [old] }], ownerRecords: [{ kind: 'object', id: 'V-cap-2:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(staleRecorded.status, 0, staleRecorded.out);
  const passing = check(supersededFixture({ captures: [capture(), capture({ id: 'V-cap-2', task: 'D-2', decision: 'D-2', verdict: 'a', stamp: T2 })] }));
  assert.equal(passing.status, 0, passing.out);
});

test('fires: the finding of a D-n still proposed does not suggest superseding it', () => {
  const r = check(fixture({ status: 'proposed' }));
  assert.equal(r.status, 1, r.out);
  assert.doesNotMatch(r.out, /superseded/);
});

test('auditor F3: a live block capture is not answered away by a later pass of a fresh devils-advocate on the same target hash', () => {
  const block = capture({ id: 'V-cap-1', verdict: 'b', objections: ['F-P1-1'], targets: [live], stamp: T1 });
  const reroll = capture({ id: 'V-cap-2', verdict: 'a', targets: [live], stamp: '2026-01-01T10:30:00.000Z' });
  const r = check(fixture({ captures: [block, reroll] }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /F-P1-1/);
});

test('fires: a live earlier block still needs its owner records after a later not-decidable or pass, records let the later pass count, a stale block needs them as well, and a not-decidable capture is answered by a later round', () => {
  const earlier = (over = {}) => capture({ id: 'V-cap-1', verdict: 'c', objections: ['F-P1-1'], stamp: T1, ...over });
  const later = (over = {}) => capture({ id: 'V-cap-2', verdict: 'a', stamp: '2026-01-01T10:30:00.000Z', ...over });
  const after = check(fixture({ captures: [earlier(), later({ verdict: 'not-decidable' })] }));
  assert.equal(after.status, 1, after.out);
  assert.match(after.out, /F-P1-1/);
  const rec = { kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'reject', why: 'x', decider: 'owner', at: T2 };
  const recorded = check(fixture({ captures: [earlier(), later()], ownerRecords: [rec] }));
  assert.equal(recorded.status, 0, recorded.out);
  const stale = check(fixture({ captures: [earlier({ targets: [old] }), later()] }));
  assert.equal(stale.status, 1, stale.out);
  assert.match(stale.out, /V-cap-1:F-P1-1/);
  const staleRecorded = check(fixture({ captures: [earlier({ targets: [old] }), later()], ownerRecords: [rec] }));
  assert.equal(staleRecorded.status, 0, staleRecorded.out);
  const undecidable = check(fixture({ captures: [earlier({ verdict: 'not-decidable', objections: [] }), later()] }));
  assert.equal(undecidable.status, 0, undecidable.out);
});

const T15 = '2026-01-01T10:30:00.000Z';
const T4 = '2026-01-01T13:00:00.000Z';

const rec = (id, verdict, at = T3) => ({ kind: 'object', id, verdict, why: 'x', decider: 'owner', at });

function rejectedCapture({ verdictLine = 'verdict: b', conflicted = false, ...over } = {}) {
  const base = captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'], conflicted });
  const text = base.replace('verdict: b\n', `${verdictLine}\nThe owner has to record F-P1-1 before the pick.\n`);
  return capture({ verdict: null, validator: 'rejected', objections: [], conflicted, text, ...over });
}

test('fires: gate decision table capture rows (a) a valid live latest (a) counts, a stale (a) and a not-decidable neither count nor block', () => {
  assert.equal(check(fixture({ captures: [capture()] })).status, 0);
  const staleA = check(fixture({ captures: [capture({ targets: [old] })] }));
  assert.equal(staleA.status, 1, staleA.out);
  assert.match(staleA.out, /every devils-advocate capture is stale/);
  const staleThenLive = check(fixture({ captures: [capture(), capture({ id: 'V-cap-2', targets: [old], stamp: T15 })] }));
  assert.equal(staleThenLive.status, 0, `a stale (a) later than the live one counts or blocks: ${staleThenLive.out}`);
  const staleNd = check(fixture({ captures: [capture(), capture({ id: 'V-cap-2', verdict: 'not-decidable', targets: [old], stamp: T15 })] }));
  assert.equal(staleNd.status, 0, `a stale not-decidable counts or blocks: ${staleNd.out}`);
  const nd = check(fixture({ captures: [capture({ verdict: 'not-decidable' }), capture({ id: 'V-cap-2', stamp: T15 })] }));
  assert.equal(nd.status, 0, `an earlier not-decidable blocks: ${nd.out}`);
  const latestNd = check(fixture({ captures: [capture(), capture({ id: 'V-cap-2', verdict: 'not-decidable', stamp: T15 })] }));
  assert.equal(latestNd.status, 1, latestNd.out);
  assert.match(latestNd.out, /not a pass/);
});

test('fires: gate decision table capture rows (b) and (c), live or stale, block until their records and count once cleared only when live and the latest', () => {
  for (const verdict of ['b', 'c']) {
    for (const [name, targets] of [['live', [live]], ['stale', [old]]]) {
      const block = capture({ verdict, objections: ['F-P1-1'], targets });
      const pass = capture({ id: 'V-cap-2', stamp: T15 });
      const open = check(fixture({ captures: [block, pass] }));
      assert.equal(open.status, 1, `${verdict} ${name}: ${open.out}`);
      assert.match(open.out, /V-cap-1:F-P1-1/, `${verdict} ${name}`);
      const cleared = check(fixture({ captures: [block, pass], ownerRecords: [rec('V-cap-1:F-P1-1', 'reject')] }));
      assert.equal(cleared.status, 0, `${verdict} ${name}: ${cleared.out}`);
    }
    const liveBlock = capture({ verdict, objections: ['F-P1-1'] });
    const alone = check(fixture({ captures: [liveBlock], ownerRecords: [rec('V-cap-1:F-P1-1', 'reject')] }));
    assert.equal(alone.status, 0, `${verdict}: a cleared live latest block counts: ${alone.out}`);
    const staleAlone = check(fixture({ captures: [{ ...liveBlock, targets: [old] }], ownerRecords: [rec('V-cap-1:F-P1-1', 'reject')] }));
    assert.equal(staleAlone.status, 1, `${verdict}: a cleared stale block does not count: ${staleAlone.out}`);
    assert.match(staleAlone.out, /every devils-advocate capture is stale/);
    const notLatest = check(fixture({ captures: [liveBlock, capture({ id: 'V-cap-2', verdict: 'not-decidable', stamp: T15 })], ownerRecords: [rec('V-cap-1:F-P1-1', 'reject')] }));
    assert.equal(notLatest.status, 1, `${verdict}: a cleared block that is not the latest counts: ${notLatest.out}`);
  }
  const cBlock = capture({ verdict: 'c', objections: ['F-P1-1'] });
  const accepted = check(fixture({ captures: [cBlock], ownerRecords: [rec('V-cap-1:F-P1-1', 'accept')] }));
  assert.equal(accepted.status, 1, `an accept record clears a (c): ${accepted.out}`);
  assert.match(accepted.out, /verdict c has no run\.mjs object reject record/);
  const bAccepted = check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], ownerRecords: [rec('V-cap-1:F-P1-1', 'accept')] }));
  assert.equal(bAccepted.status, 0, bAccepted.out);
});

test('fires: gate decision table capture rows (conflicted) a conflicted capture, valid or rejected, live or stale, blocks until its item records or :conflict, then follows its verdict row', () => {
  const rejectedConflicted = (over = {}) => rejectedCapture({ conflicted: true, ...over });
  const cases = [
    ['valid live', 'V-cap-1:conflict', (over) => capture({ conflicted: true, ...over })],
    ['valid stale', 'V-cap-1:conflict', (over) => capture({ conflicted: true, targets: [old], ...over })],
    ['rejected live', 'V-cap-1:F-P1-1', rejectedConflicted],
    ['rejected stale', 'V-cap-1:F-P1-1', (over) => rejectedConflicted({ targets: [old], ...over })],
  ];
  const pass = capture({ id: 'V-cap-2', stamp: T15 });
  for (const [name, clearing, make] of cases) {
    const c = make({});
    const open = check(fixture({ captures: [c, pass] }));
    assert.equal(open.status, 1, `${name}: ${open.out}`);
    assert.match(open.out, /D-1: (conflicted capture|objection) V-cap-1/, name);
    const cleared = check(fixture({ captures: [c, pass], ownerRecords: [rec(clearing, 'accept')] }));
    assert.equal(cleared.status, 0, `${name}: ${cleared.out}`);
  }
  const withItems = capture({ verdict: 'c', objections: ['F-P1-1'], conflicted: true });
  const items = ['V-cap-1:F-P1-1'];
  const unrecorded = check(fixture({ captures: [withItems, pass] }));
  assert.equal(unrecorded.status, 1, unrecorded.out);
  assert.match(unrecorded.out, /objection V-cap-1:F-P1-1 of a conflicted capture has no run\.mjs object record/);
  const acceptedC = check(fixture({ captures: [withItems, pass], ownerRecords: items.map((i) => rec(i, 'accept')) }));
  assert.equal(acceptedC.status, 1, `a conflicted (c) follows its verdict row: ${acceptedC.out}`);
  assert.match(acceptedC.out, /verdict c has no run\.mjs object reject record/);
  const rejectedC = check(fixture({ captures: [withItems, pass], ownerRecords: items.map((i) => rec(i, 'reject')) }));
  assert.equal(rejectedC.status, 0, rejectedC.out);
  const aloneCleared = check(fixture({ captures: [capture({ conflicted: true })], ownerRecords: [rec('V-cap-1:conflict', 'accept')] }));
  assert.equal(aloneCleared.status, 0, `a conflicted (a) counts after clearing: ${aloneCleared.out}`);
  const aloneStale = check(fixture({ captures: [capture({ conflicted: true, targets: [old] })], ownerRecords: [rec('V-cap-1:conflict', 'accept')] }));
  assert.equal(aloneStale.status, 1, `a conflicted stale (a) does not count: ${aloneStale.out}`);
  const rejectedItems = rejectedConflicted();
  const rejectedOpen = check(fixture({ captures: [rejectedItems, pass] }));
  assert.match(rejectedOpen.out, /V-cap-1:F-P1-1/, 'a rejected conflicted capture takes its items from its file');
});

test('fires: gate decision table capture rows (rejected) a rejected, not conflicted capture with a verdict (b) or (c) blocks until <capture id>:capture, other rejected captures and captures after the decided stamp neither count nor block', () => {
  const pass = capture({ id: 'V-cap-2', stamp: T15 });
  const forms = ['verdict: b', 'verdict: c', 'VERDICT: B', 'Verdict: c because it fails', 'verdict:b', '\uFF56erdict: \uFF42'];
  for (const verdictLine of forms) {
    for (const targets of [[live], [old]]) {
      const c = rejectedCapture({ verdictLine, targets });
      const open = check(fixture({ captures: [c, pass] }));
      assert.equal(open.status, 1, `${JSON.stringify(verdictLine)} ${targets[0] === old ? 'stale' : ''}: ${open.out}`);
      assert.match(open.out, /D-1: capture V-cap-1 is rejected by the validator and has a verdict b or c, no run\.mjs object V-cap-1:capture record/);
      for (const verdict of ['accept', 'reject']) {
        const cleared = check(fixture({ captures: [c, pass], ownerRecords: [rec('V-cap-1:capture', verdict)] }));
        assert.equal(cleared.status, 0, `${JSON.stringify(verdictLine)} ${verdict}: ${cleared.out}`);
      }
    }
  }
  const onlyRejected = check(fixture({ captures: [rejectedCapture()], ownerRecords: [rec('V-cap-1:capture', 'accept')] }));
  assert.equal(onlyRejected.status, 1, `a rejected capture never counts: ${onlyRejected.out}`);
  assert.match(onlyRejected.out, /rejected by the validator, the role has to be run again/);
  const noBc = check(fixture({ captures: [rejectedCapture({ verdictLine: 'verdict: a' }), pass] }));
  assert.equal(noBc.status, 0, `a rejected capture without a verdict (b) or (c) blocks: ${noBc.out}`);
  const bPrefix = check(fixture({ captures: [rejectedCapture({ verdictLine: 'verdict: b-ish' }), rejectedCapture({ id: 'V-cap-3', verdictLine: 'verdict: a-with-conditions' }), pass] }));
  assert.equal(bPrefix.status, 0, `the first word must be b or c: ${bPrefix.out}`);
  const after = (extra) => check(fixture({ captures: [capture(), ...extra] }));
  const lateBlock = after([capture({ id: 'V-cap-2', verdict: 'b', objections: ['F-P1-1'], stamp: T4 })]);
  assert.equal(lateBlock.status, 0, `a capture after the decided stamp blocks: ${lateBlock.out}`);
  const lateRejected = after([rejectedCapture({ id: 'V-cap-2', stamp: T4 })]);
  assert.equal(lateRejected.status, 0, `a rejected capture after the decided stamp blocks: ${lateRejected.out}`);
  const lateConflicted = after([capture({ id: 'V-cap-2', conflicted: true, stamp: T4 })]);
  assert.equal(lateConflicted.status, 0, `a conflicted capture after the decided stamp blocks: ${lateConflicted.out}`);
  const latePass = check(fixture({ captures: [capture({ verdict: 'not-decidable' }), capture({ id: 'V-cap-2', stamp: T4 })] }));
  assert.equal(latePass.status, 1, `a capture after the decided stamp counts: ${latePass.out}`);
});

function runWith({ decisions, nextD, captures = [], ownerRecords = [] }) {
  const R = join(tempDir('cdp6-dc-'), 'RUN-20260101-x');
  initRun(R, { run_id: 'RUN-20260101-x', status: 'active', ids: { next: { D: nextD } }, decisions, owner_records: ownerRecords, phases: {} });
  backCaptures(R, captures);
  return R;
}

const entry = (status, decidedAt = T2) => ({ status, decider: 'owner', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, ...(status === 'proposed' ? [] : [{ status, at: decidedAt, decider: 'owner' }])] });

test('fires: gate decision table status rows and D-n set (decided, superseded, proposed and any other status)', () => {
  const block = capture({ verdict: 'b', objections: ['F-P1-1'] });
  const decided = check(fixture({ captures: [block] }));
  assert.equal(decided.status, 1, decided.out);
  assert.match(decided.out, /D-1: objection V-cap-1:F-P1-1/);
  assert.equal(check(fixture({ captures: [capture()] })).status, 0);
  const superseded = check(fixture({ status: 'superseded' }));
  assert.equal(superseded.status, 0, `a superseded D-n needs no capture: ${superseded.out}`);
  const supersededBlock = check(fixture({ status: 'superseded', captures: [block] }));
  assert.equal(supersededBlock.status, 1, supersededBlock.out);
  const proposed = check(fixture({ status: 'proposed', captures: [capture()] }));
  assert.equal(proposed.status, 1, proposed.out);
  assert.match(proposed.out, /decision-check FAIL D-1: still proposed/);
  for (const status of ['vetoed', 'Decided', '']) {
    const other = check(fixture({ status, captures: [capture()] }));
    assert.equal(other.status, 1, `${JSON.stringify(status)}: ${other.out}`);
    assert.match(other.out, new RegExp(`decision-check FAIL D-1: status ${JSON.stringify(status).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')} is not proposed, decided or superseded`));
  }
  const none = check(runWith({ decisions: { 'D-1': { decider: 'owner', stamps: [] } }, nextD: 2 }));
  assert.equal(none.status, 1, none.out);
  assert.match(none.out, /decision-check FAIL D-1: status none is not proposed, decided or superseded/);
});

test('fires: gate decision table status rows and D-n set (an allocated D-n below ids.next.D without a run.json entry fails, naming it)', () => {
  const captures = [capture()];
  const covered = check(runWith({ decisions: { 'D-1': entry('decided') }, nextD: 2, captures }));
  assert.equal(covered.status, 0, covered.out);
  const missing = check(runWith({ decisions: { 'D-1': entry('decided') }, nextD: 4, captures }));
  assert.equal(missing.status, 1, missing.out);
  assert.match(missing.out, /decision-check FAIL D-2: allocated below ids\.next\.D \(4\) without an entry in run\.json/);
  assert.match(missing.out, /decision-check FAIL D-3: allocated below ids\.next\.D \(4\) without an entry in run\.json/);
  assert.doesNotMatch(missing.out, /D-4/);
  const beyond = check(runWith({ decisions: { 'D-1': entry('decided'), 'D-7': entry('superseded') }, nextD: 2, captures }));
  assert.equal(beyond.status, 0, `an entry at or above ids.next.D is still read: ${beyond.out}`);
  const beyondOpen = check(runWith({ decisions: { 'D-1': entry('decided'), 'D-7': entry('proposed') }, nextD: 2, captures }));
  assert.equal(beyondOpen.status, 1, beyondOpen.out);
  assert.match(beyondOpen.out, /D-7: still proposed/);
  const none = check(runWith({ decisions: {}, nextD: 1 }));
  assert.equal(none.status, 0, none.out);
});

test('fires: gate decision table status rows and D-n set (an index line whose .md does not re-read fails the gate)', () => {
  const dir = (R) => join(R, 'verdicts');
  const missing = fixture({ captures: [capture(), capture({ id: 'V-cap-2', stamp: T15 })] });
  rmSync(join(dir(missing), 'V-cap-2.md'));
  const gone = check(missing);
  assert.equal(gone.status, 1, gone.out);
  assert.match(gone.out, /V-cap-2: the capture file V-cap-2\.md is missing/);
  const changed = fixture({ captures: [capture(), capture({ id: 'V-cap-2', stamp: T15 })] });
  writeFileSync(join(dir(changed), 'V-cap-2.md'), `${captureText({ task: 'D-1', verdict: 'a' })}edited\n`);
  const edited = check(changed);
  assert.equal(edited.status, 1, edited.out);
  assert.match(edited.out, /V-cap-2: the capture file V-cap-2\.md differs from the sha256 of its index line/);
  const unlisted = fixture({ captures: [capture()] });
  writeFileSync(join(dir(unlisted), 'V-cap-9.md'), 'verdict: a\n');
  const extra = check(unlisted);
  assert.equal(extra.status, 1, extra.out);
  assert.match(extra.out, /V-cap-9\.md: capture file without an index line/);
  const renamed = fixture({ captures: [capture(), { ...capture({ id: 'V-cap-2', stamp: T15 }), file: 'V-cap-1.md', sha256: sha(captureText(capture())) }] });
  const wrongName = check(renamed);
  assert.equal(wrongName.status, 1, wrongName.out);
  assert.match(wrongName.out, /V-cap-2: the index id is not the capture file name V-cap-1/);
  assert.equal(check(fixture({ captures: [capture(), capture({ id: 'V-cap-2', stamp: T15 })] })).status, 0);
});

test('review fix-4: a stale conflicted capture on a superseded D-n still needs its owner record, as on a decided one', () => {
  const stale = capture({ id: 'V-cap-2', task: 'D-2', decision: 'D-2', verdict: 'a', conflicted: true, targets: [old], stamp: T2 });
  const r = check(supersededFixture({ captures: [capture(), stale] }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /D-2: conflicted capture V-cap-2/);
  const cleared = check(supersededFixture({ captures: [capture(), stale], ownerRecords: [{ kind: 'object', id: 'V-cap-2:conflict', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(cleared.status, 0, cleared.out);
});

test('auditor fix4 A1: a live block capture is not answered away by a one-byte edit of its target followed by a fresh devils-advocate pass', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const block = capture({ id: 'D-1-devils-advocate-ag1', task: 'D-1', verdict: 'b', objections: ['F-P1-1'], targets: [{ path: 'idea/idea.md', sha256: sha('current \n') }], stamp: T1 });
  const pass = capture({ id: 'D-1-devils-advocate-ag2', task: 'D-1', verdict: 'a', targets: [live], stamp: '2026-01-01T10:30:00.000Z' });
  const sameHash = check(fixture({ captures: [{ ...block, targets: [live] }, pass] }), snap);
  assert.equal(sameHash.status, 1, sameHash.out);
  const edited = check(fixture({ captures: [block, pass] }), snap);
  assert.equal(edited.status, 1, `a one-byte edit answered the block away: ${edited.out}`);
  assert.match(edited.out, /D-1-devils-advocate-ag1:F-P1-1/);
});

test('auditor fix4 A2: a block verdict whose capture the validator rejected for a stray objection id is not answered away by a later pass', () => {
  const blockText = captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'] }).replace('verdict: b\n', 'verdict: b\nThe owner has to record F-P1-1 before the pick.\n');
  const rejected = capture({ id: 'D-1-devils-advocate-ag1', task: 'D-1', verdict: null, validator: 'rejected', objections: [], text: blockText, stamp: T1 });
  const pass = capture({ id: 'D-1-devils-advocate-ag2', task: 'D-1', verdict: 'a', stamp: '2026-01-01T10:30:00.000Z' });
  const r = check(fixture({ captures: [rejected, pass] }));
  assert.equal(r.status, 1, `a validator-rejected block verdict was answered away by a later pass: ${r.out}`);
});

test('auditor fix4 A6: a D-n with a status outside proposed, decided and superseded fails the gate instead of passing silently', () => {
  const r = check(fixture({ captures: [capture({ verdict: 'b', objections: ['F-P1-1'] })], status: 'vetoed' }));
  assert.equal(r.status, 1, r.out);
});

test('rv56 F1: a rejected conflicted capture does not leave the gate on the record of its first objection while a second objection id stands in its prose or in the tail of its objection line', () => {
  const base = captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'], conflicted: true });
  const variants = [
    ['prose', `${base}F-P1-2 is the larger defect.\n`],
    ['tail', base.replace('refuted when: shown', 'refuted when: shown | objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:2 | refuted when: shown')],
  ];
  for (const [name, text] of variants) {
    const rejected = capture({ verdict: null, validator: 'rejected', objections: ['F-P1-1'], conflicted: true, text });
    const pass = capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z' });
    const r = check(fixture({ captures: [rejected, pass], ownerRecords: [{ kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
    assert.equal(r.status, 1, `${name}: F-P1-2 left the gate without an owner record: ${r.out}`);
  }
});

test('rv56 F4: a later record on the same item does not change the first one, so accept then reject leaves a (c) objection uncleared', () => {
  const at = '2026-01-01T12:00:00.000Z';
  const r = check(fixture({ captures: [capture({ verdict: 'c', objections: ['F-P1-1'] })], ownerRecords: [{ kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at }, { kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'reject', why: 'y', decider: 'owner', at }] }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /V-cap-1:F-P1-1 of verdict c has no run\.mjs object reject record/);
});

test('rv56 F5: a run.json whose ids.next.D is not an integer does not pass the gate with the D-n set skipped', () => {
  const r = check(runWith({ decisions: { 'D-1': entry('decided') }, nextD: '4', captures: [capture()] }));
  assert.notEqual(r.status, 0, r.out);
});

test('fires: an ids.next.D that is not a positive integer fails the gate with a finding naming its value', () => {
  for (const [value, shown] of [['4', '"4"'], [0, '0'], [-1, '-1'], [1.5, '1.5']]) {
    const r = check(runWith({ decisions: { 'D-1': entry('decided') }, nextD: value, captures: [capture()] }));
    assert.equal(r.status, 1, shown);
    assert.ok(r.out.includes(`ids.next.D is not a positive integer: ${shown}`), `${shown}: ${r.out}`);
  }
  assert.equal(check(runWith({ decisions: { 'D-1': entry('decided') }, nextD: 2, captures: [capture()] })).status, 0);
  assert.equal(check(runWith({ decisions: {}, nextD: null, captures: [] })).status, 0);
});

test('rv58 R1: a rejected conflicted capture does not leave the gate on the record of its first objection while a second objection id stands on a disposition: line outside the disposition form', () => {
  const base = captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'], conflicted: true });
  const text = `${base}disposition: F-P1-2 is the larger defect and stays open\n`;
  const rejected = capture({ verdict: null, validator: 'rejected', objections: ['F-P1-1'], conflicted: true, text });
  const pass = capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z' });
  const r = check(fixture({ captures: [rejected, pass], ownerRecords: [{ kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(r.status, 1, `F-P1-2 left the gate without an owner record: ${r.out}`);
  assert.match(r.out, /V-cap-1:F-P1-2 of a conflicted capture has no run\.mjs object record/);
});

test('rv58 R3: a run that has allocated no D-n, with ids.next holding no D as run.mjs init writes it, passes the D-n set', () => {
  const r = check(runWith({ decisions: {}, nextD: undefined, captures: [] }));
  assert.equal(r.status, 0, r.out);
});
