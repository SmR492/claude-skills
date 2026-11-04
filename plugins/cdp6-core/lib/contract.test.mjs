import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { cpSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { extractCore, hashOf, normalizeText, paths, parseCore, pluginRoot, renderCore, verify } from './contract.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const GENERATE = join(PLUGIN, 'scripts', 'generate-contract.mjs');

const SKILL = '---\nname: worker-contract\n---\n\n<!-- contract-version: 1 -->\n\n<!-- core -->\nRule A.\n\nRule B.\n<!-- /core -->\n\ntail\n';

function copyRoot() {
  const root = tempDir('cdp6-contract-');
  cpSync(join(PLUGIN, 'skills', 'worker-contract'), join(root, 'skills', 'worker-contract'), { recursive: true });
  return root;
}

function generate(root, ...args) {
  return spawnSync(process.execPath, [GENERATE, ...args], { encoding: 'utf8', env: { PATH: process.env.PATH, CLAUDE_PLUGIN_ROOT: root } });
}

const RULE_IDS = ['C1', 'C2a', 'C2b', 'C2c', 'C2d', 'C2e', 'C3', 'C4', 'C5', 'C6a', 'C6b', 'C6c', 'C7', 'C8a', 'C8b', 'C8c', 'C8d', 'C8e', 'C9', 'C10', 'C11', 'C12', 'C13'];

test('extractCore reads the version marker and joins the core blocks', () => {
  assert.deepEqual(extractCore(SKILL), { version: '1', body: 'Rule A.\n\nRule B.' });
  assert.throws(() => extractCore(SKILL.replace('contract-version: 1', 'x')), /contract-version/);
  assert.throws(() => extractCore('<!-- contract-version: 1 -->\nno block'), /core/);
});

test('renderCore writes the CDP6-CONTRACT header with the first twelve hex of the body sha256', () => {
  const body = 'Rule A.\n\nRule B.';
  const full = createHash('sha256').update(body, 'utf8').digest('hex');
  const out = renderCore('1', body);
  assert.equal(out.split('\n')[0], `CDP6-CONTRACT v1 sha256:${full.slice(0, 12)}`);
  assert.deepEqual(parseCore(out), { version: '1', hash: full.slice(0, 12), body });
  assert.throws(() => parseCore(`WORKER-CONTRACT v1 sha256:${full.slice(0, 12)}\n\n${body}\n`), /CDP6-CONTRACT/);
});

test('a BOM or CRLF checkout does not change the hash', () => {
  const plain = extractCore(SKILL);
  const crlf = extractCore(`﻿${SKILL.replace(/\n/g, '\r\n')}`);
  assert.equal(hashOf(crlf.body), hashOf(plain.body));
  assert.equal(normalizeText('﻿a\r\nb\rc'), 'a\nb\nc');
  const rendered = renderCore('1', plain.body);
  assert.equal(parseCore(`﻿${rendered.replace(/\n/g, '\r\n')}`).hash, parseCore(rendered).hash);
});

test('pluginRoot prefers CLAUDE_PLUGIN_ROOT and falls back to the plugin directory', () => {
  assert.equal(pluginRoot({ CLAUDE_PLUGIN_ROOT: '/x/y' }), '/x/y');
  assert.equal(pluginRoot({}), PLUGIN);
  assert.equal(paths('/r').core, join('/r', 'skills', 'worker-contract', 'core.md'));
});

test('the shipped contract verifies and states the agent-facing rules of 7.1', () => {
  const v = verify(PLUGIN);
  assert.equal(v.ok, true, v.error);
  assert.equal(v.version, '1');
  assert.match(v.hash, /^[0-9a-f]{12}$/);
  assert.equal(readFileSync(paths(PLUGIN).core, 'utf8').split('\n')[0], `CDP6-CONTRACT v1 sha256:${v.hash}`);
  for (const id of RULE_IDS) assert.match(v.body, new RegExp(`^${id}\\. `, 'm'), id);
  assert.doesNotMatch(v.body, /^C3t\. |^C9t\. /m);
  assert.match(v.body, /teammate/);
  assert.match(v.body, /`cdp6-contract: v1 <hash>`/);
  assert.match(v.body, /`CDP6-CONTRACT v1 sha256:/);
  assert.match(v.body, /`run: <run-id> task: <task>`/);
  assert.match(v.body, /single line `CONTRACT-MISSING`/);
  assert.match(v.body, /`conflict of interest: none \| <stake>`/);
});

test('fires: verify refuses a missing, stale or drifted contract', () => {
  const missing = tempDir('cdp6-contract-');
  assert.equal(verify(missing).ok, false);
  const stale = copyRoot();
  writeFileSync(paths(stale).skill, readFileSync(paths(stale).skill, 'utf8').replace('<!-- core -->\n', '<!-- core -->\nExtra rule.\n'));
  assert.match(verify(stale).error, /stale/);
  const forged = copyRoot();
  writeFileSync(paths(forged).core, readFileSync(paths(forged).core, 'utf8').replace('C1.', 'C1!'));
  assert.match(verify(forged).error, /own hash/);
  const drift = copyRoot();
  writeFileSync(paths(drift).core, readFileSync(paths(drift).core, 'utf8').replace('CDP6-CONTRACT v1', 'CDP6-CONTRACT v2'));
  assert.match(verify(drift).error, /version drift/);
  [missing, stale, forged, drift].forEach((r) => rmSync(r, { recursive: true, force: true }));
});

test('generate-contract writes core.md and --check fails on a stale one', () => {
  const root = copyRoot();
  assert.equal(generate(root, '--check').status, 0);
  writeFileSync(paths(root).core, 'stale\n');
  const bad = generate(root, '--check');
  assert.equal(bad.status, 1);
  assert.match(bad.stderr, /differs/);
  assert.equal(generate(root).status, 0);
  assert.equal(generate(root, '--check').status, 0);
  assert.equal(readFileSync(paths(root).core, 'utf8'), readFileSync(paths(PLUGIN).core, 'utf8'));
  rmSync(paths(root).core);
  assert.match(generate(root, '--check').stderr, /missing/);
  rmSync(root, { recursive: true, force: true });
});

test('fires: the shipped core states C2a with the hedge clause and no unlisted marker', () => {
  const v = verify(PLUGIN);
  const c2a = v.body.split('\n').find((l) => l.startsWith('C2a. '));
  assert.match(c2a, /no hedged completion claims/i);
  assert.doesNotMatch(v.body, /Not verified:/);
  assert.match(readFileSync(paths(PLUGIN).core, 'utf8'), /no hedged completion claims/i);
});

test('fires: generate-contract --check reads a CRLF or BOM core.md with the current body as current', () => {
  const root = copyRoot();
  const current = readFileSync(paths(root).core, 'utf8');
  writeFileSync(paths(root).core, current.replace(/\n/g, '\r\n'));
  const crlf = generate(root, '--check');
  assert.equal(crlf.status, 0, crlf.stderr);
  writeFileSync(paths(root).core, `﻿${current}`);
  const bom = generate(root, '--check');
  assert.equal(bom.status, 0, bom.stderr);
  writeFileSync(paths(root).core, current.replace('C1.', 'C1!').replace(/\n/g, '\r\n'));
  assert.equal(generate(root, '--check').status, 1);
  rmSync(root, { recursive: true, force: true });
});
