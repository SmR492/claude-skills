# Brief SL-2 fix of the build-review findings (stage-1 worker run 57 of cap 58)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answers "Fix now, runs 57+58 (Recommended)" and "Every id in the file (Recommended)" (2026-11-04, concept §0 item 30; ledger 0021). `review-verify` run 56 blocked the gate-table build on 🔴 F1; the orchestrator executed its seven counter-tests unchanged: five failed and two passed as predicted (`reports/sl2-build-table-counter-tests.txt`). The owner's deadline is 15:00 today.

Output format (final answer, handback only, no file): acknowledgement line; status; per item the test, its red run (command, exit, the failing assertion message quoted verbatim from that run's output) and its green run; the counter-tests below, red or green on the starting tree as stated and green at the end; files changed with line counts; the gate commands with their real exits and last output lines; every choice between readings with the concept line followed; open questions. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert; state only mutation results you ran. No test may be weakened, removed or skipped unless an item changes what it asserts; name every such change. At most 1200 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (last report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-build-table.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Create temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.13 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 f23e54f878e71fc43c6ced947f7516f48194ef356ce1774611535adb8b42349e; read only): §0 item 30 (line 39), the gate decision table of §5.3 (row "`conflicted`, rejected" at line 1253, the table head), UC-01 step 5.2. Diff against v0.5.12: `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0512-v0513.diff`.
- The review: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-build-table-rv.md` (F1 to F6, CT-1 to CT-6b).

Items (each test-first, in this order):
1. F1 (§0 item 30 (2), table row at line 1253): for a rejected conflicted capture, the items are every objection id anywhere in its file (after the normalisation of the line grammar) except in `> ` quote lines and disposition lines, plus the premise rows of its `premises:` section; `checks/verdict-check.mjs` returns them, `hooks/check-handback.mjs` writes them to the index line, `run.mjs object` accepts records for them, and the gate demands a record for each; no `:capture` record for a conflicted capture.
2. F2 and F3 (role text): `agents/devils-advocate.md` Output states that ` | ` separates the four objection fields and appears inside no field (a command with a pipe goes into the evidence as a file:line or is quoted elsewhere), and step 8 asks for what the owner records, pointing to the objection lines above without an objection id in prose.
3. F4 (table head "a record is not replaced"): `unclearedItems` in `lib/verdict-index.mjs` takes the first record per item, as `recordOf` does.
4. F5 (table head, v0.5.13): an `ids.next.D` that is not a positive integer fails the gate with a finding naming its value.

Counter-tests (append unchanged; all green at the end):
- red on the starting tree: CT-1 (F1, `checks/decision-check.test.mjs`), CT-6a (F2, `checks/devils-advocate-agent.test.mjs`), CT-5 (F3, `checks/devils-advocate-agent.test.mjs`), CT-2 (F4, `checks/decision-check.test.mjs`), CT-3 (F5, `checks/decision-check.test.mjs`).
- green on the starting tree, added as pins: CT-6b (`checks/verdict-check.test.mjs`) and CT-4 (`checks/verdict-check.test.mjs`).

Out of scope: everything the build brief `briefs/sl2-build-table.md` lists as out of scope; any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

Rules: `node:test`, temporary directories only through the `tempDir` helper, temporary HOME, no real home, key or Claude Code; no comments in code; no new dependency; keep every other test green unless an item changes what it asserts.

Gate commands (each from the worktree, report exits; gate 2 on the final tree):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs`
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff)
baseline: cdp6-core 523/523 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T13:10:42+01:00)
run grant: one impl-uc use, confirmed by the owner with the fix decision

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree (remove it before your final answer).

Stop rule: items in the order listed; when an item is not testable as written or contradicts another concept line, record it as an open question with both line numbers and continue. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
