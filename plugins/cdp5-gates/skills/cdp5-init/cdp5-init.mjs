#!/usr/bin/env node
// CDP5 §32.9 hybrid skill — cdp5-init: wires a consumer CLAUDE.md to the marketplace.
// DETERMINISTIC CORE: idempotent marker merge of a project-independent block
// (<!-- cdp5:start -->…<!-- cdp5:end -->) + diff. Writes ONLY between the markers, ONLY with --write.
// The confirmation loop + AI adjustment (on rejection) is driven by the main agent via SKILL.md.
// Exit: 0 = ok (diff shown / written) · 1 = (n/a) · 2 = usage/input error.

import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardPaths, usage } from '../../lib/args.mjs';

export const START = '<!-- cdp5:start -->';
export const END = '<!-- cdp5:end -->';
const DEFAULT_BLOCK = join(dirname(fileURLToPath(import.meta.url)), 'cdp5-block.md');

/** Mandatory invariants of every block (including an AI-adjusted one): CDP5 reference + cdp5-reference gate. */
export function blockInvariantError(content) {
  if (!/CDP5/.test(content)) return 'Block invariant violated: CDP5 reference missing.';
  if (!/cdp5-reference/.test(content)) return 'Block invariant violated: cdp5-reference gate missing.';
  return null;
}

export function buildBlock(content) { return `${START}\n${content.trim()}\n${END}`; }

/** Locates the marker pair. kind: 'none' | 'broken' | 'found'. */
export function findBlock(md) {
  const s = md.indexOf(START), e = md.indexOf(END);
  if (s === -1 && e === -1) return { kind: 'none' };
  if (s === -1 || e === -1 || e < s) return { kind: 'broken' };
  return { kind: 'found', s, e: e + END.length, multiple: md.indexOf(START, s + START.length) !== -1 };
}

/** Idempotent merge: append the block (no marker) or replace it (marker present). */
export function mergeBlock(md, content) {
  const block = buildBlock(content);
  const loc = findBlock(md);
  if (loc.kind === 'broken') return { error: 'Marker pair inconsistent (only start or only end / end before start) — no write.' };
  if (loc.kind === 'none') {
    const sep = md === '' ? '' : (md.endsWith('\n') ? '\n' : '\n\n');
    return { md: `${md}${sep}${block}\n`, mode: 'append', multiple: false };
  }
  return { md: md.slice(0, loc.s) + block + md.slice(loc.e), mode: 'replace', multiple: loc.multiple };
}

/** Human-readable block diff (old → new). */
export function computeDiff(md, content) {
  const merged = mergeBlock(md, content);
  if (merged.error) return { error: merged.error };
  if (merged.md === md) return { mode: 'noop', diff: '(no change — block already up to date)' };
  const loc = findBlock(md);
  const oldBlock = loc.kind === 'found' ? md.slice(loc.s, loc.e) : '';
  const lines = [];
  if (oldBlock) for (const l of oldBlock.split('\n')) lines.push(`- ${l}`);
  for (const l of buildBlock(content).split('\n')) lines.push(`+ ${l}`);
  return { mode: merged.mode, multiple: merged.multiple, diff: lines.join('\n') };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (typeof a.target !== 'string') usage('Usage: cdp5-init.mjs --target=<CLAUDE.md> [--write] [--block=<file>]');
  if (existsSync(a.target) && !lstatSync(a.target).isFile()) usage(`--target is not a file: ${a.target}`);   // may be missing (will be created), but must not be a directory
  if (a.block) guardPaths([[a.block, 'file']]);

  const content = readFileSync(typeof a.block === 'string' ? a.block : DEFAULT_BLOCK, 'utf8');
  const invErr = blockInvariantError(content);
  if (invErr) usage(invErr);                                  // AI-adjusted block without gate/reference → reject (exit 2)

  const current = existsSync(a.target) ? readFileSync(a.target, 'utf8') : '';

  if (!a.write) {                                             // default: read-only diff
    const d = computeDiff(current, content);
    if (d.error) usage(d.error);
    if (d.multiple) console.error('Warning: multiple cdp5 marker pairs — only the first one will be replaced.');
    console.log(`cdp5-init (preview, ${d.mode}) — ${a.target}\n`);
    console.log(d.diff);
    console.log('\nApply with --write (after confirmation).');
    process.exit(0);
  }

  const merged = mergeBlock(current, content);               // --write: write
  if (merged.error) usage(merged.error);
  if (merged.multiple) console.error('Warning: multiple cdp5 marker pairs — only the first one was replaced.');
  try { writeFileSync(a.target, merged.md); } catch (e) { usage(`target not writable: ${a.target} (${e.code || e.message})`); }
  console.log(`cdp5-init: block ${merged.mode === 'append' ? 'appended' : 'replaced'} → ${a.target}`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
