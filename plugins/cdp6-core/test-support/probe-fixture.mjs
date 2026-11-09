import { appendFileSync, chmodSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { acceptRecord, writeProbeRecord } from '../checks/probe-check.mjs';
import { readHostKey } from '../lib/hook-key.mjs';
import { signRecord } from '../lib/probe-record.mjs';
import { fakeHost } from './claude-host.mjs';
import { tempDir } from './temp-dir.mjs';

export const SETTINGS_SHA = 'c'.repeat(64);
export const CALIBRATION_SHA = 'e'.repeat(64);
export const SESSION = 'sess-probe-1';
export const PLUGIN_VERSION = JSON.parse(readFileSync(join(dirname(dirname(fileURLToPath(import.meta.url))), '.claude-plugin', 'plugin.json'), 'utf8')).version;
export const AGENT = 'agent-a1';

export function sha(text) {
  return createHash('sha256').update(text).digest('hex');
}

export function stubClaude(bin, version) {
  mkdirSync(bin, { recursive: true });
  const file = join(bin, 'claude');
  writeFileSync(file, version === null ? '#!/bin/sh\nexit 1\n' : `#!/bin/sh\necho "${version} (Claude Code)"\n`);
  chmodSync(file, 0o755);
}

export function goodRows(version = '2.1.318') {
  const base = { claude_version: version, settings_sha256: SETTINGS_SHA, agent_id: '', cdp6_version: '', bwrap_args: '', counted_paths: '' };
  return [
    { ...base, row: 'A-5', mode: 'default', verdict: 'prompt' },
    { ...base, row: 'A-5', mode: 'auto', verdict: 'prompt' },
    { ...base, row: 'A-12', mode: 'auto', verdict: 'refused', bwrap_args: '9525', counted_paths: '1196' },
    { ...base, row: 'A-23', mode: 'auto', verdict: 'handback', agent_id: AGENT, cdp6_version: PLUGIN_VERSION },
    { ...base, row: 'A-23', mode: 'default', verdict: 'no-handback' },
    { ...base, row: 'A-12', mode: 'auto', verdict: 'refused', settings_sha256: CALIBRATION_SHA, bwrap_args: '9532', counted_paths: '1197' },
  ];
}

export function markdown(rows, { title = 'Probe record', session = SESSION } = {}) {
  const head = '| Row | Mode | Claude Code | Settings sha256 | Verdict | Agent id | cdp6-core | bwrap args | Counted paths |';
  const rule = '|---|---|---|---|---|---|---|---|---|';
  const lines = rows.map((r) => `| ${r.row} | ${r.mode} | ${r.claude_version} | ${r.settings_sha256} | ${r.verdict} | ${r.agent_id ?? ''} | ${r.cdp6_version ?? ''} | ${r.bwrap_args ?? ''} | ${r.counted_paths ?? ''} |`);
  const named = session === null ? '' : `Session id: ${session}\n\n`;
  return `# ${title}\n\nStatus: draft.\n\n${named}${head}\n${rule}\n${lines.join('\n')}\n\nEnd.\n`;
}

export function firedLine(dataDir, over = {}) {
  mkdirSync(dataDir, { recursive: true });
  const line = { hook: 'check-handback.mjs', version: PLUGIN_VERSION, at: '2026-11-06T09:00:00.000Z', session_id: SESSION, tool_use_id: null, permission_mode: 'auto', decision: 'deny', agent_id: AGENT, capture_sha256: null, ...over };
  appendFileSync(join(dataDir, 'hooks-fired.jsonl'), `${JSON.stringify(line)}\n`);
}

export function acceptedRecord({ env, data, version = '2.1.318', rows = goodRows(version), withLine = true, host = fakeHost(tempDir('cdp6-host-'), version) }) {
  if (withLine) firedLine(data);
  const text = markdown(rows);
  const result = acceptRecord(text, { dataDir: data, env, expect: sha(text), ...host });
  if (!result.ok) throw new Error(`fixture record refused: ${result.error}`);
  return result;
}

export function signedRecord({ env, data, version, rows }) {
  const rec = signRecord(readHostKey(env), { claude_version: version, rows, accepted: { sha256: 'a'.repeat(64), at: '2026-11-06T09:00:00.000Z' } });
  return writeProbeRecord(data, version, rec);
}
