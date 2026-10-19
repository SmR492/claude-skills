// The plugin's data directory holds grants.json and usage-log.jsonl. Hook processes get CLAUDE_PLUGIN_DATA from
// Claude Code; the orchestrator's shell (grant-run.mjs, worktree-setup.mjs) does not. The SessionStart hook therefore
// writes the resolved directory into a pointer file under ~/.cache/cdp5-agents, and every reader resolves in the same
// order: the variable, the pointer file (if it names an existing directory), the cache directory itself.
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export function cacheDir(env = process.env) {
  return join(env.HOME ?? homedir(), '.cache', 'cdp5-agents');
}

export function pointerPath(env = process.env) {
  return join(cacheDir(env), 'data-dir');
}

function pointedDir(env) {
  const pointer = pointerPath(env);
  try {
    if (!existsSync(pointer)) return null;
    const target = readFileSync(pointer, 'utf8').split('\n')[0].trim();
    if (target && existsSync(target) && statSync(target).isDirectory()) return target;
  } catch {
    return null;
  }
  return null;
}

export function dataDir(env = process.env) {
  if (env.CLAUDE_PLUGIN_DATA) return env.CLAUDE_PLUGIN_DATA;
  return pointedDir(env) ?? cacheDir(env);
}

export function writeDataDirPointer(env = process.env) {
  const dir = dataDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  const pointer = pointerPath(env);
  mkdirSync(dirname(pointer), { recursive: true, mode: 0o700 });
  writeFileSync(pointer, `${dir}\n`, { mode: 0o600 });
  return { dir, pointer };
}
