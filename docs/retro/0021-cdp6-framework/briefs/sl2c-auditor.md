# Brief: adversarial audit of slice SL-2c (stage-1 worker run 84)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04). The SL-2c row of the concept names `adversarial-auditor` because the slice builds a guard hook, an owner-command path and the record that gates the owner-command modes.

Object: the whole SL-2c diff, `diff -r <repo>/.worktrees/sl2c-pre-build <repo>/.worktrees/sl2c/plugins/cdp6-core` (frozen copy `<repo>/.worktrees/sl2c-final/`), on top of the committed SL-1 plus SL-2 build 1d04d1a; concept v0.5.26 `<repo>/docs/cdp6/konzept-cdp6.md` (§3.4 item 14, §5.6, UC-11 step 1 and 1.3, UC-12 steps 2 and 7, UC-14 step 5, AC-09.15, AC-11.13, AC-11.17, AC-11.20 to AC-11.23, AC-12.33 to AC-12.36, AC-14.9 to AC-14.16, §11.3 item 3); the task reports and reviews `<repo>/docs/retro/0021-cdp6-framework/reports/sl2c-t1.md`, `sl2c-t1-rv.md`, `sl2c-t2.md`, `sl2c-t2-rv.md`, `sl2c-t3.md`; the threat model `reports/concept-v0522-tm.md`; docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/`. `<repo>` = the repository root.

Assume the slice contains a defect that the green tests and the three task reviews share as a blind spot. Attack in particular:
1. The probe acceptance: can any caller other than the owner's `run.mjs probe --accept` (a model in auto mode, a subagent, a hook, the main session through Bash, Edit or Write) create or change a record that `readProbeRecord` accepts, or make `guard-shell.mjs` admit owner commands in `auto` without an accepted A-5 `auto` row for the running version; is the record bound to the Claude Code version that actually runs.
2. The stop guard: can a finished capture-bound agent without a capture leave the run in a state where a spawn, a gate run, an owner command, an Edit, Write or NotebookEdit call, or a shell write still goes through (tool names the matchers miss, `observe-stop.mjs` not firing or failing open, a race between the handback capture and `finished_at`, a `void` mark the model can set).
3. The shell allowlist during a stop: any input that the allowlist admits and that writes, runs a program, or reads a secret path (bash, PowerShell, Monitor syntax).
4. The spawn deny of AC-12.35 and its interaction with the T2 test changes (devils-advocate spawns replaced by review-verify in older tests).
5. The preflight: can a repository or a running process make it pass while a check of UC-14 step 5 should fail (process recognition, settings precedence, managed settings, the `--settings` file location, symlinks, the PATH binary against the running version).
6. The `Edit(...)` rule form: is any protection of §5.6 items 9 and 10 lost now that `Write(...)` rules are no longer required (Claude Code 2.1.318 reports them as never matching; check what still denies a Write tool call on the protected paths).

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; the audit protocol: per attack, what you tried and the evidence (file:line); every defect with severity (🔴 🟡 🟢) and an executable counter-test as complete `node:test` code (file name, title, imports; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`), marked "not executed" with the result you expect on the frozen tree; the verdict FREIGABE, FREIGABE-MIT-AUFLAGEN or SPERRE. At most 1500 words plus test code.

Tools: Read, Grep, Glob, Bash for read-only commands. No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 60 tool calls; a claim without evidence is marked as unverified.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
