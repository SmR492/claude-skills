import { createHash } from 'node:crypto';
import { existsSync, readFileSync, appendFileSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

export function extractCore(skillMd) {
  const version = skillMd.match(/<!--\s*contract-version:\s*(\d+)\s*-->/)?.[1];
  if (!version) throw new Error('SKILL.md has no <!-- contract-version: N --> marker');
  const blocks = [...skillMd.matchAll(/<!--\s*core\s*-->\s*\n([\s\S]*?)\n\s*<!--\s*\/core\s*-->/g)].map((m) => m[1].trim());
  if (blocks.length === 0) throw new Error('SKILL.md has no <!-- core --> … <!-- /core --> block');
  return { version, body: blocks.join('\n\n') };
}

export function renderCore(version, body) {
  return `WORKER-CONTRACT v${version} sha256:${hashOf(body)}\n\n${body}\n`;
}

export function parseCore(coreMd) {
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
  return first === `contract: v${version} ${hash}`;
}

export function usageLogPath(env = process.env) {
  const dir = env.CLAUDE_PLUGIN_DATA ?? join(env.HOME ?? homedir(), '.cache', 'cdp5-agents');
  return join(dir, 'usage-log.jsonl');
}

export function appendUsage(entry, env = process.env) {
  const file = usageLogPath(env);
  mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
  appendFileSync(file, JSON.stringify(entry) + '\n', { mode: 0o600 });
  return file;
}

export function readStdinJson() {
  try {
    return JSON.parse(readFileSync(0, 'utf8') || '{}');
  } catch {
    return {};
  }
}
