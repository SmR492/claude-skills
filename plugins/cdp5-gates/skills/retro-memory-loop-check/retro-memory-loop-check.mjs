#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — Retro→Memory-Loop-Check (read-only): jeder in Retro-/ADR-Dokumenten
// zitierte Memory-Slug (feedback_* / project_* / [[slug]]) muss real angelegt sein UND einen
// Pointer im Memory-Index haben — sonst verdampft die Lehre (CDP5 §32.6).
// Exit: 0 = Loop dicht · 1 = ≥1 zitierter Slug fehlt/ohne Pointer · 2 = Nutzungsfehler.

import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { guardPaths } from '../../lib/args.mjs';

const SLUG_RE = /(?:\[\[([a-z0-9][a-z0-9_-]+)\]\]|\b((?:feedback|project|reference)_[a-z0-9_]+)\b|\(((?:feedback|project|reference)_[a-z0-9_]+)\.md\))/g;

function mdFiles(dir) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); let st; try { st = lstatSync(f); } catch { continue; } if (st.isSymbolicLink()) continue; if (st.isDirectory()) { if (n !== '.git') walk(f); } else if (n.endsWith('.md')) out.push(f); } };
  if (existsSync(dir)) walk(dir);
  return out;
}

export function checkLoop(retroDir, memoryDir) {
  const indexPath = join(memoryDir, 'MEMORY.md');
  const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  const cited = new Map(); // slug -> Set(quelle)
  for (const f of mdFiles(retroDir)) {
    const text = readFileSync(f, 'utf8');
    for (const m of text.matchAll(SLUG_RE)) {
      const slug = m[1] || m[2] || m[3];
      if (!slug) continue;
      if (!cited.has(slug)) cited.set(slug, new Set());
      cited.get(slug).add(relative(retroDir, f));
    }
  }
  const findings = [];
  for (const [slug, sources] of cited) {
    const fileExists = existsSync(join(memoryDir, `${slug}.md`));
    const hasPointer = new RegExp(`\\(${slug}\\.md\\)|\\b${slug}\\b`).test(index);
    if (!fileExists || !hasPointer) {
      findings.push({ slug, fileExists, hasPointer, sources: [...sources] });
    }
  }
  return { cited: cited.size, findings, broken: findings.length > 0 };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.retro || !a.memory) { console.error('Usage: retro-memory-loop-check.mjs --retro=<retro-dir> --memory=<memory-dir> [--json]'); process.exit(2); }
  guardPaths([[a.retro, 'dir'], [a.memory, 'dir']]);
  const r = checkLoop(a.retro, a.memory);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.broken ? 1 : 0); }
  console.log(`Retro→Memory-Loop — ${r.cited} zitierte Slugs, ${r.findings.length} gebrochen\n`);
  for (const f of r.findings) {
    const why = [!f.fileExists && 'Datei fehlt', !f.hasPointer && 'kein MEMORY.md-Pointer'].filter(Boolean).join(' + ');
    console.log(`  ✗ ${f.slug} — ${why}  (zitiert in: ${f.sources.join(', ')})`);
  }
  if (!r.broken) console.log('  Loop dicht: jeder zitierte Slug existiert + hat Pointer.');
  process.exit(r.broken ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
