#!/usr/bin/env node
// CDP5 reference — gives an agent exactly the required doctrine excerpt instead of the whole
// 2000-line file (just-in-time retrieval, CDP5 §28.6). Query by § number or keyword.
//   --section=33.1        → the section (including subsections)
//   --keyword="lethal"    → all blocks whose heading/text contains the term (with snippet)
//   --list                → all section headings (table of contents)
// Exit: 0 = hit · 2 = no hit / usage error. A reference lookup is not a gate: there is no finding, so exit 1 is never used.

import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
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
  // `(?!\.\d)` keeps `--section=10` from matching the combined heading `10.6 / 10.7 / 19 — …`.
  const re = new RegExp(`^(§\\s*)?${esc}(?!\\.\\d)(\\b|[.\\s:—-])`);
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
  guardPaths([[a.doctrine, 'file']]);   // optional --doctrine: wrong type/missing → exit 2 instead of a crash
  const md = readFileSync(typeof a.doctrine === 'string' ? a.doctrine : DEFAULT_DOCTRINE, 'utf8');
  if (a.list) { console.log(listSections(md).join('\n')); process.exit(0); }
  if (typeof a.section === 'string') {
    const s = bySection(md, a.section);
    if (!s) { console.error(`§${a.section} not found. --list shows all sections.`); process.exit(2); }
    console.log(s); process.exit(0);
  }
  if (typeof a.keyword === 'string') {
    const hits = byKeyword(md, a.keyword);
    if (!hits.length) { console.error(`No hit for "${a.keyword}".`); process.exit(2); }
    for (const h of hits) console.log(`§ ${h.heading}\n   ${h.snippet}\n`);
    process.exit(0);
  }
  console.error('Usage: cdp5.mjs --section=<X> | --keyword=<term> | --list  [--doctrine=<path>]');
  process.exit(2);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
