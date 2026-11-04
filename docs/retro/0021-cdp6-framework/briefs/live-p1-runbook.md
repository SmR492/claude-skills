# Runbook: stage-1 live P1 run (concept v0.5.21 §11.3 item 3)

Owner steps for the live P1 run, prepared 2026-11-04 by the orchestrator and checked by a completeness run (stage-1 run 71, `reports/live-p1-completeness.json`); the run is set for 2026-11-05 at 07:00 (ledger 0021). Every fact below was read on 2026-11-04 and is re-read by the orchestrator in step 1.

## Prepared state (ledger 0021, 2026-11-04)
| Item | Value |
|---|---|
| Build under `--plugin-dir` | `~/cdp6-live/cdp6-core`, copy of `plugins/cdp6-core` at 1d04d1a (worktree `<repo>/.worktrees/sl2`), `diff -r` exit 0 |
| Settings file for `--settings` | `~/cdp6-live/settings-live.json`, sha256 780df1b922568aa38f5ed00e04d3215f2da5b6e253cc745129769c5e505b8699 |
| Scratch repository | `~/cdp6-p1-scratch`, branch `main`, commit 2fe8814 |
| Data directory | `~/.claude/plugins/data/cdp6-core-inline/` (empty; `probes/` absent) |
| User-settings rules (§5.6 items 9, 10) | in `~/.claude/settings.json` since 2026-11-04T20:54:39+01:00; `missingRules` [] |
| Run directories | `S` = `<data>/runs/<run-id>/`; `R` = `~/cdp6-p1-scratch/docs/cdp6/runs/<run-id>/` (class `own`, no `--root`) |

## Before the live session
1. Orchestrator: re-read the prepared state (settings-file hash, `diff -r` of the copy against `<repo>/.worktrees/sl2/plugins/cdp6-core` at 1d04d1a, `missingRules` on the user settings, empty data directory) and write the result to ledger 0021.
2. Owner: end the orchestrator session and start it again without the playwright plugin, so that no local MCP server runs during the live run (§11.3 item 3; ledger 2026-11-02 and 2026-11-04T20:53:23+01:00):
   `cd <repo> && claude --resume --settings '{"enabledPlugins":{"playwright@anthropic-plugin-directory":false}}'`
   In it, `/mcp` lists no local (stdio) server; the orchestrator writes the result to ledger 0021.
3. Owner: close every other Claude Code session; none runs during the live window.

## Live session
4. Owner: start the live session in a terminal:
   `cd ~/cdp6-p1-scratch && claude --plugin-dir ~/cdp6-live/cdp6-core --settings ~/cdp6-live/settings-live.json --strict-mcp-config`
5. Owner, before any task: `/status` ("Setting sources" lists "Command line arguments"; permission mode `default`), `/mcp` (no server), `/hooks` (cdp6-core hooks; no cdp5-agents, cdp5-gates or domain-agents hook). The bootstrap prints no text while no run exists; a stderr line "cdp6-core: host key not created" is a stop. Bring the three results to the orchestrator session, which writes them with the time to ledger 0021 and checks that `<data>/hooks-fired.jsonl` holds a `bootstrap.mjs` line with the live session id.
6. Owner: give one small idea in the conversation and ask for the idea phase with `/cdp6-core:idea`, mode `single`, class `own`. The main session writes the intake and assignment files into the scratch repository and calls `run.mjs init` with origin `conversation`.
7. Every `run.mjs` call prompts in stage 1, the routine ones too (`init`, `enter`, `id`, `decision D-1 proposed`, `status`): routine prompts carry the reason `run.mjs <call>`, owner commands `owner command: …`. Answer each within ten minutes; an exit 2 naming the token age means the main session repeats the call. Never choose "always allow"; do not change the permission mode.
8. Order of the idea phase (idea skill steps 2 to 6, UC-01):
   1. the interview, one question at a time, each answer an `I-n` row;
   2. `R/idea/idea.md` written, then `decision D-1 proposed`;
   3. the devils-advocate spawn on `D-1` and its captured handback (`S/verdicts/D-1-devils-advocate-<agentId>.md`); refuse any `decision D-1 decided` prompt before that file exists, because `decided` cannot be undone and the capture must be stamped before it;
   4. for a verdict (b), (c), a `conflicted` capture or a rejected capture with (b) or (c): one owner record per listed item, each after reading the capture file: `object <capture id>:F-P1-<n>|premise-<n>|conflict accept|reject --why "<why>"`, or `object <capture id>:capture …` for a rejected capture with a verdict (b) or (c); all before the `decided` prompt; or leave the run halted for the owner (`abandon` is not built);
   5. the owner's pick: `decision D-1 decided --decider owner` (owner command);
   6. `set-autonomy A0 --tokens <n> --loops <n>` (owner command);
   7. `exit idea`; on a pass the output is `{"phase":"idea","state":"gate-pending","awaiting":"approve"}`;
   8. `approve idea` (owner command), the A0 human gate; ask for it if the main session does not offer it.
9. Owner: note the run id and the session id (`/status`), end the live session, and give the end time; the orchestrator records it with `date -Is` in ledger 0021.

## After the live session
10. Owner: wait at least ten minutes after the live session ended (no `run.mjs` prompt can follow it; UC-11 step 1.3), then remove `Read(~/.claude/projects/**)` from `permissions.deny` and `~/.claude/projects` from `sandbox.filesystem.denyRead` in `~/.claude/settings.json` (§5.6 item 9); the orchestrator records the removal time. The other rules stay until the owner decides otherwise.
11. Orchestrator: spawn `review-verify` with `briefs/live-p1-record-rv.md`, filling in the run id, the session id, the transcript path, the end time and the removal time.
12. Orchestrator: write the live run's worker-run count (counting rule of §11.3) and the stage-1 end stamp to ledger 0021; the owner's cap review follows (§0 item 33 (2)), with Q-17.

## Stops
| Event | Action |
|---|---|
| a step-5 check fails, or a guard blocks every call | end the session; start it again without `--plugin-dir` if needed (§1.4 items 5 and 8); ledger line |
| `run.mjs init` exits 2 (for example `user-settings-rule-missing`) | bring its stderr JSON to the orchestrator session; no model edits the settings (STOP-2) |
| the run pointer or `run.json` is missing or unreadable | end the session; the owner restores `<data>/active-runs.json`, or `S/run.json` from `S/run.journal.jsonl`, by hand outside Claude Code; ledger line (§11.3 item 3) |
| a devils-advocate target stays write-locked without a capture, or a second spawn of the role is refused (unbound pending spawn) | end the session; the owner sets `"void": true` on the stale entry under `pending` in `S/counters.json` by hand outside Claude Code; ledger line (§11.3 item 3) |
| the run ends without the contract acknowledgement or without a captured devils-advocate verdict | stage 1 is not passed; the cause goes to a retro before any stage-2 slice (§11.3 stop table) |
