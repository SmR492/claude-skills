# SL-2 build of the gate decision table and line grammar (impl-uc, stage-1 run 55): final answer as handed back

Brief: `briefs/sl2-build-table.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15

Status: all five items are built test-first in `<repo>/.worktrees/sl2` (base 960146b, uncommitted diff, no commit). All four gate commands exit 0. Not done: the starting-tree red run for the replaced run 52 🟡-2 test (see "Not run" below).

Reds are the failing assertion messages from each run, run as batches of one item, with the six g tests as the item 1 batch. Every file changed is under plugins/cdp6-core/. Nothing under skills/worker-contract/ was touched.

Item 1, line grammar (AC-12.29), six tests "fires: line grammar g1 to g6 of §5.3 (g1)" to "(g6)" in checks/verdict-check.test.mjs
- Red run: `node --test plugins/cdp6-core/checks/verdict-check.test.mjs`, exit 1, 5 of the 6 failed: g1 "NFKC reads a full-width b"; g2 "...no refuted when verdict: a: {"validator":"valid"..."; g4 "...disposition: D-1-devils-advocate-agent-7:F-P1-1 resolved idea/idea.md:3 - the null option is costed: {"validator":"rejected","reasons":["line 10 carries the objection id F-P1-1 outside an objection line"]..."; g5 "> Assignment, verbatim: "Close F-P3-2 of the previous run.": {"validator":"rejected"..."; g6 ""Ｆ-P1-2": {"validator":"valid"...".
- g3 was green before any production change. Mutation: `premiseRows` also continued over blank lines; failing titles "...(g3) the premises section ends at the first line that does not start with "- "" and "fires: a list-marked, indented, differently cased or unspaced spelling of an objection line..."; reverted.
- Green: same command, 51/51 after the counter-tests were added, exit 0.
- Production: `lib/verdict-index.mjs` has new `normalizeCapture` (Cf removal, NFKC, Pd and U+2212 mapped to `-`) and `DISPOSITION`; `checks/verdict-check.mjs` has a four-field check, a second-id check in the objection line, disposition parsing with `upheld` rejecting, and `> ` lines skipped.
- Changed assertions, both required by this item: `verdict-check.test.mjs:68` (g2): an objection line without `artefact:` under `verdict: a` was `valid`, now `rejected`; in the test at `:391` (g5) the `'> objection: F-P1-1 | artefact: x'` case left the reject list.
- Renamed titles: `:391` now "fires: a list-marked, indented, differently cased or unspaced spelling of an objection line is prose with an objection id and rejects, as do a premise row outside the premises section and a second verdict line"; `:571` now "fires: an objection id in prose after the word objection in any form and letter case, and a premise mark outside the premises section in any letter case, reject the capture of every counter-role, prose without an id is valid, and a missing fresh context line invalidates it".
- Counter-tests appended: run 52 🟢-4 unchanged; run 52 🟡-2 replaced as the brief asked (both smuggled forms reject, the same objection on its own line is valid); run 53 A3, A4 and A5 unchanged, except that the `—` in A4 is written as the escape `\u2014` (the string is identical).

Item 2, capture rows (AC-12.30), four tests "fires: gate decision table capture rows (a)", "(b) and (c)", "(conflicted)" and "(rejected)" in checks/decision-check.test.mjs
- Red run: `node --test checks/decision-check.test.mjs`, exit 1, 2 failed: "(b) and (c)": "b stale: decision-check OK" (status 0, expected 1); "(rejected)": ""verdict: b" : decision-check OK".
- (a) and (conflicted) green before any change. Mutations, reverted: `const live = all;` failed "(a)", "(b) and (c)", "(conflicted)" and 3 older tests; disabling `conflicted` findings failed "(conflicted)" and 8 other tests.
- Production: `checks/decision-check.mjs` rewritten around `captureFindings` and `blockingFindings`: every capture stamped before the decided stamp that is (b) or (c), conflicted, or rejected with a verdict (b) or (c) blocks whether live or stale; only the pass is chosen among live valid captures. `verdict-check.mjs` sets `rejectedBlock` on each re-read capture through `hasBlockVerdictLine` from `verdict-index.mjs` (a line starting `verdict:` in any case whose first word is `b` or `c`, after normalisation).
- Four older assertions changed, because the row "(b)/(c) live or stale blocks" requires it; each was a stale (b) or (c) that used to pass and now needs its record, each with a "records clear it" counterpart: "a devils-advocate capture of a decision with no target is stale..." (the `worse` case); "a stale target is dropped before the latest capture is picked, a stale block still needs its records" (retitled; the `kept` case); "a live earlier block still needs its owner records..." (the `stale` case); "a superseded D-n with a live block or conflicted capture..." (the `stale` case).
- Counter-tests appended unchanged: run 52 🟡-3, run 53 A1 and A2.
- Green: decision-check tests plus rv42, 47/47.

Item 3, status rows and D-n set (AC-12.31), three tests "fires: gate decision table status rows and D-n set (...)" in checks/decision-check.test.mjs
- Red run: exit 1, 3 failed: status test ""vetoed": decision-check OK"; D-n set test "decision-check OK"; A6 the same status failure.
- The ".md does not re-read" test was green before. Mutation: the sha256 comparison in `readCaptures` disabled; failing titles "...(an index line whose .md does not re-read fails the gate)" and "fires: the gate re-reads the capture file, it must match the index line by sha256..."; reverted.
- Production: `checkDecisions` handles `ids.next.D` and adds `D-n: allocated below ids.next.D (N) without an entry in run.json` and `D-n: status <s|none> is not proposed, decided or superseded`.
- Counter-test appended unchanged: run 53 A6.

Item 4, `<capture id>:capture` (AC-12.32), two tests in scripts/run.test.mjs: "fires: object <capture id>:capture is accepted only for a rejected, not conflicted devils-advocate capture of the run with a verdict (b) or (c), and is refused otherwise with its own code" and "fires: object <capture id>:capture clears the block of a rejected capture in the gate of exit idea, and either verdict clears it".
- Red run: exit 1, 2 failed: the first "AssertionError: D-1-devils-advocate-agent-3" (code `bad-objection-id`, not `unknown-capture`); the second at the `object ... :capture` status assertion.
- Production: `parseItem` and `hasItem(index, id, S)` in `lib/verdict-index.mjs` accept the new kind; `scripts/run.mjs` passes `S` and extends the usage message. Refusal code `unknown-capture`, for an unknown capture id and an ineligible capture (tested: a valid capture, a conflicted one, a rejected one without (b) or (c), `b-ish`, a non-devils-advocate role).
- Green: 523/523 in the full gate.

Item 5, texts
- Tests: "fires: the role file states the line grammar causes of concept §5.3 (g2 to g6)" in `devils-advocate-agent.test.mjs` (red "the four-field objection line is not stated"); "fires: the idea skill names the four owner record forms of concept §5.3" in `idea-skill.test.mjs` (red "<capture id>:F-P1-<n>"); run 53 A7 unchanged (red "The input was expected to not match the regular expression /run\.mjs object <objection-id>/").
- `agents/devils-advocate.md` Output states every cause of item 5; `skills/idea/SKILL.md` step 5.2 names the four `run.mjs object` forms. Green: checks/ 137/137, skill-lint exit 0.

Files changed (`wc -l` totals, including earlier SL-2 work): `checks/decision-check.mjs` 119, `checks/verdict-check.mjs` 273, `lib/verdict-index.mjs` 136, `scripts/run.mjs` 672, `agents/devils-advocate.md` 74, `skills/idea/SKILL.md` 63, `checks/decision-check.test.mjs` 683, `checks/verdict-check.test.mjs` 810, `checks/idea-skill.test.mjs` 159, `checks/devils-advocate-agent.test.mjs` 108, `scripts/run.test.mjs` 1851. No new file; no import added or merged; `lib/capture-fixture.mjs` unchanged.

Gates (final tree): 1. cdp6-core: exit 0, tests 523, pass 523, fail 0. 2. CDP5 suite: exit 0, 295/295. 3. skill-lint: exit 0, "2 skills, 1 agents, 0 🔴 0 🟡 2 🟢". 4. secrets-scan: exit 0, "67 files, 0 findings".

Counter-tests: all ten present and green in the final tree (run 52 🟡-3, 🟢-4, 🟡-2 replaced; run 53 A1 to A7). Not run: none of them on the starting tree by the worker; the red evidence is the orchestrator's file, including for the replaced 🟡-2 test.

Choices between readings:
1. §5.3 g4: the form is `<item> (resolved <ref> | upheld | withdrawn <ref>) - <why>`, `— <why>` required for all three (after normalisation `—` becomes `-`); items are `F-P[1-8]-n` or `<capture id>:F-P…|premise-n|conflict`, never `:capture`; a premise mark in a disposition line rejects.
2. g1 and g6: header lines are not prose, but an objection id in one still rejects (as before; covered by "(g1)").
3. g2: the four fields are split on ` | `, so a condition containing ` | ` is a fifth field and rejects; the own id repeated in the tail is allowed.
4. Row "conflicted, rejected" ("after clearing, as the matching rejected row below") read as item records only: the capture never counts and needs no `:capture` record (AC-12.32 refuses `:capture` for a conflicted capture), which avoids a deadlock.
5. `run.mjs` decides "rejected, not conflicted" from the index line's `validator` and `conflicted` fields and the capture file's text; the gate re-validates from the file.
6. The superseded path still throws `snapshot-missing` when a capture has targets and no snapshot is given, although staleness no longer matters there.
7. D-n set: entries at or above `ids.next.D` are still processed.

Open questions and follow-ups (not changed): `lib/capture-fixture.mjs` writes a rejected capture's `verdict: a\n` placeholder when no `text` is given, so rejected-(b)/(c) tests must pass `text`; the out-of-scope items stay open; the Write tool turned `\u` escapes into literal characters, which were converted back to escapes in all appended test code; no throwaway prototype; scratch chunks in the scratchpad, outside the worktree.
