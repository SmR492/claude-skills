// Run grants: the orchestrator registers a disposable environment for one agent type before it spawns the agent.
// While a grant is active the PreToolUse guard applies the worker tier to that agent (runs and writes allowed,
// git still limited to worktree-local subcommands). A grant is bound to the project it was issued in (and to its
// root), carries a number of uses (one per agent run), and the SubagentStop hook consumes one use per finished run.
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { dataDir } from './data-dir.mjs';

export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_USES = 20;

export function grantsPath(env = process.env) {
  return join(dataDir(env), 'grants.json');
}

export function parseTtl(text) {
  const m = /^(\d+)\s*(m|h)$/.exec(String(text ?? '').trim());
  if (!m) throw new Error(`ttl must look like 30m or 2h, got "${text}"`);
  const ms = Number(m[1]) * (m[2] === 'h' ? 3_600_000 : 60_000);
  if (ms <= 0 || ms > MAX_TTL_MS) throw new Error('ttl must be between 1m and 24h');
  return ms;
}

export function parseUses(text) {
  const n = Number(String(text ?? '').trim());
  if (!Number.isInteger(n) || n < 1 || n > MAX_USES) throw new Error(`uses must be a whole number between 1 and ${MAX_USES}, got "${text}"`);
  return n;
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

function normalizePath(p) {
  let s = String(p ?? '').replace(/\\/g, '/').replace(/\/+$/, '');
  if (process.platform === 'win32') s = s.toLowerCase();
  return s;
}

export function isWithin(cwd, base) {
  if (!cwd || !base) return false;
  const c = normalizePath(cwd);
  const b = normalizePath(base);
  return c === b || c.startsWith(`${b}/`);
}

// A grant applies to a hook call only when the agent works in the project the grant was issued for or inside its root.
export function grantApplies(grant, cwd) {
  if (!grant) return false;
  return isWithin(cwd, grant.project) || isWithin(cwd, grant.root);
}

export function addGrant({ agent, root, project = process.cwd(), ttlMs = DEFAULT_TTL_MS, uses = 1, note = '' }, env = process.env, now = Date.now()) {
  if (!agent || !/^[a-z0-9-]+$/.test(agent)) throw new Error('agent must be the plain agent name, for example adversarial-auditor');
  if (!root) throw new Error('root is required');
  const absolute = resolve(root);
  if (!existsSync(absolute)) throw new Error(`root does not exist: ${absolute}`);
  if (!Number.isInteger(uses) || uses < 1 || uses > MAX_USES) throw new Error(`uses must be a whole number between 1 and ${MAX_USES}`);
  const grants = pruneExpired(readGrants(env), now).filter((g) => g.agent !== agent);
  const grant = { agent, root: absolute, project: resolve(project), uses, issued: new Date(now).toISOString(), expires: new Date(now + ttlMs).toISOString(), note };
  grants.push(grant);
  writeGrants(grants, env);
  return grant;
}

// One finished run uses up one use; the grant disappears at zero. Returns the grant as it was before the use.
export function consumeGrant(agent, env = process.env, now = Date.now()) {
  if (!agent) return null;
  const grants = readGrants(env);
  const used = grants.find((g) => g.agent === agent) ?? null;
  const rest = pruneExpired(grants, now).flatMap((g) => {
    if (g.agent !== agent) return [g];
    const left = (g.uses ?? 1) - 1;
    return left > 0 ? [{ ...g, uses: left }] : [];
  });
  if (used || rest.length !== grants.length) writeGrants(rest, env);
  return used;
}

// Revocation removes the grant whatever its remaining uses.
export function removeGrant(agent, env = process.env, now = Date.now()) {
  if (!agent) return null;
  const grants = readGrants(env);
  const removed = grants.find((g) => g.agent === agent) ?? null;
  const rest = pruneExpired(grants.filter((g) => g.agent !== agent), now);
  if (removed || rest.length !== grants.length) writeGrants(rest, env);
  return removed;
}
