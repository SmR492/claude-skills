#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { establishedVersion } from '../lib/running-version.mjs';
import { readHostKey } from '../lib/hook-key.mjs';
import { ACCEPTED_ROWS, VERDICTS, parseProbeMarkdown, probeRecordPath, signRecord } from '../lib/probe-record.mjs';

const LAUNCH_REFUSED = 'launch-refused';
const isLaunch = (r) => r.row === 'A-5' && r.mode === 'bypassPermissions';
const SHA256 = /^[0-9a-f]{64}$/;
const RECORDED_ONLY = 'A-24';

export function writeProbeRecord(dataDir, version, rec) {
  mkdirSync(join(dataDir, 'probes'), { recursive: true, mode: 0o700 });
  const file = probeRecordPath(dataDir, version);
  const tmp = `${file}.${process.pid}.tmp`;
  writeFileSync(tmp, `${JSON.stringify(rec, null, 2)}\n`, { mode: 0o600 });
  renameSync(tmp, file);
  return file;
}

function refuse(error, message) {
  return { ok: false, error, message };
}

function checkRows(rows) {
  const seen = new Set();
  const modes = new Set();
  for (const r of rows) {
    const where = `${r.row} ${r.mode || '(no mode)'}`;
    if (!r.mode) return refuse('row-mode', `row ${r.row} names no permission mode`);
    if (!r.claude_version) return refuse('row-version', `row ${where} names no Claude Code version`);
    if (!SHA256.test(r.settings_sha256)) return refuse('row-settings-sha256', `row ${where} names no --settings sha256`);
    const allowed = VERDICTS[r.row].filter((v) => v !== LAUNCH_REFUSED || isLaunch(r));
    if (!allowed.includes(r.verdict)) return refuse('row-verdict', `row ${where} has a verdict outside ${allowed.join(', ')}`);
    const key = `${where} ${r.settings_sha256}`;
    if (seen.has(key) || (r.row === 'A-23' && modes.has(where))) return refuse('row-duplicate', `row ${where} occurs twice`);
    seen.add(key);
    if (r.row === 'A-23') modes.add(where);
  }
  return null;
}

const HOOK_DECISIONS = ['none', 'deny'];

function handbackLineFound(dataDir, row, sessionId) {
  let text;
  try {
    text = readFileSync(join(dataDir, 'hooks-fired.jsonl'), 'utf8');
  } catch {
    return false;
  }
  for (const line of text.split('\n')) {
    try {
      const l = JSON.parse(line);
      if (l.hook === 'check-handback.mjs' && l.agent_id === row.agent_id && l.permission_mode === 'auto' && l.version === row.cdp6_version && l.session_id === sessionId && HOOK_DECISIONS.includes(l.decision)) return true;
    } catch {
      continue;
    }
  }
  return false;
}

const COUNT = /^\d+$/;

export function calibrate(kept) {
  const auto = kept.filter((r) => r.row === 'A-12' && r.mode === 'auto');
  if (auto.length === 0) return { calibration: null };
  const name = (r) => `row A-12 auto ${r.settings_sha256.slice(0, 8)}`;
  for (const r of auto) {
    if (!COUNT.test(r.bwrap_args)) return refuse('a12-calibration-columns', `${name(r)} names no bwrap argument count`);
    if (!COUNT.test(r.counted_paths)) return refuse('a12-calibration-columns', `${name(r)} names no counted path count`);
  }
  if (auto.length < 2) return refuse('a12-calibration-rows', `${name(auto[0])} is the only A-12 auto row, and the calibration needs a second settings file`);
  const sorted = [...auto].sort((a, b) => Number(a.counted_paths) - Number(b.counted_paths));
  const [live, added] = [sorted[0], sorted[sorted.length - 1]];
  const paths = Number(added.counted_paths) - Number(live.counted_paths);
  if (paths === 0) return refuse('a12-calibration-equal', `${name(added)} and ${name(live)} count the same number of paths`);
  const per = (Number(added.bwrap_args) - Number(live.bwrap_args)) / paths;
  if (!(per > 0)) return refuse('a12-calibration-slope', `${name(added)} and ${name(live)} give a non-positive argument factor`);
  return { calibration: { per_path: per, base: Number(live.bwrap_args) - per * Number(live.counted_paths) } };
}

function buildRows(rows, calibration) {
  const out = {};
  for (const r of rows) {
    const entry = (out[r.row] ??= { modes: {} });
    const common = { claude_version: r.claude_version, settings_sha256: r.settings_sha256 };
    if (r.verdict === LAUNCH_REFUSED) {
      (entry.launch_refused ??= {})[r.mode] = common;
      continue;
    }
    const field = r.row === 'A-5' ? 'prompt' : r.row === 'A-12' ? 'refused' : 'handback';
    const holds = r.verdict === { 'A-5': 'prompt', 'A-12': 'refused', 'A-23': 'handback' }[r.row];
    const known = entry.modes[r.mode];
    if (known) {
      known[field] = known[field] && holds;
      known.settings_sha256s = [...(known.settings_sha256s ?? [known.settings_sha256]), r.settings_sha256];
      continue;
    }
    entry.modes[r.mode] = { [field]: holds, ...(r.row === 'A-23' && holds ? { agent_id: r.agent_id, cdp6_version: r.cdp6_version } : {}), ...common };
  }
  const modes = (id) => Object.values(out[id]?.modes ?? {});
  if (out['A-5']) out['A-5'].passed = modes('A-5').every((m) => m.prompt);
  if (out['A-12']) out['A-12'].passed = modes('A-12').every((m) => m.refused);
  out['A-23'].passed = out['A-23'].modes.auto.handback === true;
  if (calibration && out['A-12']?.modes?.auto) out['A-12'].modes.auto.calibration = calibration;
  return out;
}

export function checkRecord(input, { dataDir, env = process.env, expect, procRoot, pid } = {}) {
  const bytes = Buffer.isBuffer(input) ? input : Buffer.from(input, 'utf8');
  const text = bytes.toString('utf8');
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  if (expect !== undefined && expect !== sha256) return refuse('expect-sha256-mismatch', 'the record differs from the file the owner approved');
  const parsed = parseProbeMarkdown(text);
  if (!parsed.table) return refuse('record-no-table', 'the file holds no probe rows table');
  const kept = parsed.rows.filter((r) => ACCEPTED_ROWS.includes(r.row));
  const others = [...new Set(parsed.rows.filter((r) => !ACCEPTED_ROWS.includes(r.row)).map((r) => r.row))].sort();
  const left = others.filter((r) => r !== RECORDED_ONLY);
  const recordedOnly = others.filter((r) => r === RECORDED_ONLY);
  const bad = checkRows(kept);
  if (bad) return bad;
  const calibrated = calibrate(kept);
  if (calibrated.ok === false) return calibrated;
  const established = establishedVersion(env, { procRoot, pid });
  if (!established.ok) return refuse(established.error, established.message);
  const version = established.version;
  const other = kept.find((r) => r.claude_version !== version.text);
  if (other) return refuse('record-version', `row ${other.row} ${other.mode} names Claude Code ${other.claude_version}, the running version is ${version.text}`);
  const auto = kept.find((r) => r.row === 'A-23' && r.mode === 'auto');
  if (!auto) return refuse('a23-auto-missing', 'the record has no A-23 row for auto');
  if (auto.verdict !== 'handback') return refuse('a23-auto-red', 'the A-23 row for auto shows no handback');
  if (!auto.agent_id || !auto.cdp6_version) return refuse('a23-auto-fields', 'the A-23 row for auto names no agent id or cdp6-core version');
  const key = readHostKey(env);
  if (!key) return refuse('host-key-missing', 'the host key is missing or unreadable');
  if (parsed.session_ids.length === 0) return refuse('session-id-missing', 'the record names no probe session id');
  if (parsed.session_ids.length > 1) return refuse('session-id-ambiguous', 'the record names more than one probe session id');
  if (!handbackLineFound(dataDir, auto, parsed.session_ids[0])) return refuse('a23-hook-line-missing', 'hooks-fired.jsonl has no check-handback.mjs line for the A-23 auto row');
  const rec = signRecord(key, {
    claude_version: version.text,
    probe_session_id: parsed.session_ids[0],
    rows: buildRows(kept, calibrated.calibration),
    accepted: { sha256, by: 'owner', at: new Date().toISOString() },
  });
  return { ok: true, version: version.text, rec, rows: Object.keys(rec.rows), left_for_sl8: left, recorded_only: recordedOnly };
}

const PREVIOUS = new WeakMap();

function bytesOrNull(file) {
  try {
    return readFileSync(file);
  } catch {
    return null;
  }
}

export function writeChecked(dataDir, checked) {
  const { rec, version, ...rest } = checked;
  const previous = bytesOrNull(probeRecordPath(dataDir, version));
  const file = writeProbeRecord(dataDir, version, rec);
  const out = { ok: true, version, file, ...rest };
  PREVIOUS.set(out, { file, previous });
  return out;
}

export function undoAccept(result) {
  const held = PREVIOUS.get(result);
  if (!held) return;
  if (held.previous === null) rmSync(held.file, { force: true });
  else writeFileSync(held.file, held.previous, { mode: 0o600 });
}

export function acceptRecord(input, options = {}) {
  const checked = checkRecord(input, options);
  return checked.ok ? writeChecked(options.dataDir, checked) : checked;
}
