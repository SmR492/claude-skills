# CDP6 SL-0 probe kit

Concept: `docs/cdp6/konzept-cdp6.md` v0.4.7, section 11.1 (probe table A-1 to A-22). The kit is probe-only: it is never registered in a release and holds no guard logic beyond what a row needs. The owner runs every row in an interactive session on the installed Claude Code version and writes the record `docs/cdp6/probes/<claude-version>.md`.

## Kit parts

| Part | Path | What it does |
|---|---|---|
| plugin manifest | `.claude-plugin/plugin.json` | name `cdp6-core`; the `hooks` field points at `probes/probe-hooks.json` |
| hook registration | `probes/probe-hooks.json` | catch-all logger on the 8 events plus the row hooks below |
| logger | `probes/probe-log.mjs <tag>` | appends `{ts, tag, event, input}` (full hook input) as one JSON line to `~/.cache/cdp6-probe/probe-log.jsonl`; override with `CDP6_PROBE_LOG` |
| guard | `probes/probe-guard.mjs` | A-5 and A-22 `ask` / `allow` with `updatedInput`, A-18 deny, A-12 deny of every call in `bypassPermissions` |
| reader | `probes/probe-read.mjs usage / mailbox / team / key / marker` | A-8, A-17, A-16, A-22 |
| acknowledgement hook | `probes/probe-ack.mjs` | A-11: on `CDP6_PROBE_ROW=A-11` returns SubagentStart `additionalContext` (hooks.md:2564) |
| key writer | `probes/probe-key.mjs write / delete` | A-22 probe key |
| block hook | `probes/probe-block.mjs` and `probes/probe-hooks-block.json` | A-3, A-15 |
| agents | `agents/probe.md`, `agents/probe-b.md` | `cdp6-core:probe` and `cdp6-core:probe-b` (A-18), tools Read, Bash, Monitor, Edit, Write, MultiEdit, NotebookEdit, Grep, Glob (rows A-2, A-19, A-22; ledger 0021 decision 2026-10-29). This is the SL-0 kit copy only; the released team probe stays Read and Bash (concept lines 57 and 117) |
| stub | `scripts/run.mjs` | the excluded command of A-5, A-19, A-20, A-22 |
| proxy probe | `probes/probe-conn.mjs <host>`, `probes/probe-conn-child.mjs <host>` | A-12: opens `CONNECT <host>:443` through `HTTPS_PROXY` and prints the first response line or `error <code>`; the child form runs the first from a child `node` process |
| marketplace template | `probes/probe-marketplace.json` | A-6: marketplace `cdp6-probe` with the plugin `cdp6-core`, source the kit copy |

The log lives outside the repository on purpose: it holds prompts, paths and (A-22) token markers, and `$HOME` must never be written into the repo. When you copy lines into the record, write `$HOME` as `~` and run `secrets-scan` and `pii-scan` over the record (concept 11.1).

## Start a session

`CDP6_PROBE_ROW` is read by the guard, the key writer, the key, marker and team readers and the acknowledgement hook. Hooks inherit it from the Claude Code process, so a change needs a session restart (`/exit`, then start again). Leave it unset for rows that do not name it.

1. Put the kit where the sandbox cannot write it. Sandboxed commands write the working directory, the per-user temp directory and added directories (sandboxing.md:82, :335, :529), so a copy inside the probe worktree or under `/tmp` could be rewritten by a sandboxed command, and an `excludedCommands` entry naming it would then run the rewritten script unsandboxed. In your own shell copy the kit to the home directory, and repeat after every kit change:

   ```
   mkdir -p ~/cdp6-probe-kit && rm -rf ~/cdp6-probe-kit/cdp6-core && cp -r <this worktree>/plugins/cdp6-core ~/cdp6-probe-kit/
   export K=$HOME/cdp6-probe-kit/cdp6-core
   ```

   The kit is loaded with `--plugin-dir "$K"` (start line in step 4). `K` is a `--plugin-dir` path, not the plugin cache path the concept rows A-5, A-19 and A-22 name; the record must say so. Use the absolute value of `$K` (not `~`, not `$K`) in prompts and in `excludedCommands`: the entry matches the text of the call (sandboxing.md:317 to :321).
2. In your own shell, in the probe worktree (`.worktrees/cdp6-probe`), before the first start:

   ```
   mkdir -p R/verdicts scratch
   echo R/ >> "$(git rev-parse --git-path info/exclude)"
   ```

   `R/` holds `run.json` with home paths and must not be committed. The `mkdir` makes a refused write in A-5 and A-19 a sandbox refusal and not a missing directory.
3. Write the sandbox block (below, "Probe worktree settings") into the probe worktree's `.claude/settings.local.json`, with `<WT>` the absolute path of the probe worktree and `<K>` the absolute value of `$K`.
4. Start: `CDP6_PROBE_ROW=<row> claude --plugin-dir "$K" --strict-mcp-config --settings ~/cdp6-probe-kit/settings-net.json` in the probe worktree (`--plugin-dir` and `--strict-mcp-config` are listed by `claude --help`, version 2.1.312; hooks of an enabled plugin merge with user and project hooks, hooks.md:629). `--strict-mcp-config` keeps the owner's MCP servers out of the probe session (ledger 0021 owner line `stage-1 host check:`, 2026-10-29). Every probe session starts with this `--settings` file (below, "Network settings"), except A-3 and A-15, which start with `block-settings.json` instead (below, "Block-hook settings"); the second A-19 session and A-22 also need the user-settings rules below ("Key-protection settings"). A-20 does not.
5. Check the plugin is live before the first row: `/hooks` lists the probe hooks, and the first model turn adds a `tag` `session-start` line: `tail -n 3 ~/.cache/cdp6-probe/probe-log.jsonl`.
6. Control that the block works, once per session start, before A-5 and A-19: ask the session to run `node -e "require('fs').writeFileSync('R/ctl.txt','x')"`. It must fail with a write refusal (sandboxed, `R/` denied). If it succeeds, the sandbox or the `denyWrite` entry is not active and the rows A-5 and A-19 cannot turn red.

Lines are read by tag: `tail -n 20 ~/.cache/cdp6-probe/probe-log.jsonl`, or `grep '"tag":"pre"' ~/.cache/cdp6-probe/probe-log.jsonl`. Tags: `session-start`, `subagent-start`, `subagent-stop`, `pre`, `post`, `post-failure`, `teammate-idle`, `task-completed` (catch-all), `a19` (Bash, PowerShell, Monitor), `guard`, `usage`, `mailbox`, `team`, `key`, `marker`, `block-ran`.

## Probe worktree settings

The complete block for the probe worktree's `.claude/settings.local.json` (rows A-5 and A-19; the other rows run under it too). Merge it into the existing file, do not replace it: the file already holds the stage-1 host-check plugin disables, and the `enabledPlugins` entry below repeats them so that a merge by hand cannot drop them (ledger 0021 owner line `stage-1 host check:`, 2026-10-29). Key `enabledPlugins`: settings.md:326 names it. Key names: `sandbox.enabled`, `sandbox.failIfUnavailable` (sandboxing.md:100), `sandbox.allowUnsandboxedCommands` (sandboxing.md:230), `sandbox.filesystem.denyWrite` (sandboxing.md:276; absolute path as `/tmp/build` in sandboxing.md:274), `sandbox.excludedCommands` (sandboxing.md:302 to :312, the pattern ends in ` *`, sandboxing.md:317), the team flag (agent-teams.md:48 to :53):

```
{
  "env": { "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1" },
  "enabledPlugins": {
    "cdp5-agents@claude-skills": false,
    "domain-agents@claude-skills": false
  },
  "sandbox": {
    "enabled": true,
    "failIfUnavailable": true,
    "allowUnsandboxedCommands": false,
    "filesystem": { "denyWrite": ["<WT>/R"] },
    "excludedCommands": ["node <K>/scripts/run.mjs *"]
  }
}
```

- The working directory is sandbox-writable (sandboxing.md:82, :529), so without the `denyWrite` entry a sandboxed `run.mjs` would write `R/run.json` too and A-5 and A-19 could not tell sandboxed from excluded. With it, an excluded run (unsandboxed) writes `R/run.json`; a sandboxed run prints `run.json not written (<code>)` with `<code>` `EROFS`, `EACCES` or `EPERM` and exits 1.
- `allowUnsandboxedCommands` false stops the model from retrying a refused write unsandboxed (sandboxing.md:230). It stands in project-local settings here, which does not make the sandbox admin-required (that needs managed settings or `--settings`, sandboxing.md:234), so the `excludedCommands` entry stays honoured. Do not put this key into the `--settings` file below, or Claude Code ignores the entry.
- Rows A-1 and A-8 want a plain subagent, not a teammate: set the flag to `"0"` for them (agent-teams.md:437 to :443) and restart; set it back to `"1"` and restart before the team rows.

## Network settings (every probe session)

`strictAllowlist` is honoured only in user, managed or `--settings` settings (sandboxing.md:587, :784), not in the probe worktree's local file, so it goes into `~/cdp6-probe-kit/settings-net.json`, outside every sandbox-writable path. Without it a connection outside the list prompts instead of being refused, and A-12 and the `curl` part of A-19 cannot show "refused without a prompt". Only `allowUnsandboxedCommands` false in `--settings` makes the sandbox admin-required (sandboxing.md:234), so this file keeps the local `excludedCommands` entry honoured:

```
{
  "sandbox": {
    "network": { "allowedDomains": ["nonexistent.invalid"], "strictAllowlist": true }
  }
}
```

## Key-protection settings (A-19 second session, A-22)

Concept 5.6 item 9 must be in place for these rows (A-20 does not need it): sandbox `denyRead` and `denyWrite` entries and `permissions.deny` rules on `~/.config/cdp6-core/` and, for the transcript part of A-22, on `~/.claude/projects/`. Row A-22 runs "with the rules of §5.6 item 9 in user settings" (concept line 1563), so they go into your user settings `~/.claude/settings.json`, merged by hand into its existing `sandbox` and `permissions` objects:

```
{
  "sandbox": {
    "filesystem": {
      "denyRead": ["~/.config/cdp6-core/", "~/.claude/projects/"],
      "denyWrite": ["~/.config/cdp6-core/"]
    }
  },
  "permissions": {
    "deny": [
      "Read(~/.config/cdp6-core/**)",
      "Edit(~/.config/cdp6-core/**)",
      "Write(~/.config/cdp6-core/**)",
      "Read(~/.claude/projects/**)"
    ]
  }
}
```

The home-relative rule form is the one row A-22 judges (concept 5.6 item 9: "confirmed by probe A-22"); settings.md:143 shows the project-relative form only. Remove the `~/.claude/projects/` entries after the row if the auto-memory files under that directory must be readable again.

## Rows

| Row | Kit part | Owner action | Expected record line |
|---|---|---|---|
| A-1 | logger, probe agent | Prompt the session: "Spawn cdp6-core:probe with the prompt `Run ls and report`." Then: "Spawn cdp6-core:probe with name `p1` and the prompt `Run ls and report`." | two `pre` lines with `input.tool_name` `Agent` and `input.tool_input.prompt`, `subagent_type`, and (second) `name` |
| A-2 | logger, probe agent | Create `scratch/a.txt` and a notebook: `printf '{"cells":[{"cell_type":"code","source":"x=1","metadata":{},"outputs":[],"execution_count":null}],"metadata":{},"nbformat":4,"nbformat_minor":5}' > scratch/a.ipynb`. Prompt: "Have cdp6-core:probe call Edit, Write and MultiEdit on `scratch/a.txt`, NotebookEdit on `scratch/a.ipynb`, Read, Grep and Glob on `scratch`, and run `false` in Bash." | `pre` lines with `file_path`, `notebook_path` or `path` per tool, as the tool provides it; one `post-failure` line whose `input.error` starts "Exit code 1" |
| A-3 | block hook, logger | Native Windows instance only; the Windows commands here and in A-4 are unchecked, they were not run on a Windows host. Build the settings file (below, "Block-hook settings") with `<SCRIPT>` = `probe-missing.mjs`, start `claude --strict-mcp-config --settings <file>`, run any Bash command | the call is blocked with `failed; blocking because onFailure is "block"` (hooks.md:932); no `block-ran` line |
| A-4 | logger | Native Windows instance only; the Windows commands are unchecked, they were not run on a Windows host. In a second terminal start a process that keeps running from another directory: `cd %TEMP% && node -e "setTimeout(()=>{},600000)"`; note its PID. In the session run `node -e "console.log(process.cwd())"` (own process), then ask the probe to read the working directory of the already running PID with whatever the platform offers (for example the properties of `Get-CimInstance Win32_Process -Filter "ProcessId=<pid>"`) | recorded: the own working directory printed; the working directory of the second, already running process readable (which command, which value) or not readable. The second is the row's red case |
| A-5 | guard, stub, logger | `CDP6_PROBE_ROW=A-5`, the block above in place, control of step 6 done. In each mode `default`, `acceptEdits`, `auto`, `bypassPermissions` (Shift+Tab or `--permission-mode`) ask the session to run, one by one, `node <K>/scripts/run.mjs approve`, `... enter`, `... status` | for `approve` and `enter`: a prompt labelled `[plugin:cdp6-core]` (hooks.md:1969) in `default` and `auto` (hooks.md:1971); for `status` no prompt; per call a `guard` line with `decision` `ask` or `allow` and `updatedInput.command` ending in `--session-id <id> --data-dir <dir>`. Record per mode, all four, whether the labelled prompt appears (concept line 1548). Excluded (unsandboxed): stdout `argv` holds the appended arguments and `R/run.json` is written. Sandboxed: `run.json not written (<code>)`, exit 1, which means the modified input was not matched by the pattern (red case of the row) |
| A-6 | marketplace template `probes/probe-marketplace.json` | `CDP6_PROBE_ROW` unset, no probe `--settings` file. (1) In your own shell, outside the repository: `mkdir -p ~/cdp6-probe-kit/.claude-plugin && cp "$K/probes/probe-marketplace.json" ~/cdp6-probe-kit/.claude-plugin/marketplace.json` (the kit copy `$K` of step 1 is the plugin source `./cdp6-core` of that marketplace; the copy in step 1 leaves the marketplace file alone). (2) `claude plugin marketplace add ~/cdp6-probe-kit`. (3) Make two empty scratch directories outside the repository, project A and project B, each `git init`. In A: `claude plugin install cdp6-core@cdp6-probe --scope project`; look at `A/.claude/settings.json` and write down the `enabledPlugins` entry the install made. (4) Write `{"enabledPlugins": {"cdp5-agents@claude-skills": false, "domain-agents@claude-skills": false}}` into `A/.claude/settings.local.json` and `B/.claude/settings.local.json` (the stage-1 host check disables them for every stage-1 session). Start `claude --strict-mcp-config` in A, check `/plugin` and `/hooks` list the probe hooks, run any tool call, note the `session_id` of the new `session-start` line. Exit, start the same command in B, check `/plugin` and `/hooks`, run any tool call, read `tail -n 5 ~/.cache/cdp6-probe/probe-log.jsonl`. (5) Cleanup: in A `claude plugin uninstall cdp6-core@cdp6-probe --scope project`, then `claude plugin marketplace remove cdp6-probe`. Variant for the stage-1 case: in step 3 install with `--scope local` from inside the probe worktree and start the session in B; its cleanup runs `claude plugin uninstall cdp6-core@cdp6-probe --scope local` inside the probe worktree before `marketplace remove`, then check that `.claude/settings.local.json` there holds only its earlier keys | per concept row A-6: the plugin is inactive in B (`/plugin` shows it not enabled in B, `/hooks` lists no probe hook, no `session-start` line with a B `session_id`) while A shows it active; the `enabledPlugins` entry made by the install is recorded. If it is active in B, the row is red (CH-17). The field names of the template were checked against `.claude-plugin/marketplace.json` and `claude plugin validate` passes; that `plugin install` resolves the relative source `./cdp6-core` from the marketplace root, and the exact form of the entry the install writes, are not confirmed by the docs copy (settings.md:326 only names `enabledPlugins`) and are read off in this row |
| A-8 | reader `usage` | `CDP6_PROBE_ROW` unset, team flag `"0"`. Spawn `cdp6-core:probe` once with a short task | one `usage` line with `agent` and `main` sums (`messages`, `input`, `output`, `cacheCreation`, `cacheRead`); `error` instead of numbers means no access |
| A-9 | logger | Start a run-like session, note `session_id` from a `session-start` line, run `/compact` | a second `session-start` line (`source` `compact`) with the same `session_id` |
| A-11 | logger, probe agent, acknowledgement hook | `CDP6_PROBE_ROW=A-11`. Prompt: "Spawn cdp6-core:probe with name `t1` as a teammate, then send it two messages." Repeat with `teammateMode` `tmux` in a tmux session | one `subagent-start` line per message with `agent_id` (hooks.md:2541); the teammate's first answer starts with the line `PROBE-ACK-CDP6` (the SubagentStart hook asked for it through `additionalContext`, hooks.md:2564) |
| A-12 | logger, probe agent, guard, proxy probe | The block above (the `excludedCommands` entry is not needed) and the `--settings` file of "Network settings". A raw `net.connect` from a sandboxed command has no route at all (sandboxing.md:568 to :572, :947 to :949), so it fails with or without an enforced allowlist and shows nothing of the proxy; the probes therefore go through the proxy, which the sandbox names in `HTTPS_PROXY` (sandboxing.md:574, :576 to :578). `probe-conn.mjs <host>` sends an HTTP `CONNECT <host>:443` to `HTTPS_PROXY` and prints the first response line or `error <code>`, and never stays open; `probe-conn-child.mjs <host>` runs it from a child `node` process. Per mode `default`, `acceptEdits`, `auto` let the probe agent, a teammate and the main session run `node <K>/probes/probe-conn.mjs example.org`, `node <K>/probes/probe-conn-child.mjs example.org`, `curl -sS https://example.org`, and the same three against `nonexistent.invalid`. In `bypassPermissions` start with `CDP6_PROBE_ROW=A-12` and ask for any tool call. Once, in `default`, in the session: `git worktree add .worktrees/probe-s1` (as the concept row says; if the sandbox refuses it, record the refusal, run it in your own shell and say so in the record), then inside it: `npm init -y`, `npm install --no-audit --no-fund is-odd`, `printf "import {test} from 'node:test';test('t',()=>{});" > t.test.mjs`, `node --test t.test.mjs`, `git config probe.x 1`, and `echo x > "$(git rev-parse --git-common-dir)/hooks/probe-x"` | the proxy refuses the host outside the list (`example.org`, list empty, `strictAllowlist`, sandboxing.md:608) without a prompt, in the three modes and for the three forms: record the refusal line `probe-conn.mjs` prints and the `curl` error text, from the `pre`, `post` or `post-failure` lines; `error ETIMEDOUT` is not a refusal: the proxy held the connection (a prompt or a hang), so the row is red or inconclusive; a `200` line is the red case; only a non-200 proxy status line counts as the refusal line; `nonexistent.invalid` is in `allowedDomains` (Network settings), so the proxy resolves it after the allowlist (sandboxing.md:612) and its line is the unreachable-host signal, recorded next to the refusal line; `bypassPermissions`: the tool result shows `probe A-12 deny in bypassPermissions` and there is no `post` line for that call (the guard's own `guard` line is not evidence; the guard denies every tool call on that row and mode and stands in for the SL-1 guard); `npm init`, the install target `node_modules` and the baseline write inside the linked worktree; `git config probe.x 1` and the `hooks/` write refused (sandboxing.md:532, :541); `npm install` refused unless the registry host is allowlisted |
| A-13 | logger | Prompt calls of Bash, Agent and Edit in the main session and in a subagent | `pre` lines with `input.permission_mode` (hooks.md:763) |
| A-14 | logger | In a team session a teammate calls `SendMessage`, `TaskCreate`, `TaskList`; resume a subagent with `SendMessage` | `pre` lines with those `tool_name` values, `tool_input` with recipient and text |
| A-15 | block hook | Build the settings file (below, "Block-hook settings"; this row starts with it instead of the network file) with (a) `<SCRIPT>` `probe-block.mjs` `<ARG>` `ok` after `mv "$K/probes/probe-log.mjs" "$K/probes/probe-log.mjs.off"`; (b) the same with `node` removed from `PATH` for the `claude` start (unchecked: not run here); (c) `<ARG>` `sleep` (sleeps 20 s over the 10 s timeout). Restore the file afterwards. Run a Bash command each time | each Bash call blocked (hooks.md:904, :879); no `block-ran` line |
| A-16 | reader `team`, logger | `CDP6_PROBE_ROW=A-16`. Spawn `cdp6-core:probe` as a named teammate and ask it for one tool call | a `pre` line from the teammate with `agent_type` `cdp6-core:probe`, and the `team` line written at that same PreToolUse with `members` holding the teammate (`path` is `~/.claude/teams/session-<first 8 of session_id>/config.json`); `error` `ENOENT` means the config is absent at the first tool call |
| A-17 | reader `mailbox` | In a team session let a teammate message the lead; do not consume the message before the teammate idles | a `mailbox` line whose `files` hold the entries, each with `agent_id`; `error` `ENOENT` means absent |
| A-18 | guard, logger, second role file | Prompt two concurrent spawns, `cdp6-core:probe` and `cdp6-core:probe-b`, then two in sequence of `cdp6-core:probe`; then a spawn whose prompt contains `PROBE-DENY` | `pre` and `subagent-start` lines in order (compare `ts`); the `PROBE-DENY` call has a `guard` line with `decision` `deny` and no `subagent-start` |
| A-19 | stub, logger (`a19`), reader `key` | The block above, control of step 6 done. Session 1, `CDP6_PROBE_ROW` unset, so the A-5 guard rewrites nothing. Run, one by one: `node <K>/scripts/run.mjs status`; `node <K>/scripts/run.mjs status; touch R/verdicts/x`; `node <K>/scripts/run.mjs status && curl https://example.org`; `FOO=1 node <K>/scripts/run.mjs status`; `timeout 5 node <K>/scripts/run.mjs status`; the plain command as a Monitor call; delete `R/run.json` before each. Restart. Session 2, `CDP6_PROBE_ROW=A-22 claude --plugin-dir "$K" --strict-mcp-config --settings ~/cdp6-probe-kit/settings-net.json` (the SessionStart hook writes the probe key, the key-protection rules stand): `NODE_OPTIONS=--require=./x.cjs node <K>/scripts/run.mjs status`. `x.cjs` (create in the worktree; it prints to stdout, not to a file): `try{console.log('key bytes '+require('fs').readFileSync(require('os').homedir()+'/.config/cdp6-core/hook.key').length)}catch(e){console.log('key read failed '+e.code)}`. After the row delete the key (row A-22). Read the sandbox page for the shell-running tools (sandboxing.md:9) | plain: `R/run.json` written; `; touch` form: stub exits 1 with `run.json not written (<code>)` and `touch` refused; `&& curl` form: stub exits 1 with `run.json not written (<code>)` and curl not run (the failing stub short-circuits `&&`; the connection refusal is measured by A-12); prefixed and wrapped forms: stub exits 1 with `run.json not written (<code>)`; `x.cjs` prints `key read failed`, and the `key` hook line of the same call shows `readable` `true`, so the failure is not an absent key; Monitor call: `R/run.json` written; every form has an `a19` line with `input.tool_input.command`, the Monitor call too; the row lists the shell-running tools named on the sandbox page (expected Bash, PowerShell, Monitor) |
| A-20 | stub, logger | Start `claude --plugin-dir "$K" --strict-mcp-config --settings ~/cdp6-probe-kit/settings-net.json`; run `node <K>/scripts/run.mjs status`, then the chain command below as a sandboxed command. A subagent and a teammate each make one tool call | `R/run.json` `chain` ends at the Claude Code process (`exe` real path, `cmdline` with `--settings`); the sandboxed command prints the same chain or stops early (recorded, an error code is printed per failed step); `pre` lines of main, subagent and teammate with the same `session_id` |
| A-21 | logger | `--strict-mcp-config` on the start line. With the `--settings` file outside the project, add `"excludedCommands": ["node -e *"]` to its `sandbox` object mid-session, then run a sandboxed `node -e` connection to a host outside the list. After the row remove the `node -e *` entry from the file and restart before any later row | whether the `node -e` call ran unsandboxed after the edit (a `post` or `post-failure` line); recorded either way |
| A-22 | key writer, reader `key` and `marker`, guard, stub | `CDP6_PROBE_ROW=A-22`, `--strict-mcp-config --settings ~/cdp6-probe-kit/settings-net.json`. The SessionStart hook writes `~/.config/cdp6-core/hook.key`. The main session and the probe agent try `cat`, `head -c 8`, `node -e` with `fs.readFileSync` on the key in Bash and as a Monitor call, the Read tool, an `@` reference, Grep on the key directory, Edit and Write of the key. Then `node <K>/scripts/run.mjs status` (the guard appends `--hook-token PROBE-MARKER-<session_id>`), then `cat` and Read of the transcript and Grep on `~/.claude/projects/`; the transcript `cat`, Read and Grep steps are made by both the main session and the probe agent | `key` lines with `readable` `true` (hook); `R/run.json` `key` `{readable: true}` (stub); a `marker` line with `found` and `count`; refusals in the tool results. After the row delete the probe key: `node "$K/probes/probe-key.mjs" delete` in your own shell (it deletes only a file starting `PROBE-KEY-`) |

## A-20 chain command

Run it as a sandboxed command. It prints, per process, the pid, the `exe` link and the `cmdline`, and prints an error code instead of aborting when a step fails; it stops at the first process whose `stat` is unreadable:

```
node -e "const f=require('fs');const t=(a)=>{try{return a()}catch(e){return e.code}};let p=process.pid;while(p>1){const s=t(()=>f.readFileSync('/proc/'+p+'/stat','utf8'));console.log(p,t(()=>f.readlinkSync('/proc/'+p+'/exe')),t(()=>f.readFileSync('/proc/'+p+'/cmdline','utf8').split('\0').join(' ')));if(!s.includes(')'))break;p=+s.slice(s.lastIndexOf(')')+2).split(' ')[1]}"
```

## Block-hook settings (A-3, A-15)

`probes/probe-hooks-block.json` is a template with `<PLUGIN>`, `<SCRIPT>` and `<ARG>`. Build the settings file outside the repository:

```
sed -e "s#<PLUGIN>#$K#" -e 's#<SCRIPT>#probe-missing.mjs#' -e 's#<ARG>##' "$K/probes/probe-hooks-block.json" > ~/.cache/cdp6-probe/block-settings.json
claude --plugin-dir "$K" --strict-mcp-config --settings ~/.cache/cdp6-probe/block-settings.json
```

For A-15 use `probe-block.mjs` with `<ARG>` `ok` or `sleep`. The Windows commands of A-3 and A-4 and the PATH variant A-15(b) are unchecked: no Windows host and no PATH-less run was available when the kit was written.

## Open points

- The concept fixes the released probe agent to Read and Bash (section 11.1); the SL-0 kit copy adds the tools rows A-2, A-19 and A-22 call (ledger 0021, decision 2026-10-29). A-6 runs through the local marketplace template (row A-6).
- The docs copy does not describe the plugin manifest `hooks` field or `--plugin-dir`. `claude --help` (2.1.312) lists `--plugin-dir`, and `claude plugin validate plugins/cdp6-core` passes, but that the probe hooks load is shown only by step 5 above. If no `session-start` line appears, copy `probes/probe-hooks.json` to `hooks/hooks.json` in the kit copy `$K` (the path of hooks.md:629) and note it in the record.
- `scripts/run.mjs` here is the SL-0 stub; SL-8 replaces it.
