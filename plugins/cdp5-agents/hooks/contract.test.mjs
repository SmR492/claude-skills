import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCore, hashOf, parseCore, renderCore, ackPresent, verify } from '../lib/contract.mjs';

const PLUGIN = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const INJECT = join(PLUGIN, 'hooks', 'inject-contract.mjs');
const CHECK = join(PLUGIN, 'hooks', 'check-ack.mjs');
const GENERATE = join(PLUGIN, 'scripts', 'generate-contract.mjs');

function sandbox() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-agents-'));
  const dir = join(root, 'skills', 'worker-contract');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), join(dir, 'SKILL.md'));
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  return { root, dir, env };
}

function run(script, env, input, args = []) {
  const r = spawnSync('node', [script, ...args], { env, input: JSON.stringify(input ?? {}), encoding: 'utf8' });
  let json = null;
  try { json = r.stdout ? JSON.parse(r.stdout) : null; } catch {}
  return { status: r.status, out: r.stdout, err: r.stderr, json };
}

function generated(env) {
  const r = run(GENERATE, env);
  assert.equal(r.status, 0, r.err);
  return verify(env.CLAUDE_PLUGIN_ROOT);
}

test('extractCore reads version and core block; render and parse round-trip', () => {
  const skill = readFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), 'utf8');
  const { version, body } = extractCore(skill);
  assert.equal(version, '1');
  assert.match(body, /^## Core rules/);
  assert.match(body, /contract: v1 <hash>/);
  const core = parseCore(renderCore(version, body));
  assert.equal(core.version, version);
  assert.equal(core.hash, hashOf(body));
  assert.equal(core.body, body);
});

test('generator writes core.md once and --check passes afterwards', () => {
  const { root, dir, env } = sandbox();
  try {
    const first = run(GENERATE, env);
    assert.equal(first.status, 0, first.err);
    assert.match(first.out, /wrote/);
    assert.ok(existsSync(join(dir, 'core.md')));
    const second = run(GENERATE, env);
    assert.match(second.out, /unchanged/);
    const check = run(GENERATE, env, {}, ['--check']);
    assert.equal(check.status, 0, check.err);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('mutation: SKILL.md core edited without regeneration → --check fails, inject fails loud', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    const skillPath = join(dir, 'SKILL.md');
    writeFileSync(skillPath, readFileSync(skillPath, 'utf8').replace('10. Language.', '10. Sprache.'));
    const check = run(GENERATE, env, {}, ['--check']);
    assert.equal(check.status, 1);
    assert.match(check.err, /differs/);
    const inject = run(INJECT, env, { agent_type: 'cdp5-agents:review-verify' });
    assert.equal(inject.status, 2);
    assert.match(inject.json.hookSpecificOutput.additionalContext, /^CONTRACT-MISSING/);
    assert.match(inject.err, /stale/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('inject: normal case returns header, core rules and the SKILL.md path', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const r = run(INJECT, env, { agent_type: 'cdp5-agents:review-verify', agent_id: 'a1' });
    assert.equal(r.status, 0, r.err);
    const ctx = r.json.hookSpecificOutput.additionalContext;
    assert.equal(r.json.hookSpecificOutput.hookEventName, 'SubagentStart');
    assert.match(ctx, new RegExp(`^WORKER-CONTRACT v1 sha256:${v.hash}`));
    assert.match(ctx, /## Core rules/);
    assert.match(ctx, /Full contract with formats and rationale: .*SKILL\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('mutation: core.md removed → inject emits CONTRACT-MISSING and exits 2', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    rmSync(join(dir, 'core.md'));
    const r = run(INJECT, env, {});
    assert.equal(r.status, 2);
    assert.match(r.json.hookSpecificOutput.additionalContext, /^CONTRACT-MISSING/);
    assert.match(r.err, /missing .*core\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('mutation: core.md tampered → hash mismatch is detected', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    const corePath = join(dir, 'core.md');
    writeFileSync(corePath, readFileSync(corePath, 'utf8').replace('No commit, no push', 'Commit and push allowed'));
    const r = run(INJECT, env, {});
    assert.equal(r.status, 2);
    assert.match(r.err, /does not match its own hash/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ackPresent accepts only the exact first non-empty line', () => {
  assert.ok(ackPresent('\n contract: v1 abcdef123456\nrest', '1', 'abcdef123456'));
  assert.ok(!ackPresent('contract: v1 abcdef123457', '1', 'abcdef123456'));
  assert.ok(!ackPresent('Result\ncontract: v1 abcdef123456', '1', 'abcdef123456'));
  assert.ok(!ackPresent('', '1', 'abcdef123456'));
});

test('check-ack: acknowledged answer passes and writes one usage log line', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const input = {
      hook_event_name: 'SubagentStop', agent_type: 'cdp5-agents:review-verify', agent_id: 'a1', session_id: 's1', cwd: '/repo',
      stop_hook_active: false, last_assistant_message: `contract: v1 ${v.hash}\n\nVerdict: bestätigt.`,
    };
    const r = run(CHECK, env, input);
    assert.equal(r.status, 0, r.err);
    assert.equal(r.out, '');
    const log = readFileSync(join(root, 'data', 'usage-log.jsonl'), 'utf8').trim().split('\n');
    assert.equal(log.length, 1);
    const entry = JSON.parse(log[0]);
    assert.equal(entry.agent_type, 'cdp5-agents:review-verify');
    assert.equal(entry.contract, `v1 ${v.hash}`);
    assert.match(entry.ts, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: missing acknowledgement blocks once with the exact expected line', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const base = { agent_type: 'cdp5-agents:review-verify', agent_id: 'a1', last_assistant_message: 'Verdict: bestätigt.' };
    const first = run(CHECK, env, { ...base, stop_hook_active: false });
    assert.equal(first.status, 0, first.err);
    assert.equal(first.json.decision, 'block');
    assert.match(first.json.reason, new RegExp(`contract: v1 ${v.hash}`));
    const second = run(CHECK, env, { ...base, stop_hook_active: true });
    assert.equal(second.status, 0);
    assert.equal(second.out, '');
    assert.ok(!existsSync(join(root, 'data', 'usage-log.jsonl')));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: wrong hash in the acknowledgement blocks', () => {
  const { root, env } = sandbox();
  try {
    generated(env);
    const r = run(CHECK, env, { agent_type: 'cdp5-agents:x', stop_hook_active: false, last_assistant_message: 'contract: v1 000000000000\nok' });
    assert.equal(r.json.decision, 'block');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: contract unverifiable → block asks for CONTRACT-MISSING, never loops', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    rmSync(join(dir, 'core.md'));
    const r = run(CHECK, env, { stop_hook_active: false, last_assistant_message: 'anything' });
    assert.equal(r.json.decision, 'block');
    assert.match(r.json.reason, /CONTRACT-MISSING/);
    const again = run(CHECK, env, { stop_hook_active: true, last_assistant_message: 'anything' });
    assert.equal(again.out, '');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hooks.json wires both events to the plugin-scoped matcher', () => {
  const hooks = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.equal(hooks.SubagentStart[0].matcher, '^(cdp5-agents|domain-agents):');
  assert.match(hooks.SubagentStart[0].hooks[0].command, /inject-contract\.mjs/);
  assert.equal(hooks.SubagentStop[0].matcher, '^(cdp5-agents|domain-agents):');
  assert.equal(hooks.PreToolUse[0].matcher, 'Bash');
  assert.match(hooks.PreToolUse[0].hooks[0].command, /guard-bash\.mjs/);
  assert.match(hooks.SubagentStop[0].hooks[0].command, /check-ack\.mjs/);
});

test('repo state: the committed core.md is current for the committed SKILL.md', () => {
  const r = run(GENERATE, { PATH: process.env.PATH, HOME: tmpdir(), CLAUDE_PLUGIN_ROOT: PLUGIN }, {}, ['--check']);
  assert.equal(r.status, 0, r.err);
});
