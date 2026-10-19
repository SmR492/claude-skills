#!/usr/bin/env node
// SessionStart hook (startup, resume, clear, compact): one short block that tells the main session which role text
// and which mechanics of cdp5-agents apply. Re-injected after compaction so the orchestrator role survives a long
// session. Kept to a few lines on purpose (A5: no silent skipping, but no token waste either).
// It also writes the data-directory pointer so that the scripts the orchestrator runs from its own shell (where
// CLAUDE_PLUGIN_DATA is not set) use the same grants.json and usage log as the hooks.
import { pathToFileURL } from 'node:url';
import { pluginRoot, readStdinJson } from '../lib/contract.mjs';
import { dataDir, writeDataDirPointer } from '../lib/data-dir.mjs';

export function render(root, source, data) {
  return [
    `cdp5-agents is active (session ${source || 'start'}).`,
    `Orchestrator role for the main session: the orchestrate skill (${root}/skills/orchestrate/SKILL.md) applies when a task spans two stages or three subtasks; read it before you delegate. You decide, brief, verify and synthesise; workers do the work.`,
    'Workers receive the worker contract at start and open their final answer with its acknowledgement line; their final answers are checked for hedged completion claims. Judgment agents are read-only (no test runners, no network) until you register a run grant for a disposable environment.',
    `Scripts (absolute paths, run them from the project directory): node ${root}/scripts/worktree-setup.mjs --repo=<path> --base=<commit> --path=<dir> [--baseline="<cmd>"] [--grant=<agent>] [--uses=N] creates worktree, baseline and grant in one step; node ${root}/scripts/grant-run.mjs grant --agent <name> --root <path> [--project <repo>] [--uses N] | list | revoke --agent <name> manages grants. A grant applies only to runs whose working directory is the project it was issued in or its root; one use is spent per finished agent run.`,
    `Grants and the usage log live in ${data}. Every completed agent run is appended to the usage log; a manual activity gets its own line, and its third run is the trigger to build a worker for it.`,
  ].join('\n');
}

export function main(env = process.env) {
  const input = readStdinJson();
  let data;
  try {
    data = writeDataDirPointer(env).dir;
  } catch (e) {
    data = dataDir(env);
    process.stderr.write(`cdp5-agents: data-dir pointer not written (${e.message})\n`);
  }
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: render(pluginRoot(env), input.source, data) } }));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
