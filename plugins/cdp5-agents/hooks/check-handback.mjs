#!/usr/bin/env node
// PreToolUse hook on the SubagentHandback tool (Claude Code >= 2.1.271). A worker that reports through this tool
// delivers its final answer as tool_input.message, and the SubagentStop hook no longer sees that text (its
// last_assistant_message is the closing text, if any). So the contract check moves to the handback: the first
// handback without the acknowledgement line or with a hedged completion claim is denied once with the reason, the
// worker restates and hands back again; the second handback is let through whatever it says, logged with its result,
// and the run grant is released. The stop hook then finds the marker and does not log a second line.
import { pathToFileURL } from 'node:url';
import { pluginRoot, verify, appendUsage, readStdinJson } from '../lib/contract.mjs';
import { agentName } from '../lib/agent-name.mjs';
import { consumeGrant } from '../lib/grants.mjs';
import { readMarker, writeMarker } from '../lib/handback.mjs';
import { judge } from './check-ack.mjs';

export const HANDBACK_TOOL = 'SubagentHandback';

function deny(reason) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }));
}

function log(input, contract, result, now, env) {
  try {
    appendUsage({
      ts: now(),
      agent_type: input.agent_type ?? '',
      agent_id: input.agent_id ?? '',
      session_id: input.session_id ?? '',
      cwd: input.cwd ?? '',
      contract,
      result,
      via: 'handback',
    }, env);
  } catch (e) {
    process.stderr.write(`cdp5-agents: usage log not written (${e.message})\n`);
  }
}

function releaseGrant(name, input, env) {
  try {
    consumeGrant(name, env, Date.now(), input.session_id || undefined);
  } catch (e) {
    process.stderr.write(`cdp5-agents: grant not released (${e.message})\n`);
  }
}

export function main(env = process.env, now = () => new Date().toISOString()) {
  const input = readStdinJson();
  if (input.tool_name !== HANDBACK_TOOL) return 0;
  const name = agentName(input.agent_type);
  if (!name) return 0;
  const message = typeof input.tool_input?.message === 'string' ? input.tool_input.message : '';
  const marker = readMarker(input.agent_id, env);
  if (marker.logged) return 0;
  const v = verify(pluginRoot(env));
  if (!v.ok) {
    // The contract cannot be checked, so the handback goes through; the run is counted as contract-missing.
    log(input, `unverified (${v.error})`, 'contract-missing', now, env);
    writeMarker(input.agent_id, { logged: true }, env);
    releaseGrant(name, input, env);
    return 0;
  }
  const { result, reason } = judge(message, v);
  // Deny once, and only when the agent id lets the second attempt be recognised; without an id a denial could loop.
  if (reason && !marker.asked && input.agent_id) {
    writeMarker(input.agent_id, { asked: true }, env);
    deny(reason);
    return 0;
  }
  log(input, `v${v.version} ${v.hash}`, result, now, env);
  writeMarker(input.agent_id, { logged: true }, env);
  releaseGrant(name, input, env);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
