# SL-2 fix of the run-58 findings (impl-uc, stage-1 run 59): final answer as handed back

Brief: `briefs/sl2-fix6.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15

Status: all three items are done in `<repo>/.worktrees/sl2`, with no commit and nothing changed outside `plugins/cdp6-core/`. Gates 1 to 4 exit 0. The brief path does not resolve under the worktree; it was read at `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-fix6.md`.

**Counter-tests** (appended unchanged: R1a to `checks/verdict-check.test.mjs`, R1b and R3 to `checks/decision-check.test.mjs`).
- Red on the starting tree: `node --test plugins/cdp6-core/checks/verdict-check.test.mjs plugins/cdp6-core/checks/decision-check.test.mjs`, exit 1, 103 pass, 3 fail: R1a `Expected values to be strictly deep-equal` (actual `['F-P1-1']`); R1b `F-P1-2 left the gate without an owner record: decision-check OK` (`0 !== 1`); R3 `decision-check FAIL ids.next.D is not a positive integer: missing` (`1 !== 0`).
- Green: the same three pass after the production changes; gate 1 covers them.

**Item 1, R1 (g4).** `fileObjectionIds` in `checks/verdict-check.mjs` excludes `> ` lines and lines matching `DISPOSITION`, instead of every line starting with `disposition:`. R1a and R1b red, then green.

**Item 2, R3.** `checks/decision-check.mjs:81` is `run.ids?.next?.D ?? 1`: a missing or null value counts as 1; only a present value that is not a positive integer fails.
- Test change, named: in "fires: an ids.next.D that is not a positive integer…" in `checks/decision-check.test.mjs`, the `[null, 'null']` case left the failing list (the case at line 711 the brief said to change), and `assert.equal(check(runWith({ decisions: {}, nextD: null, captures: [] })).status, 0)` was added to the same test, so null is asserted to pass.
- The `?? 'missing'` fallback in the finding text became unreachable and was dropped.
- Mutation run: reverting `?? 1` turned two tests red (the "fires" test and the R3 counter-test); restored, line 81 checked.

**Item 3, R2.** `const NO_PREMISES = '` restored at `checks/verdict-check.mjs:136`; whitespace only, no test of its own.

**Files changed by this fix:** `checks/verdict-check.mjs` 2 lines; `checks/decision-check.mjs` 2 lines; `checks/verdict-check.test.mjs` 7 lines added (R1a); `checks/decision-check.test.mjs` 15 lines added (R1b and R3), 1 changed (the null case removed) and 1 added (the null-passes assertion). Per-fix diff counts not measured; the cumulative `git diff --stat` over `plugins/cdp6-core/checks` against base is 4 files, +743/-65. `git status` shows nothing outside `plugins/cdp6-core/`.

**Gates:** 1. cdp6-core: exit 0, tests 538, pass 538, fail 0 (535 plus 3); run before the mutation check, line 81 restored afterwards, full suite not re-run. 2. CDP5: exit 0, 295/295. 3. skill-lint: exit 0. 4. secrets-scan: exit 0, "no cleartext secrets found."

**Choices.** §0 item 31 (2), "Missing means 1": missing and null read as 1, as `run.mjs:461` does.

**Open questions.** None. Follow-ups left untouched: R4 (concept text); lower-case look-alike ids (out of scope); the AC-12.31 text for the malformed `ids.next.D` rule (concept-side).
