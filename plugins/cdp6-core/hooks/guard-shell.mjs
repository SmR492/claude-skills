#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import { isMainModule } from '../lib/paths.mjs';
import { readProjectFile } from '../lib/input-file.mjs';
import { mintToken, readHostKey } from '../lib/hook-key.mjs';
import { ArgvError, CONTROL, FORBIDDEN_PREFIXES, SESSION_ID, SHELL_TOOLS, UNQUOTED, describeCall, ownerForm, readRunCall } from '../lib/run-argv.mjs';
import { establishedVersion } from '../lib/running-version.mjs';
import { calibrate } from '../checks/probe-check.mjs';
import { ACCEPTED_ROWS, parseProbeMarkdown, readProbeRecord, rowHolds } from '../lib/probe-record.mjs';
import { recordFired } from '../lib/hooks-observed.mjs';
import { projectRootOf } from '../lib/run-store.mjs';
import { readOnlyCall } from '../lib/shell-allowlist.mjs';
import { runFor, stopFor } from '../lib/stop-guard.mjs';


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
  for (const value of call.values.get('--accept') ?? []) {
    const content = readProjectFile(resolve(root, value));
    if (content !== null) out.push({ value, sha256: createHash('sha256').update(content).digest('hex'), rows: parseProbeMarkdown(content.toString('utf8')).rows });
  }
  return out;
}

function arg(value) {
  if (UNQUOTED.test(value)) return value;
  if (value.includes("'") || CONTROL.test(value)) deny('the data directory cannot be passed safely');
  return `'${value}'`;
}

function runMode(input, env) {
  return runFor(input, env).found?.run?.mode;
}

function ownerModeAllowed(mode, dataDir, env) {
  if (mode === 'default') return true;
  if (typeof mode !== 'string' || mode === 'bypassPermissions') return false;
  const running = establishedVersion(env);
  return running.ok && rowHolds(readProbeRecord(dataDir, running.version.text, env), 'A-5', mode);
}

function calibrationText(rows) {
  const { calibration, message } = calibrate(rows);
  return calibration ? `calibration per_path ${calibration.per_path} base ${calibration.base}` : `calibration refused: ${message}`;
}

function reasonOf(call, owner, hashes) {
  if (!owner) return `run.mjs ${describeCall(call)}`;
  const files = hashes.map((h) => `${h.value} sha256 ${h.sha256}`);
  const parsed = hashes.flatMap((h) => h.rows ?? []);
  const rows = parsed.map((r) => `${r.row} ${r.mode} ${r.verdict}${ACCEPTED_ROWS.includes(r.row) ? '' : ' (left for SL-8)'}${r.row === 'A-12' && r.mode === 'auto' ? ` (bwrap args ${r.bwrap_args || 'none'}, counted paths ${r.counted_paths || 'none'})` : ''}`);
  const calibration = parsed.some((r) => r.row === 'A-12' && r.mode === 'auto') ? calibrationText(parsed.filter((r) => ACCEPTED_ROWS.includes(r.row))) : null;
  return [`owner command: ${describeCall(call)}`, ...(files.length ? [`files: ${files.join(', ')}`] : []), ...(rows.length ? [`rows: ${rows.join(', ')}`] : []), ...(calibration ? [calibration] : [])].join('; ');
}

function stopAllows(command, env) {
  if (typeof command !== 'string') return false;
  try {
    const read = readRunCall(command, env);
    return read ? read.call.sub === 'status' : readOnlyCall(command);
  } catch (e) {
    if (e instanceof ArgvError) return false;
    throw e;
  }
}

export function decide(input, env) {
  if (!SHELL_TOOLS.includes(input.tool_name)) return null;
  const command = input.tool_input?.command;
  const stop = stopFor(input, env);
  if (stop && (input.tool_input?.dangerouslyDisableSandbox === true || !stopAllows(command, env))) return { permissionDecision: 'deny', permissionDecisionReason: stop };
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
    const owner = ownerForm(call, call.sub === 'decision' ? runMode(input, env) : undefined);
    if (owner && !ownerModeAllowed(input.permission_mode, dataDir, env)) deny(`an owner command needs a permission mode in which the prompt is shown; ${typeof input.permission_mode === 'string' ? input.permission_mode : 'no mode'} is not shown to prompt`);
    const hashes = call.sub === 'init' || call.sub === 'probe' ? expectHashes(call, input.cwd ?? process.cwd()) : [];
    if (call.sub === 'probe' && hashes.length !== 1) deny('probe needs --accept with one readable file');
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
