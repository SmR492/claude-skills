import { createHash } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dataDir } from './data-dir.mjs';

export const HEADER_RE = /^WORKER-CONTRACT v(\d+) sha256:([0-9a-f]{12})$/m;

export function pluginRoot(env = process.env) {
  if (env.CLAUDE_PLUGIN_ROOT) return resolve(env.CLAUDE_PLUGIN_ROOT);
  return resolve(dirname(fileURLToPath(import.meta.url)), '..');
}

export function paths(root) {
  const dir = join(root, 'skills', 'worker-contract');
  return { dir, skill: join(dir, 'SKILL.md'), core: join(dir, 'core.md') };
}

export function hashOf(text) {
  return createHash('sha256').update(text, 'utf8').digest('hex').slice(0, 12);
}

// A BOM or CRLF checkout (Git for Windows core.autocrlf=true, PowerShell pipes) must not change the contract hash.
export function normalizeText(text) {
  return String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function extractCore(skillMdRaw) {
  const skillMd = normalizeText(skillMdRaw);
  const version = skillMd.match(/<!--\s*contract-version:\s*(\d+)\s*-->/)?.[1];
  if (!version) throw new Error('SKILL.md has no <!-- contract-version: N --> marker');
  const blocks = [...skillMd.matchAll(/<!--\s*core\s*-->\s*\n([\s\S]*?)\n\s*<!--\s*\/core\s*-->/g)].map((m) => m[1].trim());
  if (blocks.length === 0) throw new Error('SKILL.md has no <!-- core --> … <!-- /core --> block');
  return { version, body: blocks.join('\n\n') };
}

export function renderCore(version, body) {
  return `WORKER-CONTRACT v${version} sha256:${hashOf(body)}\n\n${body}\n`;
}

export function parseCore(coreMdRaw) {
  const coreMd = normalizeText(coreMdRaw);
  const m = coreMd.match(HEADER_RE);
  if (!m) throw new Error('core.md has no WORKER-CONTRACT header');
  const body = coreMd.slice(m.index + m[0].length).trim();
  return { version: m[1], hash: m[2], body };
}

export function verify(root) {
  const p = paths(root);
  try {
    if (!existsSync(p.skill)) return { ok: false, error: `missing ${p.skill}` };
    if (!existsSync(p.core)) return { ok: false, error: `missing ${p.core}` };
    const skill = extractCore(readFileSync(p.skill, 'utf8'));
    const core = parseCore(readFileSync(p.core, 'utf8'));
    if (core.version !== skill.version) return { ok: false, error: `version drift: SKILL.md v${skill.version}, core.md v${core.version}` };
    if (hashOf(core.body) !== core.hash) return { ok: false, error: 'core.md body does not match its own hash' };
    if (hashOf(skill.body) !== core.hash) return { ok: false, error: 'core.md is stale: SKILL.md core differs, run scripts/generate-contract.mjs' };
    return { ok: true, version: core.version, hash: core.hash, body: core.body, skillPath: p.skill };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function ackPresent(message, version, hash) {
  const first = String(message ?? '').split('\n').map((l) => l.trim()).find((l) => l.length > 0) ?? '';
  return first === `contract: v${version} ${hash}` || first === `contract: v${version} sha256:${hash}`;
}

export function usageLogPath(env = process.env) {
  return join(dataDir(env), 'usage-log.jsonl');
}

// Tools through which a subagent delivers its final report to the caller instead of writing a text block
// (Claude Code 2.1.30x: SubagentHandback with input.message). Their message is the final answer the hook judges.
export const HANDBACK_TOOLS = new Set(['SubagentHandback']);

function handbackText(block) {
  if (block?.type !== 'tool_use' || !HANDBACK_TOOLS.has(block.name)) return null;
  const m = block.input?.message;
  return typeof m === 'string' ? m : null;
}

function textBlocks(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((b) => (b?.type === 'text' && typeof b.text === 'string' ? b.text : handbackText(b)))
    .filter((t) => typeof t === 'string')
    .join('\n');
}

function isAssistant(entry) {
  return entry?.type === 'assistant' || entry?.message?.role === 'assistant';
}

// The last assistant message of a JSONL transcript. Claude Code writes one line per content block, all sharing the
// message id, so the trailing assistant lines with the same id are joined; a tool-only block yields an empty string.
export function transcriptLastAssistant(path) {
  if (!path || !existsSync(path)) return '';
  const lines = readFileSync(path, 'utf8').split('\n');
  const parts = [];
  let id;
  for (let i = lines.length - 1; i >= 0; i--) {
    if (!lines[i].trim()) continue;
    let entry;
    try { entry = JSON.parse(lines[i]); } catch { continue; }
    if (!isAssistant(entry)) {
      if (parts.length) break;
      continue;
    }
    const thisId = entry.message?.id ?? entry.uuid ?? null;
    if (parts.length && (id === null || thisId !== id)) break;
    id = thisId;
    parts.unshift(textBlocks(entry.message?.content ?? entry.content));
  }
  return parts.filter(Boolean).join('\n');
}

// The message the stop hook judges: the hook input's last_assistant_message, or the transcript when that is absent
// or blank. Blank happens when the agent's last message is only a handback tool call; the transcript then yields
// the handback message.
export function finalMessage(input) {
  const given = input.last_assistant_message;
  if (given !== undefined && given !== null && String(given).trim() !== '') return String(given);
  return transcriptLastAssistant(input.agent_transcript_path ?? input.transcript_path);
}

export function appendUsage(entry, env = process.env) {
  const file = usageLogPath(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  appendFileSync(file, JSON.stringify(entry) + '\n', { mode: 0o600 });
  return file;
}

export function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf8').replace(/^﻿/, '') || '{}');
  } catch {
    return {};
  }
}
