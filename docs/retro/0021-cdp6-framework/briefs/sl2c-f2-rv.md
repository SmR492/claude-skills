# Brief: review-verify of SL-2c F2, the F1 review fixes and the probe record and preflight fixes, and concept v0.5.29 (stage-1 worker run 92)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4 and §0 item 27.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0528-v0529.diff` (4 hunks), which run-90 finding it carries and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢 with one closing proposal each and, for a code claim, a counter-test as complete `node:test` code (file, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the expected result; then status. At most 1400 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a, uncommitted T1, T2, T3, F1 and F2 diffs); the tree before F2 is `<repo>/.worktrees/sl2c-pre-f2/`, so `diff -r <repo>/.worktrees/sl2c-pre-f2 <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly run 91. Brief `briefs/sl2c-f2.md`, report `reports/sl2c-f2.md`; the findings it fixes `reports/sl2c-f1-rv.md`, `reports/sl2c-slice-reviews.md`, `reports/concept-v0527-rv.md`. Concept v0.5.29 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 2bd3645795b1c954cd8563e3ce8aaf44aa8995645f752ff050909b00fc110a79). Docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/` and `docs-2026-11-06/`. You wrote no part of it. `<repo>` = the repository root.

Claims (worker run 91):
1. Part A closes run 90's 🔴-1, 🟡-1 (executed as 🔴 by the orchestrator on Windows PowerShell 5.1), 🟢-1 and 🟢-2 as concept v0.5.29 states; the counter-test files are in the suite unchanged.
2. Part B items 1 to 7 are built as the report states and match the concept lines the brief names; every AC test title of AC-11.20 to AC-11.26 and AC-14.9 to AC-14.19 exists in the suite (literal or built at runtime; say which).
3. `lib/running-version.mjs` finds the version of the Claude Code process that runs, cannot be steered by PATH, a lookalike process or an environment variable, and every caller that gates on a probe record (guard-shell owner admission, `run.mjs probe --accept`, A3, team lookup, preflight (d)) uses it.
4. `probe --accept` is atomic and `probe-check.mjs` is the only writer under `<data>/probes/` in production code; name any other writer.
5. The preflight cannot pass while a check of UC-14 step 5 should fail (per-check error handling, settings read once from the hashed bytes, counted paths, hooks-off scopes, recognition).
6. The changed earlier tests keep their assertion strength; each change follows the concept sentence the report names (list every hunk that removes, replaces or loosens an assertion), and `test-support/claude-host.mjs` does not make a production path pass that would fail on a real host.
7. The worker's open points: (a) the `Session id:` line format; (b) `a12-calibration-slope` and `-rows` beyond the concept text; (c) the version floor in `run.mjs` read from PATH (concept lines 772, 1689 and §3.4 item 14): is it a defect of SL-2c, and the closing change; (d) the AC-16.15 teams variable (a UC-16 criterion outside the SL-2c AC list); (e) the counter-test that depends on the real `/proc`; (f) `signedRecord` writing through `writeProbeRecord`; (g) the preflight listing processes of its own pipeline.
8. Each red run and mutation the report names would turn its tests red (say where only a run decides).
9. The 4 hunks of v0.5.29 carry run 90's findings without contradicting an unchanged line.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 55 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
