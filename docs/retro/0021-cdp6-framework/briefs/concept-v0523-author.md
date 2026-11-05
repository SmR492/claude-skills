# Brief: concept v0.5.23, folding in review-verify run 74 and threat-modeler run 75 (author run; stage-1 worker run 76)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, ledger 0021, §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Input: concept v0.5.22 `<repo>/docs/cdp6/konzept-cdp6.md` (sha256 ac2732db05cd6227685d3440db357e1c63d34a16706eac30546041b424e321dd); the two reviews as handed back, saved at `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0522-rv.md` and `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0522-tm.md`; docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/`; build `<repo>/.worktrees/sl2/plugins/cdp6-core`.

Task: write v0.5.23 as a complete edited copy at `<repo>/.worktrees/sl2-review-inputs/konzept-v0523-draft.md`; do not edit the repository file. Carry every item below at every place it applies, so that no unchanged line contradicts it; decider of each is the owner by the standing rule of 2026-11-02 on the reviewed recommendation (say so in the changelog entry):

From run 74:
1. F1 (claim 3b refuted): one scope for the stop guard's write deny: UC-12 step 7's "every Edit, Write and NotebookEdit call of the active run" also in the UC-12 error row; AC-12.34 adds the test title "fires: edit outside phase directory after uncaptured finished agent".
2. F2: the probe session and §11.4 gain an A-12 `auto` case: a `dangerouslyDisableSandbox` request (and a command the sandbox cannot start) is refused without a classifier prompt when `sandbox.allowUnsandboxedCommands` is false; record that in live run 1 an unsandboxed request reached the owner prompt while every sandboxed command failed on the bubblewrap limit (record `reports/live-p1-run-1.md:39`, ledger 0021 2026-11-05T08:21:13+01:00) and that the cause is unconfirmed; preflight check (e) prints the value of `sandbox.allowUnsandboxedCommands`.
3. F3: AC-12.34 one test title per denied or allowed case.
4. F4: the stop guard acting in every permission mode joins Q-19 as an open point.
5. F5, F6, F7: citation fixes as the review states them (each part of the §13.1 `--plugin-dir` row to its own source; the local file name `plugins-components.md`; the quote "only in auto mode" cites `tools-reference.md:53` alone).

From run 75:
6. T1 🔴: the live-run `--settings` file holds `permissions.deny` entries for `WebFetch` and `WebSearch` and `disableClaudeAiConnectors: true` (settings-reference.md:82, fetched 2026-11-05); preflight exits 1 without them; AC-14.13 "fires: web or connector egress open in auto". State in §11.3 item 3 why (auto mode lets the classifier alone approve these tools, permission-modes.md:595) and add the rows to §13.1.
7. T2: preflight check of credential-like environment variable names of the orchestrator and live-session environment unless `CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1`; AC-14.14; §5.6 names it.
8. T3: AC-11.22: `probe --accept` refuses an A-23 `auto` row without a `check-handback.mjs` line in `hooks-fired.jsonl` with that row's `agent_id`, `permission_mode` `auto` and the record's version; the owner prompt reason lists each row's parsed per-mode verdict, not only a hash.
9. T4: AC-12.36: while a finished agent has no capture, shell calls that write (redirect, `tee`, `cp`, `mv`, `ln`, `sed -i`) or start `claude` are denied; read-only calls pass; UC-12 step 7 says so.
10. T5: AC-14.15: preflight exits 1 on `permissions.allow`, `hooks`, `mcpServers`, `.mcp.json` or `enableAllProjectMcpServers` in the project's settings files.
11. T6: `permissions.disableBypassPermissionsMode: "disable"` in the live `--settings` file (settings-reference.md:150, :1164); preflight AC-14.16; this answers Q-21 by the standing rule on the reviewed recommendation (mark Q-21 answered with decider and source).
12. T7: AC-11.23: the record MAC uses its own label (domain separation from the hook-token MAC); a token MAC over the record bytes does not verify.
13. Q-20: adopt the host-key MAC for accepted probe records, as both the author proposal and run 75 recommend; mark Q-20 answered by the standing rule.
14. The residual risks run 75 lists without an AC (handback injection into working-directory edits, the scratch repository's CLAUDE.md reaching the classifier, `observe-stop.mjs` fail-open, the model-transcribed calibration factor, approval fatigue until SL-8, the Q-22 skip without a hook line) go into the residual list of §7 (or where the concept keeps residuals) with the record review as the stated backstop.
15. The SL-2c row gains the new ACs; adjust its line estimate if the added checks change it, and say how.
16. Version 0.5.23, As-of clause, changelog entry.

Rules, checks and output as in `<repo>/docs/retro/0021-cdp6-framework/briefs/concept-v0522-author.md` (English, unchanged sentences byte-identical, every new AC with the table's columns and a test title, citations, no new owner decision beyond the standing-rule answers named above, konzept-lint exit and last lines, hunk count against v0.5.22, and per item 1 to 16 the draft lines that carry it). At most 700 words. Write only the draft file and files under `/tmp/claude-1000/-home-riedl-stefan-PhpstormProjects-GITHUB-SmR492-claude-skills-main/7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c/scratchpad/v0523/`.
