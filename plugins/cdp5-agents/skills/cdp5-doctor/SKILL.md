---
name: cdp5-doctor
description: Read-only check of the host for the cdp5 plugins, one line per fact: Node version and path, git, hook scripts, worker contract hash, line endings, data directory, whether a session has started with the hooks, usage log, sibling plugins. Use after installing or updating the plugins, when the cdp5-agents bootstrap block is missing from a new session, on "the hooks did not run", "doctor".
---

# cdp5-doctor

The hooks of cdp5-agents are Node programs started by Claude Code on the host. When they stay silent, the cause is almost always one of a handful of facts about the host, and this script states them instead of leaving them to guesswork. It writes nothing; the data-directory check is an access check, not a file.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-doctor/cdp5-doctor.mjs" [--json] [--root=<plugin root>]
```

Run it from the main session (the orchestrator's shell). `--root` points at another installed copy of cdp5-agents; by default the script checks the plugin it is part of.

Exit: `0` no fail · `1` at least one fail · `2` usage error. `--json` prints `{ checks: [{ id, status: ok|warn|fail, detail }], exit }`.

## Expected output after a correct installation

```
ok    node           node v24.20.0 at C:\Program Files\nodejs\node.exe
ok    git            git version 2.55.0
ok    plugin root    C:\Users\<user>\.claude\plugins\cache\claude-skills\cdp5-agents\<version>
ok    hooks          6 hook scripts present (bootstrap.mjs, inject-contract.mjs, guard-bash.mjs, check-handback.mjs, guard-spawn.mjs, check-ack.mjs)
ok    contract       worker contract v2 sha256:<hash> (SKILL.md and core.md agree)
ok    line endings   LF
ok    data dir       <data dir> (writable)
ok    bootstrap      a session started with the hooks (last session <id>, written <time>; pointer <path>)
ok    usage log      <n> lines in <data dir>/usage-log.jsonl; last result ok
ok    cdp5-gates     <path>
ok    domain-agents  <path>

no fail, 0 warn  ·  exit 0
```

What a line means when it is not `ok`:

- `node` fail: the Node on the PATH of the shell Claude Code uses is older than 20, or the path shown is not the one you expected (on Windows a Node inside WSL is not seen; the Windows PATH counts).
- `git` fail: `worktree-setup.mjs` and the git checks of the guard need git on that PATH.
- `hooks` or `plugin root` fail: the installed copy is incomplete; reinstall the plugin (`claude plugin update cdp5-agents@claude-skills`).
- `contract` fail: SKILL.md and core.md of the worker contract disagree or one is missing; in a checkout run `node scripts/generate-contract.mjs`, in an installed copy reinstall.
- `line endings` warn: the checkout has CRLF; the hooks normalise it, but a release is checked out with LF (`.gitattributes`).
- `data dir` warn: no SessionStart has run yet. fail: the directory exists but is not writable; grants and the usage log cannot be written.
- `bootstrap` warn: no session has started with the hooks since the install. Start a new Claude Code session; the cdp5-agents block at the top of the session is the sign that the hooks run. Updated hooks apply only to a new session.
- `usage log` warn: no agent run has finished yet; the first run of any cdp5-agents or domain-agents agent writes the first line.
- `cdp5-gates` warn: the T1 skills the orchestrator names are not installed next to this plugin.

## What it does not check

The permission prompts of Claude Code (a denied Bash call is not a hook failure), the Orbit MCP connection (orbit-workflow reports that itself at SessionStart), and whether the hook input of a real subagent run carries `agent_type`, `session_id` and `cwd` on this host. The last is answered by the first agent run: its usage-log line carries those fields.
