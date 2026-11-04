# review-verify of the SL-2 gate-table build and concept v0.5.11 to v0.5.12 (stage-1 run 56): final answer as handed back

Brief: `briefs/sl2-build-table-rv.md`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes (no part of the SL-2 build, its report or concept v0.5.12)

Target state: worktree `<repo>/.worktrees/sl2`. `git rev-parse HEAD` = 960146b3f8e5884a4a9f93f1077e793cedd6e14a, equal to the brief's base. Concept sha256 398acae53b38b7ef91bdadfcb8ed2d96799aad4304ee5271609c6405e7564fe4, equal to the brief's hash. The build is `diff -r <repo>/.worktrees/sl2-pre-build <repo>/.worktrees/sl2/plugins/cdp6-core`, 718 lines, read in full.

**Outcome: block.** Claims 1 to 5 are confirmed. Claim 7 is refuted: a rejected `conflicted` capture can carry an objection id past the gate with no owner record (🔴 F1). Claim 6 is partly refuted. Verdict mapping: bestätigt and bestätigt + ergänzt → pass; widerlegt → block. Nothing was run.

## Part A: claims
| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1 | Do items 1 to 5 exist with the named tests, and does each test assert its AC row, grammar rule or table row? | bestätigt | Item 1: six tests "(g1)" to "(g6)" (diff lines 469-565) cover every cause in AC-12.29 (concept:930), including the dash and NFKC forms. Item 2: four tests "capture rows (a)", "(b) and (c)", "(conflicted)", "(rejected)" (diff 153-264) match AC-12.30 (concept:931). Item 3: three tests "status rows and D-n set" (diff 275-338) match AC-12.31. Item 4: two tests in `run.test.mjs` (diff 671-712) match AC-12.32, refusal code `unknown-capture` (`run.mjs:424`, `verdict-index.mjs:109-126`). Item 5: role file (diff 9) and skill (diff 717), both with tests (diff 374-399). |
| 2 | Does every table row and g1 to g6 have a test that turns red on another outcome? | bestätigt | Capture rows (concept:1246-1255): staleA, staleThenLive, staleNd, nd, latestNd; the (b)/(c) loop with alone, staleAlone, notLatest, accepted; the conflicted cases with acceptedC, aloneStale; the rejected forms with noBc, bPrefix, the late* cases. Status rows (concept:1259-1262): decided, superseded, proposed, vetoed, Decided, '' and none. The D-n set, the .md re-read cases, and g1 to g6 each have a test. The `:conflict reject` path is covered by the older test at `decision-check.test.mjs:326-342`. No row or rule lacks a test. |
| 3 | Are the counter-tests verbatim, and does the 🟡-2 replacement assert what the brief says? | bestätigt + ergänzt | 🟡-3 and 🟢-4 match `sl2-fix4-rv.md:76-96`; A1, A2, A6, A3, A4, A5, A7 match `sl2-fix4-auditor.md:79-139`. The one difference is that A4 writes the em dash as an escape, the same string (`verdict-check.test.mjs:802`). No import hunk in any test file. The 🟡-2 replacement (diff 567-577) rejects `smuggled`, rejects `cited` and accepts the separate line. Gap: the original `cited` input had two lines, the citing line plus F-P1-2's own objection line, and that pair is never asserted to reject. CT-4 covers it. |
| 4 | Would each named mutation turn the named test red? | bestätigt (by reading) | Item 1, `premiseRows` over blank lines: the g3 "blank line" case and the `:391` "row after a break" case become valid. Item 2, `const live = all` (`decision-check.mjs:57`): staleA, staleAlone and aloneStale pass. Disabling the conflicted findings: the "(conflicted)" open cases pass. Item 3, no sha256 compare (`verdict-check.mjs:214`): the `edited` case passes. Only a run decides the counts "3 older" and "8 other". |
| 5 | Which hunks remove, replace or loosen an assertion, and does the cited item require it? | bestätigt | (a) `decision-check.test.mjs:232` `worse` 0→1, (b) `:243` `kept` 0→1, (c) `:408` superseded `stale` 0→1, (d) `:437` `stale` 0→1: all required by row "b/c, live or stale" (concept:1249-1250), each with a "records clear it" counterpart. (e) `verdict-check.test.mjs:68` valid→rejected, required by g2. (f) `:400` removes `'> objection: F-P1-1 \| artefact: x'`, required by g5; the g5 test asserts the converse. (g) Two titles renamed; bodies match (`:391-410`, `:571-590`). (h) The 🟡-2 replacement, required by g2. No skip or todo. |
| 6 | Do the worker's choices stay inside the brief and the cited concept lines? Do the role file and skill state item 5? | widerlegt (in part) | Role file states all six causes (`devils-advocate.md:52`); skill names the four record forms (`SKILL.md:40`). Choices 3, 5 and 7 are inside g2, AC-12.32 and concept:1242. Outside: choice 2 rejects an id in a header line, which g1 and g6 (concept:1240) and AC-12.29 do not list (🟢). Choice 1 allows `:conflict` as a disposition item, but concept:1236 names only "an objection or premise of the conflicted capture" (🟢). Choice 4 settles a conflict between row 1252 ("as the matching rejected row below", which blocks until `:capture`) and AC-12.32 (concept:933, no `:capture` for a conflicted capture); the worker's note "avoids a deadlock" shows it saw the conflict, and the stop rule asks for an open question with both line numbers instead. F1 comes from this reading. |
| 7a | Is no legitimate capture the role file asks for rejected? | widerlegt | Pipe in evidence: an evidence `command:` containing ` \| ` (role file step 6, `:59`) splits into five fields and rejects (`verdict-check.mjs:55-56`); nothing in the role file warns (F2). Step 8: `devils-advocate.md:61` asks for "what the owner has to record per objection", which invites an id in prose; noted by run 52, unchanged (F3). An `upheld` disposition rejects by design under g4 (SL-5), not a finding. |
| 7b | Does no objection id reach the gate without a well-formed objection line or a record? | widerlegt | For a rejected conflicted capture, `keep` keeps only `^objection:` ids (`verdict-check.mjs:83-88`, `:125-126`); an id in prose or in the tail of an objection line is dropped. `check-handback.mjs:123` writes the same list to the index, so `run.mjs object V:F-P1-2` is refused (`hasItem`, `verdict-index.mjs:125`). `:capture` is refused for a conflicted capture (`:110`). `captureFindings` skips `:capture` when `conflicted` (`decision-check.mjs:34`). Result: record F-P1-1, a later pass counts, and F-P1-2 passes the gate without a record (F1, CT-1). |

## Refuted claims: what is actually the case
- 7b: the rejected-conflicted branch reads its items only from objection lines, not "from its file" (concept:885, 1252); the same hole as A2 and A3, in the branch those tests do not cover.
- 6: choice 4 should have been an open question citing concept:1252 and :933; choices 1 and 2 go beyond the lines they cite.

## Part B: concept diff v0.5.11 → v0.5.12, per hunk
| Hunk | Review support | Closes the gap | Contradicts an unchanged line |
|---|---|---|---|
| @@-1 version | editorial | – | no |
| @@-22 §0 item 16, cap 58 | gap 10 | yes | no |
| @@-251 UC-01 Exit | gap 5 (254) | yes; "a superseded one needs none" | no |
| @@-269 steps 3 and 5.2 | gap 5 (272), Part C 277 | yes; `:capture` named | 5.2 says "rejected … (b) or (c) is cleared by `:capture`" without "not conflicted", against AC-12.32 |
| @@-395 UC-03 3.2 | gap 5 (398) | yes | no |
| @@-881 UC-12 steps 4 and 5 | gap 5 (884, 885) | yes | no; the unchanged "items of a rejected conflicted capture are read from its file" is what the code breaks (F1) |
| @@-891 error rows | gap 5 (894, 895) | yes | no |
| @@-927 AC-12.29 to 12.32 | gap 6 | yes | AC-12.32 against row 1252 (choice 4); the new ACs sit before AC-12.28 (🟢 order) |
| @@-1233 grammar and table | gaps 1, 2, 3, 4, 7, 8, 9, 12; Part B (1)-(9) | mostly. Gap 4: concept:1236 still says an `upheld` disposition "counts as `block`", while g4 says it rejects (🟢; g4 has "until SL-5"). Gap 7: the `idea.md` D-n rows not addressed (🟢). Gap 3: `verdict: (b)` or `verdict: b.` is not a block verdict (🟢) | 1236, as stated |
| @@-1528 O15 | gap 5 (1531) | yes | no |
| @@-1665 §11.3 item 3 | gap 11, Part C 1668 | yes | no |
| @@-2316 changelog | editorial | – | no |

## Findings
**🔴 F1 (code and concept): an objection id in a rejected conflicted capture passes the gate without a record.** Proposal: for a rejected conflicted capture, `validateCapture` returns as items every objection id on any line that is not a `> ` quote line or a disposition line; the index, `run.mjs object` and the gate then all demand those items; concept row 1252 states it.

CT-1, `checks/decision-check.test.mjs`, no extra import, not executed, expected red on the first variant (status 0, "decision-check OK"):
```js
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
```

**🟡 F2 (role text): a piped evidence command is a fifth field.** Proposal: add to the role file's Output section that ` | ` separates the four objection fields and appears inside no field.

CT-6a, `checks/devils-advocate-agent.test.mjs`, no extra import, not executed, expected red:
```js
test('rv56 F2: the role file says that " | " separates the objection fields and appears inside no field', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /` \| `[^.]*(?:inside|within|in) (?:a|any|no) field/i);
});
```

CT-6b, `checks/verdict-check.test.mjs`, no extra import, not executed, expected green (pins the reject):
```js
test('rv56 F2: an objection line whose evidence command contains " | " is read as five fields and rejects the capture', () => {
  const piped = 'objection: F-P1-1 | artefact: idea/idea.md | evidence: command: grep -n null idea/idea.md | wc -l | refuted when: the null option is costed';
  const r = validate({ objections: piped, verdict: 'verdict: b' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
});
```

**🟡 F3 (role text): step 8 invites an id in prose.** Proposal: reword step 8 to ask for "what the owner records, pointing to the objection lines above without an objection id".

CT-5, `checks/devils-advocate-agent.test.mjs`, no extra import, not executed, expected red:
```js
test('rv56 F3: step 8 of the role file asks for the owner records without an objection id in prose', () => {
  const step8 = TEXT.split('\n').find((l) => l.startsWith('8. '));
  assert.ok(step8, 'step 8 is missing');
  assert.match(step8, /without (?:an|any) objection id/i, step8);
});
```

**🟢 F4 (code): with two records on one item, the last one wins for a (c).** `unclearedItems` builds a Map, so the last record wins (`verdict-index.mjs:134`), while `recordOf` takes the first; against concept:1242. Only a `run.json` written outside `run.mjs` reaches it (`run.mjs` refuses a second record with `objection-recorded`). Proposal: build the Map from the first record per id.

CT-2, `checks/decision-check.test.mjs`, no extra import, not executed, expected red (status 0); only a run decides whether `readRun` accepts the duplicate:
```js
test('rv56 F4: a later record on the same item does not change the first one, so accept then reject leaves a (c) objection uncleared', () => {
  const at = '2026-01-01T12:00:00.000Z';
  const r = check(fixture({ captures: [capture({ verdict: 'c', objections: ['F-P1-1'] })], ownerRecords: [{ kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at }, { kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'reject', why: 'y', decider: 'owner', at }] }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /V-cap-1:F-P1-1 of verdict c has no run\.mjs object reject record/);
});
```

**🟢 F5 (code): a non-integer `ids.next.D` silently skips the D-n set** (`decision-check.mjs:82`). Proposal: a finding naming the malformed value.

CT-3, `checks/decision-check.test.mjs`, no extra import, not executed, expected red (status 0):
```js
test('rv56 F5: a run.json whose ids.next.D is not an integer does not pass the gate with the D-n set skipped', () => {
  const r = check(runWith({ decisions: { 'D-1': entry('decided') }, nextD: '4', captures: [capture()] }));
  assert.notEqual(r.status, 0, r.out);
});
```

**🟢 F6 (coverage of the 🟡-2 original input).** CT-4, `checks/verdict-check.test.mjs`, no extra import, not executed, expected green now; red under the old 🟡-2 rule:
```js
test('rv56 F6: an objection line that names another objection id rejects the capture even when that id has its own objection line', () => {
  const own = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const r = validate({ objections: `${OBJECTION.replace('the section is shown', 'F-P1-2 is refuted')}\n${own}`, verdict: 'verdict: b' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  assert.ok(r.reasons.some((x) => /carries the objection id F-P1-2 in the objection line of F-P1-1/.test(x)), r.reasons.join('; '));
});
```

Concept 🟢 items with no code test: concept:1236 against g4 on `upheld`; the AC row order; the first-word match for `verdict: (b)`; choices 1 and 2 need an owner line.

## Returned claims
Skill-lint exit 0 and the "3 older" and "8 other" mutation counts: unklar (no test runs allowed).

## Status
Block, on F1. The orchestrator executes CT-1 to CT-6 in a disposable copy. The fix for F1 also needs an owner ruling between "items from every id in the file" (concept:885) and `:capture` for a rejected conflicted (b)/(c) (AC-12.32).
