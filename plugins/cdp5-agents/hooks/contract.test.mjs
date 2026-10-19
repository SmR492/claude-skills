import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, copyFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { extractCore, hashOf, parseCore, renderCore, ackPresent, verify, transcriptLastAssistant, finalMessage } from '../lib/contract.mjs';

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
  const v = verify(env.CLAUDE_PLUGIN_ROOT);
  assert.ok(v.ok, v.error);
  return v;
}

function usageLog(root) {
  return readFileSync(join(root, 'data', 'usage-log.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}

test('extractCore reads version and core block; render and parse round-trip', () => {
  const skill = readFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), 'utf8');
  const { version, body } = extractCore(skill);
  assert.match(version, /^\d+$/);
  assert.equal(version, skill.match(/<!--\s*contract-version:\s*(\d+)\s*-->/)[1]);
  assert.match(body, /^## Core rules/);
  assert.match(body, new RegExp(`contract: v${version} <hash>`));
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

test('mutation: SKILL.md core edited without regeneration → --check fails, inject emits CONTRACT-MISSING with exit 0 so the agent sees it', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    const skillPath = join(dir, 'SKILL.md');
    writeFileSync(skillPath, readFileSync(skillPath, 'utf8').replace('10. Language.', '10. Sprache.'));
    const check = run(GENERATE, env, {}, ['--check']);
    assert.equal(check.status, 1);
    assert.match(check.err, /differs/);
    const inject = run(INJECT, env, { agent_type: 'cdp5-agents:review-verify' });
    assert.equal(inject.status, 0, 'hook JSON is only processed on exit 0');
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
    assert.match(ctx, new RegExp(`^WORKER-CONTRACT v${v.version} sha256:${v.hash}`));
    assert.match(ctx, /## Core rules/);
    assert.match(ctx, /Full contract with formats and rationale: .*SKILL\.md/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('mutation: core.md removed → inject emits CONTRACT-MISSING, exits 0 and reports on stderr', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    rmSync(join(dir, 'core.md'));
    const r = run(INJECT, env, {});
    assert.equal(r.status, 0);
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
    assert.equal(r.status, 0);
    assert.match(r.json.hookSpecificOutput.additionalContext, /^CONTRACT-MISSING/);
    assert.match(r.err, /does not match its own hash/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('ackPresent accepts only the exact first non-empty line', () => {
  assert.ok(ackPresent('\n contract: v1 abcdef123456\nrest', '1', 'abcdef123456'));
  assert.ok(ackPresent('contract: v1 sha256:abcdef123456\nrest', '1', 'abcdef123456'), 'the header form with the sha256 prefix is accepted too');
  assert.ok(!ackPresent('contract: v1 abcdef123457', '1', 'abcdef123456'));
  assert.ok(!ackPresent('Result\ncontract: v1 abcdef123456', '1', 'abcdef123456'));
  assert.ok(!ackPresent('', '1', 'abcdef123456'));
});

test('transcript fallback: the last assistant message is read from the JSONL transcript when the hook input has none', () => {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-transcript-'));
  try {
    const path = join(root, 'agent.jsonl');
    writeFileSync(path, [
      JSON.stringify({ type: 'user', message: { role: 'user', content: 'do it' } }),
      JSON.stringify({ type: 'assistant', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: 'first answer' }] } }),
      JSON.stringify({ type: 'assistant', message: { id: 'm1', role: 'assistant', content: [{ type: 'tool_use', id: 't1', name: 'Read', input: {} }] } }),
      JSON.stringify({ type: 'user', message: { role: 'user', content: [{ type: 'tool_result', tool_use_id: 't1', content: 'x' }] } }),
      'not json at all',
      JSON.stringify({ type: 'assistant', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'contract: v1 abcdef123456' }] } }),
      JSON.stringify({ type: 'assistant', message: { id: 'm2', role: 'assistant', content: [{ type: 'text', text: 'Verdict: confirmed.' }] } }),
      JSON.stringify({ type: 'system', subtype: 'stop' }),
      '',
    ].join('\n'));
    assert.equal(transcriptLastAssistant(path), 'contract: v1 abcdef123456\nVerdict: confirmed.');
    assert.equal(transcriptLastAssistant(join(root, 'missing.jsonl')), '');
    assert.equal(finalMessage({ last_assistant_message: 'given', transcript_path: path }), 'given');
    assert.equal(finalMessage({ agent_transcript_path: path }), 'contract: v1 abcdef123456\nVerdict: confirmed.');
    assert.equal(finalMessage({ transcript_path: path }), 'contract: v1 abcdef123456\nVerdict: confirmed.');
    assert.equal(finalMessage({}), '');
    writeFileSync(path, JSON.stringify({ message: { role: 'assistant', content: 'plain string content' } }) + '\n');
    assert.equal(transcriptLastAssistant(path), 'plain string content');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: acknowledged answer passes and writes one usage log line with result ok', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const input = {
      hook_event_name: 'SubagentStop', agent_type: 'cdp5-agents:review-verify', agent_id: 'a1', session_id: 's1', cwd: '/repo',
      stop_hook_active: false, last_assistant_message: `contract: v${v.version} ${v.hash}\n\nVerdict: bestätigt.`,
    };
    const r = run(CHECK, env, input);
    assert.equal(r.status, 0, r.err);
    assert.equal(r.out, '');
    const log = usageLog(root);
    assert.equal(log.length, 1);
    assert.equal(log[0].agent_type, 'cdp5-agents:review-verify');
    assert.equal(log[0].contract, `v${v.version} ${v.hash}`);
    assert.equal(log[0].result, 'ok');
    assert.match(log[0].ts, /^\d{4}-\d{2}-\d{2}T/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: the acknowledgement is taken from the transcript when last_assistant_message is absent', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const transcript = join(root, 'agent.jsonl');
    writeFileSync(transcript, JSON.stringify({ type: 'assistant', message: { id: 'm1', role: 'assistant', content: [{ type: 'text', text: `contract: v${v.version} ${v.hash}\nVerdict: confirmed, 3/3 probes.` }] } }) + '\n');
    const ok = run(CHECK, env, { agent_type: 'cdp5-agents:review-verify', stop_hook_active: false, agent_transcript_path: transcript });
    assert.equal(ok.status, 0, ok.err);
    assert.equal(ok.out, '');
    assert.deepEqual(usageLog(root).map((e) => e.result), ['ok']);
    const none = run(CHECK, env, { agent_type: 'cdp5-agents:review-verify', stop_hook_active: false, transcript_path: join(root, 'missing.jsonl') });
    assert.equal(none.json.decision, 'block', 'no message anywhere counts as an empty message');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: missing acknowledgement blocks once; the second pass never blocks but logs the result', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const base = { agent_type: 'cdp5-agents:review-verify', agent_id: 'a1', last_assistant_message: 'Verdict: bestätigt.' };
    const first = run(CHECK, env, { ...base, stop_hook_active: false });
    assert.equal(first.status, 0, first.err);
    assert.equal(first.json.decision, 'block');
    assert.match(first.json.reason, new RegExp(`contract: v${v.version} ${v.hash}`));
    assert.ok(!existsSync(join(root, 'data', 'usage-log.jsonl')), 'a first-pass block is not logged yet');
    const second = run(CHECK, env, { ...base, stop_hook_active: true });
    assert.equal(second.status, 0);
    assert.equal(second.out, '');
    assert.deepEqual(usageLog(root).map((e) => e.result), ['no-ack'], 'the unrepaired restatement is counted');
    const repaired = run(CHECK, env, { ...base, stop_hook_active: true, last_assistant_message: `contract: v${v.version} ${v.hash}\nVerdict: bestätigt.` });
    assert.equal(repaired.out, '');
    assert.deepEqual(usageLog(root).map((e) => e.result), ['no-ack', 'ok']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: wrong hash in the acknowledgement blocks', () => {
  const { root, env } = sandbox();
  try {
    const v = generated(env);
    const r = run(CHECK, env, { agent_type: 'cdp5-agents:x', stop_hook_active: false, last_assistant_message: `contract: v${v.version} 000000000000\nok` });
    assert.equal(r.json.decision, 'block');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('check-ack: contract unverifiable → block asks for CONTRACT-MISSING, logs contract-missing once, never loops', () => {
  const { root, dir, env } = sandbox();
  try {
    generated(env);
    rmSync(join(dir, 'core.md'));
    const r = run(CHECK, env, { agent_type: 'cdp5-agents:review-verify', stop_hook_active: false, last_assistant_message: 'anything' });
    assert.equal(r.json.decision, 'block');
    assert.match(r.json.reason, /CONTRACT-MISSING/);
    assert.deepEqual(usageLog(root).map((e) => e.result), ['contract-missing']);
    assert.match(usageLog(root)[0].contract, /^unverified/);
    const again = run(CHECK, env, { agent_type: 'cdp5-agents:review-verify', stop_hook_active: true, last_assistant_message: 'anything' });
    assert.equal(again.out, '');
    assert.equal(usageLog(root).length, 1, 'the second pass does not log a second line');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('hooks.json wires both events to the plugin-scoped matcher', () => {
  const hooks = JSON.parse(readFileSync(join(PLUGIN, 'hooks', 'hooks.json'), 'utf8')).hooks;
  assert.equal(hooks.SessionStart[0].matcher, 'startup|resume|clear|compact');
  assert.match(hooks.SessionStart[0].hooks[0].command, /bootstrap\.mjs/);
  assert.equal(hooks.SubagentStart[0].matcher, '^(cdp5-agents|domain-agents):');
  assert.match(hooks.SubagentStart[0].hooks[0].command, /inject-contract\.mjs/);
  assert.equal(hooks.SubagentStop[0].matcher, '^(cdp5-agents|domain-agents):');
  assert.equal(hooks.PreToolUse[0].matcher, '^(Bash|PowerShell)$');
  assert.match(hooks.PreToolUse[0].hooks[0].command, /guard-bash\.mjs/);
  assert.match(hooks.SubagentStop[0].hooks[0].command, /check-ack\.mjs/);
});

test('repo state: the committed core.md is current for the committed SKILL.md', () => {
  const r = run(GENERATE, { PATH: process.env.PATH, HOME: tmpdir(), CLAUDE_PLUGIN_ROOT: PLUGIN }, {}, ['--check']);
  assert.equal(r.status, 0, r.err);
});
