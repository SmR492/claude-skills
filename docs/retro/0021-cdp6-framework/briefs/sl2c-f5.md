# Brief SL-2c F5: the fixes of review-verify run 98 (stage-1 worker run 99)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format, rules, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-f1.md` (at most 600 words); no real preflight run. Scratch output only under `<scratchpad>/f5/`.

Target state: worktree `<repo>/.worktrees/sl2c` after F4 (report `reports/sl2c-f4.md`, review `reports/sl2c-f4-rv.md`; snapshot `<repo>/.worktrees/sl2c-pre-f5/`). Specification: concept v0.5.32 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 ec5e0d7ae78242576edf68d433d99ad83d4864e4f34abf8bdfc41387727f51ff; what changed: `reports/concept-v0531-v0532.diff`, 8 hunks): UC-14 step 5 check (c) (line 1020), AC-14.11 (line 1045), AC-12.34 (line 952).

Items (each first as a red test, then the code):
1. 🟡-1: add "fires: a Claude Code ancestor of the preflight other than the orchestrator passes the process check" unchanged from `<repo>/.worktrees/sl2c-audit8/plugins/cdp6-core/scripts/preflight.test.mjs` (the orchestrator ran it red on the F4 tree); in `scripts/preflight.mjs` check (c) the preflight's own ancestors are skipped only for the "below a Claude Code process" clause, so a Claude Code process other than `--orchestrator-pid` is flagged also when it is an ancestor; every other check (c) test stays green.
2. 🟢-2: "fires: TaskStop passes with unreadable counters" in `hooks/guard-phase.test.mjs` matches the deny reason with `/counters\.json/` only; show it red by the mutation that returns `{ spawns: [] }` from `openCaptureBound` on a counters error, then restore.

Out of scope: everything else; any file outside `plugins/cdp6-core/`; the concept.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1 to T3 and F1 to F4 diffs)
baseline: the orchestrator's re-run of the four gates after F4 (ledger 0021: 828/828 with an empty TMPDIR, 295/295, skill-lint 0, secrets-scan 0)
run grant: impl-uc, confirmed by the owner (ledger 0021)

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
