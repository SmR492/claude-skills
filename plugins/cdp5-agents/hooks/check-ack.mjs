#!/usr/bin/env node
// SubagentStop hook. First pass: block once when the acknowledgement line is missing or the answer carries hedged
// claims. Second pass (stop_hook_active): never block again, but check the restatement and log the result.
// Every stop gets exactly one usage line: on the first pass when it ends the run, on the second pass after a block.
import { pathToFileURL } from 'node:url';
import { pluginRoot, verify, ackPresent, appendUsage, readStdinJson, finalMessage } from '../lib/contract.mjs';
import { agentName } from '../lib/agent-name.mjs';
import { consumeGrant } from '../lib/grants.mjs';
import { hedgedClaims, claimReason } from '../lib/claims.mjs';
import { readMarker, clearMarker } from '../lib/handback.mjs';

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

function releaseGrant(input, env) {
  // A run grant is used up by the run: whatever the outcome of the acknowledgement check, one use ends with it.
  // Only a grant of this session (or one without session) is spent.
  try {
    consumeGrant(agentName(input.agent_type), env, Date.now(), input.session_id || undefined);
  } catch (e) {
    process.stderr.write(`cdp5-agents: grant not released (${e.message})\n`);
  }
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
      via: 'stop',
    }, env);
  } catch (e) {
    process.stderr.write(`cdp5-agents: usage log not written (${e.message})\n`);
  }
}

// 'ok' | 'no-ack' | 'hedged', with the reason that a first pass would block with.
export function judge(message, v) {
  if (!ackPresent(message, v.version, v.hash)) {
    return { result: 'no-ack', reason: `The first line of the final answer must be the contract acknowledgement: contract: v${v.version} ${v.hash}. Read ${v.skillPath} if the contract is not in context, then restate the final answer with that first line.` };
  }
  const hedged = hedgedClaims(message);
  if (hedged.length) return { result: 'hedged', reason: claimReason(hedged) };
  return { result: 'ok', reason: null };
}

export function main(env = process.env, now = () => new Date().toISOString()) {
  const input = readStdinJson();
  // A worker that reported through the SubagentHandback tool was judged, logged and released by check-handback;
  // its stop must not add a second line or spend a second grant use.
  if (readMarker(input.agent_id, env).logged) {
    clearMarker(input.agent_id, env);
    return 0;
  }
  const secondPass = Boolean(input.stop_hook_active);
  const v = verify(pluginRoot(env));
  if (!v.ok) {
    if (!secondPass) {
      block(`The worker contract could not be verified (${v.error}). Answer with the single line CONTRACT-MISSING and stop.`);
      log(input, `unverified (${v.error})`, 'contract-missing', now, env);
      return 0;
    }
    releaseGrant(input, env);
    return 0;
  }
  const { result, reason } = judge(finalMessage(input), v);
  if (reason && !secondPass) {
    block(reason);
    return 0;
  }
  log(input, `v${v.version} ${v.hash}`, result, now, env);
  releaseGrant(input, env);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
