# SL-2 fix of run 60 C2 (impl-uc, stage-1 run 61): final answer as handed back

Brief: `briefs/sl2-fix7.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15

Status: done. An objection id after the `<item>` of a well-formed disposition line now rejects the capture for every counter-role. In a rejected conflicted capture the id is returned as an item. The counter-test is red on the starting tree and green at the end, and all four gates exit 0. Nothing was committed. `briefs/sl2-fix7.md` is not in the worktree; it was read from the main checkout.

Tests (`plugins/cdp6-core/checks/verdict-check.test.mjs`, appended)
1. The counter-test "rv60 C2: …", appended unchanged (test and counter-test at once). Red on the starting tree: `node --test plugins/cdp6-core/checks/verdict-check.test.mjs` exit 1 (pass 56, fail 1); failing assertion `AssertionError [ERR_ASSERTION]: {"validator":"valid","reasons":[],"verdict":"a","objections":[],"premises":[],"conflicted":false}`.
2. Own test "rv61 C2: for every counter-role an objection id in the cited part or the why of a disposition line rejects the capture, while the item id alone stays exempt": four roles, a cited-part id, a scoped item with an id in the why, the exempt item-only line; a conflicted capture must return `['F-P1-1','F-P1-4']`. Red before the fix: pass 56, fail 2, `AssertionError [ERR_ASSERTION]: cdp6-core:devils-advocate cited: {"validator":"valid",…`.
3. Green after the fix: exit 0 (pass 58, fail 0). The existing tests that a well-formed disposition line stays valid are unchanged and green.

Mutations run (original restored each time; the final tree has neither): disabling the new rejection reason made both new tests fail (fail 2); dropping the disposition tail from `fileObjectionIds` made both new tests fail (fail 2).

Files changed: `plugins/cdp6-core/lib/verdict-index.mjs` (141 lines): new export `dispositionRest(line)`, the line after `disposition: ` minus its first token, the item. `plugins/cdp6-core/checks/verdict-check.mjs` (285 lines): a well-formed, non-upheld disposition line whose rest holds an id adds the reason "line N carries the objection id X after the item of a disposition line"; `fileObjectionIds` scans the rest of a well-formed disposition line instead of skipping the line. `plugins/cdp6-core/checks/verdict-check.test.mjs` (881 lines): the two tests, about 22 lines added. Per-file diff lines not counted. Scratch copies (a backup of `verdict-check.mjs`, gate output) in the scratchpad, outside the worktree.

Gates, final tree: 1. cdp6-core: exit 0, tests 540, pass 540 (538 plus 2), fail 0. 2. CDP5: exit 0, 295/295. 3. skill-lint: exit 0 (supply-chain notes on test files informational). 4. secrets-scan: exit 0, "no cleartext secrets found."

Choices (concept v0.5.16): §0 item 32, §5.3 g4 and AC-12.29: only the `<item>` is exempt, the cited reference and the why are not; the scan runs on the text after the item, so a scoped item such as `D-1-x-agent-2:F-P2-1` stays exempt; upheld lines keep their existing rejection and get no second reason; lower-case look-alike ids and the D5 demonstration not checked (out of scope).

Open questions: none. Follow-up note: `git status` shows `plugins/cdp6-core/skills/worker-contract/` as untracked, as before; not touched.
