# Brief SL-2c F3: the fixes of review-verify run 92 and the fresh audit run 93 (stage-1 worker run 95)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format, rules, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-f1.md` (at most 1300 words), plus one real run of `node plugins/cdp6-core/scripts/preflight.mjs` against the live configuration as in `briefs/sl2c-t3.md` (expected to fail on items the live configuration does not yet hold). Write scratch output only under `<scratchpad>/f3/`.

Target state: worktree `<repo>/.worktrees/sl2c` after F2 (reports `reports/sl2c-f2.md`, `sl2c-f2-rv.md`, `sl2c-audit-2.md`; snapshot `<repo>/.worktrees/sl2c-pre-f3/`). Specification: concept v0.5.30 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 633d309995352f2236e74cee0752fd7a32020c875f1e6f4f1215aaed4fc2ff0e; what changed: `reports/concept-v0529-v0530.diff`): UC-11 step 1 (line 833), AC-11.22, AC-11.24, AC-11.26 (lines 881, 883, 885), UC-12 step 7 and its error row (lines 900, 912), AC-12.33, AC-12.34, AC-12.36 (lines 951, 952, 954), UC-14 step 5 checks (c) and (i) (line 1020), AC-14.11, AC-14.15 (lines 1045, 1049), §5.6 recognition (from line 1316), the probe record paragraph (line 1652), §1.2 (line 64), Q-27 to Q-29.

Items, part A: run 92 (each first as a red test, then the code):
A1. 🟡-1: add `<repo>/.worktrees/sl2c-audit5/plugins/cdp6-core/lib/running-version-npm-bin.test.mjs` unchanged (the orchestrator ran both tests red on the F2 tree: the walk returned 2.1.318 instead of 2.1.322, recognition false); the recognition rule resolves the `node` script argument by its real path before the package test.
A2. 🟡-2: every AC-14.11 test title exists in the file the AC names, the IDE-bundled case included.
A3. 🟡-3 (orchestrator decision, it changes a counter-test of run 84): "fires: a record for the PATH binary does not admit auto when the running version is not established" runs with no Claude Code ancestor (the version is then not established), so its result does not depend on the Claude Code version of the host; keep its title and its assertion; show it red by a mutation that admits owner commands without an established version.
A4. 🟢-1: the AC-11.26 static test admits `writeProbeRecord(` in test support only inside `signedRecord`.
A5. 🟢-3: check (c) skips processes in the preflight's own process group.
A6. 🟢-2 and 🟢-4: the `Session id:` line and the calibration refusals as the record paragraph states; the AC-11.24 title "fires: calibration rows with a non-positive per_path"; the AC-12.33 `void` title as the concept names it.

Items, part B: run 93 (each first as a red test, then the code):
B1. F-1 and NV-1: check (i) as the allowlist of v0.5.30 (`$schema`, `permissions.ask`, `permissions.deny` rules without a path specifier). Add the counter-tests appended to `<repo>/.worktrees/sl2c-audit5/plugins/cdp6-core/scripts/preflight.test.mjs` (the orchestrator ran them red, control green). Orchestrator decision: in "fires: a denyRead glob in the project settings is left out of the counted paths" the assertion `passes(res, 'project-settings')` becomes a failure of `project-settings` naming `sandbox`, as AC-14.15 states; every other line stays. The F2 test "a project with none of the widening keys passes, also with an empty allow list and other keys" gives way as AC-14.15 states.
B2. F-2: the `probe --accept` owner reason lists the A-12 calibration columns and the derived `per_path` and `base`; add "fires: accept reason hides the A-12 calibration columns check (a) uses" from the audit5 copy of `hooks/guard-shell.test.mjs` unchanged.
B3. F-3: add "fires: dangerouslyDisableSandbox passes the stop allowlist" from the same copy unchanged; `guard-shell.mjs` denies it during a stop.
B4. NV-2 and NV-3: during a stop `Skill` is denied (AC-12.34 replaces "skill call passes after uncaptured finished agent"); `TaskStop` gets `ask` while a capture-bound spawn of the active run has no capture; the matchers in `hooks/hooks.json` as §1.2 states.

Out of scope: the probe rows A-25 and A-26 (owner probe session); F1 and F2 items unless a test of this brief shows a gap (report it); any file outside `plugins/cdp6-core/`; the concept; the live configuration files.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1, T2, T3, F1 and F2 diffs)
baseline: the orchestrator's re-run of the four gates after F2 (ledger 0021: 801/801 with an empty TMPDIR, 295/295, skill-lint 0, secrets-scan 0)
run grant: impl-uc, confirmed by the owner (ledger 0021)

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
