# Brief SL-2 temp-directory cleanup in the cdp6-core tests (stage-1 worker run 45 of cap 52)

Objective (owner, verbatim): "Dann bring es wieder auf aktuellen Stand und mach mit deinen Arbeiten weiter" (2026-11-04, the answer to the proposed temp-directory fix; ledger 0021) and the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")". Finding (ledger 0021 row of 2026-11-04T09:28:29+01:00): one run of the cdp6-core suite leaves 531 `cdp6-*` directories with about 10500 files in `/tmp`; about 7600 such directories had piled up on the host before its restart.

Output format (final answer, handback only, no file): acknowledgement line; status; the red run (command, exit, the count of entries left in the temporary directory, quoted from that run's output) and the green run (the same command, exit, count 0); every test file changed with the number of temp-directory sites moved to the helper; files created or changed with line counts; the gate commands with their real exits and last output lines; open questions. At most 1200 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff including the second fix (report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix2.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `.
- No concept line governs this; the rules are the global ones: tests use temporary directories and leave nothing behind; the test path runs the production path.

Task (test-first):
1. Red: `env TMPDIR=<an empty directory you create inside the worktree, e.g. .tmp-red> node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`, then count the entries left in that directory (`ls -A <dir> | wc -l`); report the count. Remove that directory afterwards.
2. One test helper that creates a temporary directory under `os.tmpdir()` and removes it (recursively, forced) when the calling test ends, also when the test fails; place it where the gate's test globs do not run it as a test file, and outside the shipped `lib/` modules if the plugin layout allows (say where you put it and why).
3. Every `mkdtempSync` in test code and test fixtures of `plugins/cdp6-core/` (including `lib/capture-fixture.mjs`) goes through the helper, so a directory a test creates, and every child process's files inside it, is gone after the test. A test that needs a directory to outlive one test (shared across tests of a file) removes it in an `after` hook of that file.
4. Green: the command of step 1 with a fresh empty directory leaves 0 entries, and the suite passes with the same test count as before.
5. No test assertion changes; no production module changes. If a production module itself leaves temporary files outside the run directory, report it as an open question with file:line instead of changing it.

Rules: `node:test`; no comments in code; no new dependency; keep every test green.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. the command of step 1 with a fresh empty `TMPDIR`, and the entry count after it
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff including the second fix)
baseline: the orchestrator's re-run after the second fix (ledger 0021)
run grant: one impl-uc use, confirmed by the owner

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree. No network, no commit, no file outside `plugins/cdp6-core/` changed except the temporary directories you create and remove. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; `env TMPDIR=… node …` is one command, not an assignment.

Stop rule: when a site cannot move to the helper without changing an assertion, record it as an open question with file:line and continue. Stop-Retro per contract rule 5 when the worktree is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
