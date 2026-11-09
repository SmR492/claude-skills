# Brief: review-verify of SL-2c T2 with the T1 fixes, and concept v0.5.25 (stage-1 worker run 81)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §11.3 item 4 and §0 item 27.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0524-v0525.diff` (5 hunks), whether run 79 supports it and whether it contradicts an unchanged line; then findings ranked 🔴 🟡 🟢 with one closing proposal each and, for a code claim, a counter-test as complete `node:test` code (file, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the expected result; then status. At most 1300 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2c` (base 1d04d1a, uncommitted T1 and T2 diffs); the tree before T2 is `<repo>/.worktrees/sl2c-pre-t2/` (diff -r exit 0 when copied), so `diff -r <repo>/.worktrees/sl2c-pre-t2 <repo>/.worktrees/sl2c/plugins/cdp6-core` is exactly run 80. Brief `briefs/sl2c-t2.md`, report `reports/sl2c-t2.md`, the T1 review `reports/sl2c-t1-rv.md` (findings and counter-tests CT-1 to CT-3). Concept v0.5.25 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 a49892502524e63e1116e93f6d562ff36e50cca5bfb1661915f5f2abb20ced16). Docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/`. You wrote no part of it. `<repo>` = the repository root.

Claims (worker run 80):
1. A1 to A7 close run 79's 🟡-A, 🟡-B, 🟡-C and 🟢-A to 🟢-D as the brief states; CT-1 and CT-2 are in the suite unchanged.
2. B1 to B5 build AC-12.33 to AC-12.36 and UC-12 steps 2 and 7 of v0.5.25, with tests that assert the AC, and the stop guard denies in every permission mode.
3. `lib/shell-allowlist.mjs` admits only the read-only calls of step 7 and cannot be bypassed by quoting, separators, substitutions, abbreviated long options, PowerShell or Monitor syntax; name any input that passes but writes, runs a program or names `run.mjs` other than `status`.
4. The existing tests changed because of AC-12.35 (guard-spawn, inject-contract, run.test A8) keep their assertions; no test was weakened, removed or skipped (name every hunk that removes, replaces or loosens an assertion, including the removed probe-check CLI tests).
5. Each mutation the report names would turn its tests red (say where only a run decides).
6. The worker's open questions and follow-ups: (a) the `refused` alias for the A-5 bypass launch row, (b) CT-3 turned into a test of `signedRecord` by stripping A-5, (c) unreadable counters give no stop decision for SendMessage, Agent and Task, (d) a repository git config (`diff.<driver>.textconv`, `core.fsmonitor`, `core.pager`) can run a program on an allowed `git` call, (e) `date -s`; for each say whether it is a defect against the concept and propose the closing change (concept text or code).
7. The v0.5.25 hunks carry run 79's 🟡-B, 🟡-C and 🟢-E without contradicting an unchanged line.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 50 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
