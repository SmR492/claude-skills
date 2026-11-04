# review-verify of the live P1 run preparation (stage-1 run 65): final answer as handed back

Brief: `briefs/sl2-live-prep-rv.md`. Summary of the handback; findings verbatim in substance.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes

Status: pass-with-conditions. The copy and the settings keys hold; the live run would start in `auto` mode instead of the required `default`.

## Part A
| # | Verdict | Evidence |
|---|---|---|
| 1 | bestätigt | `diff -r` copy against the worktree `plugins/cdp6-core` exit 0; `git status --porcelain --ignored` empty; 67 regular files, 0 links; `git ls-tree -r 1d04d1a plugins/cdp6-core` lists 67 |
| 2 keys | bestätigt | items 1-3 settings-live.json:3-5,9; item 4 :8 only `nonexistent.invalid`, no WebFetch allow rule; item 5 :13-19, :22-25; item 6 :6; items 9, 10 :18,26-27,33-40 |
| 2 path forms | sandbox bestätigt; rules unklar | sandboxing.md:274; the `~/` rule form rests on probe A-22 (concept:1303), not read (tool budget) |
| 3 | bestätigt | `realpath` without symlink, outside the scratch repository; no `allowWrite`, `additionalDirectories` or `Edit` allow entry; no `/etc/claude-code`; `~/cdp6-live` in denyWrite |
| 4 | bestätigt (code trace) | `node -e` refused by the shell guard; traced by hand: user-settings.mjs:89-97 against settings-live.json; user settings without `permissions.deny` and `sandbox`, 3+2+1+1+4 = 11 |

## Part B
1. §1.4 item 10 (concept:109): for 2.1.318 the A-19 tool list is not recorded; whether a re-probe is required is nicht entscheidbar.
2. Open beyond the named items: the ledger line with `diff -r` exit 0; the host-check line on MCP servers and repository hooks and the start stamp; the owner decision at the SL-2 checkpoint; permission mode `default`. The ledger was not read.
3. `run.mjs` call form `node ${CLAUDE_PLUGIN_ROOT}/scripts/run.mjs` (SKILL.md:10,23) against the literal `excludedCommands` path: unklar. Spawn and handback hooks are not blocked. `R/idea/idea.md` matches no deny entry; whether the `~/cdp6-live` denyWrite catches a sandboxed write in the sibling `~/cdp6-live-scratch` is not verified. `Read(~/.claude/projects/**)` blocks the post-run transcript checks until removed.

## Findings
- 🔴 `~/.claude/settings.json:3` sets `"defaultMode": "auto"`; the live run must run in `default` (concept:1678). Proposal: `permissions.defaultMode: "default"` in settings-live.json, re-hash, or `--permission-mode default`; record which.
- 🟡 `${CLAUDE_PLUGIN_ROOT}` call form against the literal pattern. Proposal: compare with the A-19 plain row of `docs/cdp6/probes/2.1.314.md`.
- 🟡 No shell-tool list for 2.1.318. Proposal: an owner ruling, or a refreshed docs copy with an A-19 tool-list row.
- 🟢 cdp5-gates, cdp5-agents, domain-agents enabled at user level (mixed session). Proposal: owner confirms or disables them for the session.
- 🟢 Remove the transcript Read deny only after the run ends, then do the hand review.

Returned: the rule path-form part of claim 2 (unklar); Q1 (nicht entscheidbar); the sibling-prefix write question (unklar). Process note: 31 tool calls against a cap of 30, 4 refused by the shell guard.
