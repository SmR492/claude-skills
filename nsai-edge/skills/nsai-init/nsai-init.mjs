#!/usr/bin/env node
// nsai-init — verankert die WISSENSDOKTRIN (nsai-edge als Tier-1-Wissensbasis) als EIGENEN,
// idempotenten Marker-Block (<!-- nsai:start -->…<!-- nsai:end -->) in einer Konsumenten-CLAUDE.md.
// Bewusste Trennung: cdp5-init = Konzeptdoktrin (WIE), nsai-init = Wissensdoktrin (WAS).
// Eigenständig — KEINE Abhängigkeit auf cdp5-gates; nsai-edge ist unabhängig installierbar.
// Schreibt NUR zwischen den Markern, NUR mit --write. Exit: 0 = ok · 2 = Nutzungs-/Input-Fehler.

import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const START = '<!-- nsai:start -->';
export const END = '<!-- nsai:end -->';
const DEFAULT_BLOCK = join(dirname(fileURLToPath(import.meta.url)), 'nsai-block.md');

function usage(msg) { console.error(msg); process.exit(2); }

/** Pflicht-Invarianten jedes Blocks (auch eines KI-angepassten): nsai-edge-Wissensbasis + graph__-MCP-Tools. */
export function blockInvariantError(content) {
  if (!/nsai-edge/.test(content)) return 'Block-Invariante verletzt: nsai-edge-Wissensbasis-Verweis fehlt.';
  if (!/graph__/.test(content)) return 'Block-Invariante verletzt: graph__-MCP-Tool-Verweis fehlt.';
  return null;
}

export function buildBlock(content) { return `${START}\n${content.trim()}\n${END}`; }

/** Lokalisiert das Marker-Paar. kind: 'none' | 'broken' | 'found'. */
export function findBlock(md) {
  const s = md.indexOf(START), e = md.indexOf(END);
  if (s === -1 && e === -1) return { kind: 'none' };
  if (s === -1 || e === -1 || e < s) return { kind: 'broken' };
  return { kind: 'found', s, e: e + END.length, multiple: md.indexOf(START, s + START.length) !== -1 };
}

/** Idempotenter Merge: Block anhängen (kein Marker) oder ersetzen (Marker vorhanden). */
export function mergeBlock(md, content) {
  const block = buildBlock(content);
  const loc = findBlock(md);
  if (loc.kind === 'broken') return { error: 'Marker-Paar inkonsistent (nur Start oder nur End / End vor Start) — kein Write.' };
  if (loc.kind === 'none') {
    const sep = md === '' ? '' : (md.endsWith('\n') ? '\n' : '\n\n');
    return { md: `${md}${sep}${block}\n`, mode: 'append', multiple: false };
  }
  return { md: md.slice(0, loc.s) + block + md.slice(loc.e), mode: 'replace', multiple: loc.multiple };
}

/** Menschlich lesbarer Block-Diff (alt → neu). */
export function computeDiff(md, content) {
  const merged = mergeBlock(md, content);
  if (merged.error) return { error: merged.error };
  if (merged.md === md) return { mode: 'noop', diff: '(keine Änderung — Block bereits aktuell)' };
  const loc = findBlock(md);
  const oldBlock = loc.kind === 'found' ? md.slice(loc.s, loc.e) : '';
  const lines = [];
  if (oldBlock) for (const l of oldBlock.split('\n')) lines.push(`- ${l}`);
  for (const l of buildBlock(content).split('\n')) lines.push(`+ ${l}`);
  return { mode: merged.mode, multiple: merged.multiple, diff: lines.join('\n') };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (typeof a.target !== 'string') usage('Usage: nsai-init.mjs --target=<CLAUDE.md> [--write] [--block=<datei>]');
  if (existsSync(a.target) && !lstatSync(a.target).isFile()) usage(`--target ist keine Datei: ${a.target}`);
  if (typeof a.block === 'string' && (!existsSync(a.block) || !lstatSync(a.block).isFile())) usage(`--block ist keine Datei: ${a.block}`);

  const content = readFileSync(typeof a.block === 'string' ? a.block : DEFAULT_BLOCK, 'utf8');
  const invErr = blockInvariantError(content);
  if (invErr) usage(invErr);                                  // KI-angepasster Block ohne nsai-edge/graph__ → Reject (Exit 2)

  const current = existsSync(a.target) ? readFileSync(a.target, 'utf8') : '';

  if (!a.write) {                                             // Default: read-only Diff
    const d = computeDiff(current, content);
    if (d.error) usage(d.error);
    if (d.multiple) console.error('Warnung: mehrere nsai-Marker-Paare — nur das erste wird ersetzt.');
    console.log(`nsai-init (Vorschau, ${d.mode}) — ${a.target}\n`);
    console.log(d.diff);
    console.log('\nMit --write übernehmen (nach Bestätigung).');
    process.exit(0);
  }

  const merged = mergeBlock(current, content);               // --write: schreiben
  if (merged.error) usage(merged.error);
  if (merged.multiple) console.error('Warnung: mehrere nsai-Marker-Paare — nur das erste wurde ersetzt.');
  try { writeFileSync(a.target, merged.md); } catch (e) { usage(`Ziel nicht schreibbar: ${a.target} (${e.code || e.message})`); }
  console.log(`nsai-init: Block ${merged.mode === 'append' ? 'angehängt' : 'ersetzt'} → ${a.target}`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
