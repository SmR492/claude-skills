import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));

function pluginVersion() {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version ?? null;
  } catch {
    return null;
  }
}

function field(input, name) {
  const value = input?.[name];
  return typeof value === 'string' ? value : null;
}

export function recordFired(dataDir, hook, input, decision) {
  if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) return false;
  const line = {
    hook,
    version: pluginVersion(),
    at: new Date().toISOString(),
    session_id: field(input, 'session_id'),
    tool_use_id: field(input, 'tool_use_id'),
    permission_mode: field(input, 'permission_mode'),
    decision,
  };
  try {
    mkdirSync(dataDir, { recursive: true, mode: 0o700 });
    appendFileSync(join(dataDir, 'hooks-fired.jsonl'), `${JSON.stringify(line)}\n`, { mode: 0o600 });
    return true;
  } catch {
    return false;
  }
}
