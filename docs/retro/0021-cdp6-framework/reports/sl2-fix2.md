# SL-2 second fix (impl-uc, stage-1 run 44): final answer as handed back

Brief: `briefs/sl2-fix2.md`. Worktree `<repo>/.worktrees/sl2`. The run stalled after the host outage of 2026-11-04 and was resumed with its context by the orchestrator; this is its final answer, copied from the handback with paths normalised to `<repo>`.

contract: v2 f91736a60d15

Outcome: all 8 items of sl2-fix2 are done in `<repo>/.worktrees/sl2` and the four gates pass (469 cdp6-core tests, 0 failing). Nothing was committed. Nothing outside `plugins/cdp6-core/` changed, and `skills/worker-contract/` was not touched.

Status after the host restart: `git status --short` showed all my changes intact. The restart came after item 8, not during item 4, so every item was already finished and no work was lost.

Evidence limits:
- Raw red outputs were not kept as files. I read each failing assertion message from the run as it happened, and the quotes below come from those runs. The scratchpad was cleared by the restart.
- Item 1 was shown red as a batch of 4 counter-tests plus the run.test tests, which is larger than one item, but all belong to item 1.
- Several of my own new tests were written after the production change. For those, red is shown by a stated mutation, which I then reverted; the mutated runs are listed per item.

**Counter-tests**
All were appended unchanged and were red on the starting tree, then green at the end:
- rv42 files `checks/decision-check.rv42.test.mjs` (3 tests) and `checks/verdict-check.rv42.test.mjs` (2 tests): new files, copied verbatim from `reports/sl2-fix-rv.md`.
- F-A, two tests, appended to `checks/verdict-check.test.mjs`.
- NV-1, appended to `checks/decision-check.test.mjs`.
- F-D, appended to `hooks/check-handback.test.mjs`.
- F-B, appended to `hooks/guard-phase.test.mjs`.
- F-E, appended to `lib/capture.test.mjs`.

Merged imports:
- F-B needed `createHash` from `node:crypto`. The file had no such import, so I added the line.
- F-E needed `initRun` from `./run-store.mjs` and `checkDecisions` from `../checks/decision-check.mjs`. Neither was imported, so I added both as new lines.
- No import duplicated an existing one, so none was merged.

Not unchanged: the auditor's F-C test, as the brief directs. In its place I wrote "a conflicted capture that lists no item fails the gate without a `<capture id>:conflict` record, passes after accept and does not count after reject" in `checks/decision-check.test.mjs`.

**Item 1: conflicted captures**
- Red batch, command `node --test checks/decision-check.rv42.test.mjs checks/decision-check.test.mjs`, exit 1, 5 failures. Failure messages:
  - rv42-1: "a rejected conflicted capture cannot be cleared by its object records: decision-check FAIL D-1: conflicted capture V-cap-1 lists no objection or premise to record"
  - rv42-2: "editing the target cured the conflict: decision-check OK"
  - NV-1: "decision-check OK" (0 !== 1)
  - my F-C replacement: the finding did not match `/D-1: conflicted capture V-cap-1 .*V-cap-1:conflict/`
  - The fifth failure was rv42-3, which belongs to item 4.
- Red for `run.test.mjs` (`node --test --test-name-pattern=conflict`, exit 1, 2 failures):
  - `object ...:conflict` returned `bad-objection-id` where `unknown-conflict` was expected (message "D-2-devils-advocate-a2:conflict").
  - The end-to-end exit-idea test failed because the stop output did not name `D-1-devils-advocate-agent-7:conflict`.
- Red for the new validator test (`verdict-check.test.mjs`): the rejected conflicted capture came back with `objections: []`, expected `['F-P1-1']`.
- Green: the same files pass, and 287 of 288 tests passed at that point (the one failure was rv42-3, which is item 4).
- Code:
  - `validateCapture` keeps usable, unique objection ids and the premise ids when the capture is conflicted, even if rejected.
  - `parseItem` knows `<id>:conflict`.
  - `hasItem` accepts it only for a conflicted index line with no item.
  - `decision-check` now loops over all captures for the conflicted check, so a stale conflicted capture still blocks.
  - The finding names `<id>:conflict`.
  - An owner `reject` on `:conflict` removes the capture from counting. If that leaves no counting capture, the gate says "the D-n needs another devils-advocate pass".
- Test changed because the item changes its assertion: in `decision-check.test.mjs`, "a conflicted capture keeps its decision open whatever its validator result", the finding regex moved from "lists no objection or premise to record" to "...and has no run.mjs object V-cap-1:conflict record".

**Item 2: capture form**
- Red on the starting tree: the two rv42 verdict tests, with `validator:"valid"` for the b-without-objection case on adversarial-auditor and for the two-verdict-lines case. Both F-A tests were red as well: premise row after a break gave `verdict:"a"`, and the list-marked objection under verdict b gave `validator:"valid"`.
- My new tests were written after the code, so red is shown by mutation, each run against `verdict-check.test.mjs` with exit 1 and then reverted: counter-role rules limited to devils-advocate, 3 red; objection-like check off, 2 red; premise-row-like check off, 2 red; second-verdict check off, 2 red.
- Green: `verdict-check.test.mjs` 28 of 28.
- Code: counter-roles all get the full form (verdict line and classes, the b/c rule with `artefact:` and `evidence:`, the `premises:` section, the not-decidable rule); fresh-context and `rejected alternative provided:` checks stay devils-advocate only; review roles get the conflict-of-interest check only; a line starting with `objection` in any letter case, after any list mark or whitespace, that is not a well-formed `objection:` line rejects the capture; a premise row outside the `premises:` block rejects it; a second `verdict:` line rejects it, also with the same value.
- Tests changed: "a header line twice with different values is rejected, twice with the same value is read once": the key `verdict` with the same value now expects `rejected` (item 2b). "roles other than the devils-advocate get the header checks only" was split into a review-roles test and a counter-roles test (item 2a); the old test took pessimistic-realist as header-only, which 2a overturns.

**Item 3: stale rule**
- Red: `isStale` for `{targets:[]}` and `{}` expected true but returned false (false !== true); the checker test for a target-less review-verify capture expected status 1 and got 0 (0 !== 1).
- Green: all of `checks/*.test.mjs` passed apart from rv42-3, which belongs to item 4.
- Mutation `isStale` returns false for no targets: 5 failures (verdict-check and decision-check tests), reverted.
- Tests changed: "fires: a devils-advocate capture of a decision with no target is stale, one without a decision or of another role is not", renamed to "any capture that names no target is stale", its two `false` assertions became `true`; "fires: stale target": `isStale({targets:[]})` and `isStale({})` now expect true; "the checker reports rejected and stale captures...": the last line, for target-less review-verify captures, now expects status 1 instead of 0.
- The now-unused `isDevilsAdvocate` import was removed from `verdict-check.mjs`.

**Item 4: gate re-read**
- Red: rv42-3 "an index id that is not the capture file name was counted: decision-check OK"; F-E "the gate passed D-1 on a capture that the rollback removed". My own two tests (id mismatch in the checker, lock behaviour) failed on the busy-lock case because captures were still returned.
- Green: all of `checks/`, `lib/`, `hooks/` and `scripts/` passed (462 of 462 at that point).
- Mutations, each reverted: id check removed, 2 failures (rv42-3 and my id test); lock removed, 2 failures (F-E and my lock test); wait raised to 3000 ms, my lock test failed on its "bounded wait" assertion.
- Code: `rereadCaptures` runs under `verdicts.lock` through `withLock` from `lib/run-store.mjs`, the module `capture.mjs` uses; the wait is bounded to 1000 ms; a busy or uncreatable lock returns no captures and a finding ("verdicts.lock: the capture lock is held by another writer..." or "...cannot be created..."); an index id that is not its file name without `.md` is a finding, and that line is not counted.
- Side effect: the F-E test makes the gate wait out the 1 s lock, so that test takes about 1 s.

**Item 5: deny once per cause**
- Red: F-D, "0 !== 2" (the handback was allowed instead of denied). My second test, covering form deny then ack deny, failed the same way.
- Green: `check-handback.test.mjs` 37 of 37.
- Mutation (form deny falls back to the shared cause): 3 failures, reverted.
- Code: the marker file now holds `{form:{asked,at}, other:{asked,at}}`.
- Test changed: in "fires: a handback whose spawn is closed with another message sha256 is denied once..." the `other` message had a body that also failed the capture form; with per-cause markers that gave two denies; changed to a form-valid body (`verdict: a-with-conditions`) so the test keeps its original intent and expected values.

**Item 6: deny a write to an open spawn's target**
- Red: F-B returned exit status 0 where 2 was expected; my two tests failed the same way.
- Green: `guard-phase.test.mjs` 18 of 18.
- Mutations, each reverted: ignore `closed_at`, 1 failure; drop the `notebook_path` field, 1 failure; resolve against the working directory instead of `R`, 2 failures.
- Code in `hooks/guard-phase.mjs`: Edit, Write and NotebookEdit are denied on a path equal to the `targets[].path` of an open `cdp6-core:devils-advocate` spawn, resolved against `found.R`, comparing both the plain and the real path; the deny reason names the spawn's task; other paths and closed spawns pass; a missing `counters.json` passes, a malformed one denies, but only for these three tools.

**Item 7: rollback test**
- The new test restores the first version: the append function throws a `CaptureError('capture-exists')` or a `CountersError('spawn-closed')` after chmodding the index to 0o400, and the test asserts that error's own code. It also checks the capture file is removed and the spawn stays open. The existing generic `capture-failed` test is kept.
- It was green before any production change, so red is shown by mutation, each reverted: rollback error escapes, 2 failures; the catch no longer rethrows the original error, 2 failures.

**Item 8: role file**
- Red: the test "the role file names no role outside the CDP6 set..." failed on `/psy-grenzwaechter/`.
- Fix: line 47 of `agents/devils-advocate.md` lost "; the counter-check there is psy-grenzwaechter"; the rest of the sentence stays. The test is green, 7 of 7.

**Files** (no line counts taken; all under `plugins/cdp6-core/`)
- New: `checks/decision-check.rv42.test.mjs`, `checks/verdict-check.rv42.test.mjs`.
- Changed: `checks/verdict-check.mjs`, `checks/verdict-check.test.mjs`, `checks/decision-check.mjs`, `checks/decision-check.test.mjs`, `checks/devils-advocate-agent.test.mjs`, `lib/verdict-index.mjs`, `lib/capture.test.mjs`, `hooks/check-handback.mjs`, `hooks/check-handback.test.mjs`, `hooks/guard-phase.mjs`, `hooks/guard-phase.test.mjs`, `scripts/run.mjs` (the error message only), `scripts/run.test.mjs`, `agents/devils-advocate.md`.

**Gates** (each from the worktree)
1. cdp6-core `node --test`: exit 0, `tests 469, pass 469, fail 0`.
2. CDP5 suite: exit 0, `tests 295, pass 295, fail 0`.
3. skill-lint on `plugins/cdp6-core`: exit 0.
4. secrets-scan on `plugins/cdp6-core`: exit 0, "65 files, 0 findings, 0 unreadable (skipped)".

**Choices between readings**
- Own error code: refusing `<id>:conflict` uses `unknown-conflict`, following the existing `unknown-<kind>` pattern (concept line 275).
- Void spawns: item 6 treats a `void` spawn like a closed one and does not block its target, following "a void spawn counts as no spawn" (concept line 878). The brief names only `closed_at`.
- Premise ids: a rejected conflicted capture keeps its premise ids too, not only its objection ids.
- Other counter-roles: they now carry objection and premise ids on their index lines. Only devils-advocate captures reach the gate.
- Objection-like pattern: `^[\s\-*+•>#\d.)]*objection\b` with the `i` flag. A line such as "Objection to the premise: ..." at column 0 now rejects the capture, the literal reading of the brief. "Objections:" does not match, because of the `\b`.
- Lock wait: the gate waits at most 1000 ms for `verdicts.lock`.
- Fresh-context check: it stays devils-advocate only for the other counter-roles. Item 2a does not list it, and contract rule 9 might call for it.

**Open questions and follow-ups**
- Concept line 893 still says "when the brief named code paths" (review F-8). [Orchestrator note: wrong; v0.5.8 changed line 893, see the ledger row of 2026-11-04T09:32:27+01:00.]
- `sl2-fix.md:7,87` numbers the counter-tests wrongly (review F-9); documentation, out of scope.
- A malformed `counters.json` now denies every Edit, Write and NotebookEdit call in an active run. Fail-closed matches `run.json` handling; confirm that is acceptable.
- Not done, as the brief says: the spawn-time target check (SL-3), a shell write to an open spawn's target (SL-4), `lib/handback.mjs` and the `SAFE_TASK` copy.
