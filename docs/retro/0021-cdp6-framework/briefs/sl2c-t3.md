# Brief SL-2c T3: the read-only preflight before every live session (stage-1 worker run 82)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34, ESC-2 of retro 0021-S1: a read-only preflight replaces the hand-written host check for the items it checks); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Output format (final answer, handback only, no file): acknowledgement line; status; per item A1 to A6 and per AC: test titles, red run with the failing reason, green run; files changed with line counts; the four gate commands with real exits and last lines, on the final tree; one real run of `node plugins/cdp6-core/scripts/preflight.mjs` with the arguments its usage names against the live configuration (`--settings ~/cdp6-live/settings-live.json`, project `~/cdp6-p1-scratch`), its exit and output, which is expected to fail on items the live configuration does not yet hold; open questions. No test weakened, removed or skipped. At most 1100 words.

Target state:
- Worktree `<repo>/.worktrees/sl2c`, holding the uncommitted T1 and T2 diffs on top of 1d04d1a (reports `<repo>/docs/retro/0021-cdp6-framework/reports/sl2c-t1.md`, `sl2c-t2.md` and their reviews). Every Bash call starts with `cd <repo>/.worktrees/sl2c && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.26 `<repo>/docs/cdp6/konzept-cdp6.md` (read only, uncommitted, sha256 5fab787730b1a62f6d7196d70dbb0a359d63ed267009c115a54f2397882d2e24): UC-14 step 5 (line 1014, checks (a) to (i)), §5.6 items 1 to 11, §1.2 (the `scripts/preflight.mjs` entry), the SL-2c row (line 1681, part (4)), §15 Q-18 and Q-24, and AC-14.9 to AC-14.16 (lines 1037-1044); docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/` (`sandboxing.md`, `settings-reference.md`, `permissions.md`).

Items, part A: the T2 fixes of `review-verify` run 81 (`reports/sl2c-t2-rv.md`; concept v0.5.26, sha256 5fab787730b1a62f6d7196d70dbb0a359d63ed267009c115a54f2397882d2e24, diff `reports/concept-v0525-v0526.diff`), each first as a red test:
A1. 🔴-1: add the counter-test CT-A unchanged (`.worktrees/sl2c-audit2/plugins/cdp6-core/lib/shell-allowlist-expansion.test.mjs`; the orchestrator ran it red: `git diff $'--output=f'` passed the allowlist and wrote the file), then make `lib/shell-allowlist.mjs` deny an unquoted `{` or `}` and `$` before `'` or `"`, as UC-12 step 7 of v0.5.26 states; CT-A goes green.
A2. 🟢-3 and 🟢-2: drop `git` from the stop allowlist and allow `date` only without arguments or with `-u`, `-R`, `-I…`, `--iso-8601…`, `--utc` or `+FORMAT`; AC-12.36 of v0.5.26 lists the denied (`git status`, `date -s x`, `cat {a,b}`, `ls $'-l'`) and passing (`ls`, `cat f`, `grep x f`, `date -Is`) calls; one test per case; the earlier tests that expected `git` calls to pass change by this concept decision (say which).
A3. 🟡-1: add the counter-test `.worktrees/sl2c-audit2/plugins/cdp6-core/lib/stop-guard-unreadable.test.mjs` unchanged (red on T2); an unreadable or malformed `counters.json` of an active run counts as a stop for guard-phase, guard-shell (SendMessage included); the guard-shell test that asserted `rm f` passes with malformed counters changes by this concept decision.
A4. 🟡-2: add `.worktrees/sl2c-audit2/plugins/cdp6-core/lib/probe-fixture-rows.test.mjs` unchanged (red on T2), revert the A-5 strip in `test-support/probe-fixture.mjs`, and change CT-3 in `scripts/run.test.mjs` so that its own rows hold no `'A-5'` (mirroring the team fixture), so that it tests that a signed team record without A-5 does not open A3.
A5. 🟢-1: CT-2 in `checks/probe-check-session.test.mjs` uses the verdict `launch-refused` (concept :1640); remove the `refused` alias from `checks/probe-check.mjs`.
A6. 🟢-5: `observe-stop.mjs` keeps finding the run by session and working directory and the spawn by `agent_id` in that run's `counters.json` (v0.5.26 states this); no code change unless a test shows a gap.

Items, part B, T3 (each AC first as a red test, then the code):
1. AC-14.9: the sandbox profile argument estimate against the bubblewrap limit of 9000 with the fixture of 1196 `.env*` paths and a counted `denyRead` glob (state the per-path cost you use and why; Q-18 keeps the calibration open).
2. AC-14.10: git repositories under sandbox-writable roots (fixture: 840 git directories under a `/tmp` root).
3. AC-14.11: running Claude Code processes other than the orchestrator and every local MCP server process, over a fixture process table (a second Claude Code process; a stdio MCP child).
4. AC-14.12: the Claude Code version against the accepted probe record, through T1's verified reader (a record whose MAC does not verify fails).
5. AC-14.13 and AC-14.16: the `--settings` file's keys of §5.6 and the egress keys (`permissions.deny` `WebFetch` and `WebSearch`, `disableClaudeAiConnectors` true, `permissions.disableBypassPermissionsMode` `"disable"`), the settings-file sha256, and the printed values of `sandbox.allowUnsandboxedCommands` and `sandbox.failIfUnavailable`.
6. AC-14.14: credential-like environment variable names of the orchestrator process (`--orchestrator-pid`) and of the preflight's own environment, with the Q-24 conflict stated in the output when `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1` is set.
7. AC-14.15: the project's settings files (`.claude/settings.json`, `.claude/settings.local.json`, `.mcp.json`) holding `permissions.allow`, `hooks`, `mcpServers` or `enableAllProjectMcpServers`.
8. Check (f) and (g) of step 5: `missingRules` on the user settings (T1's `Edit(...)` form) and the data-directory state.
9. The script is read-only: it writes nothing, opens no network connection, and exits 0 only when every check passes, otherwise 1 with one line per failure naming the check, the value found and the fix.

Out of scope: T1 and T2 behaviour; changing the live configuration files; any file outside `plugins/cdp6-core/`; the concept.

Rules, gate commands, tools and stop rule as in `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2c-t1.md`; reading `~/cdp6-live/settings-live.json`, `~/.claude/settings.json` and `/proc` is allowed for the one real run.

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1 (plus the uncommitted T1 and T2 diffs)
baseline: the orchestrator's re-run of the four gates after T2 (ledger 0021)
run grant: impl-uc, 3 uses confirmed by the owner 2026-11-06T08:56:41+01:00, this run the third

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
