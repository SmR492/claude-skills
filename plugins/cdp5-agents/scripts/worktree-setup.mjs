#!/usr/bin/env node
// Creates the disposable environment for a worker or a counter-role run: a detached git worktree on an exact base
// commit, a green baseline proven by the project's own gate commands, and (optionally) a run grant for one agent.
// Prints the lines the orchestrator pastes into the brief. Nothing is committed; the worktree is the agent's sandbox.
//   node worktree-setup.mjs --repo=<path> --base=<commit> --path=<new worktree dir> [--baseline="<cmd>"]... [--grant=<agent>] [--ttl=2h] [--json]
// Exit: 0 = worktree ready (and grant issued if requested) · 1 = baseline red, no grant issued · 2 = usage error.
import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { addGrant, parseTtl, DEFAULT_TTL_MS } from '../lib/grants.mjs';

export function parseArgs(argv) {
  const out = { baseline: [] };
  for (const x of argv) {
    const m = /^--([a-z-]+)(?:=(.*))?$/.exec(x);
    if (!m) continue;
    if (m[1] === 'baseline') out.baseline.push(m[2] ?? '');
    else out[m[1]] = m[2] ?? true;
  }
  return out;
}

function git(args, cwd) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' });
  return { status: r.status, out: (r.stdout ?? '').trim(), err: (r.stderr ?? '').trim() };
}

export function setup(opts, env = process.env, now = Date.now()) {
  const repo = resolve(opts.repo ?? '.');
  if (git(['rev-parse', '--git-dir'], repo).status !== 0) return { error: `not a git repository: ${repo}` };
  const base = git(['rev-parse', '--verify', `${opts.base ?? 'HEAD'}^{commit}`], repo);
  if (base.status !== 0) return { error: `base commit not found: ${opts.base} (${base.err})` };
  const path = resolve(opts.path);
  if (existsSync(path)) return { error: `worktree path already exists: ${path}` };
  const add = git(['worktree', 'add', '--detach', path, base.out], repo);
  if (add.status !== 0) return { error: `git worktree add failed: ${add.err}` };
  const baseline = [];
  let green = true;
  for (const cmd of opts.baseline.filter(Boolean)) {
    const r = spawnSync(cmd, { cwd: path, shell: true, encoding: 'utf8' });
    const exit = r.status ?? 1;
    baseline.push({ cmd, exit, tail: `${r.stdout ?? ''}${r.stderr ?? ''}`.trim().split('\n').slice(-5).join('\n') });
    if (exit !== 0) { green = false; break; }
  }
  let grant = null;
  if (opts.grant && green) {
    const ttlMs = opts.ttl ? parseTtl(opts.ttl) : DEFAULT_TTL_MS;
    grant = addGrant({ agent: opts.grant, root: path, ttlMs, note: `worktree on ${base.out.slice(0, 7)}` }, env, now);
  }
  return { repo, worktree: path, base: base.out, baseline, green, grant, requestedGrant: opts.grant ?? null };
}

export function briefLines(r) {
  const lines = [`disposable environment: ${r.worktree}`, `base commit: ${r.base}`];
  for (const b of r.baseline) lines.push(`baseline: ${b.cmd} → exit ${b.exit}`);
  if (r.baseline.length === 0) lines.push('baseline: none run (no --baseline given)');
  if (r.grant) lines.push(`run grant: ${r.grant.agent} until ${r.grant.expires}`);
  else if (r.requestedGrant) lines.push(`run grant: not issued for ${r.requestedGrant} (baseline red)`);
  else lines.push('run grant: none');
  return lines;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const opts = parseArgs(argv);
  if (!opts.path) {
    process.stderr.write('Usage: worktree-setup.mjs --repo=<path> --base=<commit> --path=<new worktree dir> [--baseline="<cmd>"]... [--grant=<agent>] [--ttl=2h] [--json]\n');
    return 2;
  }
  let r;
  try {
    r = setup(opts, env);
  } catch (e) {
    process.stderr.write(`worktree-setup: ${e.message}\n`);
    return 2;
  }
  if (r.error) { process.stderr.write(`worktree-setup: ${r.error}\n`); return 2; }
  if (opts.json) process.stdout.write(JSON.stringify(r, null, 2) + '\n');
  else {
    process.stdout.write(briefLines(r).join('\n') + '\n');
    const red = r.baseline.find((b) => b.exit !== 0);
    if (red) process.stdout.write(`\nbaseline red; last output:\n${red.tail}\n`);
  }
  return r.green ? 0 : 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
