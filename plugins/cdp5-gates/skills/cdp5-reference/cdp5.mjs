#!/usr/bin/env node
// CDP5-Reference — gibt einem Agenten genau den nötigen Doktrin-Ausschnitt, statt der ganzen
// 2000-Zeilen-Datei (just-in-time-Retrieval, CDP5 §28.6). Abfrage per §-Nummer oder Schlagwort.
//   --section=33.1        → die Sektion (inkl. Untersektionen)
//   --keyword="lethal"    → alle Blöcke, deren Überschrift/Text den Begriff enthält (mit Snippet)
//   --list                → alle Sektions-Überschriften (Inhaltsverzeichnis)
// Exit: 0 = Treffer · 1 = kein Treffer · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guardPaths } from '../../lib/args.mjs';

const DEFAULT_DOCTRINE = join(dirname(fileURLToPath(import.meta.url)), 'konzept-design-pattern-v5.md');

export function splitBlocks(md) {
  const blocks = [];
  let cur = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^(#{1,4})\s+(.*)$/);
    if (h) { if (cur) blocks.push(cur); cur = { level: h[1].length, heading: h[2].trim(), headingLine: line, body: [] }; }
    else if (cur) cur.body.push(line);
  }
  if (cur) blocks.push(cur);
  return blocks;
}

const text = (b) => `${b.headingLine}\n${b.body.join('\n')}`.trimEnd();

export function bySection(md, sec) {
  const esc = sec.replace(/[.]/g, '\\.');
  const re = new RegExp(`^(§\\s*)?${esc}(\\b|[.\\s:—-])`);
  const blocks = splitBlocks(md);
  const start = blocks.findIndex((b) => re.test(b.heading));
  if (start < 0) return null;
  const level = blocks[start].level;
  const out = [blocks[start]];
  for (let i = start + 1; i < blocks.length && blocks[i].level > level; i++) out.push(blocks[i]);
  return out.map(text).join('\n\n');
}

export function byKeyword(md, term) {
  const t = term.toLowerCase();
  return splitBlocks(md)
    .filter((b) => `${b.heading}\n${b.body.join('\n')}`.toLowerCase().includes(t))
    .map((b) => {
      const hit = b.body.find((l) => l.toLowerCase().includes(t));
      return { heading: b.heading, snippet: (hit || b.body.find((l) => l.trim()) || '').trim().slice(0, 200) };
    });
}

export function listSections(md) {
  return splitBlocks(md).filter((b) => b.level <= 3).map((b) => `${'  '.repeat(b.level - 1)}${b.heading}`);
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  guardPaths([[a.doctrine, 'file']]);   // optionaler --doctrine: falscher Typ/fehlend → Exit 2 statt Crash
  const md = readFileSync(typeof a.doctrine === 'string' ? a.doctrine : DEFAULT_DOCTRINE, 'utf8');
  if (a.list) { console.log(listSections(md).join('\n')); process.exit(0); }
  if (typeof a.section === 'string') {
    const s = bySection(md, a.section);
    if (!s) { console.error(`§${a.section} nicht gefunden. --list zeigt alle Sektionen.`); process.exit(1); }
    console.log(s); process.exit(0);
  }
  if (typeof a.keyword === 'string') {
    const hits = byKeyword(md, a.keyword);
    if (!hits.length) { console.error(`Kein Treffer für „${a.keyword}".`); process.exit(1); }
    for (const h of hits) console.log(`§ ${h.heading}\n   ${h.snippet}\n`);
    process.exit(0);
  }
  console.error('Usage: cdp5.mjs --section=<X> | --keyword=<term> | --list  [--doctrine=<path>]');
  process.exit(2);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
