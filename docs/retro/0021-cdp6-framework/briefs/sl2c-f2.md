# Brief SL-2c F2: the F1 review fixes, and the probe record and preflight fixes of concept v0.5.27 to v0.5.29 (stage-1 worker run 91)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format, rules, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-f1.md` (at most 1400 words), plus one real run of `node plugins/cdp6-core/scripts/preflight.mjs` against the live configuration as in `briefs/sl2c-t3.md` (expected to fail on items the live configuration does not yet hold).

Target state: worktree `<repo>/.worktrees/sl2c` after F1 (report `reports/sl2c-f1.md`, review `reports/sl2c-f1-rv.md`; snapshot `<repo>/.worktrees/sl2c-pre-f2/`). Specification: concept v0.5.29 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 2bd3645795b1c954cd8563e3ce8aaf44aa8995645f752ff050909b00fc110a79; what changed since v0.5.26: `reports/concept-v0526-v0527.diff`, `concept-v0527-v0528.diff`, `concept-v0528-v0529.diff`): UC-12 step 7 (line 900), AC-12.33 and AC-12.36 (lines 951, 954), §3.4 item 14 (line 228), §5.6 (from line 1316, the recognition rule and the `--settings` protection), UC-11 and AC-11.20 to AC-11.26 (lines 878-885), UC-14 step 5 (line 1020, checks (a) to (j) and the one definition of the counted paths), AC-14.9 to AC-14.19 (lines 1043-1053), AC-16.15 (line 1138), the probe record table and the A-12 and A-24 rows (lines 1648-1650, 1773), §13.1 (line 1938), the SL-2c row parts (1) and (4).

Items, part A: the F1 fixes of `review-verify` run 90 (concept v0.5.29), each first as a red test:
A1. 🔴-1: add `<repo>/.worktrees/sl2c-audit4/plugins/cdp6-core/lib/shell-allowlist-comment.test.mjs` unchanged and append "fires: comment hides a write during uncaptured stop" from that copy's `hooks/guard-shell.test.mjs` (the orchestrator ran both red on the F1 tree, with the bash positive control green); `lib/shell-allowlist.mjs` denies `#` outside quotes.
A2. 🟡-1 raised to 🔴 (the orchestrator ran Windows PowerShell 5.1: it closes a single-quoted string at U+2019): during a stop every character outside printable ASCII, tab and newline denies the call, quoted or not; the third test of A1's file goes green.
A3. 🟢-1: `observe-stop.mjs` records the outcome `void` for the finish of an agent whose bound spawn is marked `void`, with a test.
A4. 🟢-2: `date --iso-8601=seconds` as the `DENIED_IN_STOP` entry "date with an ISO long option during uncaptured stop".

Items, part B (each first as a red test, then the code):
1. Counter-tests, added unchanged from `<repo>/.worktrees/sl2c-audit3/plugins/cdp6-core/` (each ran red on the pre-F1 tree): `checks/probe-check-calibration.test.mjs`, `lib/preflight-proc-install.test.mjs`, `lib/preflight-hooks-off.test.mjs`, the tests appended there to `scripts/preflight.test.mjs` ("fires: --settings file inside a sandbox-writable root", "fires: a denyRead entry that covers .env but not .env.local") and to `hooks/guard-shell.test.mjs` ("fires: a record for the PATH binary does not admit auto when the running version is not established").
2. Running version (§3.4 item 14, AC-11.21, AC-14.12, AC-16.15): the ancestor walk, the PATH cross-check, the refusals, and the deny of owner commands outside `default` when the version cannot be established.
3. Calibration and counted paths (AC-11.24, AC-14.9): the `Counted paths` and `bwrap` argument columns, `probe-check.mjs` writing `rows['A-12'].modes.auto.calibration`, the preflight reading it, one definition of the counted paths for both.
4. Atomic accept (AC-11.25) and the single record writer with reader accessors (AC-11.26).
5. The hook-line check of AC-11.22 filtered by decision and session.
6. Preflight: recognition (AC-14.11, §5.6), the `--settings` location (AC-14.17), the `.env` samples, managed settings as a counted scope (AC-14.19), check (j) over every scope, managed included, with `allowManagedHooksOnly` in managed settings failing with or without a force-enable (AC-14.18), the unbound pending spawns and the stop entries in (g) (F1's `unboundPending` and `uncapturedStop` in `lib/counters.mjs`), same-bytes hashing, per-check error handling, and the static I/O test over every preflight file.
7. The A6 regression test of T3 shown red by a mutation you run and report.

Out of scope: F1's other items unless a test of this brief shows a gap in them (report it; change no F1 test except as part A says); SL-8 acceptance of other rows; any file outside `plugins/cdp6-core/`; the concept; the live configuration files.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1, T2, T3 and F1 diffs)
baseline: the orchestrator's re-run of the four gates after F1 (ledger 0021: 744/744 with an empty TMPDIR, 295/295, skill-lint 0, secrets-scan 0)
run grant: impl-uc, 3 uses confirmed by the owner 2026-11-06, this run the second

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
