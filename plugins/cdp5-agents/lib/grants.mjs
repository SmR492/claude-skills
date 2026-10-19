// Run grants: the orchestrator registers a disposable environment for one agent type before it spawns the agent.
// While a grant is active the PreToolUse guard applies the worker tier to that agent (runs and writes allowed,
// git still limited to worktree-local subcommands). The SubagentStop hook consumes the grant, so it is single use.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';

export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_TTL_MS = 24 * 60 * 60 * 1000;

export function grantsPath(env = process.env) {
  const dir = env.CLAUDE_PLUGIN_DATA ?? join(env.HOME ?? homedir(), '.cache', 'cdp5-agents');
  return join(dir, 'grants.json');
}

export function parseTtl(text) {
  const m = /^(\d+)\s*(m|h)$/.exec(String(text ?? '').trim());
  if (!m) throw new Error(`ttl must look like 30m or 2h, got "${text}"`);
  const ms = Number(m[1]) * (m[2] === 'h' ? 3_600_000 : 60_000);
  if (ms <= 0 || ms > MAX_TTL_MS) throw new Error('ttl must be between 1m and 24h');
  return ms;
}

export function readGrants(env = process.env) {
  const file = grantsPath(env);
  if (!existsSync(file)) return [];
  const data = JSON.parse(readFileSync(file, 'utf8'));
  return Array.isArray(data.grants) ? data.grants : [];
}

export function writeGrants(grants, env = process.env) {
  const file = grantsPath(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  writeFileSync(file, JSON.stringify({ grants }, null, 2) + '\n', { mode: 0o600 });
  return file;
}

export function pruneExpired(grants, now = Date.now()) {
  return grants.filter((g) => Date.parse(g.expires) > now);
}

export function activeGrant(agent, env = process.env, now = Date.now()) {
  if (!agent) return null;
  return pruneExpired(readGrants(env), now).find((g) => g.agent === agent) ?? null;
}

export function addGrant({ agent, root, ttlMs = DEFAULT_TTL_MS, note = '' }, env = process.env, now = Date.now()) {
  if (!agent || !/^[a-z0-9-]+$/.test(agent)) throw new Error('agent must be the plain agent name, for example adversarial-auditor');
  if (!root) throw new Error('root is required');
  const absolute = resolve(root);
  if (!existsSync(absolute)) throw new Error(`root does not exist: ${absolute}`);
  const grants = pruneExpired(readGrants(env), now).filter((g) => g.agent !== agent);
  const grant = { agent, root: absolute, issued: new Date(now).toISOString(), expires: new Date(now + ttlMs).toISOString(), note };
  grants.push(grant);
  writeGrants(grants, env);
  return grant;
}

export function consumeGrant(agent, env = process.env, now = Date.now()) {
  if (!agent) return null;
  const grants = readGrants(env);
  const used = grants.find((g) => g.agent === agent) ?? null;
  const rest = pruneExpired(grants.filter((g) => g.agent !== agent), now);
  if (used || rest.length !== grants.length) writeGrants(rest, env);
  return used;
}
