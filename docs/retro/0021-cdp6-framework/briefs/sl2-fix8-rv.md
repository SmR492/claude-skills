# Brief: review-verify of the SL-2 close run (G1, R1) and concept v0.5.16 to v0.5.18 (stage-1 worker run 64; cap set aside by §0 items 31 and 33)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and "G1+R1, then commit (Recommended)" (2026-11-04, concept §0 item 33; ledger 0021). §11.3 item 4: every worker result gets its `review-verify`; §0 item 27: concept edits go into it. After this review the owner's decision is a local commit of SL-2.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim below (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0516-v0517.diff` and `concept-v0517-v0518.diff`, whether `reports/sl2-fix7-rv.md` or §0 item 33 supports it and whether it contradicts an unchanged concept line; then the findings that should change code or concept, ranked 🔴 🟡 🟢, each with one closing proposal and, for a code claim, a counter-test as complete `node:test` code marked "not executed" with the result you expect; then status. At most 800 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted SL-2 diff under `plugins/cdp6-core/`. The tree before the run is `<repo>/.worktrees/sl2-pre-fix8/` (copied 2026-11-04T19:42:29+01:00, `diff -r` exit 0 at that time), so `diff -r <repo>/.worktrees/sl2-pre-fix8 <repo>/.worktrees/sl2/plugins/cdp6-core` is exactly the run. Brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-fix8.md`, report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix8.md`. Concept v0.5.18 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 666cea1fed661d28b08644245a6b7a1403114e4a4094cc36e4ccde81bd5dde1b). You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. The G1 test of `reports/sl2-fix7-rv.md` is in the tree verbatim, and the mutation the report names would turn it red.
2. The role file states that only the `<item>` of a disposition line may carry an objection id, and a test asserts it; nothing else in the role file changed.
3. No test was weakened, removed or skipped, and no production module changed.
4. The concept hunks of v0.5.17 and v0.5.18 close run 62 K1 and G2 and record the owner's answers without contradicting an unchanged line.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 30 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
