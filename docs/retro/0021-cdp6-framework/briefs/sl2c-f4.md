# Brief SL-2c F4: the fixes of review-verify run 96 (stage-1 worker run 97)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format, rules, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-f1.md` (at most 900 words); no real preflight run. Scratch output only under `<scratchpad>/f4/`. You have at most 60 minutes; the run grant expires 2026-11-09T10:11:35Z.

Target state: worktree `<repo>/.worktrees/sl2c` after F3 (report `reports/sl2c-f3.md`, review `reports/sl2c-f3-rv.md`; snapshot `<repo>/.worktrees/sl2c-pre-f4/`). Specification: concept v0.5.31 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 29cbd6c2d2ea38418d6854857e1204c97c8a6e2fb98145d93e53f0577d7fd216; what changed: `reports/concept-v0530-v0531.diff`, 6 hunks): UC-14 step 5 checks (a), (c) and (i) (line 1020), AC-11.26 (line 885), AC-12.34 (line 952), AC-14.11, AC-14.15, AC-14.18 (lines 1045, 1049, 1052).

Items (each first as a red test, then the code; the counter-tests are in `<repo>/.worktrees/sl2c-audit6/plugins/cdp6-core/`, each executed red on the F3 tree by the orchestrator):
1. 🟡-1: add "fires: a Claude Code process and a stdio MCP child in the process group of the preflight are skipped" and its control unchanged; check (c) skips no process of the preflight's own process group (remove the skip of F3's A5); the F3 test "fires: pipeline sibling of the preflight flagged" becomes "a pipeline sibling of the preflight is flagged" and asserts the sibling is flagged.
2. 🟢-2: add "fires: a project Cd deny rule with a path passes the allowlist" unchanged; check (i) admits `permissions.ask` and `permissions.deny` rules only as bare tool names (any rule containing `(` fails, ask rules included); add "fires: a project ask rule with a specifier passes the allowlist"; the passing test uses bare tool names.
3. 🟢-3: add "fires: a test file writes probe records outside signedRecord" unchanged; `rewriteRecord` in `scripts/preflight.test.mjs` goes through `signedRecord`.
4. 🟢-4: the glob test "fires: a denyRead glob in the project settings is left out of the counted paths" gains `passes(res, 'sandbox-profile')`; "managed-hooks-only outside managed settings passes" is retitled as AC-14.18 states.
5. 🟢-5: "fires: TaskStop passes with unreadable counters" for the deny that F3 built.

Out of scope: everything else; any file outside `plugins/cdp6-core/`; the concept.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1, T2, T3, F1, F2 and F3 diffs)
baseline: the orchestrator's re-run of the four gates after F3 (ledger 0021: 822/822 with an empty TMPDIR, 295/295, skill-lint 0, secrets-scan 0)
run grant: impl-uc, 2 uses confirmed by the owner 2026-11-09, this run the second

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
