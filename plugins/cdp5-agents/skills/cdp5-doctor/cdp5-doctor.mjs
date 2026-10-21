#!/usr/bin/env node
// cdp5-doctor: read-only check of the host for the cdp5 plugins. Answers the question "why did the hooks not run"
// with one line per fact: Node version and path, git, hook scripts, worker contract hash, data directory, whether a
// session has started with the hooks, sibling plugins, line endings. Writes nothing (the writability probe is an
// access check, not a file).
// Exit: 0 = no fail · 1 = at least one fail · 2 = usage error.
import { accessSync, constants, existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { pluginRoot, verify, usageLogPath, paths as contractPaths } from '../../lib/contract.mjs';
import { dataDir, pointerPath, sessionPointerPath, readSessionPointer } from '../../lib/data-dir.mjs';

export const MIN_NODE = 20;

// A sibling plugin next to this one: marketplace checkout plugins/<name>/ or the installed cache
// ~/.claude/plugins/cache/<marketplace>/<name>/<version>/ (newest version first).
export function siblingRoot(root, name) {
  const checkout = join(root, '..', name);
  if (existsSync(join(checkout, '.claude-plugin', 'plugin.json'))) return checkout;
  const cache = join(root, '..', '..', name);
  if (!existsSync(cache)) return null;
  let versions = [];
  try { versions = readdirSync(cache).sort().reverse(); } catch { return null; }
  for (const v of versions) if (existsSync(join(cache, v, '.claude-plugin', 'plugin.json'))) return join(cache, v);
  return null;
}

function hookScripts(root) {
  const file = join(root, 'hooks', 'hooks.json');
  const hooks = JSON.parse(readFileSync(file, 'utf8')).hooks ?? {};
  const scripts = [];
  for (const groups of Object.values(hooks)) {
    for (const g of groups) {
      for (const h of g.hooks ?? []) {
        const m = /\$\{CLAUDE_PLUGIN_ROOT\}\/([^"'\s]+)/.exec(h.command ?? '');
        if (m) scripts.push(m[1]);
      }
    }
  }
  return scripts;
}

export function checks(env = process.env, opts = {}) {
  const out = [];
  const add = (id, status, detail) => out.push({ id, status, detail });
  const root = opts.root ?? pluginRoot(env);
  const nodeVersion = opts.nodeVersion ?? process.versions.node;
  const execPath = opts.execPath ?? process.execPath;

  const major = Number(nodeVersion.split('.')[0]);
  add('node', major >= MIN_NODE ? 'ok' : 'fail', `node v${nodeVersion} at ${execPath}${major >= MIN_NODE ? '' : ` (the hooks need Node ${MIN_NODE} or later on the PATH of the shell Claude Code uses)`}`);

  const git = spawnSync(opts.git ?? 'git', ['--version'], { encoding: 'utf8' });
  add('git', git.status === 0 ? 'ok' : 'fail', git.status === 0 ? git.stdout.trim() : `git not found on the PATH (${git.error?.message ?? `exit ${git.status}`}); worktree-setup and the git checks of the guard need it`);

  add('plugin root', existsSync(join(root, '.claude-plugin', 'plugin.json')) ? 'ok' : 'fail', root);

  try {
    const scripts = hookScripts(root);
    const missing = scripts.filter((s) => !existsSync(join(root, s)));
    if (scripts.length === 0) add('hooks', 'fail', `hooks/hooks.json names no ${'$'}{CLAUDE_PLUGIN_ROOT} script`);
    else add('hooks', missing.length ? 'fail' : 'ok', missing.length ? `missing: ${missing.join(', ')}` : `${scripts.length} hook scripts present (${scripts.map((s) => s.replace(/^hooks\//, '')).join(', ')})`);
  } catch (e) {
    add('hooks', 'fail', `hooks/hooks.json unreadable (${e.message})`);
  }

  const v = verify(root);
  add('contract', v.ok ? 'ok' : 'fail', v.ok ? `worker contract v${v.version} sha256:${v.hash} (SKILL.md and core.md agree)` : v.error);

  try {
    const core = readFileSync(contractPaths(root).core, 'utf8');
    add('line endings', core.includes('\r') ? 'warn' : 'ok', core.includes('\r') ? 'core.md has CRLF line endings; the hooks normalise them, but the checkout should be LF (.gitattributes)' : 'LF');
  } catch {
    add('line endings', 'warn', 'core.md not readable, line endings not checked');
  }

  const data = dataDir(env);
  if (!existsSync(data)) add('data dir', 'warn', `${data} does not exist yet; the SessionStart bootstrap creates it`);
  else {
    try { accessSync(data, constants.W_OK); add('data dir', 'ok', `${data} (writable)`); } catch { add('data dir', 'fail', `${data} is not writable; grants and the usage log cannot be written`); }
  }

  const pointer = pointerPath(env);
  const session = readSessionPointer(env);
  // The write time of the session pointer tells whether the current session ran the bootstrap or only an older one did.
  let written = '';
  try { written = `, written ${statSync(sessionPointerPath(env)).mtime.toISOString()}`; } catch { written = ''; }
  if (existsSync(pointer) && session) add('bootstrap', 'ok', `a session started with the hooks (last session ${session}${written}; pointer ${pointer})`);
  else if (existsSync(pointer)) add('bootstrap', 'warn', `the bootstrap ran (pointer ${pointer}) but no session id was recorded; grants need --session`);
  else add('bootstrap', 'warn', `no session has started with the hooks yet (no pointer at ${pointer}); start a new Claude Code session and look for the cdp5-agents block`);

  const log = usageLogPath(env);
  if (existsSync(log)) {
    const lines = readFileSync(log, 'utf8').split('\n').filter(Boolean);
    let last = null;
    try { last = JSON.parse(lines[lines.length - 1] ?? 'null'); } catch { last = null; }
    add('usage log', 'ok', `${lines.length} lines in ${log}${last?.result ? `; last result ${last.result}` : ''}`);
  } else add('usage log', 'warn', `no agent run recorded yet (${log} absent)`);

  const gates = siblingRoot(root, 'cdp5-gates');
  add('cdp5-gates', gates ? 'ok' : 'warn', gates ?? 'not installed next to this plugin; the T1 skills the orchestrator names are unavailable');
  const domain = siblingRoot(root, 'domain-agents');
  add('domain-agents', domain ? 'ok' : 'ok', domain ?? 'not installed (optional)');

  return out;
}

export function render(results) {
  const width = Math.max(...results.map((r) => r.id.length));
  const mark = { ok: 'ok  ', warn: 'warn', fail: 'FAIL' };
  const lines = results.map((r) => `${mark[r.status]}  ${r.id.padEnd(width)}  ${r.detail}`);
  const fails = results.filter((r) => r.status === 'fail').length;
  const warns = results.filter((r) => r.status === 'warn').length;
  lines.push('', fails ? `${fails} fail, ${warns} warn  ·  exit 1` : `no fail, ${warns} warn  ·  exit 0`);
  return lines.join('\n');
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const args = Object.fromEntries(argv.map((a) => { const [k, ...r] = a.replace(/^--/, '').split('='); return [k, r.length ? r.join('=') : true]; }));
  const unknown = Object.keys(args).filter((k) => !['json', 'root'].includes(k));
  if (unknown.length) { console.error(`Usage: cdp5-doctor.mjs [--json] [--root=<plugin root>] (unknown: ${unknown.join(', ')})`); return 2; }
  if (typeof args.root === 'string' && !existsSync(args.root)) { console.error(`not found: ${args.root}`); return 2; }
  const results = checks(env, typeof args.root === 'string' ? { root: resolve(args.root) } : {});
  const exit = results.some((r) => r.status === 'fail') ? 1 : 0;
  if (args.json) console.log(JSON.stringify({ checks: results, exit }, null, 2));
  else console.log(render(results));
  return exit;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
