import { accessSync, constants, readdirSync, readFileSync, readlinkSync, realpathSync } from 'node:fs';
import { delimiter, dirname, basename, isAbsolute, join } from 'node:path';

const COMMAND_LENGTH = 120;

function text(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return null;
  }
}

function target(path) {
  try {
    return readlinkSync(path);
  } catch {
    return null;
  }
}

export function readProcess(procRoot, pid) {
  const dir = join(procRoot, String(pid));
  const stat = text(join(dir, 'stat'));
  const fields = stat === null ? null : /\)\s+\S+\s+(\d+)\s+(\d+)/.exec(stat.slice(stat.lastIndexOf(')')));
  const ppid = fields?.[1];
  if (ppid === undefined || ppid === null) return null;
  const exe = target(join(dir, 'exe'));
  const args = (text(join(dir, 'cmdline')) ?? '').split('\0').filter((w) => w !== '');
  return { pid: Number(pid), ppid: Number(ppid), pgrp: Number(fields[2]), exe, cwd: target(join(dir, 'cwd')), args, command: args.join(' ').slice(0, COMMAND_LENGTH) || basename(exe ?? '?') };
}

export function readProcesses(procRoot) {
  const table = new Map();
  let names;
  try {
    names = readdirSync(procRoot);
  } catch {
    return table;
  }
  for (const name of names.filter((n) => /^\d+$/.test(n))) {
    const proc = readProcess(procRoot, name);
    if (proc !== null) table.set(proc.pid, proc);
  }
  return table;
}

export function claudeBinaryDir(env) {
  for (const dir of (env.PATH ?? '').split(delimiter)) {
    if (dir === '') continue;
    const file = join(dir, 'claude');
    try {
      accessSync(file, constants.X_OK);
      return dirname(realpathSync(file));
    } catch {
      continue;
    }
  }
  return null;
}

function realScript(arg, cwd) {
  const path = isAbsolute(arg) || cwd == null ? arg : join(cwd, arg);
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function claudePackageDir(proc) {
  if (proc?.exe == null || basename(proc.exe) !== 'node') return null;
  for (const arg of proc.args ?? []) {
    const script = realScript(arg, proc.cwd);
    if (basename(script) !== 'cli.js') continue;
    const dir = dirname(script);
    if (basename(dir) === 'claude-code' && basename(dirname(dir)) === '@anthropic-ai') return dir;
  }
  return null;
}

export function isClaudeProcess(proc) {
  if (proc?.exe == null) return false;
  const name = basename(proc.exe);
  if (name === 'claude') return true;
  if (/^\d+\.\d+\.\d+$/.test(name) && basename(dirname(proc.exe)) === 'versions') return true;
  return claudePackageDir(proc) !== null;
}

export function ancestorsOf(table, pid) {
  const out = new Set();
  let cur = table.get(pid);
  while (cur && !out.has(cur.pid)) {
    out.add(cur.pid);
    cur = table.get(cur.ppid);
  }
  return out;
}

export function descendsFromAny(table, proc, roots) {
  const seen = new Set();
  let cur = table.get(proc.ppid);
  while (cur && !seen.has(cur.pid)) {
    if (roots.has(cur.pid)) return true;
    seen.add(cur.pid);
    cur = table.get(cur.ppid);
  }
  return false;
}

export function environmentOf(procRoot, pid) {
  const raw = text(join(procRoot, String(pid), 'environ'));
  if (raw === null) return null;
  const pairs = raw.split('\0').filter((e) => e.includes('='));
  return Object.fromEntries(pairs.map((e) => [e.slice(0, e.indexOf('=')), e.slice(e.indexOf('=') + 1)]));
}
