#!/usr/bin/env node
// CDP5 §32.9 Hybrid-Skill — cdp5-init: bindet eine Konsumenten-CLAUDE.md an den Marketplace an.
// DETERMINISTISCHER KERN: idempotenter Marker-Merge eines projektunabhängigen Blocks
// (<!-- cdp5:start -->…<!-- cdp5:end -->) + Diff. Schreibt NUR zwischen den Markern, NUR mit --write.
// Die Bestätigungs-Schleife + KI-Anpassung (bei Ablehnung) fährt der Haupt-Agent via SKILL.md.
// Exit: 0 = ok (Diff gezeigt / geschrieben) · 1 = (n/a) · 2 = Nutzungs-/Input-Fehler.

import { readFileSync, writeFileSync, existsSync, lstatSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardPaths, usage } from '../../lib/args.mjs';

export const START = '<!-- cdp5:start -->';
export const END = '<!-- cdp5:end -->';
const DEFAULT_BLOCK = join(dirname(fileURLToPath(import.meta.url)), 'cdp5-block.md');

/** Pflicht-Invarianten jedes Blocks (auch eines KI-angepassten): CDP5-Verweis + cdp5-reference-Gate. */
export function blockInvariantError(content) {
  if (!/CDP5/.test(content)) return 'Block-Invariante verletzt: CDP5-Verweis fehlt.';
  if (!/cdp5-reference/.test(content)) return 'Block-Invariante verletzt: cdp5-reference-Gate fehlt.';
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
  if (typeof a.target !== 'string') usage('Usage: cdp5-init.mjs --target=<CLAUDE.md> [--write] [--block=<datei>]');
  if (existsSync(a.target) && !lstatSync(a.target).isFile()) usage(`--target ist keine Datei: ${a.target}`);   // darf fehlen (wird erstellt), aber kein Verzeichnis
  if (a.block) guardPaths([[a.block, 'file']]);

  const content = readFileSync(typeof a.block === 'string' ? a.block : DEFAULT_BLOCK, 'utf8');
  const invErr = blockInvariantError(content);
  if (invErr) usage(invErr);                                  // KI-angepasster Block ohne Gate/Verweis → Reject (Exit 2)

  const current = existsSync(a.target) ? readFileSync(a.target, 'utf8') : '';

  if (!a.write) {                                             // Default: read-only Diff
    const d = computeDiff(current, content);
    if (d.error) usage(d.error);
    if (d.multiple) console.error('Warnung: mehrere cdp5-Marker-Paare — nur das erste wird ersetzt.');
    console.log(`cdp5-init (Vorschau, ${d.mode}) — ${a.target}\n`);
    console.log(d.diff);
    console.log('\nMit --write übernehmen (nach Bestätigung).');
    process.exit(0);
  }

  const merged = mergeBlock(current, content);               // --write: schreiben
  if (merged.error) usage(merged.error);
  if (merged.multiple) console.error('Warnung: mehrere cdp5-Marker-Paare — nur das erste wurde ersetzt.');
  try { writeFileSync(a.target, merged.md); } catch (e) { usage(`Ziel nicht schreibbar: ${a.target} (${e.code || e.message})`); }
  console.log(`cdp5-init: Block ${merged.mode === 'append' ? 'angehängt' : 'ersetzt'} → ${a.target}`);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
