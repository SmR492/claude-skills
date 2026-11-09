# Brief: review-verify of SL-2c F1, the stop path fixes, and concept v0.5.28 (stage-1 worker run 90)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4 and §0 item 27.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0527-v0528.diff` (15 hunks), which run-87 finding it carries and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢 with one closing proposal each and, for a code claim, a counter-test as complete `node:test` code (file, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the expected result; then status. At most 1300 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a, uncommitted T1, T2, T3 and F1 diffs); the tree before F1 is `<repo>/.worktrees/sl2c-pre-f1/`, so `diff -r <repo>/.worktrees/sl2c-pre-f1 <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly run 89. Brief `briefs/sl2c-f1.md`, report `reports/sl2c-f1.md`; the findings it fixes `reports/sl2c-slice-reviews.md` and `reports/concept-v0527-rv.md`. Concept v0.5.28 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 39a1f679652b0f049a96f3075dcfa1dde95ff416560d4aeb16a94dfa983e7884). Docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/` and `docs-2026-11-06/`. You wrote no part of it. `<repo>` = the repository root.

Claims (worker run 89):
1. Items 1 to 6 of the F1 brief are built as the report states and match UC-12 steps 2, 3 and 7 and AC-12.33 to AC-12.37 of v0.5.28; every AC test title of the concept exists verbatim in the suite.
2. `lib/shell-allowlist.mjs` admits only the calls of the inverted allowlist with the v0.5.28 lexer; name any input it admits that writes, runs a program or reads a path outside the named operands (bash, PowerShell, Monitor syntax; quoting, separators, newlines, here-strings, `&>`, `|&`, `>|`, process substitution, ANSI-C and locale quotes, tilde and history expansion, `--` and option-operand forms).
3. `stopFor` is the only stop lookup of every guard and fails closed on every lookup error, missing `counters.json` included; no guard path returns no decision on an error during an active run.
4. `observe-stop.mjs` records every outcome on its hook line and writes the stop entry of an unbound capture-bound agent through `lib/counters.mjs` only; the guards fire on that entry; nothing the model can call clears it.
5. The spawn deny counts only bound spawns without a capture, and the binding refuses two unbound spawns of a role.
6. The changed earlier tests keep their assertion strength; each change follows the concept sentence the report names (list every hunk that removes, replaces or loosens an assertion).
7. Each red run and mutation the report names would turn its tests red (say where only a run decides).
8. The worker's open questions (a) to (e): for each, is it a defect against the concept, and the closing change.
9. The 15 hunks of v0.5.28 carry run 87's findings without contradicting an unchanged line, and the orchestrator's fail-closed choice on (j) agrees with settings-reference.md:3565-3567.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 50 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
