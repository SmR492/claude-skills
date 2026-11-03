# Brief SL-1 fix: slice-end review corrections (stage-1 worker run 20 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: after the slice-end reviews of SL-1, one combined fix run, then one review-verify). Mandate: "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind."

Output format (final answer, handback only, no file): acknowledgement line; status; per item below one row: id, test file and title, red run (command, exit, failing assertion), green run; for each counter-test the result as delivered (red, or green with the reason it does not fire); files created or changed with line counts; the gate commands with real exits and last output lines; every choice between readings with the concept line followed; open questions. Show each test red on its own or in a batch no larger than one item; where a batch is unavoidable, say why. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, holding the uncommitted SL-1 diff (`.claude-plugin/marketplace.json`, `plugins/cdp6-core/`). First command, on its own: `cd <repo>/.worktrees/sl1`.
- Specification: concept v0.4.10 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, read only; the worktree copy is older). Find lines with `grep -n`; the sections are named below.
- Reports of the earlier runs: `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-t1.md`, `sl1-t2.md`, `sl1-t3.md`. The findings below come from review-verify (run 16), review-code (run 17), adversarial-auditor (run 18) and the outside konzept-reviewer (run 19); the orchestrator confirmed each against the code.

Part A, security (acceptance preconditions; first, each test-first):
1. File arguments (UC-09 step 1.4, the sentence added in v0.4.10): `scripts/run.mjs` checks `--intake` and `--assignment` (around lines 241-242) and `--import` (around 251-252) by real path, then spawns `claude --version` (around 262), then re-opens by name (`fileText`, around 150-155 and 275-276), so a symlink swapped in after the check is read and `R/idea/assignment.md` receives its bytes. Open each file once without following a symlink in its last component, take the real path again after the open, require the descriptor's device and inode to equal that real path's, apply the path rules to that real path, and read only from the descriptor. The auditor's counter-test (below) must turn red first.
2. Quoted tokens (UC-11 step 1.2, v0.4.10): `lib/run-argv.mjs` (around lines 52-60) refuses a quoted token holding a character from U+2018 to U+201F (PowerShell ends strings there). Other non-ASCII text in a value stays allowed.
3. Entry point (review-code A2, audit F3): `hooks/guard-shell.mjs`, `hooks/guard-phase.mjs`, `hooks/bootstrap.mjs` and `scripts/run.mjs` decide whether they are the main module by comparing `realpathSync(process.argv[1])` with `fileURLToPath(import.meta.url)`, through one helper in `lib/`. Under a symlinked plugin root each script must act, not exit 0 silently.
4. Home as project root (UC-09 step 1.4, v0.4.10): `run.mjs init` refuses a project root that is the home directory or one of its ancestors.
5. Prompting modes (§3.4 item 14 "While no record is accepted…", §11.3 consumer test, CH-8, AC-11.5): `guard-shell.mjs:12` hard-codes `default`, `acceptEdits`, `auto`. An owner form gets `ask` in `default`; in another mode only when an accepted probe record for the running Claude Code version shows the labelled prompt for that mode (read with T1's probe-record reader; obtain the version the way `run.mjs` does, moved into a lib, and only when the mode is not `default`); `bypassPermissions` and a missing mode never. The AC-11.5 test uses a record fixture in which `acceptEdits` shows no prompt (deny) and `default` and `auto` show it (`ask`); a further test without a record denies `auto`. The cause was the orchestrator's T2 brief, which took the modes from the unaccepted SL-0 record.
6. Verdict (c) (UC-01 step 5.2, v0.4.10): `checks/decision-check.mjs` (around lines 33 and 50-58) counts an objection of a (c) capture as cleared only by an `object … reject` record; an `accept` record does not clear it. If the owner record does not store accept or reject, add it in `run.mjs` `object`.

Counter-tests of the adversarial-auditor (not executed by it; add each as given, show the result, then fix where red). The complete code is in this brief's appendix below.

Part B, run lookup and guards:
7. `lib/run-store.mjs` `findRun` (§1.4 item 2, v0.4.10): (a) a session binding to a run that is not active falls through to (b) and (c) instead of returning at once (around lines 274-275); (b) the target path: an existing file is resolved to its directory before `git -C` (around line 258), so an Edit of `R/run.json` from a `cwd` outside the project is found; (c) the missing-pointer scan reads the run roots `<project root>/docs/cdp6/runs/`, the company default `~/.claude/projects/<project>/memory/cdp6/runs/` and every root in `<data>/run-roots.json`; an entry that is not a directory or has no `run.json` is skipped, an unreadable `run.json` denies. One exported function lists the run roots and is used by both `cmdInit` (around lines 229-231) and the scan. `run.mjs init` appends its `--root` to `<data>/run-roots.json` (§5.2 row, v0.4.10). Tests: one fixture per case, including "fires: pointer missing with active run" with an Edit of `R/run.json` from a `cwd` outside the project.
8. `hooks/guard-phase.mjs:44`: without an absolute `CLAUDE_PLUGIN_DATA` the guard gives no decision unless the scan of the two default run roots finds an active `run.json`, in which case it denies (concept §1.4 item 2 "apply only while an active CDP6 run exists", UC-10 step 1). Adjust the test around `guard-phase.test.mjs:173-178`.
9. One path helper: the two `realOrResolved` functions (`run.mjs` around 75-87, `run-store.mjs` around 233-239) become one in `lib/`, with the `run.mjs` behaviour (nearest existing parent, real path).
10. Parser constants (CH-49, review-code C2): `lib/run-argv.mjs` exports the unquoted-token pattern, the control-character pattern, `SESSION_ID` and `SHELL_TOOLS`, and a `readRunCall(command, env)` that returns the parsed call and words or `null`; `guard-shell.mjs`, `guard-phase.mjs` and `run.mjs` use them and keep no copy.
11. `cmdExit` (review-code A3): check that the checkers exist before writing `gate-pending`; decide on the record read inside the `updateRun` callback, not on the read before the lock (around lines 528-557).
12. `hooks/bootstrap.mjs`: writes a `hooks observed` line on every firing (§5.2 "every hook"), and resets an existing key directory to mode 0700 (UC-11 step 1.3, v0.4.10).
13. A hook-level test that a failing `hooks observed` write (unwritable data directory file) leaves the decision of `guard-phase.mjs` and of `guard-shell.mjs` unchanged.

Part C, tests and text:
14. `scripts/run.test.mjs` (around line 1146): split the narrow-rule fixture into a data-only and a plugin-only fixture, each asserting its message ("… on the data directory", "… on the plugin root").
15. `scripts/run.test.mjs` (around lines 799-820): the set-autonomy race test proves the inner check deterministically (for example by driving the `updateRun` mutation directly), without a fixed sleep.
16. `skills/idea/SKILL.md`: remove "tell the owner and wait" (around line 62); the approach-decider check belongs to `idea-check.mjs` (AC-01.13), not `decision-check.mjs` (around line 51); mark `ban` and `abandon` as not built in this release (around lines 36 and 61).
17. `lib/hook-key.test.mjs` (around lines 25, 40, 42): key and token comparisons with `.equals()` and fixed messages, so no key or token bytes reach a failure message.
18. `hooks/guard-shell.test.mjs` (around line 168) "fires: approve from foreign cwd": bind a run to the session first, as AC-10.10 states.

Out of scope (decided, ledger 0021): splitting `run.mjs` into modules, a reader for `hooks-fired.jsonl` in `hooks-observed.mjs`, a separate lock lib, nonce-record pruning (refactor task before SL-3); AC-10.14 (SL-8) and AC-10.15 (SL-5); every other item of later slices; any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins or to the concept.

Rules: test-first per item (write the test, show it red for the reason stated, then implement); a test that cannot turn red is not done; where an item is a test-only change, show red by a named mutation. Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. The token secret and key bytes are never printed, logged or written outside the key file, also not in test output or assertion messages. No comments in code. No new dependency. Errors to callers in a structured form without internals. Keep every existing test green unless an item changes what it asserts.

Gate commands (from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa (plus the uncommitted SL-1 diff)
baseline: after T3, cdp6 tests 193/193 and CDP5 suite 295/295 exit 0 (orchestrator re-run 2026-11-02T14:36)
run grant: impl-uc may run in <repo>/.worktrees/sl1 until 2026-11-02T20:08:12.091Z, 1 use, session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, briefs and reports. No network, no commit. Known from earlier runs: the CDP5 shell guard refuses shell `for` loops, variable assignments and heredocs naming `active-runs.json` or `data-dir`; use one command per call, Edit and Write for files, or a node script file inside the worktree.

Stop rule: part A first, then B, then C. When an item is not testable as written, contradicts a concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.

## Appendix: counter-tests of the adversarial-auditor (run 18), as delivered

F1, `scripts/run.test.mjs` (uses the existing helpers `world`, `call`, `initArgs`, `runDir`; adapt helper names if they differ, not the assertions):

```js
test('fires: intake swapped for a symlink to the host key after the path check', () => {
  const w = world();
  const key = join(w.home, '.config', 'cdp6-core', 'hook.key');
  const intake = join(w.repo, 'intake.txt');
  const fake = join(w.bin, 'claude');
  writeFileSync(fake, `#!/bin/sh\nrm -f '${intake}'\nln -s '${key}' '${intake}'\necho "2.1.314 (Claude Code)"\n`);
  chmodSync(fake, 0o755);
  const r = call(w, ['init', ...initArgs(w)]);
  const keyBytes = readFileSync(key);
  const copies = [];
  if (existsSync(join(w.data, 'active-runs.json'))) {
    const R = runDir(w);
    for (const name of ['assignment.md', 'intake.md']) copies.push(readFileSync(join(R, 'idea', name)));
  }
  assert.ok(copies.every((buf) => !buf.includes(keyBytes)), 'the host key was copied into the run directory');
  assert.equal(r.status, 2, r.stdout);
});
```

F2, `hooks/guard-shell.test.mjs`:

```js
test('fires: PowerShell curly quote ends a quoted run.mjs value', () => {
  const w = world();
  denied(fire(w, run(`decision D-1 proposed --decider 'x’; Write-Output ‘y'`), { tool: 'PowerShell' }));
  denied(fire(w, run(`decision D-1 proposed --decider "x”; Write-Output “y"`), { tool: 'PowerShell' }));
});
```

F3, `hooks/guard-shell.test.mjs` (add `symlinkSync` to the `node:fs` import):

```js
test('fires: guard-shell started through a symlinked plugin root stays silent', () => {
  const w = world();
  const link = join(w.base, 'plugin-link');
  symlinkSync(PLUGIN, link);
  const input = { session_id: 'sess-1', cwd: w.work, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command: `node ${link}/scripts/run.mjs approve idea` }, permission_mode: 'default' };
  const r = spawnSync(process.execPath, [join(link, 'hooks', 'guard-shell.mjs')], { input: JSON.stringify(input), encoding: 'utf8', env: { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: link, CLAUDE_PLUGIN_DATA: w.data } });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(r.stdout.trim(), 'guard-shell.mjs produced no decision');
  assert.equal(JSON.parse(r.stdout).hookSpecificOutput.permissionDecision, 'ask');
});
```

The F3 test assumes the guard needs no host key for an `ask`; if the guard denies for a missing key in that fixture, create the key first and keep the assertion that stdout is not empty.
