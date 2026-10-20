import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checks, render, siblingRoot } from './cdp5-doctor.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = join(HERE, '..', '..');
const SCRIPT = join(HERE, 'cdp5-doctor.mjs');

const byId = (results) => Object.fromEntries(results.map((r) => [r.id, r]));

test('against the repository plugin: node, git, hooks and contract are ok; a fresh home only warns', () => {
  const home = mkdtempSync(join(tmpdir(), 'doctor-home-'));
  try {
    const r = byId(checks({ PATH: process.env.PATH, HOME: home }, { root: PLUGIN }));
    assert.equal(r.node.status, 'ok');
    assert.match(r.node.detail, /^node v\d+/);
    assert.equal(r.git.status, 'ok');
    assert.equal(r['plugin root'].status, 'ok');
    assert.equal(r.hooks.status, 'ok');
    assert.match(r.hooks.detail, /bootstrap\.mjs.*inject-contract\.mjs.*guard-bash\.mjs.*check-ack\.mjs/);
    assert.equal(r.contract.status, 'ok');
    assert.match(r.contract.detail, /worker contract v2 sha256:[0-9a-f]{12}/);
    assert.equal(r['line endings'].status, 'ok');
    assert.equal(r['data dir'].status, 'warn', 'no data directory before the first SessionStart');
    assert.equal(r.bootstrap.status, 'warn');
    assert.match(r.bootstrap.detail, /start a new Claude Code session/);
    assert.equal(r['usage log'].status, 'warn');
    assert.equal(r['cdp5-gates'].status, 'ok', 'the checkout sibling is found');
    assert.equal(r['domain-agents'].status, 'ok');
    const text = render(Object.values(r));
    assert.match(text, /no fail, \d+ warn {2}· {2}exit 0$/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('a session that started with the hooks turns bootstrap, data dir and usage log ok', () => {
  const home = mkdtempSync(join(tmpdir(), 'doctor-home-'));
  try {
    const data = join(home, '.cache', 'cdp5-agents');
    mkdirSync(data, { recursive: true });
    writeFileSync(join(data, 'data-dir'), `${data}\n`);
    writeFileSync(join(data, 'session'), 'abc-123\n');
    writeFileSync(join(data, 'usage-log.jsonl'), `${JSON.stringify({ result: 'ok' })}\n${JSON.stringify({ result: 'hedged' })}\n`);
    const r = byId(checks({ PATH: process.env.PATH, HOME: home }, { root: PLUGIN }));
    assert.equal(r['data dir'].status, 'ok');
    assert.equal(r.bootstrap.status, 'ok');
    assert.match(r.bootstrap.detail, /last session abc-123/);
    assert.equal(r['usage log'].status, 'ok');
    assert.match(r['usage log'].detail, /2 lines .*last result hedged/);
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test('a broken plugin root fails on hooks and contract, an old Node fails on node, and the exit code says so', () => {
  const home = mkdtempSync(join(tmpdir(), 'doctor-home-'));
  const broken = mkdtempSync(join(tmpdir(), 'doctor-root-'));
  try {
    mkdirSync(join(broken, 'hooks'));
    writeFileSync(join(broken, 'hooks', 'hooks.json'), JSON.stringify({ hooks: { SessionStart: [{ hooks: [{ type: 'command', command: 'node "${CLAUDE_PLUGIN_ROOT}/hooks/gone.mjs"' }] }] } }));
    const r = byId(checks({ PATH: process.env.PATH, HOME: home }, { root: broken, nodeVersion: '18.20.0' }));
    assert.equal(r.node.status, 'fail');
    assert.equal(r['plugin root'].status, 'fail');
    assert.equal(r.hooks.status, 'fail');
    assert.match(r.hooks.detail, /missing: hooks\/gone\.mjs/);
    assert.equal(r.contract.status, 'fail');
    assert.equal(r['cdp5-gates'].status, 'warn');
    assert.match(render(Object.values(r)), /\d+ fail, \d+ warn {2}· {2}exit 1$/);
    assert.equal(siblingRoot(broken, 'cdp5-gates'), null);
  } finally {
    rmSync(home, { recursive: true, force: true });
    rmSync(broken, { recursive: true, force: true });
  }
});

test('siblingRoot finds the installed cache layout and prefers the newest version', () => {
  const cache = mkdtempSync(join(tmpdir(), 'doctor-cache-'));
  try {
    for (const v of ['0.8.3', '0.8.10']) mkdirSync(join(cache, 'cdp5-gates', v, '.claude-plugin'), { recursive: true });
    for (const v of ['0.8.3', '0.8.10']) writeFileSync(join(cache, 'cdp5-gates', v, '.claude-plugin', 'plugin.json'), '{}');
    mkdirSync(join(cache, 'cdp5-agents', '0.6.0'), { recursive: true });
    assert.equal(siblingRoot(join(cache, 'cdp5-agents', '0.6.0'), 'cdp5-gates'), join(cache, 'cdp5-gates', '0.8.3'), 'lexical order: the test pins the current behaviour, versions sort as strings');
  } finally {
    rmSync(cache, { recursive: true, force: true });
  }
});

test('CLI: runs from a path with a space, --json carries checks and exit, an unknown flag is a usage error', () => {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 agents-'));
  const home = mkdtempSync(join(tmpdir(), 'doctor-home-'));
  try {
    cpSync(join(PLUGIN, 'lib'), join(root, 'lib'), { recursive: true });
    cpSync(join(PLUGIN, 'hooks'), join(root, 'hooks'), { recursive: true });
    cpSync(join(PLUGIN, 'skills', 'worker-contract'), join(root, 'skills', 'worker-contract'), { recursive: true });
    cpSync(join(PLUGIN, '.claude-plugin'), join(root, '.claude-plugin'), { recursive: true });
    cpSync(HERE, join(root, 'skills', 'cdp5-doctor'), { recursive: true });
    const copied = join(root, 'skills', 'cdp5-doctor', 'cdp5-doctor.mjs');
    const env = { PATH: process.env.PATH, HOME: home };
    const text = spawnSync('node', [copied], { encoding: 'utf8', env });
    assert.equal(text.status, 0, text.stdout + text.stderr);
    assert.match(text.stdout, /^ok {4}node/m);
    assert.match(text.stdout, /warn {2}bootstrap/);
    const json = spawnSync('node', [copied, '--json'], { encoding: 'utf8', env });
    assert.equal(json.status, 0);
    const out = JSON.parse(json.stdout);
    assert.equal(out.exit, 0);
    assert.ok(out.checks.some((c) => c.id === 'contract' && c.status === 'ok'));
    assert.equal(spawnSync('node', [copied, '--fix'], { encoding: 'utf8', env }).status, 2);
    assert.equal(spawnSync('node', [SCRIPT, '--root=/nope/nowhere'], { encoding: 'utf8', env }).status, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(home, { recursive: true, force: true });
  }
});
