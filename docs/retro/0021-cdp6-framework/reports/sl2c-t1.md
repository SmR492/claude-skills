# SL-2c T1 (impl-uc, stage-1 run 78): final answer as handed back (summary; design choices verbatim in substance)

Brief: `briefs/sl2c-t1.md`. contract: v2 f91736a60d15. Status: seven items built test-first; four gates exit 0 on the final tree (worker's run): cdp6-core 598/598 (baseline 542), CDP5 295/295, skill-lint 0, secrets-scan 0 (71 files). No commit.

Per AC (worker's statements; red and mutation runs are the worker's):
- AC-11.23, AC-11.13 reader: `lib/probe-record.test.mjs` 10 tests; red on missing export, then 8 behavioural reds; green 10/10; mutations run: label removed from the HMAC turns the label test red; MAC check removed from `readProbeRecord` turns 9 tests red across lib, guard-shell and run suites ("fires: hand-placed probe record opens auto", "fires: probe record not accepted").
- AC-11.21, AC-11.22 checker: `checks/probe-check.test.mjs` 29 tests; red against a not-built stub 29/29; green 29/29; mutations: dropping the `permission_mode` hook-line check, dropping the version comparison, each turns its tests red.
- AC-11.20 and the AC-11.22 owner reason: `hooks/guard-shell.test.mjs` red on 3 ("fires: probe accept without file hash", "fires: accept reason shows hash only", "fires: probe accept in a mode other than default without an accepted record"), green 49/49; four further guard tests were green on first run for a weak reason (unknown subcommand already denied); mutations: single-hash deny removed, rows part of the reason removed, each turns its test red.
- AC-20 `run.mjs` side: `scripts/run.test.mjs` 152/152 green after `cmdProbe`, red before.
- AC-09.15, AC-11.17 `Edit(...)` form: new tests "fires: Write rule counted as file deny rule", "fires: key file editable with only a Write rule", "a Write rule is not required and its absence is not reported"; 2-line change in `lib/user-settings.mjs`; three hand-placed-record tests moved to the real accept path.
- Item 7: `guard-shell.mjs` passes `env` to the verified reader; test "fires: a record accepted for the running version admits auto only for a mode its A-5 row shows to prompt".

Files: new `checks/probe-check.mjs` 119, `checks/probe-check.test.mjs` 242, `lib/probe-record.test.mjs` 116, `test-support/probe-fixture.mjs` 59; changed `hooks/guard-shell.mjs` 14, `hooks/guard-shell.test.mjs` +113, `lib/probe-record.mjs` 93, `lib/run-argv.mjs` +2, `lib/run-argv.test.mjs` +11, `lib/user-settings.mjs` 4, `scripts/run.mjs` 23, `scripts/run.test.mjs` 173.

Design choices the worker made and asks to confirm:
1. Markdown record table `| Row | Mode | Claude Code | Settings sha256 | Verdict | Agent id | cdp6-core |`, parsed by `parseProbeMarkdown` in `lib/probe-record.mjs`; verdicts A-5 `prompt`/`no-prompt`, A-12 `refused`/`not-refused`, A-23 `handback`/`no-handback`; agent id and cdp6-core version only for the A-23 `auto` row; the probe session's record must use this layout.
2. JSON: `rows['A-5'].modes[mode] = {prompt, claude_version, settings_sha256}`; `passed` only if every A-5 mode prompts; `accepted = {sha256, at, mac}`; MAC = HMAC over `cdp6-core probe-record v1`, NUL, key-sorted canonical JSON without `accepted.mac`.
3. `run.mjs` imports `acceptRecord` in process; the checker's CLI fails closed in a sandbox (host key unreadable).
4. A red A-23 `auto` row is refused (`a23-auto-red`), not recorded.
5. `probe --accept` writes no owner record into `run.json` (it can run without an active run).
6. "fires: team refused in stage 1 even with an accepted record" uses `signedRecord` (production signer) on a record with team rows, which breaks the brief's "no hand-placed fixture" rule for that one case; the record only produces a refusal.

Follow-ups not changed: `guard-files.mjs` protection of `<data>/probes/` (SL-4 part of AC-11.13). A stray `git checkout -p` hung without stdin and was killed; `git status` showed no loss; gates ran after it.
