# SL-2 third fix (impl-uc, stage-1 run 48): final answer as handed back

Brief: `briefs/sl2-fix3.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised. All paths below are under `plugins/cdp6-core/`.

contract: v2 f91736a60d15

Status: all six items are built test-first and all four gates exit 0 (cdp6-core 482/482, CDP5 295/295). Nothing was committed. Nothing was changed outside `plugins/cdp6-core/`, and nothing in `skills/worker-contract/` was touched. The `skills/idea/SKILL.md` modification and the untracked `worker-contract/` were already in the tree at the start. Each red run was a single-file `node --test <file>` run with exit 1; the quoted assertion messages come from the failing-test block of each run.

## Item 1: `:conflict reject` after `decided`
- Test: `scripts/run.test.mjs`, "fires: object <capture id>:conflict reject is refused once the D-n of the capture is decided, accepted before it, and accept after decided lets the gate pass". Review T1 was not added.
- Red: `node --test scripts/run.test.mjs`, exit 1, at the `refused.status !== 0` check after `decided`; message `{"id":"D-1-devils-advocate-agent-7:conflict","verdict":"reject"}` (the reject was accepted).
- Fix: `scripts/run.mjs` `cmdObject` refuses with the new code `conflict-reject-after-decision` when the item is `:conflict`, the verdict is `reject`, and the capture's `decision` is `decided` in `run.json`; the check runs inside the locked update too.
- Green: run.test.mjs 112/112, exit 0. Mutation: the decided condition replaced with `false` turns the item 1 test red.
- Choice: the refusal applies only while the status is `decided`; `proposed` and `superseded` are not refused. The D-n is read from the index line's `decision` field.

## Item 2: capture form
- Tests added: review T2, review T3, audit F-2 (verbatim), plus one own test covering a plural line anywhere, upper case, a space or a U+200B before the colon, `-- CHECKED` and a table row outside the premises block, and a missing `fresh context:` line for all four roles.
- Red: `node --test checks/verdict-check.test.mjs`, exit 1, 5 failing: the changed control at the old :369 (`AssertionError: cdp6-core:pessimistic-realist ... + 'valid' - 'rejected'`); T2 (`{"validator":"valid",...,"verdict":"b","objections":["F-P1-1"],...}`); T3 (the same `'valid'` versus `'rejected'` for `cdp6-core:pessimistic-realist`); F-2 (`numbered row after the section: {"validator":"valid",...}`); own test (`cdp6-core:devils-advocate: plural line ... + 'valid'`).
- Fix in `checks/verdict-check.mjs`: new `OBJECTION_MARKER = /objections?[\s\p{Cf}]*:/iu` rejects any non-well-formed line (the old line-start `OBJECTION_LIKE` rule stays, so `Objection to the premise: ...` and `Objections are listed above.` behave as before); new `PREMISE_MARK = /--\s*(?:un)?checked/i` outside the premises block replaces `PREMISE_ROW_LIKE`; the `fresh context: yes` check applies to every counter-role, so a missing line also invalidates.
- Green: verdict-check.test.mjs 34/34 at that point.
- Existing tests changed as the item requires: the assertion at the old :369 now expects `rejected`; the control at the old :408 lost its `objections: see the lines above` line, which is now rejected and pinned in the own test.
- Choice: the marker needs only `objection` or `objections` followed by optional space or invisible characters, then `:`; `see the objection: below` rejects.

## Item 3: target deny by file identity
- Tests: audit F-3 (verbatim; `linkSync` merged into the existing `node:fs` import line) and review T5. Review T4 not added; the fail-closed test already in the file stays.
- Red: `node --test hooks/guard-phase.test.mjs`, exit 1; F-3 `Expected values to be strictly equal: 0 !== 2` at `denied` (hard-link alias not denied). T5 was green on the starting tree, as stated.
- Fix: `hooks/guard-phase.mjs` adds `identity()` (`statSync` with bigint, `dev:ino`) and denies when a written path has the identity of an open devils-advocate target, besides the existing path comparison.
- Green: 20/20. Mutation: with `real()` reduced to `resolve()` and the identity check removed, both F-3 and T5 turn red.
- Not exercised: the letter-case branch of F-3 is skipped on this case-sensitive file system (the test emits a `t.diagnostic`); only the hard-link branch ran.

## Item 4: lock wait
- Tests: audit F-1 (verbatim; `symlinkSync` and `utimesSync` merged into the existing `node:fs` import line), review T7, and one own test in `lib/run-store.test.mjs` ("fires: withLock ends the wait at its deadline with lock-busy ...", a dangling link on `run.lock` and an old directory on `counters.lock` in a child process with a timeout; `withLock` added to the file's existing import).
- Red: F-1 `verdict-check did not end within 5 s 'SIGTERM' !== null`; own test `.../run.lock: withLock did not end within 3 s 'SIGTERM' !== null`; T7 green on the starting tree, as stated.
- Fix in `lib/run-store.mjs`: a failed `stat` or `unlink` falls through to the deadline check and the 5 ms sleep instead of `continue`; a successful stale-break still retries at once.
- Green: verdict-check.test.mjs and run-store.test.mjs 63/63. Mutation for T7: `GATE_WAIT_MS` raised to 3000 turns "fires: the gate default wait for verdicts.lock is bounded" red.

## Item 5: proposed `D-n` at the P1 exit
- Tests: "ignores a D-n that is not decided" in `checks/decision-check.test.mjs` is now "fires: a D-n still proposed fails the gate with a finding naming it, a superseded one does not" (its old `status 0` for `proposed` is what item 5 changes); new end-to-end test in `scripts/run.test.mjs`: D-2 proposed blocks `exit idea`, D-2 superseded passes.
- Red (unit): `AssertionError: decision-check OK ... 0 !== 1`.
- Fix: `checks/decision-check.mjs` adds the finding `D-n: still proposed, the exit needs it decided or superseded`.
- A first end-to-end draft superseded D-1, which fails `idea-check`; rewritten to use D-2.
- Mutation (proposed branch disabled): both tests turn red.

## Item 6: conflicted capture with items
- Test: `checks/decision-check.test.mjs`, "fires: records on all items of a conflicted capture clear only its conflict block, and the capture then counts by its verdict": verdict `a` passes with records on all items; a missing premise record fails; verdict `b` without the objection record fails and passes with all records; verdict `c` with `accept` records fails, naming the missing `reject`; verdict `c` with `reject` records passes (the `c` case added beyond the brief, as the case that tells the two blocks apart).
- Green before any change. Mutations: excluding conflicted captures from `fresh` turned it red with two older tests; skipping the blocking-verdict branch for conflicted captures turned only this test red.
- Limit: the `b` case cannot be separated from the conflict block, since a `b` capture's objection items are a subset of the conflict-block items.

## Counter-tests
T2, T3, F-1, F-2, F-3: red on the start tree, green at the end. T5, T6, T7: green on the start tree and at the end. T6 is the new file `lib/temp-dir-helper.test.mjs`; mutation: `drop(perTest)` in the `afterEach` of `test-support/temp-dir.mjs` replaced with `perTest.clear()` turned it red. Mutated files restored from backups and diffed. Not added: T1 (item 1 replaces it), T4 (item 3 keeps fail-closed). No import line duplicated; `symlinkSync`, `utimesSync` and `linkSync` merged into the existing `node:fs` lines; in `guard-phase.test.mjs`, `symlinkSync` and `existsSync` were already imported.

## Files (lines after the change)
Production: `checks/verdict-check.mjs` 258, `checks/decision-check.mjs` 83, `hooks/guard-phase.mjs` 130, `lib/run-store.mjs` 363, `scripts/run.mjs` 672. Tests: `checks/verdict-check.test.mjs` 615, `checks/decision-check.test.mjs` 359, `hooks/guard-phase.test.mjs` 324, `lib/run-store.test.mjs` 375, `scripts/run.test.mjs` 1800. New: `lib/temp-dir-helper.test.mjs` 28. Test count 469 to 482.

## Gates
1. cdp6-core with `TMPDIR` at an empty scratchpad directory: exit 0, 482/482; the directory empty afterwards. 2. CDP5 suite: exit 0, 295/295. 3. skill-lint: exit 0 (X4 informational on `scripts/run.test.mjs` line 208). 4. secrets-scan: exit 0, "67 files, 0 findings, 0 unreadable (skipped)".

## Open questions and follow-ups
- Letter-case branch of F-3 not exercised; it needs a run on a case-insensitive file system.
- Earlier runs left about 1700 `cdp6-*` directories in `/tmp` with the default `TMPDIR`; the one `cdp6-helper-box-*` directory the T6 mutation leaked was deleted.
- Residual after item 3: creating a link on an open target is not covered by the identity check; that is the SL-4 and §11.3 item 3 hand-check gap, out of scope.
