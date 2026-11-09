#!/usr/bin/env node
import { readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { countedPaths, gitEntries, staticRoot, writableRoots } from '../lib/preflight-fs.mjs';
import { readUserSettings } from '../lib/user-settings.mjs';
import { dataDirectory, probeRecord } from '../lib/preflight-data.mjs';
import { environment, hooksOff, projectSettings } from '../lib/preflight-env.mjs';
import { managedSettings, readManaged, settingsFile, settingsLocation, userSettings } from '../lib/preflight-settings.mjs';
import { calibrationOf, readProbeRecord } from '../lib/probe-record.mjs';
import { versionOfProcess } from '../lib/running-version.mjs';
import { isMainModule, within } from '../lib/paths.mjs';
import { ancestorsOf, descendsFromAny, isClaudeProcess, readProcesses } from '../lib/preflight-proc.mjs';

export const PROFILE_LIMIT = 9000;
const EDIT_RULE = /^Edit\((.*)\)$/;

function realOf(path) {
  try {
    return realpathSync(path);
  } catch {
    return resolve(path);
  }
}

function parseObject(bytes) {
  try {
    const doc = JSON.parse(bytes.toString('utf8'));
    return doc && typeof doc === 'object' && !Array.isArray(doc) ? { doc } : { doc: null, error: 'not a JSON object' };
  } catch {
    return { doc: null, error: 'not readable as JSON' };
  }
}

function readLive(args, read) {
  let bytes;
  try {
    bytes = read(args.settings);
  } catch (e) {
    return { doc: null, bytes: null, error: e.code === 'ENOENT' ? 'missing' : 'not readable' };
  }
  return { ...parseObject(bytes), bytes };
}

function writeSpecs(docs, env) {
  const roots = [];
  for (const d of docs) {
    for (const s of [...(d.sandbox?.filesystem?.allowWrite ?? []), ...(d.permissions?.additionalDirectories ?? [])]) roots.push(staticRoot(s, env));
    for (const r of d.permissions?.allow ?? []) {
      const m = EDIT_RULE.exec(typeof r === 'string' ? r : '');
      if (m) roots.push(staticRoot(m[1], env, { rule: true }));
    }
  }
  return roots;
}

function lazily(target, name, fn) {
  Object.defineProperty(target, name, {
    configurable: true,
    get() {
      const value = fn();
      Object.defineProperty(target, name, { value, configurable: true });
      return value;
    },
  });
}

function context(args, ctx) {
  const env = ctx.env ?? process.env;
  const procRoot = ctx.procRoot ?? '/proc';
  const x = { args, env, procRoot, user: readUserSettings(env), live: readLive(args, ctx.read ?? readFileSync), managedDir: ctx.managedDir ?? '/etc/claude-code' };
  lazily(x, 'managed', () => readManaged(x.managedDir));
  lazily(x, 'wsl', () => ctx.wsl ?? /microsoft/i.test(readText('/proc/sys/kernel/osrelease')));
  lazily(x, 'docs', () => [x.user, x.live.doc, ...x.managed.map((m) => m.doc)].filter(Boolean));
  lazily(x, 'projectReal', () => realOf(args.project));
  lazily(x, 'roots', () => writableRoots([x.projectReal, ...(ctx.tmpRoots ?? ['/tmp', env.TMPDIR, tmpdir(), env.CLAUDE_CODE_TMPDIR]), ...writeSpecs(x.docs, env)]));
  lazily(x, 'gitEntries', () => x.roots.flatMap((root) => gitEntries(root).map((path) => ({ root, path }))));
  lazily(x, 'proc', () => {
    const table = readProcesses(procRoot);
    return { root: procRoot, table, selfPid: ctx.selfPid ?? process.pid, orchestratorPid: Number(args.orchestratorPid) };
  });
  lazily(x, 'orchestrator', () => x.proc.table.get(x.proc.orchestratorPid) ?? null);
  lazily(x, 'running', () => (x.orchestrator && isClaudeProcess(x.orchestrator) ? versionOfProcess(x.orchestrator) : null));
  lazily(x, 'record', () => (x.running ? readProbeRecord(args.dataDir, x.running.text, env) : null));
  return x;
}

function readText(file) {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return '';
  }
}

function sandboxProfile(x, fail, info) {
  const counted = countedPaths(x.docs, x.env, x.gitEntries.length);
  info.push(`counted paths ${counted.total}`);
  const cal = calibrationOf(x.record);
  if (cal === null) {
    fail('sandbox-profile', 'argument estimate', `no calibration in the A-12 auto row of the accepted record (Q-18); the entries expand to ${counted.total - counted.git} paths plus ${counted.git} .git entries`, 'run the probe session of the concept section 11.1 so that the accepted record carries the bwrap argument counts');
    return;
  }
  const estimate = cal.base + cal.per_path * counted.total;
  info.push(`sandbox profile estimate ${estimate} against ${PROFILE_LIMIT} (${counted.total} paths at ${cal.per_path} each, base ${cal.base})`);
  if (estimate <= PROFILE_LIMIT) return;
  const largest = [...counted.entries].sort((a, b) => b.count - a.count)[0] ?? { spec: 'no entry', count: 0 };
  fail('sandbox-profile', largest.spec, `${largest.spec} expands to ${largest.count} paths; estimate ${estimate} against ${PROFILE_LIMIT} (${counted.total} paths at ${cal.per_path} each, base ${cal.base})`, 'replace a glob entry by a project-scoped entry and set permissions.blockReadsOutsideWorkingDirectories true (concept section 5.6 item 5); remove leftover git repositories under writable roots');
}

function gitRepositories(x, fail) {
  const own = join(x.projectReal, '.git');
  const worktrees = join(x.projectReal, '.worktrees');
  const byRoot = new Map();
  for (const { root, path } of x.gitEntries) {
    if (path === own || within(path, worktrees)) continue;
    byRoot.set(root, (byRoot.get(root) ?? 0) + 1);
  }
  for (const [root, count] of byRoot) fail('git-repositories', root, `${count} git repositories under the writable root ${root}`, `remove the repositories under ${root} that are not the project or its .worktrees`);
}

function processes(x, fail) {
  const { table, selfPid, orchestratorPid } = x.proc;
  if (!table.has(orchestratorPid)) {
    fail('processes', `pid ${orchestratorPid}`, `the orchestrator pid is not in the process table at ${x.proc.root}`, 'pass the pid of the orchestrator Claude Code process and run from a shell that sees the host process table');
    return;
  }
  const claude = new Set([...table.values()].filter((p) => isClaudeProcess(p)).map((p) => p.pid));
  const ancestors = ancestorsOf(table, selfPid);
  for (const proc of [...table.values()].sort((a, b) => a.pid - b.pid)) {
    if (proc.pid === selfPid || proc.pid === orchestratorPid || (!isClaudeProcess(proc) && ancestors.has(proc.pid)) || descendsFromAny(table, proc, new Set([selfPid]))) continue;
    if (claude.has(proc.pid)) fail('processes', `pid ${proc.pid}`, `Claude Code process: ${proc.command}`, `end the session of pid ${proc.pid}`);
    else if (descendsFromAny(table, proc, claude)) fail('processes', `pid ${proc.pid}`, `process below a Claude Code process (parent ${proc.ppid}): ${proc.command}`, `end pid ${proc.pid}, or accept it by name in the ledger line of the owner`);
  }
}

const CHECKS = [
  ['sandbox-profile', sandboxProfile],
  ['git-repositories', gitRepositories],
  ['processes', processes],
  ['probe-record', probeRecord],
  ['settings-file', settingsFile],
  ['settings-location', settingsLocation],
  ['user-settings', userSettings],
  ['managed-settings', managedSettings],
  ['data-directory', dataDirectory],
  ['environment', environment],
  ['project-settings', projectSettings],
  ['hooks-off', hooksOff],
];

export function preflight(args, ctx = {}) {
  const failures = [];
  const info = [];
  const fail = (check, item, found, fix) => failures.push({ check, item, found, fix });
  let x;
  try {
    x = context(args, ctx);
  } catch (e) {
    fail('context', 'check could not run', e.message, 'repair the cause and run the preflight again');
    return result(failures, info);
  }
  for (const [name, check] of CHECKS) {
    try {
      check(x, fail, info);
    } catch (e) {
      fail(name, 'check could not run', e.message, 'repair the cause and run the preflight again');
    }
  }
  return result(failures, info);
}

function result(failures, info) {
  const lines = [...info.map((i) => `info ${i}`), ...failures.map((f) => `FAIL ${f.check} ${f.item}: found ${f.found}; fix: ${f.fix}`), ...(failures.length === 0 ? ['ok every check passed'] : [])];
  return { exit: failures.length === 0 ? 0 : 1, ok: failures.length === 0, failures, info, text: lines.join('\n') };
}

const VALUE_ARGS = { '--settings': 'settings', '--settings-sha256': 'settingsSha256', '--plugin-dir': 'pluginDir', '--project': 'project', '--data-dir': 'dataDir', '--orchestrator-pid': 'orchestratorPid', '--run': 'run' };

export function parseArgs(argv) {
  const args = {};
  const failures = [];
  const bad = (item, found, fix) => failures.push({ check: 'arguments', item, found, fix });
  for (let i = 0; i < argv.length; i += 1) {
    const name = argv[i];
    if (name === '--json') args.json = true;
    else if (VALUE_ARGS[name] && i + 1 < argv.length && !argv[i + 1].startsWith('--')) args[VALUE_ARGS[name]] = argv[++i];
    else if (VALUE_ARGS[name]) bad(name, 'no value', `pass a value after ${name}`);
    else bad(name, 'unknown argument', 'see the usage in the concept section UC-14 step 5');
  }
  for (const [name, key] of Object.entries(VALUE_ARGS)) if (key !== 'run' && args[key] === undefined && !failures.some((f) => f.item === name)) bad(name, 'missing', `pass ${name}`);
  if (args.orchestratorPid !== undefined && !/^[1-9]\d*$/.test(args.orchestratorPid)) bad('--orchestrator-pid', args.orchestratorPid, 'pass the numeric pid of the orchestrator Claude Code process');
  return { args, failures };
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const { args, failures } = parseArgs(argv);
  const out = failures.length > 0 ? result(failures, []) : preflight(args, { env });
  process.stdout.write(args.json ? `${JSON.stringify({ ok: out.ok, failures: out.failures, info: out.info })}\n` : `${out.text}${out.text ? '\n' : ''}`);
  return out.exit;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
