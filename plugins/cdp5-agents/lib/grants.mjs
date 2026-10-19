// Run grants: the orchestrator registers a disposable environment for one agent type before it spawns the agent.
// While a grant applies the PreToolUse guard puts that agent on the worker tier (runs and writes allowed, git still
// limited to worktree-local subcommands). A grant applies only when the agent's working directory lies inside the
// grant's root (a linked git worktree of the project, never the project itself) and, when the grant carries a session,
// only in that session. It carries a number of uses (one per agent run); the SubagentStop hook consumes one use per
// finished run. Every write goes through a lock file and a temp-file rename; issue, consume and revoke are audited in
// the usage log.
import { spawnSync } from 'node:child_process';
import { closeSync, existsSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { dataDir, SESSION_ID as SESSION_RE } from './data-dir.mjs';
import { appendUsage } from './contract.mjs';

export const DEFAULT_TTL_MS = 2 * 60 * 60 * 1000;
export const MAX_TTL_MS = 24 * 60 * 60 * 1000;
export const MAX_USES = 20;
export const LOCK_TIMEOUT_MS = 2000;

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
  let data;
  try {
    data = JSON.parse(readFileSync(file, 'utf8'));
  } catch (e) {
    throw new Error(`grants file ${file} is unreadable (${e.message}); fix or delete it`);
  }
  return Array.isArray(data?.grants) ? data.grants : [];
}

// Writes the whole list through a temp file and a rename, so a reader never sees a half-written file.
// Callers that read, modify and write hold the lock (withGrantsLock).
export function writeGrants(grants, env = process.env) {
  const file = grantsPath(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const tmp = `${file}.${process.pid}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}.tmp`;
  try {
    writeFileSync(tmp, JSON.stringify({ grants }, null, 2) + '\n', { mode: 0o600 });
    renameSync(tmp, file);
  } catch (e) {
    try { unlinkSync(tmp); } catch { /* already gone */ }
    throw e;
  }
  return file;
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

// Runs fn while holding grants.json.lock (created with O_EXCL). Retries for about two seconds, then fails closed.
export function withGrantsLock(env, fn, timeoutMs = LOCK_TIMEOUT_MS) {
  const file = grantsPath(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  const lock = `${file}.lock`;
  const deadline = Date.now() + timeoutMs;
  let fd;
  for (;;) {
    try {
      fd = openSync(lock, 'wx', 0o600);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw e;
      if (Date.now() >= deadline) throw new Error(`grants file is locked by another process (${lock}); nothing was changed. Retry; if no grant command or hook is running, delete the lock file.`);
      sleep(25);
    }
  }
  try {
    writeFileSync(fd, `${process.pid}\n`);
    return fn();
  } finally {
    closeSync(fd);
    try { unlinkSync(lock); } catch { /* already gone */ }
  }
}

function audit(kind, g, usesLeft, env, now) {
  appendUsage({ ts: new Date(now).toISOString(), agent_type: kind, agent: g.agent, root: g.root, project: g.project ?? null, session: g.session ?? null, uses_left: usesLeft }, env);
}

export function pruneExpired(grants, now = Date.now()) {
  return grants.filter((g) => Date.parse(g.expires) > now);
}

const sessionOf = (g) => g.session ?? '';

// The grant of an agent that fits the session. Without a fitting grant, any grant of the agent is returned so that the
// guard can say why it does not apply (another session, outside the environment).
export function activeGrant(agent, env = process.env, now = Date.now(), sessionId = undefined) {
  if (!agent) return null;
  const mine = pruneExpired(readGrants(env), now).filter((g) => g.agent === agent);
  return mine.find((g) => g.session === sessionId) ?? mine[0] ?? null;
}

function normalizePath(p) {
  let s = String(p ?? '').replace(/\\/g, '/').replace(/\/{2,}/g, '/').replace(/\/+$/, '');
  if (process.platform === 'win32' || /^[a-zA-Z]:/.test(s)) s = s.toLowerCase();
  return s;
}

function isFilesystemRoot(normalized) {
  return normalized === '' || normalized === '/' || /^[a-z]:$/i.test(normalized);
}

// True when cwd is base or lies below it. A base that is the filesystem root contains nothing: such a grant is void.
export function isWithin(cwd, base) {
  if (!cwd || !base) return false;
  const c = normalizePath(cwd);
  const b = normalizePath(base);
  if (isFilesystemRoot(b)) return false;
  return c === b || c.startsWith(`${b}/`);
}

// Every grant carries the session it was issued in; a grant without one (hand-written or from an older format) applies nowhere.
export function sessionMatches(grant, sessionId) {
  return Boolean(grant?.session) && Boolean(sessionId) && grant.session === sessionId;
}

// A grant applies to a hook call only inside its root and only in the session it was issued in.
export function grantApplies(grant, cwd, sessionId = undefined) {
  if (!grant) return false;
  return isWithin(cwd, grant.root) && sessionMatches(grant, sessionId);
}

// realpathSync.native expands Windows 8.3 short names (RIEDL_~1); the JS implementation keeps them, so a worktree
// under a short-name temp dir would never equal the project path.
function real(p) {
  try { return realpathSync.native(p); } catch {}
  try { return realpathSync(p); } catch { return resolve(p); }
}

// Default worktree check: `git -C <project> worktree list --porcelain` lists root as a linked worktree (the main
// worktree is the project's checkout and never a disposable environment).
export function gitWorktreeOf(root, project) {
  const r = spawnSync('git', ['-C', project, 'worktree', 'list', '--porcelain'], { encoding: 'utf8' });
  if (r.status !== 0) return false;
  const listed = (r.stdout ?? '').split('\n').filter((l) => l.startsWith('worktree ')).map((l) => l.slice('worktree '.length).trim());
  const target = normalizePath(real(root));
  return listed.slice(1).some((p) => normalizePath(real(p)) === target);
}

export function addGrant({ agent, root, project = process.cwd(), ttlMs = DEFAULT_TTL_MS, uses = 1, note = '', session = null, isWorktree = gitWorktreeOf }, env = process.env, now = Date.now()) {
  if (!agent || !/^[a-z0-9-]+$/.test(agent)) throw new Error('agent must be the plain agent name, for example adversarial-auditor');
  if (!root) throw new Error('root is required');
  const absolute = resolve(root);
  if (!existsSync(absolute)) throw new Error(`root does not exist: ${absolute}`);
  if (!Number.isInteger(uses) || uses < 1 || uses > MAX_USES) throw new Error(`uses must be a whole number between 1 and ${MAX_USES}`);
  if (session !== null && session !== undefined && session !== '' && !SESSION_RE.test(String(session))) throw new Error(`session must be a session id, got "${session}"`);
  const projectAbs = resolve(project);
  const r = normalizePath(real(absolute));
  const p = normalizePath(real(projectAbs));
  const home = normalizePath(real(env.HOME ?? homedir()));
  if (r === p) throw new Error(`root is the project itself (${absolute}); a grant needs a separate worktree (worktree-setup.mjs creates one)`);
  if (isFilesystemRoot(r)) throw new Error('root is the filesystem root; a grant needs a separate worktree');
  if (r === home) throw new Error(`root is the home directory (${absolute}); a grant needs a separate worktree`);
  if (isWithin(p, r) || isWithin(home, r)) throw new Error(`root ${absolute} contains the project or the home directory; a grant needs a separate worktree`);
  if (!isWorktree(absolute, projectAbs)) throw new Error(`root is not a git worktree of the project: ${absolute} is not listed by git -C ${projectAbs} worktree list`);
  if (!session) throw new Error('session is required: pass --session=<id> (the SessionStart bootstrap prints it and writes ~/.cache/cdp5-agents/session); a grant without a session applies nowhere');
  const grant = { agent, root: absolute, project: projectAbs, uses, issued: new Date(now).toISOString(), expires: new Date(now + ttlMs).toISOString(), note, session: String(session) };
  return withGrantsLock(env, () => {
    const grants = pruneExpired(readGrants(env), now).filter((g) => !(g.agent === agent && sessionOf(g) === sessionOf(grant)));
    grants.push(grant);
    writeGrants(grants, env);
    audit('grant:issue', grant, grant.uses, env, now);
    return grant;
  });
}

// One finished run uses up one use; the grant disappears at zero. Only the grant of the stopping session is consumed.
// Returns the grant as it was before the use, or null.
export function consumeGrant(agent, env = process.env, now = Date.now(), sessionId = undefined) {
  if (!agent) return null;
  if (!readGrants(env).some((g) => g.agent === agent)) return null;
  return withGrantsLock(env, () => {
    const grants = readGrants(env);
    const live = pruneExpired(grants, now);
    const mine = live.filter((g) => g.agent === agent);
    const used = (sessionId && mine.find((g) => g.session === sessionId)) || null;
    const rest = live.flatMap((g) => {
      if (g !== used) return [g];
      const left = (g.uses ?? 1) - 1;
      return left > 0 ? [{ ...g, uses: left }] : [];
    });
    if (used || rest.length !== grants.length) writeGrants(rest, env);
    if (used) audit('grant:consume', used, Math.max((used.uses ?? 1) - 1, 0), env, now);
    return used;
  });
}

// Revocation removes the agent's grants whatever their remaining uses (only those of one session when given).
export function removeGrant(agent, env = process.env, now = Date.now(), sessionId = undefined) {
  if (!agent) return null;
  return withGrantsLock(env, () => {
    const grants = readGrants(env);
    const hit = (g) => g.agent === agent && (sessionId === undefined || sessionOf(g) === sessionId);
    const removed = grants.filter(hit);
    const rest = pruneExpired(grants.filter((g) => !hit(g)), now);
    if (removed.length || rest.length !== grants.length) writeGrants(rest, env);
    for (const g of removed) audit('grant:revoke', g, 0, env, now);
    return removed[0] ?? null;
  });
}
