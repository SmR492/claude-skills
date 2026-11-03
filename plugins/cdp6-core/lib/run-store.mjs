import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  statSync,
  unlinkSync,
  writeFileSync,
  appendFileSync,
  fsyncSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { realOrResolved, within } from './paths.mjs';
import { readProjectFile } from './input-file.mjs';

export const TERMINAL_STATUSES = [
  'DONE',
  'HALT-STOP',
  'HALT-INTENT-GAP',
  'HALT-BUDGET',
  'HALT-CHECKER',
  'HALT-ROUNDS',
  'PARKED',
  'ABANDONED',
];
export const RUN_STATUSES = ['initialised', 'active', ...TERMINAL_STATUSES];
export const ID_KINDS = ['I', 'D', 'R', 'Q', 'SRC', 'X', 'S', 'F', 'B', 'V', 'K', 'L', 'H'];

const MAX_GIT_FILE_BYTES = 4096;
const DEFAULT_WAIT_MS = 5000;
const DEFAULT_STALE_MS = 10000;

export class StoreError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

export function runPaths(R) {
  return {
    runJson: join(R, 'run.json'),
    journal: join(R, 'run.journal.jsonl'),
    lock: join(R, 'run.lock'),
    ledger: join(R, 'ledger.md'),
  };
}

function sleep(ms) {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

export function withLock(lockFile, fn, { waitMs = DEFAULT_WAIT_MS, staleMs = DEFAULT_STALE_MS } = {}) {
  const deadline = Date.now() + waitMs;
  let broken = false;
  for (;;) {
    try {
      const fd = openSync(lockFile, 'wx', 0o600);
      writeFileSync(fd, JSON.stringify({ pid: process.pid, at: Date.now() }));
      closeSync(fd);
      break;
    } catch (e) {
      if (e.code !== 'EEXIST') throw new StoreError('lock-error', 'lock file not usable');
      let age = 0;
      try {
        age = Date.now() - statSync(lockFile).mtimeMs;
      } catch {
        continue;
      }
      if (age > staleMs) {
        try {
          unlinkSync(lockFile);
          broken = true;
        } catch {
          continue;
        }
        continue;
      }
      if (Date.now() >= deadline) throw new StoreError('lock-busy', 'run record is locked by another writer');
      sleep(5);
    }
  }
  try {
    return fn({ broken });
  } finally {
    try {
      unlinkSync(lockFile);
    } catch {
      return undefined;
    }
  }
}

function lastJournalSeq(journal) {
  if (!existsSync(journal)) return 0;
  const lines = readFileSync(journal, 'utf8').split('\n').filter(Boolean);
  if (!lines.length) return 0;
  try {
    return JSON.parse(lines.at(-1)).seq;
  } catch {
    throw new StoreError('run-unreadable', 'run journal is not readable');
  }
}

function parseRun(R) {
  let run;
  try {
    run = JSON.parse(readFileSync(runPaths(R).runJson, 'utf8'));
  } catch {
    throw new StoreError('run-unreadable', 'run.json is missing or not readable');
  }
  if (!run || typeof run !== 'object' || Array.isArray(run)) throw new StoreError('run-unreadable', 'run.json is not an object');
  return run;
}

export function readRun(R, { settleMs = 300 } = {}) {
  const deadline = Date.now() + settleMs;
  for (;;) {
    const run = parseRun(R);
    if (lastJournalSeq(runPaths(R).journal) === run.journal_offset) return run;
    if (Date.now() >= deadline) throw new StoreError('run-unreadable', 'run.json and the journal disagree');
    sleep(5);
  }
}

function persist(R, run, entries) {
  const p = runPaths(R);
  let seq = run.journal_offset;
  const lines = [];
  for (const e of entries) {
    seq += 1;
    lines.push({ seq, at: new Date().toISOString(), op: e.op, state: undefined });
  }
  run.journal_offset = seq;
  lines.at(-1).state = run;
  const fd = openSync(p.journal, 'a', 0o600);
  try {
    appendFileSync(fd, lines.map((l) => `${JSON.stringify(l)}\n`).join(''));
    fsyncSync(fd);
  } finally {
    closeSync(fd);
  }
  const tmp = `${p.runJson}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(run, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, p.runJson);
}

export function initRun(R, run) {
  mkdirSync(R, { recursive: true });
  return withLock(runPaths(R).lock, () => {
    if (existsSync(runPaths(R).runJson)) throw new StoreError('run-exists', 'run directory already holds a run');
    const doc = { ...run, journal_offset: 0 };
    persist(R, doc, [{ op: 'init' }]);
    return doc;
  });
}

export function updateRun(R, op, fn, opts) {
  return withLock(
    runPaths(R).lock,
    ({ broken }) => {
      const run = readRun(R, { settleMs: 0 });
      const next = fn(run) ?? run;
      if (!RUN_STATUSES.includes(next.status)) throw new StoreError('unknown-status', 'run status is not an enumerated value');
      const entries = broken ? [{ op: 'lock-broken' }, { op }] : [{ op }];
      persist(R, next, entries);
      return next;
    },
    opts,
  );
}

export function allocId(R, kind) {
  if (!ID_KINDS.includes(kind)) throw new StoreError('unknown-kind', 'id kind is not one of the frozen-id kinds');
  let id;
  updateRun(R, `id:${kind}`, (run) => {
    run.ids ??= { next: {} };
    const n = run.ids.next[kind] ?? 1;
    run.ids.next[kind] = n + 1;
    id = `${kind}-${n}`;
  });
  return id;
}

export function isActiveRun(run) {
  if (!run || typeof run.status !== 'string') return false;
  if (run.status === 'DONE') return false;
  if (run.status === 'ABANDONED' && run.phases?.['loop-back']?.state === 'exited') return false;
  return true;
}

function activeRunsPath(dataDir) {
  return join(dataDir, 'active-runs.json');
}

function readActiveRuns(dataDir) {
  const file = activeRunsPath(dataDir);
  if (!existsSync(file)) return null;
  try {
    const doc = JSON.parse(readFileSync(file, 'utf8'));
    return { sessions: doc.sessions ?? {}, projects: doc.projects ?? {} };
  } catch {
    throw new StoreError('pointer-unreadable', 'active-runs.json is not readable');
  }
}

const RUN_ID = /^RUN-\d{8}-[A-Za-z0-9-]+$/;

export function stateDirOf(dataDir, runId) {
  if (typeof runId !== 'string' || !RUN_ID.test(runId)) throw new StoreError('pointer-unreadable', 'active-runs.json names a run id that is not valid');
  return join(dataDir, 'runs', runId);
}

export function bindSession(dataDir, { sessionId, runId, projectRoot }) {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 });
  const file = activeRunsPath(dataDir);
  withLock(`${file}.lock`, () => {
    const doc = readActiveRuns(dataDir) ?? { sessions: {}, projects: {} };
    doc.sessions[sessionId] = { run_id: runId, project_root: projectRoot, bound_at: new Date().toISOString() };
    doc.projects[projectRoot] = runId;
    const tmp = `${file}.${process.pid}.tmp`;
    writeFileSync(tmp, `${JSON.stringify(doc, null, 2)}\n`, { mode: 0o600 });
    renameSync(tmp, file);
  });
}

function realOrNull(p) {
  try {
    return realpathSync(p);
  } catch {
    return null;
  }
}

function mainCheckoutOf(top) {
  const dotGit = join(top, '.git');
  try {
    const pointer = readProjectFile(dotGit, MAX_GIT_FILE_BYTES);
    if (pointer === null) return null;
    const match = /^gitdir:\s*(.+?)\s*$/m.exec(pointer.toString('utf8'));
    if (!match) return null;
    const admin = realOrNull(resolve(top, match[1]));
    if (!admin) return null;
    const common = dirname(dirname(admin));
    if (basename(dirname(admin)) !== 'worktrees' || basename(common) !== '.git') return null;
    const backFile = readProjectFile(join(admin, 'gitdir'), MAX_GIT_FILE_BYTES);
    if (backFile === null) return null;
    if (realOrNull(resolve(admin, backFile.toString('utf8').trim())) !== realOrNull(dotGit)) return null;
    return dirname(common);
  } catch {
    return null;
  }
}

export function projectRootOf(cwd) {
  const r = spawnSync('git', ['-C', cwd, 'rev-parse', '--show-toplevel'], { encoding: 'utf8' });
  if (r.status !== 0) return resolve(cwd);
  const top = resolve(cwd, r.stdout.trim());
  if (!within(realOrResolved(cwd), top)) return resolve(cwd);
  return mainCheckoutOf(top) ?? top;
}

function loadActive(S) {
  try {
    const run = readRun(S);
    return isActiveRun(run) ? { S, R: run.run_dir, run } : { none: true };
  } catch (e) {
    return { error: e.code ?? 'run-unreadable', S };
  }
}

export function projectName(root) {
  return root.replace(/[^A-Za-z0-9]/g, '-');
}

function isDirectory(p) {
  try {
    return statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function nearestDir(p) {
  let cur = p;
  while (!isDirectory(cur) && dirname(cur) !== cur) cur = dirname(cur);
  return cur;
}

function runHit(run, probes, roots) {
  if (roots.includes(run.root)) return true;
  const dirs = [run.root, run.run_dir].filter((d) => typeof d === 'string');
  const real = dirs.map(realOrResolved);
  return probes.some((p) => [...dirs, ...real].some((d) => within(p, d)));
}

function scanStates(dataDir, probes, roots) {
  const base = join(dataDir, 'runs');
  let names;
  try {
    names = readdirSync(base);
  } catch {
    return { none: true };
  }
  for (const name of names.sort()) {
    const S = join(base, name);
    if (!existsSync(runPaths(S).runJson)) continue;
    let run;
    try {
      run = parseRun(S);
    } catch {
      return { error: 'pointer-missing', S };
    }
    if (isActiveRun(run) && runHit(run, probes, roots)) return { error: 'pointer-missing', S, R: run.run_dir };
  }
  return { none: true };
}

function pathHit(S, probes) {
  let run;
  try {
    run = parseRun(S);
  } catch (e) {
    return existsSync(runPaths(S).runJson) ? { error: e.code ?? 'run-unreadable', S } : { none: true };
  }
  if (typeof run.run_dir !== 'string' || !isActiveRun(run)) return { none: true };
  const dirs = [run.run_dir, realOrResolved(run.run_dir)];
  return probes.some((p) => dirs.some((d) => within(p, d))) ? loadActive(S) : { none: true };
}

export function findRun({ dataDir, sessionId, cwd, targetPath }) {
  let doc = null;
  try {
    if (typeof dataDir === 'string') doc = readActiveRuns(dataDir);
  } catch (e) {
    return { error: e.code };
  }
  const probes = [cwd, targetPath].filter(Boolean).map(realOrResolved);
  const roots = [...new Set(probes.map((p) => projectRootOf(nearestDir(p))))];
  if (doc === null) return typeof dataDir === 'string' ? scanStates(dataDir, probes, roots) : { none: true };
  const bound = sessionId ? doc.sessions[sessionId] : undefined;
  try {
    if (bound) {
      const found = loadActive(stateDirOf(dataDir, bound.run_id));
      if (!found.none) return { ...found, via: 'session' };
    }
    for (const [root, runId] of Object.entries(doc.projects)) {
      const S = stateDirOf(dataDir, runId);
      const hit = probes.some((p) => within(p, root)) || roots.includes(root);
      const found = hit ? loadActive(S) : pathHit(S, probes);
      if (found.none) continue;
      return { ...found, via: 'path' };
    }
  } catch (e) {
    return { error: e.code ?? 'pointer-unreadable' };
  }
  return { none: true };
}
