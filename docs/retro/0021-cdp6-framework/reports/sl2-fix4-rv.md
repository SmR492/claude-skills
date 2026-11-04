# review-verify of the SL-2 fourth fix and concept v0.5.10 (stage-1 run 52): final answer as handed back

Brief: `briefs/sl2-fix4-rv.md`. Returned through workflow wf_d12252a5-3f5; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes (I had no part in the fourth fix, the fix brief or concept v0.5.10)

Outcome: block. Claims 2, 4 and 5 hold, claim 3 holds by reading, and claims 1 and 6 are widerlegt in one point each. The code accepts any line starting `objection: <token>` as an objection line, so a second objection id can sit unrecorded in the tail of an objection line. The new id rule also contradicts two unchanged concept lines that require `disposition:` lines carrying `F-Pk-n` ids.

Target state:
- Worktree: `git -C …/.worktrees/sl2 rev-parse HEAD` gives `960146b3f8e5884a4a9f93f1077e793cedd6e14a`, which equals the brief's base.
- Concept: `sha256sum docs/cdp6/konzept-cdp6.md` gives `da61f9cbe270b00db79953beac77459719ce28ef5eaccfd5d4a68979b100f55f`, which equals the brief's hash.
- Fourth fix: `diff -r --brief` of sl2-pre-fix4 against sl2/plugins/cdp6-core lists 12 changed files.

Verdict mapping: bestätigt and bestätigt + ergänzt map to pass, widerlegt maps to block, unklar carries no verdict.

## Part A

| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1 | Are items 1–5 built, each with its test, and does each test assert its item and concept line? | **widerlegt in one point** (item 1); bestätigt for items 2–5 | Item 1: `verdict-check.mjs:56` removes Cf characters. `:84-87` rejects a stray id via `OBJECTION_ID_ANYWHERE` (`lib/verdict-index.mjs:9`). `:88` applies the premise-mark check on every line, objection lines included. `:73` rejects a second verdict line. The spelling list is gone (grep for `OBJECTION_LIKE\|OBJECTION_MARKER` finds only two stale test titles). The failing point: `:76` treats every `^objection: (\S+)(.*)$` line as an objection line. The four-field form of concept 1233 is never checked; `artefact`/`evidence` are checked only under b or c (`:81-83`). Item 2: `agents/devils-advocate.md:52`, tests `devils-advocate-agent.test.mjs:82, :89`. Item 3: `run-argv.mjs:156`, `decision-check.mjs:32-38, :79-82`, proposed-finding text at `:76`, tests `decision-check.test.mjs:378, :396, :413`, `run-argv.test.mjs:155`. Item 4: `decision-check.mjs:58`, tests `:419, :427`. Item 5: `guard-phase.mjs:60, :98`, test `guard-phase.test.mjs:289` (Write, Edit and NotebookEdit denied, Read silent). |
| 2 | Are the listed counter-tests in the tree verbatim, are F5/F6 absent, and do the F1/F4 replacements assert what the brief says? | **bestätigt** | `sed -n <range>p <report> \| grep -cFxvf <tree test file>` gives 0 missing lines for 🟡-1, 🟢-3, 🟡-2, 🟢-5, F2 (both tests) and F3. For 🟢-4 the only missing line is the closing code fence. `copyFileSync` is merged into the `node:fs` import at `guard-phase.test.mjs:3`. Positive control: the same grep reports the F1 title as missing. F5/F6: `grep -rnc "auditor F5\|auditor F6"` gives 0 in every test file, and a content grep for "keeps its target write-locked" and "judged a lock stale" finds nothing; control: "auditor F2" is found in decision-check.test and run-argv.test. F1 replacement (`verdict-check.test.mjs:637`): the three lines with `F-P1-2` must be rejected, the same lines without an id must be valid with objections `['F-P1-1']`. F4 replacement (`:657`): asserts `valid`. |
| 3 | Would each mutation the report names turn the named test red? | **bestätigt** by reading for the pin tests; **unklar (Werkzeug)** for two extra titles | Mutation `` return `${st.dev}`; `` at `guard-phase.mjs:38`: every existing file on the device gets the same identity, so the Write to `other.md` is denied and `silent()` at `guard-phase.test.mjs:329` fails. Mutation `if (true) throw` at `run-store.mjs:84`: lock-busy is thrown before the deadline, so `waited >= 300` in the 🟢-5 test fails. Whether "fires: concurrent writers" (`run-store.test.mjs:45`) and "duplicate id under concurrency" (`:64`) also fail depends on timing; only a run decides. |
| 4 | Was any assertion weakened, removed or skipped? | **bestätigt** (every change is required by its item) | Test at `verdict-check.test.mjs:391`: needle `/starts like an objection/` became `/objection id F-P1-1 outside/` (narrower); `'Objection to the premise…'` moved from the reject list to an assertion that it is valid; the `fine` regex was retargeted. All of this is required by item 1 (prose carries no objection). Test at `:570`: four prose rejects became four rejects that carry an id, plus a bare-id case, plus a loop asserting the four prose spellings are valid (item 1). `guard-phase.test.mjs:287`: the missing-file case changed from `silent` to `denied` for three tools (item 5). The two fixtures at `:92` and `:102` gained a `counters.json` without any assertion change (needed because of item 5). Every other hunk only adds lines. |
| 5 | Do the worker's choices stay inside the brief and the cited concept lines? | **bestätigt + ergänzt** | The five declared choices each have a reading of 1233, of the 155 `D-n` row, or of 271. Ergänzt: one undeclared reading, carried over from the earlier tree, is that "well-formed objection line" means "starts with `objection: <token>`". That reading enables finding 🟡-2. A second undeclared choice is that `settleSuperseded` judges conflicted captures only when live (`decision-check.mjs:34-35`); this follows the 155 row but not C13 at line 1373 (finding 🟡-3). |
| 6a | Is every objection id outside a well-formed objection line rejected, whatever its markup, Unicode form or position? | **widerlegt** | A second id in the tail of an `objection:` line is not rejected and is not recorded (`:76` and `:80` push only `o[1]`); see 🟡-2. Ids written with non-Cf variants are not rejected: fullwidth `Ｆ`, U+2011, U+2212, fullwidth digits (the regex at `verdict-index.mjs:9` is ASCII-only, `\d` without the `u` flag). Cf-split ids are caught (`:56`). |
| 6b | Is no capture rejected that carries no stray id and no stray premise mark, and is any unavoidable false reject a finding? | **bestätigt + ergänzt** | Rejection only adds the id and premise-mark causes (`:84-90`). Ergänzt: the concept itself requires stray ids in two places. `disposition: <item> …` with `<item>` an `F-Pk-n` is required at concept 1231 and 1373. The role file requires a verbatim assignment quote (`devils-advocate.md:13, :24, :42`), which rejects whenever the assignment contains an id. Both are false rejects the role cannot avoid (🟡-1). |
| 6c | Can item 3 be passed by any route that leaves a superseded `D-n` with a live unrecorded block? | **bestätigt + ergänzt** | `run.mjs:448, :454` allow only the three statuses, with exact match, and `superseded` is an owner command (`run-argv.mjs:156`). Captures with targets but no snapshot throw `snapshot-missing` (exit 2). There is no time bound. A validator-rejected capture has `verdict: null` (`verdict-check.mjs:110`), so it is not a block. Ergänzt: a *stale* conflicted capture on a superseded `D-n` passes, while C13 at 1373 says "a `stale` conflicted capture still blocks" and the decided path does block it (`decision-check.mjs:45` runs over `all`). See 🟡-3. |

## Part B: concept-v059-v0510.diff, 12 hunks

| Hunk | Supported by the sources? | Contradicts an unchanged line? |
|---|---|---|
| @@-1 version | yes, owner row 10:27:26 | no |
| @@-22 item 16 | yes, owner row | yes, inside the same line: it still ends "and is 52 since item 26" (line 25). 🟢-5 |
| @@-34 item 28 | yes, owner row and synthesis row | no |
| @@-151 `D-n` row | yes, synthesis row (F2) | yes: "live … conflicted" contradicts C13 line 1373 ("a `stale` conflicted capture still blocks"). 🟡-3 |
| @@-249 Exit | yes, run 49 🟢-6 and owner row | no |
| @@-267 UC-01 steps 3 and 5.2 | yes, 🟢-6 and F3 | no; consistent with UC-03 3.2 (line 396) |
| @@-918 AC-12.21 | yes, 🟢-6; the title exists at `scripts/run.test.mjs:1769` | no |
| @@-1229 capture form | yes, owner decision (2) and synthesis | yes: line 1231 (disposition lines with `F-Pk-n`) and line 1373 (a clearing capture's `disposition:` line per conflicted item); also role file `:13`/`:24`. 🟡-1 |
| @@-1648 budget and checkpoint | yes (cap 56, threshold 46) | yes, inside the same lines: the checkpoint still says "42 = 52 − (2 + 8) now" (1656), and "P(overrun) about 0.24" is now attached to cap 56, while item 16 says cap 56 "has no new forecast". 🟢-5 |
| @@-1666 stop table | yes | no |
| @@-1737 CH-29 | yes (cap 56) | yes, inside the same row: "above 42 (cap − (2 + 8)) after SL-2" (1741), and 0.24 attached to cap 56. 🟢-5 |
| @@-2292 changelog | yes | no |

## Findings

**🔴** none.

**🟡-1 (concept): the id rule contradicts two unchanged requirements to write ids outside objection lines.**
- Concept 1231 makes a return-cycle counter-role pass require `disposition: <F-Pk-n> …`, and 1373 makes a clearing capture require one per conflicted item. Under 1233 both captures are rejected whether or not they carry the line, which deadlocks return cycles once disposition lines are built (grep for `disposition` in cdp6-core finds nothing yet).
- The role file's verbatim assignment quote (`devils-advocate.md:13, :24`) is rejected whenever the assignment contains an id. That is reachable in SL-2 already; the trigger is, for example, a loop-back assignment.
- Closing proposal: an owner ruling that amends 1233 to exempt well-formed `disposition:` lines and to define how a verbatim quote carries ids. No code test until that ruling.

**🟡-2 (code, item 1): an objection line is not checked for well-formedness, so an id in its tail escapes the records.**
- Closing proposal: an objection line must match the four-field form of 1233. An id in its tail counts only when that id has its own objection line; otherwise the capture is rejected (owner ruling on the second part).
- File `checks/verdict-check.test.mjs`, no extra import. **Not executed.** Expected: red at the first assertion (`validator: 'valid'`, `objections: ['F-P1-1']`). The second assertion is green now.
```js
test('review fix-4: an objection id in the tail of an objection line counts only when that id has its own objection line', () => {
  const smuggled = 'objection: F-P1-1 | artefact: idea/idea.md | evidence: idea/idea.md:12 | refuted when: shown; objection F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20';
  const r = validate({ objections: smuggled, verdict: 'verdict: b' });
  assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), JSON.stringify(r));
  const own = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const cited = validate({ objections: `${OBJECTION.replace('the section is shown', 'F-P1-2 is refuted')}\n${own}`, verdict: 'verdict: b' });
  assert.equal(cited.validator, 'valid', JSON.stringify(cited));
});
```

**🟡-3 (concept or code, item 3): a stale conflicted capture on a superseded `D-n` needs no record.**
- This matches the 155 row ("live") but contradicts C13 at 1373 and the decided path (`decision-check.mjs:45`).
- Closing proposal: an owner ruling. Then either `settleSuperseded` calls `conflictFindings(id, all, records)`, or 1373 is narrowed.
- File `checks/decision-check.test.mjs`, no extra import. **Not executed.** Expected: red at the first assertion (status 0, "decision-check OK").
```js
test('review fix-4: a stale conflicted capture on a superseded D-n still needs its owner record, as on a decided one', () => {
  const stale = capture({ id: 'V-cap-2', task: 'D-2', decision: 'D-2', verdict: 'a', conflicted: true, targets: [old], stamp: T2 });
  const r = check(supersededFixture({ captures: [capture(), stale] }));
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /D-2: conflicted capture V-cap-2/);
  const cleared = check(supersededFixture({ captures: [capture(), stale], ownerRecords: [{ kind: 'object', id: 'V-cap-2:conflict', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(cleared.status, 0, cleared.out);
});
```

**🟢-4 (code): ids written with non-Cf Unicode variants pass as prose.**
- This conforms to 1233, which names only Cf; the effect equals id-free prose.
- Closing proposal: an owner ruling. If taken: apply NFKC, map `\p{Pd}` and U+2212 to `-`, then check for ids.
- File `checks/verdict-check.test.mjs`, no extra import. **Not executed.** Expected: red, `validator: 'valid'` for every form.
```js
test('review fix-4: an objection id in a compatibility or dash-variant form outside an objection line rejects the capture', () => {
  for (const id of ['\uFF26-P1-2', 'F\u2011P1\u20112', 'F-P1-\uFF12', 'F\u2212P1\u22122']) {
    const r = validate({ objections: `${OBJECTION}\nsee ${id} below`, verdict: 'verdict: b' });
    assert.equal(r.validator, 'rejected', `${JSON.stringify(id)}: ${JSON.stringify(r)}`);
  }
});
```

**🟢-5 (concept): stale cap figures in the hunks changed for v0.5.10.** Lines 25, 1652, 1656 and 1741, as listed in part B. Closing proposal: in a v0.5.11 wording pass, write "is 56 since item 28", "46 = 56 − (2 + 8) now" and "above 46", and attach 0.24 to cap 52. No test.

**🟢-6 (code polish): two test titles no longer match what they assert.** The titles at `verdict-check.test.mjs:391` and `:571` still describe the spelling rule. Closing proposal: rename them. This is no behavioural claim, so no counter-test.

Follow-up note, not a change: `devils-advocate.md:61` asks the role to state "what the owner has to record per objection", which invites ids in prose (the role can avoid it because of `:52`).

## Status

Block (claims 1 and 6 widerlegt in one point each). None of the counter-tests above was executed; the orchestrator runs them.

## Returned claims

- Claim 3, the extra titles "fires: concurrent writers" and "duplicate id under concurrency" under the run-store mutation: unklar (Werkzeug, no run grant). Only a run decides.

## Commands run (all read-only)

- Read: the brief, `briefs/sl2-fix4.md`, `reports/sl2-fix4.md`, and the concept diff (lines 13–80).
- `git rev-parse HEAD` on the sl2 worktree.
- `sha256sum` of the concept.
- `diff -r --brief` of the two trees.
- `diff -u` on these files: `verdict-check.mjs`, `decision-check.mjs`, `run-argv.mjs`, `guard-phase.mjs`, `devils-advocate.md`, and the five test files.
- `cat -n`: `verdict-check.mjs`, `verdict-index.mjs`, `decision-check.mjs`, `devils-advocate.md`.
- `sed -n`:
  - `run-argv.mjs` 1–183
  - `run.mjs` 280–298 and 400–490
  - `guard-phase.mjs` 30–100
  - `run-store.mjs` 55–100
  - `counters.mjs` 14–40 and 90–110
  - `verdict-index.test.mjs` 78–96
  - `verdict-check.test.mjs` 12–62
  - `decision-check.test.mjs` 1–70
  - concept 150–160, 268–280, 394–398 and 1228–1236
  - the diff file 81–125
  - `sl2-fix3-rv.md` 50–140
  - `sl2-fix3-auditor.md` 28–121
- `git diff --stat` on the concept.
- `grep -n` / `-rn` / `-rnc` / `-rln` / `-cFxvf` / `-nFxvf` as cited in the table, including the ledger rows 232–236 and concept line 1373. One grep was refused by the shell guard (backticks) and re-run without them.
