# SL-1 T2 impl-uc handback (stage-1 run 13), saved by the orchestrator 2026-11-02

contract: v2 f91736a60d15

T1 corrections (part A) and all 15 T2 ACs (part B) are built test-first in the worktree, and all four gates exit 0. Nothing is committed. Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa. `git status` shows only `M .claude-plugin/marketplace.json` and `?? plugins/cdp6-core/`.

## Status
- Gate 1 exit 0, 159 of 159 tests (92 after part A, up from 83).
- Gate 2 (CDP5 suite) exit 0, 295 of 295.
- Gate 3 (skill-lint) exit 0, `0 skills, 0 agents, 0 🔴 0 🟡 2 🟢`; the two 🟢 are the T1 test-file hits.
- Gate 4 (secrets-scan) exit 0, `24 files, 0 findings`.
- No comments in code, no new dependency, nothing outside `plugins/cdp6-core/`.
- hooks.json is not created. This is open question 1.

## Part A (red command: `node --test --test-name-pattern=... scripts/run.test.mjs`, exit 1 each time)
| # | Test | Red (failing assertion) | Green |
|---|---|---|---|
| 1 | "A1 intake records the origin with its date and the fetch status", "A1 the intake-as-assignment shortcut keys on the origin kind conversation" | intake.md lacked `date:` (actual `'kind: idea\norigin: conversation\n\n…'`); `origin: conversation 2026-11-02` gave 2 where 0 expected | pass |
| 2 | "A2 resolves a commit import whose ref contains a slash"; "A2 fires: path argument under a credentials deny entry of the user settings" | `{"error":"file-missing"}`, 2 vs 0 for `origin/main`; credentials path accepted (0 vs 2) | pass |
| 3 | "A3 init refuses when the active-run lookup fails for any reason" | a second init succeeded: 0 vs 2 | pass |
| 4 | "A4 parallel object calls record one owner record", "A4 parallel decision calls apply one status change" | 8 vs 1 successes | pass |
| 5 | "A5 a duplicated data dir exits 2" | cannot be red (preflight already refuses). Mutating the count check to `< 1` turns it red | pass |
| 6 | "A6 an owner record from decision stores decider owner and only for decided" | `1 !== 0` owner records for `proposed --decider alice` | pass |

Notes on part A:
- **Test A4.** Without a held lock the two tests passed by luck: staggered process start made the race rare, so a green run proved nothing. The test now holds `R/run.lock` for 1200 ms so all 8 callers pass the unlocked check first. That is the red above.
- **State checks in `updateRun`.** Checks are repeated inside the mutation for `enter`, `object`, `decision`, `exit` (all three updates) and `approve`. Only `object` and `decision` have a parallel test.
- **Decision owner record (item 6).** It is written only when status is `decided` and the decider is not an executor role, and it stores decider `owner`. `decisions[id].decider` keeps the given name.
- **Item 2, credentials entries.** I built the credential deny entries from concept line 734, reading `sandbox.credentials.deny` of the user settings (open question 6).

## Part B, per AC
**Batching.** I showed the tests red in batches larger than one AC, because the ACs share one module: `hooks/guard-shell.test.mjs` (31 tests) against an empty `guard-shell.mjs`, and 18 new `run.test.mjs` tests against the unchanged `run.mjs`. Plus `lib/run-argv.test.mjs` (9) and `lib/hook-key.test.mjs` (5). All were red first, for these reasons:
- Guard tests: `Cannot find module`, then with the empty scaffold `the hook returned no decision` and `null !== 'ask'`, 31 of 31 failed.
- `run.test.mjs` tests: `0 !== 2` (the token was not checked).
- `lib/run-argv.test.mjs` and `lib/hook-key.test.mjs`: stub scaffolds failing with `actual: []`, `actual: ''` and `{ created: false }`.

| AC | Test file and title | Red reason, then green |
|---|---|---|
| 01.5 | guard-shell "fires: autonomy ask" | no decision from empty hook; green |
| 01.12 | guard-shell "fires: forged owner decider" | same; deny for `plan`, `dontAsk`, absent mode and `agent_id`; green |
| 09.11 | guard-shell "fires: forged session binding", "fires: --session-id=x form"; run.test titles from T1 | same; green |
| 09.13 | guard-shell "fires: init without run gets no session id", "fires: standalone init without run gets no ask" | same; the ask reason lists `a.md` with its sha256; green |
| 09.14 | guard-shell "fires: forged data dir" | same; green. T1's "fires: data dir from pointer file" stays green |
| 09.15 | run.test "fires: run files editable by Edit tool", "fires: journal writable by Write tool", "fires: nonce record writable by Write tool", "fires: plugin lib editable by Edit tool" | `0 !== 2`; green |
| 10.10 | guard-shell "fires: approve from foreign cwd" | same; green |
| 11.5 | guard-shell "fires: approve under bypass mode" | same; green |
| 11.9 | guard-shell "fires: approve from teammate" | same; green |
| 11.10 | guard-shell "fires: compound owner command" | same; the reason is exactly `owner command: veto exit:concept --why x`; green |
| 11.14 | guard-shell "fires: objection from agent" | same; green |
| 11.15 | the 15 guard-shell titles of the row, plus run.test "fires: run.mjs accepts flag form the guard rejects" | the guard titles had the same red; the run.test one was green at once (the shared parser already refused those forms), so I killed its mutation instead |
| 11.17 | run.test "fires: run.mjs call without hook token", "fires: token from another session", "fires: token from another data dir", "fires: token over other tokens", "fires: replayed hook token", "fires: node option visible to run.mjs", "fires: key file readable by Read tool", "fires: key file writable by Write tool"; guard-shell "fires: run.mjs allowed without key"; bootstrap "fires: existing key overwritten" | `0 !== 2`. The bootstrap test cannot be red against a no-op scaffold; the mutation `'wx'` to `'w'` turns it red |
| 11.18 | run.test "fires: declined owner token replayed", "fires: expect-sha256 changed under token", "fires: token printed on exit 2", "fires: nonce not recorded on failed later check", "fires: transcript dir readable" | `0 !== 2`, then `actual: []` for the nonce record; green |
| 11.19 | guard-shell "fires: stripped wrapper before run.mjs" (one case per wrapper) | green. The interpreters `bash`, `sh`, `nodejs` and `python3` were added after a mutation survived |

**Mutations.** I applied 25 one-line mutations, restored each, and reran the named test. 21 turned it red at once:
- Nonce recorded after the `NODE_OPTIONS` check, `'wx'` to `'w'`, `verify(r)` removed in `object`, `verify(r)` removed in `decision`, `data-dir` count `< 1`, mode set widened, `agent_id` deny removed.
- Brace added to the token charset, age check removed, MAC compare removed, plugin-root rule removed, lookup-error removed, A6 `decided` guard removed, A1 exact-string match restored.
- Credentials check removed, `NODE_OPTIONS` check removed, `expect-sha256` check removed, A2 slash-ref logic reverted, import hashing removed, double-quote rule removed.

Four survived. Two were redundant:
- the `--session-id` prefix check, because `parseCall` also refuses `--session-id=x`;
- the CONTROL check, because the charset already refuses a newline outside quotes.

Two showed test gaps. I fixed them and the mutations now go red:
- the `node` text check in `callShape` (now tested with interpreters);
- the host-key-missing deny, which was masked by a generic deny (now the reason must name the host key).

I then re-ran the `ownerForm` `approve` mutation against the right test, and it is red.

## Files (lines)
New under `plugins/cdp6-core/`:

| File | Lines |
|---|---|
| `lib/run-argv.mjs` | 164 |
| `lib/run-argv.test.mjs` | 104 |
| `lib/hook-key.mjs` | 81 |
| `lib/hook-key.test.mjs` | 75 |
| `lib/user-settings.mjs` | 102 (outside the brief's file list but inside the plugin) |
| `hooks/guard-shell.mjs` | 97 |
| `hooks/guard-shell.test.mjs` | 324 |
| `hooks/bootstrap.mjs` | 14 |
| `hooks/bootstrap.test.mjs` | 53 |

Changed:
- `scripts/run.mjs` (632 → 659; `parseCall` and `FORMS` moved out)
- `scripts/run.test.mjs` (647 → 1081; one helper `argvFor` mints the token via `mintToken`, and `world()` writes the settings fixture and the key)

## Choices between readings
1. **Intake origin.** `intake.md` is `kind`, `origin` (as given), `date` (init date), and for a URL origin `http_status`. This needs a new init flag `--http-status`, required for a URL origin. I read "fetch date" as the init date. The conversation shortcut matches `^conversation(\s|$)` (concept 250).
2. **`expect-sha256`.** The hook appends one `--expect-sha256` per file-valued `--import` of `init`. `run.mjs` requires the list to equal the file hashes in order, else `expect-sha256-mismatch` (concept 820). No other command takes files in SL-1.
3. **MAC input.** Nonce, issue time, session id, data dir, token count, tokens, hashes, joined by NUL. The count is my addition so tokens and hashes cannot blur.
4. **Check order in `run.mjs`.**
   - Order: parse, `preflight`, key, token count, token form, MAC, age, nonce recorded under lock, `NODE_OPTIONS`/`execArgv`, then the command.
   - A refused token is spent only after MAC and age pass.
   - Errors name only the failed check.
5. **Tokenizer.** Double quotes also refuse a backslash; the empty string `''` is allowed. Only `//abs` and `~/` are accepted as permission-rule path forms (`/abs` is not); sandbox entries also accept `/abs`.
6. **Hook inputs.** The hook needs `CLAUDE_PLUGIN_DATA` as an absolute path and a valid `session_id`, else it denies. A hook-input parse failure denies. Monitor and PowerShell commands are read from `tool_input.command`, which is an assumption.
7. **Owner detection.**
   - `init` is owner when `--start` is other than `idea` or `--mode team`.
   - `decision … decided` is owner when `--decider` is given and is not `operator`, `orchestrator` or `team lead`.
   - `rule` is owner with `--human`; `approve`, `set-autonomy`, `object` and `veto` always are.
8. **Routine decision.** `ask`, with the reason `run.mjs <parsed call>`. Owner ask reasons are built from parsed tokens only.
9. **Host-key path rule.** T1 already built it (`checkPath` plus the test "fires: intake of host key"); I only verified it.
10. **Init settings check.** It reads `~/.claude/settings.json` only, using the sample paths `<R>/run.json`, `run.journal.jsonl`, `counters.json`, `verdicts/x.json`, `<data>/hook-nonces.jsonl` and `<P>/lib/hook-key.mjs`. A missing rule is refused as `user-settings-rule-missing`, listing every gap. Twelve run-file, data and plugin rules plus the key and transcript entries are checked.
11. **Nonce-check lock.** The `withLock` in `run-store` also serves the nonce file.
12. **Table forms.** `rule` and `veto` are table entries marked `unbuilt`: the guard decides them, `run.mjs` answers `not-built`.

## Open questions
1. **Contradiction.** The brief lists "`guard-shell.mjs` registered on `Bash|PowerShell|Monitor`" in part B but names `hooks/hooks.json` as out of scope (T3). I wrote no `hooks.json`; `guard-shell.mjs` and `bootstrap.mjs` are unregistered until T3.
2. **AC-11.5 title versus A-5.** The title says "bypass mode", but A-5 shows all four modes prompt, as the brief says. So `default`, `acceptEdits`, `auto` and `bypassPermissions` get `ask`; `plan`, `dontAsk`, unknown or absent modes are denied. The probe record has no mode list, so `PROMPTING_MODES` is a constant in `guard-shell.mjs`. Please confirm.
3. Table entries `rule` and `veto` (choice 12) exist only so AC-11.15 and AC-11.10 can be tested in SL-1; their flags are my reading.
4. `--http-status` is a new flag (choice 1). Please confirm, or name another source for the HTTP status.
5. Concept line 734 says "credentials deny entry of the counted settings". I read only `sandbox.credentials.deny` of user settings, as an array of path strings. I left out `filesystem.denyRead`, which the init check requires on `~/.claude/projects/`, so company run roots stay usable. The `--settings` file and managed settings are not read. Please confirm.
6. A token whose issue time lies in the future is accepted, because the concept only bounds age.
7. The brief's line references 250, 764 and 820 are partly off in my copy (764 is the AC-09.11 row); I followed the text.
8. **Tooling.** The CDP5 shell guard blocked several of my heredocs (unbalanced-quote parse), as in T1. I used Write and Edit for those files. That is a likely false positive, not changed.

## Follow-ups (not done)
- Pin verification (`checker-version`), `resume`/`repair`/`abandon`/`allow-url`/`ban`/`judge`/`grant` and the other owner subcommands are not in the table.
- `allow` for routine forms is SL-8.
- Run status printing in `bootstrap.mjs` is T3.
