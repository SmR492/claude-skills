import test from 'node:test';
import { spawnSync } from 'node:child_process';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { lstatSync, mkdirSync, readFileSync, readdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ensureHostKey } from '../lib/hook-key.mjs';
import { readProbeRecord } from '../lib/probe-record.mjs';
import { nativeInstall } from '../test-support/claude-host.mjs';
import { acceptedRecord, goodRows, signedRecord, stubClaude } from '../test-support/probe-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';
import { preflight } from './preflight.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const VERSION = '2.1.318';
const CALIBRATION = { base: 1153, per_path: 7 };
const ORCHESTRATOR = 100;
const SELF = 102;

function put(file, text) {
  mkdirSync(join(file, '..'), { recursive: true });
  writeFileSync(file, text);
}

function goodSettings(w) {
  return {
    sandbox: {
      enabled: true,
      failIfUnavailable: true,
      allowUnsandboxedCommands: false,
      excludedCommands: [`node ${w.plugin}/scripts/run.mjs *`],
      network: { allowedDomains: ['example.invalid'], strictAllowlist: true },
      filesystem: {
        denyWrite: ['~/data', '~/.cache/cdp6-core', '~/.claude/teams', `${w.project}/docs/cdp6/probes`, '~/plugin', '~/.claude/plugins/cache/claude-skills/cdp5-gates', '~/.config/cdp6-core'],
        denyRead: ['~/.ssh', '~/.aws', '~/.config/gh', `${w.project}/**/.env*`, '~/.config/cdp6-core', '~/.claude/projects'],
      },
    },
    permissions: {
      deny: ['WebFetch', 'WebSearch', 'Read(~/.config/cdp6-core/**)', 'Edit(~/.config/cdp6-core/**)', 'Read(~/.claude/projects/**)', 'Edit(~/data/**)', 'Edit(~/plugin/**)'],
      defaultMode: 'auto',
      blockReadsOutsideWorkingDirectories: true,
      disableBypassPermissionsMode: 'disable',
    },
    disableClaudeAiConnectors: true,
    disableAllHooks: false,
  };
}

function userSettings() {
  return {
    sandbox: { filesystem: { denyRead: ['~/.config/cdp6-core', '~/.claude/projects'], denyWrite: ['~/.config/cdp6-core'] } },
    permissions: { deny: ['Read(~/.config/cdp6-core/**)', 'Edit(~/.config/cdp6-core/**)', 'Read(~/.claude/projects/**)', 'Edit(~/data/**)', 'Edit(~/plugin/**)'] },
  };
}

function procEntry(w, pid, ppid, exe, cmdline, environ = '', pgrp = pid) {
  const dir = join(w.proc, String(pid));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stat'), `${pid} (${exe.split('/').pop()}) S ${ppid} ${pgrp} ${pid} 0 -1 0 0 0 0 0\n`);
  writeFileSync(join(dir, 'cmdline'), cmdline.join('\0'));
  writeFileSync(join(dir, 'environ'), environ);
  symlinkSync(exe, join(dir, 'exe'));
}

function world({ calibrated = true, orchestratorEnviron = '' } = {}) {
  const base = tempDir('cdp6-preflight-');
  const home = join(base, 'home');
  const w = { base, home, bin: join(base, 'bin'), data: join(home, 'data'), plugin: join(home, 'plugin'), project: join(home, 'project'), tmp: join(base, 'tmp'), proc: join(base, 'proc'), settingsFile: join(home, 'live', 'settings.json') };
  for (const dir of [join(w.project, '.git'), w.plugin, w.data, w.tmp, w.proc]) mkdirSync(dir, { recursive: true });
  stubClaude(w.bin, VERSION);
  ensureHostKey({ HOME: home });
  w.env = { HOME: home, PATH: `${w.bin}:/usr/bin:/bin` };
  w.settings = goodSettings(w);
  put(w.settingsFile, JSON.stringify(w.settings));
  put(join(home, '.claude', 'settings.json'), JSON.stringify(userSettings()));
  acceptedRecord({ env: w.env, data: w.data });
  if (!calibrated) rewriteRecord(w, (r) => { delete r.rows['A-12'].modes.auto.calibration; });
  const claude = nativeInstall(base, VERSION);
  w.claudeExe = claude;
  w.managed = join(base, 'managed');
  procEntry(w, 1, 0, '/sbin/init', ['/sbin/init']);
  procEntry(w, ORCHESTRATOR, 1, claude, ['claude', '--resume'], orchestratorEnviron);
  procEntry(w, 101, ORCHESTRATOR, '/usr/bin/bash', ['/bin/bash', '-c', 'node preflight.mjs']);
  procEntry(w, SELF, 101, '/usr/bin/node', ['node', 'preflight.mjs']);
  return w;
}

function snapshot(dir) {
  const out = [];
  const walk = (d) => {
    for (const name of readdirSync(d).sort()) {
      const path = join(d, name);
      const st = lstatSync(path);
      out.push(`${path} ${st.size} ${st.mtimeMs}`);
      if (st.isDirectory()) walk(path);
    }
  };
  walk(dir);
  return out;
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function run(w, over = {}) {
  const args = { settings: w.settingsFile, settingsSha256: over.args?.settingsSha256 ?? sha256(w.settingsFile), pluginDir: w.plugin, project: w.project, dataDir: w.data, orchestratorPid: ORCHESTRATOR, ...over.args };
  return preflight(args, { env: w.env, procRoot: w.proc, tmpRoots: [w.tmp], selfPid: SELF, managedDir: w.managed, wsl: false, ...over.ctx });
}

function failed(res, check) {
  const hits = res.failures.filter((f) => f.check === check);
  assert.ok(hits.length > 0, `no failure for ${check}: ${res.text}`);
  return hits;
}

function passes(res, check) {
  assert.deepEqual(res.failures.filter((f) => f.check === check), [], res.text);
}

function writeSettings(w, mutate) {
  const next = structuredClone(w.settings);
  mutate(next);
  put(w.settingsFile, JSON.stringify(next));
  return next;
}

test('a complete world passes every check and exits 0', () => {
  const w = world();
  const res = run(w);
  assert.equal(res.exit, 0, res.text);
  assert.deepEqual(res.failures, []);
});

test('fires: env wildcard over the profile limit', () => {
  const w = world();
  for (let i = 0; i < 1196; i += 1) put(join(w.home, 'many', `d${i % 20}`, `.env${i}`), '');
  writeSettings(w, (s) => s.sandbox.filesystem.denyRead.push('~/**/.env*'));
  const res = run(w);
  assert.equal(res.exit, 1);
  const [hit] = failed(res, 'sandbox-profile');
  assert.match(hit.found, /~\/\*\*\/\.env\* expands to 1196 paths/);
  assert.match(hit.found, /estimate (\d+) against 9000/);
  assert.ok(Number(/estimate (\d+)/.exec(hit.found)[1]) > 9000);
  assert.match(hit.fix, /blockReadsOutsideWorkingDirectories/);
});

test('the project-scoped env entry with the read block passes the profile estimate', () => {
  const w = world();
  for (let i = 0; i < 1196; i += 1) put(join(w.home, 'many', `d${i % 20}`, `.env${i}`), '');
  put(join(w.project, 'sub', '.env'), '');
  const res = run(w);
  passes(res, 'sandbox-profile');
  assert.equal(res.exit, 0, res.text);
});

test('fires: uncalibrated argument estimate', () => {
  const w = world({ calibrated: false });
  const res = run(w);
  assert.equal(res.exit, 1);
  const [hit] = failed(res, 'sandbox-profile');
  assert.match(hit.found, /no calibration/);
});

test('fires: git repositories under a writable root', () => {
  const w = world();
  for (let i = 0; i < 840; i += 1) mkdirSync(join(w.tmp, `r${i}`, '.git'), { recursive: true });
  put(join(w.project, '.worktrees', 'a', '.git'), 'gitdir: x\n');
  const res = run(w, { ctx: { tmpRoots: [w.tmp, w.home] } });
  assert.equal(res.exit, 1);
  const hits = failed(res, 'git-repositories');
  assert.equal(hits.length, 1, res.text);
  assert.equal(hits[0].item, w.tmp);
  assert.match(hits[0].found, /^840 git repositories under the writable root /);
});

test('fires: second Claude Code session', () => {
  const w = world();
  procEntry(w, 200, 1, w.claudeExe, ['claude', '--resume', 'abc']);
  const res = run(w);
  assert.equal(res.exit, 1);
  const hits = failed(res, 'processes');
  assert.equal(hits.length, 1, res.text);
  assert.equal(hits[0].item, 'pid 200');
  assert.match(hits[0].found, /claude --resume abc/);
});

test('fires: stdio MCP child', () => {
  const w = world();
  procEntry(w, 110, ORCHESTRATOR, '/usr/bin/node', ['node', '/opt/mcp/server.js', '--stdio']);
  procEntry(w, 111, 110, '/usr/bin/node', ['node', 'helper.js']);
  const res = run(w);
  assert.equal(res.exit, 1);
  const items = failed(res, 'processes').map((f) => f.item);
  assert.deepEqual(items, ['pid 110', 'pid 111']);
  assert.match(failed(res, 'processes')[0].found, /node \/opt\/mcp\/server\.js --stdio/);
});

test('a pipeline sibling of the preflight is flagged', () => {
  const w = world();
  procEntry(w, 103, 101, '/usr/bin/tee', ['tee', 'out.txt'], '', SELF);
  procEntry(w, 104, 101, '/usr/bin/tee', ['tee', 'other.txt'], '', 104);
  const hits = failed(run(w), 'processes');
  assert.deepEqual(hits.map((f) => f.item), ['pid 103', 'pid 104']);
});

test('the preflight own ancestors and the orchestrator pass the process check', () => {
  const w = world();
  procEntry(w, 103, 1, '/usr/bin/bash', ['bash']);
  passes(run(w), 'processes');
});

function rewriteRecord(w, mutate) {
  const rec = readProbeRecord(w.data, VERSION, w.env);
  const next = structuredClone({ rows: rec.rows });
  mutate(next);
  signedRecord({ env: w.env, data: w.data, version: VERSION, rows: next.rows });
}

function bindRun(w, runId, { status = 'active', pending, counters } = {}) {
  const S = join(w.data, 'runs', runId);
  put(join(S, 'run.json'), JSON.stringify({ run_id: runId, status }));
  if (pending || counters) put(join(S, 'counters.json'), JSON.stringify(counters ?? { version: 1, pending }));
  const file = join(w.data, 'active-runs.json');
  let doc = { sessions: {}, projects: {} };
  try {
    doc = JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    doc = { sessions: {}, projects: {} };
  }
  doc.sessions[`s-${runId}`] = { run_id: runId, project_root: w.project };
  put(file, JSON.stringify(doc));
}

test('fires: version without accepted record', () => {
  const none = world();
  rmSync(join(none.data, 'probes', `${VERSION}.json`));
  const [a] = failed(run(none), 'probe-record');
  assert.match(a.found, /no accepted record for 2\.1\.318/);

  const forged = world();
  const file = join(forged.data, 'probes', `${VERSION}.json`);
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  doc.rows['A-23'].passed = true;
  doc.accepted.mac = 'f'.repeat(64);
  writeFileSync(file, JSON.stringify(doc));
  const [b] = failed(run(forged), 'probe-record');
  assert.match(b.found, /MAC does not verify/);

  const hand = world();
  const handDoc = JSON.parse(readFileSync(join(hand.data, 'probes', `${VERSION}.json`), 'utf8'));
  delete handDoc.accepted.mac;
  writeFileSync(join(hand.data, 'probes', `${VERSION}.json`), JSON.stringify(handDoc));
  assert.match(failed(run(hand), 'probe-record')[0].found, /MAC does not verify/);

  const other = world();
  stubClaude(other.bin, '2.1.400');
  rmSync(join(other.proc, String(ORCHESTRATOR), 'exe'));
  symlinkSync(nativeInstall(join(other.base, 'other'), '2.1.400'), join(other.proc, String(ORCHESTRATOR), 'exe'));
  assert.match(failed(run(other), 'probe-record')[0].found, /no accepted record for 2\.1\.400/);

  const noClaude = world();
  stubClaude(noClaude.bin, null);
  assert.match(failed(run(noClaude), 'probe-record')[0].found, /claude --version/);
});

test('fires: accepted record lacks a row in auto', () => {
  for (const [row, mutate] of [
    ['A-23', (r) => { r.rows['A-23'].modes.auto.handback = false; r.rows['A-23'].passed = false; }],
    ['A-12', (r) => { r.rows['A-12'].modes.auto.refused = false; r.rows['A-12'].passed = false; }],
    ['A-5', (r) => { r.rows['A-5'].modes.auto.prompt = false; r.rows['A-5'].passed = false; }],
    ['A-23', (r) => { delete r.rows['A-23']; }],
  ]) {
    const w = world();
    rewriteRecord(w, mutate);
    const hits = failed(run(w), 'probe-record');
    assert.match(hits[0].found, new RegExp(`${row} in auto`));
  }
});

test('fires: settings drift', () => {
  const w = world();
  const res = run(w, { args: { settingsSha256: 'a'.repeat(64) } });
  assert.equal(res.exit, 1);
  const [hit] = failed(res, 'settings-file');
  assert.equal(hit.item, 'sha256');
  assert.match(hit.found, new RegExp(sha256(w.settingsFile)));
  const gone = world();
  rmSync(gone.settingsFile);
  assert.match(failed(run(gone, { args: { settingsSha256: 'a'.repeat(64) } }), 'settings-file')[0].found, /not readable|missing/);
});

test('fires: settings file lacks a key of the concept section 5.6', () => {
  const cases = {
    'sandbox.enabled': (s) => { s.sandbox.enabled = false; },
    'sandbox.failIfUnavailable': (s) => { delete s.sandbox.failIfUnavailable; },
    'sandbox.allowUnsandboxedCommands': (s) => { s.sandbox.allowUnsandboxedCommands = true; },
    'sandbox.network.strictAllowlist': (s) => { delete s.sandbox.network; },
    'permissions.defaultMode': (s) => { s.permissions.defaultMode = 'default'; },
    'permissions.blockReadsOutsideWorkingDirectories': (s) => { s.permissions.blockReadsOutsideWorkingDirectories = false; },
    'sandbox.filesystem.denyWrite': (s) => { s.sandbox.filesystem.denyWrite = []; },
    'sandbox.filesystem.denyRead': (s) => { s.sandbox.filesystem.denyRead = ['~/.config/cdp6-core', '~/.claude/projects']; },
    'sandbox.excludedCommands': (s) => { s.sandbox.excludedCommands.push('npm test *'); },
    'sandbox.network.allowedDomains': (s) => { s.sandbox.network.allowedDomains.push('*'); },
  };
  for (const [key, mutate] of Object.entries(cases)) {
    const w = world();
    writeSettings(w, mutate);
    const res = run(w);
    assert.equal(res.exit, 1, key);
    assert.ok(failed(res, 'settings-file').some((f) => f.item === key || f.item.startsWith(key)), `${key}: ${res.text}`);
  }
});

test('fires: web or connector egress open in auto', () => {
  const w = world();
  writeSettings(w, (s) => { s.permissions.deny = s.permissions.deny.filter((d) => d !== 'WebFetch'); });
  assert.deepEqual(failed(run(w), 'settings-file').map((f) => f.item), ['permissions.deny WebFetch']);
});

test('fires: web search open in auto', () => {
  const w = world();
  writeSettings(w, (s) => { s.permissions.deny = s.permissions.deny.filter((d) => d !== 'WebSearch'); });
  assert.deepEqual(failed(run(w), 'settings-file').map((f) => f.item), ['permissions.deny WebSearch']);
});

test('fires: claude.ai connectors open in auto', () => {
  const w = world();
  writeSettings(w, (s) => { delete s.disableClaudeAiConnectors; });
  assert.deepEqual(failed(run(w), 'settings-file').map((f) => f.item), ['disableClaudeAiConnectors']);
  const off = world();
  writeSettings(off, (s) => { s.disableClaudeAiConnectors = false; });
  assert.deepEqual(failed(run(off), 'settings-file').map((f) => f.item), ['disableClaudeAiConnectors']);
});

test('fires: bypass mode not disabled', () => {
  const w = world();
  writeSettings(w, (s) => { delete s.permissions.disableBypassPermissionsMode; });
  assert.deepEqual(failed(run(w), 'settings-file').map((f) => f.item), ['permissions.disableBypassPermissionsMode']);
  const wrong = world();
  writeSettings(wrong, (s) => { s.permissions.disableBypassPermissionsMode = 'enable'; });
  assert.equal(run(wrong).exit, 1);
});

test('the preflight prints sandbox.allowUnsandboxedCommands and sandbox.failIfUnavailable whether the check passes or not', () => {
  const w = world();
  assert.deepEqual(run(w).info.filter((i) => i.startsWith('sandbox.')), ['sandbox.allowUnsandboxedCommands false', 'sandbox.failIfUnavailable true']);
  writeSettings(w, (s) => { s.sandbox.allowUnsandboxedCommands = true; delete s.sandbox.failIfUnavailable; });
  const res = run(w);
  assert.deepEqual(res.info.filter((i) => i.startsWith('sandbox.')), ['sandbox.allowUnsandboxedCommands true', 'sandbox.failIfUnavailable not set']);
  assert.match(res.text, /info sandbox\.allowUnsandboxedCommands true/);
});

test('fires: missing user-settings rule', () => {
  const w = world();
  put(join(w.home, '.claude', 'settings.json'), JSON.stringify({ permissions: { deny: ['Read(~/.config/cdp6-core/**)'] } }));
  const hits = failed(run(w), 'user-settings');
  assert.ok(hits.some((h) => /Edit deny rule on the data directory/.test(h.item)), JSON.stringify(hits));
  assert.ok(hits.every((h) => h.fix.length > 0));
  const none = world();
  rmSync(join(none.home, '.claude', 'settings.json'));
  assert.match(failed(run(none), 'user-settings')[0].found, /not readable/);
});

test('fires: stale active run', () => {
  const w = world();
  bindRun(w, 'RUN-20261105-1');
  const res = run(w, { args: { run: 'RUN-20261106-1' } });
  const [hit] = failed(res, 'data-directory');
  assert.match(hit.found, /active run RUN-20261105-1/);
  bindRun(w, 'RUN-20261106-1');
  assert.equal(failed(run(w, { args: { run: 'RUN-20261106-1' } }), 'data-directory').length, 1);
  const done = world();
  bindRun(done, 'RUN-20261105-1', { status: 'DONE' });
  passes(run(done), 'data-directory');
  const named = world();
  bindRun(named, 'RUN-20261106-1');
  passes(run(named, { args: { run: 'RUN-20261106-1' } }), 'data-directory');
});

test('fires: finished spawn without capture and probe record that does not verify', () => {
  const w = world();
  bindRun(w, 'RUN-20261106-1', { pending: { toolu_1: { agent_id: 'a1', finished_at: '2026-11-06T09:00:00.000Z' } } });
  const [spawn] = failed(run(w, { args: { run: 'RUN-20261106-1' } }), 'data-directory');
  assert.match(spawn.found, /spawn toolu_1 .* finished_at and no capture/);
  const forged = world();
  put(join(forged.data, 'probes', '2.1.999.json'), JSON.stringify({ claude_version: '2.1.999', accepted: { sha256: 'a'.repeat(64) }, rows: {} }));
  const [rec] = failed(run(forged), 'data-directory');
  assert.match(rec.found, /probes\/2\.1\.999\.json does not verify/);
});

test('fires: credential variable in orchestrator environment', () => {
  const w = world({ orchestratorEnviron: 'PATH=/usr/bin\0GH_TOKEN=zq7k\0HOME=/x' });
  const res = run(w);
  assert.equal(res.exit, 1);
  const hits = failed(res, 'environment');
  assert.deepEqual(hits.map((h) => h.item), ['orchestrator pid 100 GH_TOKEN']);
});

test('fires: credential variable in live-session environment', () => {
  const w = world();
  w.env.AWS_SECRET_ACCESS_KEY = 'wk9m';
  w.env.Db_Password = 'x';
  const res = run(w);
  assert.equal(res.exit, 1);
  assert.deepEqual(failed(res, 'environment').map((h) => h.item), ['own AWS_SECRET_ACCESS_KEY', 'own Db_Password']);
});

test('fires: credential value printed', () => {
  const w = world({ orchestratorEnviron: 'GH_TOKEN=zq7k' });
  w.env.AWS_SECRET_ACCESS_KEY = 'wk9m';
  const res = run(w);
  const everything = JSON.stringify(res) + res.text;
  assert.ok(!everything.includes('zq7k'));
  assert.ok(!everything.includes('wk9m'));
  assert.match(res.text, /GH_TOKEN/);
  assert.match(res.text, /AWS_SECRET_ACCESS_KEY/);
});

test('the credential check passes without such names and with CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1 in that environment, stating the Q-24 conflict', () => {
  const clean = world({ orchestratorEnviron: 'PATH=/usr/bin\0HOME=/x\0CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=0' });
  passes(run(clean), 'environment');
  assert.ok(!run(clean).info.some((i) => /Q-24/.test(i)));
  const scrubbed = world({ orchestratorEnviron: 'GH_TOKEN=x\0CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1' });
  scrubbed.env.AWS_SECRET_ACCESS_KEY = 'y';
  scrubbed.env.CLAUDE_CODE_SUBPROCESS_ENV_SCRUB = '1';
  const res = run(scrubbed);
  passes(res, 'environment');
  assert.equal(res.info.filter((i) => /Q-24/.test(i)).length, 2);
  assert.match(res.text, /CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1.*Q-24/);
  const half = world({ orchestratorEnviron: 'GH_TOKEN=x\0CLAUDE_CODE_SUBPROCESS_ENV_SCRUB=1' });
  half.env.AWS_SECRET_ACCESS_KEY = 'y';
  assert.deepEqual(failed(run(half), 'environment').map((h) => h.item), ['own AWS_SECRET_ACCESS_KEY']);
});

test('fires: orchestrator environment not readable', () => {
  const w = world();
  rmSync(join(w.proc, String(ORCHESTRATOR), 'environ'));
  assert.match(failed(run(w), 'environment')[0].found, /not readable/);
});

function repoSettings(w, file, doc) {
  put(join(w.project, file), JSON.stringify(doc));
}

test('fires: repository settings widen the run', () => {
  for (const file of ['.claude/settings.json', '.claude/settings.local.json']) {
    const w = world();
    repoSettings(w, file, { permissions: { allow: ['Bash(npm test:*)'] } });
    const res = run(w);
    assert.equal(res.exit, 1);
    const [hit] = failed(res, 'project-settings');
    assert.equal(hit.item, `${file} permissions.allow`);
    assert.match(hit.found, new RegExp(file.replace('.', '\\.')));
  }
});

test('fires: repository hooks widen the run', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { hooks: { PreToolUse: [] } });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json hooks']);
});

test('fires: repository mcpServers widen the run', () => {
  const w = world();
  repoSettings(w, '.claude/settings.local.json', { mcpServers: {} });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.local.json mcpServers']);
});

test('fires: all project MCP servers enabled', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { enableAllProjectMcpServers: false });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json enableAllProjectMcpServers']);
});

test('fires: project .mcp.json present', () => {
  const w = world();
  put(join(w.project, '.mcp.json'), '{}');
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.mcp.json']);
});

test('fires: repository settings file that cannot be read', () => {
  const w = world();
  put(join(w.project, '.claude', 'settings.json'), '{ "permissions": ');
  assert.match(failed(run(w), 'project-settings')[0].found, /not readable as JSON/);
});

test('a project whose settings hold only $schema, permissions.deny and permissions.ask passes', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { $schema: 'https://json.schemastore.org/claude-code-settings.json', permissions: { deny: ['Bash', 'WebFetch'], ask: ['Edit', 'WebSearch'] } });
  repoSettings(w, '.claude/settings.local.json', { permissions: { ask: ['Edit'] } });
  passes(run(w), 'project-settings');
  assert.equal(run(w).exit, 0);
  passes(run(world()), 'project-settings');
});

test('fires: a project deny rule with a path passes the allowlist', () => {
  for (const file of ['.claude/settings.json', '.claude/settings.local.json']) {
    const w = world();
    repoSettings(w, file, { permissions: { deny: ['WebFetch', 'Read(./many/**)'] } });
    const hits = failed(run(w), 'project-settings');
    assert.deepEqual(hits.map((h) => h.item), [`${file} permissions.deny`]);
    assert.match(hits[0].found, /Read\(\.\/many\/\*\*\)/);
  }
  const edit = world();
  repoSettings(edit, '.claude/settings.json', { permissions: { deny: ['Edit(/etc/**)'] } });
  failed(run(edit), 'project-settings');
});

test('fires: repository statusLine passes the preflight', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { statusLine: { type: 'command', command: 'node x.js' } });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json statusLine']);
});

test('fires: repository disableAllHooks passes check (i)', () => {
  for (const value of [true, false]) {
    const w = world();
    repoSettings(w, '.claude/settings.local.json', { disableAllHooks: value });
    assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.local.json disableAllHooks']);
  }
});

test('fires: an empty permissions.allow list passes', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { permissions: { allow: [] } });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json permissions.allow']);
});

test('fires: a permissions key outside the allowlist passes', () => {
  for (const key of ['defaultMode', 'additionalDirectories', 'disableBypassPermissionsMode']) {
    const w = world();
    repoSettings(w, '.claude/settings.json', { permissions: { deny: ['WebFetch'], [key]: key === 'defaultMode' ? 'bypassPermissions' : [] } });
    assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), [`.claude/settings.json permissions.${key}`]);
  }
});

test('fires: a denyRead glob in the project settings is left out of the counted paths', () => {
  const w = world();
  for (let i = 0; i < 1196; i += 1) put(join(w.project, 'many', `d${i % 20}`, `.secret${i}`), '');
  const glob = `${w.project}/many/**/.secret*`;
  put(join(w.project, '.claude', 'settings.json'), JSON.stringify({ sandbox: { filesystem: { denyRead: [glob] } } }));
  const res = run(w);
  assert.deepEqual(failed(res, 'project-settings').map((h) => h.item), ['.claude/settings.json sandbox']);
  passes(res, 'sandbox-profile');
  assert.equal(res.exit, 1);
});

test('control: the same glob in the live settings fails check (a)', () => {
  const w = world();
  for (let i = 0; i < 1196; i += 1) put(join(w.project, 'many', `d${i % 20}`, `.secret${i}`), '');
  writeSettings(w, (s) => s.sandbox.filesystem.denyRead.push(`${w.project}/many/**/.secret*`));
  failed(run(w), 'sandbox-profile');
});

test('fires: project settings env setting NODE_OPTIONS passes the preflight', () => {
  const w = world();
  put(join(w.project, '.claude', 'settings.json'), JSON.stringify({ env: { NODE_OPTIONS: `--require ${join(w.project, 'x.cjs')}` } }));
  failed(run(w), 'project-settings');
});

function cli(w, extra, { env = { HOME: w.home, PATH: w.env.PATH } } = {}) {
  const base = ['--settings', w.settingsFile, '--settings-sha256', 'a'.repeat(64), '--plugin-dir', w.plugin, '--project', w.project, '--data-dir', w.data, '--orchestrator-pid', String(process.pid)];
  const r = spawnSync(process.execPath, [join(HERE, 'preflight.mjs'), ...base, ...extra], { encoding: 'utf8', env });
  return { status: r.status, stdout: r.stdout, stderr: r.stderr };
}

test('the command line prints one FAIL line per failure naming check, item, value and fix, and exits 1', () => {
  const w = world();
  const r = cli(w, []);
  assert.equal(r.status, 1, r.stdout + r.stderr);
  const lines = r.stdout.trim().split('\n');
  assert.ok(lines.every((l) => /^(info|FAIL) /.test(l)), r.stdout);
  assert.ok(lines.some((l) => /^FAIL settings-file sha256: found file [0-9a-f]{64}, --settings-sha256 a{64}; fix: /.test(l)), r.stdout);
  assert.equal(r.stderr, '');
});

test('the command line with --json prints the result as one JSON document', () => {
  const w = world();
  const r = cli(w, ['--json']);
  const doc = JSON.parse(r.stdout);
  assert.equal(doc.ok, false);
  assert.equal(r.status, 1);
  assert.ok(doc.failures.some((f) => f.check === 'settings-file' && f.item === 'sha256' && f.found && f.fix));
  assert.ok(Array.isArray(doc.info));
});

test('fires: missing or malformed arguments give a FAIL arguments line and exit 1', () => {
  const w = world();
  const none = spawnSync(process.execPath, [join(HERE, 'preflight.mjs')], { encoding: 'utf8', env: { HOME: w.home, PATH: w.env.PATH } });
  assert.equal(none.status, 1);
  assert.match(none.stdout, /^FAIL arguments --settings: found missing; fix: pass --settings/m);
  assert.match(none.stdout, /^FAIL arguments --orchestrator-pid: found missing/m);
  const bad = cli(w, ['--orchestrator-pid', 'abc']);
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /^FAIL arguments --orchestrator-pid: found abc; fix: /m);
  const unknown = cli(w, ['--write']);
  assert.match(unknown.stdout, /^FAIL arguments --write: found unknown argument/m);
});

test('fires: preflight writes a file', () => {
  const w = world();
  for (let i = 0; i < 5; i += 1) mkdirSync(join(w.tmp, `r${i}`, '.git'), { recursive: true });
  writeSettings(w, (s) => { delete s.disableClaudeAiConnectors; s.sandbox.filesystem.denyRead.push('~/**/.env*'); });
  bindRun(w, 'RUN-20261105-1');
  procEntry(w, 200, 1, w.claudeExe, ['claude']);
  const before = snapshot(w.base);
  const res = run(w, { args: { settingsSha256: 'a'.repeat(64) }, ctx: { tmpRoots: [w.tmp, w.home] } });
  assert.equal(res.exit, 1);
  assert.deepEqual(snapshot(w.base), before);
});

const PREFLIGHT_FILES = ['scripts/preflight.mjs', ...readdirSync(join(HERE, '..', 'lib')).filter((f) => /^preflight-.*\.mjs$/.test(f) && !f.endsWith('.test.mjs')).map((f) => `lib/${f}`)];

test('fires: write call in a preflight file', () => {
  assert.ok(PREFLIGHT_FILES.length >= 6, PREFLIGHT_FILES.join(', '));
  for (const f of PREFLIGHT_FILES) {
    const text = readFileSync(join(HERE, '..', f), 'utf8');
    assert.doesNotMatch(text, /\b(writeFile|appendFile|mkdir|rm|rmdir|unlink|rename|copyFile|cp|symlink|link|truncate|chmod|chown|utimes|createWriteStream)(Sync)?\b|\bopenSync\(|\bopen\(|node:fs\/promises/, f);
  }
});

test('the preflight source opens no network connection', () => {
  const sources = PREFLIGHT_FILES.map((f) => readFileSync(join(HERE, '..', f), 'utf8')).join('\n');
  assert.doesNotMatch(sources, /node:(net|http|https|http2|dgram|dns|tls)|\bfetch\(|XMLHttpRequest|WebSocket/);
  assert.doesNotMatch(sources, /writeFile|appendFile|mkdir|rmSync|unlink|rename|copyFile|createWriteStream|\bopenSync\(/);
});

test('the own .git of the project and its .worktrees pass', () => {
  const w = world();
  put(join(w.project, '.worktrees', 'a', '.git'), 'gitdir: x\n');
  put(join(w.project, '.worktrees', 'b', 'inner', '.git'), 'gitdir: x\n');
  passes(run(w, { ctx: { tmpRoots: [w.tmp, w.home] } }), 'git-repositories');
});

test('fires: --settings file inside a sandbox-writable root', () => {
  const w = world();
  const inside = join(w.project, 'settings-live.json');
  put(inside, JSON.stringify(w.settings));
  const res = run(w, { args: { settings: inside, settingsSha256: sha256(inside) } });
  assert.equal(res.exit, 1, res.text);
  assert.ok(failed(res, 'settings-file').some((f) => /writable/.test(f.found)), res.text);
});

test('fires: a denyRead entry that covers .env but not .env.local', () => {
  const w = world();
  writeSettings(w, (s) => { s.sandbox.filesystem.denyRead = s.sandbox.filesystem.denyRead.map((e) => (e === `${w.project}/**/.env*` ? `${w.project}/**/.env` : e)); });
  assert.ok(failed(run(w), 'settings-file').some((f) => f.item.includes('.env')), 'a .env-only entry passes');
});

function managedFile(w, name, doc) {
  put(join(w.managed, name), JSON.stringify(doc));
}

test('fires: calibration read from another record path', () => {
  const w = world();
  rewriteRecord(w, (r) => {
    r.rows['A-12'].calibration = { base: 1153, per_path: 7 };
    delete r.rows['A-12'].modes.auto.calibration;
  });
  assert.match(failed(run(w), 'sandbox-profile')[0].found, /no calibration/);
});

test('fires: record column and check (a) count different paths for non-glob and .git entries', () => {
  const w = world();
  for (let i = 0; i < 6; i += 1) put(join(w.project, 'envs', `.env${i}`), '');
  for (let i = 0; i < 4; i += 1) put(join(w.project, 'keys', `k${i}.pem`), '');
  for (let i = 0; i < 3; i += 1) mkdirSync(join(w.tmp, `r${i}`, '.git'), { recursive: true });
  put(join(w.home, '.claude', 'settings.json'), '{}');
  writeSettings(w, (s) => { s.sandbox.filesystem = { denyRead: [`${w.project}/**/.env*`, `${w.project}/**/*.pem`, '~/.ssh', '~/.aws', '~/.config/gh'] }; });
  const res = run(w);
  assert.ok(res.info.includes('counted paths 17'), res.info.join('; '));
  assert.ok(res.info.includes('sandbox profile estimate 1272 against 9000 (17 paths at 7 each, base 1153)'), res.info.join('; '));
});

test('fires: calibration rows with a non-positive per_path', () => {
  for (const args of ['9525', '9500']) {
    const w = world();
    const data = join(w.base, 'fresh-data');
    const rows = goodRows(VERSION).map((r) => (r.row === 'A-12' && r.counted_paths === '1197' ? { ...r, bwrap_args: args } : r));
    assert.throws(() => acceptedRecord({ env: w.env, data, rows }), /a12-calibration-slope/);
    assert.equal(readProbeRecord(data, VERSION, w.env), null);
    const res = run(w, { args: { dataDir: data } });
    assert.match(failed(res, 'sandbox-profile')[0].found, /no calibration/);
  }
});

test('fires: PATH version differs from running version', () => {
  const w = world();
  stubClaude(w.bin, '2.1.319');
  const hits = failed(run(w), 'probe-record');
  assert.match(hits[0].found, /claude --version on PATH is 2\.1\.319, the running Claude Code is 2\.1\.318/);
});

test('fires: orchestrator pid is not a Claude Code process', () => {
  const w = world();
  rmSync(join(w.proc, String(ORCHESTRATOR), 'exe'));
  symlinkSync('/usr/bin/bash', join(w.proc, String(ORCHESTRATOR), 'exe'));
  assert.match(failed(run(w), 'probe-record')[0].found, /not recognised as Claude Code/);
});

test('fires: --settings symlink into a writable root', () => {
  const w = world();
  const real = join(w.project, 'real-settings.json');
  put(real, JSON.stringify(w.settings));
  const link = join(w.home, 'live', 'link.json');
  symlinkSync(real, link);
  const res = run(w, { args: { settings: link, settingsSha256: sha256(real) } });
  assert.ok(failed(res, 'settings-file').some((f) => /writable/.test(f.found)), res.text);
  const outside = world();
  passes(run(outside), 'settings-file');
});

test('fires: nested .env not covered', () => {
  const w = world();
  writeSettings(w, (s) => { s.sandbox.filesystem.denyRead = s.sandbox.filesystem.denyRead.map((e) => (e === `${w.project}/**/.env*` ? `${w.project}/.env*` : e)); });
  const hits = failed(run(w), 'settings-file').filter((f) => f.item.includes('.env'));
  assert.deepEqual(hits.map((f) => f.item), [`sandbox.filesystem.denyRead sample ${w.project}/a/b/.env`]);
});

test('fires: user settings turn every hook off', () => {
  const w = world();
  put(join(w.home, '.claude', 'settings.json'), JSON.stringify({ ...userSettings(), disableAllHooks: true }));
  const hits = failed(run(w), 'hooks-off');
  assert.ok(hits.some((h) => /settings\.json/.test(h.found) && /disableAllHooks/.test(h.item)), JSON.stringify(hits));
});

test('fires: managed settings turn every hook off', () => {
  for (const file of ['managed-settings.json', 'managed-settings.d/10-extra.json']) {
    const w = world();
    managedFile(w, file, { disableAllHooks: true });
    const hits = failed(run(w), 'hooks-off');
    assert.ok(hits.some((h) => h.found.includes(file) && /disableAllHooks/.test(h.item)), `${file}: ${JSON.stringify(hits)}`);
  }
});

test('fires: managed-hooks-only in managed settings without cdp6-core force-enabled', () => {
  const w = world();
  managedFile(w, 'managed-settings.json', { allowManagedHooksOnly: true });
  const hits = failed(run(w), 'hooks-off');
  assert.deepEqual(hits.map((h) => h.item), ['managed-settings.json allowManagedHooksOnly']);
  assert.match(hits[0].found, /does not force-enable cdp6-core/);
});

test('fires: managed-hooks-only in managed settings with cdp6-core force-enabled', () => {
  const w = world();
  managedFile(w, 'managed-settings.json', { allowManagedHooksOnly: true, enabledPlugins: { 'cdp6-core@claude-skills': true } });
  const hits = failed(run(w), 'hooks-off');
  assert.deepEqual(hits.map((h) => h.item), ['managed-settings.json allowManagedHooksOnly']);
  assert.match(hits[0].found, /force-enables cdp6-core/);
});

test('managed-hooks-only outside managed settings leaves the hooks-off check passing', () => {
  const w = world();
  put(join(w.home, '.claude', 'settings.json'), JSON.stringify({ ...userSettings(), allowManagedHooksOnly: true }));
  put(join(w.project, '.claude', 'settings.json'), JSON.stringify({ allowManagedHooksOnly: true }));
  passes(run(w), 'hooks-off');
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json allowManagedHooksOnly']);
});

test('fires: live settings without disableAllHooks false', () => {
  const w = world();
  writeSettings(w, (s) => { delete s.disableAllHooks; });
  assert.deepEqual(failed(run(w), 'hooks-off').map((h) => h.item), ['live settings disableAllHooks']);
  const on = world();
  writeSettings(on, (s) => { s.disableAllHooks = true; });
  assert.equal(failed(run(on), 'hooks-off').length, 1);
});

test('fires: managed drop-in not counted', () => {
  const w = world();
  for (let i = 0; i < 1196; i += 1) put(join(w.home, 'many', `d${i % 20}`, `.env${i}`), '');
  managedFile(w, 'managed-settings.d/20-env.json', { sandbox: { filesystem: { denyRead: ['~/**/.env*'] } } });
  const [hit] = failed(run(w), 'sandbox-profile');
  assert.match(hit.found, /~\/\*\*\/\.env\* expands to 1196 paths/);
});

test('fires: managed settings key not printed', () => {
  const w = world();
  managedFile(w, 'managed-settings.json', { sandbox: { allowUnsandboxedCommands: false }, permissions: { defaultMode: 'auto' } });
  const info = run(w).info;
  assert.ok(info.includes(`managed settings ${join(w.managed, 'managed-settings.json')} sets sandbox.allowUnsandboxedCommands`), info.join('; '));
  assert.ok(info.includes(`managed settings ${join(w.managed, 'managed-settings.json')} sets permissions.defaultMode`), info.join('; '));
});

test('fires: WSL policy-chain note missing', () => {
  const w = world();
  assert.ok(run(w, { ctx: { wsl: true } }).info.some((i) => /wslInheritsWindowsSettings.*Windows policy chain.*host line/.test(i)));
  assert.ok(!run(w, { ctx: { wsl: false } }).info.some((i) => /wslInheritsWindowsSettings/.test(i)));
});

test('fires: unbound pending spawn not listed', () => {
  const w = world();
  bindRun(w, 'RUN-20261106-1', { pending: { toolu_u: { agent_type: 'cdp6-core:devils-advocate', agent_id: null, task: 'D-1' } } });
  const hits = failed(run(w, { args: { run: 'RUN-20261106-1' } }), 'data-directory');
  assert.equal(hits.length, 1);
  assert.match(hits[0].found, /toolu_u/);
  assert.match(hits[0].found, /devils-advocate/);
  assert.match(hits[0].found, /D-1/);
  assert.match(hits[0].fix, /void/);
});

test('fires: stop entry of an unbound agent not listed', () => {
  const w = world();
  bindRun(w, 'RUN-20261106-1', { counters: { version: 1, stops: { 'agent-9': { agent_type: 'cdp6-core:devils-advocate', finished_at: '2026-11-06T09:00:00.000Z' } } } });
  const hits = failed(run(w, { args: { run: 'RUN-20261106-1' } }), 'data-directory');
  assert.match(hits[0].found, /agent-9/);
  assert.match(hits[0].fix, /void/);
  bindRun(w, 'RUN-20261106-1', { counters: { version: 1, stops: { 'agent-9': { agent_type: 'cdp6-core:devils-advocate', finished_at: 'x', void: true } } } });
  passes(run(w, { args: { run: 'RUN-20261106-1' } }), 'data-directory');
});

test('fires: settings hashed from a second read', () => {
  const w = world();
  const good = readFileSync(w.settingsFile);
  const sha = sha256(w.settingsFile);
  let reads = 0;
  const read = (path) => {
    if (path !== w.settingsFile) return readFileSync(path);
    reads += 1;
    return reads === 1 ? good : Buffer.from('{}');
  };
  const res = run(w, { args: { settingsSha256: sha }, ctx: { read } });
  assert.equal(reads, 1);
  passes(res, 'settings-file');
});

test('fires: throwing check hides the others', () => {
  const w = world();
  writeSettings(w, (s) => { s.sandbox.filesystem.allowWrite = 5; });
  put(join(w.project, '.mcp.json'), '{}');
  const res = run(w);
  assert.equal(res.exit, 1);
  assert.ok(res.failures.some((f) => f.item === 'check could not run'), res.text);
  assert.ok(failed(res, 'project-settings').some((f) => f.item === '.mcp.json'), res.text);
});

test('fires: a Claude Code process and a stdio MCP child in the process group of the preflight are skipped', () => {
  const w = world();
  const restat = (pid, ppid, comm) => writeFileSync(join(w.proc, String(pid), 'stat'), `${pid} (${comm}) S ${ppid} ${ORCHESTRATOR} ${pid} 0 -1 0 0 0 0 0\n`);
  restat(101, ORCHESTRATOR, 'bash');
  restat(SELF, 101, 'node');
  procEntry(w, 110, ORCHESTRATOR, '/usr/bin/node', ['node', '/opt/mcp/server.js', '--stdio'], '', ORCHESTRATOR);
  procEntry(w, 200, 101, w.claudeExe, ['claude', '--resume', 'abc'], '', ORCHESTRATOR);
  assert.deepEqual(failed(run(w), 'processes').map((h) => h.item), ['pid 110', 'pid 200']);
});

test('control: a background job of a non-interactive shell shares the process group of the next foreground command', () => {
  const r = spawnSync('sh', ['-c', 'sleep 3 & cat /proc/$!/stat; cat /proc/self/stat; kill $!'], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const pgrp = (line) => line.slice(line.lastIndexOf(')') + 2).split(' ')[2];
  const [background, foreground] = r.stdout.trim().split('\n');
  assert.equal(pgrp(background), pgrp(foreground));
});

test('fires: a project ask rule with a specifier passes the allowlist', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { permissions: { ask: ['Bash(npm publish:*)'] } });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json permissions.ask']);
});

test('fires: a project Cd deny rule with a path passes the allowlist', () => {
  const w = world();
  repoSettings(w, '.claude/settings.json', { permissions: { deny: ['Cd(~/code/**)'] } });
  assert.deepEqual(failed(run(w), 'project-settings').map((h) => h.item), ['.claude/settings.json permissions.deny']);
});
