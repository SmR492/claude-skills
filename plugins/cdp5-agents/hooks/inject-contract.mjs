#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { pluginRoot, verify, readStdinJson } from '../lib/contract.mjs';

export function render(v) {
  return [
    `WORKER-CONTRACT v${v.version} sha256:${v.hash}`,
    '',
    'The following worker contract applies to this agent. Its first output line is the acknowledgement described in rule 1.',
    '',
    v.body,
    '',
    `Full contract with formats and rationale: ${v.skillPath}`,
  ].join('\n');
}

export function missing(error) {
  return `CONTRACT-MISSING: the worker contract of the cdp5-agents plugin could not be loaded (${error}). This agent does not start its task; its only output is the line CONTRACT-MISSING.`;
}

function emit(context) {
  process.stdout.write(JSON.stringify({
    hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: context },
  }));
}

export function main(env = process.env) {
  readStdinJson();
  const v = verify(pluginRoot(env));
  if (!v.ok) {
    emit(missing(v.error));
    process.stderr.write(`cdp5-agents: worker contract not injected: ${v.error}\n`);
    return 2;
  }
  emit(render(v));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
