# Brief SL-2c F1: the stop path fixes of concept v0.5.27 and v0.5.28 (stage-1 worker run 89)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format (final answer, handback only, no file): acknowledgement line; status; per item below and per AC: the test titles, the red run with the failing reason, the green run; files changed with line counts; the four gate commands with real exits and last lines, on the final tree; every earlier test you changed, with the concept sentence that changes it; open questions. No test weakened, removed or skipped. At most 1200 words.

Target state:
- Worktree `<repo>/.worktrees/sl2c`, holding the uncommitted T1, T2 and T3 diffs on top of 1d04d1a (702 tests green; frozen copy `<repo>/.worktrees/sl2c-final/`). Every Bash call starts with `cd <repo>/.worktrees/sl2c && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.28 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 39a1f679652b0f049a96f3075dcfa1dde95ff416560d4aeb16a94dfa983e7884): §1.2 (lines 55-67), UC-12 steps 2, 3 and 7 (lines 895, 896, 900), the UC-12 error rows, AC-12.33 to AC-12.37 (lines 951-955), the `counters.json` row (line 1228), the SL-2c row (line 1691, part (2) and (3)). What changed: `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0526-v0527.diff` and `concept-v0527-v0528.diff`; why: `reports/sl2c-slice-reviews.md` and `reports/concept-v0527-rv.md`.

Items (each first as a red test, then the code; every AC test title of the concept exists verbatim):
1. Counter-tests, added unchanged from `<repo>/.worktrees/sl2c-audit3/plugins/cdp6-core/` (the orchestrator ran each red on the frozen tree): `lib/shell-allowlist-ifs.test.mjs`, `lib/shell-allowlist-arith.test.mjs`, and the test "fires: arithmetic expansion during uncaptured stop" appended there to `hooks/guard-shell.test.mjs`. Do not add `lib/counters-void-writer.test.mjs`: it belongs to AC-12.20 in SL-3.
2. The inverted allowlist with its lexer (UC-12 step 7, AC-12.36): only the named commands with only their named short flags; the lexer of v0.5.28 with the flag and operand test after quote removal; `date` with exactly one token; separators and pipes as stated; the three denied cases of v0.5.28 (`cat "'" $(touch p) "'"`, `ls '-S'`, `grep ''--filt=x y f`).
3. `stopFor(input, env)` (UC-12 step 7, AC-12.37): one fail-closed lookup used by every guard; an unreadable run pointer, `run.json` or `counters.json`, a missing `counters.json` of an active run, and an active stop each return a deny reason; `guard-shell.mjs` no longer fails open on a lookup error.
4. Stop matchers (AC-12.34): `EnterWorktree` and `mcp__.*` are denied during a stop; `Skill` as the concept states.
5. `observe-stop.mjs` (AC-12.33): the outcome line, the busy-lock line, the capture-bound role set defined once, and the v0.5.28 stop entry for a finished capture-bound agent of an active run without a bound spawn, written through `lib/counters.mjs`, on which the guards fire.
6. The spawn rules (UC-12 steps 2 and 3, AC-12.35): the exclusive-role deny counts only bound spawns without a capture; the deny reason lists unbound pending spawns with the owner's way out; the binding refuses when two unbound spawns of a role are pending, with its test.

Out of scope: the probe record, `run.mjs probe`, the preflight and every other item of the SL-2c row's parts (1) and (4) (brief F2 follows); the AC-12.20 resolver; any file outside `plugins/cdp6-core/`; the concept.

Rules, gate commands, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-t1.md`; additionally run gate 1 once with `TMPDIR` set to an empty directory made by `mktemp -d` and report it.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1, T2 and T3 diffs; snapshot `<repo>/.worktrees/sl2c-pre-f1/`)
baseline: the orchestrator's re-run of the four gates after T3 (ledger 0021)
run grant: impl-uc, confirmed by the owner (ledger 0021)

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
