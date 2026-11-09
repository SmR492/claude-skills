import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readClaudeVersion } from './claude-version.mjs';
import { claudePackageDir, isClaudeProcess, readProcess } from './preflight-proc.mjs';

const MAX_DEPTH = 64;

function parse(textOut) {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(textOut ?? '');
  return m ? { text: `${m[1]}.${m[2]}.${m[3]}`, parts: [Number(m[1]), Number(m[2]), Number(m[3])] } : null;
}

export function versionOfProcess(proc) {
  const dir = claudePackageDir(proc);
  if (dir !== null) {
    try {
      return parse(JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')).version);
    } catch {
      return null;
    }
  }
  const r = spawnSync(proc.exe, ['--version'], { encoding: 'utf8', timeout: 10000 });
  return r.status === 0 ? parse(r.stdout) : null;
}

export function runningVersion({ procRoot = '/proc', pid = process.pid } = {}) {
  const seen = new Set();
  let cur = readProcess(procRoot, pid);
  for (let depth = 0; cur !== null && depth < MAX_DEPTH && !seen.has(cur.pid); depth += 1) {
    if (isClaudeProcess(cur)) {
      const version = versionOfProcess(cur);
      return version ? { version, pid: cur.pid } : { version: null, error: `the version of the Claude Code process ${cur.pid} cannot be read` };
    }
    seen.add(cur.pid);
    cur = readProcess(procRoot, cur.ppid);
  }
  return { version: null, error: 'no ancestor process is recognised as Claude Code' };
}

export function establishedVersion(env, opts) {
  const running = runningVersion(opts);
  if (running.version === null) return { ok: false, error: 'running-version-unestablished', message: running.error };
  const onPath = readClaudeVersion(env);
  if (onPath === null) return { ok: false, error: 'claude-version-unreadable', message: 'claude --version on PATH could not be read to cross-check the running version' };
  if (onPath.text !== running.version.text) return { ok: false, error: 'path-version-differs', message: `claude --version on PATH is ${onPath.text}, the running Claude Code is ${running.version.text}` };
  return { ok: true, version: running.version, pid: running.pid };
}
