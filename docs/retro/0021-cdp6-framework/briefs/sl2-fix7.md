# Brief SL-2 fix of run 60 C2 (stage-1 worker run 61; cap set aside by §0 item 31)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answer "Close it now (Recommended)" (2026-11-04, concept §0 item 32; ledger 0021). `review-verify` run 60 found C2; the orchestrator executed its counter-test unchanged and it failed as predicted (`reports/sl2-fix6-counter-tests.txt`).

Output format (final answer, handback only, no file): acknowledgement line; status; the test, its red run (command, exit, the failing assertion message quoted verbatim) and its green run; the counter-test, red on the starting tree and green at the end; files changed with line counts; the four gate commands with their real exits and last output lines, all run on the final tree; choices with the concept line followed; open questions. State only mutation results you ran. No test may be weakened, removed or skipped. At most 600 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (last report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix6.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.16 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 23e67b23717aba8a37047cc884a7849c93b729176071530d1603633d30f49c0d; read only): §0 item 32, §5.3 g4, AC-12.29. Diff against v0.5.15: `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0515-v0516.diff`.
- The review: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix6-rv.md` (C2 and its counter-test).

Item (test-first): in `checks/verdict-check.mjs` (and `lib/verdict-index.mjs` if needed), only the `<item>` of a well-formed disposition line carries an exempt objection id; an objection id anywhere after the `<item>` in that line rejects the capture (for every counter-role) and, in a rejected conflicted capture, is returned as an item (and so written to the index and demanded at the gate).

Counter-test (append unchanged; red on the starting tree; green at the end): the C2 test of `reports/sl2-fix6-rv.md` ("rv60 C2: …") in `checks/verdict-check.test.mjs`. The existing tests that a well-formed disposition line with its `<item>` id stays valid must stay green unchanged.

Out of scope: everything `briefs/sl2-build-table.md` lists as out of scope; lower-case look-alike ids; the D5 demonstration (concept-sanctioned, row 1256); any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

Rules: `node:test`, temporary directories only through the `tempDir` helper; no comments in code; no new dependency; keep every other test green.

Gate commands (each from the worktree, on the final tree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs`
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff)
baseline: cdp6-core 538/538 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T16:06:58+01:00)
run grant: one impl-uc use, confirmed by the owner with the C2 answer

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`.

Stop rule: when the item is not testable as written or contradicts another concept line, record it as an open question with both line numbers. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
