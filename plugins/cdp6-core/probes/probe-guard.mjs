#!/usr/bin/env node
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { logPath, readInput, record } from './probe-log.mjs';

const RUN_CALL = /^node\s+\S*run\.mjs\s+(approve|enter|status)\s*$/;
const ROWS = new Set(['A-5', 'A-22']);

export function decide(input, env = process.env) {
  const tool = input.tool_input || {};
  if (env.CDP6_PROBE_ROW === 'A-12' && input.permission_mode === 'bypassPermissions') {
    return { permissionDecision: 'deny', permissionDecisionReason: 'probe A-12 deny in bypassPermissions' };
  }
  if ((input.tool_name === 'Agent' || input.tool_name === 'Task') && typeof tool.prompt === 'string' && tool.prompt.includes('PROBE-DENY')) {
    return { permissionDecision: 'deny', permissionDecisionReason: 'probe A-18 deny hook' };
  }
  if (input.tool_name !== 'Bash' || !ROWS.has(env.CDP6_PROBE_ROW) || typeof tool.command !== 'string') return null;
  const match = RUN_CALL.exec(tool.command);
  if (!match) return null;
  let command = `${tool.command.trimEnd()} --session-id ${input.session_id} --data-dir ${join(dirname(logPath(env)), 'data')}`;
  if (env.CDP6_PROBE_ROW === 'A-22') command += ` --hook-token PROBE-MARKER-${input.session_id}`;
  return {
    permissionDecision: match[1] === 'status' ? 'allow' : 'ask',
    permissionDecisionReason: `probe ${env.CDP6_PROBE_ROW} ${match[1]}`,
    updatedInput: { ...tool, command },
  };
}

export function main(env = process.env) {
  const { input } = readInput();
  if (!input) return 0;
  const decision = decide(input, env);
  if (!decision) return 0;
  record('guard', input, { decision: decision.permissionDecision, updatedInput: decision.updatedInput }, env);
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } }));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
