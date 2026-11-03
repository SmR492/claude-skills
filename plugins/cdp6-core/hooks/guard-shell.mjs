#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { readProjectFile } from '../lib/input-file.mjs';
import { mintToken, readHostKey } from '../lib/hook-key.mjs';
import { ArgvError, CONTROL, FORBIDDEN_PREFIXES, SESSION_ID, SHELL_TOOLS, UNQUOTED, describeCall, ownerForm, readRunCall } from '../lib/run-argv.mjs';
import { readClaudeVersion } from '../lib/claude-version.mjs';
import { modePrompts, readProbeRecord } from '../lib/probe-record.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { findRun, projectRootOf } from '../lib/run-store.mjs';


class Deny extends Error {}

function deny(reason) {
  throw new Deny(reason);
}

export function expectHashes(call, cwd) {
  const out = [];
  const root = projectRootOf(cwd);
  for (const value of call.values.get('--import') ?? []) {
    const content = readProjectFile(resolve(root, value));
    if (content !== null) out.push({ value, sha256: createHash('sha256').update(content).digest('hex') });
  }
  return out;
}

function arg(value) {
  if (UNQUOTED.test(value)) return value;
  if (value.includes("'") || CONTROL.test(value)) deny('the data directory cannot be passed safely');
  return `'${value}'`;
}

function runMode(input, dataDir, env) {
  const found = findRun({ dataDir, sessionId: input.session_id, cwd: input.cwd ?? process.cwd() });
  return found.run?.mode;
}

function ownerModeAllowed(mode, dataDir, env) {
  if (mode === 'default') return true;
  if (typeof mode !== 'string' || mode === 'bypassPermissions') return false;
  const version = readClaudeVersion(env);
  return version !== null && modePrompts(readProbeRecord(dataDir, version.text), mode);
}

function reasonOf(call, owner, hashes) {
  if (!owner) return `run.mjs ${describeCall(call)}`;
  const files = hashes.map((h) => `${h.value} sha256 ${h.sha256}`);
  return [`owner command: ${describeCall(call)}`, ...(files.length ? [`files: ${files.join(', ')}`] : [])].join('; ');
}

export function decide(input, env) {
  if (!SHELL_TOOLS.includes(input.tool_name)) return null;
  const command = input.tool_input?.command;
  if (typeof command !== 'string') return null;
  try {
    const read = readRunCall(command, env);
    if (!read) return null;
    const { call, words } = read;
    if (words.some((w) => FORBIDDEN_PREFIXES.some((p) => w.startsWith(p)))) deny('the call carries a token that only the hook may append');
    if (input.agent_id) deny('run.mjs is not available to a caller with an agent id');
    const key = readHostKey(env);
    if (!key) deny('the host key is missing or unreadable');
    const dataDir = env.CLAUDE_PLUGIN_DATA;
    if (typeof dataDir !== 'string' || !isAbsolute(dataDir)) deny('the plugin data directory is unknown');
    if (!SESSION_ID.test(input.session_id ?? '')) deny('the hook input has no usable session id');
    const owner = ownerForm(call, call.sub === 'decision' ? runMode(input, dataDir, env) : undefined);
    if (owner && !ownerModeAllowed(input.permission_mode, dataDir, env)) deny(`an owner command needs a permission mode in which the prompt is shown; ${typeof input.permission_mode === 'string' ? input.permission_mode : 'no mode'} is not shown to prompt`);
    const hashes = call.sub === 'init' ? expectHashes(call, input.cwd ?? process.cwd()) : [];
    const fields = { sessionId: input.session_id, dataDir, tokens: words, expect: hashes.map((h) => h.sha256) };
    const tail = [
      '--session-id',
      input.session_id,
      '--data-dir',
      arg(dataDir),
      ...hashes.flatMap((h) => ['--expect-sha256', h.sha256]),
      '--hook-token',
      mintToken(key, fields),
    ];
    return {
      permissionDecision: 'ask',
      permissionDecisionReason: reasonOf(call, owner, hashes),
      updatedInput: { ...input.tool_input, command: `${command.trimEnd()} ${tail.join(' ')}` },
    };
  } catch (e) {
    if (e instanceof Deny) return { permissionDecision: 'deny', permissionDecisionReason: `run.mjs call refused: ${e.message}` };
    if (e instanceof ArgvError) return { permissionDecision: 'deny', permissionDecisionReason: `run.mjs call refused (${e.error}): ${e.message}` };
    return { permissionDecision: 'deny', permissionDecisionReason: 'run.mjs call refused: the guard could not read the call' };
  }
}

export function main(env = process.env) {
  let input = null;
  let decision;
  try {
    input = JSON.parse(readFileSync(0, 'utf8'));
    decision = decide(input, env);
  } catch {
    decision = { permissionDecision: 'deny', permissionDecisionReason: 'guard-shell.mjs could not read its input' };
  }
  recordFired(env.CLAUDE_PLUGIN_DATA, 'guard-shell.mjs', input, decision?.permissionDecision ?? 'none');
  if (decision) process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', ...decision } }));
  return 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main();
