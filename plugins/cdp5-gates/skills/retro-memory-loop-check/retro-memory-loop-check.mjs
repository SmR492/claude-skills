#!/usr/bin/env node
// CDP5 §32.9 T1 skill — retro→memory loop check (read-only): every memory slug cited in
// retro/ADR documents (`feedback_x` / [[slug]] / (…slug.md) link) must actually exist AND have a
// markdown link in the memory index — otherwise the lesson evaporates (CDP5 §32.6).
// A retro that cites nothing and does not declare `no new lesson:` leaves the loop open (🟡).
// Exit: 0 = no 🔴 · 1 = ≥1 🔴 (cited slug missing/without pointer) · 2 = usage error.

import { readFileSync, existsSync, readdirSync, lstatSync } from 'node:fs';
import { join, relative } from 'node:path';
import { pathToFileURL } from 'node:url';
import { guardPaths } from '../../lib/args.mjs';

// Citation forms (bare words are NOT citations — `project_root` in prose is an identifier, not a slug):
//   [[slug]]  ·  `feedback_x` in backticks  ·  (…/feedback_x.md) markdown link target
const SLUG_RE = /\[\[([a-z0-9][a-z0-9_-]+)\]\]|`((?:feedback|project|reference)_[a-z0-9_]+)`|\((?:[^()\s]*\/)?((?:feedback|project|reference)_[a-z0-9_]+)\.md\)/g;
const NO_LESSON_RE = /^[^\n]*\bno new lesson:/im;

function mdFiles(dir) {
  const out = [];
  const walk = (d) => { for (const n of readdirSync(d)) { const f = join(d, n); let st; try { st = lstatSync(f); } catch { continue; } if (st.isSymbolicLink()) continue; if (st.isDirectory()) { if (n !== '.git') walk(f); } else if (n.endsWith('.md')) out.push(f); } };
  if (existsSync(dir)) walk(dir);
  return out;
}

export function checkLoop(retroDir, memoryDir) {
  const indexPath = join(memoryDir, 'MEMORY.md');
  const index = existsSync(indexPath) ? readFileSync(indexPath, 'utf8') : '';
  const cited = new Map(); // slug -> Set(source)
  const findings = [];
  for (const f of mdFiles(retroDir)) {
    const text = readFileSync(f, 'utf8');
    const rel = relative(retroDir, f);
    let n = 0;
    for (const m of text.matchAll(SLUG_RE)) {
      const slug = m[1] || m[2] || m[3];
      if (!slug) continue;
      n++;
      if (!cited.has(slug)) cited.set(slug, new Set());
      cited.get(slug).add(rel);
    }
    if (n === 0 && !NO_LESSON_RE.test(text))
      findings.push({ sev: '🟡', kind: 'no-lesson', file: rel, detail: 'cites no memory slug and has no `no new lesson:` line — loop open' });
  }
  // Consecutive numbering (§32.6): two retro files with the same four-digit prefix in one directory break the
  // carry-over chain (which retro is "the previous one"?).
  const byNumber = new Map();
  for (const f of mdFiles(retroDir)) {
    const m = /^(\d{4})-/.exec(f.split(/[\\/]/).pop());
    if (!m) continue;
    if (!byNumber.has(m[1])) byNumber.set(m[1], []);
    byNumber.get(m[1]).push(relative(retroDir, f));
  }
  for (const [num, files] of byNumber) if (files.length > 1)
    findings.push({ sev: '🟡', kind: 'numbering', file: files.join(', '), detail: `retro number ${num} is used ${files.length} times — renumber or move to the owning project` });
  for (const [slug, sources] of cited) {
    const fileExists = existsSync(join(memoryDir, `${slug}.md`));
    const hasPointer = new RegExp(`\\]\\([^)]*${slug}\\.md\\)`).test(index);   // markdown link target, not a bare mention
    if (!fileExists || !hasPointer) findings.push({ sev: '🔴', kind: 'slug', slug, fileExists, hasPointer, sources: [...sources] });
  }
  return { cited: cited.size, findings, broken: findings.some((f) => f.sev === '🔴') };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.retro || !a.memory) { console.error('Usage: retro-memory-loop-check.mjs --retro=<retro-dir> --memory=<memory-dir> [--json]'); process.exit(2); }
  guardPaths([[a.retro, 'dir'], [a.memory, 'dir']]);
  const r = checkLoop(a.retro, a.memory);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.broken ? 1 : 0); }
  const slugFindings = r.findings.filter((f) => f.kind === 'slug');
  const numbering = r.findings.filter((f) => f.kind === 'numbering').length;
  console.log(`retro→memory loop — ${r.cited} cited slugs, ${slugFindings.length} broken, ${r.findings.length - slugFindings.length - numbering} retros without lesson, ${numbering} duplicate retro numbers\n`);
  for (const f of r.findings) {
    if (f.kind === 'slug') {
      const why = [!f.fileExists && 'file missing', !f.hasPointer && 'no MEMORY.md link'].filter(Boolean).join(' + ');
      console.log(`  ${f.sev} ${f.slug} — ${why}  (cited in: ${f.sources.join(', ')})`);
    } else {
      console.log(`  ${f.sev} ${f.file} — ${f.detail}`);
    }
  }
  if (!r.findings.length) console.log('  loop closed: every cited slug exists and is linked from MEMORY.md.');
  process.exit(r.broken ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
