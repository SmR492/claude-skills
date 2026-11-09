# Brief: review-verify of SL-2c F4, the fixes of run 96, and concept v0.5.31 (stage-1 worker run 98)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4 and §0 item 27.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0530-v0531.diff` (6 hunks), which run-96 finding it carries and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢 with one closing proposal each and, for a code claim, a counter-test as complete `node:test` code (file, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the expected result; then status. At most 900 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a, uncommitted T1 to T3 and F1 to F4 diffs); the tree before F4 is `<repo>/.worktrees/sl2c-pre-f4/`, so `diff -r <repo>/.worktrees/sl2c-pre-f4 <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly run 97. Brief `briefs/sl2c-f4.md`, report `reports/sl2c-f4.md`; the findings it fixes `reports/sl2c-f3-rv.md` with the counter-tests in `<repo>/.worktrees/sl2c-audit6/plugins/cdp6-core/`. Concept v0.5.31 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 29cbd6c2d2ea38418d6854857e1204c97c8a6e2fb98145d93e53f0577d7fd216). You wrote no part of it. `<repo>` = the repository root.

Claims (worker run 97):
1. Items 1 to 5 close run 96's 🟡-1 and 🟢-1 to 🟢-5 as concept v0.5.31 states; the four counter-tests are in the suite unchanged.
2. Check (c) skips no process of the preflight's own process group and still passes the preflight's own ancestors and `--orchestrator-pid`; no other skip remains that lets a Claude Code process or an MCP child pass.
3. Check (i) refuses every `permissions.ask` and `permissions.deny` rule containing `(` and every other key, in both project files; name any project or local settings content it admits that widens the run, reaches a hook or enlarges the sandbox profile.
4. No production or test file other than `checks/probe-check.mjs` and `signedRecord` in `test-support/probe-fixture.mjs` writes probe records.
5. The changed earlier tests keep their assertion strength (list every hunk that removes, replaces or loosens an assertion).
6. The 6 hunks of v0.5.31 carry run 96's findings without contradicting an unchanged line, and the orchestrator's drop of the process-group skip (instead of the review's narrower skip) closes 🟡-1 at the cost the concept names.

Tools: Read, Grep, Glob, Bash for read-only commands. No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 35 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
