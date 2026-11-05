# Stage-1 live P1 run 1 (2026-11-05): record and result

Result: stage 1 not passed. The contract was acknowledged, but no `cdp6-core:devils-advocate` verdict was captured (concept v0.5.21 §11.3 stop table: "the live P1 run without contract acknowledgement or without a captured devils-advocate verdict | stage 1 is not passed; the cause goes to a retro before any stage-2 slice").

## Run
| Item | Value |
|---|---|
| Live session | caef3109-9ba7-43da-ba05-4a8e91f10f29, `claude --plugin-dir ~/cdp6-live/cdp6-core --settings ~/cdp6-live/settings-live.json --strict-mcp-config` in `~/cdp6-p1-scratch`, Claude Code 2.1.318, mode `default` ("manual mode") |
| Build | copy of `plugins/cdp6-core` at 1d04d1a, `diff -r` exit 0 (2026-11-04 and 2026-11-05T07:08:19+01:00) |
| Settings file | sha256 780df1b9… until 10:28, then 02a4e9ee… (owner's change: read block on, `.env` wildcard narrowed to the project) |
| Run | RUN-20261105-intake, class `own`, mode `single`, autonomy `A0` not yet set; phase idea entered; D-1 to D-3 proposed |
| Devils-advocate spawns | D-1 agent a4d081c11a07b2407 (09:30:36Z, resumed 09:35:58Z), D-2 agent ae6145752b625528f (09:34:07Z); both bound in `S/counters.json`, neither captured; D-3 not spawned |
| Hook log | 64 lines; `permission_mode` `default` on every guard line; 15 guard-shell `ask` lines (last 09:30:01Z); no `check-handback.mjs` line |

## Evidence
Kept outside every repository in `~/cdp6-evidence/live-p1-2026-11-05/` (48 files, `MANIFEST.sha256` sha256 5b3d9d9712f287d8d65edfb6a46765371686464f8e024db60dc537878a113f20): `data/` (copy of the plugin data directory), `scratch-repo/`, `settings-live.json`, `user-settings.json`, `transcripts/` (main session and both subagents). Key files:

| File | sha256 |
|---|---|
| data/hooks-fired.jsonl | 018e81a3b44784868b98f6881745e3dc2a6b19ff794f42c7fa12d5931c57a133 |
| data/runs/RUN-20261105-intake/run.json | bcbc7b73c96abd54747ebd8770d5e7242b3bd8ba8910f5780b44e3bcc4f3f253 |
| data/runs/RUN-20261105-intake/counters.json | b9101bdeda926f01dd056f2d5f453bf602c87600cd5a9d89268dfecf12ded831 |
| scratch-repo/docs/cdp6/runs/RUN-20261105-intake/idea/idea.md | a248053a0e9b1bf8f87d20c8241c3d4883734dd4d67b28200926b252f1cee1da |
| transcripts/caef3109-….jsonl | e40c54a1e489ee773b0170f3f8c9a493b09abf22e37b397023194c4d68ccda2d |
| transcripts/…/subagents/agent-a4d081c11a07b2407.jsonl | c52d21032fb92c60bba9a40add83dda52359b660f1e39b3ff0e6dc934a2653be |
| transcripts/…/subagents/agent-ae6145752b625528f.jsonl | f0507a92e22e53006d6bb34a07fb37bf90d4b9a76ba47825d04f4c91a6cb03d8 |

## What the transcripts show
- Both agents opened their final answer with `cdp6-contract: v1 c88130959164` and `run: RUN-20261105-intake task: D-1` (or `D-2`): the contract was injected and acknowledged.
- Their tool calls were only Read, Grep, Glob and advisor; neither called `SubagentHandback`. The resumed D-1 agent answered `NO-HANDBACK-TOOL`.

## Cause
Claude Code provides `SubagentHandback` "only in auto mode" (tools-reference.md:53, hooks.md:1928, fetched 2026-11-05). The SL-2 capture runs only through `check-handback.mjs` on PreToolUse `SubagentHandback` (concept UC-12 Route and step 4), while §11.3 item 3 pins the live run to `default`; in `auto` mode `guard-shell.mjs:42-47` denies the owner commands without an accepted probe record for that mode, which SL-8 brings. In this build no permission mode both captures a verdict and admits the owner commands. In `default` mode the subagent's report arrives as its final text (`SubagentStop` `last_assistant_message`, the `Agent` tool result), which no CDP6 hook reads.

## Other findings of the run
1. Every sandboxed command failed until 10:28: the bubblewrap profile exceeded the 9000-argument limit (9525, then 9530); the `~/**/.env*` denyRead wildcard expands per matching file. The owner chose the long-term fix: `permissions.blockReadsOutsideWorkingDirectories` plus a project-scoped `.env` entry; concept §5.6 item 5 follow-up.
2. Claude Code 2.1.318 reports `Write(...)` deny rules as never matching ("only Edit(path) rules are"); the `Edit(...)` rules hold the protection; concept §5.6 items 9 and 10, AC-09.15 and `lib/user-settings.mjs` still require the `Write(...)` form.
3. The runbook said `default` shows no mode label; the CLI shows "manual mode".
4. A main-session request to run a non-`run.mjs` command unsandboxed (`date -Is; ls`) reached the owner's prompt; its denial is UC-13 step 2 (SL-4).
5. `check-handback.mjs:100` skips a call without a hook line when the input carries no `cdp6-core:` agent type; a skip leaves no trace for the record review.
6. The main session spawned D-2 while the D-1 spawn was still uncaptured, against the owner's "one after the other", and resumed the finished D-1 agent with a message; both are recorded in ledger 0021.
