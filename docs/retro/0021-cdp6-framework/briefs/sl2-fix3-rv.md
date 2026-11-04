# Brief: review-verify of the SL-2 third fix and concept v0.5.9 (stage-1 worker run 49 of cap 52)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02) and the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04; ledger 0021). §11.3 item 4 (line 1645): every worker result gets its `review-verify`, a fix run included; §0 item 27: concept edits go into the slice's review-verify.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim below (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v058-v059.diff`, whether its source (the ledger 0021 rows "SL-2 final review-verify (run 46)", "SL-2 final adversarial-auditor (run 47)" and the synthesis row of 2026-11-04T09:57:32+01:00) supports it, and whether it contradicts an unchanged concept line; then the findings that should change code or concept, ranked 🔴 🟡 🟢, each with one closing proposal and, for a code claim, a counter-test as complete `node:test` code (file name and title, any extra import named; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the result you expect; then status. At most 1800 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted SL-2 diff under `plugins/cdp6-core/`. The tree before the third fix is `<repo>/.worktrees/sl2-pre-fix3/` (copied 2026-11-04T09:58:12+01:00, `diff -r` exit 0 at that time), so `diff -r <repo>/.worktrees/sl2-pre-fix3 <repo>/.worktrees/sl2/plugins/cdp6-core` is exactly the third fix. Fix brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-fix3.md`, its report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix3.md`. Concept v0.5.9 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 4d8367ae8aec6f9b6b7f7f70153c1690841f31af6bc41bb04b83bd68a502d105). You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. Items 1 to 6 of the fix brief are built as stated, each with the test the report names, and each test asserts what its item and concept line say.
2. The eight counter-tests the brief lists as unchanged are in the tree verbatim (imports merged only where the report says so); T1 and T4 are absent and item 1's replacement test asserts what the brief says.
3. Each mutation the report names would turn the named test red (read code and test; a mutation whose test cannot fail as reported is widerlegt; say where only a run decides).
4. No test was weakened, removed or skipped to reach green: name every hunk of the `diff -r` above that removes, replaces or loosens an assertion and whether the item it cites requires it (item 2 changes `checks/verdict-check.test.mjs:369` and `:408` of the pre-fix-3 tree).
5. The worker's choices stay inside the brief and the concept lines they cite.
6. Item 3 cannot deny a write to a file that is not an open target (no inode collision across devices, a not-yet-existing path judged by path only), and item 4 cannot end a wait early on a lock that is held and readable.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> diff`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy and puts the raw output into the ledger. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 80 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
