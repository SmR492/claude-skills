#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readStdinJson } from '../lib/contract.mjs';

export const SPAWN_TOOLS = /^(Agent|Task)$/;
export const WORKER = /^(cdp5-agents|domain-agents):/;

export const REASON = 'Spawn cdp5 and domain workers without `name` and without `team_name`. A named spawn becomes a teammate, the SubagentStart hook does not run for it, so it gets no worker contract and answers CONTRACT-MISSING. Spawn it again without `name`; address it later by the agentId from the spawn result.';

export function decide(input) {
  if (!SPAWN_TOOLS.test(input.tool_name ?? '')) return null;
  const t = input.tool_input ?? {};
  if (!WORKER.test(t.subagent_type ?? '')) return null;
  return t.name || t.team_name ? REASON : null;
}

export function main() {
  const reason = decide(readStdinJson());
  if (reason) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
