# Brief SL-1 state-build corrections (stage-1 worker run 29 of cap 45)

Objective (owner, verbatim): "go with your recommendation -> Option 1" (2026-11-03; concept §0 item 25). This run closes the corrections of review-verify run 28 on the state-directory build. Mandate: "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind."

Output format (final answer, handback only, no file): acknowledgement line; status; per item one row: id, test file and title, red run (command, exit, failing assertion; by named mutation where the code already exists), green run; files changed with line counts; the gate commands with real exits and last output lines; open questions. At most 800 words.

Target state: worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff (272 of 272 cdp6 tests green). Start every Bash call with `cd <repo>/.worktrees/sl1 && `. Specification: concept v0.5.2 `<repo>/docs/cdp6/konzept-cdp6.md` (read only). Previous run: `docs/retro/0021-cdp6-framework/briefs/sl1-state.md` and `reports/sl1-state.md` (main checkout).

Items:
1. AC-10.6 (row "| AC-10.6 |"): the three tests "fires: pointer missing with active run", "fires: worktree cwd" and "fires: nested repo cwd with pointer missing" in `hooks/guard-phase.test.mjs` (around lines 126-170) today edit only `R/idea/idea.md`; each also asserts that a main-session Edit of `S/run.json` (with `cwd` in the project, in the linked worktree, in the nested repository) is denied while the pointer is missing. Show red by a named mutation of the scan.
2. `scripts/run.mjs` around line 495: before `rmSync` and `mkdirSync` of the snapshot directory, require the phase to be one of `PHASES` and the cycle a positive integer; otherwise refuse with `state-corrupt` and touch nothing. Test with a `run.json` whose cycle is `../../x`.
3. `lib/user-settings.mjs` around line 96: the data-directory samples gain an arbitrary nested path (for example `x/y/z.txt`), `hooks-fired.jsonl` and `grants.json`; a rule set that covers exactly the four old samples exits 2 (AC-09.15 "or whose rule covers only some files there").
4. Show red by a named mutation for the item-1 tests of run 27 that had no clean assertion red: `scripts/run.test.mjs` around lines 1363, 1426 and 1439 (state directory and journal; no file in the project after `init`, `enter`, `exit`, `approve`; `--root` recorded in `run.json`). Change a test only if the mutation shows it cannot turn red, and say so.
5. `lib/input-file.test.mjs` around lines 98-110: assert the bound itself (the reader takes at most the checked size plus one byte from the descriptor), not only the throw.

Out of scope: everything else; any file outside `plugins/cdp6-core/`; the CDP5 plugins; the concept.

Rules: test-first; a test that cannot turn red is not done. Tests use `node:test`, temporary directories and a temporary HOME; never the real home directory, the real host key or real Claude Code. No comments in code. No new dependency.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs`
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted SL-1 diff)
baseline: after run 27, cdp6 tests 272/272 and CDP5 suite 295/295 exit 0 (orchestrator re-run 2026-11-03)
run grant: impl-uc may run in <repo>/.worktrees/sl1, 1 use, session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c (expiry in the grant list)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments and heredocs naming `active-runs.json`, `data-dir` or `git`; use Edit and Write for files.

Stop rule: items in order; record an item that is not testable as written as an open question and continue.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
