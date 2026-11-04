# Brief SL-2 close: test G1 and role-file sentence R1 (stage-1 worker run 63; cap set aside by §0 items 31 and 33)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answer "G1+R1, then commit (Recommended)" (2026-11-04, concept §0 item 33; ledger 0021). `review-verify` run 62 passed the C2 fix with the 🟢 findings G1 (no gate-level test of an objection id after the item of a disposition line) and R1 (the role file's rule wording also covers the exempt item); the orchestrator executed G1: green on the final tree, red on the tree before run 61 (`reports/sl2-fix7-counter-tests.txt`).

Output format (final answer, handback only, no file): acknowledgement line; status; per item the test, its red evidence (a run, or for G1 the orchestrator's file plus a stated mutation you ran) and its green run; files changed with line counts; the four gate commands with their real exits and last output lines, all run on the final tree; open questions. State only mutation results you ran. No test may be weakened, removed or skipped. At most 500 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (last report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix7.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.18 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 666cea1fed661d28b08644245a6b7a1403114e4a4094cc36e4ccde81bd5dde1b; read only): §0 items 32 and 33, §5.3 g4.
- The review: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix7-rv.md` (G1 code block, R1 proposal).

Items:
1. G1: append the G1 test of `reports/sl2-fix7-rv.md` unchanged to `plugins/cdp6-core/checks/verdict-check.test.mjs`. It is green on the current tree; show it red by a stated mutation of the production code (for example the disposition tail no longer scanned in `fileObjectionIds`), then revert.
2. R1: `plugins/cdp6-core/agents/devils-advocate.md` line 52 states that only the `<item>` of a disposition line may carry an objection id; extend `plugins/cdp6-core/checks/devils-advocate-agent.test.mjs` with a test that the Output section says so, red before the text change and green after.

Out of scope: everything else; any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

Rules: `node:test`, temporary directories only through the `tempDir` helper; no comments in code; no new dependency; keep every other test green.

Gate commands (each from the worktree, on the final tree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs`
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff)
baseline: cdp6-core 540/540 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T18:05:27+01:00)
run grant: one impl-uc use, confirmed by the owner with the close answer

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`.

Stop rule: when an item is not doable as written, record it as an open question. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
