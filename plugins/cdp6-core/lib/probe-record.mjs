import { createHmac, timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readHostKey } from './hook-key.mjs';

export const RECORD_LABEL = 'cdp6-core probe-record v1';
export const ACCEPTED_ROWS = ['A-5', 'A-12', 'A-23'];
export const TEAM_ROWS = ['A-11', 'A-14', 'A-16', 'A-17'];
export const VERDICTS = { 'A-5': ['prompt', 'no-prompt', 'launch-refused'], 'A-12': ['refused', 'not-refused'], 'A-23': ['handback', 'no-handback'] };
export const COLUMNS = ['row', 'mode', 'claude code', 'settings sha256', 'verdict', 'agent id', 'cdp6-core'];
export const CALIBRATION_COLUMNS = ['bwrap args', 'counted paths'];

function sorted(value) {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map((k) => [k, sorted(value[k])]));
  return value;
}

export function canonicalBytes(rec) {
  const { mac, ...accepted } = rec?.accepted ?? {};
  return Buffer.from(JSON.stringify(sorted({ ...rec, accepted })), 'utf8');
}

export function recordMac(key, rec) {
  return createHmac('sha256', key).update(Buffer.concat([Buffer.from(RECORD_LABEL, 'utf8'), Buffer.from([0]), canonicalBytes(rec)])).digest('hex');
}

export function signRecord(key, rec) {
  return { ...rec, accepted: { ...rec.accepted, mac: recordMac(key, rec) } };
}

export function probeRecordPath(dataDir, version) {
  return join(dataDir, 'probes', `${version}.json`);
}

function macOk(key, rec) {
  const mac = rec.accepted.mac;
  if (typeof mac !== 'string' || !/^[0-9a-f]{64}$/.test(mac)) return false;
  const want = Buffer.from(recordMac(key, rec), 'hex');
  const got = Buffer.from(mac, 'hex');
  return want.length === got.length && timingSafeEqual(want, got);
}

export function readProbeRecord(dataDir, version, env = process.env) {
  try {
    const rec = JSON.parse(readFileSync(probeRecordPath(dataDir, version), 'utf8'));
    if (!rec || rec.claude_version !== version) return null;
    if (typeof rec.accepted?.sha256 !== 'string' || rec.accepted.sha256.length !== 64) return null;
    const key = readHostKey(env);
    if (!key || !macOk(key, rec)) return null;
    return rec;
  } catch {
    return null;
  }
}

const FIELD = { 'A-5': 'prompt', 'A-12': 'refused', 'A-23': 'handback' };

export function rowHolds(rec, row, mode) {
  const entry = rec?.rows?.[row];
  if (mode === undefined) return entry?.passed === true;
  return FIELD[row] !== undefined && entry?.modes?.[mode]?.[FIELD[row]] === true;
}

export function probePassed(rec, row) {
  return rowHolds(rec, row);
}

export function modePrompts(rec, mode) {
  return rowHolds(rec, 'A-5', mode);
}

export function calibrationOf(rec) {
  const cal = rec?.rows?.['A-12']?.modes?.auto?.calibration;
  return Number.isFinite(cal?.base) && Number.isFinite(cal?.per_path) ? { base: cal.base, per_path: cal.per_path } : null;
}

function cells(line) {
  const parts = line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
  return parts.map((c) => c.trim().replace(/^`(.*)`$/, '$1').trim());
}

function sessionIds(lines) {
  return [...new Set(lines.map((l) => /^\s*(?:probe )?session id:\s*`?([A-Za-z0-9_-]+)`?\s*$/i.exec(l)?.[1]).filter(Boolean))];
}

export function parseProbeMarkdown(text) {
  const lines = String(text).split('\n');
  const rows = [];
  let at = -1;
  for (let i = 0; i < lines.length; i += 1) {
    const head = lines[i].trim().startsWith('|') ? cells(lines[i]).map((c) => c.toLowerCase()) : [];
    if (head.slice(0, COLUMNS.length).join('|') === COLUMNS.join('|') && head.slice(COLUMNS.length).every((c, k) => c === CALIBRATION_COLUMNS[k])) {
      at = i;
      break;
    }
  }
  if (at === -1) return { rows, table: false };
  for (let i = at + 1; i < lines.length && lines[i].trim().startsWith('|'); i += 1) {
    const c = cells(lines[i]);
    if (c.every((x) => /^:?-{3,}:?$/.test(x))) continue;
    rows.push({
      row: c[0] ?? '',
      mode: c[1] ?? '',
      claude_version: c[2] ?? '',
      settings_sha256: c[3] ?? '',
      verdict: c[4] ?? '',
      agent_id: c[5] ?? '',
      cdp6_version: c[6] ?? '',
      bwrap_args: c[7] ?? '',
      counted_paths: c[8] ?? '',
      line: i + 1,
    });
  }
  return { rows, table: true, session_ids: sessionIds(lines) };
}

