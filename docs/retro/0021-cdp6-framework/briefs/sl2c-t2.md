# Brief SL-2c T2: the stop guard for a finished agent without a capture, and the spawn deny of a capture-bound role (stage-1 worker run 80)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34, condition (3): a run fails loud on a finished agent without a capture instead of letting the main session improvise; retro 0021-S1 RC-E); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format (final answer, handback only, no file): acknowledgement line; status; per item A1 to A7 and per AC: test titles, red run with the failing reason, green run; files changed with line counts; the four gate commands with real exits and last lines, on the final tree; open questions. State only mutation results you ran. No test weakened, removed or skipped. At most 1000 words.

Target state:
- Worktree `<repo>/.worktrees/sl2c`, holding the uncommitted T1 diff on top of 1d04d1a (report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2c-t1.md`, review `reports/sl2c-t1-rv.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2c && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.25 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 a49892502524e63e1116e93f6d562ff36e50cca5bfb1661915f5f2abb20ced16): UC-12 Route, step 2 (line 891), step 7 (line 896), the UC-12 error row (line 908), the SL-2c row (line 1681, parts (2) and (3)), and the ACs below; hook facts in `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/hooks.md` (SubagentStop input with `agent_id`, `agent_type`, `last_assistant_message`, around :2608-2616).

Items, part A: the T1 fixes of `review-verify` run 79 (`reports/sl2c-t1-rv.md`; concept v0.5.25, sha256 a49892502524e63e1116e93f6d562ff36e50cca5bfb1661915f5f2abb20ced16, diff `reports/concept-v0524-v0525.diff`), each first as a red test:
A1. 🟡-A: add the counter-test CT-1 unchanged to the suite (`.worktrees/sl2c-audit/plugins/cdp6-core/lib/probe-record-label.test.mjs`; the orchestrator showed it red under a label mutation); show it red by a stated mutation you run, then revert.
A2. 🟡-B: add CT-2 unchanged (`.worktrees/sl2c-audit/plugins/cdp6-core/checks/probe-check-session.test.mjs`, red on T1 with `row-duplicate` and `row-verdict`); key the probe rows by row, mode and settings sha256 and accept the verdict `launch-refused` for an A-5 `bypassPermissions` row under a settings file with `permissions.disableBypassPermissionsMode` (concept §11.1 probe-session paragraph, v0.5.25); `passed` and the owner-mode check of `guard-shell.mjs` still read only the rows whose mode prompts.
A3. 🟡-C: `run.mjs probe --accept` stamps `accepted.by: "owner"` and `accepted.at` under the record MAC, and, when a run is active, writes the stamped owner record into that run's `run.json` (UC-11 step 1, v0.5.25); tests for both cases.
A4. 🟢-A: add CT-3 unchanged (the test appended to `.worktrees/sl2c-audit/plugins/cdp6-core/scripts/run.test.mjs`, red on T1) and drop `'A-5'` from the rows of the team fixture so that it opens neither A3 nor the team-probe gate.
A5. 🟢-B: remove the command-line entry of `checks/probe-check.mjs`, so that `run.mjs probe --accept` is the only path that signs and writes a record; adjust its tests without weakening any assertion on the accept logic.
A6. 🟢-C: align the test titles with AC-11.21 ("fires: probe row without mode" and the other titles the AC names) and exercise AC-11.13's "written before `run.mjs init`" and the `<version>.md` name.
A7. 🟢-D: rows that are neither accepted in stage 1 nor team rows are named in `left_for_sl8` and in the owner prompt reason as "(left for SL-8)".

Items, part B, T2 (each AC first as a red test, then the code):
1. AC-12.33 (line 946): `hooks/observe-stop.mjs` on `SubagentStop` of a capture-bound `cdp6-core:` role whose bound spawn has no capture writes `finished_at` to that spawn through `lib/counters.mjs` (the one writer of `counters.json`), records a `hooks-fired.jsonl` line through `lib/hooks-observed.mjs`, and never blocks; registration in `hooks/hooks.json` with the matcher the concept names.
2. AC-12.34 (line 947): with a spawn that has `finished_at` and no capture, `guard-phase.mjs` denies an `Agent` or `Task` spawn, a `SendMessage` (add `SendMessage` to its matcher), and every Edit, Write and NotebookEdit call of the active run, inside and outside the phase directories, each with the stop-guard reason that names the cause and the owner's way out; one test per case as the AC lists them.
3. AC-12.36 (line 949) and UC-12 step 7: `guard-shell.mjs` denies on Bash, PowerShell and Monitor every `run.mjs` call except `run.mjs status` and every shell call outside the read-only allowlist of step 7 (`ls`, `cat`, `head`, `tail`, `wc`, `grep`, `rg`, `sha256sum`, `date`, `pwd`, `git status`, `git log`, `git diff`, `git show`, without an output redirect, a pipe into a command outside the list, or a command substitution), so every write and every call that starts `claude` is denied; per concept v0.5.25 the allowlist has no `rg`, and an allowed command with a flag that writes a file or runs a program (`--output`, `--ext-diff`, `--textconv`, `-c`, `--config`, `--exec`) is denied; allowed calls pass; after the owner marks the spawn `void` the calls get their normal decision.
4. AC-12.35 (line 948) and UC-12 step 2: `guard-spawn.mjs` denies a second spawn of a capture-bound role while a bound spawn of that role is pending without a capture, whatever the task.
5. The deny of items 2 and 3 holds in every permission mode (step 7; Q-19 keeps open whether it stays after SL-2b).

Out of scope: T1's files except where an item needs a call into them; `scripts/preflight.mjs` (T3); `check-stop.mjs` (SL-2b); any file outside `plugins/cdp6-core/`; the concept.

Rules, gate commands, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-t1.md`.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1 diff)
baseline: the orchestrator's re-run of the four gates after T1 (ledger 0021)
run grant: impl-uc, 3 uses confirmed by the owner 2026-11-06T08:56:41+01:00, this run the second

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
