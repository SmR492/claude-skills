# Brief SL-1 fix 2: file-input boundary and fix-review corrections (stage-1 worker run 22 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: review-verify run 21 blocked the first fix run with one 🔴; this run closes it). Mandate: "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind."

Output format (final answer, handback only, no file): acknowledgement line; status; per item one row: id, test file and title, red run (command, exit, failing assertion), green run; files changed with line counts; the gate commands with real exits and last output lines; every choice between readings with the concept line followed; open questions. Show each test red on its own or in a batch no larger than one item. At most 1200 words.

Target state:
- Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff (`.claude-plugin/marketplace.json`, `plugins/cdp6-core/`). First command, on its own: `cd <repo>/.worktrees/sl1`.
- Specification: concept v0.4.11 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, read only). Previous run: brief `docs/retro/0021-cdp6-framework/briefs/sl1-fix.md`, report `docs/retro/0021-cdp6-framework/reports/sl1-fix.md` (main checkout).

Items (each test-first):
1. 🔴 `lib/input-file.mjs` and `scripts/run.mjs` `openChecked` (UC-09 step 1.4, v0.4.11). Today `openInput` and `stillSame` compare the descriptor with a second lookup by name (`realpathSync(path)`, `statSync(real)`). That lookup follows symlinks in every directory of the path, so a concurrent process can swap an intermediate directory to a symlink into `~/.config/cdp6-core/` for the `open`, back to a real directory for `realpathSync`, and to the symlink again for `statSync`; the rules then pass on a harmless name while the descriptor holds the host key. Change:
   a. The checked path is the path the kernel reports for the descriptor: `realpathSync('/proc/self/fd/' + fd)` on Linux, in `openInput` and in `stillSame`. No name lookup decides on Linux.
   b. Open with `O_RDONLY | O_NOFOLLOW | O_NONBLOCK` (a FIFO must not block `init`); refuse a non-regular file as today.
   c. Refuse a file whose `fstat` shows more than one hard link (`file-hard-link`).
   d. Refuse a file whose content holds the host key bytes (`file-holds-key`); the key is read the way `run.mjs` already reads it; the key bytes never reach output, a message or a test assertion message.
   e. Where `/proc/self/fd` does not exist, keep today's name lookup with the device and inode comparison (the residual of v0.4.11).
   Tests: one that turns red against today's name-based code by making the name lookup and the descriptor disagree (a test seam in `lib/input-file.mjs` that lets the test run code between `open` and the path lookup is acceptable; the production path must not change through it); "fires: intake hard link to host key" (AC-09.12 title); a content case (a regular file that is a copy of the key, not a link); a FIFO case that returns exit 2 within the test timeout.
2. 🟡 Missing checker (UC-01 step 5.1, line 271; error rows at 283 and 1230): `run.mjs exit` with a missing checker sets the phase `gate-pending` and records the gate result `checker-missing`, then exits 2. Today it refuses before that write (`run.mjs` around 510-512); that was item 11 of the previous brief, the orchestrator's wording. Restore the assertions of the test around `run.test.mjs:574` to `gate-pending` and add the gate result. Keep the rest of item 11 (the decision on the record read inside the lock).
3. 🟡 AC-09.12 (line 765, v0.4.11): the test titled "fires: init refuses the home directory and its ancestors as project root" exists; make sure it is the test the row names and that it asserts `project-root-home`.
4. Checker entry points: `checks/idea-check.mjs:63` and `checks/decision-check.mjs:82` use the shared main-module helper of `lib/` like the hooks. Test: a plugin copy under a path with a space and through a symlink; `run.mjs exit idea` must get the checkers' real result, not a silent exit 0.
5. 🟢 `skills/idea/SKILL.md`: remove the clause after "refuses it" on line 36 (UC-01 step 4.1 states no such rule); in the step 5.2 text (around line 39) state that under verdict (c) only `reject` clears an objection and acceptance is `abandon` (not built in this release). Extend `checks/idea-skill.test.mjs` to assert both.
6. 🟢 `scripts/run.mjs`: remove the unused `nextAction` import.

Out of scope: everything else, including the deferred refactor task (split of `run.mjs`, a `hooks-fired.jsonl` reader, a lock lib, nonce pruning), AC-10.14, AC-10.15, any file outside `plugins/cdp6-core/`, the CDP5 plugins and the concept.

Rules: test-first (write the test, show it red for the reason stated, then implement); a test that cannot turn red is not done; where an item is test-only, show red by a named mutation. Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. Key and token bytes never in output, logs or assertion messages. No comments in code. No new dependency. Errors to callers in a structured form without internals. Keep every existing test green unless an item changes what it asserts.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted SL-1 diff)
baseline: after fix run 20, cdp6 tests 230/230 and CDP5 suite 295/295 exit 0 (orchestrator re-run 2026-11-02)
run grant: impl-uc may run in <repo>/.worktrees/sl1, 1 use, session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c (expiry in the grant list)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments and heredocs naming `active-runs.json` or `data-dir`; use one command per call, Edit and Write for files, or a node script file inside the worktree.

Stop rule: items in order. When an item is not testable as written, contradicts a concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
