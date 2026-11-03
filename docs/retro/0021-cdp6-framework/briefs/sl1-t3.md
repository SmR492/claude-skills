# Brief SL-1 T3: T2 corrections and phase guard (stage-1 worker run 15 of cap 45)

Objective (owner, verbatim): "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind." Continuation of SL-1 with the T2 corrections approved by the owner on 2026-11-02 ("go with your recommendations"; ledger 0021).

Output format (final answer, handback only, no file): acknowledgement line; status; part A: per correction the test, its red run (command, exit, failing assertion) and green run; part B: per AC one row with test file and title, red run with the reason, green run; files created or changed with line counts; the gate commands with real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one AC or one correction; where a batch is unavoidable, say why. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, holding the uncommitted T1 and T2 diff (`.claude-plugin/marketplace.json`, `plugins/cdp6-core/`). First command, on its own: `cd <repo>/.worktrees/sl1`.
- T2 report: `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-t2.md`. Its review (review-verify, stage-1 run 14) and the orchestrator found the defects of part A; the orchestrator confirmed them against the code.
- Specification: the concept v0.4.9 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, read only; the worktree copy is v0.4.8 and lacks the `session_id` field of UC-10 step 6). Line numbers below refer to that file. Plan: `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md` of the main checkout.

Part A, T2 corrections (first, each test-first):
1. AC-09.15 (line 768): `lib/user-settings.mjs` (around lines 94-100) checks each deny rule against several samples, all of which must be covered: under `<P>` the files `scripts/run.mjs`, `hooks/guard-shell.mjs`, `lib/hook-key.mjs` and a nested dummy path; under `<data>` the files `hook-nonces.jsonl`, `active-runs.json` and `probes/x.json`. `scripts/run.test.mjs` gains a fixture with narrow rules (one file per directory) that must exit 2, and the missing cases that drop `Write` on `counters.json` and `Write` on `verdicts/`.
2. AC-11.18 (line 863): the leak test (`scripts/run.test.mjs` around lines 986-1000) keeps each case's own token and searches stdout, stderr and the journal for that token, for every exit-2 case of the test.
3. Origin (line 250; owner decision 2026-11-02): a URL origin requires `--fetched <date>` (ISO 8601 date) together with `--http-status`; `R/idea/intake.md` records the fetch date and the status; `init` refuses a URL origin missing either. Add the flag to the parser of `lib/run-argv.mjs`.
4. Owner record (line 820; owner decision 2026-11-02): `decision D-n decided` is an owner form, and writes an owner record, whenever the decider is not the run's own executor role (`EXECUTOR[run.mode]`), not when it is any of the three roles. Change `lib/run-argv.mjs` (around line 150) and `scripts/run.mjs` (around line 496) together: `guard-shell.mjs` obtains the mode from the run lookup of §1.4 item 2; with no readable bound run it treats the call as an owner form (`ask`). Tests: in a `single` run, decider `orchestrator` gives `ask` from the guard and an owner record from `run.mjs`; decider `operator` gives neither.
5. Test hygiene: `hooks/guard-shell.test.mjs:65` asserts `/owner command/`; `hooks/bootstrap.test.mjs:40` and `:43` compare with `buf.equals(known)` and a fixed message; `hooks/guard-shell.test.mjs:45` drops `res.raw` from the assertion message.
6. AC-11.5 (line 850, §0 item 11, UC-10 step 7): an owner command under `permission_mode` `bypassPermissions` is denied; `default`, `acceptEdits` and `auto` return `ask` (the A-5 probe showed the prompt in those three). Fix `hooks/guard-shell.mjs:11` and the test "fires: approve under bypass mode", which today expects `ask`.
7. `lib/hook-key.mjs`: a token whose issue time is later than the current time is refused like a stale one (same exit, same no-print rule).
8. `scripts/run.mjs` `cmdSetAutonomy` (around lines 437-440): the active-run check is repeated inside the `updateRun` mutation, as T2 did for the other subcommands. One end-to-end test runs the command string from `guard-shell.mjs`'s `updatedInput` through `sh -c` into `run.mjs` and shows it accepted, and the same string with one token character changed refused.

Part B, T3 of SL-1 (concept line 1608, plan row T3):
- `hooks/guard-phase.mjs` on PreToolUse with the named matchers `Agent|Task|Bash|PowerShell|Monitor|Edit|Write|NotebookEdit` (UC-10 Route, line 773): step 1 (run lookup via `lib/run-store.mjs`, missing pointer with an active `run.json` denies, no active run gives no decision), step 3 (`run.mjs enter <phase>` without the predecessor's exit record denies; parse the command with `lib/run-argv.mjs`), the error case `run.json` unreadable (deny with the reason). Steps 2, 4, 7 and 8 and the catch-all `"*"`, PermissionRequest and PermissionDenied registrations come with later slices (CH-46, SL-8); if an AC of this list needs one of them, record it as an open question.
- `hooks observed` line (UC-10 step 6, line 782 of v0.4.9; §5.2 row at line 1192 "every hook"): one shared writer appends to `<data>/hooks-fired.jsonl` hook name, plugin version, time, `session_id`, `tool_use_id`, `permission_mode` and decision; `guard-phase.mjs` and `guard-shell.mjs` call it on every firing; a field absent from the hook input is written as null. `run.mjs enter` already reads `hook` and `session_id` (run.mjs:389); keep that test green.
- `hooks/hooks.json`: `bootstrap.mjs` on SessionStart; `guard-shell.mjs` on PreToolUse `Bash|PowerShell|Monitor`; `guard-phase.mjs` on the named matchers above; every guard entry with `"onFailure": "block"` (UC-10 step 5, §5.4). Commands through `${CLAUDE_PLUGIN_ROOT}`. This closes the T2 brief contradiction (registration in scope, `hooks.json` out of scope), which was the orchestrator's.
- `hooks/bootstrap.mjs`: run status at SessionStart for the sources `startup`, `resume`, `clear` and `compact` (UC-09 step 3, line 736): id, phase, phase state, next allowed action, path of the ledger; silent without an active run; the host-key creation of T2 unchanged.
- Skill `cdp6-core:idea` at `skills/idea/SKILL.md`: the UC-01 route and steps (lines 239-304) as instructions for the main session, with the `run.mjs` commands it names; no rule that the concept does not state. It must pass the skill-lint gate.
- ACs, each with the test file and title its row names: AC-02.5 (the `hooks/guard-phase.test.mjs` title), AC-09.2, AC-09.3, AC-10.2, AC-10.3, AC-10.4, AC-10.6, AC-10.10 (the `hooks/guard-phase.test.mjs` title). Find each row with `grep -n '^| AC-xx.y |'`.

Out of scope: the guard-phase parts named above as later; `guard-files.mjs`, `guard-spawn.mjs` and every other hook of line 55; reading credential deny entries from a `--settings` file (SL-4; in SL-1 they come from user settings only, owner decision 2026-11-02); the `allow` for routine forms (SL-8); anything of SL-2 and later; any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins or to the concept.

Rules: test-first per correction and per AC (write the test, show it red for the reason stated, then implement). Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. The token secret is never printed, logged or written outside the key file, also not in test output or assertion messages. No comments in code. No new dependency. Errors to callers in a structured form without internals. Keep every T1 and T2 test green unless part A changes what it asserts.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted T1 and T2 diff)
baseline: after T2, cdp6 tests 159/159 and CDP5 suite exit 0 (orchestrator re-run 2026-11-02)
run grant: impl-uc may run in <repo>/.worktrees/sl1 until 2026-11-02T18:10:19.260Z, 1 use left (T3), session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept and briefs. No network, no commit. Known from earlier runs: the CDP5 shell guard refuses shell `for` loops, variable assignments and some heredocs; use one command per call or a node script file inside the worktree.

Stop rule: part A first, then part B in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
