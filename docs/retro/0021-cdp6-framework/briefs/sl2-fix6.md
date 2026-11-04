# Brief SL-2 fix of the run-58 findings (stage-1 worker run 59; cap set aside by §0 item 31)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answers "Raise Cap to 60 or ignore Cap for this Project and review cap afterwards" and "Missing means 1 (Recommended)" (2026-11-04, concept §0 item 31; ledger 0021). `review-verify` run 58 blocked on 🔴 R1; the orchestrator executed its counter-tests unchanged and all failed as predicted (`reports/sl2-fix5-counter-tests.txt`). The owner's deadline is 15:00 today.

Output format (final answer, handback only, no file): acknowledgement line; status; per item the test, its red run (command, exit, the failing assertion message quoted verbatim) and its green run; the counter-tests below, red on the starting tree and green at the end; files changed with line counts; the gate commands with their real exits and last output lines; choices with the concept line followed; open questions. A test green before any production change is shown red by a stated mutation you then revert; state only mutation results you ran. No test may be weakened, removed or skipped unless an item changes what it asserts; name every such change. At most 800 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (last report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix5.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.14 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 534b5f8aaad7a4d77ee0dd2f6f659abd471a3a1d9c31fc06b05d060b9ce24d21; read only): §0 item 31, §5.3 g4 and the gate decision table head, AC-12.31. Diff against v0.5.13: `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0513-v0514.diff`.
- The review: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix5-rv.md` (R1 to R4, counter-tests R1a, R1b, R3).

Items (each test-first, in this order):
1. R1 (g4): `fileObjectionIds` in `checks/verdict-check.mjs` excludes only lines that match the disposition form (`DISPOSITION`), not every line starting with `disposition:`; a malformed `disposition:` line is prose and its objection ids are items of a rejected conflicted capture.
2. R3 (§0 item 31 (2), table head, AC-12.31): `checks/decision-check.mjs` reads a missing or null `ids.next.D` as 1; only a present value that is not a positive integer fails the gate. The test at `checks/decision-check.test.mjs:711` asserts that null fails; change that case as this item requires and name it.
3. R2: restore the spacing `const NO_PREMISES = '` at `checks/verdict-check.mjs:136`.

Counter-tests (append unchanged; red on the starting tree; green at the end): R1a (`checks/verdict-check.test.mjs`), R1b and R3 (`checks/decision-check.test.mjs`), all from `reports/sl2-fix5-rv.md`.

Out of scope: everything `briefs/sl2-build-table.md` lists as out of scope; lower-case look-alike ids (run 58 note); any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

Rules: `node:test`, temporary directories only through the `tempDir` helper, temporary HOME, no real home, key or Claude Code; no comments in code; no new dependency; keep every other test green unless an item changes what it asserts.

Gate commands (each from the worktree, report exits; gate 2 on the final tree):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs`
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff)
baseline: cdp6-core 535/535 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T13:40:11+01:00)
run grant: one impl-uc use, confirmed by the owner with the cap answer

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script inside the worktree (remove it before your final answer).

Stop rule: items in order; when an item is not testable as written or contradicts another concept line, record it as an open question with both line numbers and continue. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
