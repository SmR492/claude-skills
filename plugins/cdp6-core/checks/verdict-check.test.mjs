import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initRun } from '../lib/run-store.mjs';
import { backCaptures } from '../lib/capture-fixture.mjs';
import { dirname, join } from 'node:path';
import { isStale, rereadCaptures, validateCapture } from './verdict-check.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const VERDICT_CHECK = join(dirname(fileURLToPath(import.meta.url)), 'verdict-check.mjs');
const DECISION_CHECK = join(dirname(fileURLToPath(import.meta.url)), 'decision-check.mjs');
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');

function snapshotWith(files) {
  const dir = tempDir('cdp6-vc-snap-');
  for (const [path, content] of Object.entries(files)) {
    mkdirSync(dirname(join(dir, path)), { recursive: true });
    writeFileSync(join(dir, path), content);
  }
  return dir;
}

const TYPE = 'cdp6-core:devils-advocate';
const SCALE = 'severity scale: 🔴 blocks the task, 🟡 defect with a workaround, 🟢 polish';
const MAPPING = 'verdict mapping: a = pass, a-with-conditions = pass-with-conditions, b = block, c = block, not-decidable = no pass';
const OBJECTION = 'objection: F-P1-1 | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: the section is shown';

function text(over = {}) {
  const lines = {
    ack: 'cdp6-contract: v1 abc',
    run: 'run: RUN-1 task: D-1',
    fresh: 'fresh context: yes',
    rejected: 'rejected alternative provided: yes',
    conflict: 'conflict of interest: none',
    scale: SCALE,
    mapping: MAPPING,
    premises: 'premises: none, no existing code or data touched',
    objections: OBJECTION,
    verdict: 'verdict: a',
    ...over,
  };
  return `${Object.values(lines).filter((l) => l !== null).join('\n')}\n`;
}

function validate(over = {}, options = {}) {
  return validateCapture(typeof over === 'string' ? over : text(over), { agentType: TYPE, captureId: 'D-1-devils-advocate-agent-7', ...options });
}

test('a complete devils-advocate output is valid and yields verdict, objections, premises and conflicted', () => {
  const r = validate();
  assert.deepEqual(r, { validator: 'valid', reasons: [], verdict: 'a', objections: ['F-P1-1'], premises: [], conflicted: false });
});

test('fires: untraceable block', () => {
  const noArtefact = 'objection: F-P1-1 | evidence: idea/idea.md:12 | refuted when: shown';
  for (const verdict of ['b', 'c']) {
    const r = validate({ objections: noArtefact, verdict: `verdict: ${verdict}` });
    assert.equal(r.validator, 'rejected', verdict);
    assert.equal(r.verdict, null, verdict);
    assert.ok(r.reasons.some((x) => /F-P1-1.*artefact/.test(x)), r.reasons.join('; '));
    const blank = validate({ objections: 'objection: F-P1-1 | artefact:  | evidence: idea/idea.md:12', verdict: `verdict: ${verdict}` });
    assert.equal(blank.validator, 'rejected', verdict);
  }
  assert.equal(validate({ objections: OBJECTION, verdict: 'verdict: b' }).verdict, 'b');
  assert.equal(validate({ objections: noArtefact, verdict: 'verdict: a' }).validator, 'rejected');
});

test('fires: a block verdict needs at least one objection, each with an artefact and an evidence of the form file:line or command', () => {
  for (const verdict of ['b', 'c']) {
    const none = validate({ objections: null, verdict: `verdict: ${verdict}` });
    assert.equal(none.validator, 'rejected', verdict);
    assert.equal(none.verdict, null, verdict);
    assert.ok(none.reasons.some((x) => /verdict .* needs at least one objection/.test(x)), none.reasons.join('; '));
    for (const evidence of [null, 'evidence:', 'evidence: it is obvious', 'evidence: idea/idea.md', 'evidence: command:']) {
      const objection = ['objection: F-P1-1', 'artefact: idea/idea.md', evidence, 'refuted when: shown'].filter((x) => x !== null).join(' | ');
      const r = validate({ objections: objection, verdict: `verdict: ${verdict}` });
      assert.equal(r.validator, 'rejected', `${verdict} ${evidence}`);
      assert.ok(r.reasons.some((x) => /F-P1-1.*evidence/.test(x)), r.reasons.join('; '));
    }
    for (const evidence of ['evidence: idea/idea.md:12', 'evidence: idea/idea.md:12-14', 'evidence: command: grep -n x idea/idea.md']) {
      const r = validate({ objections: `objection: F-P1-1 | artefact: idea/idea.md | ${evidence} | refuted when: shown`, verdict: `verdict: ${verdict}` });
      assert.equal(r.validator, 'valid', `${verdict} ${evidence}: ${r.reasons.join('; ')}`);
    }
  }
  assert.equal(validate({ objections: null, verdict: 'verdict: a' }).validator, 'valid');
  assert.equal(validate({ objections: null, verdict: 'verdict: not-decidable' }).validator, 'valid');
});

test('psy-grenzwaechter is not a CDP6 role, so its capture is not checked', () => {
  const r = validateCapture(text(), { agentType: 'cdp6-core:psy-grenzwaechter', captureId: 'x-1' });
  assert.equal(r.validator, 'not-checked');
});

test('fires: missing premises', () => {
  const r = validate({ premises: null });
  assert.equal(r.validator, 'rejected');
  assert.equal(r.verdict, null);
  assert.ok(r.reasons.some((x) => /premises/.test(x)), r.reasons.join('; '));
  assert.equal(validate({ premises: 'premises: none, no existing code or data touched' }).validator, 'valid');
});

test('fires: missing conflict line', () => {
  for (const conflict of [null, 'conflict of interest:', 'conflict of interest:   ']) {
    const r = validate({ conflict });
    assert.equal(r.validator, 'rejected', String(conflict));
    assert.equal(r.verdict, null);
    assert.ok(r.reasons.some((x) => /conflict of interest/.test(x)), r.reasons.join('; '));
  }
  const other = validateCapture(text({ conflict: null }), { agentType: 'cdp6-core:review-verify', captureId: 'S-1-review-verify-agent-2' });
  assert.equal(other.validator, 'rejected');
  assert.ok(other.reasons.some((x) => /conflict of interest/.test(x)));
});

test('fires: pass without fresh context', () => {
  const noFresh = validate({ fresh: 'fresh context: no' });
  assert.equal(noFresh.validator, 'rejected');
  assert.equal(noFresh.verdict, null);
  assert.ok(noFresh.reasons.some((x) => /fresh context/.test(x)), noFresh.reasons.join('; '));
  const noAlternative = validate({ rejected: 'rejected alternative provided: no' });
  assert.equal(noAlternative.validator, 'rejected');
  assert.equal(noAlternative.verdict, null);
  assert.ok(noAlternative.reasons.some((x) => /rejected alternative/.test(x)), noAlternative.reasons.join('; '));
  for (const verdict of ['a-with-conditions', 'b', 'c', 'not-decidable']) {
    assert.equal(validate({ fresh: 'fresh context: no', verdict: `verdict: ${verdict}` }).verdict, null, verdict);
  }
  assert.equal(validate({ fresh: null }).validator, 'rejected');
  assert.equal(validate({ rejected: null }).validator, 'rejected');
});

test('fires: unmapped verdict', () => {
  for (const [name, over] of [['scale', { scale: null }], ['mapping', { mapping: null }], ['both', { scale: null, mapping: null }], ['blank scale', { scale: 'severity scale:' }], ['scale without all marks', { scale: 'severity scale: 🔴 blocks' }], ['mapping without a class', { mapping: 'verdict mapping: a = pass, b = block' }], ['mapping with an unknown target', { mapping: 'verdict mapping: a = pass, a-with-conditions = pass-with-conditions, b = block, c = block, not-decidable = maybe' }]]) {
    const r = validate(over);
    assert.equal(r.validator, 'rejected', name);
    assert.equal(r.verdict, null, name);
    assert.ok(r.reasons.some((x) => /severity scale|verdict mapping/.test(x)), `${name}: ${r.reasons.join('; ')}`);
  }
  const counter = validateCapture(text({ scale: null }), { agentType: 'cdp6-core:pessimistic-realist', captureId: 'S-1-pessimistic-realist-agent-2' });
  assert.equal(counter.validator, 'rejected');
  assert.ok(counter.reasons.some((x) => /severity scale/.test(x)));
});

test('fires: stale target', () => {
  const dir = snapshotWith({ 'idea/idea.md': 'current text\n' });
  const target = (path, hash) => ({ targets: [{ path, sha256: hash }] });
  assert.equal(isStale(target('idea/idea.md', sha('current text\n')), dir), false);
  assert.equal(isStale(target('idea/idea.md', sha('older text\n')), dir), true);
  assert.equal(isStale(target('idea/missing.md', sha('current text\n')), dir), true);
  assert.equal(isStale({ targets: [{ path: 'idea/idea.md', sha256: sha('current text\n') }, { path: 'idea/other.md', sha256: sha('x') }] }, dir), true);
  for (const path of ['../escape.md', '/etc/hostname', 'idea/../../x']) assert.equal(isStale(target(path, sha('x')), dir), true, path);
  assert.equal(isStale({ targets: [] }, dir), true);
  assert.equal(isStale({}, dir), true);
});

test('input class: an empty capture or one without any header line is rejected with reasons and verdict null', () => {
  for (const [name, input] of [['empty', ''], ['whitespace', '  \n\n'], ['prose only', 'cdp6-contract: v1 abc\nrun: RUN-1 task: D-1\nThe choice looks fine to me.\n'], ['undefined', undefined]]) {
    const r = validateCapture(input, { agentType: TYPE, captureId: 'D-1-devils-advocate-agent-7' });
    assert.equal(r.validator, 'rejected', name);
    assert.equal(r.verdict, null, name);
    assert.deepEqual(r.objections, [], name);
    assert.deepEqual(r.premises, [], name);
    assert.ok(r.reasons.length >= 1, name);
  }
  const empty = validate('');
  assert.ok(empty.reasons.some((x) => /empty/.test(x)), empty.reasons.join('; '));
  const prose = validate('The choice looks fine to me.\n');
  for (const needle of [/fresh context/, /rejected alternative/, /conflict of interest/, /severity scale/, /verdict mapping/, /verdict line/, /premises/]) {
    assert.ok(prose.reasons.some((x) => needle.test(x)), `${needle}: ${prose.reasons.join('; ')}`);
  }
});

test('input class: a header line twice with different values is rejected, twice with the same value is read once', () => {
  const twice = (key, a, b) => {
    const base = text().split('\n');
    const at = base.findIndex((l) => l.startsWith(`${key}:`));
    base.splice(at + 1, 0, b);
    base[at] = a;
    return base.join('\n');
  };
  for (const [key, a, b] of [['fresh context', 'fresh context: yes', 'fresh context: no'], ['rejected alternative provided', 'rejected alternative provided: yes', 'rejected alternative provided: no'], ['conflict of interest', 'conflict of interest: none', 'conflict of interest: author of D-2'], ['severity scale', SCALE, 'severity scale: 🔴 x, 🟡 y, 🟢 z'], ['verdict mapping', MAPPING, 'verdict mapping: a = block, b = pass'], ['verdict', 'verdict: a', 'verdict: b']]) {
    const r = validate(twice(key, a, b));
    assert.equal(r.validator, 'rejected', key);
    assert.equal(r.verdict, null, key);
    assert.ok(r.reasons.some((x) => x.includes(key) && /twice|repeat/.test(x)), `${key}: ${r.reasons.join('; ')}`);
    assert.equal(validate(twice(key, a, a)).validator, key === 'verdict' ? 'rejected' : 'valid', `${key} same value`);
  }
});

test('input class: a verdict line missing or a class outside the five is rejected, each of the five is read', () => {
  const missing = validate({ verdict: null });
  assert.equal(missing.validator, 'rejected');
  assert.equal(missing.verdict, null);
  assert.ok(missing.reasons.some((x) => /verdict line is missing/.test(x)), missing.reasons.join('; '));
  for (const bad of ['verdict: maybe', 'verdict: A', 'verdict: d', 'verdict: a b', 'verdict: a, b', 'verdict:', 'verdict: pass']) {
    const r = validate({ verdict: bad });
    assert.equal(r.validator, 'rejected', bad);
    assert.equal(r.verdict, null, bad);
    assert.ok(r.reasons.some((x) => /verdict class/.test(x)), `${bad}: ${r.reasons.join('; ')}`);
  }
  for (const ok of ['a', 'a-with-conditions', 'b', 'c', 'not-decidable']) {
    const r = validate({ verdict: `verdict: ${ok}` });
    assert.equal(r.validator, 'valid', ok);
    assert.equal(r.verdict, ok);
  }
});

test('input class: an objection id not of the form F-P<k>-<n>, or the same id twice, is rejected', () => {
  const line = (id) => `objection: ${id} | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: shown`;
  for (const id of ['F-P1', 'F-P9-1', 'F-P0-1', 'f-p1-1', 'F-P1-x', 'F-P1-1x', 'X-1', 'P1-1', 'F-P1-']) {
    const r = validate({ objections: line(id) });
    assert.equal(r.validator, 'rejected', id);
    assert.equal(r.verdict, null, id);
    assert.ok(r.reasons.some((x) => x.includes('objection id') && x.includes(id)), `${id}: ${r.reasons.join('; ')}`);
  }
  const twice = validate({ objections: `${line('F-P1-1')}\n${line('F-P1-1')}` });
  assert.equal(twice.validator, 'rejected');
  assert.ok(twice.reasons.some((x) => /F-P1-1.*twice|twice.*F-P1-1/.test(x)), twice.reasons.join('; '));
  const two = validate({ objections: `${line('F-P1-1')}\n${line('F-P3-12')}` });
  assert.equal(two.validator, 'valid');
  assert.deepEqual(two.objections, ['F-P1-1', 'F-P3-12']);
  assert.equal(validate({ objections: null }).validator, 'valid');
  assert.deepEqual(validate({ objections: null }).objections, []);
});

test('input class: a premises section whose line is neither checked with a file:line or command nor unchecked is rejected', () => {
  const ID = 'D-1-devils-advocate-agent-7';
  const section = (...rows) => ['premises:', ...rows].join('\n');
  const good = validate({ premises: section('- run.mjs init writes counters.json -- checked: scripts/run.mjs:290', '- the index is append only -- checked: command: grep -n appendFileSync lib/capture.mjs', '- nobody else writes verdicts/ -- unchecked') });
  assert.equal(good.validator, 'valid', good.reasons.join('; '));
  assert.deepEqual(good.premises, [`${ID}:premise-1`, `${ID}:premise-2`, `${ID}:premise-3`]);
  for (const [name, premises] of [
    ['no rows', 'premises:'],
    ['free prose', 'premises: the code is fine'],
    ['none without the reason', 'premises: none'],
    ['row without status', section('- the index is append only')],
    ['checked without evidence', section('- the index is append only -- checked')],
    ['checked with prose', section('- the index is append only -- checked: looked fine')],
    ['checked with a bare line number', section('- the index is append only -- checked: 290')],
    ['unchecked with trailing text', section('- the index is append only -- unchecked: later')],
    ['one bad row among good ones', section('- a -- unchecked', '- b -- checked: x.mjs:1', '- c -- maybe')],
    ['row not a list item', section('the index is append only -- unchecked')],
  ]) {
    const r = validate({ premises });
    assert.equal(r.validator, 'rejected', name);
    assert.equal(r.verdict, null, name);
    assert.deepEqual(r.premises, [], name);
    assert.ok(r.reasons.some((x) => /premise/.test(x)), `${name}: ${r.reasons.join('; ')}`);
  }
  assert.deepEqual(validate({ premises: 'premises: none, no existing code or data touched' }).premises, []);
});

test('input class: an unchecked premise with verdict a or a-with-conditions is recorded as not-decidable', () => {
  const rows = (...r) => ['premises:', ...r].join('\n');
  const unchecked = rows('- a -- checked: x.mjs:1', '- b -- unchecked');
  for (const verdict of ['a', 'a-with-conditions']) {
    const r = validate({ premises: unchecked, verdict: `verdict: ${verdict}` });
    assert.equal(r.validator, 'valid', verdict);
    assert.equal(r.verdict, 'not-decidable', verdict);
    assert.equal(r.premises.length, 2);
    assert.deepEqual(r.objections, ['F-P1-1']);
    assert.ok(r.reasons.some((x) => /unchecked/.test(x) && /not-decidable/.test(x)), r.reasons.join('; '));
  }
  for (const verdict of ['b', 'c', 'not-decidable']) {
    const r = validate({ premises: unchecked, verdict: `verdict: ${verdict}` });
    assert.equal(r.verdict, verdict, verdict);
    assert.deepEqual(r.reasons, [], verdict);
  }
  const allChecked = validate({ premises: rows('- a -- checked: x.mjs:1', '- b -- checked: command: node --test'), verdict: 'verdict: a' });
  assert.equal(allChecked.verdict, 'a');
  assert.deepEqual(allChecked.reasons, []);
});

test('fires: declared stake counted as pass', () => {
  const r = validate({ conflict: 'conflict of interest: author of D-2' });
  assert.equal(r.validator, 'valid', r.reasons.join('; '));
  assert.equal(r.conflicted, true);
  assert.equal(r.verdict, 'a');
  for (const stake of ['author of D-2', 'none, but I wrote the role text', 'None', 'n/a', 'no']) {
    assert.equal(validate({ conflict: `conflict of interest: ${stake}` }).conflicted, true, stake);
  }
  for (const verdict of ['a-with-conditions', 'b', 'c', 'not-decidable']) {
    assert.equal(validate({ conflict: 'conflict of interest: took part in D-2', verdict: `verdict: ${verdict}` }).conflicted, true, verdict);
  }
  assert.equal(validate({ conflict: 'conflict of interest: none' }).conflicted, false);
  assert.equal(validate({ conflict: 'conflict of interest:  none  ' }).conflicted, false);
});

const T1 = '2026-01-01T10:00:00.000Z';
const T15 = '2026-01-01T10:30:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';

function decided({ captures, records = [] }) {
  const R = join(tempDir('cdp6-vc-run-'), 'RUN-20260101-x');
  initRun(R, {
    run_id: 'RUN-20260101-x',
    status: 'active',
    ids: { next: { D: 2 } },
    decisions: { 'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'decided', at: T2, decider: 'owner' }] } },
    owner_records: records.map((id) => ({ kind: 'object', id, verdict: 'accept', why: 'x', decider: 'owner', at: T2 })),
    phases: {},
  });
  backCaptures(R, captures);
  return R;
}

function gate(R) {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const r = spawnSync(process.execPath, [DECISION_CHECK, '--run-dir', R, '--snapshot', snap], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

const LIVE = { path: 'idea/idea.md', sha256: sha('current\n') };
const CONFLICTED = { id: 'D-1-devils-advocate-agent-7', agent_type: TYPE, decision: 'D-1', verdict: 'a', objections: ['F-P1-1', 'F-P1-2'], premises: ['D-1-devils-advocate-agent-7:premise-1'], conflicted: true, validator: 'valid', stamp: T1, targets: [LIVE] };
const FRESH = { id: 'D-1-devils-advocate-agent-8', agent_type: TYPE, decision: 'D-1', verdict: 'a', objections: [], premises: [], conflicted: false, validator: 'valid', stamp: T15, targets: [LIVE] };

test('fires: fresh same-role instance clears', () => {
  const alone = gate(decided({ captures: [CONFLICTED] }));
  assert.equal(alone.status, 1, alone.out);
  const withFresh = gate(decided({ captures: [CONFLICTED, FRESH] }));
  assert.equal(withFresh.status, 1, withFresh.out);
  for (const item of ['F-P1-1', 'F-P1-2', 'D-1-devils-advocate-agent-7:premise-1']) assert.ok(withFresh.out.includes(item), `${item}: ${withFresh.out}`);
  assert.equal(gate(decided({ captures: [FRESH] })).status, 0);
});

test('clears on object records per item', () => {
  const all = ['D-1-devils-advocate-agent-7:F-P1-1', 'D-1-devils-advocate-agent-7:F-P1-2', 'D-1-devils-advocate-agent-7:premise-1'];
  const cleared = gate(decided({ captures: [CONFLICTED], records: all }));
  assert.equal(cleared.status, 0, cleared.out);
  const clearedWithFresh = gate(decided({ captures: [CONFLICTED, FRESH], records: all }));
  assert.equal(clearedWithFresh.status, 0, clearedWithFresh.out);
  for (const missing of all) {
    const partial = gate(decided({ captures: [CONFLICTED, FRESH], records: all.filter((x) => x !== missing) }));
    assert.equal(partial.status, 1, `${missing}: ${partial.out}`);
    assert.ok(partial.out.includes(missing), partial.out);
  }
  const noItems = gate(decided({ captures: [{ ...CONFLICTED, objections: [], premises: [] }], records: all }));
  assert.equal(noItems.status, 1, noItems.out);
});

test('review roles get the conflict of interest check only and no verdict, objections or premises', () => {
  const as = (type, over = {}) => validateCapture(text(over), { agentType: type, captureId: 'S-1-x-agent-2' });
  for (const type of ['cdp6-core:review-verify', 'cdp6-core:review-code', 'cdp6-core:konzept-reviewer']) {
    const r = as(type);
    assert.equal(r.validator, 'valid', type);
    assert.equal(r.verdict, null, type);
    assert.deepEqual(r.objections, [], type);
    assert.deepEqual(r.premises, [], type);
    const bare = validateCapture('conflict of interest: none\n- Objection to the plan -- unchecked\nverdict: a\nverdict: b\n', { agentType: type, captureId: 'S-1-x-agent-2' });
    assert.equal(bare.validator, 'valid', `${type}: ${bare.reasons.join('; ')}`);
  }
  for (const type of ['cdp6-core:impl-uc', 'cdp6-core:', 'cdp5-agents:devils-advocate', undefined]) {
    assert.deepEqual(as(type), { validator: 'not-checked', reasons: [], verdict: null, objections: [], premises: [], conflicted: false }, String(type));
  }
  const stake = as('cdp6-core:review-verify', { conflict: 'conflict of interest: wrote the role text' });
  assert.equal(stake.conflicted, true);
});

const OTHER_COUNTERS = ['cdp6-core:pessimistic-realist', 'cdp6-core:adversarial-auditor', 'cdp6-core:threat-modeler'];

test('fires: the capture form of §5.3 holds for every counter-role, and rejected alternative provided stays devils-advocate only', () => {
  for (const type of OTHER_COUNTERS) {
    const as = (over) => validateCapture(text({ rejected: null, ...over }), { agentType: type, captureId: 'S-1-x-agent-2' });
    const ok = as({});
    assert.equal(ok.validator, 'valid', `${type}: ${ok.reasons.join('; ')}`);
    assert.deepEqual([ok.verdict, ok.objections], ['a', ['F-P1-1']], type);
    assert.equal(as({ rejected: 'rejected alternative provided: no' }).validator, 'valid', type);
    assert.equal(as({ fresh: 'fresh context: no' }).validator, 'rejected', type);
    for (const [name, over, needle] of [
      ['no verdict line', { verdict: null }, /verdict line is missing/],
      ['verdict outside the classes', { verdict: 'verdict: maybe' }, /verdict class/],
      ['no premises section', { premises: null }, /premises section is missing/],
      ['b without objection', { objections: null, verdict: 'verdict: b' }, /needs at least one objection/],
      ['c without artefact', { objections: 'objection: F-P1-1 | evidence: idea/idea.md:12 | refuted when: shown', verdict: 'verdict: c' }, /cites no artefact/],
      ['b without evidence', { objections: 'objection: F-P1-1 | artefact: idea/idea.md | refuted when: shown', verdict: 'verdict: b' }, /cites no evidence/],
      ['no mapping line', { mapping: null }, /verdict mapping line is missing/],
      ['no conflict line', { conflict: null }, /conflict of interest line is missing/],
    ]) {
      const r = as(over);
      assert.equal(r.validator, 'rejected', `${type}: ${name}`);
      assert.equal(r.verdict, null, `${type}: ${name}`);
      assert.ok(r.reasons.some((x) => needle.test(x)), `${type}: ${name}: ${r.reasons.join('; ')}`);
    }
    const unchecked = as({ premises: 'premises:\n- a -- checked: x.mjs:1\n- b -- unchecked' });
    assert.equal(unchecked.verdict, 'not-decidable', type);
    assert.equal(unchecked.premises.length, 2, type);
  }
});

test('fires: a list-marked, indented, differently cased or unspaced spelling of an objection line is prose with an objection id and rejects, as do a premise row outside the premises section and a second verdict line', () => {
  const rejects = (over, needle, name) => {
    for (const type of [TYPE, ...OTHER_COUNTERS]) {
      const r = validateCapture(text({ rejected: 'rejected alternative provided: yes', ...over }), { agentType: type, captureId: 'S-1-x-agent-2' });
      assert.equal(r.validator, 'rejected', `${type}: ${name}`);
      assert.ok(r.reasons.some((x) => needle.test(x)), `${type}: ${name}: ${r.reasons.join('; ')}`);
    }
  };
  const line = 'objection: F-P1-1 | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: shown';
  for (const bad of [`- ${line}`, `  ${line}`, `* ${line}`, `1. ${line}`, line.replace('objection', 'Objection'), line.replace('objection', 'OBJECTION'), 'objection:F-P1-1 | artefact: x']) {
    rejects({ objections: bad }, /objection id F-P1-1 outside/, bad);
  }
  assert.equal(validate({ objections: `${OBJECTION}\nObjection to the premise: it does not hold` }).validator, 'valid', 'prose without an objection id is no objection');
  rejects({ premises: 'premises:\n- a -- checked: x.mjs:1\n\n- b -- unchecked' }, /premise row outside the premises section/, 'row after a break');
  rejects({ premises: 'premises: none, no existing code or data touched', objections: '\n- c -- unchecked' }, /premise row outside/, 'row after none and a break');
  rejects({ premises: null, objections: '- c -- checked: x.mjs:1' }, /premise row outside/, 'row without a section');
  rejects({ verdict: 'verdict: a\nverdict: a' }, /verdict line appears twice/, 'second verdict with the same value');
  rejects({ verdict: 'verdict: a\nverdict: b' }, /verdict line appears twice/, 'second verdict with another value');
  const fine = validate({ objections: `${line}\nObjections are listed above.`, premises: 'premises:\n- a -- checked: x.mjs:1\n- b -- unchecked: nothing' });
  assert.ok(!fine.reasons.some((x) => /objection id|outside the premises/.test(x)), fine.reasons.join('; '));
});

function vc(R, ...rest) {
  const r = spawnSync(process.execPath, [VERDICT_CHECK, '--run-dir', R, ...rest], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('the checker reports rejected and stale captures and exits 1, and exits 0 on a clean index', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const live = { path: 'idea/idea.md', sha256: sha('current\n') };
  const old = { path: 'idea/idea.md', sha256: sha('older\n') };
  const clean = vc(decided({ captures: [{ ...FRESH, targets: [live] }] }), '--snapshot', snap);
  assert.equal(clean.status, 0, clean.out);
  assert.match(clean.out, /verdict-check OK/);
  const bad = vc(decided({ captures: [{ ...FRESH, targets: [old] }, { ...CONFLICTED, validator: 'rejected', verdict: null, reasons: ['the premises section is missing'] }] }), '--snapshot', snap);
  assert.equal(bad.status, 1, bad.out);
  assert.match(bad.out, /verdict-check FAIL D-1-devils-advocate-agent-8: stale/);
  assert.match(bad.out, /verdict-check FAIL D-1-devils-advocate-agent-7: rejected: .*the premises section is missing/);
  assert.equal(vc(decided({ captures: [{ ...FRESH, targets: [] }] }), '--snapshot', snap).status, 1);
  assert.equal(vc(decided({ captures: [{ ...FRESH, targets: [], decision: null }, { ...FRESH, id: 'S-1-review-verify-agent-2', agent_type: 'cdp6-core:review-verify', targets: [], decision: null }] }), '--snapshot', snap).status, 1);
  assert.match(vc(decided({ captures: [{ ...FRESH, id: 'S-1-review-verify-agent-2', agent_type: 'cdp6-core:review-verify', targets: [], decision: null }] }), '--snapshot', snap).out, /S-1-review-verify-agent-2: stale/);
});

test('fires: any capture that names no target is stale, whatever its role and whether it has a decision', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const bare = vc(decided({ captures: [{ ...FRESH, targets: [] }] }), '--snapshot', snap);
  assert.equal(bare.status, 1, bare.out);
  assert.match(bare.out, /verdict-check FAIL D-1-devils-advocate-agent-8: stale/);
  const noArgument = vc(decided({ captures: [{ ...FRESH, targets: [] }] }));
  assert.equal(noArgument.status, 1, noArgument.out);
  assert.match(noArgument.out, /stale/);
  assert.equal(isStale({ ...FRESH, targets: [] }, snap), true);
  assert.equal(isStale({ ...FRESH, targets: [], decision: null }, snap), true);
  assert.equal(isStale({ ...FRESH, targets: [], agent_type: 'cdp6-core:review-verify' }, snap), true);
  assert.equal(isStale({ ...FRESH, targets: undefined, agent_type: 'cdp6-core:adversarial-auditor', decision: null }, snap), true);
  assert.equal(isStale({ ...FRESH, targets: [LIVE] }, snap), false);
});

test('the checker reports an index line without its capture file, a changed capture file and a capture file without an index line', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const gone = decided({ captures: [FRESH] });
  rmSync(join(gone, 'verdicts', 'D-1-devils-advocate-agent-8.md'));
  assert.match(vc(gone, '--snapshot', snap).out, /verdict-check FAIL D-1-devils-advocate-agent-8: the capture file D-1-devils-advocate-agent-8\.md is missing/);
  const changed = decided({ captures: [FRESH] });
  writeFileSync(join(changed, 'verdicts', 'D-1-devils-advocate-agent-8.md'), 'verdict: b\n');
  const c = vc(changed, '--snapshot', snap);
  assert.equal(c.status, 1, c.out);
  assert.match(c.out, /differs from the sha256 of its index line/);
  const orphan = decided({ captures: [FRESH] });
  writeFileSync(join(orphan, 'verdicts', 'D-1-devils-advocate-agent-9.md'), 'verdict: a\n');
  const o = vc(orphan, '--snapshot', snap);
  assert.equal(o.status, 1, o.out);
  assert.match(o.out, /verdict-check FAIL D-1-devils-advocate-agent-9\.md: capture file without an index line/);
});

test('input class: an index line that is not JSON, a snapshot that is missing and a missing argument exit 2', () => {
  const R = decided({ captures: [FRESH] });
  writeFileSync(join(R, 'verdicts', 'index.jsonl'), 'not json\n');
  const broken = vc(R, '--snapshot', snapshotWith({}));
  assert.equal(broken.status, 2, broken.out);
  assert.match(broken.out, /verdict-check: index-unreadable/);
  const gone = join(tempDir('cdp6-vc-gone-'), 'nope');
  const missing = vc(decided({ captures: [FRESH] }), '--snapshot', gone);
  assert.equal(missing.status, 2, missing.out);
  assert.match(missing.out, /verdict-check: snapshot-unreadable/);
  assert.equal(spawnSync(process.execPath, [VERDICT_CHECK], { encoding: 'utf8' }).status, 2);
  assert.equal(vc(decided({ captures: [{ ...FRESH, targets: [{ path: 'idea/idea.md', sha256: sha('x') }] }] })).status, 2);
});

test('fires: a conflicted capture keeps its objection and premise ids on the result when the validator rejects it, an unconflicted rejected one keeps none', () => {
  const over = { rejected: 'rejected alternative provided: no', premises: 'premises:\n- the index is append-only -- checked: lib/capture.mjs:109', verdict: 'verdict: b' };
  const conflicted = validate({ ...over, conflict: 'conflict of interest: author of D-2' });
  assert.equal(conflicted.validator, 'rejected', JSON.stringify(conflicted));
  assert.equal(conflicted.conflicted, true);
  assert.equal(conflicted.verdict, null);
  assert.deepEqual(conflicted.objections, ['F-P1-1']);
  assert.deepEqual(conflicted.premises, ['D-1-devils-advocate-agent-7:premise-1']);
  const plain = validate(over);
  assert.equal(plain.validator, 'rejected', JSON.stringify(plain));
  assert.deepEqual([plain.objections, plain.premises], [[], []]);
});

test('fires: a premise row after a break in the premises section is not dropped', () => {
  const r = validate({ premises: 'premises:\n- the index is append-only -- checked: lib/capture.mjs:109\n\n- no other writer touches verdicts/ -- unchecked', objections: null });
  assert.notEqual(r.verdict, 'a', JSON.stringify(r));
});

test('fires: an objection line with a list mark under verdict b is not dropped', () => {
  const second = '- objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const r = validate({ objections: `${OBJECTION}\n${second}`, verdict: 'verdict: b' });
  assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), JSON.stringify(r));
});

test('fires: an index line whose id is not its capture file name without .md is a finding of the checker', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const R = decided({ captures: [FRESH] });
  assert.equal(vc(R, '--snapshot', snap).status, 0);
  const index = join(R, 'verdicts', 'index.jsonl');
  writeFileSync(index, `${JSON.stringify({ ...JSON.parse(readFileSync(index, 'utf8')), id: 'D-1-devils-advocate-agent-9' })}\n`);
  const r = vc(R, '--snapshot', snap);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /verdict-check FAIL D-1-devils-advocate-agent-9: the index id is not the capture file name D-1-devils-advocate-agent-8/);
  assert.equal(rereadCaptures(R).captures.length, 0);
});

test('fires: the gate reads verdicts/ under verdicts.lock, fails closed with a named finding on a busy or uncreatable lock and releases the lock', () => {
  const R = decided({ captures: [FRESH] });
  const lock = join(R, 'verdicts.lock');
  const free = rereadCaptures(R, { waitMs: 50 });
  assert.equal(free.captures.length, 1);
  assert.deepEqual(free.findings, []);
  assert.equal(existsSync(lock), false);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  const started = Date.now();
  const busy = rereadCaptures(R, { waitMs: 50 });
  assert.ok(Date.now() - started < 1500, 'the gate waited without bound');
  assert.deepEqual(busy.captures, []);
  assert.equal(busy.findings.length, 1);
  assert.match(busy.findings[0], /verdicts\.lock: the capture lock is held by another writer, so the captures were not read/);
  assert.equal(existsSync(lock), true);
  rmSync(lock);
  const uncreatable = rereadCaptures(join(R, 'nope'), { waitMs: 50 });
  assert.deepEqual(uncreatable.captures, []);
  assert.match(uncreatable.findings[0], /verdicts\.lock: the capture lock cannot be created, so the captures were not read/);
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  const cli = vc(R, '--snapshot', snapshotWith({ 'idea/idea.md': 'current\n' }));
  assert.equal(cli.status, 1, cli.out);
  assert.match(cli.out, /verdict-check FAIL verdicts\.lock: the capture lock is held/);
});

test('fires: a plural objections line with an objection id under verdict b is not dropped', () => {
  const second = 'objections: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const r = validate({ objections: `${OBJECTION}\n${second}`, verdict: 'verdict: b' });
  assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), JSON.stringify(r));
});

test('fires: a capture with fresh context no is rejected for every counter-role (C9)', () => {
  for (const type of ['cdp6-core:pessimistic-realist', 'cdp6-core:adversarial-auditor', 'cdp6-core:threat-modeler']) {
    const r = validateCapture(text({ rejected: null, fresh: 'fresh context: no' }), { agentType: type, captureId: 'S-1-x-agent-2' });
    assert.equal(r.validator, 'rejected', type);
  }
});

test('fires: an unchecked premise in a numbered row or after a break with a longer tail, and an objection in a table row, code span or after a zero-width space, are not dropped', () => {
  for (const [name, premises] of [
    ['numbered row after the section', 'premises:\n- a -- checked: x.mjs:1\n1. b -- unchecked'],
    ['dash row after a break, text after unchecked', 'premises:\n- a -- checked: x.mjs:1\n\n- b -- unchecked (not verified)'],
    ['dash row after a break, Unchecked', 'premises:\n- a -- checked: x.mjs:1\n\n- b -- Unchecked'],
    ['dash row after a break, tab before --', 'premises:\n- a -- checked: x.mjs:1\n\n- b\t-- unchecked'],
  ]) {
    const r = validate({ premises, objections: null });
    assert.ok(r.validator === 'rejected' || r.verdict === 'not-decidable', `${name}: ${JSON.stringify(r)}`);
  }
  const tail = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  for (const [name, second] of [['table row', `| ${tail} |`], ['code span', `\`${tail}\``], ['zero-width space', `\u200B${tail}`]]) {
    const r = validate({ objections: `${OBJECTION}\n${second}`, verdict: 'verdict: b' });
    assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), `${name}: ${JSON.stringify(r)}`);
  }
});

test('fires: an objection id in prose after the word objection in any form and letter case, and a premise mark outside the premises section in any letter case, reject the capture of every counter-role, prose without an id is valid, and a missing fresh context line invalidates it', () => {
  const rejects = (over, needle, name) => {
    for (const type of [TYPE, ...OTHER_COUNTERS]) {
      const r = validateCapture(text({ rejected: 'rejected alternative provided: yes', ...over }), { agentType: type, captureId: 'S-1-x-agent-2' });
      assert.equal(r.validator, 'rejected', `${type}: ${name}`);
      assert.ok(r.reasons.some((x) => needle.test(x)), `${type}: ${name}: ${r.reasons.join('; ')}`);
    }
  };
  rejects({ objections: `${OBJECTION}\nobjections: F-P1-2 see the lines above` }, /objection id F-P1-2 outside/, 'plural line with an id');
  rejects({ objections: `${OBJECTION}\nsee the OBJECTION: F-P1-2 below` }, /objection id F-P1-2 outside/, 'inside a sentence, upper case, with an id');
  rejects({ objections: `${OBJECTION}\nsee the Objections : F-P1-2 below` }, /objection id F-P1-2 outside/, 'space before the colon, with an id');
  rejects({ objections: `${OBJECTION}\nsee F-P1-2 below` }, /objection id F-P1-2 outside/, 'an id in a sentence without the word');
  for (const prose of ['objections: see the lines above', 'see the OBJECTION: below', 'see the Objections : below', 'see the objection\u200B: below']) {
    assert.equal(validate({ objections: `${OBJECTION}\n${prose}` }).validator, 'valid', `prose without an objection id carries no objection: ${prose}`);
  }
  rejects({ premises: 'premises:\n- a -- checked: x.mjs:1', objections: `${OBJECTION}\nb -- CHECKED: x.mjs:1` }, /premise row outside/, 'upper case checked outside the block');
  rejects({ premises: 'premises:\n- a -- checked: x.mjs:1', objections: `${OBJECTION}\n| b -- Unchecked |` }, /premise row outside/, 'table row outside the block');
  rejects({ fresh: null }, /fresh context/, 'missing fresh context line');
  const fine = validate({ objections: `${OBJECTION}\nObjections are listed above.`, premises: 'premises:\n- a -- checked: x.mjs:1\n- b -- unchecked' });
  assert.ok(fine.reasons.every((x) => /unchecked premise/.test(x)), fine.reasons.join('; '));
});

test('fires: the gate default wait for verdicts.lock is bounded', () => {
  const R = decided({ captures: [FRESH] });
  const lock = join(R, 'verdicts.lock');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  const started = Date.now();
  const busy = rereadCaptures(R);
  const waited = Date.now() - started;
  rmSync(lock);
  assert.ok(waited < 1500, `the gate waited ${waited} ms`);
  assert.deepEqual(busy.captures, []);
  assert.match(busy.findings[0], /verdicts\.lock: the capture lock is held by another writer/);
});

test('fires: a dangling-symlink or old-directory verdicts.lock fails the gate closed within its wait instead of hanging', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const R1 = decided({ captures: [FRESH] });
  symlinkSync(join(R1, 'no-such-target'), join(R1, 'verdicts.lock'));
  const R2 = decided({ captures: [FRESH] });
  mkdirSync(join(R2, 'verdicts.lock'));
  utimesSync(join(R2, 'verdicts.lock'), new Date(Date.now() - 60000), new Date(Date.now() - 60000));
  for (const R of [R1, R2]) {
    const r = spawnSync(process.execPath, [VERDICT_CHECK, '--run-dir', R, '--snapshot', snap], { encoding: 'utf8', timeout: 5000 });
    assert.equal(r.signal, null, 'verdict-check did not end within 5 s');
    assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /verdict-check FAIL verdicts\.lock:/);
  }
});

test('fires: a premise mark in the tail of a well-formed objection line outside the premises block rejects the capture', () => {
  for (const tail of [' -- unchecked', ' -- CHECKED: x.mjs:1']) {
    const r = validate({ objections: `${OBJECTION}${tail}` });
    assert.equal(r.validator, 'rejected', `${tail}: ${JSON.stringify(r)}`);
    assert.ok(r.reasons.some((x) => /premise row outside/.test(x)), `${tail}: ${r.reasons.join('; ')}`);
  }
});

test('fires: an invisible character inside a premise mark or inside the objection word does not let the line slip past the capture form', () => {
  const premise = validate({ premises: 'premises:\n- a -- checked: x.mjs:1\n\n- b --\u200Bunchecked', objections: null });
  assert.ok(premise.validator === 'rejected' || premise.verdict === 'not-decidable', JSON.stringify(premise));
  const tail = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const word = validate({ objections: `${OBJECTION}\n${tail.replace('objection', 'obj\u00ADection')}`, verdict: 'verdict: b' });
  assert.ok(word.validator === 'rejected' || word.objections.includes('F-P1-2'), JSON.stringify(word));
});

test('fires: markup between the word objection and the colon rejects the capture with an objection id and is prose without one', () => {
  for (const line of [
    'A further `objection`: F-P1-2 idea/idea.md:20 drops the null option',
    'Second **objection**: F-P1-2 idea/idea.md:20 drops the null option',
    '| F-P1-2 | _objection_: idea/idea.md:20 |',
  ]) {
    const r = validate({ objections: `${OBJECTION}\n${line}`, verdict: 'verdict: b' });
    assert.equal(r.validator, 'rejected', `${line}: ${JSON.stringify(r)}`);
  }
  for (const line of [
    'A further `objection`: idea/idea.md:20 drops the null option',
    'Second **objection**: idea/idea.md:20 drops the null option',
    '| _objection_: idea/idea.md:20 |',
  ]) {
    const r = validate({ objections: `${OBJECTION}\n${line}`, verdict: 'verdict: b' });
    assert.equal(r.validator, 'valid', `${line}: ${JSON.stringify(r)}`);
    assert.deepEqual(r.objections, ['F-P1-1'], line);
  }
});

test('fires: a verbatim assignment quote that contains "objections:" passes an otherwise valid capture', () => {
  const r = validate({ objections: `${OBJECTION}\n> Assignment, verbatim: "Add a Known objections: section to the RFC template."` });
  assert.equal(r.validator, 'valid', JSON.stringify(r));
});

const FOUR = (id, tail = 'refuted when: the section is shown') => `objection: ${id} | artefact: idea/idea.md | evidence: idea/idea.md:12 | ${tail}`;

function rejectsAll(over, needle, name) {
  for (const type of [TYPE, ...OTHER_COUNTERS]) {
    const r = validateCapture(text({ rejected: 'rejected alternative provided: yes', ...over }), { agentType: type, captureId: 'S-1-x-agent-2' });
    assert.equal(r.validator, 'rejected', `${type}: ${name}: ${JSON.stringify(r)}`);
    assert.ok(r.reasons.some((x) => needle.test(x)), `${type}: ${name}: ${r.reasons.join('; ')}`);
  }
}

test('fires: line grammar g1 to g6 of §5.3 (g1) the verdict line appears once and its value is one of the five classes', () => {
  for (const value of ['d', 'b because', 'B', 'pass', '']) rejectsAll({ verdict: `verdict: ${value}` }, /verdict class/, value);
  rejectsAll({ verdict: 'verdict: a\nverdict: a' }, /verdict line appears twice/, 'twice');
  rejectsAll({ verdict: null }, /verdict line is missing/, 'none');
  for (const klass of ['a', 'a-with-conditions', 'not-decidable']) assert.equal(validate({ verdict: `verdict: ${klass}` }).verdict, klass, klass);
  assert.equal(validate({ objections: OBJECTION, verdict: 'verdict: \uFF42' }).verdict, 'b', 'NFKC reads a full-width b');
  assert.equal(validate({ objections: OBJECTION, verdict: 'verdict: a\u200B' }).verdict, 'a', 'a format character is removed');
  rejectsAll({ conflict: 'conflict of interest: author of F-P1-9' }, /objection id F-P1-9 outside/, 'an id in a header line');
});

test('fires: line grammar g1 to g6 of §5.3 (g2) an objection line has exactly the four fields in order and no other id and no premise mark', () => {
  const ok = validate({ objections: FOUR('F-P1-1'), verdict: 'verdict: b' });
  assert.deepEqual([ok.validator, ok.objections], ['valid', ['F-P1-1']], JSON.stringify(ok));
  const own = validate({ objections: FOUR('F-P1-1', 'refuted when: F-P1-1 is shown'), verdict: 'verdict: b' });
  assert.equal(own.validator, 'valid', JSON.stringify(own));
  for (const [name, line] of [
    ['no refuted when', 'objection: F-P1-1 | artefact: idea/idea.md | evidence: idea/idea.md:12'],
    ['no artefact', 'objection: F-P1-1 | evidence: idea/idea.md:12 | refuted when: shown'],
    ['fields out of order', 'objection: F-P1-1 | evidence: idea/idea.md:12 | artefact: idea/idea.md | refuted when: shown'],
    ['a fifth field', `${FOUR('F-P1-1')} | severity: high`],
    ['text after the id', 'objection: F-P1-1 extra | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: shown'],
  ]) {
    for (const verdict of ['verdict: a', 'verdict: b']) rejectsAll({ objections: line, verdict }, /objection line .*four fields/, `${name} ${verdict}`);
  }
  rejectsAll({ objections: FOUR('F-P1-1', 'refuted when: F-P1-2 is refuted too') }, /objection id F-P1-2/, 'another id in the condition');
  rejectsAll({ objections: `${FOUR('F-P1-1')} | ${FOUR('F-P1-2')}` }, /objection id F-P1-2/, 'a second objection in the tail');
  rejectsAll({ objections: FOUR('F-P1-1', 'refuted when: a -- unchecked') }, /premise row outside/, 'a premise mark in the line');
});

test('fires: line grammar g1 to g6 of §5.3 (g3) the premises section ends at the first line that does not start with "- "', () => {
  const rows = (...r) => `premises:\n${r.join('\n')}`;
  const ok = validate({ premises: rows('- a -- checked: x.mjs:1', '- b -- unchecked') });
  assert.equal(ok.validator, 'valid', JSON.stringify(ok));
  assert.equal(ok.premises.length, 2);
  rejectsAll({ premises: rows('- a -- checked: x.mjs:1', '', '- b -- unchecked') }, /premise row outside/, 'a blank line ends the section');
  rejectsAll({ premises: `${rows('- a -- checked: x.mjs:1')}\nthe next premise follows`, objections: '- b -- unchecked' }, /premise row outside/, 'prose ends the section');
  rejectsAll({ premises: rows('- a -- checked: x.mjs:1', '  - b -- unchecked') }, /premise row outside/, 'an indented row is not in the section');
  rejectsAll({ premises: rows('- a') }, /premise 1 is neither/, 'a row without a mark');
  rejectsAll({ premises: rows('- a -- checked: it is fine') }, /premise 1 is neither/, 'a row with a bad check');
  rejectsAll({ premises: 'premises: none, no existing code or data touched\n- a -- unchecked' }, /says none but premise rows follow/, 'none and rows');
  rejectsAll({ premises: 'premises:' }, /no premise row/, 'an empty section');
  rejectsAll({ premises: rows('- a -- checked: x.mjs:1 see F-P1-2') }, /objection id F-P1-2 outside/, 'an id in a premise row');
});

test('fires: line grammar g1 to g6 of §5.3 (g4) a disposition line follows the disposition paragraph and an upheld disposition rejects', () => {
  const item = 'D-1-devils-advocate-agent-7:F-P1-1';
  for (const line of [
    `disposition: ${item} resolved idea/idea.md:3 - the null option is costed`,
    'disposition: F-P2-1 resolved X-3 \u2014 explored in X-3',
    `disposition: ${item.replace('F-P1-1', 'premise-2')} withdrawn idea/idea.md:9 - the premise was checked`,
    `disposition: ${item.replace('F-P1-1', 'conflict')} withdrawn idea/idea.md:9 - no stake remains`,
  ]) {
    for (const type of [TYPE, ...OTHER_COUNTERS]) {
      const r = validateCapture(`${text({ objections: null })}${line}\n`, { agentType: type, captureId: 'D-1-x-agent-9' });
      assert.deepEqual([r.validator, r.objections, r.reasons], ['valid', [], []], `${type}: ${line}: ${JSON.stringify(r)}`);
    }
  }
  const own = validate({ objections: `${FOUR('F-P1-1')}\ndisposition: ${item} resolved idea/idea.md:3 - done` });
  assert.deepEqual([own.validator, own.objections], ['valid', ['F-P1-1']], JSON.stringify(own));
  rejectsAll({ objections: `disposition: ${item} upheld - the objection stands` }, /upheld disposition/, 'upheld');
  for (const [name, line] of [
    ['no why', `disposition: ${item} resolved idea/idea.md:3`],
    ['no reference', `disposition: ${item} resolved - done`],
    ['an unknown word', `disposition: ${item} dismissed idea/idea.md:3 - done`],
    ['an item that is no returned id', 'disposition: the null option resolved idea/idea.md:3 - done'],
    ['a capture item', `disposition: ${item.replace('F-P1-1', 'capture')} resolved idea/idea.md:3 - done`],
    ['a premise mark', `disposition: ${item} resolved idea/idea.md:3 - done -- unchecked`],
  ]) rejectsAll({ objections: line }, /disposition line|premise row outside/, name);
});

test('fires: line grammar g1 to g6 of §5.3 (g5) a "> " quote line carries no objection and no premise whatever ids or marks it contains', () => {
  const quote = (q) => validate({ objections: `${OBJECTION}\n${q}`, verdict: 'verdict: b' });
  for (const q of [
    '> Assignment, verbatim: "Close F-P3-2 of the previous run."',
    `> ${FOUR('F-P1-2')}`,
    '> - a premise -- unchecked',
    '> ## F-P1-3 -- CHECKED: x.mjs:1',
  ]) {
    const r = quote(q);
    assert.deepEqual([r.validator, r.objections, r.premises], ['valid', ['F-P1-1'], []], `${q}: ${JSON.stringify(r)}`);
  }
  for (const q of ['>Close F-P3-2 of the previous run.', ' > Close F-P3-2', '>> Close F-P3-2']) {
    assert.equal(quote(q).validator, 'rejected', q);
  }
});

test('fires: line grammar g1 to g6 of §5.3 (g6) an objection id or a premise mark in prose rejects, other prose carries no objection, and the form is read after Cf removal, NFKC and dash mapping', () => {
  for (const prose of ['The owner has to record F-P1-2 first.', '## F-P1-2', 'see\tF-P8-10']) rejectsAll({ objections: `${OBJECTION}\n${prose}` }, /objection id F-P\d-\d+ outside/, prose);
  for (const mark of ['b -- checked: x.mjs:1', 'b -- UNCHECKED', 'b --\u00A0Checked']) rejectsAll({ objections: `${OBJECTION}\n${mark}` }, /premise row outside/, mark);
  for (const id of ['\uFF26-P1-2', 'F\u2011P1\u20112', 'F-P1-\uFF12', 'F\u2212P1\u22122', 'F\u2014P1\u20142', 'F-P\u200B1-2']) {
    rejectsAll({ objections: `${OBJECTION}\nsee ${id} below` }, /objection id F-P1-2 outside/, JSON.stringify(id));
  }
  for (const prose of ['Objections are listed above.', 'No objection to the premise.', 'F-P9-1 is no objection id', 'checked and unchecked are words']) {
    const r = validate({ objections: `${OBJECTION}\n${prose}`, verdict: 'verdict: b' });
    assert.deepEqual([r.validator, r.objections], ['valid', ['F-P1-1']], `${prose}: ${JSON.stringify(r)}`);
  }
});

test('review fix-4: an objection id in the tail of an objection line rejects the capture, and the same objection as its own objection line is valid', () => {
  const smuggled = 'objection: F-P1-1 | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: shown; objection F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20';
  const smuggledR = validate({ objections: smuggled, verdict: 'verdict: b' });
  assert.equal(smuggledR.validator, 'rejected', JSON.stringify(smuggledR));
  const cited = validate({ objections: OBJECTION.replace('the section is shown', 'F-P1-2 is refuted'), verdict: 'verdict: b' });
  assert.equal(cited.validator, 'rejected', JSON.stringify(cited));
  const own = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const separate = validate({ objections: `${OBJECTION}\n${own}`, verdict: 'verdict: b' });
  assert.equal(separate.validator, 'valid', JSON.stringify(separate));
  assert.deepEqual(separate.objections, ['F-P1-1', 'F-P1-2']);
});

test('review fix-4: an objection id in a compatibility or dash-variant form outside an objection line rejects the capture', () => {
  for (const id of ['\uFF26-P1-2', 'F\u2011P1\u20112', 'F-P1-\uFF12', 'F\u2212P1\u22122']) {
    const r = validate({ objections: `${OBJECTION}\nsee ${id} below`, verdict: 'verdict: b' });
    assert.equal(r.validator, 'rejected', `${JSON.stringify(id)}: ${JSON.stringify(r)}`);
  }
});

test('auditor fix4 A3: an objection id in the tail of a well-formed objection line rejects the capture, as the id rule of §5.3 says', () => {
  const second = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:3 | refuted when: the null option is costed';
  for (const tail of [` | ${second}`, ' | refuted when: F-P1-2 is refuted too']) {
    const r = validate({ objections: `${OBJECTION}${tail}`, verdict: 'verdict: b' });
    assert.equal(r.validator, 'rejected', `${tail}: ${JSON.stringify(r)}`);
  }
  const R = decided({ captures: [{ ...FRESH, id: 'D-1-devils-advocate-agent-9', verdict: 'b', objections: ['F-P1-1'], text: text({ objections: `${OBJECTION} | ${second}`, verdict: 'verdict: b' }) }], records: ['D-1-devils-advocate-agent-9:F-P1-1'] });
  const g = gate(R);
  assert.equal(g.status, 1, `F-P1-2 left the gate without an owner record: ${g.out}`);
});

test('auditor fix4 A4: a disposition line that §5.3 and C13 require for a clearing capture is not rejected by the id rule', () => {
  for (const type of OTHER_COUNTERS) {
    const r = validateCapture(`${text({ objections: null })}disposition: D-1-devils-advocate-agent-7:F-P1-1 resolved idea/idea.md:3 \u2014 the null option is costed\n`, { agentType: type, captureId: 'D-1-x-agent-9' });
    assert.equal(r.validator, 'valid', `${type}: ${r.reasons.join('; ')}`);
  }
});

test('auditor fix4 A5: a verbatim assignment quote that contains an objection id does not reject an otherwise valid capture', () => {
  const r = validate({ objections: `${OBJECTION}\n> Assignment, verbatim: "Close F-P3-2 of the previous run before the release."` });
  assert.equal(r.validator, 'valid', JSON.stringify(r));
});

test('fires: a rejected conflicted capture returns every objection id of its file except those in quote lines and disposition lines, and its premise rows', () => {
  const conflict = 'conflict of interest: author of D-2';
  const second = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const body = [
    OBJECTION,
    second,
    'F-P1-3 is the larger defect.',
    'objection: F-P1-4 not a field line',
    '> quoted F-P1-5',
    'disposition: F-P1-6 resolved idea/idea.md:3 - done',
    `${OBJECTION.replace('the section is shown', 'x')} | objection: F-P1-7 | artefact: a | evidence: a:1 | refuted when: y`,
    'F-P1-3 again, and F-P1-10',
  ].join('\n');
  const r = validate({ conflict, objections: body, verdict: 'verdict: b', premises: 'premises:\n- one -- checked: a/b.mjs:1\n- two -- unchecked' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  assert.deepEqual(r.objections, ['F-P1-1', 'F-P1-2', 'F-P1-3', 'F-P1-4', 'F-P1-7', 'F-P1-10']);
  assert.deepEqual(r.premises, ['D-1-devils-advocate-agent-7:premise-1', 'D-1-devils-advocate-agent-7:premise-2']);
  const plain = validate({ objections: body, verdict: 'verdict: b' });
  assert.deepEqual(plain.objections, []);
});

test('fires: a valid conflicted capture keeps exactly its objection-line ids', () => {
  const r = validate({ conflict: 'conflict of interest: author of D-2' });
  assert.equal(r.validator, 'valid', JSON.stringify(r));
  assert.deepEqual(r.objections, ['F-P1-1']);
});

test('rv56 F2: an objection line whose evidence command contains " | " is read as five fields and rejects the capture', () => {
  const piped = 'objection: F-P1-1 | artefact: idea/idea.md | evidence: command: grep -n null idea/idea.md | wc -l | refuted when: the null option is costed';
  const r = validate({ objections: piped, verdict: 'verdict: b' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
});

test('rv56 F6: an objection line that names another objection id rejects the capture even when that id has its own objection line', () => {
  const own = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const r = validate({ objections: `${OBJECTION.replace('the section is shown', 'F-P1-2 is refuted')}\n${own}`, verdict: 'verdict: b' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  assert.ok(r.reasons.some((x) => /carries the objection id F-P1-2 in the objection line of F-P1-1/.test(x)), r.reasons.join('; '));
});

test('rv58 R1: a rejected conflicted capture returns an objection id that stands on a line starting with disposition: outside the disposition form', () => {
  const r = validate({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\ndisposition: F-P1-2 is the larger defect and stays open`, verdict: 'verdict: b' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  assert.ok(r.reasons.some((x) => /is a disposition line not of the form/.test(x)), r.reasons.join('; '));
  assert.deepEqual(r.objections, ['F-P1-1', 'F-P1-2']);
});

test('rv60 C2: an objection id after the item of a well-formed disposition line rejects the capture and is an item of a rejected conflicted capture', () => {
  const line = 'disposition: F-P2-1 resolved X-3 - explored in X-3, but F-P1-2 stays open';
  const r = validate({ objections: line });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  const c = validate({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\n${line}`, verdict: 'verdict: b' });
  assert.equal(c.validator, 'rejected', JSON.stringify(c));
  assert.ok(c.objections.includes('F-P1-2'), JSON.stringify(c.objections));
});

test('rv61 C2: for every counter-role an objection id in the cited part or the why of a disposition line rejects the capture, while the item id alone stays exempt', () => {
  const types = ['cdp6-core:devils-advocate', 'cdp6-core:pessimistic-realist', 'cdp6-core:adversarial-auditor', 'cdp6-core:threat-modeler'];
  for (const type of types) {
    const as = (over) => validate({ rejected: 'rejected alternative provided: yes', ...over }, { agentType: type, captureId: 'S-1-x-agent-2' });
    const cited = as({ objections: 'disposition: F-P2-1 resolved F-P1-2 - explored' });
    assert.equal(cited.validator, 'rejected', `${type} cited: ${JSON.stringify(cited)}`);
    const scoped = as({ objections: 'disposition: D-1-x-agent-2:F-P2-1 withdrawn idea/idea.md:3 - overlaps F-P1-3' });
    assert.equal(scoped.validator, 'rejected', `${type} scoped: ${JSON.stringify(scoped)}`);
    const exempt = as({ objections: 'disposition: D-1-x-agent-2:F-P2-1 withdrawn idea/idea.md:3 - done' });
    assert.equal(exempt.validator, 'valid', `${type} exempt: ${JSON.stringify(exempt)}`);
  }
  const c = validate({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\ndisposition: F-P2-1 resolved F-P1-4 - done`, verdict: 'verdict: b' });
  assert.deepEqual(c.objections, ['F-P1-1', 'F-P1-4']);
});

test('rv62 G1: a rejected conflicted capture with an objection id after the item of a disposition line does not leave the gate on the record of its objection line alone', () => {
  const id = 'D-1-devils-advocate-agent-9';
  const body = text({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\ndisposition: F-P2-1 resolved X-3 - explored in X-3, but F-P1-2 stays open`, verdict: 'verdict: b' });
  const cap = { ...FRESH, id, stamp: T1, verdict: null, validator: 'rejected', conflicted: true, objections: ['F-P1-1', 'F-P1-2'], text: body };
  const one = gate(decided({ captures: [cap, FRESH], records: [`${id}:F-P1-1`] }));
  assert.equal(one.status, 1, one.out);
  assert.ok(one.out.includes(`${id}:F-P1-2`), one.out);
  const both = gate(decided({ captures: [cap, FRESH], records: [`${id}:F-P1-1`, `${id}:F-P1-2`] }));
  assert.equal(both.status, 0, both.out);
});
