# Brief SL-1 state directory: run state outside the project (stage-1 worker run 27 of cap 45)

Objective (owner, verbatim): "go with your recommendation -> Option 1" (2026-11-03; concept §0 item 25: the authoritative run state moves into the `state directory` `S` = `<data>/runs/<run-id>/`; `run.mjs` and the hooks write nothing into the project and read project files only through the descriptor reader). Mandate: "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind."

Output format (final answer, handback only, no file): acknowledgement line; status; per item one row: id, test file and title, red run (command, exit, failing assertion), green run; tests changed because their assertion followed the old layout, each with the reason; files created, changed or removed with line counts; the gate commands with real exits and last output lines; choices between readings with the concept line followed; open questions. Each test red on its own or in a batch no larger than one item. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff (250 of 250 cdp6 tests green). Start every Bash call with `cd <repo>/.worktrees/sl1 && `; the agent shell resets the working directory between calls.
- Specification: concept v0.5.1 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, read only). Read: §0 item 25; the `run directory` and `state directory` definitions after the §3.1 table (search "The `state directory` `S`"); §1.4 item 2 (lookup, missing-pointer scan, project root); UC-09 steps 1 and 1.4; UC-01 (steps 1 to 6, artefacts row); §5.2 file table; §5.6 items 5, 9, 10; AC-09.15, AC-10.6; the 0.5.0 and 0.5.1 changelog lines.
- Counter-tests of audit run 25, executed red by the orchestrator: the tests named `AUDIT-A` to `AUDIT-D` at the end of `<repo>/.worktrees/sl1-audit/plugins/cdp6-core/scripts/run.test.mjs` (A, B), `lib/run-store.test.mjs` (C) and `lib/input-file.test.mjs` (D) of that worktree (read only).

Items (each test-first; where the new layout changes what an existing test asserts, change the assertion and name it):
1. State directory: `run.mjs init` creates `S` = `<data>/runs/<run-id>/` with `run.json`, `run.journal.jsonl`, `ledger.md`, `counters.json`, `idea/intake.md` and `idea/assignment.md` (copies of the `--intake` and `--assignment` files read through `lib/input-file.mjs`), records the path of `R` in `run.json` (computed from the class and `--root` as today) and prints it; it creates nothing in the project. Every later subcommand reads and writes only `S` (lock and journal in `S`). Remove `<data>/run-roots.json`, `listRunRoots`, `recordRunRoot` and the `run-root-outside` check (the concept drops them; `run.mjs` no longer writes `R`). Test: after `init`, `exit` and `approve`, the project tree, including `docs/cdp6/runs/`, holds no file written by `run.mjs`.
2. Pointer: `<data>/active-runs.json` maps `session_id` → run id and project root → run id; `S` follows from the run id, `R` from `S/run.json` (§5.2 row).
3. Lookup (§1.4 item 2): the binding and path lookups use the new pointer; the missing-pointer scan reads `<data>/runs/*/run.json` and denies when an active run's project root or `R` is a prefix of `cwd` or of the target path; an entry without `run.json` is skipped, an unreadable one denies. AC-10.6 gains "fires: nested repo cwd with pointer missing".
4. Project root (§1.4 item 2, v0.5.0): the `--show-toplevel` result is accepted only when it contains `cwd`, else `cwd` itself; the linked-worktree back-link branch stays. AUDIT-C becomes a test here.
5. Reader (UC-09 step 1.4, v0.5.1): `lib/input-file.mjs` reads at most the `fstat` size plus one byte from the descriptor and refuses when more is there (AUDIT-D); every hook and checker that reads a project file uses it, including the `--import` hashing in `hooks/guard-shell.mjs` (around lines 20-28).
6. Snapshot at exit (UC-09 step 1.4, v0.5.1; UC-01 steps 5 and 6): `run.mjs exit idea` reads each artefact of the phase once through the reader into `S/snapshots/idea/cycle-1/`, records path and sha256 per artefact in the gate result, and runs `idea-check.mjs` and `decision-check.mjs` on the snapshot and on `S` (decision-check reads `S/run.json` and `S/verdicts/index.jsonl`), never on `R`. Which files are the phase's artefacts follows UC-01's artefacts row; name the list you chose.
7. User settings (§5.6 item 10, AC-09.15): the `init` check requires the `Edit` and `Write` deny rules on `<data>/**` and `<P>/**` with the sample rule of today (several samples per directory); the run-file rules go. Rename the AC-09.15 tests to the titles of the AC row.
8. Run-root swap (AUDIT-A, adapted): a background loop that swaps `docs/cdp6/runs` between a symlink to an outside directory and nothing while `init` runs leaves the outside directory empty after 25 s or 50 attempts.
9. Company class under a symlinked `~/.claude` (AUDIT-B): `init --class company` succeeds.
10. `hooks/bootstrap.mjs` and `hooks/guard-phase.mjs` read the run from `S`; `skills/idea/SKILL.md` tells the executor to create `R` at the printed path and write `R/idea/idea.md`, reads the intake and assignment from `S/idea/`, and says nothing the concept does not; `checks/idea-skill.test.mjs` follows.

Out of scope: return files, team handover, bug route (later slices; concept G1, G2); the deferred refactor items; AC-10.14, AC-10.15; any file outside `plugins/cdp6-core/`; the CDP5 plugins; the concept.

Rules: test-first (write the test, show it red for the reason stated, then implement); a test that cannot turn red is not done. Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. Key and token bytes never in output or assertion messages. No comments in code. No new dependency. Errors in a structured form without internals. Keep every other test green.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted SL-1 diff)
baseline: after fix run 24, cdp6 tests 250/250 and CDP5 suite 295/295 exit 0 (orchestrator re-run 2026-11-03)
run grant: impl-uc may run in <repo>/.worktrees/sl1, 1 use, session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c (expiry in the grant list)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, briefs and reports and of the `sl1-audit` test files named above. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments and heredocs naming `active-runs.json`, `data-dir` or `git`; use Edit and Write for files, or a node script file inside the worktree.

Stop rule: items in order. When an item is not testable as written, contradicts a concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
