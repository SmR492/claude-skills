// The plugin's data directory holds grants.json and usage-log.jsonl. Hook processes get CLAUDE_PLUGIN_DATA from
// Claude Code; the orchestrator's shell (grant-run.mjs, worktree-setup.mjs) does not. The SessionStart hook therefore
// writes the resolved directory into a pointer file under ~/.cache/cdp5-agents, and every reader resolves in the same
// order: the variable, the pointer file (if it names an existing directory), the cache directory itself.
// Next to it the SessionStart hook writes the session id, so a grant issued from the main session's shell can be bound
// to that session (the last session that started wins; --session=<id> overrides it).
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

export const SESSION_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function cacheDir(env = process.env) {
  return join(env.HOME ?? homedir(), '.cache', 'cdp5-agents');
}

export function pointerPath(env = process.env) {
  return join(cacheDir(env), 'data-dir');
}

export function sessionPointerPath(env = process.env) {
  return join(cacheDir(env), 'session');
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

// Writes the session id of the starting session; ignores ids that do not look like one.
export function writeSessionPointer(sessionId, env = process.env) {
  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) return null;
  const file = sessionPointerPath(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, `${sessionId}\n`, { mode: 0o600 });
  return file;
}

export function readSessionPointer(env = process.env) {
  try {
    const file = sessionPointerPath(env);
    if (!existsSync(file)) return null;
    const id = readFileSync(file, 'utf8').split('\n')[0].trim();
    return SESSION_ID.test(id) ? id : null;
  } catch {
    return null;
  }
}
