# Retro 0021-S1: CDP6 stage-1 live P1 run 1 and the path to it

Status: proposed · 2026-11-05 · moderated by pm-retro (stage-1 run 72, read-only, fresh context: yes, contract v2 f91736a60d15; brief `briefs/retro-stage1-live-run-1.md`) · filed by the orchestrator. memory-loop check: not run.

Short names: ledger = `docs/retro/0021-cdp6-framework.ledger.md`; concept = `docs/cdp6/konzept-cdp6.md` v0.5.21; probe = `.worktrees/sl0-kit/docs/cdp6/probes/2.1.314.md`; record = `docs/retro/0021-cdp6-framework/reports/live-p1-run-1.md`.

## Assignment (verbatim, owner)
- "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).
- "go always with your recommendation if they are reviewed" (2026-11-02).
- "Confirm" on the combined fix and grant of the SL-2 fix round (2026-11-04) and on the stage-1 host-check amendment (2026-11-04T20:50:38+01:00, ledger:276).
- "Ja und dann einen Zwischenstand wie weit wir sind. Ich möchte das du das Projekt Autonom zu ende bringst, Ohne etwas wegzulassen, zu faken, oder etwas abzukürzen." (2026-11-05, ledger:307).

## Carry-over (retro 0020)
| Item | Status | Evidence |
|---|---|---|
| RC1 release gate (live test before release) | held as an action; the root-cause class recurred (RC-A) | 0020:66; the CDP6 live run is that gate and fired (record:3) |
| RC2 `anchors.test.mjs` | held | 0020:67; the file is modified and uncommitted |
| RC3 numbering check, ledger by hand | held | ledger 0021 exists; 0020:91 |
| RC4 counter-role row for doctrine or policy change | held | commit 86a7afc |
| L1 "a test that never starts the program is not evidence" | recurred | RC-A |
| L2 to L5 | held | konzept-lint exit 0 per version (ledger:282, :285); stop-table defaults (concept:1697-1709); deny rules on the tooling (ledger:278); counts from the ledger |
| O1 to O25 (ledger:28-52) | unverified | only the header snapshot was read |

Recurrence: the RC1 class (an entry point not run in the target environment) stood at 4 in 0020:57; this run is the 5th. Host-only environment defects: 0020 D-14, D-16 (DECISIONS.md:243) and this run, the 3rd.

## Planned versus happened
Planned: runbook steps 1 to 12, ending in a pass of the stage-1 stop row. Happened: steps 1 to 8.3; the devils-advocate spawn on D-1 finished without a capture (ledger:302); the run stopped; stage 1 is not passed (record:3).

Decision chronicle: E1 19:53 SL-2 committed as 1d04d1a (owner, ledger:270); E2 20:40 live-run plan (owner "Yes so it", ledger:272); E3 20:46 run 65 🔴 `defaultMode: auto` closed by `default` in settings-live.json (orchestrator, ledger:274-275); E4 20:50 host-check amendment (owner "Confirm", ledger:276); E5 20:54 orchestrator writes the user-settings rules once, a deviation from §5.6 item 9 (owner, ledger:278); E6 21:14 stage-2 line re-estimate, concept v0.5.20 and v0.5.21 (ledger:281-285); E7 22:01 runbook rewritten after run 71 found two 🔴 (ledger:287-288); E8 2026-11-05 08:06-08:18 PhpStorm closed, mode `default` confirmed (ledger:292, :295); E9 09:06 `/tmp/cdp6-*` deleted, sandbox still failed (ledger:298-299); E10 10:28 long-term sandbox fix (owner, ledger:300); E11 10:41 root cause found (ledger:303); E12 10:42-10:44 session ended, evidence copied (ledger:304-306).

## What went well
- Hooks and contract held: both agents opened with `cdp6-contract: v1 c88130959164` (record:29); all 64 hook lines show `permission_mode` `default` (record:13); the spawn guard bound D-1 and the target hash matched the file (ledger:301).
- The owner prompts for `run.mjs` worked: 15 `ask` lines, 15 nonces (ledger:304).
- Evidence kept outside every repository with a manifest (record:16).
- The stop table fired as designed, at the cheapest live step, before any stage-2 slice.
- Two read-only reviews found a 🔴 (run 65) and two 🔴 (run 71) before the run.
- The deny rules held when the orchestrator's own settings edit was refused (ledger:300).

## What did not go well (system causes, blameless)
1. The capture route cannot work in the pinned mode (RC-A).
2. Host state differed from the tested state; every sandboxed command failed until 10:28; two MCP-capable processes ran on the day (RC-B).
3. Four orchestrator-record errors were caught after writing, each by a later check (RC-C).
4. Stage 1 ran 71 worker runs against a first cap of 38 and a last cap of 60 (RC-D).
5. The live main session spawned D-2 in parallel and resumed D-1; no stop rule covered "agent finished, no capture", and the spawn guard allows a second devils-advocate spawn on another task (RC-E).
6. Claude Code 2.1.318 reports `Write(...)` deny rules as never matching and shows "manual mode" (ledger:293, :295); covered by RC-B.

## Root causes
### RC-A 🔴 The route that delivers the one required artefact was never run in the mode the live run uses
1. No verdict was captured: `SubagentHandback` is not provided in `default`; the agents had Read, Grep and Glob (record:30, :33).
2. The build depends on it: UC-12 step 4 and `check-handback.mjs` on PreToolUse `SubagentHandback` are the only capture route (concept:888); `hooks.json:49-59` is the only handback registration.
3. The Stop route was not built: `check-stop.mjs` was moved to SL-2b (concept:1657, :2054); the consumer test did not name the stage-1 default path as a consumer.
4. No probe or review showed the mode dependence: the SL-0 rows ran A-5 in four modes and A-12 in three, but no row records the handback tool per mode (probe:23, :28); most rows name no mode (probe:13); the user default was `auto` (ledger:275). Inferred, unverified: the subagent rows ran in `auto`, where the tool exists.
5. The 🔴 fix of run 65 moved the run from `auto` to `default` (ledger:275); the preparation review never asked which tools exist in `default`.

Prior knowledge existed: DECISIONS.md:243 (D-16, 2026-10-20) and the docs copy of 2026-10-28 (`hooks.md:1927`, "in auto mode"); the 2026-11-05 fetch says "only in auto mode" (`tools-reference.md:53`). The `check-handback` unit tests supply `tool_name` themselves (check-handback.mjs:99-100), so they cannot show whether Claude Code provides the tool (tests not read; unverified).

Recurrence: RC1 class, 5th; a 🔴 escalates at its first recurrence (§32.6): ESC-1.

### RC-B Environment facts are gathered once, by hand, and not re-run against the live configuration
1. The sandbox failed: bubblewrap profile 9525, then 9530 arguments against 9000 (record:36).
2. The `~/**/.env*` denyRead wildcard expands per matching path, 1196 under `~` (ledger:299); the first hypothesis (840 git repositories under `/tmp`) was half right (ledger:298-299).
3. Unseen because the SL-0 probes ran on another host state and the limit is not in the concept (concept:1299).
4. The playwright plugin and the PhpStorm MCP server were missed: the 2026-11-02 host check was a hand-written list; playwright surfaced in run 65 (ledger:275), the PhpStorm child process by `pgrep` on the morning of the run (ledger:291).
5. The 2.1.318 changes surprised: the version floor checks only a minimum (concept:108); nothing re-probes when the version differs from the record's 2.1.314.

Recurrence: 3 (0020 D-14, D-16, this run); escalated (ESC-2).

### RC-C The orchestrator's records are written from memory of the records, not from a re-read
1. Four errors found afterwards: a line count without the counting rule (ledger:271, corrected :281); a recording time stated as "measured earlier" (ledger:271); the runbook put `decided` before the spawn (ledger:287); "default shows no label" while the probe says "manual" (probe:23, :62; ledger:295).
2. Each claim was taken from memory, not from the cited line.
3. The completeness check (run 71) is optional and ran once.
4. Ledger rows carry no per-claim source field.
5. Root: a claim has no required source line, and its check is a later review, not the author.

Recurrence: 1 in this repository's retros (4 instances in this run); global rules F07 and F14 name the class, so the count is a lower bound.

### RC-D The budget is a trigger, not a bound, and was set before measurement
1. 71 runs against a first cap of 38: the cap rose 38, 42, 45, 52, 56, 58, 60, then set aside (concept:1687; §0 items 31, 33).
2. Review depth per worker result (concept:1681) multiplied fix loops; both slices are security-boundary.
3. The model came from slice estimates; lines came out 4.27 times the estimate (ledger:281-282).
4. The checkpoints returned control to the owner but did not change the plan.
5. Root: no unit of work was priced from measured data before it started.

Recurrence: 1.

### RC-E No stop rule for "agent finished, no capture", and the spawn guard allows a parallel second devils-advocate spawn
1. The session spawned D-2 and resumed D-1 without an instruction for a missing capture (ledger:302).
2. Concept:886 denies concurrent spawns of the same role "for the same task"; D-2 has another task.
3. The runbook's stop table covers the condition only after the run ends (runbook:51); step 8.3 assumes the capture appears.
4. Workarounds were tried: a hash by running the gate, an unsandboxed `date -Is; ls` (record:39; ledger:296-297).
5. Root: a failure branch exists only as an end-of-run row.

Recurrence: 1.

## Kaizen (one action per cause)
| Cause | Action | Owner | Success criterion | Tracked |
|---|---|---|---|---|
| RC-A | Probe row A-23: the report route per mode `default`, `acceptEdits`, `auto`, with `--settings` as in the live run; a pre-intake smoke step in the live session (a throwaway `cdp6-core` agent whose handback or Stop line must appear in `hooks-fired.jsonl`); the route decision is ESC-1 | orchestrator (probe), owner (route) | per-mode result for three modes; the smoke step passes in the exact live configuration; a fixture of a worker ending without the handback tool turns a test red before the fix and green after | concept §11.1; ledger 0021; new O-row |
| RC-B | A read-only preflight in place of the hand-written host-check line: sandbox profile argument estimate, git repositories under writable roots, running Claude Code and MCP processes, version against the probe record | orchestrator; implementer for the T1 script | exit 0 on the live host before the start stamp; non-zero on fixtures with 1196 `.env*` paths, 840 git directories and a stdio MCP child | concept §11.3 item 3; new O-row |
| RC-C | Every runbook and ledger row stating a number, order or label cites the record line it was read from; the completeness check on the draft is required before any owner-attended run; times only from `date -Is` | orchestrator | the next runbook has zero 🔴 from the completeness check; at most one post-hoc correction of an orchestrator row in the next run | ledger 0021; orchestrate brief template |
| RC-D | Q-17 and the stage-2 plan priced from the measured 71 runs and the 4.27 line ratio by slice class | owner (cap), orchestrator (forecast) | the stage-2 forecast states P90 and P(above threshold) from the measured runs; the owner records the cap decision | concept Q-17, §0 item 33 (2) |
| RC-E | Runbook stop row "agent finished and no capture line appears → stop and report; no spawn, resume or gate run"; `guard-spawn.mjs` denies a second devils-advocate spawn while a bound spawn of that role is pending, whatever the task (concept change, to konzept-reviewer) | orchestrator | a second spawn on another task is denied while the first is pending, red before and green after; zero spawn or resume after a missing capture in the next live run | runbook; SL-3 item; O-row |

Causes without an action: none.

## Lessons
- L6. Treat the permission mode, version and settings of a probe as a recorded variable; each probe row names its mode, and mode-dependent results run per mode. SL-0 and 64 runs passed in one mode while the live run used another.
- L7. A fix that changes the environment (run 65: `auto` to `default`) leaves the tested envelope; re-run the path's smoke step after the fix. It closed one 🔴 and caused the next failure.
- L8. Platform facts in a sibling project's decision log (D-16) belong in the new concept's assumptions; concept §11.1 cites D-16. The fact was written down on 2026-10-20 and not used.
- L9. A stop condition for the unexpected must exist before the attended run starts (RC-E's row). The session improvised four steps without a rule.
- L10. Resource limits are a property of the host; the RC-B preflight. 9000 arguments stopped the session from 08:40 to 10:28.

Core lesson: a path counts as working only once it has run in the configuration it is used in, and every other environment fact needs a check run on that day.

## Fork balance
- New forks commissioned by §11.3 item 3 and deletable after the stage: `~/cdp6-live/cdp6-core`, `~/cdp6-p1-scratch`, `settings-live.json`; by the owner: `~/cdp6-evidence/live-p1-2026-11-05/`, the user-settings rules. No new code fork, subsystem, table or mode.
- Deletion candidates: the single-route capture design (SubagentHandback only); the `~/**/.env*` wildcard (replaced, ledger:300); 1721 `/tmp/cdp6-*` leftovers (deleted, ledger:298).
- Opened paths: RUN-20261105-intake with two pending spawns (kept as record, owner); evidence copy (closed); user-settings rules (transcript entries removed, ledger:306; the rest open, owner); `~/cdp6-live-scratch` (orchestrator check 2026-11-05: absent, renamed to `~/cdp6-p1-scratch` on 2026-11-04, ledger:275); concept follow-ups (§5.6 item 5, `Write(...)` form, "manual" label, run 64 R2, K2, SL-3 and SL-4 items, `check-handback.mjs:100` silent skip; orchestrator); cap review and Q-17 (owner); live-run record review (runbook step 11; superseded by this retro for run 1); Windows admin session (declined, least privilege); 0020 calibration set, eval suites, Orbit paragraphs (orchestrator).

## Escalations (owner decides)
- **ESC-1 (RC-A, 🔴).** (a) Build the Stop route (`check-stop.mjs` reading `last_assistant_message`, or the transcript) into stage 1, so `default` captures; (b) run the live P1 in `auto` with an accepted probe record, which pulls SL-8's `probe --accept` into stage 1; (c) both. Recommendation: (a): it keeps the pinned `default` (concept:1678) and the prompting owner commands, on condition that SubagentStop can carry the verdict into the same capture index.
- **ESC-2 (RC-B, third recurrence).** Adopt the preflight in place of the host-check line, as a decision for concept §11.3 item 3.

Stage 2 stays blocked until the owner decides ESC-1 (§11.3 stop table).

Unverified: the SL-0 subagent rows' mode (inferred), the `check-handback` tests (not read), the O-table states after ledger:52.

## Orchestrator verification (2026-11-05)
Checked against the sources before filing: DECISIONS.md:243 and :270 (D-16 records the SubagentHandback route in auto mode); `~/cdp6-scratch-backup-2026-10-28/docs/hooks.md:1927` ("which Claude Code provides in auto mode"); probe:13 (start line names "the mode and teammate flags each row names") and probe:23 (A-5 in four modes, `default` shown as "manual"); concept:886 ("two concurrent spawns of the same role for the same task"); `~/cdp6-live-scratch` absent.
