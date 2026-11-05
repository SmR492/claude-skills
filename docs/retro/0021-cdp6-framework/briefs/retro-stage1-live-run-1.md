# Brief: retrospective of the CDP6 stage-1 live P1 run 1 and the path to it (stop table of concept §11.3: "the cause goes to a retro before any stage-2 slice")

Assignment (owner, verbatim):
- the goal of the build: "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04);
- the standing rule: "go always with your recommendation if they are reviewed" (2026-11-02);
- the owner's "Confirm" answers: on the combined fix and grant of the SL-2 fix round (2026-11-04, ledger 0021) and on the stage-1 host-check amendment (2026-11-04T20:50:38+01:00, ledger 0021);
- on this retro: "Ja und dann einen Zwischenstand wie weit wir sind. Ich möchte das du das Projekt Autonom zu ende bringst, Ohne etwas wegzulassen, zu faken, oder etwas abzukürzen." (2026-11-05).

Output format (final answer, handback only, no file): after the acknowledgement line, the retro in the §32.6 layout of the doctrine copy `<repo>/plugins/cdp5-gates/skills/cdp5-reference/konzept-design-pattern-v6.md` (§32.6, §32.6.1, §32.7): assignment quoted; carry-over; planned versus happened; what went well; what did not go well (system causes, blameless); root causes with Five Whys and recurrence count; one Kaizen action per root cause (owner as a role, measurable success criterion, place where it is tracked); lessons (one-line summary, correction, why it mattered); fork balance; escalations. At most 2000 words. The orchestrator files it as `<repo>/docs/retro/0021-cdp6-framework/retro-stage1-live-run-1.md`.

Previous retro and carry-over: `<repo>/docs/retro/0020-cdp5-alignment-v6.md` (Kaizen and lessons) and the open-items table O1 to O25 in `<repo>/docs/retro/0021-cdp6-framework.ledger.md` (lines 28 to 52). Mark each Kaizen action and lesson of 0020 done, held or recurred with evidence; count recurrences across 0020, 0021 and this run.

Material of this run (read; quote with file:line):
- the run record `<repo>/docs/retro/0021-cdp6-framework/reports/live-p1-run-1.md`;
- ledger 0021 rows from 2026-11-04T19:53 to the end (grep for `2026-11-04T2`, `2026-11-05`);
- the runbook and its completeness check: `briefs/live-p1-runbook.md`, `reports/live-p1-completeness.json`;
- the reviews of the live preparation and the line re-estimate: `reports/sl2-live-prep-rv.md`, `reports/sl2-line-reestimate-rv.md`, `reports/sl2-line-measure-workflow.json`;
- concept v0.5.21 `<repo>/docs/cdp6/konzept-cdp6.md`: §11.3 (items 1 to 4, counting rule, stop table), UC-12 (Route, step 4), §5.6, §1.4, §11.4 (SL-0 results);
- the SL-0 probe record `<repo>/.worktrees/sl0-kit/docs/cdp6/probes/2.1.314.md`;
- the build at `<repo>/.worktrees/sl2/plugins/cdp6-core` (1d04d1a): `hooks/check-handback.mjs`, `hooks/guard-shell.mjs`, `hooks/hooks.json`;
- Claude Code documentation copies fetched 2026-11-05 under `/tmp/claude-1000/-home-riedl-stefan-PhpstormProjects-GITHUB-SmR492-claude-skills-main/7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c/scratchpad/docs/` (`tools-reference.md:53`, `hooks.md:1928`, `hooks.md:2012-2014`, `settings-reference.md:1040-1075`, `sandboxing.md:540-546`) and the copies of 2026-10-28 in `~/cdp6-scratch-backup-2026-10-28/docs/`;
- git history of the work, run by the orchestrator (do not re-run):
  - `git -C <repo> log --oneline -6` exit 0: 5f433e3 (live run 1 record), 14a87b7 (concept v0.5.21, live-run preparation), 3c57688 (concept v0.5.19, SL-2 docs), 86a7afc, 2ed9a54, 27e3326;
  - `git -C <repo>/.worktrees/sl2 log --oneline -2` exit 0: 1d04d1a (SL-2 code), 960146b (SL-1 code).

Problems to drive to root causes (add any you find; each blameless, the system is the object):
1. The capture path of SL-2 needs `SubagentHandback`, which Claude Code provides only in auto mode, while the live run is pinned to `default`; about 64 review, audit and fix runs and the concept rounds did not find this before the live run. Why did no probe, review or test show which permission modes provide the tool?
2. The sandbox failed for every command in the live session (bubblewrap 9000-argument limit; the `~/**/.env*` wildcard; 840 git repositories of test leftovers under `/tmp`); the SL-0 probes ran on another host state.
3. The host check of 2026-11-02 missed the user-level playwright plugin and a PhpStorm MCP server that were running on the day of the live run.
4. Orchestrator errors caught after the fact: a line measurement without the counting rule (ledger 20:41:59), an estimated time in the ledger, the runbook order D-1 `decided` before the spawn and the playwright gap (completeness check run 71), the "no label in default mode" claim.
5. Claude Code 2.1.318 changed behaviour the concept relies on (`Write(...)` deny rules never match; "manual mode" label).
6. The live main session deviated from the owner's instruction (parallel D-2 spawn) and tried workarounds (running the gate for a hash, fixture work in the main session).
7. Stage 1 used 71 worker runs against a first cap of 38 and a last cap of 60 (set aside by §0 items 31 and 33).

Recurrence: compare each root cause with 0020 and the O-table; a root cause at its third recurrence is escalated as a decision proposal.

Tools: Read, Grep, Glob. No writes, no network.

Stop rule: one pass; at most 40 tool calls; a statement without file:line evidence is marked as unverified.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
