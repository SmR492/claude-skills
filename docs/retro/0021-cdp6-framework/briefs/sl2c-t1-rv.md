# Brief: review-verify of SL-2c T1 and concept v0.5.24 (stage-1 worker run 79)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4: every worker result gets its `review-verify`; §0 item 27: concept edits go into it.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0523-v0524.diff` (11 hunks), whether the run-77 finding it names supports it and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢, each with one closing proposal and, for a code claim, a counter-test as complete `node:test` code (file name, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the result you expect; then status. At most 1200 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a14b897af3dbee8275b6e48a454331b0c1, uncommitted T1 diff under `plugins/cdp6-core/`); the tree before T1 is `<repo>/.worktrees/sl2c-pre-build/` (diff -r exit 0 at the worktree's creation), so `diff -r <repo>/.worktrees/sl2c-pre-build <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly T1. Brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-t1.md`, report `reports/sl2c-t1.md`. Concept v0.5.24 `<repo>/docs/cdp6/konzept-cdp6.md` (committed 092f65d, sha256 98d8f9d9a09084b9669284e054b1dce7fb26761630f390d9dad4ee61ecb3d598). You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims (worker run 78 and the orchestrator):
1. Each of items 1 to 7 of the brief is built as AC-09.15, AC-11.13, AC-11.17 and AC-11.20 to AC-11.23 state, with tests that assert the AC, not only that code runs.
2. No hand-placed record reaches the gate: `lib/probe-record.mjs` accepts a record only with a verifying `accepted.mac` under the label `cdp6-core probe-record v1`; a 64-character sha256 alone, a hook-token MAC, or a MAC without the label does not verify; `guard-shell.mjs` admits owner commands in `auto` only through that reader.
3. Each mutation the report names would turn the named tests red (say where only a run decides).
4. No test was weakened, removed or skipped (name every hunk of the diff above that removes, replaces or loosens an assertion; the report says three hand-placed-record tests were moved to the real accept path and narrow-rule tests were reduced to `Edit`).
5. The six design choices the worker lists are consistent with the concept (§3.4 item 14, §5.2, AC-11.20 to AC-11.23, the probe session paragraph) or name where they decide something the concept leaves open; the team-row fixture of choice 6 cannot open any gate.
6. The `Edit(...)` change in `lib/user-settings.mjs` matches §5.6 items 9 and 10 and AC-09.15, and `missingRules` still reports every missing `Edit(...)` and `Read(...)` rule and sandbox entry it reported before.
7. The v0.5.24 hunks carry run 77's findings 🟡-1 to 🟡-3 and 🟢-1 to 🟢-3 without contradicting an unchanged line.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 45 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
