#!/usr/bin/env node
// CDP5 §32.9 T1 skill — wiki-lint (read-only): deterministic checks of a Markdown wiki.
// Broken internal links · orphan pages (no inbound links) · frontmatter consistency.
// The LLM parts of the former wiki-lint agent (stale claims, pattern promotion, cross-ref meaning)
// stay with agent/human — this skill performs only the mechanical checks.
// Exit: 0 = no broken links · 1 = ≥1 broken link · 2 = usage error.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, resolve, relative, basename } from 'node:path';
import { collectFiles } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

const ENTRY_POINTS = new Set(['index.md', 'overview.md', 'log.md', 'README.md', 'rules.md']);
const REQUIRED_FRONTMATTER = ['title', 'type', 'updated'];

export function lintWiki(wikiRoot) {
  const files = collectFiles(wikiRoot, ['.md']);
  const linkedTargets = new Set();
  const brokenLinks = [];
  const frontmatterIssues = [];

  for (const file of files) {
    const text = readFileSync(file, 'utf8');
    // --- internal links ---
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = m[1].trim().split('#')[0];
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      if (!target.endsWith('.md')) continue;
      const abs = resolve(dirname(file), target);
      linkedTargets.add(abs);
      if (!existsSync(abs)) brokenLinks.push({ from: relative(wikiRoot, file), target });
    }
    // --- frontmatter ---
    if (!text.startsWith('---')) {
      frontmatterIssues.push({ file: relative(wikiRoot, file), issue: 'no YAML frontmatter' });
    } else {
      const end = text.indexOf('\n---', 3);
      const fm = end > 0 ? text.slice(3, end) : '';
      const missing = REQUIRED_FRONTMATTER.filter((k) => !new RegExp(`^${k}\\s*:`, 'm').test(fm));
      if (missing.length) frontmatterIssues.push({ file: relative(wikiRoot, file), issue: `missing keys: ${missing.join(', ')}` });
    }
  }

  // --- orphans ---
  const orphans = files
    .filter((f) => !linkedTargets.has(resolve(f)) && !ENTRY_POINTS.has(basename(f)))
    .map((f) => relative(wikiRoot, f));

  return { brokenLinks, orphans, frontmatterIssues, scanned: files.length };
}

function main(argv) {
  const args = Object.fromEntries(argv.slice(2).map((a) => { const [k, v] = a.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!args.wiki) { console.error('Usage: wiki-lint.mjs --wiki=<wiki-root> [--json]'); process.exit(2); }
  guardPaths([[args.wiki, 'dir']]);
  const r = lintWiki(args.wiki);
  if (args.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.brokenLinks.length ? 1 : 0); }
  console.log(`wiki-lint — ${r.scanned} pages scanned\n`);
  console.log(`🔗 Broken links: ${r.brokenLinks.length}`);
  for (const b of r.brokenLinks) console.log(`   ✗ ${b.from} → ${b.target}`);
  console.log(`\n🟠 Orphans (no inbound links): ${r.orphans.length}`);
  for (const o of r.orphans) console.log(`   · ${o}`);
  console.log(`\n📋 Frontmatter issues: ${r.frontmatterIssues.length}`);
  for (const f of r.frontmatterIssues) console.log(`   · ${f.file}: ${f.issue}`);
  process.exit(r.brokenLinks.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
