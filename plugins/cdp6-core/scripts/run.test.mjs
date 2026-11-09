import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync, readFileSync, readdirSync, existsSync, chmodSync, cpSync, rmSync, symlinkSync, realpathSync, linkSync, copyFileSync, statSync, renameSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ensureHostKey, mintToken, readHostKey } from '../lib/hook-key.mjs';
import { parseCall, stripAppended } from '../lib/run-argv.mjs';
import { expectHashes } from '../hooks/guard-shell.mjs';
import { readCounters } from '../lib/counters.mjs';
import { backCaptures, captureText } from '../lib/capture-fixture.mjs';
import { firedLine, goodRows, markdown, signedRecord } from '../test-support/probe-fixture.mjs';
import { npmHost } from '../test-support/claude-host.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const RUN = join(HERE, 'run.mjs');
const PLUGIN = dirname(HERE);

function sha(text) {
  return createHash('sha256').update(text).digest('hex');
}

function setVersion(w, version) {
  const file = join(w.bin, 'claude');
  writeFileSync(file, `#!/bin/sh\necho "${version} (Claude Code)"\n`);
  chmodSync(file, 0o755);
}

function world({ version = '2.1.314', claudeMd } = {}) {
  const base = tempDir('cdp6-run-');
  const w = {
    base,
    home: join(base, 'home'),
    repo: join(base, 'repo'),
    bin: join(base, 'bin'),
    data: join(base, 'data'),
    session: 'sess-1',
    version,
  };
  mkdirSync(w.home);
  mkdirSync(w.repo);
  mkdirSync(w.bin);
  spawnSync('git', ['init', '-q', w.repo]);
  if (claudeMd !== undefined) writeFileSync(join(w.repo, 'CLAUDE.md'), claudeMd);
  writeFileSync(join(w.repo, 'intake.txt'), 'Build a thing that does X.\n');
  writeFileSync(join(w.repo, 'assignment.txt'), 'Objective: build a thing that does X, verbatim.\n');
  spawnSync('git', ['-C', w.repo, 'add', '-A']);
  spawnSync('git', ['-C', w.repo, '-c', 'user.name=t', '-c', 'user.email=t@t', 'commit', '-q', '-m', 'i']);
  setVersion(w, version);
  ensureHostKey({ HOME: w.home });
  writeSettings(w);
  return w;
}

function settingsRules(w) {
  const abs = (p) => `/${p}`;
  const rules = [];
  const add = (id, tool, spec) => rules.push({ id, tool, spec });
  add('edit:data', 'Edit', `${abs(w.data)}/**`);
  add('edit:plugin', 'Edit', `${abs(PLUGIN)}/**`);
  add('key:read', 'Read', '~/.config/cdp6-core/**');
  add('key:edit', 'Edit', '~/.config/cdp6-core/**');
  add('transcript:read', 'Read', '~/.claude/projects/**');
  return rules;
}

function writeSettings(w, { drop = [], dropSandbox = [], extra = {}, rules = [] } = {}) {
  const deny = [...settingsRules(w).filter((r) => !drop.includes(r.id)).map((r) => `${r.tool}(${r.spec})`), ...rules];
  const fs = { denyRead: ['~/.config/cdp6-core/', '~/.claude/projects/'], denyWrite: ['~/.config/cdp6-core/'] };
  for (const key of dropSandbox) fs[key.list] = fs[key.list].filter((e) => e !== key.entry);
  mkdirSync(join(w.home, '.claude'), { recursive: true });
  writeFileSync(join(w.home, '.claude', 'settings.json'), JSON.stringify({ permissions: { deny }, sandbox: { filesystem: fs, ...extra } }));
}

function argvFor(w, args, { session = w.session, data = w.data, extra = [], cwd = w.repo, token, tokenFor = {}, now } = {}) {
  const base = [...args, ...(session === null ? [] : ['--session-id', session]), ...(data === null ? [] : ['--data-dir', data]), ...extra];
  const { bare, expect: given } = stripAppended(base);
  let expect = given;
  if (!extra.includes('--expect-sha256')) {
    try {
      const parsed = parseCall(bare);
      expect = parsed.sub === 'init' || parsed.sub === 'probe' ? expectHashes(parsed, cwd).map((h) => h.sha256) : [];
    } catch {
      expect = [];
    }
  }
  const expectArgs = extra.includes('--expect-sha256') ? [] : expect.flatMap((h) => ['--expect-sha256', h]);
  if (token === null) return [...base, ...expectArgs];
  const fields = { sessionId: session ?? '', dataDir: data ?? '', tokens: bare, expect, ...tokenFor };
  const minted = token ?? mintToken(tokenFor.key ?? readHostKey({ HOME: w.home }), fields, now);
  return [...base, ...expectArgs, '--hook-token', minted];
}

function call(w, args, { env = {}, cwd = w.repo, script = RUN, node = [], timeout, host = w.version, ...rest } = {}) {
  const lead = host === null || node.length > 0 ? [...node, script] : [npmHost(w.base, host).cli, script];
  return spawnSync(process.execPath, [...lead, ...argvFor(w, args, { cwd, ...rest })], {
    cwd,
    timeout,
    encoding: 'utf8',
    env: { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home, ...env },
  });
}

function failure(r) {
  const line = r.stderr.trim().split('\n').filter(Boolean).at(-1) ?? '{}';
  try {
    return JSON.parse(line);
  } catch {
    return { error: 'unparsed', message: r.stderr };
  }
}

function initArgs(w, over = {}) {
  const base = {
    '--intake': join(w.repo, 'intake.txt'),
    '--kind': 'idea',
    '--origin': 'conversation',
    '--class': 'own',
    '--mode': 'single',
  };
  const merged = { ...base, ...over };
  return Object.entries(merged).flatMap(([k, v]) => (v === null ? [] : [k, v]));
}

function stateDir(w) {
  const active = JSON.parse(readFileSync(join(w.data, 'active-runs.json'), 'utf8'));
  return join(w.data, 'runs', active.sessions[w.session].run_id);
}

function readRunJson(S) {
  return JSON.parse(readFileSync(join(S, 'run.json'), 'utf8'));
}

function runDir(w) {
  return readRunJson(stateDir(w)).run_dir;
}

function walk(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '.git') continue;
    const full = join(dir, entry.name);
    out.push(full);
    if (entry.isDirectory()) walk(full, out);
  }
  return out.sort();
}

test('init creates the state directory with run.json, journal, ledger, counters and the copies, records R and prints it, and creates nothing in the project', () => {
  const w = world();
  const before = walk(w.repo);
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(walk(w.repo), before);
  assert.ok(existsSync(join(w.data, 'runs')), 'no state directory under the data directory');
  const S = stateDir(w);
  assert.equal(dirname(S), join(w.data, 'runs'));
  assert.match(S, /\/runs\/RUN-\d{8}-[a-z0-9-]+$/);
  const R = runDir(w);
  assert.equal(R, join(realpathSync(w.repo), 'docs', 'cdp6', 'runs', basename(S)));
  assert.equal(JSON.parse(r.stdout).R, R);
  assert.deepEqual(walk(w.repo), before);
  assert.ok(!existsSync(R));
  for (const name of ['run.json', 'run.journal.jsonl', 'ledger.md', 'counters.json']) assert.ok(existsSync(join(S, name)), name);
  const run = readRunJson(S);
  assert.equal(run.run_dir, R);
  assert.equal(run.root, realpathSync(w.repo));
  assert.equal(run.status, 'active');
  assert.equal(run.class, 'own');
  assert.equal(run.mode, 'single');
  assert.equal(run.intake.kind, 'idea');
  assert.equal(run.intake.origin, 'conversation');
  assert.equal(run.phases.idea.state, 'pending');
  assert.equal(run.autonomy.level, 'A0');
  assert.equal(run.autonomy.set, false);
  const assignment = readFileSync(join(S, 'idea', 'assignment.md'), 'utf8');
  assert.equal(run.assignment.sha256, sha(assignment));
  assert.match(readFileSync(join(S, 'idea', 'intake.md'), 'utf8'), /^kind: idea\norigin: conversation\ndate: \d{4}-\d\d-\d\d\n\nBuild a thing that does X\./);
  assert.equal(run.intake.sha256, sha(readFileSync(join(S, 'idea', 'intake.md'), 'utf8')));
  assert.ok(existsSync(join(S, 'ledger.md')));
  assert.ok(existsSync(join(S, 'counters.json')));
  const active = JSON.parse(readFileSync(join(w.data, 'active-runs.json'), 'utf8'));
  assert.equal(active.projects[realpathSync(w.repo)], basename(S));
  assert.equal(active.sessions[w.session].run_id, basename(S));
});

test('init refuses a second active run for the same project root', () => {
  const w = world();
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
  const r = call(w, ['init', ...initArgs(w)], { session: 'sess-2' });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'active-run-exists');
});

test('fires: unknown intake kind', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--kind': 'ticket' })]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'unknown-kind');
  for (const k of ['idea', 'feature-request', 'issue', 'bug-report']) assert.ok(f.message.includes(k), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')));
});

test('fires: intake as objective', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--kind': 'issue', '--origin': 'https://example.test/issues/1' })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'assignment-required');
  assert.ok(!existsSync(join(w.repo, 'docs')));
  const ok = call(w, ['init', ...initArgs(w, { '--kind': 'issue', '--origin': 'https://example.test/issues/1', '--http-status': '200', '--fetched': '2026-11-01', '--assignment': join(w.repo, 'assignment.txt') })]);
  assert.equal(ok.status, 0, ok.stderr);
});

test('fires: company repo path', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--class': 'company', '--root': join(w.repo, 'docs', 'records') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'company-run-in-repo');
  const ok = call(w, ['init', ...initArgs(w, { '--class': 'company' })]);
  assert.equal(ok.status, 0, ok.stderr);
  const R = runDir(w);
  assert.ok(R.startsWith(join(w.home, '.claude', 'projects')), R);
  assert.ok(R.includes(join('memory', 'cdp6', 'runs')), R);
  assert.ok(stateDir(w).startsWith(w.data), 'the state directory is not under the data directory');
});

test('fires: team without probes', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--mode': 'team' })]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'team-without-probes');
  assert.ok(f.message.includes('A-11') && f.message.includes('A-16'), f.message);
  assert.ok(f.message.includes('--mode multi'), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')));
});

test('fires: team refused in stage 1 even with an accepted record', () => {
  const w = world();
  const rows = { 'A-11': { passed: true }, 'A-16': { passed: true }, 'A-14': { passed: true } };
  signedRecord({ env: { HOME: w.home }, data: w.data, version: '2.1.314', rows });
  const r = call(w, ['init', ...initArgs(w, { '--mode': 'team' })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'team-not-built');
});

test('fires: unnamed record place', () => {
  const w = world({ claudeMd: '# Project\nNothing about records here.\n' });
  const r = call(w, ['init', ...initArgs(w, { '--root': 'docs/records' })]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'unnamed-record-place');
  assert.ok(f.message.includes('docs/records'), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')));
  writeFileSync(join(w.repo, 'CLAUDE.md'), '# Project\nRuns are kept in docs/records.\n');
  const ok = call(w, ['init', ...initArgs(w, { '--root': 'docs/records' })]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(runDir(w), /docs\/records\/RUN-/);
});

test('fires: below version floor', () => {
  const w = world({ version: '2.1.294' });
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'below-version-floor');
  assert.ok(f.message.includes('2.1.295'), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')));
  setVersion(w, '2.1.295');
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

test('fires: init without session id', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w)], { session: null });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'session-id-count');
  assert.ok(!existsSync(join(w.data, 'active-runs.json')));
});

test('fires: duplicate session id', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w)], { extra: ['--session-id', 'sess-evil'] });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'session-id-count');
  assert.ok(!existsSync(join(w.data, 'active-runs.json')));
});

test('fires: init binds pointer session of another live session', () => {
  const w = world();
  mkdirSync(join(w.home, '.cache', 'cdp5-agents'), { recursive: true });
  writeFileSync(join(w.home, '.cache', 'cdp5-agents', 'session'), 'sess-live-other\n');
  mkdirSync(join(w.home, '.cache', 'cdp6-core'), { recursive: true });
  writeFileSync(join(w.home, '.cache', 'cdp6-core', 'session'), 'sess-live-other\n');
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 0, r.stderr);
  const active = JSON.parse(readFileSync(join(w.data, 'active-runs.json'), 'utf8'));
  assert.deepEqual(Object.keys(active.sessions), ['sess-1']);
});

test('fires: data dir from pointer file', () => {
  const w = world();
  const forged = join(w.base, 'forged');
  mkdirSync(join(forged, 'probes'), { recursive: true });
  writeFileSync(join(forged, 'probes', '2.1.314.json'), JSON.stringify({ claude_version: '2.1.314', accepted: { sha256: 'a'.repeat(64) }, rows: { 'A-5': { passed: true } } }));
  mkdirSync(join(w.home, '.cache', 'cdp6-core'), { recursive: true });
  writeFileSync(join(w.home, '.cache', 'cdp6-core', 'data-dir'), `${forged}\n`);
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
  const noData = call(w, ['status'], { data: null });
  assert.equal(noData.status, 2);
  assert.equal(failure(noData).error, 'data-dir-count');
  const a3 = call(w, ['set-autonomy', 'A3', '--tokens', '1000', '--loops', '0']);
  assert.equal(a3.status, 2);
  assert.equal(failure(a3).error, 'a3-before-probe');
  assert.ok(!existsSync(join(w.data, 'probes')));
});

test('fires: intake from secret path', () => {
  const w = world();
  mkdirSync(join(w.home, '.ssh'));
  writeFileSync(join(w.home, '.ssh', 'id_rsa'), 'not a real key\n');
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.home, '.ssh', 'id_rsa') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'path-rule');
  assert.ok(failure(r).message.includes('secret'), failure(r).message);
  assert.ok(!existsSync(join(w.repo, 'docs')));
  writeFileSync(join(w.repo, '.env.local'), 'X=1\n');
  const env = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, '.env.local') })]);
  assert.equal(env.status, 2);
  assert.equal(failure(env).error, 'path-rule');
});

test('fires: assignment outside project', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--kind': 'issue', '--origin': 'x', '--assignment': '/etc/hosts' })]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'path-rule');
  assert.ok(f.message.includes('--assignment') && f.message.includes('outside'), f.message);
});

test('fires: intake of host key', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.home, '.config', 'cdp6-core', 'hook.key') })]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'path-rule');
  assert.ok(f.message.includes('host key'), f.message);
});

test('fires: intake hard link to host key', () => {
  const w = world();
  const key = join(w.home, '.config', 'cdp6-core', 'hook.key');
  linkSync(key, join(w.repo, 'linked.txt'));
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, 'linked.txt') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'file-hard-link');
  assert.ok(!existsSync(join(w.data, 'active-runs.json')));
  assert.ok(!existsSync(join(w.repo, 'docs')));
});

test('fires: intake that is a copy of the host key', () => {
  const w = world();
  const key = join(w.home, '.config', 'cdp6-core', 'hook.key');
  copyFileSync(key, join(w.repo, 'copy.txt'));
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, 'copy.txt') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'file-holds-key');
  assert.ok(!existsSync(join(w.data, 'active-runs.json')));
  assert.ok(!existsSync(join(w.repo, 'docs')));
  const keyBytes = readFileSync(key);
  assert.ok(!r.stdout.includes(keyBytes.toString('latin1')) && !r.stderr.includes(keyBytes.toString('latin1')), 'the host key reached the output');
});

test('fires: intake that is a FIFO does not block init', () => {
  const w = world();
  const fifo = join(w.repo, 'pipe.txt');
  assert.equal(spawnSync('mkfifo', [fifo]).status, 0);
  const r = call(w, ['init', ...initArgs(w, { '--intake': fifo })], { timeout: 8000 });
  assert.equal(r.status, 2, String(r.signal));
  assert.ok(failure(r).error.startsWith('file-'), r.stderr);
  assert.ok(!existsSync(join(w.data, 'active-runs.json')));
});

test('accepts usage log import', () => {
  const w = world();
  mkdirSync(w.data, { recursive: true });
  writeFileSync(join(w.data, 'usage-log.jsonl'), '{"a":1}\n');
  const r = call(w, ['init', ...initArgs(w, { '--start': 'loop-back' }), '--import', join(w.data, 'usage-log.jsonl')]);
  assert.equal(r.status, 0, r.stderr);
  const run = readRunJson(stateDir(w));
  assert.equal(run.phases.retro.state, 'imported');
  assert.equal(run.phases.retro.imports[0].sha256, sha('{"a":1}\n'));
  const w2 = world();
  mkdirSync(w2.data, { recursive: true });
  writeFileSync(join(w2.data, 'other.jsonl'), '{}\n');
  const refused = call(w2, ['init', ...initArgs(w2, { '--start': 'loop-back' }), '--import', join(w2.data, 'other.jsonl')]);
  assert.equal(refused.status, 2);
  assert.equal(failure(refused).error, 'path-rule');
});

test('resolves commit import', () => {
  const w = world();
  const head = spawnSync('git', ['-C', w.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  const r = call(w, ['init', ...initArgs(w, { '--start': 'verification' }), '--import', 'HEAD']);
  assert.equal(r.status, 0, r.stderr);
  const imp = readRunJson(stateDir(w)).phases.implementation.imports[0];
  assert.deepEqual({ kind: imp.kind, commit: imp.commit }, { kind: 'commit', commit: head });
  const w2 = world();
  const bad = call(w2, ['init', ...initArgs(w2, { '--start': 'verification' }), '--import', 'no-such-rev']);
  assert.equal(bad.status, 2);
  assert.equal(failure(bad).error, 'import-unresolved');
});

test('rejects flag=value forms and unknown subcommands', () => {
  const w = world();
  assert.equal(failure(call(w, ['init', '--mode=team'])).error, 'flag-form');
  assert.equal(failure(call(w, ['frobnicate'])).error, 'unknown-subcommand');
  assert.equal(failure(call(w, ['init', '--bogus', 'x'])).error, 'unknown-flag');
});

function guardLine(w, session = w.session) {
  mkdirSync(w.data, { recursive: true });
  const line = { hook: 'guard-phase.mjs', version: '0.1.0', at: new Date().toISOString(), session_id: session, tool_use_id: 't1', permission_mode: 'default', decision: 'allow' };
  writeFileSync(join(w.data, 'hooks-fired.jsonl'), `${JSON.stringify(line)}\n`, { flag: 'a' });
}

function probeFile(w, rows, name = 'docs/cdp6/probes/rec.md') {
  const file = join(w.repo, name);
  mkdirSync(dirname(file), { recursive: true });
  const text = markdown(rows ?? goodRows('2.1.314'));
  writeFileSync(file, text);
  return { file, text, name };
}

function acceptProbe(w, { rows, line = true, over = {} } = {}) {
  if (line) firedLine(w.data);
  const rec = probeFile(w, rows);
  return { ...rec, r: call(w, ['probe', '--accept', rec.name], over) };
}

function acceptedOk(w, opts) {
  const res = acceptProbe(w, opts);
  assert.equal(res.r.status, 0, res.r.stdout + res.r.stderr);
  return res;
}

function started(w, over) {
  const r = call(w, ['init', ...initArgs(w, over)]);
  assert.equal(r.status, 0, r.stderr);
  return stateDir(w);
}

test('fires: guard not observed', () => {
  const w = world();
  const S = started(w);
  const r = call(w, ['enter', 'idea']);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'guard-not-observed');
  assert.equal(readRunJson(S).phases.idea.state, 'pending');
  guardLine(w, 'sess-other');
  assert.equal(failure(call(w, ['enter', 'idea'])).error, 'guard-not-observed');
  writeFileSync(join(w.data, 'hooks-fired.jsonl'), 'not json\n', { flag: 'a' });
  guardLine(w);
  const ok = call(w, ['enter', 'idea']);
  assert.equal(ok.status, 0, ok.stderr);
  const phase = readRunJson(S).phases.idea;
  assert.equal(phase.state, 'entered');
  assert.match(phase.entered_at, /^\d{4}-\d\d-\d\dT/);
  assert.ok(!existsSync(runDir(w)), 'enter created the run directory');
});

test('fires: predecessor missing', () => {
  const w = world();
  const S = started(w);
  guardLine(w);
  const r = call(w, ['enter', 'exploration']);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'predecessor-missing');
  assert.equal(readRunJson(S).phases.exploration.state, 'pending');
});

test('enter refuses an unknown phase, a second entered phase and a halted run', () => {
  const w = world();
  started(w);
  guardLine(w);
  assert.equal(failure(call(w, ['enter', 'planning'])).error, 'unknown-phase');
  assert.equal(call(w, ['enter', 'idea']).status, 0);
  assert.equal(failure(call(w, ['enter', 'idea'])).error, 'phase-entered');
  const w2 = world();
  const S2 = started(w2);
  guardLine(w2);
  const run = readRunJson(S2);
  run.status = 'HALT-STOP';
  writeFileSync(join(S2, 'run.json'), JSON.stringify(run));
  const r = call(w2, ['enter', 'idea']);
  assert.equal(r.status, 2);
  assert.ok(['run-not-active', 'run-unreadable'].includes(failure(r).error), r.stderr);
});

test('status prints run id, phase state, next action and the ledger path', () => {
  const w = world();
  const S = started(w);
  let r = call(w, ['status']);
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^run: RUN-\d{8}-/m);
  assert.match(r.stdout, /^status: active$/m);
  assert.match(r.stdout, /^phase: none entered$/m);
  assert.match(r.stdout, /^next: run\.mjs enter idea$/m);
  assert.ok(r.stdout.includes(`ledger: ${join(S, 'ledger.md')}`));
  guardLine(w);
  call(w, ['enter', 'idea']);
  r = call(w, ['status']);
  assert.match(r.stdout, /^phase: idea entered$/m);
  assert.match(r.stdout, /^next: .*run\.mjs exit idea$/m);
  const none = call(w, ['status'], { session: 'sess-unbound', cwd: w.base });
  assert.equal(none.status, 2);
  assert.equal(failure(none).error, 'no-active-run');
});

test('fires: A3 before probe', () => {
  const w = world();
  const S = started(w);
  const a3 = () => call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0']);
  const r = call(w, ['set-autonomy', 'A3', '--tokens', '100000', '--loops', '1']);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'a3-before-probe');
  assert.equal(readRunJson(S).autonomy.set, false);
  const red = goodRows('2.1.314').map((row) => (row.row === 'A-5' && row.mode === 'auto' ? { ...row, verdict: 'no-prompt' } : row));
  acceptedOk(w, { rows: red });
  assert.equal(failure(a3()).error, 'a3-before-probe');
  acceptedOk(w, { line: false });
  assert.equal(a3().status, 0);
});

test('fires: probe record not accepted', () => {
  const w = world();
  started(w);
  const a3 = () => call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0']);
  probeFile(w, undefined, 'docs/cdp6/probes/2.1.314.md');
  assert.equal(failure(a3()).error, 'a3-before-probe');
  mkdirSync(join(w.data, 'probes'), { recursive: true });
  const hand = { claude_version: '2.1.314', rows: { 'A-5': { passed: true, modes: { default: { prompt: true }, auto: { prompt: true } } } } };
  writeFileSync(join(w.data, 'probes', '2.1.314.json'), JSON.stringify({ ...hand, accepted: { sha256: 'b'.repeat(64) } }));
  assert.equal(failure(a3()).error, 'a3-before-probe');
  writeFileSync(join(w.data, 'probes', '2.1.314.json'), JSON.stringify({ ...hand, accepted: { sha256: 'b'.repeat(64), mac: 'c'.repeat(64) } }));
  assert.equal(failure(a3()).error, 'a3-before-probe');
  assert.equal(readRunJson(stateDir(w)).autonomy.set, false);
});

test('fires: probe record not accepted when written before run.mjs init', () => {
  const w = world();
  probeFile(w, undefined, 'docs/cdp6/probes/2.1.314.md');
  mkdirSync(join(w.data, 'probes'), { recursive: true });
  const hand = { claude_version: '2.1.314', rows: { 'A-5': { passed: true, modes: { default: { prompt: true }, auto: { prompt: true } } } }, accepted: { sha256: 'b'.repeat(64), mac: 'c'.repeat(64) } };
  writeFileSync(join(w.data, 'probes', '2.1.314.json'), JSON.stringify(hand));
  const S = started(w);
  assert.equal(failure(call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0'])).error, 'a3-before-probe');
  assert.equal(readRunJson(S).autonomy.set, false);
});

test('probe --accept writes the record under the running version with a mac and the sha256 of the file, and opens A3', () => {
  const w = world();
  started(w);
  const res = acceptedOk(w);
  const out = JSON.parse(res.r.stdout);
  assert.equal(out.ok, true);
  assert.equal(out.file, join(w.data, 'probes', '2.1.314.json'));
  const rec = JSON.parse(readFileSync(out.file, 'utf8'));
  assert.equal(rec.accepted.sha256, sha(res.text));
  assert.match(rec.accepted.mac, /^[0-9a-f]{64}$/);
  assert.deepEqual(Object.keys(rec.rows).sort(), ['A-12', 'A-23', 'A-5']);
  assert.equal(call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0']).status, 0);
});

test('probe --accept with an active run writes the stamped owner record into run.json, and without a run only the record is written', () => {
  const w = world();
  const S = started(w);
  const before = Date.now();
  const res = acceptedOk(w);
  const rec = JSON.parse(readFileSync(join(w.data, 'probes', '2.1.314.json'), 'utf8'));
  assert.equal(rec.accepted.by, 'owner');
  const owned = readRunJson(S).owner_records.filter((o) => o.kind === 'probe-accept');
  assert.equal(owned.length, 1);
  assert.equal(owned[0].decider, 'owner');
  assert.equal(owned[0].sha256, sha(res.text));
  assert.equal(owned[0].version, '2.1.314');
  assert.ok(Date.parse(owned[0].at) >= before - 1000);
  const bare = world();
  acceptedOk(bare);
  assert.equal(JSON.parse(readFileSync(join(bare.data, 'probes', '2.1.314.json'), 'utf8')).accepted.by, 'owner');
  assert.ok(!existsSync(join(bare.data, 'runs')));
});

test('fires: probe record changed after ask', () => {
  const w = world();
  firedLine(w.data);
  const first = probeFile(w);
  writeFileSync(first.file, `${first.text}\nchanged after the ask\n`);
  const r = call(w, ['probe', '--accept', first.name], { extra: ['--expect-sha256', sha(first.text)] });
  assert.equal(r.status, 2, r.stdout);
  assert.equal(failure(r).error, 'expect-sha256-mismatch');
  assert.ok(!existsSync(join(w.data, 'probes')));
});

test('fires: probe accept refusals of the checker reach run.mjs with their own code and write nothing', () => {
  const cases = [
    ['record-version', { rows: goodRows('2.1.318') }],
    ['a23-hook-line-missing', { line: false }],
    ['a23-auto-missing', { rows: goodRows('2.1.314').filter((row) => !(row.row === 'A-23' && row.mode === 'auto')) }],
    ['row-settings-sha256', { rows: goodRows('2.1.314').map((row) => (row.row === 'A-12' ? { ...row, settings_sha256: '' } : row)) }],
  ];
  for (const [code, opts] of cases) {
    const w = world();
    const res = acceptProbe(w, opts);
    assert.equal(res.r.status, 2, res.r.stdout);
    assert.equal(failure(res.r).error, code);
    assert.ok(!existsSync(join(w.data, 'probes')), code);
  }
});

test('fires: probe accept without --accept, with a file outside the project root, or with a missing file', () => {
  const w = world();
  firedLine(w.data);
  assert.equal(failure(call(w, ['probe'])).error, 'missing-flag');
  const outside = join(w.base, 'outside.md');
  writeFileSync(outside, markdown(goodRows('2.1.314')));
  assert.equal(failure(call(w, ['probe', '--accept', outside])).error, 'path-rule');
  assert.equal(failure(call(w, ['probe', '--accept', 'docs/cdp6/probes/none.md'], { extra: ['--expect-sha256', 'a'.repeat(64)] })).error, 'file-missing');
  assert.ok(!existsSync(join(w.data, 'probes')));
});

test('fires: probe accept without the hook token or with a token for other tokens', () => {
  const w = world();
  firedLine(w.data);
  const rec = probeFile(w);
  const none = call(w, ['probe', '--accept', rec.name], { token: null });
  assert.equal(none.status, 2);
  assert.equal(failure(none).error, 'hook-token-count');
  const other = call(w, ['probe', '--accept', rec.name], { tokenFor: { tokens: ['probe', '--accept', 'docs/cdp6/probes/other.md'] } });
  assert.equal(failure(other).error, 'hook-token-mac');
  assert.ok(!existsSync(join(w.data, 'probes')));
});

test('set-autonomy records level and budgets as an owner record and validates its arguments', () => {
  const w = world();
  const S = started(w);
  assert.equal(failure(call(w, ['set-autonomy', 'A9', '--tokens', '1', '--loops', '0'])).error, 'unknown-level');
  assert.equal(failure(call(w, ['set-autonomy', 'A1', '--loops', '0'])).error, 'missing-flag');
  assert.equal(failure(call(w, ['set-autonomy', 'A1', '--tokens', '-4', '--loops', '0'])).error, 'bad-budget');
  assert.equal(failure(call(w, ['set-autonomy', 'A1', '--tokens', 'lots', '--loops', '0'])).error, 'bad-budget');
  const r = call(w, ['set-autonomy', 'A1', '--tokens', '50000', '--loops', '2']);
  assert.equal(r.status, 0, r.stderr);
  const run = readRunJson(S);
  assert.deepEqual({ level: run.autonomy.level, tokens: run.autonomy.tokens, loops: run.autonomy.loops, set: run.autonomy.set }, { level: 'A1', tokens: 50000, loops: 2, set: true });
  const rec = run.owner_records.find((o) => o.kind === 'set-autonomy');
  assert.equal(rec.decider, 'owner');
  assert.match(rec.at, /^\d{4}-\d\d-\d\dT/);
});

test('records owner objection', () => {
  const w = world();
  const S = started(w);
  indexWith(S, [{ id: 'D-3-devils-advocate-a1', objections: ['F-P3-2'], premises: [] }]);
  const id = 'D-3-devils-advocate-a1:F-P3-2';
  const r = call(w, ['object', id, 'accept', '--why', 'the risk is acceptable']);
  assert.equal(r.status, 0, r.stderr);
  const rec = readRunJson(S).owner_records.find((o) => o.kind === 'object');
  assert.deepEqual({ id: rec.id, verdict: rec.verdict, why: rec.why, decider: rec.decider }, { id, verdict: 'accept', why: 'the risk is acceptable', decider: 'owner' });
  assert.match(rec.at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(failure(call(w, ['object', id, 'reject', '--why', 'again'])).error, 'objection-recorded');
  assert.equal(failure(call(w, ['object', 'X-1', 'accept', '--why', 'x'])).error, 'bad-objection-id');
  assert.equal(failure(call(w, ['object', id, 'maybe', '--why', 'x'])).error, 'bad-verdict');
  assert.equal(failure(call(w, ['object', id, 'accept'])).error, 'missing-flag');
  assert.equal(failure(call(w, ['object', id, 'accept', '--why', '  '])).error, 'missing-flag');
});

test('fires: a bare objection id is refused and an objection id names an item on an index line of the run', () => {
  const w = world();
  const S = started(w);
  indexWith(S, [{ id: 'D-1-devils-advocate-a1', objections: ['F-P1-1'], premises: [] }, { id: 'D-2-devils-advocate-a2', objections: ['F-P1-1', 'F-P2-1'], premises: [] }]);
  assert.equal(failure(call(w, ['object', 'F-P1-1', 'accept', '--why', 'x'])).error, 'bad-objection-id');
  assert.equal(failure(call(w, ['object', 'D-1-devils-advocate-a1:F-P2-1', 'accept', '--why', 'x'])).error, 'unknown-objection');
  assert.equal(failure(call(w, ['object', 'D-9-devils-advocate-a9:F-P1-1', 'accept', '--why', 'x'])).error, 'unknown-objection');
  assert.deepEqual(readRunJson(S).owner_records.filter((o) => o.kind === 'object'), []);
  assert.equal(call(w, ['object', 'D-1-devils-advocate-a1:F-P1-1', 'accept', '--why', 'x']).status, 0);
  assert.equal(call(w, ['object', 'D-2-devils-advocate-a2:F-P1-1', 'reject', '--why', 'y']).status, 0);
  assert.deepEqual(readRunJson(S).owner_records.filter((o) => o.kind === 'object').map((o) => [o.id, o.verdict]), [['D-1-devils-advocate-a1:F-P1-1', 'accept'], ['D-2-devils-advocate-a2:F-P1-1', 'reject']]);
  const none = world();
  started(none);
  assert.equal(failure(call(none, ['object', 'D-1-devils-advocate-a1:F-P1-1', 'accept', '--why', 'x'])).error, 'unknown-objection');
});

function indexWith(S, lines) {
  mkdirSync(join(S, 'verdicts'), { recursive: true });
  writeFileSync(join(S, 'verdicts', 'index.jsonl'), lines.map((l) => JSON.stringify(l)).join('\n') + '\n');
}

test('object records a premise id that names a premise on an index line of the run, once', () => {
  const w = world();
  const S = started(w);
  indexWith(S, [{ id: 'D-1-devils-advocate-agent-7', premises: ['D-1-devils-advocate-agent-7:premise-1', 'D-1-devils-advocate-agent-7:premise-2'], objections: ['F-P1-1'] }, { id: 'D-2-devils-advocate-agent-8', premises: [], objections: [] }]);
  const r = call(w, ['object', 'D-1-devils-advocate-agent-7:premise-2', 'accept', '--why', 'the premise holds']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { id: 'D-1-devils-advocate-agent-7:premise-2', verdict: 'accept' });
  const rec = readRunJson(S).owner_records.find((o) => o.kind === 'object');
  assert.deepEqual({ id: rec.id, verdict: rec.verdict, why: rec.why, decider: rec.decider }, { id: 'D-1-devils-advocate-agent-7:premise-2', verdict: 'accept', why: 'the premise holds', decider: 'owner' });
  assert.equal(failure(call(w, ['object', 'D-1-devils-advocate-agent-7:premise-2', 'reject', '--why', 'again'])).error, 'objection-recorded');
  assert.equal(readRunJson(S).owner_records.filter((o) => o.kind === 'object').length, 1);
  assert.equal(call(w, ['object', 'D-1-devils-advocate-agent-7:F-P1-1', 'accept', '--why', 'ok']).status, 0);
});

test('fires: a premise id that names no index line, or a capture id with characters outside the set, is refused and nothing is recorded', () => {
  const w = world();
  const S = started(w);
  indexWith(S, [{ id: 'D-1-devils-advocate-agent-7', premises: ['D-1-devils-advocate-agent-7:premise-1'], objections: [] }]);
  const refused = [
    ['D-1-devils-advocate-agent-7:premise-2', 'unknown-premise'],
    ['D-9-devils-advocate-agent-7:premise-1', 'unknown-premise'],
    ['D-1-devils-advocate-agent-7:premise-0', 'unknown-premise'],
    ['D-1-devils-advocate-agent-7:premise-', 'bad-objection-id'],
    ['D-1-devils-advocate-agent-7:premise-x', 'bad-objection-id'],
    [':premise-1', 'bad-objection-id'],
    ['a/b:premise-1', 'bad-objection-id'],
    ['../x:premise-1', 'bad-objection-id'],
    ['a b:premise-1', 'bad-objection-id'],
    ['a$b:premise-1', 'bad-objection-id'],
    ['a:b:premise-1', 'bad-objection-id'],
    ['X-1', 'bad-objection-id'],
    ['F-P1-1', 'bad-objection-id'],
    ['D-1-devils-advocate-agent-7:F-P2-1', 'unknown-objection'],
  ];
  for (const [id, error] of refused) {
    const r = call(w, ['object', id, 'accept', '--why', 'x']);
    assert.notEqual(r.status, 0, id);
    assert.equal(failure(r).error, error, id);
  }
  assert.deepEqual(readRunJson(S).owner_records.filter((o) => o.kind === 'object'), []);
  const none = world();
  const S2 = started(none);
  assert.equal(failure(call(none, ['object', 'D-1-devils-advocate-agent-7:premise-1', 'accept', '--why', 'x'])).error, 'unknown-premise');
  mkdirSync(join(S2, 'verdicts'), { recursive: true });
  writeFileSync(join(S2, 'verdicts', 'index.jsonl'), 'not json\n');
  assert.equal(failure(call(none, ['object', 'D-1-devils-advocate-agent-7:premise-1', 'accept', '--why', 'x'])).error, 'index-unreadable');
  assert.deepEqual(readRunJson(S2).owner_records.filter((o) => o.kind === 'object'), []);
});

test('fires: object accepts <capture id>:conflict only for a conflicted capture on an index line that lists no item, and refuses it otherwise with its own code', () => {
  const w = world();
  const S = started(w);
  indexWith(S, [
    { id: 'D-1-devils-advocate-a1', conflicted: true, objections: [], premises: [] },
    { id: 'D-2-devils-advocate-a2', conflicted: false, objections: [], premises: [] },
    { id: 'D-3-devils-advocate-a3', conflicted: true, objections: ['F-P1-1'], premises: [] },
    { id: 'D-4-devils-advocate-a4', conflicted: true, objections: [], premises: ['D-4-devils-advocate-a4:premise-1'] },
  ]);
  for (const id of ['D-2-devils-advocate-a2:conflict', 'D-3-devils-advocate-a3:conflict', 'D-4-devils-advocate-a4:conflict', 'D-9-devils-advocate-a9:conflict']) {
    const r = call(w, ['object', id, 'accept', '--why', 'x']);
    assert.notEqual(r.status, 0, id);
    assert.equal(failure(r).error, 'unknown-conflict', id);
  }
  assert.equal(failure(call(w, ['object', ':conflict', 'accept', '--why', 'x'])).error, 'bad-objection-id');
  assert.deepEqual(readRunJson(S).owner_records.filter((o) => o.kind === 'object'), []);
  const r = call(w, ['object', 'D-1-devils-advocate-a1:conflict', 'reject', '--why', 'the stake is not acceptable']);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(JSON.parse(r.stdout), { id: 'D-1-devils-advocate-a1:conflict', verdict: 'reject' });
  assert.equal(failure(call(w, ['object', 'D-1-devils-advocate-a1:conflict', 'accept', '--why', 'again'])).error, 'objection-recorded');
});

test('id allocates ascending ids per kind and refuses an unknown kind', () => {
  const w = world();
  started(w);
  assert.equal(JSON.parse(call(w, ['id', 'D']).stdout).id, 'D-1');
  assert.equal(JSON.parse(call(w, ['id', 'D']).stdout).id, 'D-2');
  assert.equal(JSON.parse(call(w, ['id', 'I']).stdout).id, 'I-1');
  assert.equal(failure(call(w, ['id', 'ZZ'])).error, 'unknown-kind');
});

test('decision stamps status changes with a program-written time', () => {
  const w = world();
  const S = started(w);
  assert.equal(failure(call(w, ['decision', 'D-1', 'proposed'])).error, 'unallocated-id');
  call(w, ['id', 'D']);
  assert.equal(call(w, ['decision', 'D-1', 'proposed']).status, 0);
  assert.equal(call(w, ['decision', 'D-1', 'decided', '--decider', 'owner']).status, 0);
  const d = readRunJson(S).decisions['D-1'];
  assert.equal(d.status, 'decided');
  assert.equal(d.decider, 'owner');
  assert.deepEqual(d.stamps.map((s) => s.status), ['proposed', 'decided']);
  assert.ok(d.stamps.every((s) => /^\d{4}-\d\d-\d\dT/.test(s.at)));
  assert.equal(readRunJson(S).owner_records.filter((o) => o.kind === 'decision').length, 1);
  assert.equal(failure(call(w, ['decision', 'D-1', 'proposed'])).error, 'bad-transition');
  assert.equal(failure(call(w, ['decision', 'D-1', 'vetoed'])).error, 'bad-status');
  assert.equal(call(w, ['decision', 'D-1', 'superseded']).status, 0);
});

test('decision defaults the decider to the executor role of the mode', () => {
  const w = world();
  const S = started(w);
  call(w, ['id', 'D']);
  call(w, ['decision', 'D-1', 'proposed']);
  call(w, ['decision', 'D-1', 'decided']);
  const run = readRunJson(S);
  assert.equal(run.decisions['D-1'].decider, 'operator');
  assert.equal(run.owner_records.filter((o) => o.kind === 'decision').length, 0);
  assert.equal(failure(call(w, ['decision', 'D-1', 'decided', '--decider', 'a$b'])).error, 'bad-decider');
});

test('approve of a slice id is refused before slices exist', () => {
  const w = world();
  started(w);
  assert.equal(failure(call(w, ['approve', 'S-1'])).error, 'unknown-slice');
  assert.equal(failure(call(w, ['approve', 'idea'])).error, 'phase-not-pending-approval');
});

test('init leaves a counters.json that lib/counters.mjs reads, and run.mjs does not write that file itself', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 0, r.stderr);
  const S = stateDir(w);
  assert.equal(readCounters(S).version, 1);
  assert.deepEqual(readCounters(S).pending, {});
  assert.equal(statSync(join(S, 'counters.json')).mode & 0o777, 0o600);
  assert.ok(!/counters\.json/.test(readFileSync(RUN, 'utf8')), 'run.mjs names counters.json');
});

const IDEA_SECTIONS = ['Assignment', 'Problem', 'Goals', 'Non-goals', 'Constraints', 'Success measures', 'Decisions', 'Approach options'];

function writeIdea(R, skip = []) {
  const body = IDEA_SECTIONS.filter((s) => !skip.includes(s)).map((s) => `## ${s}\n\n- ${s} content\n`).join('\n');
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), `# Idea\n\n${body}`);
}

function readyToExit(w, { level = 'A1', skip = [], captureLate = false, captureOver = null, decide = true } = {}) {
  const S = started(w);
  guardLine(w);
  assert.equal(call(w, ['enter', 'idea']).status, 0);
  if (level) assert.equal(call(w, ['set-autonomy', level, '--tokens', '1000', '--loops', '0']).status, 0);
  call(w, ['id', 'D']);
  call(w, ['decision', 'D-1', 'proposed']);
  writeIdea(readRunJson(S).run_dir, skip);
  const target = { path: 'idea/idea.md', sha256: sha(readFileSync(join(readRunJson(S).run_dir, 'idea', 'idea.md'), 'utf8')) };
  const capture = { id: 'D-1-devils-advocate-agent-7', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', decision: 'D-1', verdict: 'a', objections: [], targets: [target], stamp: new Date(Date.now() + (captureLate ? 600000 : -2000)).toISOString(), ...captureOver };
  if (captureOver !== false) backCaptures(S, [capture]);
  if (decide) assert.equal(call(w, ['decision', 'D-1', 'decided', '--decider', 'owner']).status, 0);
  return S;
}

function pluginCopy(w) {
  const copy = join(w.base, 'plugin-copy');
  cpSync(PLUGIN, copy, { recursive: true });
  return { copy, script: join(copy, 'scripts', 'run.mjs') };
}

test('fires: checker missing', () => {
  const w = world();
  const S = readyToExit(w);
  const { copy, script } = pluginCopy(w);
  rmSync(join(copy, 'checks', 'idea-check.mjs'));
  const r = call(w, ['exit', 'idea'], { script });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'checker-missing');
  const idea = readRunJson(S).phases.idea;
  assert.equal(idea.state, 'gate-pending');
  assert.equal(idea.gate.result, 'checker-missing');
  assert.equal(idea.gate.passed, false);
  assert.equal(idea.gate.reconciliation, 'not built');
  assert.ok(readFileSync(join(S, 'run.journal.jsonl'), 'utf8').includes('exit:idea:checker-missing'));
  assert.ok(existsSync(join(PLUGIN, 'checks', 'idea-check.mjs')));
});

function flipChecker(copy, autonomy) {
  writeFileSync(join(copy, 'checks', 'idea-check.mjs'), `import { updateRun } from '../lib/run-store.mjs';
const i = process.argv.indexOf('--run-dir');
updateRun(process.argv[i + 1], 'test-flip', (r) => { r.autonomy = ${JSON.stringify(autonomy)}; });
process.stdout.write('idea-check OK\\n');
`);
}

test('fires: exit decides on the autonomy record read inside the locked update', () => {
  const unset = world();
  const S1 = readyToExit(unset, { level: null });
  const one = pluginCopy(unset);
  flipChecker(one.copy, { level: 'A1', tokens: 5, loops: 0, set: true });
  const r1 = call(unset, ['exit', 'idea'], { script: one.script });
  assert.equal(r1.status, 0, r1.stdout + r1.stderr);
  assert.equal(readRunJson(S1).phases.idea.state, 'exited');
  const gated = world();
  const S2 = readyToExit(gated, { level: 'A1' });
  const two = pluginCopy(gated);
  flipChecker(two.copy, { level: 'A0', tokens: 5, loops: 0, set: true });
  const r2 = call(gated, ['exit', 'idea'], { script: two.script });
  assert.equal(r2.status, 0, r2.stdout + r2.stderr);
  assert.equal(readRunJson(S2).phases.idea.state, 'gate-pending');
  assert.equal(JSON.parse(r2.stdout).awaiting, 'approve');
});

test('fires: checker error keeps the phase gate-pending', () => {
  const w = world();
  const S = readyToExit(w);
  const { copy, script } = pluginCopy(w);
  writeFileSync(join(copy, 'checks', 'idea-check.mjs'), 'process.exit(3);\n');
  const r = call(w, ['exit', 'idea'], { script });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'checker-error');
  assert.equal(readRunJson(S).phases.idea.state, 'gate-pending');
});

test('fires: exit idea without non-goals', () => {
  const w = world();
  const S = readyToExit(w, { skip: ['Non-goals'] });
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /Non-goals/);
  const phase = readRunJson(S).phases.idea;
  assert.equal(phase.state, 'entered');
  assert.equal(phase.gate.passed, false);
  assert.equal(phase.gate.reconciliation, 'not built');
  assert.equal(phase.gate.checkers[0].name, 'idea-check');
  assert.equal(phase.gate.checkers[0].exit, 1);
});

test('fires: a devils-advocate capture whose target changed since the brief makes exit idea fail as stale, one with the current hash passes', () => {
  const w = world();
  const S = readyToExit(w, { captureOver: false });
  const R = readRunJson(S).run_dir;
  const current = sha(readFileSync(join(R, 'idea', 'idea.md'), 'utf8'));
  const line = (hash) => ({ id: 'D-1-devils-advocate-agent-7', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', decision: 'D-1', verdict: 'a', objections: [], premises: [], conflicted: false, validator: 'valid', stamp: new Date(Date.now() - 2000).toISOString(), targets: [{ path: 'idea/idea.md', sha256: hash }] });
  backCaptures(S, [line('0'.repeat(64))]);
  const stale = call(w, ['exit', 'idea']);
  assert.equal(stale.status, 1, stale.stdout + stale.stderr);
  assert.match(stale.stdout, /decision-check FAIL D-1: every devils-advocate capture is stale/);
  assert.equal(readRunJson(S).phases.idea.state, 'entered');
  backCaptures(S, [line(current)]);
  const fresh = call(w, ['exit', 'idea']);
  assert.equal(fresh.status, 0, fresh.stdout + fresh.stderr);
});

test('fires: exit idea through a plugin copy under a path with a space gets the checkers real result', () => {
  const w = world();
  const S = readyToExit(w, { skip: ['Non-goals'] });
  const copy = join(w.base, 'plugin copy');
  cpSync(PLUGIN, copy, { recursive: true });
  const r = call(w, ['exit', 'idea'], { script: join(copy, 'scripts', 'run.mjs') });
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /Non-goals/);
  assert.equal(readRunJson(S).phases.idea.gate.checkers[0].exit, 1);
});

test('fires: the checkers started through a symlink and through a space path report their findings', () => {
  const w = world();
  const S = readyToExit(w, { skip: ['Non-goals'] });
  const copy = join(w.base, 'plugin copy');
  cpSync(PLUGIN, copy, { recursive: true });
  const link = join(w.base, 'plugin-link');
  symlinkSync(copy, link);
  const snapshot = join(w.base, 'snapshot');
  cpSync(join(readRunJson(S).run_dir, 'idea'), join(snapshot, 'idea'), { recursive: true });
  for (const root of [copy, link]) {
    const idea = spawnSync(process.execPath, [join(root, 'checks', 'idea-check.mjs'), '--run-dir', S, '--snapshot', snapshot], { encoding: 'utf8' });
    assert.equal(idea.status, 1, root + idea.stdout + idea.stderr);
    assert.match(idea.stdout, /Non-goals/);
    const decision = spawnSync(process.execPath, [join(root, 'checks', 'decision-check.mjs'), '--run-dir', join(w.base, 'missing-run')], { encoding: 'utf8' });
    assert.equal(decision.status, 2, root + decision.stdout + decision.stderr);
  }
});

test('fires: verdict missing', () => {
  const w = world();
  const S = readyToExit(w, { captureOver: false });
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  assert.match(r.stdout, /decision-check FAIL D-1: no devils-advocate capture/);
  const idea = readRunJson(S).phases.idea;
  assert.equal(idea.state, 'entered');
  assert.equal(idea.gate.passed, false);
});

test('fires: verdict missing when the capture is of another role, of another decision, decides none or is not a pass', () => {
  for (const captureOver of [{ agent_type: 'cdp6-core:review-verify' }, { decision: 'D-2' }, { decision: null }, { verdict: null, validator: 'not-built' }, { verdict: 'not-decidable' }]) {
    const w = world();
    const S = readyToExit(w, { captureOver });
    const r = call(w, ['exit', 'idea']);
    assert.equal(r.status, 1, JSON.stringify(captureOver) + r.stdout + r.stderr);
    assert.match(r.stdout, /decision-check FAIL D-1/, JSON.stringify(captureOver));
    assert.equal(readRunJson(S).phases.idea.state, 'entered');
  }
});

test('fires: verdict missing when the verdict index is not readable', () => {
  const w = world();
  const S = readyToExit(w);
  writeFileSync(join(S, 'verdicts', 'index.jsonl'), 'not json\n');
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(failure(r).error, 'checker-error');
  assert.equal(readRunJson(S).phases.idea.state, 'gate-pending');
});

test('fires: exit idea with a decision before its counter-role', () => {
  const w = world();
  readyToExit(w, { captureLate: true });
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /decision-check FAIL D-1/);
});

test('fires: exit idea without autonomy set by the owner', () => {
  const w = world();
  const S = readyToExit(w, { level: null });
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /autonomy/);
  assert.equal(readRunJson(S).phases.idea.state, 'entered');
});

test('exit idea at A1 records the exit, the gate result and the artefact hashes', () => {
  const w = world();
  const S = readyToExit(w);
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const phase = readRunJson(S).phases.idea;
  assert.equal(phase.state, 'exited');
  assert.match(phase.exited_at, /^\d{4}-\d\d-\d\dT/);
  assert.equal(phase.gate.passed, true);
  assert.equal(phase.gate.reconciliation, 'not built');
  assert.deepEqual(phase.gate.checkers.map((c) => [c.name, c.exit]), [['idea-check', 0], ['decision-check', 0]]);
  assert.ok(phase.gate.checkers.every((c) => /^[0-9a-f]{64}$/.test(c.output_sha256) && c.version === '0.1.0'));
  const idea = phase.artefacts.find((a) => a.path === 'idea/idea.md');
  assert.equal(idea.sha256, sha(readFileSync(join(runDir(w), 'idea', 'idea.md'), 'utf8')));
  assert.deepEqual(phase.artefacts.map((a) => a.path), ['idea/idea.md']);
  const next = call(w, ['status']);
  assert.match(next.stdout, /^next: run\.mjs enter exploration$/m);
});

test('exit idea at A0 waits for approve, approve exits the phase and refuses drift', () => {
  const w = world();
  const S = readyToExit(w, { level: 'A0' });
  assert.equal(failure(call(w, ['approve', 'idea'])).error, 'phase-not-pending-approval');
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).awaiting, 'approve');
  assert.equal(readRunJson(S).phases.idea.state, 'gate-pending');
  assert.match(call(w, ['status']).stdout, /^next: run\.mjs approve idea \(owner\)$/m);
  writeFileSync(join(runDir(w), 'idea', 'idea.md'), '# changed after the gate\n');
  const drift = call(w, ['approve', 'idea']);
  assert.equal(drift.status, 2);
  assert.equal(failure(drift).error, 'artefact-drift');
  writeIdea(runDir(w));
  const ok = call(w, ['approve', 'idea']);
  assert.equal(ok.status, 0, ok.stderr);
  const run = readRunJson(S);
  assert.equal(run.phases.idea.state, 'exited');
  const rec = run.owner_records.find((o) => o.kind === 'approve');
  assert.deepEqual({ target: rec.target, decider: rec.decider }, { target: 'idea', decider: 'owner' });
});

test('exit refuses a phase that is not entered', () => {
  const w = world();
  started(w);
  assert.equal(failure(call(w, ['exit', 'idea'])).error, 'phase-not-entered');
  assert.equal(failure(call(w, ['exit', 'planning'])).error, 'unknown-phase');
  assert.equal(failure(call(w, ['exit', 'exploration'])).error, 'phase-not-entered');
});

test('fires: exit refuses a run record whose cycle is not a positive integer and touches no snapshot directory', () => {
  for (const cycle of ['../../x', 0, -1, 1.5, '1']) {
    const w = world();
    const S = readyToExit(w);
    const run = readRunJson(S);
    run.phases.idea.cycle = cycle;
    writeFileSync(join(S, 'run.json'), JSON.stringify(run));
    const victim = join(S, 'snapshots', 'x');
    mkdirSync(victim, { recursive: true });
    writeFileSync(join(victim, 'keep.txt'), 'keep');
    const r = call(w, ['exit', 'idea']);
    assert.equal(r.status, 2, `${cycle}: ${r.stdout}${r.stderr}`);
    assert.equal(failure(r).error, 'state-corrupt', String(cycle));
    assert.equal(readFileSync(join(victim, 'keep.txt'), 'utf8'), 'keep');
    assert.ok(!existsSync(join(S, 'snapshots', 'idea')), String(cycle));
  }
});

test('exit for a phase without registered checkers is a missing checker', () => {
  const w = world();
  const S = started(w);
  guardLine(w);
  const run = readRunJson(S);
  run.phases.idea.state = 'exited';
  writeFileSync(join(S, 'run.json'), JSON.stringify(run));
  assert.equal(call(w, ['enter', 'exploration']).status, 0);
  const r = call(w, ['exit', 'exploration']);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'checker-missing');
  const exploration = readRunJson(S).phases.exploration;
  assert.equal(exploration.state, 'gate-pending');
  assert.equal(exploration.gate.result, 'checker-missing');
});

test('concurrent run.mjs id calls return different ids', async () => {
  const w = world();
  started(w);
  const env = { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home };
  const one = () => new Promise((resolve) => {
    const p = spawn(process.execPath, [RUN, ...argvFor(w, ['id', 'D'])], { cwd: w.repo, env });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, err, id: JSON.parse(out || '{}').id }));
  });
  const results = await Promise.all([one(), one(), one(), one(), one(), one()]);
  assert.ok(results.every((r) => r.code === 0), JSON.stringify(results));
  assert.equal(new Set(results.map((r) => r.id)).size, 6);
});

test('A1 intake records the origin with its date and the fetch status', () => {
  const w = world();
  const today = new Date().toISOString().slice(0, 10);
  const S = started(w);
  const text = readFileSync(join(S, 'idea', 'intake.md'), 'utf8');
  assert.match(text, new RegExp(`^kind: idea\\norigin: conversation\\ndate: ${today}\\n\\n`));
  const url = world();
  const urlArgs = (over = {}) => initArgs(url, { '--kind': 'issue', '--origin': 'https://example.test/issues/1', '--assignment': join(url.repo, 'assignment.txt'), ...over });
  const noStatus = call(url, ['init', ...urlArgs({ '--fetched': '2026-11-01' })]);
  assert.equal(noStatus.status, 2);
  assert.equal(failure(noStatus).error, 'origin-status-missing');
  const noFetched = call(url, ['init', ...urlArgs({ '--http-status': '200' })]);
  assert.equal(noFetched.status, 2);
  assert.equal(failure(noFetched).error, 'origin-fetched-missing');
  for (const bad of ['yesterday', '2026-13-01', '2026-02-30', '20261101']) {
    const r = call(url, ['init', ...urlArgs({ '--http-status': '200', '--fetched': bad })]);
    assert.equal(failure(r).error, 'origin-fetched-missing', bad);
  }
  assert.ok(!existsSync(join(url.repo, 'docs')), 'a run directory was created');
  const ok = call(url, ['init', ...urlArgs({ '--http-status': '200', '--fetched': '2026-11-01' })]);
  assert.equal(ok.status, 0, ok.stderr);
  assert.match(readFileSync(join(stateDir(url), 'idea', 'intake.md'), 'utf8'), /^kind: issue\norigin: https:\/\/example\.test\/issues\/1\nfetched: 2026-11-01\nhttp_status: 200\n\n/);
  const tracker = world();
  const t = call(tracker, ['init', ...initArgs(tracker, { '--kind': 'issue', '--origin': 'GH-12', '--assignment': join(tracker.repo, 'assignment.txt') })]);
  assert.equal(t.status, 0, t.stderr);
  assert.match(readFileSync(join(stateDir(tracker), 'idea', 'intake.md'), 'utf8'), /^kind: issue\norigin: GH-12\ndate: /);
});

test('A1 the intake-as-assignment shortcut keys on the origin kind conversation', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w, { '--origin': 'conversation 2026-11-02' })]);
  assert.equal(r.status, 0, r.stderr);
  const S = stateDir(w);
  assert.match(readFileSync(join(S, 'idea', 'intake.md'), 'utf8'), /^kind: idea\norigin: conversation 2026-11-02\n/);
  assert.equal(readFileSync(join(S, 'idea', 'assignment.md'), 'utf8'), 'Build a thing that does X.\n');
  const w2 = world();
  const other = call(w2, ['init', ...initArgs(w2, { '--origin': 'conversations' })]);
  assert.equal(other.status, 2);
  assert.equal(failure(other).error, 'assignment-required');
});

test('A2 resolves a commit import whose ref contains a slash', () => {
  const w = world();
  const head = spawnSync('git', ['-C', w.repo, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).stdout.trim();
  spawnSync('git', ['-C', w.repo, 'update-ref', 'refs/remotes/origin/main', head]);
  const r = call(w, ['init', ...initArgs(w, { '--start': 'verification' }), '--import', 'origin/main']);
  assert.equal(r.status, 0, r.stderr);
  const imp = readRunJson(stateDir(w)).phases.implementation.imports[0];
  assert.deepEqual({ kind: imp.kind, value: imp.value, commit: imp.commit }, { kind: 'commit', value: 'origin/main', commit: head });
  const w2 = world();
  const missing = call(w2, ['init', ...initArgs(w2, { '--start': 'verification' }), '--import', 'origin/nothing']);
  assert.equal(missing.status, 2);
  assert.ok(['import-unresolved', 'file-missing'].includes(failure(missing).error));
  const outside = call(w2, ['init', ...initArgs(w2, { '--start': 'verification' }), '--import', '/etc/nothing-here']);
  assert.equal(outside.status, 2);
  assert.equal(failure(outside).error, 'path-rule');
});

test('A3 init refuses when the active-run lookup fails for any reason', () => {
  const w = world();
  const S = started(w);
  writeFileSync(join(S, 'run.json'), 'not json');
  const unreadable = call(w, ['init', ...initArgs(w)], { session: 'sess-2' });
  assert.equal(unreadable.status, 2);
  assert.equal(failure(unreadable).error, 'run-lookup-error');
  const w2 = world();
  started(w2);
  writeFileSync(join(w2.data, 'active-runs.json'), 'not json');
  const pointer = call(w2, ['init', ...initArgs(w2)], { session: 'sess-2' });
  assert.equal(pointer.status, 2);
  assert.equal(failure(pointer).error, 'run-lookup-error');
  assert.equal(readdirSync(join(w2.data, 'runs')).length, 1);
});

async function parallel(w, S, argvList) {
  const lock = join(S, 'run.lock');
  writeFileSync(lock, '{}');
  const release = new Promise((resolve) => setTimeout(() => {
    rmSync(lock, { force: true });
    resolve();
  }, 1200));
  const env = { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home };
  const runs = Promise.all(argvList.map((args) => new Promise((resolve) => {
    const p = spawn(process.execPath, [RUN, ...argvFor(w, args)], { cwd: w.repo, env });
    let err = '';
    p.stderr.on('data', (d) => (err += d));
    p.on('close', (code) => resolve({ code, err }));
  })));
  await release;
  return runs;
}

test('A4 parallel object calls record one owner record', async () => {
  const w = world();
  const S = started(w);
  indexWith(S, [{ id: 'D-1-devils-advocate-a1', objections: ['F-P1-1'], premises: [] }]);
  const results = await parallel(w, S, Array.from({ length: 8 }, () => ['object', 'D-1-devils-advocate-a1:F-P1-1', 'accept', '--why', 'ok']));
  assert.equal(results.filter((r) => r.code === 0).length, 1, JSON.stringify(results));
  assert.equal(readRunJson(S).owner_records.filter((o) => o.kind === 'object').length, 1);
});

test('A8 set-autonomy repeats the active-run check inside the locked update', () => {
  const w = world();
  const S = started(w);
  acceptedOk(w);
  const store = join(PLUGIN, 'lib', 'run-store.mjs');
  const park = `import('${store}').then((m) => m.updateRun('${S}', 'test-park', (r) => { r.status = 'PARKED'; }))`;
  const fake = join(w.bin, 'claude');
  writeFileSync(fake, `#!/bin/sh\n'${process.execPath}' -e "${park}"\necho "2.1.314 (Claude Code)"\n`);
  chmodSync(fake, 0o755);
  const r = call(w, ['set-autonomy', 'A3', '--tokens', '10', '--loops', '2']);
  assert.equal(r.status, 2, r.stdout + r.stderr);
  assert.equal(failure(r).error, 'run-not-active');
  const run = readRunJson(S);
  assert.equal(run.status, 'PARKED');
  assert.equal(run.autonomy.set, false);
  assert.deepEqual(run.owner_records.map((o) => o.kind), ['probe-accept']);
});

test('A8 the command string of the guard runs through sh and is accepted, one changed token character is refused', () => {
  const w = world();
  const S = started(w);
  const guard = (command) => {
    const input = { session_id: w.session, cwd: w.repo, hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, permission_mode: 'default' };
    const env = { PATH: process.env.PATH, HOME: w.home, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: w.data };
    const r = spawnSync(process.execPath, [join(PLUGIN, 'hooks', 'guard-shell.mjs')], { input: JSON.stringify(input), encoding: 'utf8', env });
    assert.equal(r.status, 0, r.stderr);
    return JSON.parse(r.stdout).hookSpecificOutput;
  };
  const sh = (command) => spawnSync('sh', ['-c', command], { cwd: w.repo, encoding: 'utf8', env: { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home } });
  const out = guard(`node ${RUN} set-autonomy A1 --tokens 10 --loops 2`);
  assert.equal(out.permissionDecision, 'ask');
  const command = out.updatedInput.command;
  const last = command.at(-1);
  const changed = `${command.slice(0, -1)}${last === '0' ? '1' : '0'}`;
  const refused = sh(changed);
  assert.equal(refused.status, 2);
  assert.equal(failure(refused).error, 'hook-token-mac');
  assert.equal(readRunJson(S).autonomy.set, false);
  const accepted = sh(command);
  assert.equal(accepted.status, 0, accepted.stderr);
  assert.equal(readRunJson(S).autonomy.level, 'A1');
});

test('A4 parallel decision calls apply one status change', async () => {
  const w = world();
  const S = started(w);
  call(w, ['id', 'D']);
  call(w, ['decision', 'D-1', 'proposed']);
  const results = await parallel(w, S, Array.from({ length: 8 }, () => ['decision', 'D-1', 'decided', '--decider', 'owner']));
  assert.equal(results.filter((r) => r.code === 0).length, 1, JSON.stringify(results));
  const run = readRunJson(S);
  assert.deepEqual(run.decisions['D-1'].stamps.map((s) => s.status), ['proposed', 'decided']);
  assert.equal(run.owner_records.filter((o) => o.kind === 'decision').length, 1);
});

test('A5 a duplicated data dir exits 2', () => {
  const w = world();
  started(w);
  const r = call(w, ['status'], { extra: ['--data-dir', join(w.base, 'other')] });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'data-dir-count');
  assert.ok(!existsSync(join(w.base, 'other')));
});

test('A6 an owner record from decision stores decider owner and only for decided', () => {
  const w = world();
  const S = started(w);
  call(w, ['id', 'D']);
  assert.equal(call(w, ['decision', 'D-1', 'proposed', '--decider', 'alice']).status, 0);
  assert.equal(readRunJson(S).owner_records.filter((o) => o.kind === 'decision').length, 0);
  assert.equal(call(w, ['decision', 'D-1', 'decided', '--decider', 'alice']).status, 0);
  const recs = readRunJson(S).owner_records.filter((o) => o.kind === 'decision');
  assert.equal(recs.length, 1);
  assert.deepEqual({ id: recs[0].id, status: recs[0].status, decider: recs[0].decider }, { id: 'D-1', status: 'decided', decider: 'owner' });
  assert.equal(readRunJson(S).decisions['D-1'].decider, 'alice');
  assert.equal(call(w, ['decision', 'D-1', 'superseded', '--decider', 'alice']).status, 0);
  assert.equal(readRunJson(S).owner_records.filter((o) => o.kind === 'decision').length, 1);
});

test('A7 an owner record from decision is written when the decider is not the executor role of the run mode', () => {
  const decide = (mode, decider) => {
    const w = world();
    const S = started(w, { '--mode': mode });
    call(w, ['id', 'D']);
    assert.equal(call(w, ['decision', 'D-1', 'decided', '--decider', decider]).status, 0);
    return readRunJson(S).owner_records.filter((o) => o.kind === 'decision').length;
  };
  assert.equal(decide('single', 'orchestrator'), 1);
  assert.equal(decide('single', 'team lead'), 1);
  assert.equal(decide('single', 'operator'), 0);
  assert.equal(decide('multi', 'orchestrator'), 0);
  assert.equal(decide('multi', 'operator'), 1);
});

test('A2 fires: path argument under a credentials deny entry of the user settings', () => {
  const w = world();
  mkdirSync(join(w.repo, 'vault'));
  writeFileSync(join(w.repo, 'vault', 'note.txt'), 'x\n');
  writeSettings(w, { extra: { credentials: { deny: [`${w.repo}/vault`, '~/.vault2'] } } });
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, 'vault', 'note.txt') })]);
  assert.equal(r.status, 2);
  const f = failure(r);
  assert.equal(f.error, 'path-rule');
  assert.ok(f.message.includes('credentials'), f.message);
  mkdirSync(join(w.home, '.vault2'));
  mkdirSync(join(w.home, 'p'));
  writeFileSync(join(w.home, '.vault2', 'k'), 'x\n');
  const home = call(w, ['init', ...initArgs(w, { '--intake': join(w.home, '.vault2', 'k') })]);
  assert.equal(home.status, 2);
  assert.equal(failure(home).error, 'path-rule');
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

function nonceLines(w) {
  try {
    return readFileSync(join(w.data, 'hook-nonces.jsonl'), 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l).nonce);
  } catch {
    return [];
  }
}

function untouched(w) {
  assert.ok(!existsSync(join(w.repo, 'docs')), 'a run directory was created');
  assert.ok(!existsSync(join(w.data, 'active-runs.json')), 'the pointer was written');
}

test('fires: run.mjs call without hook token', () => {
  const w = world();
  const none = call(w, ['init', ...initArgs(w)], { token: null });
  assert.equal(none.status, 2);
  assert.equal(failure(none).error, 'hook-token-count');
  untouched(w);
  const twice = call(w, ['init', ...initArgs(w)], { extra: ['--hook-token', 'x'] });
  assert.equal(twice.status, 2);
  assert.equal(failure(twice).error, 'hook-token-count');
  untouched(w);
  const malformed = call(w, ['init', ...initArgs(w)], { token: 'garbage' });
  assert.equal(malformed.status, 2);
  assert.equal(failure(malformed).error, 'hook-token-malformed');
  untouched(w);
  rmSync(join(w.home, '.config', 'cdp6-core', 'hook.key'));
  const noKey = call(w, ['init', ...initArgs(w)], { token: `${'a'.repeat(32)}.${Date.now()}.${'b'.repeat(64)}` });
  assert.equal(noKey.status, 2);
  assert.equal(failure(noKey).error, 'hook-key-unreadable');
  untouched(w);
});

test('fires: token from another session', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w)], { tokenFor: { sessionId: 'sess-other' } });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'hook-token-mac');
  untouched(w);
  assert.deepEqual(nonceLines(w), []);
});

test('fires: token from another data dir', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w)], { tokenFor: { dataDir: join(w.base, 'other-data') } });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'hook-token-mac');
  untouched(w);
});

test('fires: token over other tokens', () => {
  const w = world();
  const r = call(w, ['init', ...initArgs(w)], { tokenFor: { tokens: ['init', ...initArgs(w), '--root', 'docs/other'] } });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'hook-token-mac');
  untouched(w);
  const key = Buffer.alloc(32, 7);
  const other = call(w, ['init', ...initArgs(w)], { tokenFor: { key } });
  assert.equal(failure(other).error, 'hook-token-mac');
  untouched(w);
});

test('fires: replayed hook token', () => {
  const w = world();
  started(w);
  const fixed = mintToken(readHostKey({ HOME: w.home }), { sessionId: w.session, dataDir: w.data, tokens: ['status'], expect: [] });
  const first = call(w, ['status'], { token: fixed });
  assert.equal(first.status, 0, first.stderr);
  const second = call(w, ['status'], { token: fixed });
  assert.equal(second.status, 2);
  assert.equal(failure(second).error, 'hook-token-replayed');
  assert.equal(nonceLines(w).filter((n) => n === fixed.split('.')[0]).length, 1);
});

test('fires: node option visible to run.mjs', () => {
  const w = world();
  const viaArgv = call(w, ['init', ...initArgs(w)], { node: ['--no-warnings'] });
  assert.equal(viaArgv.status, 2);
  assert.equal(failure(viaArgv).error, 'node-options');
  untouched(w);
  const viaEnv = call(w, ['init', ...initArgs(w)], { env: { NODE_OPTIONS: '--no-warnings' } });
  assert.equal(viaEnv.status, 2);
  assert.equal(failure(viaEnv).error, 'node-options');
  untouched(w);
});

test('fires: nonce not recorded on failed later check', () => {
  const w = world();
  const token = mintToken(readHostKey({ HOME: w.home }), { sessionId: w.session, dataDir: w.data, tokens: ['init', ...initArgs(w)], expect: [] });
  const r = call(w, ['init', ...initArgs(w)], { token, env: { NODE_OPTIONS: '--no-warnings' } });
  assert.equal(r.status, 2);
  assert.deepEqual(nonceLines(w), [token.split('.')[0]]);
  untouched(w);
  const forged = call(w, ['init', ...initArgs(w)], { tokenFor: { sessionId: 'sess-other' } });
  assert.equal(failure(forged).error, 'hook-token-mac');
  assert.equal(nonceLines(w).length, 1);
  const replay = call(w, ['init', ...initArgs(w)], { token });
  assert.equal(failure(replay).error, 'hook-token-replayed');
});

test('fires: declined owner token replayed', () => {
  const w = world();
  const old = call(w, ['init', ...initArgs(w)], { now: Date.now() - 11 * 60 * 1000 });
  assert.equal(old.status, 2);
  assert.equal(failure(old).error, 'hook-token-expired');
  untouched(w);
  assert.deepEqual(nonceLines(w), []);
  const fresh = call(w, ['init', ...initArgs(w)], { now: Date.now() - 9 * 60 * 1000 });
  assert.equal(fresh.status, 0, fresh.stderr);
});

test('fires: expect-sha256 changed under token', () => {
  const w = world();
  writeFileSync(join(w.repo, 'imp.md'), 'first\n');
  const args = ['init', ...initArgs(w, { '--start': 'verification' }), '--import', join(w.repo, 'imp.md')];
  const forged = call(w, args, { extra: ['--expect-sha256', 'f'.repeat(64)], tokenFor: { expect: [sha('first\n')] } });
  assert.equal(forged.status, 2);
  assert.equal(failure(forged).error, 'hook-token-mac');
  untouched(w);
  const argv = argvFor(w, args);
  writeFileSync(join(w.repo, 'imp.md'), 'second\n');
  const changed = spawnSync(process.execPath, [RUN, ...argv], { cwd: w.repo, encoding: 'utf8', env: { PATH: `${w.bin}:${process.env.PATH}`, HOME: w.home } });
  assert.equal(changed.status, 2);
  assert.equal(failure(changed).error, 'expect-sha256-mismatch');
  untouched(w);
  writeFileSync(join(w.repo, 'imp.md'), 'first\n');
  const ok = call(w, args);
  assert.equal(ok.status, 0, ok.stderr);
  assert.equal(readRunJson(stateDir(w)).phases.implementation.imports[0].sha256, sha('first\n'));
});

test('fires: token printed on exit 2', () => {
  const w = world();
  const S = started(w);
  const key = readHostKey({ HOME: w.home });
  const mint = (over = {}) => mintToken(key, { sessionId: w.session, dataDir: w.data, tokens: ['status'], expect: [], ...over });
  const stale = mintToken(key, { sessionId: w.session, dataDir: w.data, tokens: ['status'], expect: [] }, Date.now() - 20 * 60 * 1000);
  const replayed = mint();
  assert.equal(call(w, ['status'], { token: replayed }).status, 0);
  const future = mintToken(key, { sessionId: w.session, dataDir: w.data, tokens: ['status'], expect: [] }, Date.now() + 60 * 1000);
  const foreign = mint({ sessionId: 'sess-other' });
  const optioned = mint();
  const first = mint();
  const second = mint();
  const cases = [
    { tokens: [replayed], r: call(w, ['status'], { token: replayed }) },
    { tokens: [stale], r: call(w, ['status'], { token: stale }) },
    { tokens: [future], r: call(w, ['status'], { token: future }) },
    { tokens: [foreign], r: call(w, ['status'], { token: foreign }) },
    { tokens: [optioned], r: call(w, ['status'], { token: optioned, env: { NODE_OPTIONS: '--no-warnings' } }) },
    { tokens: ['abc.def.ghi'], r: call(w, ['status'], { token: 'abc.def.ghi' }) },
    { tokens: [first, second], r: call(w, ['status'], { token: first, extra: ['--hook-token', second] }) },
  ];
  const journal = readFileSync(join(S, 'run.journal.jsonl'), 'utf8');
  for (const { tokens, r } of cases) {
    assert.equal(r.status, 2);
    for (const token of tokens) {
      for (const secret of [token, ...token.split('.')].filter((part) => part.length > 2)) {
        assert.ok(!r.stdout.includes(secret) && !r.stderr.includes(secret), 'the token was printed');
        assert.ok(!journal.includes(secret), 'the token reached the journal');
      }
    }
  }
});

test('fires: token issued in the future', () => {
  const w = world();
  started(w);
  const future = mintToken(readHostKey({ HOME: w.home }), { sessionId: w.session, dataDir: w.data, tokens: ['status'], expect: [] }, Date.now() + 60 * 1000);
  const r = call(w, ['status'], { token: future });
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'hook-token-expired');
});

test('fires: run.mjs accepts flag form the guard rejects', () => {
  const w = world();
  started(w);
  assert.equal(failure(call(w, ['decision', 'D-1', 'decided', '--decider=owner'])).error, 'flag-form');
  assert.equal(failure(call(w, ['init', '--mode=team'])).error, 'flag-form');
  assert.equal(failure(call(w, ['frobnicate'])).error, 'unknown-subcommand');
  assert.equal(failure(call(w, ['status', '--bogus', 'x'])).error, 'unknown-flag');
  const unbuilt = call(w, ['rule', 'x', '--why', 'y', '--human']);
  assert.equal(unbuilt.status, 2);
  assert.equal(failure(unbuilt).error, 'not-built');
});

function settingsRefusal(w, over, needle) {
  writeSettings(w, over);
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 2, r.stderr);
  const f = failure(r);
  assert.equal(f.error, 'user-settings-rule-missing');
  assert.ok(f.message.includes(needle), f.message);
  assert.ok(!f.message.includes('Write deny rule'), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')), 'a run directory was created');
}

test('fires: key file readable by Read tool', () => {
  const w = world();
  settingsRefusal(w, { drop: ['key:read'] }, 'Read deny rule on ~/.config/cdp6-core/');
  settingsRefusal(w, { dropSandbox: [{ list: 'denyRead', entry: '~/.config/cdp6-core/' }] }, 'sandbox.filesystem.denyRead entry on ~/.config/cdp6-core/');
  writeSettings(w);
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

test('fires: key file editable with only a Write rule', () => {
  const w = world();
  settingsRefusal(w, { drop: ['key:edit'], rules: ['Write(~/.config/cdp6-core/**)'] }, 'Edit deny rule on ~/.config/cdp6-core/');
  settingsRefusal(w, { drop: ['key:edit'] }, 'Edit deny rule on ~/.config/cdp6-core/');
  settingsRefusal(w, { dropSandbox: [{ list: 'denyWrite', entry: '~/.config/cdp6-core/' }] }, 'sandbox.filesystem.denyWrite entry on ~/.config/cdp6-core/');
});

test('fires: transcript dir readable', () => {
  const w = world();
  settingsRefusal(w, { drop: ['transcript:read'] }, 'Read deny rule on ~/.claude/projects/');
  settingsRefusal(w, { dropSandbox: [{ list: 'denyRead', entry: '~/.claude/projects/' }] }, 'sandbox.filesystem.denyRead entry on ~/.claude/projects/');
});

test('fires: state directory editable by Edit tool', () => {
  const w = world();
  const withoutStates = ['Edit'].flatMap((tool) => ['hook-nonces.jsonl', 'active-runs.json', 'probes/**', 'grants.json'].map((file) => `${tool}(//${w.data.slice(1)}/${file})`));
  narrowRefusal(w, ['edit:data'], withoutStates, 'the data directory', 'the plugin root');
});

test('fires: deny rules that cover only the four earlier samples of the data directory', () => {
  const w = world();
  const four = ['Edit'].flatMap((tool) => ['hook-nonces.jsonl', 'active-runs.json', 'probes/**', 'runs/**'].map((file) => `${tool}(//${w.data.slice(1)}/${file})`));
  narrowRefusal(w, ['edit:data'], four, 'the data directory', 'the plugin root');
});

test('the init check asks for no deny rule on the run files of the project or of the memory directory', () => {
  const w = world();
  const all = settingsRules(w).map((r) => r.id);
  assert.ok(all.every((id) => /^(edit|write):(data|plugin|key)$|^(key|transcript):/.test(id)), all.join(','));
  writeSettings(w);
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 0, r.stderr);
});

function narrowRefusal(w, drop, narrow, wanted, unwanted) {
  writeSettings(w, { drop, rules: narrow });
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 2, r.stderr);
  const f = failure(r);
  assert.equal(f.error, 'user-settings-rule-missing');
  assert.ok(f.message.includes(`Edit deny rule on ${wanted}`), f.message);
  assert.ok(!f.message.includes(`Edit deny rule on ${unwanted}`), f.message);
  assert.ok(!f.message.includes('Write deny rule'), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')), 'a run directory was created');
  writeSettings(w);
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
}

test('fires: narrow deny rules for the data directory', () => {
  const w = world();
  const narrow = ['Edit'].map((tool) => `${tool}(//${w.data.slice(1)}/hook-nonces.jsonl)`);
  narrowRefusal(w, ['edit:data'], narrow, 'the data directory', 'the plugin root');
});

test('fires: narrow deny rules for the plugin root', () => {
  const w = world();
  const narrow = ['Edit'].map((tool) => `${tool}(//${PLUGIN.slice(1)}/lib/hook-key.mjs)`);
  narrowRefusal(w, ['edit:plugin'], narrow, 'the plugin root', 'the data directory');
});

test('fires: nonce record editable by Edit tool', () => {
  const w = world();
  settingsRefusal(w, { drop: ['edit:data'] }, 'Edit deny rule on the data directory');
});

test('fires: Write rule counted as file deny rule', () => {
  const w = world();
  const writeRules = [`Write(//${w.data.slice(1)}/**)`, `Write(//${PLUGIN.slice(1)}/**)`];
  writeSettings(w, { drop: ['edit:data', 'edit:plugin'], rules: writeRules });
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 2, r.stderr);
  const f = failure(r);
  assert.equal(f.error, 'user-settings-rule-missing');
  assert.ok(f.message.includes('Edit deny rule on the data directory'), f.message);
  assert.ok(f.message.includes('Edit deny rule on the plugin root'), f.message);
  assert.ok(!existsSync(join(w.repo, 'docs')), 'a run directory was created');
  writeSettings(w, { rules: writeRules });
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

test('a Write rule is not required and its absence is not reported', () => {
  const w = world();
  assert.ok(!JSON.stringify(JSON.parse(readFileSync(join(w.home, '.claude', 'settings.json'), 'utf8')).permissions.deny).includes('Write('));
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

test('fires: plugin lib editable by Edit tool', () => {
  const w = world();
  settingsRefusal(w, { drop: ['edit:plugin'] }, 'Edit deny rule on the plugin root');
  writeSettings(w);
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

test('init refuses when the user settings cannot be read', () => {
  const w = world();
  rmSync(join(w.home, '.claude', 'settings.json'));
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'user-settings-unreadable');
});

test('fires: intake swapped for a symlink to the host key after the path check', () => {
  const w = world();
  const key = join(w.home, '.config', 'cdp6-core', 'hook.key');
  const intake = join(w.repo, 'intake.txt');
  const fake = join(w.bin, 'claude');
  writeFileSync(fake, `#!/bin/sh\nrm -f '${intake}'\nln -s '${key}' '${intake}'\necho "2.1.314 (Claude Code)"\n`);
  chmodSync(fake, 0o755);
  const r = call(w, ['init', ...initArgs(w)]);
  const keyBytes = readFileSync(key);
  const copies = [];
  if (existsSync(join(w.data, 'active-runs.json'))) {
    const S = stateDir(w);
    for (const name of ['assignment.md', 'intake.md']) copies.push(readFileSync(join(S, 'idea', name)));
  }
  assert.ok(copies.every((buf) => !buf.includes(keyBytes)), 'the host key was copied into the run directory');
  assert.equal(r.status, 2, r.stdout);
});

test('fires: intake that is a symlink in its last component', () => {
  const w = world();
  symlinkSync(join(w.repo, 'assignment.txt'), join(w.repo, 'link.txt'));
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, 'link.txt') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'file-symlink');
  assert.ok(!existsSync(join(w.repo, 'docs')));
});

test('fires: run.mjs started through a symlinked plugin root still acts', () => {
  const w = world();
  const link = join(w.base, 'plugin-link');
  symlinkSync(PLUGIN, link);
  const r = call(w, ['init', ...initArgs(w)], { script: join(link, 'scripts', 'run.mjs') });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(w.data, 'active-runs.json')));
});

test('fires: init refuses the home directory and its ancestors as project root', () => {
  const w = world();
  writeFileSync(join(w.home, 'intake.txt'), 'Build a thing that does X.\n');
  writeFileSync(join(w.base, 'intake.txt'), 'Build a thing that does X.\n');
  for (const cwd of [w.home, w.base]) {
    const r = call(w, ['init', ...initArgs(w, { '--intake': join(cwd, 'intake.txt') })], { cwd });
    assert.equal(r.status, 2, r.stderr);
    assert.equal(failure(r).error, 'project-root-home');
    assert.ok(!existsSync(join(cwd, 'docs')));
    assert.ok(!existsSync(join(w.data, 'active-runs.json')));
  }
  assert.equal(call(w, ['init', ...initArgs(w)]).status, 0);
});

test('init records the R of a --root in run.json and keeps no run-roots.json', () => {
  const w = world({ claudeMd: '# Project\nRuns are kept in docs/records.\n' });
  const before = walk(w.repo);
  assert.equal(call(w, ['init', ...initArgs(w, { '--root': 'docs/records' })]).status, 0);
  assert.equal(runDir(w), join(realpathSync(w.repo), 'docs', 'records', basename(stateDir(w))));
  assert.equal(existsSync(join(w.data, 'run-roots.json')), false);
  assert.deepEqual(walk(w.repo), before);
  const plain = world();
  assert.equal(call(plain, ['init', ...initArgs(plain)]).status, 0);
  assert.equal(existsSync(join(plain.data, 'run-roots.json')), false);
  assert.equal(runDir(plain), join(realpathSync(plain.repo), 'docs', 'cdp6', 'runs', basename(stateDir(plain))));
});

test('fires: intake above 1 MiB is refused before it is read', () => {
  const w = world();
  writeFileSync(join(w.repo, 'big.txt'), 'x'.repeat(1024 * 1024 + 1));
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, 'big.txt') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'file-too-large');
  assert.ok(!existsSync(join(w.repo, 'docs')));
});

test('fires: assignment above 1 MiB is refused before it is read', () => {
  const w = world();
  writeFileSync(join(w.repo, 'big.txt'), 'x'.repeat(1024 * 1024 + 1));
  const r = call(w, ['init', ...initArgs(w, { '--kind': 'issue', '--assignment': join(w.repo, 'big.txt') })]);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'file-too-large');
  assert.ok(!existsSync(join(w.repo, 'docs')));
});

test('an intake of exactly 1 MiB is accepted', () => {
  const w = world();
  writeFileSync(join(w.repo, 'edge.txt'), 'x'.repeat(1024 * 1024));
  const r = call(w, ['init', ...initArgs(w, { '--intake': join(w.repo, 'edge.txt') })]);
  assert.equal(r.status, 0, r.stderr);
});

test('fires: own run root that is a symlink to a directory outside the project receives no file from init', () => {
  const w = world();
  const outside = join(w.base, 'outside');
  mkdirSync(outside);
  mkdirSync(join(w.repo, 'docs', 'cdp6'), { recursive: true });
  symlinkSync(outside, join(w.repo, 'docs', 'cdp6', 'runs'));
  const r = call(w, ['init', ...initArgs(w)]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(outside), []);
  assert.ok(existsSync(join(stateDir(w), 'run.json')));
});

test('fires: company run root that is a symlink to a directory outside the memory tree receives no file from init', () => {
  const w = world();
  const outside = join(w.base, 'outside');
  mkdirSync(outside);
  const name = realpathSync(w.repo).replace(/[^A-Za-z0-9]/g, '-');
  const memory = join(w.home, '.claude', 'projects', name, 'memory', 'cdp6');
  mkdirSync(memory, { recursive: true });
  symlinkSync(outside, join(memory, 'runs'));
  const r = call(w, ['init', ...initArgs(w, { '--class': 'company' })]);
  assert.equal(r.status, 0, r.stderr);
  assert.deepEqual(readdirSync(outside), []);
});

test('after init, enter, exit and approve the project tree holds no file written by run.mjs', () => {
  const w = world();
  const before = walk(w.repo);
  const S = readyToExit(w, { level: 'A0' });
  const R = runDir(w);
  assert.equal(call(w, ['exit', 'idea']).status, 0);
  assert.equal(call(w, ['approve', 'idea']).status, 0);
  assert.equal(readRunJson(S).phases.idea.state, 'exited');
  const written = walk(w.repo).filter((p) => !before.includes(p));
  assert.deepEqual(written.filter((p) => statSync(p).isFile()), [join(R, 'idea', 'idea.md')]);
  assert.ok(written.every((p) => p === R || p.startsWith(`${R}/`) || R.startsWith(`${p}/`)), written.join(' '));
});

test('every later subcommand reads and writes only the state directory: the lock and the journal lie in S', () => {
  const w = world();
  const S = started(w);
  guardLine(w);
  assert.equal(call(w, ['enter', 'idea']).status, 0);
  assert.equal(call(w, ['id', 'D']).stdout.trim(), JSON.stringify({ id: 'D-1' }));
  const journal = readFileSync(join(S, 'run.journal.jsonl'), 'utf8');
  assert.ok(journal.includes('enter:idea') && journal.includes('id:D'), journal);
  const lock = join(S, 'run.lock');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  const busy = call(w, ['id', 'D']);
  assert.equal(busy.status, 2);
  assert.equal(failure(busy).error, 'lock-busy');
  rmSync(lock);
  assert.equal(call(w, ['id', 'D']).status, 0);
});

test('a run root swapped between a symlink to an outside directory and nothing while init runs leaves the outside directory empty', () => {
  const w = world();
  const outside = join(w.base, 'outside');
  mkdirSync(outside);
  mkdirSync(join(w.repo, 'docs', 'cdp6'), { recursive: true });
  const runs = join(w.repo, 'docs', 'cdp6', 'runs');
  const swapper = spawn(process.execPath, ['-e', `const fs=require('fs');const end=Date.now()+25000;while(Date.now()<end){try{fs.symlinkSync(${JSON.stringify(outside)},${JSON.stringify(runs)})}catch{}try{fs.unlinkSync(${JSON.stringify(runs)})}catch{}}`]);
  const end = Date.now() + 25000;
  let tries = 0;
  try {
    while (Date.now() < end && tries < 50 && readdirSync(outside).length === 0) {
      tries += 1;
      call(w, ['init', ...initArgs(w)]);
      rmSync(w.data, { recursive: true, force: true });
      rmSync(runs, { recursive: true, force: true });
    }
  } finally {
    swapper.kill();
  }
  assert.deepEqual(readdirSync(outside), [], `tries ${tries}`);
});

test('init --class company succeeds under a symlinked ~/.claude', () => {
  const w = world();
  const dot = join(w.base, 'dotfiles-claude');
  renameSync(join(w.home, '.claude'), dot);
  symlinkSync(dot, join(w.home, '.claude'));
  const r = call(w, ['init', ...initArgs(w, { '--class': 'company' })]);
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.ok(existsSync(join(stateDir(w), 'run.json')));
});

test('exit idea reads the artefact once through the reader into the snapshot and records its path and sha256 in the gate result', () => {
  const w = world();
  const S = readyToExit(w);
  const R = runDir(w);
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 0, r.stderr + r.stdout);
  const copy = join(S, 'snapshots', 'idea', 'cycle-1', 'idea', 'idea.md');
  assert.equal(readFileSync(copy, 'utf8'), readFileSync(join(R, 'idea', 'idea.md'), 'utf8'));
  const gate = readRunJson(S).phases.idea.gate;
  assert.deepEqual(gate.artefacts, [{ path: 'idea/idea.md', sha256: sha(readFileSync(copy, 'utf8')) }]);
  const failing = world();
  const S2 = readyToExit(failing, { skip: ['Non-goals'] });
  assert.equal(call(failing, ['exit', 'idea']).status, 1);
  const failed = readRunJson(S2).phases.idea.gate;
  assert.equal(failed.passed, false);
  assert.deepEqual(failed.artefacts.map((a) => a.path), ['idea/idea.md']);
  assert.ok(existsSync(join(S2, 'snapshots', 'idea', 'cycle-1', 'idea', 'idea.md')));
});

test('fires: the checkers run on the snapshot and on S, never on R', () => {
  const w = world();
  const S = readyToExit(w);
  const R = runDir(w);
  const { copy, script } = pluginCopy(w);
  const seen = join(w.base, 'seen.json');
  for (const name of ['idea-check', 'decision-check']) {
    writeFileSync(join(copy, 'checks', `${name}.mjs`), `import { appendFileSync } from 'node:fs';
appendFileSync(${JSON.stringify(seen)}, JSON.stringify(process.argv.slice(2)) + '\\n');
process.stdout.write('${name} OK\\n');
`);
  }
  const r = call(w, ['exit', 'idea'], { script });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const lines = readFileSync(seen, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  assert.equal(lines.length, 2);
  for (const argv of lines) {
    assert.deepEqual(argv, ['--run-dir', S, '--snapshot', join(S, 'snapshots', 'idea', 'cycle-1')]);
    assert.ok(!argv.some((a) => a.includes(R)), argv.join(' '));
  }
});

test('fires: a checker that rewrites idea.md in R after the read cannot change what the recorded hash names', () => {
  const w = world();
  const S = readyToExit(w);
  const R = runDir(w);
  const original = readFileSync(join(R, 'idea', 'idea.md'), 'utf8');
  const { copy, script } = pluginCopy(w);
  writeFileSync(join(copy, 'checks', 'idea-check.mjs'), `import { writeFileSync } from 'node:fs';
writeFileSync(${JSON.stringify(join(R, 'idea', 'idea.md'))}, '# rewritten by the checker\\n');
process.stdout.write('idea-check OK\\n');
`);
  const r = call(w, ['exit', 'idea'], { script });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  const gate = readRunJson(S).phases.idea.gate;
  assert.equal(gate.artefacts[0].sha256, sha(original));
  assert.equal(readFileSync(join(S, 'snapshots', 'idea', 'cycle-1', 'idea', 'idea.md'), 'utf8'), original);
  assert.equal(readRunJson(S).phases.idea.artefacts[0].sha256, sha(original));
});

test('fires: an artefact that is a symbolic link or has two hard links is refused at exit and the phase stays entered', () => {
  const w = world();
  const S = readyToExit(w);
  const R = runDir(w);
  const real = join(R, 'idea', 'real.md');
  renameSync(join(R, 'idea', 'idea.md'), real);
  symlinkSync(real, join(R, 'idea', 'idea.md'));
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 2);
  assert.equal(failure(r).error, 'file-symlink');
  assert.equal(readRunJson(S).phases.idea.state, 'entered');
  rmSync(join(R, 'idea', 'idea.md'));
  linkSync(real, join(R, 'idea', 'idea.md'));
  const linked = call(w, ['exit', 'idea']);
  assert.equal(failure(linked).error, 'file-hard-link');
  assert.equal(readRunJson(S).phases.idea.state, 'entered');
});

test('exit idea gates a missing idea.md through the checker and records no artefact', () => {
  const w = world();
  const S = readyToExit(w);
  rmSync(join(runDir(w), 'idea', 'idea.md'));
  const r = call(w, ['exit', 'idea']);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /idea\/idea\.md is missing/);
  assert.deepEqual(readRunJson(S).phases.idea.gate.artefacts, []);
});

test('fires: a conflicted capture without items stops exit idea, naming <capture id>:conflict, until the owner records it', () => {
  const w = world();
  readyToExit(w, { captureOver: { conflicted: true, text: captureText({ verdict: 'a', conflicted: true }) } });
  const blocked = call(w, ['exit', 'idea']);
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  assert.match(blocked.stdout, /D-1-devils-advocate-agent-7:conflict/);
  assert.equal(call(w, ['object', 'D-1-devils-advocate-agent-7:conflict', 'accept', '--why', 'the stake is declared and harmless']).status, 0);
  const passed = call(w, ['exit', 'idea']);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
});

test('fires: object <capture id>:conflict reject is refused once the D-n of the capture is decided, accepted before it, and accept after decided lets the gate pass', () => {
  const id = 'D-1-devils-advocate-agent-7:conflict';
  const over = { captureOver: { conflicted: true, text: captureText({ verdict: 'a', conflicted: true }) } };
  const early = world();
  const earlyS = readyToExit(early, { ...over, decide: false });
  const accepted = call(early, ['object', id, 'reject', '--why', 'the stake is not acceptable']);
  assert.equal(accepted.status, 0, accepted.stdout + accepted.stderr);
  assert.deepEqual(JSON.parse(accepted.stdout), { id, verdict: 'reject' });
  assert.equal(readRunJson(earlyS).owner_records.filter((o) => o.kind === 'object').length, 1);
  const late = world();
  const lateS = readyToExit(late, over);
  const refused = call(late, ['object', id, 'reject', '--why', 'too late']);
  assert.notEqual(refused.status, 0, refused.stdout);
  assert.equal(failure(refused).error, 'conflict-reject-after-decision');
  assert.deepEqual(readRunJson(lateS).owner_records.filter((o) => o.kind === 'object'), []);
  assert.equal(call(late, ['object', id, 'accept', '--why', 'the stake is declared and harmless']).status, 0);
  const passed = call(late, ['exit', 'idea']);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
});

test('fires: a D-n still proposed stops exit idea with a finding naming it, and a superseded one does not', () => {
  const w = world();
  readyToExit(w);
  call(w, ['id', 'D']);
  assert.equal(call(w, ['decision', 'D-2', 'proposed']).status, 0);
  const blocked = call(w, ['exit', 'idea']);
  assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
  assert.match(blocked.stdout, /decision-check FAIL D-2: still proposed/);
  assert.equal(call(w, ['decision', 'D-2', 'superseded']).status, 0);
  const passed = call(w, ['exit', 'idea']);
  assert.equal(passed.status, 0, passed.stdout + passed.stderr);
});

function rejectedBlockText(verdictLine = 'verdict: b', conflicted = false) {
  return captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'], conflicted }).replace('verdict: b\n', `${verdictLine}\nThe owner has to record F-P1-1 before the pick.\n`);
}

function rejectedLine(id, over = {}) {
  return { id, agent_type: 'cdp6-core:devils-advocate', task: 'D-1', decision: 'D-1', verdict: null, objections: [], premises: [], conflicted: false, validator: 'rejected', targets: [], stamp: new Date(Date.now() - 3000).toISOString(), text: rejectedBlockText(), ...over };
}

test('fires: object <capture id>:capture is accepted only for a rejected, not conflicted devils-advocate capture of the run with a verdict (b) or (c), and is refused otherwise with its own code', () => {
  const w = world();
  const S = started(w);
  backCaptures(S, [
    rejectedLine('D-1-devils-advocate-agent-1'),
    rejectedLine('D-1-devils-advocate-agent-2', { text: rejectedBlockText('VERDICT: C because of F-P1-1') }),
    rejectedLine('D-1-devils-advocate-agent-3', { conflicted: true, text: rejectedBlockText('verdict: b', true) }),
    rejectedLine('D-1-devils-advocate-agent-4', { text: rejectedBlockText('verdict: a') }),
    rejectedLine('D-1-devils-advocate-agent-5', { text: rejectedBlockText('verdict: b-ish') }),
    rejectedLine('D-1-devils-advocate-agent-6', { validator: 'valid', verdict: 'b', objections: ['F-P1-1'], text: captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'] }) }),
    rejectedLine('D-1-pessimistic-realist-agent-7', { agent_type: 'cdp6-core:pessimistic-realist' }),
  ]);
  const object = (id, verdict = 'accept') => call(w, ['object', id, verdict, '--why', 'the owner read the capture file']);
  for (const id of ['D-1-devils-advocate-agent-3', 'D-1-devils-advocate-agent-4', 'D-1-devils-advocate-agent-5', 'D-1-devils-advocate-agent-6', 'D-1-pessimistic-realist-agent-7', 'D-9-devils-advocate-agent-9']) {
    const refused = object(`${id}:capture`);
    assert.notEqual(refused.status, 0, id);
    assert.equal(failure(refused).error, 'unknown-capture', id);
  }
  assert.deepEqual(readRunJson(S).owner_records.filter((o) => o.kind === 'object'), []);
  const first = object('D-1-devils-advocate-agent-1:capture');
  assert.equal(first.status, 0, first.stdout + first.stderr);
  assert.deepEqual(JSON.parse(first.stdout), { id: 'D-1-devils-advocate-agent-1:capture', verdict: 'accept' });
  assert.equal(object('D-1-devils-advocate-agent-2:capture', 'reject').status, 0);
  assert.equal(failure(object('D-1-devils-advocate-agent-1:capture', 'reject')).error, 'objection-recorded');
  assert.deepEqual(readRunJson(S).owner_records.filter((o) => o.kind === 'object').map((o) => [o.id, o.verdict]), [['D-1-devils-advocate-agent-1:capture', 'accept'], ['D-1-devils-advocate-agent-2:capture', 'reject']]);
});

test('fires: object <capture id>:capture clears the block of a rejected capture in the gate of exit idea, and either verdict clears it', () => {
  for (const verdict of ['accept', 'reject']) {
    const w = world();
    const S = readyToExit(w, { captureOver: false, decide: false });
    const target = { path: 'idea/idea.md', sha256: sha(readFileSync(join(readRunJson(S).run_dir, 'idea', 'idea.md'), 'utf8')) };
    backCaptures(S, [rejectedLine('D-1-devils-advocate-agent-1'), { id: 'D-1-devils-advocate-agent-2', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', decision: 'D-1', verdict: 'a', objections: [], targets: [target], stamp: new Date(Date.now() - 2000).toISOString() }]);
    assert.equal(call(w, ['decision', 'D-1', 'decided', '--decider', 'owner']).status, 0);
    const blocked = call(w, ['exit', 'idea']);
    assert.equal(blocked.status, 1, blocked.stdout + blocked.stderr);
    assert.match(blocked.stdout, /decision-check FAIL D-1: capture D-1-devils-advocate-agent-1 is rejected by the validator and has a verdict b or c, no run\.mjs object D-1-devils-advocate-agent-1:capture record/);
    assert.equal(call(w, ['object', 'D-1-devils-advocate-agent-1:capture', verdict, '--why', 'the owner read the capture file']).status, 0);
    const passed = call(w, ['exit', 'idea']);
    assert.equal(passed.status, 0, `${verdict}: ${passed.stdout}${passed.stderr}`);
  }
});

test('fires: signed team record without A-5 does not open A3', () => {
  const w = world();
  started(w);
  signedRecord({ env: { HOME: w.home }, data: w.data, version: '2.1.314', rows: { 'A-11': { passed: true }, 'A-16': { passed: true }, 'A-14': { passed: true } } });
  const r = call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0']);
  assert.notEqual(r.status, 0);
  assert.equal(failure(r).error, 'a3-before-probe');
});

test('fires: probe accept under a running version that differs from the PATH binary', () => {
  const w = world();
  started(w);
  firedLine(w.data);
  const rec = probeFile(w);
  const r = call(w, ['probe', '--accept', rec.name], { host: '2.1.999' });
  assert.equal(r.status, 2, r.stdout);
  assert.equal(failure(r).error, 'path-version-differs');
  assert.ok(!existsSync(join(w.data, 'probes')));
});

test('fires: A3 and team read the record of the running version, not of the PATH binary', () => {
  const w = world();
  started(w);
  acceptedOk(w);
  assert.equal(call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0']).status, 0);
  const a3 = call(w, ['set-autonomy', 'A3', '--tokens', '1', '--loops', '0'], { host: '2.1.999' });
  assert.equal(failure(a3).error, 'path-version-differs');
  const w2 = world();
  const team = call(w2, ['init', ...initArgs(w2, { '--mode': 'team' })], { host: '2.1.999' });
  assert.equal(failure(team).error, 'path-version-differs');
});

test('fires: probe accept signs with an unwritable run.json', () => {
  const w = world();
  const S = started(w);
  chmodSync(join(S, 'run.json'), 0o000);
  try {
    firedLine(w.data);
    const r = call(w, ['probe', '--accept', probeFile(w).name]);
    assert.equal(r.status, 2, r.stdout);
    assert.ok(!existsSync(join(w.data, 'probes')), 'a record was signed and written');
  } finally {
    chmodSync(join(S, 'run.json'), 0o600);
  }
});

test('fires: probe accept signs while the run lock is held past the wait', () => {
  const w = world();
  const S = started(w);
  writeFileSync(join(S, 'run.lock'), JSON.stringify({ pid: process.pid, at: Date.now() }));
  firedLine(w.data);
  const r = call(w, ['probe', '--accept', probeFile(w).name]);
  assert.equal(r.status, 2, r.stdout);
  assert.equal(failure(r).error, 'lock-busy');
  assert.ok(!existsSync(join(w.data, 'probes')));
});

test('fires: accepted record left after failed owner record', () => {
  const w = world();
  const S = started(w);
  acceptedOk(w);
  const before = readFileSync(join(w.data, 'probes', '2.1.314.json'), 'utf8');
  chmodSync(join(S, 'run.journal.jsonl'), 0o400);
  try {
    const rows = goodRows('2.1.314').map((r) => (r.row === 'A-5' && r.mode === 'auto' ? { ...r, verdict: 'no-prompt' } : r));
    const r = acceptProbe(w, { rows, line: false }).r;
    assert.equal(r.status, 2, r.stdout);
    assert.equal(failure(r).error, 'owner-record-failed');
    assert.equal(readFileSync(join(w.data, 'probes', '2.1.314.json'), 'utf8'), before);
  } finally {
    chmodSync(join(S, 'run.journal.jsonl'), 0o600);
  }
  const fresh = world();
  const S2 = started(fresh);
  chmodSync(join(S2, 'run.journal.jsonl'), 0o400);
  try {
    const r = acceptProbe(fresh).r;
    assert.equal(r.status, 2, r.stdout);
    assert.ok(!existsSync(join(fresh.data, 'probes', '2.1.314.json')), 'the new record stayed');
  } finally {
    chmodSync(join(S2, 'run.journal.jsonl'), 0o600);
  }
});

test('fires: owner record skipped on lookup error', () => {
  const w = world();
  started(w);
  writeFileSync(join(w.data, 'active-runs.json'), '{ not json');
  const r = acceptProbe(w).r;
  assert.equal(r.status, 2, r.stdout);
  assert.equal(failure(r).error, 'run-lookup-failed');
  assert.ok(!existsSync(join(w.data, 'probes')));
});
