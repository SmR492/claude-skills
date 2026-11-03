#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { ensureHostKey } from '../lib/hook-key.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { statusText } from '../lib/phases.mjs';
import { findRun } from '../lib/run-store.mjs';

export const STATUS_SOURCES = ['startup', 'resume', 'clear', 'compact'];

function readInput() {
  try {
    const input = JSON.parse(readFileSync(0, 'utf8'));
    return input && typeof input === 'object' && !Array.isArray(input) ? input : {};
  } catch {
    return {};
  }
}

function runStatus(input, env) {
  const dataDir = env.CLAUDE_PLUGIN_DATA;
  if (!STATUS_SOURCES.includes(input.source) || typeof dataDir !== 'string' || !isAbsolute(dataDir)) return null;
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: typeof input.cwd === 'string' ? input.cwd : process.cwd() });
  return found.S && found.run ? statusText(found.S, found.run) : null;
}

export function main(env = process.env) {
  try {
    ensureHostKey(env);
  } catch (e) {
    process.stderr.write(`cdp6-core: host key not created (${e.code ?? 'error'})\n`);
  }
  const input = readInput();
  const text = runStatus(input, env);
  recordFired(env.CLAUDE_PLUGIN_DATA, 'bootstrap.mjs', input, 'none');
  if (text) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: `${text}\n` } }));
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
