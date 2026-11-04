# Brief: review-verify of the SL-2 fix of run 60 C2 and concept v0.5.14 to v0.5.16 (stage-1 worker run 62; cap set aside by §0 item 31)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and "Close it now (Recommended)" (2026-11-04, concept §0 item 32; ledger 0021). §11.3 item 4: every worker result gets its `review-verify`; §0 item 27: concept edits go into it.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim below (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0514-v0515.diff` and `concept-v0515-v0516.diff`, whether `reports/sl2-fix6-rv.md` or §0 item 32 supports it and whether it contradicts an unchanged concept line; then the findings that should change code or concept, ranked 🔴 🟡 🟢, each with one closing proposal and, for a code claim, a counter-test as complete `node:test` code (file name and title, any extra import named; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the result you expect; then status. At most 1000 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted SL-2 diff under `plugins/cdp6-core/`. The tree before the fix is `<repo>/.worktrees/sl2-pre-fix7/` (copied 2026-11-04T18:01:53+01:00, `diff -r` exit 0 at that time), so `diff -r <repo>/.worktrees/sl2-pre-fix7 <repo>/.worktrees/sl2/plugins/cdp6-core` is exactly the fix. Fix brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-fix7.md`, its report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix7.md`. Concept v0.5.16 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 23e67b23717aba8a37047cc884a7849c93b729176071530d1603633d30f49c0d). You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. The fix item is built as stated, with a test that asserts it and §0 item 32, g4 and AC-12.29.
2. The C2 counter-test of run 60 is in the tree verbatim, and the earlier tests that a well-formed disposition line with its `<item>` id stays valid are unchanged.
3. Each mutation the report names would turn the named test red (say where only a run decides).
4. No test was weakened, removed or skipped (name every hunk of the `diff -r` above that removes, replaces or loosens an assertion).
5. After the fix, an objection id of a devils-advocate capture reaches a passing gate without a well-formed objection line or an owner record only in the cases the gate decision table of §5.3 states (a `> ` quote line, the `<item>` of a disposition line, a rejected not-conflicted capture without a verdict (b) or (c), a capture after the decision); and no capture the role file asks for is rejected.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 40 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
