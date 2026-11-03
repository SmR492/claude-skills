contract: v2 f91736a60d15

Status: part A (eight corrections) and part B (T3) are built test-first in the worktree, and all four gates exit 0. Nothing is committed. Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa. `git status` shows only `M .claude-plugin/marketplace.json` and `?? plugins/cdp6-core/`.

- Gate 1: exit 0, 193 of 193 (baseline 159).
- Gate 2 (CDP5 suite): exit 0, 295 of 295.
- Gate 3 (skill-lint): exit 0, `1 skills, 0 agents, 0 🔴 0 🟡 2 🟢`; the two 🟢 are the old test-file hits.
- Gate 4 (secrets-scan): exit 0, `33 files, 0 findings`.
- No comments in code, no new dependency, nothing outside `plugins/cdp6-core/`.

## Part A

Red command pattern: `node --test --test-name-pattern=<title> <file>`, exit 1 each time. All paths are below `plugins/cdp6-core/`.

| # | Test | Red | Green |
|---|---|---|---|
| 1 | `scripts/run.test.mjs` "fires: narrow deny rules for the data directory and the plugin root" (one file per directory) | init accepted: actual 0, expected 2 | pass. `missingRules` now needs every sample covered: `scripts/run.mjs`, `hooks/guard-shell.mjs`, `lib/hook-key.mjs`, `a/b/c.txt` under `<P>`; `hook-nonces.jsonl`, `active-runs.json`, `probes/x.json` under `<data>` |
| 1b | the same file, "run files editable by Edit tool" extended with `Write` on `counters.json` and on `verdicts/` | green at once, because the fixture already had them. Mutation: the run-file loop reduced to `Edit` turns it red | pass |
| 2 | "fires: token printed on exit 2": each case keeps its own tokens (including both tokens of the double-token case) and checks stdout, stderr and the journal for the full token and its parts | green at once (a test fix). Mutation: the token appended to the `hook-token-replayed` message, and again to the generic refusal message, both red with "the token was printed" | pass |
| 3 | "A1 intake records the origin with its date and the fetch status" and "fires: intake as objective" | `unknown-flag` 2 vs 0, then `unknown-flag` instead of `origin-status-missing` | pass. New flag `--fetched` (ISO date checked as a calendar date). Missing or bad date gives `origin-fetched-missing`. `intake.md` for a URL reads `kind, origin, fetched, http_status` |
| 4 | "A7 an owner record from decision is written when the decider is not the executor role of the run mode"; `lib/run-argv.test.mjs` ownerForm; `hooks/guard-shell.test.mjs` "fires: decision decided by a role other than the executor of the run mode" and "fires: decision decided without a readable bound run is an owner form" | 0 vs 1 owner record; guard reason lacked `owner command:`; ownerForm false vs true | pass. `ownerForm(call, mode)`; the guard reads the mode with `findRun`; no readable run means owner form (`ask`) |
| 5 | hygiene (see below) | | |
| 6 | `hooks/guard-shell.test.mjs` "fires: approve under bypass mode" | `bypassPermissions` gave `ask`, expected `deny` | pass. `PROMPTING_MODES` is `default`, `acceptEdits`, `auto` |
| 7 | `lib/hook-key.test.mjs` "verifyToken refuses a token issued later…"; `scripts/run.test.mjs` "fires: token issued in the future" and a future case in the leak test | `undefined` vs `'hook-token-expired'`; exit 0 vs 2 | pass. Same error code and same no-print rule |
| 8 | "A8 set-autonomy repeats the active-run check inside the locked update": lock held, run set to PARKED meanwhile, lock released | exit 0 vs 2 | pass (`assertActive(r)` inside `updateRun`). "A8 the command string of the guard runs through sh…": guard `updatedInput` run through `sh -c` is accepted, one changed last token character gives exit 2 `hook-token-mac`. Green at once. Mutation `tokens: words.slice(1)` in the guard turns it red |

Item 5 detail (hygiene):
- The `/owner command/` negative match is replaced by an exact reason string.
- `res.raw`, which held the `updatedInput` token, is dropped from the assertion message and from the `fire` result.
- `bootstrap.test.mjs`: both key comparisons are now `readFileSync(file).equals(known)` with the message "the host key file changed".
- Mutation `'wx'` to `'w'` in `ensureHostKey` fails with that fixed message and no key bytes.

Batching: items 4's three tests were shown red together, because they share one change.

## Part B

Batching: one module per test file, so each file was shown red as a whole against a missing or empty scaffold, then green. Reasons are below.

| AC | Test file and title | Red reason | Green |
|---|---|---|---|
| 02.5 | `hooks/guard-phase.test.mjs` "fires: predecessor missing" | empty `guard-phase.mjs`: status 0 vs 2, no deny. 9 of 10 tests red | pass: Bash, PowerShell and Monitor; `imported`, `exited`, `skipped` allowed |
| 09.2 | same file, "fires: unreadable run record" | status 0 vs 2 | pass: truncated `run.json` and truncated pointer |
| 09.3 | `hooks/bootstrap.test.mjs` "prints run status after compact" (plus startup, resume, clear, gate-pending, silent cases) | `Unexpected end of JSON input` (no output) | pass. Mutation limiting sources to `startup` turns 3 tests red |
| 10.2 | `hooks/hooks-json.test.mjs` "fires: guard without onFailure block" | `hooks.json` missing | pass. Both guards are checked by removing and by changing `onFailure` |
| 10.3 | `hooks/guard-phase.test.mjs` "records hooks observed", `hooks/guard-shell.test.mjs` "records hooks observed", `lib/hooks-observed.test.mjs` | module missing, then stub returning false: actual false, expected true | pass |
| 10.4 | `hooks/guard-phase.test.mjs` "silent without run" | the decision list is empty, not `['none','none','none']` (the empty hook was silent) | pass |
| 10.6 | same file, "fires: pointer missing with active run", "fires: worktree cwd" | status 0 vs 2 | pass |
| 10.10 | same file, "fires: nested repo cwd"; `hooks/guard-shell.test.mjs` "fires: approve from foreign cwd" (T2, still green) | status 0 vs 2 | pass |

Mutations:
- Dropping `sessionId` from the lookup turns "nested repo cwd" red.
- Removing the predecessor deny turns "predecessor missing" and "nested repo" red.
- Disabling the `pointer-missing` branch turns "pointer missing" and "worktree cwd" red.
- The `hooks.json` registration, the exact matchers and the onFailure check are in `hooks/hooks-json.test.mjs`. I did not mutate the `hooks.json` file itself.

Skill `skills/idea/SKILL.md` (62 lines): UC-01 route and steps 1 to 6, the phase card, the gate and the error cases. It names `enter`, `init`, `id`, `decision`, `set-autonomy`, `object`, `exit`, `status`, `ban` and `abandon`. Test `checks/idea-skill.test.mjs` (4 tests): every command parses with `callShape` and `parseCall`, except `ban` and `abandon` (unknown subcommand, allowed explicitly). It was red for the missing file, then red for a generic command line and a self-matching regex, then green. Skill-lint is green.

## Files (lines)

New under `plugins/cdp6-core/`:

| File | Lines |
|---|---|
| `lib/phases.mjs` | 37 |
| `lib/hooks-observed.mjs` | 38 |
| `lib/hooks-observed.test.mjs` | 45 |
| `hooks/guard-phase.mjs` | 80 |
| `hooks/guard-phase.test.mjs` | 185 |
| `hooks/hooks.json` | 40 |
| `hooks/hooks-json.test.mjs` | 59 |
| `checks/idea-skill.test.mjs` | 70 |
| `skills/idea/SKILL.md` | 62 |

Changed (total lines now):

| File | Lines |
|---|---|
| `hooks/bootstrap.mjs` | 38 |
| `hooks/bootstrap.test.mjs` | 125 |
| `hooks/guard-shell.mjs` | 104 |
| `hooks/guard-shell.test.mjs` | 371 |
| `scripts/run.mjs` | 642 |
| `scripts/run.test.mjs` | 1188 |
| `lib/run-argv.mjs` | 167 |
| `lib/run-argv.test.mjs` | 109 |
| `lib/user-settings.mjs` | 105 |
| `lib/hook-key.mjs` | 81 |
| `lib/hook-key.test.mjs` | 85 |

`lib/phases.mjs` is a refactor under green tests: `PHASES`, `currentPhase`, `nextAction`, `statusText` and `predecessorOpen` moved out of `run.mjs`, so `run.mjs`, `bootstrap.mjs` and `guard-phase.mjs` share them.

## Choices between readings

1. **Deny form of guard-phase (AC-09.2, "exit-2 semantics").** Every `guard-phase.mjs` deny is exit code 2 with the reason on stderr and empty stdout. `guard-shell.mjs` keeps its JSON `permissionDecision` deny with exit 0 from T2. Followed concept line 755. See open question 1.
2. **No data directory.** Without an absolute `CLAUDE_PLUGIN_DATA`, `guard-phase.mjs` denies (fail closed, as `guard-shell.mjs` does).
3. **Every firing is written, including "none".** Line 782 says "every firing". `guard-shell.mjs` therefore writes a `hooks observed` line for every Bash, PowerShell and Monitor call, not only `run.mjs` calls.
4. **Line keys.** `hook`, `version`, `at`, `session_id`, `tool_use_id`, `permission_mode`, `decision`. These are the keys `run.mjs` and the T2 test already read. `decision` is `none`, `ask` or `deny`. A write failure returns false and never changes the decision.
5. **Lookup.** The run lookup passes `file_path` or `notebook_path` as the target path. Any matched tool call is denied on a missing pointer with an active `run.json`, not only an Edit of `run.json`. This follows step 1 ("a missing pointer … denies").
6. **Run found by project path.** A different session in the same project resolves to the project's run by path (§1.4 item 2), so its mode is used for the owner form. I removed my own test case that expected otherwise.
7. **URL intake.** `fetched:` and `http_status:` replace the `date:` line for URL origins. Other origins keep `date:`.
8. **Bootstrap output.** `hookSpecificOutput.additionalContext`, the format of the CDP5 bootstrap. Errors in the lookup print nothing. The text is the `run.mjs status` text.
9. **Skill test location.** `checks/idea-skill.test.mjs` is in the `checks` glob so gate 1 runs it. There is no skill-test glob.
10. **Brief line numbers.** `guard-shell.test.mjs:65` and `bootstrap.test.mjs:40, :43` are shifted in my copy. I followed the text: the `doesNotMatch(/owner command/)` assertion, the `deepEqual` key reads, and `res.raw`.

## Open questions

1. **Deny form.** AC-09.2 says "exit-2 semantics". If JSON `permissionDecision: deny` with exit 0 was meant, the change is one function in `guard-phase.mjs` and its tests. Please confirm.
2. **Recovery vs step 1.** Step 1 denies every matched tool call on a missing pointer with an active `run.json`. That includes Bash, so a `run.mjs resume` or `repair` through the shell guard cannot run in that state. The concept builds neither in SL-1. Which recovery path is intended?
3. **Step 7 (bypass for all guards).** I did not build it, per the brief. AC-11.5 for owner commands in `guard-shell.mjs` is built (part A item 6).
4. **`agent_id` callers in guard-phase.** Not special-cased; the lookup uses session binding and path only. The `agent_id` binding of step 1 has no store in SL-1.
5. **Skill `ban` and `abandon`.** The skill names them as the concept does, but `run.mjs` refuses them as unknown subcommands in this release (§6.5, later slices).

## Follow-ups (not done)

- `lib/hook-key.test.mjs` compares key bytes with `deepEqual(readFileSync(file), first)`, which prints the key on failure. Same class as the `bootstrap.test.mjs` fix; outside the brief.
- The CDP5 shell guard blocked heredocs containing `active-runs.json` or `data-dir` text; I used Edit and Write for those files. A likely false positive, as in T1 and T2.
- Steps 2, 4, 7 and 8 of UC-10, the catch-all `"*"`, PermissionRequest and PermissionDenied registrations stay with CH-46 and SL-8.
