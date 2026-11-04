# Brief: review-verify of the live P1 run preparation (stage-1 worker run 65; cap set aside by §0 items 31 and 33)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and, on the orchestrator's plan for the live P1 run, "Yes so it" (2026-11-04; ledger 0021). Concept §11.3 item 3: the orchestrator copies the reviewed build from its commit to the `--plugin-dir` directory with a `diff -r` exit 0, the sandbox settings of §5.6 are set by hand in a `--settings` file outside every sandbox-writable path, and `review-verify` checks them against the settings files.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim below (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: the answer to each question below with evidence; then the findings that should change the settings file, the copy, the scratch repository or the owner's preconditions, ranked 🔴 🟡 🟢, each with one closing proposal; then status. At most 800 words.

Target state:
- Build commit: `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, HEAD 1d04d1a14b897af3dbee8275b6e48a454331b0c1, clean.
- Plugin directory for `--plugin-dir`: `~/cdp6-live/cdp6-core` (67 files, extracted with `git archive 1d04d1a plugins/cdp6-core`).
- Settings file for `--settings`: `~/cdp6-live/settings-live.json` (sha256 a9ee5e349c6a9738d7df361691fa1278802768c09b08e2a7f706ca3d1e6fcc96).
- Scratch repository: `~/cdp6-live-scratch` (branch `main`, one commit 2fe8814 with a README).
- Data directory under `--plugin-dir`: `~/.claude/plugins/data/cdp6-core-inline/` (exists, empty, from SL-0).
- User settings: `~/.claude/settings.json` (holds no `permissions.deny` and no `sandbox` key today).
- Concept v0.5.19 `<repo>/docs/cdp6/konzept-cdp6.md` (sha256 cb5b2025b10cf3ebfda7155c0b0841653fe1ae7685c53e72543786dca9df2de1): §1.4 items 5, 8 and 10, §5.6, §11.3 item 3, §11.4.
- Local documentation copies the concept cites: `~/cdp6-scratch-backup-2026-10-28/docs/` (`sandboxing.md`, `settings.md`, `hooks.md`); they were fetched for Claude Code 2.1.314. `claude --version` now prints 2.1.318.
- The rule check the build applies at `run.mjs init`: `~/cdp6-live/cdp6-core/lib/user-settings.mjs` (`missingRules`), called from `scripts/run.mjs:282-285`; it reads only `~/.claude/settings.json`.
You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. `~/cdp6-live/cdp6-core` equals the tree of `plugins/cdp6-core` at 1d04d1a (`diff -r` exit 0).
2. The settings file holds every key of §5.6 items 1 to 6 and the entries of items 9 and 10, in the path forms the local documentation gives for sandbox paths and for permission rules, with no bare `*` and no broad domain in the allowlist, and with the `excludedCommands` pattern naming the `--plugin-dir` directory.
3. The settings file's real path lies outside every sandbox-writable path of a session started in `~/cdp6-live-scratch` (§5.6 "Protection of the `--settings` file").
4. `missingRules` returns no entry for the settings file's content and eleven entries for today's `~/.claude/settings.json`, so `run.mjs init` refuses until the owner adds the rules of §5.6 items 9 and 10 to user settings.

Questions:
1. Do §1.4 item 10 and §11.4 require an A-19 check of the shell-running tools (or another probe row) for Claude Code 2.1.318 before the live run, given the probe record is for 2.1.314?
2. Which preconditions of §11.3 item 3 remain open for the owner before the live run, beyond the host-check amendment (PATH, `<data>/probes/` empty, the events that delete the data directory) and the user-settings rules?
3. Does any setting in the file block a step of the P1 path that the live run needs (`run.mjs` calls, the devils-advocate spawn and its handback, writes of `R/idea/idea.md` in the scratch repository)?

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <path> log`, `git -C <path> status`, `git archive … | tar -t`, grep, sed -n, cat -n, wc, sha256sum, `realpath`, and `node -e` calls that import `~/cdp6-live/cdp6-core/lib/user-settings.mjs` and print `missingRules` for a JSON file). No test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 30 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
