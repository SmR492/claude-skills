import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as DD from '../lib/data-dir.mjs';
import { grantsPath, addGrant, activeGrant } from '../lib/grants.mjs';
import { usageLogPath } from '../lib/contract.mjs';

const { dataDir, pointerPath, cacheDir, writeDataDirPointer } = DD;
const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const BOOTSTRAP = join(PLUGIN, 'hooks', 'bootstrap.mjs');

test('dataDir resolves the variable, then the pointer file, then the cache directory', () => {
  const home = mkdtempSync(join(tmpdir(), 'cdp5-data-'));
  try {
    const fallback = join(home, '.cache', 'cdp5-agents');
    assert.equal(cacheDir({ HOME: home }), fallback);
    assert.equal(dataDir({ HOME: home }), fallback, 'no variable, no pointer');
    assert.equal(dataDir({ HOME: home, CLAUDE_PLUGIN_DATA: '/plugin/data' }), '/plugin/data', 'the variable wins');
    const target = join(home, 'plugin-data');
    mkdirSync(join(home, '.cache', 'cdp5-agents'), { recursive: true });
    writeFileSync(pointerPath({ HOME: home }), `${target}\n`);
    assert.equal(dataDir({ HOME: home }), fallback, 'a pointer to a missing directory is ignored');
    mkdirSync(target);
    assert.equal(dataDir({ HOME: home }), target, 'the pointer names an existing directory');
    assert.equal(dataDir({ HOME: home, CLAUDE_PLUGIN_DATA: '/plugin/data' }), '/plugin/data', 'the variable still wins over the pointer');
    assert.equal(grantsPath({ HOME: home }), join(target, 'grants.json'));
    assert.equal(usageLogPath({ HOME: home }), join(target, 'usage-log.jsonl'));
    writeFileSync(pointerPath({ HOME: home }), '\n');
    assert.equal(dataDir({ HOME: home }), fallback, 'an empty pointer is ignored');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('writeDataDirPointer creates the data directory and the pointer', () => {
  const home = mkdtempSync(join(tmpdir(), 'cdp5-data-'));
  try {
    const data = join(home, 'hook-data');
    const { dir, pointer } = writeDataDirPointer({ HOME: home, CLAUDE_PLUGIN_DATA: data });
    assert.equal(dir, data);
    assert.equal(pointer, pointerPath({ HOME: home }));
    assert.ok(existsSync(data));
    assert.equal(readFileSync(pointer, 'utf8'), `${data}\n`);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('bootstrap writes the pointer so that grant-run in the plain shell and guard-bash in the hook share one grants.json', () => {
  const home = mkdtempSync(join(tmpdir(), 'cdp5-data-'));
  try {
    const data = join(home, 'hook-data');
    const hookEnv = { PATH: process.env.PATH, HOME: home, CLAUDE_PLUGIN_ROOT: PLUGIN, CLAUDE_PLUGIN_DATA: data };
    const r = spawnSync('node', [BOOTSTRAP], { env: hookEnv, encoding: 'utf8', input: JSON.stringify({ source: 'startup', session_id: 'abc-123' }) });
    assert.equal(r.status, 0, r.stderr);
    const ctx = JSON.parse(r.stdout).hookSpecificOutput.additionalContext;
    assert.match(ctx, /session startup/);
    assert.match(ctx, /--session=abc-123/, 'the session id is named for grant commands');
    assert.equal(readFileSync(join(home, '.cache', 'cdp5-agents', 'session'), 'utf8').trim(), 'abc-123', 'session pointer next to the data-dir pointer');
    assert.equal(DD.readSessionPointer?.({ HOME: home }), 'abc-123');
    assert.ok(ctx.includes(`node ${PLUGIN}/scripts/worktree-setup.mjs`), 'absolute path of worktree-setup');
    assert.ok(ctx.includes(`node ${PLUGIN}/scripts/grant-run.mjs`), 'absolute path of grant-run');
    assert.ok(ctx.includes(`live in ${data}`), 'data directory named');
    assert.equal(readFileSync(pointerPath({ HOME: home }), 'utf8').trim(), data);
    // the orchestrator's shell has no CLAUDE_PLUGIN_DATA; both sides now resolve the same file
    const shellEnv = { HOME: home };
    assert.equal(grantsPath(shellEnv), grantsPath(hookEnv));
    const wt = join(home, 'wt');
    const project = join(home, 'project');
    mkdirSync(wt);
    mkdirSync(project);
    addGrant({ agent: 'adversarial-auditor', root: wt, project, session: DD.readSessionPointer(shellEnv), isWorktree: () => true }, shellEnv);
    assert.equal(activeGrant('adversarial-auditor', hookEnv, Date.now(), 'abc-123').root, wt);
    assert.equal(activeGrant('adversarial-auditor', hookEnv).session, 'abc-123', 'the session pointer binds the grant');
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
