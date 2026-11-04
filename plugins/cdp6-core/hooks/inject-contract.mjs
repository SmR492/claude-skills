#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { agentName } from '../lib/agent-name.mjs';
import { pluginRoot, verify } from '../lib/contract.mjs';
import { CountersError, bindPending } from '../lib/counters.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { findRun } from '../lib/run-store.mjs';

export function render(v) {
  return [
    `CDP6-CONTRACT v${v.version} sha256:${v.hash}`,
    '',
    'The following worker contract applies to this agent. Its first output line is the acknowledgement described in rule C1.',
    '',
    v.body,
    '',
    `Full contract with formats and rationale: ${v.skillPath}`,
  ].join('\n');
}

export function missing() {
  return 'CONTRACT-MISSING: the CDP6 worker contract of the cdp6-core plugin could not be verified. This agent does not start its task; its only output is the line CONTRACT-MISSING.';
}

function emit(context) {
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: context } }));
}

function warn(text) {
  process.stderr.write(`inject-contract.mjs: ${text}\n`);
}

function bind(input, env) {
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return;
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd() });
  if (found.error) return warn(`run record not usable (${found.error}); no spawn bound`);
  if (found.none || !found.run) return;
  if (typeof input.agent_id !== 'string' || input.agent_id === '') return warn('the hook input has no agent_id; no spawn bound');
  try {
    const r = bindPending(found.S, input.agent_type, input.agent_id);
    if (r.status === 'many') warn(`${r.count} unbound pending spawns of ${input.agent_type}; none bound`);
  } catch (e) {
    if (!(e instanceof CountersError)) throw e;
    warn(e.code === 'lock-busy' ? 'counters.json is locked by another writer; no spawn bound' : `counters.json not usable (${e.code}); no spawn bound`);
  }
}

export function main(env = process.env) {
  let input;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
  } catch {
    input = null;
  }
  const valid = input !== null && typeof input === 'object' && !Array.isArray(input);
  recordFired(env.CLAUDE_PLUGIN_DATA, 'inject-contract.mjs', valid ? input : null, 'none');
  if (!valid) {
    warn('could not read its input; nothing injected');
    return 0;
  }
  if (!agentName(input.agent_type)) return 0;
  const v = verify(pluginRoot(env));
  if (!v.ok) {
    emit(missing());
    warn(`worker contract not injected: ${v.error}`);
    return 0;
  }
  emit(render(v));
  try {
    bind(input, env);
  } catch {
    warn('binding failed; no spawn bound');
  }
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
