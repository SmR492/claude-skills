#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { pluginRoot, verify, ackPresent, appendUsage, readStdinJson } from '../lib/contract.mjs';

function block(reason) {
  process.stdout.write(JSON.stringify({ decision: 'block', reason }));
}

export function main(env = process.env, now = () => new Date().toISOString()) {
  const input = readStdinJson();
  if (input.stop_hook_active) return 0;
  const v = verify(pluginRoot(env));
  if (!v.ok) {
    block(`The worker contract could not be verified (${v.error}). Answer with the single line CONTRACT-MISSING and stop.`);
    return 0;
  }
  if (!ackPresent(input.last_assistant_message, v.version, v.hash)) {
    block(`The first line of the final answer must be the contract acknowledgement: contract: v${v.version} ${v.hash}. Read ${v.skillPath} if the contract is not in context, then restate the final answer with that first line.`);
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
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
