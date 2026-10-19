#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { pluginRoot, verify, ackPresent, appendUsage, readStdinJson } from '../lib/contract.mjs';
import { agentName } from '../lib/agent-name.mjs';
import { consumeGrant } from '../lib/grants.mjs';
import { hedgedClaims, claimReason } from '../lib/claims.mjs';

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

function releaseGrant(input, env) {
  // A run grant is single use: whatever the outcome of the acknowledgement check, the grant ends with the run.
  try {
    consumeGrant(agentName(input.agent_type), env);
  } catch (e) {
    process.stderr.write(`cdp5-agents: grant not released (${e.message})\n`);
  }
}

export function main(env = process.env, now = () => new Date().toISOString()) {
  const input = readStdinJson();
  if (input.stop_hook_active) {
    releaseGrant(input, env);
    return 0;
  }
  const v = verify(pluginRoot(env));
  if (!v.ok) {
    block(`The worker contract could not be verified (${v.error}). Answer with the single line CONTRACT-MISSING and stop.`);
    return 0;
  }
  if (!ackPresent(input.last_assistant_message, v.version, v.hash)) {
    block(`The first line of the final answer must be the contract acknowledgement: contract: v${v.version} ${v.hash}. Read ${v.skillPath} if the contract is not in context, then restate the final answer with that first line.`);
    return 0;
  }
  const hedged = hedgedClaims(input.last_assistant_message);
  if (hedged.length) {
    block(claimReason(hedged));
    return 0;
  }
  try {
    appendUsage({
      ts: now(),
      agent_type: input.agent_type ?? '',
      agent_id: input.agent_id ?? '',
      session_id: input.session_id ?? '',
      cwd: input.cwd ?? '',
      contract: `v${v.version} ${v.hash}`,
    }, env);
  } catch (e) {
    process.stderr.write(`cdp5-agents: usage log not written (${e.message})\n`);
  }
  releaseGrant(input, env);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
