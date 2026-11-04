# SL-2 fix of the build-review findings (impl-uc, stage-1 run 57): final answer as handed back

Brief: `briefs/sl2-fix5.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15

Status: all four items are done and all four gates pass. The five red counter-tests are now green and the two pins are green. Nothing is committed. No file changed outside `plugins/cdp6-core/`; `skills/worker-contract/` untouched. The temporary `mut.mjs` script was removed. The brief was read from the main checkout (`docs/` is untracked in the worktree). Every Bash call started with `cd <repo>/.worktrees/sl2 && `; the scratchpad was used for gate output only.

## Items, red then green (`node --test <file>` from the worktree)
1. F1. Red on the starting tree (decision-check.test.mjs, exit 1): CT-1 `AssertionError: prose: F-P1-2 left the gate without an owner record: decision-check OK`, `0 !== 1`. Also red before the fix (exit 1): new test in `checks/verdict-check.test.mjs` "a rejected conflicted capture returns every objection id of its file ..." (F-P1-3, F-P1-7 and F-P1-10 missing from the result); new test in `lib/capture.test.mjs` "a rejected conflicted capture records on its index line every objection id ..." (F-P1-2 missing from `line.objections`). Fix: `fileObjectionIds` in `checks/verdict-check.mjs` takes, for a rejected capture, every `F-P[1-8]-n` id on lines that do not start with `> ` or `disposition:`; premise rows unchanged. Green: all three pass; the gate demands a record for each id. Not covered: no separate `run.mjs object` test (it reads the index line, which `capture.test.mjs` shows carries the ids). Not changed: `captureFindings` already skips `:capture` for a conflicted capture and `hasItem` already refuses it.
2. F2 and F3. Red (exit 1): CT-6a "The input did not match the regular expression /` \| `[^.]*(?:inside|within|in) (?:a|any|no) field/i"; CT-5 the first line starting with `8. ` did not match /without (?:an|any) objection id/i. Fix in `agents/devils-advocate.md`: the Output section says ` | ` splits the four fields and appears inside no field (a command with a pipe goes into the evidence as a file:line or is quoted elsewhere); Output step 8 reads "what the owner records, pointing to the objection lines above without an objection id"; Method step 8 (line 33) gained "Point to the objection lines above, without an objection id in prose." Green.
3. F4. CT-2 red: `AssertionError: decision-check OK`, `0 !== 1`. `unclearedItems` in `lib/verdict-index.mjs` keeps the first record per item. Green.
4. F5. CT-3 red: `AssertionError: decision-check OK` (`notStrictEqual` 0 and 0). `decision-check.mjs` adds the finding `ids.next.D is not a positive integer: <value>`. Green.

## Counter-tests (appended unchanged, green at the end)
Red on the starting tree as predicted: CT-1, CT-2, CT-3 (`decision-check.test.mjs`), CT-6a, CT-5 (`devils-advocate-agent.test.mjs`). Green on the starting tree as predicted: CT-6b, CT-4 (`verdict-check.test.mjs`).

## Own tests added
`verdict-check.test.mjs`: the rejected conflicted result, and a valid conflicted capture keeping only its objection-line ids. `capture.test.mjs`: the index line of a rejected conflicted capture. `devils-advocate-agent.test.mjs`: Output step 8. `decision-check.test.mjs`: `ids.next.D` values '4', 0, -1, 1.5 and null, each naming its value, plus a valid case. Written after the production code, shown red by mutation.

## Mutations run (applied, the named test file run, the file restored)
CT-6b: `fourFields` made to return true, exit 1, red. CT-4: the "carries the objection id" reason removed, exit 1, two tests failed including the g2 test. Quote exclusion removed: red in `verdict-check.test.mjs`. Disposition exclusion removed: red in `verdict-check.test.mjs`. Finding without the value (`ids.next.D`): red in `decision-check.test.mjs`. Output step 8 reverted: red in `devils-advocate-agent.test.mjs`. Last record wins instead of first (F4): red (CT-2). A first attempt on CT-6b, `parts.length === 4` changed to `>= 4`, gave exit 0 (the field-order check still rejects five fields); that mutation was too weak and was replaced by the `return true` one.

## Files changed (this run's additions)
`checks/verdict-check.mjs` about +7/-1; `lib/verdict-index.mjs` +2/-1; `checks/decision-check.mjs` +3/-1; `agents/devils-advocate.md` 2 lines; tests: `decision-check.test.mjs` about +37, `verdict-check.test.mjs` about +40, `capture.test.mjs` +11, `devils-advocate-agent.test.mjs` about +25. The worktree diff as a whole: 23 files, +1333/-143 for the tracked ones.

## Gates (final tree)
1. cdp6-core: exit 0, tests 535, pass 535, fail 0 (523 plus 12). 2. CDP5: exit 0, 295/295. 3. skill-lint: exit 0. 4. secrets-scan: exit 0, "no cleartext secrets found." No coverage threshold stated, none measured.

## Choices between readings
- CT-5 and step 8: CT-5 takes the first line starting with `8. `, which is Method step 8 (line 33), not the Output step 8 (line 61) the review meant; the test at `devils-advocate-agent.test.mjs:47` pins line 33's wording up to "`run.mjs object`."; the new sentence was added after that period and line 61 fixed too; no assertion weakened.
- "Every id in the file" (§0 item 30 (2), line 39): ids taken from any line except `> ` quote lines and disposition lines, applied to every rejected capture before the conflicted check.
- Item 4, wider than the brief: a missing or null `ids.next.D` also fails the gate (read as "not a positive integer"); the suites pass with this reading.

## Open questions and follow-ups
Concept line 1252 and the UC-01 step 5.2 text may still say "(b) or (c) is cleared by `:capture`" without "not conflicted" (review Part B). The review's 🟢 concept items stay untouched: concept:1236 against g4 on `upheld`, the AC row order, `verdict: (b)`, the header-line id.
