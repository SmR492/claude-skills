# Brief: review-verify of SL-2c T3 with the T2 fixes, and concept v0.5.26 (stage-1 worker run 83)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4 and §0 item 27.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0525-v0526.diff` (10 hunks), whether run 81 supports it and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢 with one closing proposal each and, for a code claim, a counter-test as complete `node:test` code (temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the expected result; then status. At most 1300 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a, uncommitted T1+T2+T3 diffs); the tree before T3 is `<repo>/.worktrees/sl2c-pre-t3/`, so `diff -r <repo>/.worktrees/sl2c-pre-t3 <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly run 82. Brief `briefs/sl2c-t3.md`, report `reports/sl2c-t3.md`, the T2 review `reports/sl2c-t2-rv.md`. Concept v0.5.26 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 5fab787730b1a62f6d7196d70dbb0a359d63ed267009c115a54f2397882d2e24): UC-12 step 7, UC-14 step 5, §5.6, AC-12.36, AC-14.9 to AC-14.16, Q-18, Q-24. You wrote no part of it. `<repo>` = the repository root.

Claims (worker run 82):
1. A1 to A6 close run 81's 🔴-1, 🟡-1, 🟡-2, 🟢-1 to 🟢-3 and 🟢-5 as the brief states; the three counter-tests are in the suite unchanged; the tests changed "by the concept decision" change only what v0.5.26 changed.
2. `lib/shell-allowlist.mjs` now admits only the read-only calls of UC-12 step 7 of v0.5.26; name any input that passes but writes, runs a program, reads a secret path or names `run.mjs` other than `status` (consider `cat`, `head`, `tail`, `grep` flags and paths, `ls` flags, globs, PowerShell and Monitor input).
3. `scripts/preflight.mjs` implements UC-14 step 5 (a) to (i) and AC-14.9 to AC-14.16 with tests that assert each AC; it is read-only (no write, no network, no process start other than reading `claude --version` if it does so; say which).
4. No test was weakened, removed or skipped beyond the concept decisions (name every hunk that removes, replaces or loosens an assertion).
5. The worker's seven open questions: for each, whether it is a defect against the concept (for example the missing calibration writer against AC-14.9 and the probe-session paragraph, the unchecked `--settings` file location against §5.6 "Protection of the `--settings` file", the PATH binary against the running version) and the closing change.
6. The v0.5.26 hunks carry run 81's findings without contradicting an unchanged line.

Tools: Read, Grep, Glob, Bash for read-only commands. No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 50 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
