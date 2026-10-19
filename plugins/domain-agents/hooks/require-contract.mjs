#!/usr/bin/env node
// domain-agents depends on cdp5-agents for the worker contract (injection, acknowledgement check, usage log, run grants).
// This hook makes the dependency visible instead of leaving it to prose:
//   SessionStart: one warning line when the sibling plugin is not installed next to this one.
//   SubagentStart (domain-agents:*): when the contract core is absent, inject CONTRACT-MISSING so the agent stops;
//   when it is present, emit nothing (cdp5-agents injects the contract itself, no double injection).
// The sibling is looked up relative to this plugin's root (marketplace layout: plugins/<name>/), and through
// CDP5_AGENTS_ROOT when the two plugins are installed from different locations.
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

export function pluginRoot(env = process.env) {
  if (env.CLAUDE_PLUGIN_ROOT) return resolve(env.CLAUDE_PLUGIN_ROOT);
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function siblingCore(env = process.env) {
  const candidates = [];
  if (env.CDP5_AGENTS_ROOT) candidates.push(join(resolve(env.CDP5_AGENTS_ROOT), 'skills', 'worker-contract', 'core.md'));
  candidates.push(join(pluginRoot(env), '..', 'cdp5-agents', 'skills', 'worker-contract', 'core.md'));
  return candidates.find((p) => existsSync(p)) ?? null;
}

export function readInput() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}

export function main(env = process.env) {
  const input = readInput();
  const core = siblingCore(env);
  const event = input.hook_event_name ?? (input.agent_type ? 'SubagentStart' : 'SessionStart');
  if (event === 'SubagentStart') {
    if (core) return 0;
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: 'CONTRACT-MISSING: the domain-agents plugin needs the cdp5-agents plugin (worker contract, hooks, grants) and it is not installed next to it. This agent does not start its task; its only output is the line CONTRACT-MISSING.' } }));
    process.stderr.write('domain-agents: cdp5-agents not found; agent stopped with CONTRACT-MISSING\n');
    return 2;
  }
  if (core) return 0;
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: 'domain-agents: the cdp5-agents plugin is not installed next to it. Its three agents stop with CONTRACT-MISSING until cdp5-agents is installed; the session skills (business-lingo, psy-*) work but carry the contract rules only by their own text.' } }));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
