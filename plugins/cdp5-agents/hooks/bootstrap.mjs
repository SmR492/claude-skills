#!/usr/bin/env node
// SessionStart hook (startup, resume, clear, compact): one short block that tells the main session which role text
// and which mechanics of cdp5-agents apply. Re-injected after compaction so the orchestrator role survives a long
// session. Kept to a few lines on purpose (A5: no silent skipping, but no token waste either).
import { pathToFileURL } from 'node:url';
import { pluginRoot, readStdinJson } from '../lib/contract.mjs';

export function render(root, source) {
  return [
    `cdp5-agents is active (session ${source || 'start'}).`,
    `Orchestrator role for the main session: the orchestrate skill (${root}/skills/orchestrate/SKILL.md) applies when a task spans two stages or three subtasks; read it before you delegate. You decide, brief, verify and synthesise; workers do the work.`,
    'Workers receive the worker contract at start and open their final answer with its acknowledgement line; their final answers are checked for hedged completion claims. Judgment agents are read-only until you register a run grant for a disposable environment (scripts/worktree-setup.mjs creates worktree, baseline and grant in one step; scripts/grant-run.mjs manages grants).',
    'Every completed agent run is appended to the usage log; a manual activity gets its own line, and its third run is the trigger to build a worker for it.',
  ].join('\n');
}

export function main(env = process.env) {
  const input = readStdinJson();
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: render(pluginRoot(env), input.source) } }));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
