# Brief: review-verify of SL-2c F3, the fixes of runs 92 and 93, and concept v0.5.30 (stage-1 worker run 96)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4 and §0 item 27.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0529-v0530.diff` (18 hunks), which run-92 or run-93 finding it carries and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢 with one closing proposal each and, for a code claim, a counter-test as complete `node:test` code (file, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`; a positive control where the defect depends on shell or Claude Code behaviour) marked "not executed" with the expected result; then status. At most 1400 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a, uncommitted T1, T2, T3, F1, F2 and F3 diffs); the tree before F3 is `<repo>/.worktrees/sl2c-pre-f3/`, so `diff -r <repo>/.worktrees/sl2c-pre-f3 <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly run 95. Brief `briefs/sl2c-f3.md`, report `reports/sl2c-f3.md`; the findings it fixes `reports/sl2c-f2-rv.md` and `reports/sl2c-audit-2.md`, with the counter-tests in `<repo>/.worktrees/sl2c-audit5/plugins/cdp6-core/`. Concept v0.5.30 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 633d309995352f2236e74cee0752fd7a32020c875f1e6f4f1215aaed4fc2ff0e). Docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/` and `docs-2026-11-06/`. You wrote no part of it. `<repo>` = the repository root.

Claims (worker run 95):
1. A1 to A6 close run 92's 🟡-1 to 🟡-3 and 🟢-1 to 🟢-4 as concept v0.5.30 states; the counter-test file is in the suite unchanged; A3's `orphaned()` run really has no Claude Code ancestor and does not make a production path pass that would fail on a real host.
2. B1 to B4 close run 93's F-1, F-2, F-3, NV-1, NV-2 and NV-3 as v0.5.30 states; the modified glob counter-test still catches the defect it was written for (a repository deny glob that passes the preflight).
3. Check (i) cannot be passed by a project or local settings file that sets `env`, `statusLine`, a sandbox key, a hook, an allow rule, or a deny rule with a path; judge the worker's path-specifier reading (a deny rule fails when it starts `Read(`, `Edit(`, `Write(`, `MultiEdit(`, `NotebookEdit(`, `Glob(` or `Grep(`) against a simpler fail-closed reading (any deny rule with a parenthesised specifier fails), and say which the concept should state.
4. The orchestrator's Q-29 choice (option (b), deny rules without a path specifier only, for stage 1) is backed by the docs (sandboxing.md:280, :686) and closes the risk Q-29 names; or name what it leaves open.
5. The new matcher form in `hooks/hooks.json` (an exact name list plus `^mcp__.*`) matches every tool the concept's stop guard names, and misses none that the old combined regex matched and the concept needs (hooks.md:273-283).
6. `TaskStop` `ask` and its deny on an unreadable or missing `counters.json`, and `Skill` deny during a stop, follow UC-12 step 7 and the fail-closed rule; the deny goes beyond the text (say whether the concept should state it).
7. The changed earlier tests keep their assertion strength; each change follows the concept sentence the report names (list every hunk that removes, replaces or loosens an assertion).
8. Each red run and mutation the report names would turn its tests red (say where only a run decides).
9. The 18 hunks of v0.5.30 carry runs 92 and 93 without contradicting an unchanged line.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 55 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
