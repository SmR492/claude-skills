# SL-2 combined fix (impl-uc, stage-1 run 41): final answer as handed back

Brief: `briefs/sl2-fix.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised to `<repo>`.

contract: v2 f91736a60d15

Outcome: all 12 items are done in the worktree and all four gates are green. The three decision-check counter-tests were added unchanged and end green, but two of them (1 and 2 in the list under "Counter-tests") cannot isolate their own fix, as explained below. Nothing was committed and no file outside `plugins/cdp6-core/` was touched.

Worktree: `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a plus the uncommitted T1 to T3 diff. Concept v0.5.7 was the specification. Status: done, no open blocker.

Red/green per item. All reds are quoted from the run output, abbreviated here. Where the first run failed on a missing module or option, I added an empty scaffold first and the red below is the behavioural one.

1. `lib/verdict-index.mjs`
   - Tests: new `lib/verdict-index.test.mjs`, 7 tests.
   - Red, scaffold of empty exports: 7 of 7 fail, for example `actual: [] expected: ['a','a-with-conditions','b','c','not-decidable']`. The duplicate-scan test lists the old copies: `lib/capture.mjs: /index\.jsonl/`, `checks/decision-check.mjs: /'a-with-conditions'/`, `checks/verdict-check.mjs: /F-P\[1-8\]/`, `scripts/run.mjs: /:premise-/` and others.
   - Green: after the implementation, 6 of 7 pass, so the reader, item ids, classes and `unclearedItems` work. The scan test passed after `capture.mjs`, `verdict-check.mjs`, `decision-check.mjs` and `run.mjs` were switched over. I later narrowed its identifier patterns from `PASSING` and `BLOCKING` to `new Set(['b'`, because the consumers now import those names.
   - `isDevilsAdvocate` now uses `agentName(...) === 'devils-advocate'`. This is stricter than the old `endsWith(':devils-advocate')`, which also accepted `cdp5-agents:`.
   - `capture.test.mjs` now imports `readIndex` from `verdict-index.mjs`, and its `readIndex` test moved there.

2. F3, objection records scoped by capture id
   - Tests: `scripts/run.test.mjs` "records owner objection" and the new "a bare objection id is refused and an objection id names an item on an index line of the run". The premise tests and A4 were updated to the scoped form. In `checks/decision-check.test.mjs`: "an objection is cleared only by a record scoped by its own capture id, never by a bare id or the id of another capture".
   - Red in run.mjs: `{"error":"bad-objection-id","message":"objection id must look like F-P1-1 or <capture id>:premise-1"}`. 5 tests fail.
   - Red in decision-check: `F-P1-1: decision-check OK` (the bare record cleared the objection).
   - Green: `run.test.mjs` 109/109, `decision-check.test.mjs` all pass.
   - Mutation: matching records on the local id (`split(':').pop()`) makes exactly the scoped test fail; reverted.
   - Counter-test 2 ("objection id of another decision cleared by its owner record") is green after this item.

3. F1, devils-advocate capture with a `decision` and no `target:` is stale
   - Tests: "a devils-advocate capture of a decision with no target is stale, with or without a snapshot argument" in decision-check; "...is stale, one without a decision or of another role is not" in verdict-check. The `capture` helper now carries a target by default.
   - Red: `decision-check OK` and `verdict-check OK`.
   - Green after the `isStale` change in `verdict-check.mjs`.
   - Mutation: `isStale` returning false for no targets makes 4 tests fail, including counter-test 1; reverted.

4. F4, the gate re-reads the `.md` files
   - Tests: decision-check "the gate re-reads the capture file, it must match the index line by sha256 and the verdict fields come from the file" and "an index line without its capture file and a capture file without its index line are findings". verdict-check: "the checker reports an index line without its capture file, a changed capture file and a capture file without an index line".
   - Red: `decision-check OK` for all three, including the unchanged counter-test 3: `index verdict a counted while the capture file says b: decision-check OK`.
   - Green: after `rereadCaptures` in `verdict-check.mjs` (sha256 match, verdict fields from `validateCapture` on the file, missing `.md`, orphan `.md`, unusable file name). `decision-check` uses it, and `verdict-check`'s `checkCaptures` too.
   - Mutation: skipping the orphan check made 2 tests fail; skipping the sha compare made 1 fail; both reverted.
   - Fixture change: I added `lib/capture-fixture.mjs` (38 lines, a test helper, not shipped logic). It writes a backing `.md` and the index for a fixture line. The decision-check, verdict-check and run.test fixtures now use it.

5. A `conflicted` capture keeps its decision open whatever its validator result
   - Test: "a conflicted capture keeps its decision open whatever its validator result".
   - Red: `decision-check OK` for the rejected-and-conflicted capture.
   - Green after the restructure (`settle()` in `decision-check.mjs`): the conflicted loop runs over fresh captures stamped before `decided`, before the rejected filter.

6. Capture form
   - Tests: "a block verdict needs at least one objection, each with an artefact and an evidence of the form file:line or command" and "psy-grenzwaechter is not a CDP6 role".
   - Red: `AssertionError: b` (validator was not `rejected`), and `not-checked` expected.
   - Green: `TRIAD_ROLES` no longer has `psy-grenzwaechter`. `devils-advocate` b or c needs at least one objection, each with `artefact:` and `evidence:`.
   - I also updated `agents/devils-advocate.md` line 59 to say this; the brief did not list it.

7. Deny once on a failing capture form
   - Tests: "a handback that fails the capture form is denied once with the reasons, the second failing handback is captured with validator rejected, verdict null and the reasons" and "a handback that restates a valid capture form after the deny is captured valid". The old test "a handback that fails the verdict form is not denied" was replaced.
   - Red: status 0 where 2 was expected (not denied).
   - Green after the change in `check-handback.mjs`.

8. `reconciliation: not built`
   - Assertions were added to the existing exit tests for checker-missing, failed and passed.
   - Red: 3 tests fail with `Expected values to be strictly equal`.
   - Green after `RECONCILIATION = 'not built'` was added to all three `p.gate` writes in `run.mjs`.

9. `capture.mjs` rollback
   - Tests: "a partial index append is rolled back to the index as it was, with or without an index before" and "an error during the rollback does not replace the error that caused it, and the capture file is still removed".
   - To make a partial append testable I added an `append` option to `capture()`, defaulting to `appendFileSync`.
   - Red: the index kept the partial `{"id":"D-2-d`, and the raw `EACCES: permission denied, open '.../verdicts/index.jsonl'` replaced the original error.
   - Green: the rollback is now three independent swallowed steps, and the index is restored from the content read before the write whenever it differs.

10. Deny reasons
    - Tests: "each refusal cause has its own deny reason, spawn-closed, spawn-unknown and lock-error included" and "a lock file that cannot be created denies once with the lock-file reason, not the index reason".
    - Red: `counters.json cannot be used (spawn-closed)`, and the "lock file" regex not matched.
    - Green with the exported `reasonOf`, which uses two tables.
    - `spawn-unknown` is tested only through `reasonOf`, because it is not reachable end to end. `spawn-closed` is also unreachable from the hook: `capture-exists` fires first.

11. `brief.mjs` task charset
    - Tests: "a task outside [A-Za-z0-9._-] is a malformed value, one inside is read" in `brief.test.mjs`, and "a task outside [A-Za-z0-9._-] records header invalid at the spawn" in `guard-spawn.test.mjs`.
    - Red: `../evil` was accepted.
    - Green after a `TASK` pattern in `value()`.

12. Skill `cdp6-core:idea`
    - Tests: "idea.md holds no D-n status and no autonomy level or budgets, the run record does" and "the devils-advocate brief of step 3 carries task D-1 and the idea.md target, and idea.md is not edited after that spawn".
    - I revised assertions after the first red, so I re-ran both against the original `SKILL.md` from HEAD: both red (`The input was expected to not match /autonomy|budget|status|decider/i`, and `did not match /\`task: D-1\`/`). With the new text both are green.
    - skill-lint passes.

Counter-tests (`decision-check`, appended unchanged)
- Red on the starting tree (the orchestrator's run on the T3 tree, `reports/sl2-audit-counter-tests.txt`, plus my own run after item 1): `a capture bound to no artefact passed: decision-check OK`, `D-2's F-P1-1 passed on D-1's record: decision-check OK`, `index verdict a counted while the capture file says b: decision-check OK`.
- All three are green at the end. The two `guard-spawn` counter-tests (F2) were not added.
- Counter-tests 1 and 2 do not isolate their own fix after F4:
  - Counter-test 2 builds its own index without `.md` files, so F4 alone makes it green. The scoped-record mutation left it green.
  - Counter-test 3 uses an invalid `.md` body, so the validator rejects it even when the sha compare is skipped.
  - Counter-test 1 does isolate F1: the F1 mutation turns it red.
  - The backed tests listed in items 2, 3 and 4 do isolate their fixes (shown by the mutations).

Gates, run on the final state
1. cdp6-core tests: exit 0, `tests 445 / pass 445 / fail 0` (baseline 417).
2. CDP5 suite (the command from the brief): exit 0, `tests 295 / pass 295 / fail 0`.
3. skill-lint on `plugins/cdp6-core`: exit 0, `2 skills, 1 agents, 0 🔴 0 🟡 2 🟢`; the two 🟢 are informational findings in `scripts/run.test.mjs`.
4. secrets-scan on `plugins/cdp6-core`: exit 0, `63 files, 0 findings`.
`generate-contract.mjs --check` was not run, as the orchestrator runs it.

Files changed or created (line counts, all inside `plugins/cdp6-core/`)
- New: `lib/verdict-index.mjs` 84, `lib/verdict-index.test.mjs` 93, `lib/capture-fixture.mjs` 38.
- Changed production files (lines after the change): `lib/capture.mjs` 126, `lib/brief.mjs` 56, `checks/verdict-check.mjs` 225, `checks/decision-check.mjs` 73, `hooks/check-handback.mjs` 153, `scripts/run.mjs` 668, `skills/idea/SKILL.md` 63, `agents/devils-advocate.md` 74.
- Changed test files: `lib/capture.test.mjs`, `lib/brief.test.mjs`, `checks/decision-check.test.mjs`, `checks/verdict-check.test.mjs`, `checks/idea-skill.test.mjs`, `hooks/check-handback.test.mjs`, `hooks/guard-spawn.test.mjs`, `scripts/run.test.mjs`.

Choices between readings of the concept
- Item 6: "each objection needs artefact and evidence" is applied to objections under b or c verdicts only, as the existing check did (§5.3 "A `b` or `c` verdict needs at least one objection, each with `artefact:` and `evidence:`"). An objection under a, a-with-conditions or not-decidable stays unchecked.
- Item 7: "through the existing marker" means one `handback-asked` marker per agent id, shared with all other denies. An earlier deny for a missing acknowledgement therefore uses up the one deny, and a later handback with a failing capture form is captured directly as rejected.
- Item 5 / zero-item conflicted capture: a rejected conflicted capture has no readable items, so it yields "conflicted capture X lists no objection or premise to record". It has no way out, which is the "zero-item conflicted capture" gap of run 37 choice 7 and is not fixed.
- Item 4: file findings (missing `.md`, sha mismatch, orphan `.md`) are reported by `decision-check`, the only checker in the registry, and by `verdict-check`. A capture whose sha differs or whose `.md` is missing is dropped from counting.
- Item 3: the stale rule uses `isDevilsAdvocate(c) && typeof c.decision === 'string'`. Other roles and captures without a decision are not made stale.
- Item 2: `run.mjs object` error codes are `bad-objection-id` (bare or malformed), `unknown-objection` and `unknown-premise` (valid format, not on an index line), and `index-unreadable`.

Open questions and follow-up notes (nothing fixed)
- `check-handback.mjs` still has its own `SAFE_TASK` copy as a defence for spawns that bypass the brief parser. It could go once the SL-3 spawn check exists.
- Concurrency window: the gate can see a `.md` that is written but not yet indexed (capture writes the `.md` before the index line). The gate then fails closed with an orphan finding. Taking `verdicts.lock` in the gate would remove it; not done.
- `skills/worker-contract/core.md` and `SKILL.md` still list `psy-grenzwaechter` in rule C9. They are the generated contract text, outside this brief.
- `verdict-check.mjs` still has no production caller (not in `registry.json`), so its stale and rejected findings reach the gate only through `decision-check`. This is the review-code 🟢; out of scope.
- NV1 to NV3 and audit F2 remain as recorded follow-ups.
- Not done: the fresh audit the auditor asked for after F1, F3 and F4; that is the orchestrator's.
