#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { readClaudeVersion } from '../lib/claude-version.mjs';
import { probePassed, readProbeRecord } from '../lib/probe-record.mjs';
import { isMainModule, realOrResolved, within } from '../lib/paths.mjs';
import { InputError, closeInput, openInput, readInput, readProjectFile, stillSame } from '../lib/input-file.mjs';
import { recordNonce, readHostKey, verifyToken } from '../lib/hook-key.mjs';
import { PHASES, currentPhase, predecessorOpen, statusText } from '../lib/phases.mjs';
import { ArgvError, EXECUTOR, SESSION_ID, parseCall, stripAppended } from '../lib/run-argv.mjs';
import { initCounters } from '../lib/counters.mjs';
import { credentialCovers, missingRules, readUserSettings } from '../lib/user-settings.mjs';
import { hasItem, parseItem, readIndex } from '../lib/verdict-index.mjs';
import { StoreError, allocId, bindSession, findRun, initRun, projectName, projectRootOf, updateRun, ID_KINDS } from '../lib/run-store.mjs';

export const VERSION_FLOOR = [2, 1, 295];
export const KINDS = ['idea', 'feature-request', 'issue', 'bug-report'];
export const LEVELS = ['A0', 'A1', 'A2', 'A3'];
const PLUGIN_ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const PHASE_ARTEFACTS = { idea: ['idea/idea.md'] };
const RECONCILIATION = 'not built';
const MAX_ARTEFACT_BYTES = 16 * 1024 * 1024;
const HUMAN_GATE = { A0: PHASES, A1: ['concept', 'refinement'], A2: ['refinement'], A3: [] };

class Refusal extends Error {
  constructor(error, message, extra = {}) {
    super(message);
    this.error = error;
    this.extra = extra;
  }
}

function refuse(error, message, extra) {
  throw new Refusal(error, message, extra);
}

function one(call, flag) {
  return call.values.get(flag)?.[0];
}

export function preflight(call) {
  const sessions = call.values.get('--session-id') ?? [];
  const dirs = call.values.get('--data-dir') ?? [];
  if (sessions.length !== 1) refuse('session-id-count', '--session-id must occur exactly once');
  if (dirs.length !== 1) refuse('data-dir-count', '--data-dir must occur exactly once');
  if (!SESSION_ID.test(sessions[0])) refuse('session-id-format', '--session-id is not a valid session id');
  if (!isAbsolute(dirs[0])) refuse('data-dir-format', '--data-dir must be an absolute path');
  return { sessionId: sessions[0], dataDir: dirs[0] };
}

export function verifyHook(call, argv, env) {
  const key = readHostKey(env);
  if (!key) refuse('hook-key-unreadable', 'the host key is missing or unreadable');
  const tokens = call.values.get('--hook-token') ?? [];
  if (tokens.length !== 1) refuse('hook-token-count', '--hook-token must occur exactly once');
  const { bare, expect } = stripAppended(argv);
  const fields = { sessionId: call.values.get('--session-id')[0], dataDir: call.values.get('--data-dir')[0], tokens: bare, expect };
  const checked = verifyToken(key, tokens[0], fields);
  if (!checked.ok) refuse(checked.error, 'the hook token was refused');
  if (!recordNonce(fields.dataDir, checked.nonce)) refuse('hook-token-replayed', 'the hook token was already used');
  if (process.execArgv.length > 0 || env.NODE_OPTIONS !== undefined) refuse('node-options', 'node options are not allowed for run.mjs');
  return { expect };
}

function sha256(buf) {
  return createHash('sha256').update(buf).digest('hex');
}

function homeDir(env) {
  return env.HOME ?? homedir();
}

const SECRET_SEGMENTS = new Set(['.ssh', '.aws']);

function secretPath(path) {
  const parts = path.split(sep);
  if (parts.some((p) => SECRET_SEGMENTS.has(p))) return true;
  for (let i = 0; i < parts.length - 1; i += 1) if (parts[i] === '.config' && parts[i + 1] === 'gh') return true;
  return basename(path).startsWith('.env');
}

function checkPath(flag, value, ctx) {
  const real = realOrResolved(isAbsolute(value) ? value : resolve(ctx.projectRoot, value));
  if (ctx.allowExact?.includes(real)) return real;
  const keyDir = realOrResolved(join(homeDir(ctx.env), '.config', 'cdp6-core'));
  if (within(real, keyDir)) refuse('path-rule', `path rule: ${flag} names the host key directory`);
  if (secretPath(real)) refuse('path-rule', `path rule: ${flag} matches a secret path pattern`);
  if (credentialCovers(ctx.settings, real, ctx.env)) refuse('path-rule', `path rule: ${flag} lies under a credentials deny entry of the user settings`);
  if (!ctx.roots.some((root) => within(real, root))) {
    refuse('path-rule', `path rule: ${flag} lies outside the project root and the run roots`);
  }
  return real;
}

function claudeVersion(env) {
  const version = readClaudeVersion(env);
  if (!version) refuse('claude-version-unreadable', 'claude --version could not be read');
  return version;
}

function belowFloor(parts) {
  for (let i = 0; i < 3; i += 1) {
    if (parts[i] !== VERSION_FLOOR[i]) return parts[i] < VERSION_FLOOR[i];
  }
  return false;
}

const MAX_INPUT_BYTES = 1024 * 1024;

function openChecked(flag, value, ctx, handles, maxBytes = Infinity) {
  const abs = isAbsolute(value) ? value : resolve(ctx.projectRoot, value);
  const handle = openInput(abs);
  handles.push(handle);
  const real = checkPath(flag, handle.real ?? realOrResolved(abs), ctx);
  if (handle.error === 'missing') refuse('file-missing', `${flag} file is missing`);
  if (handle.error === 'symlink') refuse('file-symlink', `${flag} must not be a symbolic link`);
  if (handle.error) refuse('file-unreadable', `${flag} file cannot be read`);
  if (!handle.isFile) refuse('file-missing', `${flag} is not a file`);
  if (!handle.same) refuse('file-changed', `${flag} changed while it was opened`);
  if (handle.nlink > 1) refuse('file-hard-link', `${flag} has more than one hard link`);
  if (handle.size > maxBytes) refuse('file-too-large', `${flag} file is larger than ${maxBytes} bytes`);
  const key = readHostKey(ctx.env);
  if (key && readInput(handle).includes(key)) refuse('file-holds-key', `${flag} holds the host key`);
  return { handle, real };
}

function nonEmpty(buf, flag) {
  if (buf.length === 0 || buf.toString('utf8').trim() === '') refuse('file-empty', `${flag} file is empty`);
  return buf;
}

function isRunsRootNamed(root, projectRoot, given) {
  for (const name of ['CLAUDE.md', 'README.md', 'README']) {
    const content = readProjectFile(join(projectRoot, name), MAX_INPUT_BYTES);
    if (content === null) continue;
    const text = content.toString('utf8');
    const rel = relative(projectRoot, root);
    if (text.includes(given) || (rel && text.includes(rel))) return true;
  }
  return false;
}

function slugOf(path, kind) {
  const base = basename(path).replace(/\.[^.]*$/, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 24);
  return base || kind;
}

function originKind(origin) {
  if (/^conversation(\s|$)/.test(origin)) return 'conversation';
  if (/^https?:\/\//.test(origin)) return 'url';
  return 'tracker';
}

function isoDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text ?? '')) return false;
  const d = new Date(`${text}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === text;
}

function datePart(now) {
  return now.toISOString().slice(0, 10).replaceAll('-', '');
}

function resolveCommit(projectRoot, value) {
  const r = spawnSync('git', ['-C', projectRoot, 'rev-parse', '--verify', '--end-of-options', `${value}^{commit}`], { encoding: 'utf8' });
  return r.status === 0 ? r.stdout.trim() : null;
}

function cmdInit(call, ctx) {
  const handles = [];
  try {
    return initRunFrom(call, ctx, handles);
  } finally {
    for (const h of handles) closeInput(h);
  }
}

function initRunFrom(call, ctx, handles) {
  const kind = one(call, '--kind');
  const intake = one(call, '--intake');
  const origin = one(call, '--origin');
  const cls = one(call, '--class');
  const mode = one(call, '--mode');
  const assignment = one(call, '--assignment');
  const start = one(call, '--start') ?? 'idea';
  const imports = call.values.get('--import') ?? [];
  const rootArg = one(call, '--root');
  if (!kind || !KINDS.includes(kind)) refuse('unknown-kind', `--kind must be one of: ${KINDS.join(', ')}`);
  if (!intake) refuse('missing-flag', '--intake is required');
  if (!origin) refuse('missing-flag', '--origin is required');
  if (!['own', 'company'].includes(cls)) refuse('unknown-class', '--class must be own or company');
  if (!['single', 'multi', 'team'].includes(mode)) refuse('unknown-mode', '--mode must be single, multi or team');
  if (!PHASES.includes(start)) refuse('unknown-phase', '--start is not a phase');
  if (start === 'idea' && imports.length) refuse('import-needs-start', '--import needs --start with a phase other than idea');
  if (start !== 'idea' && imports.length === 0) refuse('import-needs-start', `--start ${start} needs at least one --import`);
  const originClass = originKind(origin);
  const httpStatus = one(call, '--http-status');
  const separate = !(kind === 'idea' && originClass === 'conversation');
  if (separate && !assignment) refuse('assignment-required', `--kind ${kind} or an origin other than conversation needs a separate --assignment file`);
  const fetched = one(call, '--fetched');
  if (originClass === 'url' && !/^[1-5]\d\d$/.test(httpStatus ?? '')) refuse('origin-status-missing', 'a URL origin needs --http-status with the three-digit status of the fetch');
  if (originClass === 'url' && !isoDate(fetched)) refuse('origin-fetched-missing', 'a URL origin needs --fetched with the ISO 8601 date of the fetch');

  const { projectRoot, env, dataDir } = ctx;
  if (within(realOrResolved(homeDir(env)), realOrResolved(projectRoot))) refuse('project-root-home', 'the project root is the home directory or one of its ancestors');
  const runsDefault = cls === 'company'
    ? join(homeDir(env), '.claude', 'projects', projectName(projectRoot), 'memory', 'cdp6', 'runs')
    : join(projectRoot, 'docs', 'cdp6', 'runs');
  const runsBase = rootArg ? realOrResolved(isAbsolute(rootArg) ? rootArg : resolve(projectRoot, rootArg)) : runsDefault;
  const pathCtx = {
    projectRoot,
    env,
    roots: [projectRoot, runsDefault],
    allowExact: [],
    settings: readUserSettings(env),
  };
  const intakeOpen = openChecked('--intake', intake, pathCtx, handles, MAX_INPUT_BYTES);
  const assignmentOpen = assignment ? openChecked('--assignment', assignment, pathCtx, handles, MAX_INPUT_BYTES) : null;
  const intakePath = intakeOpen.real;
  if (rootArg) checkPath('--root', rootArg, pathCtx);
  const importRecords = [];
  for (const value of imports) {
    const isFile = existsSync(resolve(projectRoot, value));
    const commit = isFile || value.startsWith('-') ? null : resolveCommit(projectRoot, value);
    if (commit) {
      importRecords.push({ kind: 'commit', value, commit });
    } else if (isFile || value.includes('/')) {
      const opened = openChecked('--import', value, { ...pathCtx, allowExact: [realOrResolved(join(dataDir, 'usage-log.jsonl'))] }, handles);
      const buf = nonEmpty(readInput(opened.handle), '--import');
      importRecords.push({ kind: 'file', path: opened.real, sha256: sha256(buf) });
    } else {
      refuse('import-unresolved', '--import value is not a path or a commit');
    }
  }

  const files = importRecords.filter((r) => r.kind === 'file').map((r) => r.sha256);
  if (files.length !== ctx.expect.length || files.some((h, i) => h !== ctx.expect[i])) refuse('expect-sha256-mismatch', 'an imported file differs from the file the owner approved');

  const version = claudeVersion(env);
  if (belowFloor(version.parts)) refuse('below-version-floor', `Claude Code ${version.text} is below the floor ${VERSION_FLOOR.join('.')}`);

  if (mode === 'team') {
    const rec = readProbeRecord(dataDir, version.text);
    const failed = [];
    if (!probePassed(rec, 'A-11')) failed.push('A-11');
    if (!probePassed(rec, 'A-16')) failed.push('A-16');
    if (!probePassed(rec, 'A-14') && !probePassed(rec, 'A-17')) failed.push('A-14 or A-17');
    if (failed.length) refuse('team-without-probes', `--mode team needs an accepted probe record with A-11, A-16 and A-14 or A-17 passed; not passed: ${failed.join(', ')}; use --mode multi`);
    refuse('team-not-built', 'team mode is not built in this release; use --mode multi');
  }

  for (const h of handles) if (!stillSame(h)) refuse('file-changed', 'a file argument changed after it was opened');
  const intakeBuf = nonEmpty(readInput(intakeOpen.handle), '--intake');
  const assignmentBuf = assignmentOpen ? nonEmpty(readInput(assignmentOpen.handle), '--assignment') : intakeBuf;

  const existing = findRun({ dataDir, sessionId: null, cwd: projectRoot });
  if (existing.error === 'pointer-missing') refuse('active-run-exists', 'an active run exists in the project run roots');
  if (existing.error) refuse('run-lookup-error', 'the active-run lookup failed, so init cannot rule out a second active run', { cause: existing.error });
  if (existing.S && existing.run) refuse('active-run-exists', 'one active run per project root');

  const now = new Date();
  const runId = `RUN-${datePart(now)}-${slugOf(intakePath, kind)}`;
  let id = runId;
  let n = 1;
  while (existsSync(join(dataDir, 'runs', id)) || existsSync(join(runsBase, id))) {
    n += 1;
    id = `${runId}-${n}`;
  }
  const R = join(runsBase, id);
  const S = join(dataDir, 'runs', id);
  if (cls === 'company' && within(realOrResolved(R), projectRoot)) {
    refuse('company-run-in-repo', 'company repositories keep no run files inside the repository');
  }
  if (cls === 'own' && rootArg && !isRunsRootNamed(runsBase, projectRoot, rootArg)) {
    refuse('unnamed-record-place', `${rootArg} is not named in CLAUDE.md or README`);
  }

  const settings = readUserSettings(env);
  if (!settings) refuse('user-settings-unreadable', 'the user settings file could not be read');
  const missing = missingRules(settings, env, { dataDir, pluginRoot: PLUGIN_ROOT });
  if (missing.length) refuse('user-settings-rule-missing', `the user settings lack: ${missing.join('; ')}`, { missing });

  mkdirSync(join(S, 'idea'), { recursive: true, mode: 0o700 });
  const dateLines = originClass === 'url' ? `fetched: ${fetched}\nhttp_status: ${httpStatus}\n` : `date: ${now.toISOString().slice(0, 10)}\n`;
  const intakeText = `kind: ${kind}\norigin: ${origin}\n${dateLines}\n${intakeBuf.toString('utf8')}`;
  writeFileSync(join(S, 'idea', 'intake.md'), intakeText, { mode: 0o600 });
  writeFileSync(join(S, 'idea', 'assignment.md'), assignmentBuf, { mode: 0o600 });
  writeFileSync(join(S, 'ledger.md'), `# Ledger ${id}\n`, { mode: 0o600 });
  initCounters(S);

  const phases = {};
  for (const p of PHASES) phases[p] = { state: 'pending', cycle: 1 };
  if (start !== 'idea') {
    const prev = PHASES[PHASES.indexOf(start) - 1];
    phases[prev] = { state: 'imported', cycle: 1, imports: importRecords, decider: 'owner', at: now.toISOString() };
  }
  const run = {
    run_id: id,
    status: 'active',
    class: cls,
    mode,
    root: projectRoot,
    run_dir: R,
    created_at: now.toISOString(),
    claude_version: version.text,
    intake: { kind, origin, path: 'idea/intake.md', sha256: sha256(Buffer.from(intakeText)) },
    route: 'full',
    assignment: { path: 'idea/assignment.md', sha256: sha256(assignmentBuf) },
    ids: { next: {}, provisional: {} },
    decisions: {},
    owner_records: [],
    bans: [],
    vetoes: [],
    autonomy: { level: 'A0', tokens: null, loops: null, set: false },
    phases,
  };
  initRun(S, run);
  bindSession(dataDir, { sessionId: ctx.sessionId, runId: id, projectRoot });
  return { run_id: id, S, R, status: 'active' };
}

function lookup(ctx, { requireActive = true } = {}) {
  const found = findRun({ dataDir: ctx.dataDir, sessionId: ctx.sessionId, cwd: ctx.cwd });
  if (found.error) refuse(found.error, 'the run record is not usable');
  if (!found.S || !found.run) refuse('no-active-run', 'no active run for this session or project');
  if (requireActive && found.run.status !== 'active') refuse('run-not-active', `run status is ${found.run.status}`);
  return found;
}

function assertActive(run) {
  if (run.status !== 'active') refuse('run-not-active', `run status is ${run.status}`);
}

function stamp() {
  return new Date().toISOString();
}

function cmdStatus(call, ctx) {
  const { S, run } = lookup(ctx, { requireActive: false });
  return { text: statusText(S, run) };
}

function guardObserved(dataDir, sessionId) {
  let text;
  try {
    text = readFileSync(join(dataDir, 'hooks-fired.jsonl'), 'utf8');
  } catch {
    return false;
  }
  for (const line of text.split('\n')) {
    try {
      const l = JSON.parse(line);
      if (l.hook === 'guard-phase.mjs' && l.session_id === sessionId) return true;
    } catch {
      continue;
    }
  }
  return false;
}

function cmdEnter(call, ctx) {
  const phase = call.positionals[0];
  if (!PHASES.includes(phase)) refuse('unknown-phase', `phase must be one of: ${PHASES.join(', ')}`);
  const { S, run } = lookup(ctx);
  const verify = (r) => {
    assertActive(r);
    const open = currentPhase(r);
    if (open) refuse('phase-entered', `phase ${open} is still open`);
    if (r.phases[phase].state !== 'pending') refuse('phase-closed', `phase ${phase} is ${r.phases[phase].state}`);
    const missing = predecessorOpen(r, phase);
    if (missing) refuse('predecessor-missing', `${missing} has no exit record`);
  };
  verify(run);
  if (!guardObserved(ctx.dataDir, ctx.sessionId)) refuse('guard-not-observed', 'no guard-phase.mjs line in hooks-fired.jsonl for this session');
  updateRun(S, `enter:${phase}`, (r) => {
    verify(r);
    r.phases[phase].state = 'entered';
    r.phases[phase].entered_at = stamp();
  });
  return { phase, state: 'entered' };
}

function cmdSetAutonomy(call, ctx) {
  const level = call.positionals[0];
  if (!LEVELS.includes(level)) refuse('unknown-level', `level must be one of: ${LEVELS.join(', ')}`);
  const tokens = one(call, '--tokens');
  const loops = one(call, '--loops');
  if (tokens === undefined || loops === undefined) refuse('missing-flag', '--tokens and --loops are required');
  if (!/^\d+$/.test(tokens) || !/^\d+$/.test(loops)) refuse('bad-budget', 'budgets are non-negative integers');
  const { S } = lookup(ctx);
  if (level === 'A3') {
    const version = claudeVersion(ctx.env);
    if (!probePassed(readProbeRecord(ctx.dataDir, version.text), 'A-5')) {
      refuse('a3-before-probe', 'A3 needs an accepted probe record with A-5 passed');
    }
  }
  const at = stamp();
  updateRun(S, 'set-autonomy', (r) => {
    assertActive(r);
    r.autonomy = { level, tokens: Number(tokens), loops: Number(loops), set: true, at };
    r.owner_records.push({ kind: 'set-autonomy', level, tokens: Number(tokens), loops: Number(loops), decider: 'owner', at });
  });
  return { level, tokens: Number(tokens), loops: Number(loops) };
}

function cmdObject(call, ctx) {
  const [id, verdict] = call.positionals;
  const item = parseItem(id);
  if (!item) refuse('bad-objection-id', 'objection id must look like <capture id>:F-P1-1, <capture id>:premise-1, <capture id>:conflict or <capture id>:capture');
  if (!['accept', 'reject'].includes(verdict)) refuse('bad-verdict', 'verdict must be accept or reject');
  const why = one(call, '--why');
  if (why === undefined || why.trim() === '') refuse('missing-flag', '--why is required');
  const { S, run } = lookup(ctx);
  let index;
  try {
    index = readIndex(S);
  } catch {
    refuse('index-unreadable', 'the verdict index is not readable');
  }
  if (!hasItem(index, id, S)) refuse(`unknown-${item.kind}`, `${id} names no ${item.kind} on an index line of this run`);
  const decides = index.find((c) => c.id === item.captureId)?.decision;
  const verify = (r) => {
    assertActive(r);
    if (r.owner_records.some((o) => o.kind === 'object' && o.id === id)) refuse('objection-recorded', `${id} already has an owner record`);
    if (item.kind === 'conflict' && verdict === 'reject' && typeof decides === 'string' && r.decisions?.[decides]?.status === 'decided') {
      refuse('conflict-reject-after-decision', `${decides} is decided: ${id} can only be accepted`);
    }
  };
  verify(run);
  updateRun(S, `object:${id}`, (r) => {
    verify(r);
    r.owner_records.push({ kind: 'object', id, verdict, why, decider: 'owner', at: stamp() });
  });
  return { id, verdict };
}

function cmdId(call, ctx) {
  const kind = call.positionals[0];
  if (!ID_KINDS.includes(kind)) refuse('unknown-kind', `id kind must be one of: ${ID_KINDS.join(', ')}`);
  const { S } = lookup(ctx);
  return { id: allocId(S, kind) };
}

const DECISION_STATUSES = { '': ['proposed', 'decided'], proposed: ['decided', 'superseded'], decided: ['superseded'], superseded: [] };

function cmdDecision(call, ctx) {
  const [id, status] = call.positionals;
  if (!/^D-\d+$/.test(id)) refuse('bad-decision-id', 'decision id must look like D-1');
  if (status === 'vetoed') refuse('bad-status', 'vetoed is set only by run.mjs veto');
  if (!['proposed', 'decided', 'superseded'].includes(status)) refuse('bad-status', 'status must be proposed, decided or superseded');
  const { S, run } = lookup(ctx);
  const decider = one(call, '--decider') ?? EXECUTOR[run.mode];
  if (!/^[A-Za-z0-9._ -]{1,40}$/.test(decider)) refuse('bad-decider', 'decider has characters outside the allowed set');
  const n = Number(id.slice(2));
  const verify = (r) => {
    assertActive(r);
    if (!((r.ids?.next?.D ?? 1) > n)) refuse('unallocated-id', `${id} was not allocated with run.mjs id D`);
    const from = r.decisions[id]?.status ?? '';
    if (!DECISION_STATUSES[from]?.includes(status)) refuse('bad-transition', `${id} cannot go from ${from || 'new'} to ${status}`);
  };
  verify(run);
  const at = stamp();
  updateRun(S, `decision:${id}:${status}`, (r) => {
    verify(r);
    const d = r.decisions[id] ?? { stamps: [] };
    d.status = status;
    d.decider = decider;
    d.stamps.push({ status, at, decider });
    r.decisions[id] = d;
    if (status === 'decided' && decider !== EXECUTOR[r.mode]) r.owner_records.push({ kind: 'decision', id, status, decider: 'owner', at });
  });
  return { id, status, decider, at };
}

function readArtefacts(run, phase, ctx, handles) {
  if (typeof run.run_dir !== 'string' || typeof run.root !== 'string') refuse('run-dir-unknown', 'run.json records no run directory');
  const R = run.run_dir;
  const roots = run.class === 'company' ? [run.root, R, realOrResolved(R)] : [run.root, R];
  const pathCtx = { projectRoot: run.root, env: ctx.env, roots, allowExact: [], settings: readUserSettings(ctx.env) };
  const out = [];
  for (const path of PHASE_ARTEFACTS[phase] ?? []) {
    let opened;
    try {
      opened = openChecked('artefact', join(R, path), pathCtx, handles, MAX_ARTEFACT_BYTES);
    } catch (e) {
      if (e instanceof Refusal && e.error === 'file-missing') continue;
      throw e;
    }
    const buf = readInput(opened.handle);
    if (!stillSame(opened.handle)) refuse('file-changed', 'an artefact changed while it was read');
    out.push({ path, sha256: sha256(buf), buf });
  }
  return out;
}

function withArtefacts(run, phase, ctx, fn) {
  const handles = [];
  try {
    return fn(readArtefacts(run, phase, ctx, handles));
  } finally {
    for (const h of handles) closeInput(h);
  }
}

function writeSnapshot(S, phase, cycle, artefacts) {
  if (!PHASES.includes(phase) || !Number.isInteger(cycle) || cycle < 1) refuse('state-corrupt', 'run.json holds a phase or cycle that cannot name a snapshot directory');
  const dir = join(S, 'snapshots', phase, `cycle-${cycle}`);
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  for (const a of artefacts) {
    const target = join(dir, a.path);
    mkdirSync(dirname(target), { recursive: true, mode: 0o700 });
    writeFileSync(target, a.buf, { mode: 0o600 });
  }
  return dir;
}

const recorded = (artefacts) => artefacts.map(({ path, sha256: hash }) => ({ path, sha256: hash }));

function pluginVersion() {
  return JSON.parse(readFileSync(join(PLUGIN_ROOT, '.claude-plugin', 'plugin.json'), 'utf8')).version;
}

function registeredCheckers(phase) {
  try {
    return JSON.parse(readFileSync(join(PLUGIN_ROOT, 'checks', 'registry.json'), 'utf8')).phases?.[phase]?.checkers ?? [];
  } catch {
    return [];
  }
}

function cmdExit(call, ctx) {
  const phase = call.positionals[0];
  if (!PHASES.includes(phase)) refuse('unknown-phase', `phase must be one of: ${PHASES.join(', ')}`);
  const { S, run } = lookup(ctx);
  const verify = (r) => {
    assertActive(r);
    if (!['entered', 'gate-pending'].includes(r.phases[phase].state)) refuse('phase-not-entered', `phase ${phase} is ${r.phases[phase].state}`);
  };
  verify(run);
  const checkers = registeredCheckers(phase);
  const absent = checkers.length ? checkers.find((c) => !existsSync(join(PLUGIN_ROOT, c.path))) : null;
  if (!checkers.length || absent) {
    updateRun(S, `exit:${phase}:checker-missing`, (r) => {
      verify(r);
      r.phases[phase].state = 'gate-pending';
      r.phases[phase].gate = { passed: false, result: 'checker-missing', checkers: [], reconciliation: RECONCILIATION };
    });
    if (absent) refuse('checker-missing', `checker ${absent.name} is missing`, { checker: absent.name });
    refuse('checker-missing', `no checker is registered for ${phase}`);
  }
  const snapshot = withArtefacts(run, phase, ctx, (artefacts) => ({ artefacts: recorded(artefacts), dir: writeSnapshot(S, phase, run.phases[phase].cycle ?? 1, artefacts) }));
  updateRun(S, `exit:${phase}:start`, (r) => {
    verify(r);
    r.phases[phase].state = 'gate-pending';
    delete r.phases[phase].gate;
  });
  const version = pluginVersion();
  const results = [];
  const lines = [];
  for (const c of checkers) {
    const r = spawnSync(process.execPath, [join(PLUGIN_ROOT, c.path), '--run-dir', S, '--snapshot', snapshot.dir], { encoding: 'utf8' });
    const output = `${r.stdout ?? ''}${r.stderr ?? ''}`;
    results.push({ name: c.name, version, exit: r.status, output_sha256: sha256(Buffer.from(output)) });
    if (r.status === 1) lines.push(output.trimEnd());
    else if (r.status !== 0) refuse('checker-error', `checker ${c.name} did not complete`, { checker: c.name });
  }
  const artefacts = snapshot.artefacts;
  const at = stamp();
  let outcome;
  updateRun(S, `exit:${phase}:settled`, (r) => {
    verify(r);
    const failed = [...lines];
    if (!r.autonomy.set) failed.push('run FAIL autonomy level and budgets are not set by the owner');
    const p = r.phases[phase];
    if (failed.length) {
      p.state = 'entered';
      p.gate = { passed: false, checkers: results, artefacts, reconciliation: RECONCILIATION };
      outcome = { exitCode: 1, text: failed.join('\n') };
      return;
    }
    const needsApproval = HUMAN_GATE[r.autonomy.level].includes(phase);
    p.gate = { passed: true, checkers: results, artefacts, reconciliation: RECONCILIATION };
    if (!needsApproval) {
      p.state = 'exited';
      p.exited_at = at;
      p.artefacts = artefacts;
    }
    outcome = needsApproval ? { phase, state: 'gate-pending', awaiting: 'approve' } : { phase, state: 'exited' };
  });
  return outcome;
}

function cmdApprove(call, ctx) {
  const target = call.positionals[0];
  if (/^S-\d+$/.test(target)) refuse('unknown-slice', `${target} is not a slice of this run`);
  if (!PHASES.includes(target)) refuse('unknown-target', 'approve takes a phase or a slice id');
  const { S, run } = lookup(ctx);
  const verify = (r) => {
    assertActive(r);
    const ph = r.phases[target];
    if (ph.state !== 'gate-pending' || !ph.gate?.passed) refuse('phase-not-pending-approval', `phase ${target} has no passed gate awaiting approval`);
    return ph;
  };
  const p = verify(run);
  const now = withArtefacts(run, target, ctx, recorded);
  const was = new Map(p.gate.artefacts.map((a) => [a.path, a.sha256]));
  const changed = now.filter((a) => was.get(a.path) !== a.sha256).map((a) => a.path);
  for (const path of was.keys()) if (!now.some((a) => a.path === path)) changed.push(path);
  if (changed.length) refuse('artefact-drift', `artefacts changed after the gate: ${changed.join(', ')}`);
  const at = stamp();
  updateRun(S, `approve:${target}`, (r) => {
    const ph = verify(r);
    if (JSON.stringify(ph.gate.artefacts) !== JSON.stringify(p.gate.artefacts)) refuse('artefact-drift', 'the gate record changed during the approval');
    ph.state = 'exited';
    ph.exited_at = at;
    ph.artefacts = ph.gate.artefacts;
    r.owner_records.push({ kind: 'approve', target, decider: 'owner', at });
  });
  return { phase: target, state: 'exited' };
}

const COMMANDS = {
  exit: cmdExit,
  approve: cmdApprove,
  init: cmdInit,
  status: cmdStatus,
  enter: cmdEnter,
  'set-autonomy': cmdSetAutonomy,
  object: cmdObject,
  id: cmdId,
  decision: cmdDecision,
};

export function main(argv, env = process.env, cwd = process.cwd()) {
  let call;
  try {
    call = parseCall(argv);
    const { sessionId, dataDir } = preflight(call);
    const hook = verifyHook(call, argv, env);
    if (!COMMANDS[call.sub]) refuse('not-built', 'this subcommand is not built in this release');
    const ctx = { sessionId, dataDir, env, cwd, projectRoot: projectRootOf(cwd), expect: hook.expect };
    const result = COMMANDS[call.sub](call, ctx);
    process.stdout.write(result.text !== undefined ? `${result.text}\n` : `${JSON.stringify(result)}\n`);
    return result.exitCode ?? 0;
  } catch (e) {
    if (e instanceof StoreError) {
      process.stderr.write(`${JSON.stringify({ error: e.code, message: e.message })}\n`);
      return 2;
    }
    if (e instanceof ArgvError) {
      process.stderr.write(`${JSON.stringify({ error: e.error, message: e.message })}\n`);
      return 2;
    }
    if (e instanceof InputError) {
      process.stderr.write(`${JSON.stringify({ error: e.code, message: 'a file is larger than it was when it was opened' })}\n`);
      return 2;
    }
    if (e instanceof Refusal) {
      process.stderr.write(`${JSON.stringify({ error: e.error, message: e.message, ...e.extra })}\n`);
      return 2;
    }
    process.stderr.write(`${JSON.stringify({ error: e.code ?? 'internal', message: 'run.mjs failed' })}\n`);
    return 2;
  }
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
