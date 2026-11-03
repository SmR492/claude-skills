# SL-1 T1 impl-uc handback (stage-1 run 11), saved by the orchestrator 2026-11-02

contract: v2 f91736a60d15

T1 (run core) is built test-first in the worktree and all four gates exit 0. Nothing is committed. Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa. `git status` shows only `M .claude-plugin/marketplace.json` and `?? plugins/cdp6-core/`.

## Status
- All 21 listed ACs have a test under the title the AC row names, with two deviations in the choices section. Each test was red before its code and is green now.
- I applied 21 single-line mutations to the production code (one per AC area). All 21 turned the named test red, and I restored each afterwards. The script is `<scratchpad>/mut.mjs`.
- I used the grouped red/green runs below, not one run per AC. The tests and the code were added per component, in the order lib, `run.mjs`, then checkers. The `run.mjs` tests went in as two batches, each shown red before its code.
- The test runner reports failures as `✖` lines, so the "assertion message" is the `actual`/`expected` pair.

## Red and green per AC
Commands and exits:
- Red (stub): `node --test plugins/cdp6-core/scripts/run.test.mjs` exited 1. The stub `run.mjs` was only `process.exit(0)`, so every refusal test failed with `actual: 0, expected: 2` and the batch showed 19 failed.
- Red (unimplemented subcommands): the same command exited 1 with 12 failed. The failures were `actual: 'unknown-subcommand', expected: 'a3-before-probe'` and similar.
- Red (exit and approve): the same command exited 1 with 10 failed.
- Red (checker stubs): `node --test plugins/cdp6-core/checks/*.test.mjs` exited 1 with 15 failed, all `actual: 0, expected: 1` or `2`.
- Red (lib): the empty scaffold for `lib/run-store.mjs`, `lib/data-dir.mjs` and `lib/agent-name.mjs` failed with `ERR_MODULE_NOT_FOUND`, then `actual: [] expected: [ 'cdp6-core:' ]`.
- Green: all 83 tests under gate 1 pass, exit 0.

| AC | Test file and title | Red reason |
|---|---|---|
| AC-01.1 | `checks/idea-check.test.mjs` "fires: missing non-goals". Also `scripts/run.test.mjs` "fires: exit idea without non-goals", where `run.mjs exit idea` exits 1 and names the section. | stub exit 0 where 1 expected |
| AC-01.3 | `scripts/run.test.mjs` "fires: checker missing". It runs on a copy of the plugin with `idea-check.mjs` deleted, exits 2, and `run.json` keeps `gate-pending`. | unknown-subcommand, then exit 0 under the stub |
| AC-01.7, AC-01.10 | `scripts/run.test.mjs` "fires: unknown intake kind", "fires: intake as objective" | exit 0 where 2 expected |
| AC-01.11 | `checks/decision-check.test.mjs` "fires: owner pick before counter-role" | exit 0 where 1 expected |
| AC-01.13 | `checks/idea-check.test.mjs` "fires: approach chosen without owner" | exit 0 where 1 expected |
| AC-02.5 | `scripts/run.test.mjs` "fires: predecessor missing" (the `run.mjs` refusal only) | unknown-subcommand |
| AC-03.10 | `checks/decision-check.test.mjs` "fires: objection record outside run.json" | exit 0 where 1 expected |
| AC-09.1 | `lib/run-store.test.mjs` "fires: concurrent writers" | SyntaxError: Unexpected end of JSON input (a torn read from the unlocked scaffold) |
| AC-09.5 | `lib/run-store.test.mjs` "fires: duplicate id under concurrency" | same torn-read failure with 3 children × 40 ids. At 2 × 20 the unlocked scaffold passed by luck, so I enlarged the test before relying on it. |
| AC-09.4, AC-09.7, AC-09.8, AC-09.9 | `scripts/run.test.mjs` "fires: company repo path", "fires: team without probes", "fires: unnamed record place", "fires: below version floor" | exit 0 where 2 expected |
| AC-09.11 | "fires: init without session id", "fires: duplicate session id", "fires: init binds pointer session of another live session" | exit 0 where 2 expected. The third test checks that only `--session-id` is bound. |
| AC-09.12 | "fires: intake from secret path", "fires: assignment outside project" (uses `/etc/hosts`), "fires: intake of host key" (home is the project root), "accepts usage log import", "resolves commit import" | exit 0 where 2 expected |
| AC-09.14 | `scripts/run.test.mjs` "fires: data dir from pointer file" | unknown-subcommand where `a3-before-probe` was expected |
| AC-10.5 | `scripts/run.test.mjs` "fires: guard not observed" | unknown-subcommand |
| AC-11.8 | `scripts/run.test.mjs` "fires: A3 before probe" | unknown-subcommand |
| AC-11.14 | `scripts/run.test.mjs` "records owner objection" (the `run.mjs` part only) | unknown-subcommand |

Defect found by my own concurrency test, and fixed:
- `concurrent run.mjs id calls return different ids` failed with exit 2 `run-unreadable` for one of six parallel callers.
- Cause: a lock-free reader could see `run.json` and the journal disagree between the journal append and the rename.
- Fix: `readRun` now settles for up to 300 ms before it fails. Reads inside the lock do not wait.
- The test passes in 3 repeated runs.

## Files (lines)
- Created in `plugins/cdp6-core/`:
  - `.claude-plugin/plugin.json` (7)
  - `lib/data-dir.mjs` (41), `lib/agent-name.mjs` (8), `lib/run-store.mjs` (282)
  - `scripts/run.mjs` (632)
  - `checks/idea-check.mjs` (63), `checks/decision-check.mjs` (81), `checks/registry.json` (38)
  - Tests: `lib/data-dir.test.mjs` (41), `lib/agent-name.test.mjs` (19), `lib/run-store.test.mjs` (186), `scripts/run.test.mjs` (about 650), `checks/idea-check.test.mjs` (90), `checks/decision-check.test.mjs` (117), `checks/registry.test.mjs` (44)
- Changed: `.claude-plugin/marketplace.json` (+6, the `cdp6-core` entry at version 0.1.0).
- Nothing outside these paths changed, and no CDP5 plugin was touched.

## Gates (from the worktree, final state)
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs` exited 0. Last lines: `ℹ tests 83`, `ℹ pass 83`, `ℹ fail 0`.
2. The CDP5 suite command from the brief exited 0. Last lines: `ℹ tests 295`, `ℹ pass 295`, `ℹ fail 0` (the baseline was exit 0).
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core` exited 0 with `0 skills, 0 agents, 0 🔴 0 🟡 2 🟢`. The two 🟢 are informational test-file hits for `id_rsa` and `https://example.test` in `scripts/run.test.mjs`.
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core` exited 0: `15 files, 0 findings`.
- No comments in code. No new dependency.

## Choices between readings of the concept
1. **Idea artefact formats.** The concept does not fix them, so I chose:
   - `idea.md` has `##` sections Assignment, Problem, Goals, Non-goals, Constraints, Success measures, Decisions and Approach options.
   - The approach choice is `D-1` (UC-01 step 3).
   - `idea/intake.md` is `kind:` and `origin:` lines, a blank line, then the verbatim text. `idea/assignment.md` is the assignment file as given, or the intake text for kind `idea` with origin `conversation`. The recorded hashes are the hashes of these written files.
2. **Capture index.** `verdicts/index.jsonl` does not exist yet (capture is SL-2), so `decision-check` reads lines `{id, agent_type, task, decision, verdict (a | a-with-conditions | b | c | not-decidable), objections[], conflicted?, stamp}`. SL-2 must produce this shape or the checker must change.
   - A block verdict (b or c) passes only if every listed objection has an owner record `kind: object` in `run.json`. `decisions.md` is never read.
   - A `conflicted` capture is treated like a block verdict. The clearing-by-capture branch is SL-5.
3. **`hooks-fired.jsonl` line shape (AC-10.5).** "Since the session start" cannot be read from the fields the concept lists. `enter` therefore requires a line `{hook: "guard-phase.mjs", session_id: <the --session-id>}`. T3's `guard-phase.mjs` must write `session_id` into its line.
4. **Stage-1 team mode.** `init --mode team` names the failed probes and points to `--mode multi`. With a fully passing record it still exits 2 with `team-not-built`, following the brief's "every `--mode team` exits 2".
5. **Probe record.** A record counts only if it has `accepted.sha256` (64 hex characters) and `rows.<id>.passed === true`. This is the reader only. `probe-check` and proof of who wrote the file are SL-8.
6. **Exit and approve.**
   - `exit` runs the registry checkers for the phase. A checker exit 1 returns the phase to `entered` and `run.mjs` exits 1. A missing checker or a checker exit other than 0 or 1 leaves `gate-pending` and exits 2.
   - A human gate applies per autonomy level: A0 at every phase, A1 at concept and refinement, A2 at refinement, A3 never.
   - For phase `idea`, `exit` also fails with exit 1 while autonomy has not been set (the phase card Exit line).
   - `approve` re-hashes the artefacts and refuses with `artefact-drift`. `approve S-n` is refused as `unknown-slice` because slices do not exist yet.
7. **Argument handling is in one place for T2.** `parseCall` (form table, `--flag=value` refused, duplicates refused) and `preflight` (exactly one `--session-id` and one `--data-dir`). T2 adds `--hook-token` and `--expect-sha256` to `COMMON_FLAGS` and its check to `preflight`, without touching any subcommand.
8. **Path rule order.** Host-key directory first, then secret patterns (`.ssh`, `.aws`, `.config/gh`, `.env*`), then outside the project root and run roots. `--import` with no path separator and no existing file is resolved as a commit via `git rev-parse --verify`. `<data>/usage-log.jsonl` is the only read-only exception.
9. **Run directory.**
   - Own class: `<root>/docs/cdp6/runs/<run-id>`, or `--root` if the project's CLAUDE.md or README names it.
   - Company class: `~/.claude/projects/<non-alphanumerics replaced by '-'>/memory/cdp6/runs/<run-id>`. A `--root` inside the repository is refused.
10. **Test titles outside their named file.** AC-02.5's named title "fires: predecessor missing" lives in `hooks/guard-phase.test.mjs` (T3). I put the `run.mjs` half under the same title in `scripts/run.test.mjs`. AC-01.1's named class is `checks/idea-check.test.mjs`, which I use, plus the extra `run.mjs` test.
11. **`approve`, `decision`, `id`.** `approve` and `decision` stamps are program-written. `decision` allows new→proposed or decided, proposed→decided or superseded, decided→superseded. `vetoed` is refused. A decider other than operator, orchestrator or team lead also writes an owner record.
12. **Registry pins.** `checks/registry.json` pins `cdp5-gates` 0.8.8. It lists the sha256 of the 10 referenced scripts, `lib/args.mjs`, `lib/scan.mjs` and the policy file. `git diff 74d17c8 HEAD -- plugins/cdp5-gates` is empty. `registry.test.mjs` recomputes the hashes. Pin verification at gate time (`checker-version`) is not built.

## Open questions and follow-up notes
- **Not built, outside T1's AC list (SL-5, SL-8 or T2).**
  - The sandbox and settings checks of `init` (§5.6, AC-09.10, AC-09.15).
  - The veto check on `enter` and `exit` (AC-10.9, SL-8).
  - `HALT-CHECKER` for an unattended run (only the exit codes and `gate-pending` are done).
  - The `idea-check` rules for the Source enum, assignment hash, origin and reproduction steps (AC-01.2, 01.6, 01.8, 01.9, SL-5).
  - `resume`, `repair`, `abandon`, `rule`, `halt`, `veto`, `judge` and `id --map`.
- **Run lookup (b).** The §1.4 item 2 lookup (b) by `agent_id` and `counters.json` is not built, because `counters.json` is SL-3. Lookups (a), (c) and the pointer-missing scan are built and tested in `lib/run-store.test.mjs`.
- **Needs your decision: AC-09.12's wording.** "`--import` of a value that resolves to a commit is recorded as that commit." I record `{kind: "commit", value, commit: <full sha>}` in the imported predecessor phase. Please confirm the record shape.
- **`status` output.** It prints plain text (`run:`, `status:`, `phase:`, `next:`, `ledger:`); the other subcommands print one JSON line. Errors go to stderr as JSON `{error, message}` with exit 2.
- **Probe-record trust (AC-11.13, SL-8).** The reader can be satisfied by a hand-written file that carries an `accepted.sha256` field. Real acceptance proof is still SL-8.
- **`guard-shell` shell guard blocked one heredoc.** My first `cat > … <<'EOF'` for two small test files was blocked by the plugin's shell guard, apparently on the words "data-dir pointer". I used the Write tool instead. This is a possible false positive in the CDP5 guard, not a change I made.
