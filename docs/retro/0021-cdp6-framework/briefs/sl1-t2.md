# Brief SL-1 T2: T1 corrections and owner gate (stage-1 worker run 13 of cap 45)

Objective (owner, verbatim): "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind." SL-1 approved by the owner on 2026-11-02 ("go with your recommendations").

Output format (final answer, handback only, no file): acknowledgement line; status; part A: per correction the test, its red run (command, exit, failing assertion) and green run; part B: per AC one row with test file and title, red run with the reason, green run; files created or changed with line counts; the gate commands with real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one AC; where a batch is unavoidable, say why. At most 1500 words.

Target state:
- Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, holding the uncommitted T1 diff (`.claude-plugin/marketplace.json`, `plugins/cdp6-core/`). First command, on its own: `cd <repo>/.worktrees/sl1`.
- T1 report: `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-t1.md`. Its review (review-verify, stage-1 run 12) found the defects of part A; the orchestrator confirmed them against the code.
- Specification: `docs/cdp6/konzept-cdp6.md` in the worktree; plan `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md` of the main checkout.

Part A, T1 corrections (first, each test-first):
1. `scripts/run.mjs` (around lines 240 and 309): `R/idea/intake.md` records the origin with its date as concept line 250 requires (`conversation` with date; a URL origin with fetch date and HTTP status; a tracker id as given), and the intake-as-assignment shortcut for kind `idea` keys on the origin kind `conversation`, not on the exact string.
2. `scripts/run.mjs` (around line 259): a value given to `--import` that is not an existing file is tried with `git rev-parse --verify` before it is treated as a path, so a ref containing `/` (for example `origin/main` in a test repository) is recorded as that commit (AC-09.12 "resolves commit import" gains that case). Check concept line 739 (credential deny entries of §5.6 item 5 as forbidden path arguments) and build it if it belongs to the path checks of UC-09 step 1.4; otherwise name it as an open question.
3. `scripts/run.mjs` (around lines 289-290): `init` refuses whenever the lookup of the project root returns any error, not only `pointer-missing`, so an unreadable run never leads to a second active run (concept line 764).
4. `scripts/run.mjs`, `cmdObject`, `cmdDecision`, `cmdEnter`, `cmdExit`, `cmdApprove`: every state check that guards a write is repeated inside the `updateRun` mutation, so two parallel calls cannot both pass a check made on an unlocked snapshot; one test with parallel processes for `object` and one for `decision`.
5. `scripts/run.test.mjs`: a duplicated `--data-dir` case under "fires: data dir from pointer file".
6. `scripts/run.mjs` (around line 488): an owner record from `decision` stores decider `owner` (concept line 820) and is written only for `decided` by a decider other than the executor; say what you changed.

Part B, T2 of SL-1 (concept line 1608 and the plan):
- `lib/run-argv.mjs`: the one shared parser of concept lines 50 and 822 (token charset, call-shape rule, table of owner and routine forms, token deny); move T1's `parseCall` and `FORMS` from `run.mjs` into it; `guard-shell.mjs` and `run.mjs` both import it.
- `lib/hook-key.mjs`: host key, keyed `--hook-token` (HMAC-SHA256 over a fresh nonce, the session id, the data directory and the parsed tokens, with issue time and hash values under the MAC), nonce record right after the MAC check, no-print rule (UC-11 step 1.3 at line 823, CH-50 at line 1746).
- `hooks/guard-shell.mjs` registered on `Bash|PowerShell|Monitor` (§1.4 item 10), limited to the `run.mjs` rules: call shape, owner-command `ask` (UC-11 step 1), routine `ask` and deny by the table (UC-11 step 1.2; no `allow`, that comes with SL-8), the `updatedInput` appending `--session-id`, `--data-dir` and `--hook-token`, in every session with `cdp6-core` enabled; the closed wrapper set of AC-11.19.
- `run.mjs`: the token and nonce checks for every call, added in the one argument path T1 prepared (`COMMON_FLAGS`, `preflight`); the `init` check of the user-settings rules of §5.6 items 9 and 10 (lines 1252-1253: host key and transcript directory, the Edit and Write deny rules on the run files, the journal, `<data>/` and the installed plugin root); the host-key path rule (UC-09 step 1.4, line 734).
- `hooks/bootstrap.mjs`: only the creation of the host key (run status printing is T3).
- Keep every T1 test green: T1's `run.mjs` tests now need a valid token; give them one test helper that mints it the way `guard-shell.mjs` does.
- ACs, each with the test file and title its row names: AC-01.5, AC-01.12, AC-09.11 (the `hooks/guard-shell.test.mjs` titles), AC-09.13, AC-09.14 (the `hooks/guard-shell.test.mjs` title), AC-09.15, AC-10.10 (the `hooks/guard-shell.test.mjs` title), AC-11.5, AC-11.9, AC-11.10, AC-11.14 (the `hooks/guard-shell.test.mjs` title), AC-11.15, AC-11.17, AC-11.18, AC-11.19. Find each row with `grep -n '^| AC-xx.y |'`. For AC-11.5 and the other permission-mode cases use the A-5 result of the probe record (main checkout branch `feat/cdp6-sl0-kit`, file `docs/cdp6/probes/2.1.314.md`, readable with `git -C <repo> show feat/cdp6-sl0-kit:docs/cdp6/probes/2.1.314.md`): `default`, `acceptEdits`, `auto` and `bypassPermissions` all showed the labelled prompt for an `ask`.

Interface decisions of concept v0.4.9 (main checkout, not yet in the worktree copy; decider: orchestrator): the `hooks observed` line carries `session_id` (UC-10 step 6); a capture index line carries `decision`, the verdict class, the objection ids, `conflicted` and `stamp` (§5.2). T2 needs neither; do not change them.

Out of scope: `hooks/guard-phase.mjs`, `hooks/hooks.json`, run-status printing in `bootstrap.mjs`, the skill (T3); the `allow` for routine forms (SL-8); anything of SL-2 and later; any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins.

Concept sections to read (worktree copy): §1.4 items 2, 8, 9, 10 (89-100), UC-09 step 1 with 1.1 to 1.4 (730-734), UC-11 steps 1 to 1.3 (820-823), §5.4 (1223-1235), §5.6 items 5, 6, 9, 10 (1248-1253), CH-49 and CH-50 (`grep -n '^| CH-49 \|^| CH-50 '`), the AC rows named above.

Rules: test-first per correction and per AC (write the test, show it red for the reason stated, then implement). Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. The token secret is never printed, logged or written outside the key file, also not in test output. No comments in code. No new dependency. Errors to callers in a structured form without internals.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted T1 diff)
baseline: CDP5 suite exit 0 at worktree creation; after T1, cdp6 tests 83/83 and CDP5 suite exit 0 (orchestrator re-run 2026-11-02)
run grant: impl-uc may run in <repo>/.worktrees/sl1 until 2026-11-02T18:10:19.260Z, 2 uses left (T2, T3), session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree. No network, no commit.

Stop rule: part A first, then part B in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
