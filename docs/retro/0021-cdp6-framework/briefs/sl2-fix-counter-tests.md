# Counter-tests of the SL-2 audit (adversarial-auditor run 39), as executed by the orchestrator

Appended unchanged to the end of each file; `hooks/guard-spawn.test.mjs` also gains `import { createHash } from 'node:crypto';` as its second line. Output of the run on the T3 tree: `reports/sl2-audit-counter-tests.txt` (exit 1, 5 of 5 failing).

## checks/decision-check.test.mjs

```js
test('fires: target-less devils-advocate capture counts against any artefact', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'rewritten after the verdict\n' });
  const r = check(fixture({ captures: [capture({ targets: [] })] }), snap);
  assert.equal(r.status, 1, `a capture bound to no artefact passed: ${r.out}`);
});

test('fires: objection id of another decision cleared by its owner record', () => {
  const R = join(mkdtempSync(join(tmpdir(), 'cdp6-dc-')), 'RUN-20260101-x');
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
```

## hooks/guard-spawn.test.mjs

```js
test('fires: target hash not on disk at spawn', () => {
  const w = world();
  const R = join(w.repo, 'docs', 'cdp6', 'runs', RUN);
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'v1 judged\n');
  const future = createHash('sha256').update('v2 written after the verdict\n').digest('hex');
  const prompt = PROMPT.replace('task: P3-gate', 'task: D-1').replace(/target: docs\/a\.md@[0-9a-f]{64}\ntarget: docs\/b\.md@[0-9a-f]{64}/, `target: idea/idea.md@${future}`);
  const res = fire(w, { prompt });
  assert.equal(res.status, 2, `allowed; pending targets ${JSON.stringify(counters(w).pending?.toolu_1?.targets)}`);
});

test('fires: devils-advocate spawn without target line', () => {
  const w = world();
  const prompt = PROMPT.replace('task: P3-gate', 'task: D-1').split('\n').filter((l) => !l.startsWith('target:')).join('\n');
  const res = fire(w, { prompt });
  assert.equal(res.status, 2, `allowed with targets ${JSON.stringify(counters(w).pending?.toolu_1?.targets)}`);
});
```

The two `guard-spawn` tests belong to audit F2 (spawn-time target check), which is a recorded follow-up for SL-3 with `brief-lint.mjs`: in the fix run they stay red-only evidence and are not added to the suite. The three `decision-check` tests are added and must end green.
