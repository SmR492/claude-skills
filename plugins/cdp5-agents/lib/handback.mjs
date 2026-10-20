// Per-agent state shared by the two hooks that judge a worker's final answer: check-handback (PreToolUse on the
// SubagentHandback tool, Claude Code >= 2.1.271) and check-ack (SubagentStop). A worker that reports through the
// handback tool is judged and logged at the handback; the stop hook then finds the marker and stays silent, so every
// run gets exactly one usage line and one grant use. Markers live in the plugin data directory and are removed by the
// stop hook; leftovers older than a day are pruned on the next write.
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { dataDir } from './data-dir.mjs';

const PRUNE_AFTER_MS = 24 * 60 * 60 * 1000;

export function markerDir(env = process.env) {
  return join(dataDir(env), 'handback');
}

function markerPath(agentId, env) {
  const id = String(agentId ?? '').replace(/[^A-Za-z0-9_-]/g, '');
  return id ? join(markerDir(env), `${id}.json`) : null;
}

export function readMarker(agentId, env = process.env) {
  const file = markerPath(agentId, env);
  if (!file || !existsSync(file)) return { asked: false, logged: false };
  try {
    const m = JSON.parse(readFileSync(file, 'utf8'));
    return { asked: Boolean(m.asked), logged: Boolean(m.logged) };
  } catch {
    return { asked: false, logged: false };
  }
}

export function writeMarker(agentId, patch, env = process.env, now = Date.now()) {
  const file = markerPath(agentId, env);
  if (!file) return null;
  const dir = markerDir(env);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  prune(dir, now);
  const next = { ...readMarker(agentId, env), ...patch, ts: new Date(now).toISOString() };
  writeFileSync(file, JSON.stringify(next), { mode: 0o600 });
  return file;
}

export function clearMarker(agentId, env = process.env) {
  const file = markerPath(agentId, env);
  if (file && existsSync(file)) rmSync(file, { force: true });
}

function prune(dir, now) {
  let names = [];
  try { names = readdirSync(dir); } catch { return; }
  for (const n of names) {
    try {
      const f = join(dir, n);
      if (now - statSync(f).mtimeMs > PRUNE_AFTER_MS) rmSync(f, { force: true });
    } catch { /* a marker that vanished meanwhile */ }
  }
}
