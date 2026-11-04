import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export const HEADER_RE = /^CDP6-CONTRACT v(\d+) sha256:([0-9a-f]{12})$/m;

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

export function normalizeText(text) {
  return String(text ?? '').replace(/^﻿/, '').replace(/\r\n?/g, '\n');
}

export function extractCore(skillMdRaw) {
  const skillMd = normalizeText(skillMdRaw);
  const version = skillMd.match(/<!--\s*contract-version:\s*(\d+)\s*-->/)?.[1];
  if (!version) throw new Error('SKILL.md has no <!-- contract-version: N --> marker');
  const blocks = [...skillMd.matchAll(/<!--\s*core\s*-->\s*\n([\s\S]*?)\n\s*<!--\s*\/core\s*-->/g)].map((m) => m[1].trim());
  if (blocks.length === 0) throw new Error('SKILL.md has no <!-- core --> block');
  return { version, body: blocks.join('\n\n') };
}

export function renderCore(version, body) {
  return `CDP6-CONTRACT v${version} sha256:${hashOf(body)}\n\n${body}\n`;
}

export function parseCore(coreMdRaw) {
  const coreMd = normalizeText(coreMdRaw);
  const m = coreMd.match(HEADER_RE);
  if (!m) throw new Error('core.md has no CDP6-CONTRACT header');
  return { version: m[1], hash: m[2], body: coreMd.slice(m.index + m[0].length).trim() };
}

export function verify(root) {
  const p = paths(root);
  try {
    if (!existsSync(p.skill)) return { ok: false, error: 'SKILL.md of the contract is missing' };
    if (!existsSync(p.core)) return { ok: false, error: 'core.md of the contract is missing' };
    const skill = extractCore(readFileSync(p.skill, 'utf8'));
    const core = parseCore(readFileSync(p.core, 'utf8'));
    if (core.version !== skill.version) return { ok: false, error: `version drift: SKILL.md v${skill.version}, core.md v${core.version}` };
    if (hashOf(core.body) !== core.hash) return { ok: false, error: 'core.md body does not match its own hash' };
    if (hashOf(skill.body) !== core.hash) return { ok: false, error: 'core.md is stale: the SKILL.md core differs' };
    return { ok: true, version: core.version, hash: core.hash, body: core.body, skillPath: p.skill };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}
