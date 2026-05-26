#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — Wiki-Lint (read-only): deterministische Checks eines Markdown-Wikis.
// Broken internal links · Orphan-Pages (keine eingehenden Links) · Frontmatter-Konsistenz.
// Die LLM-Anteile des alten wiki-lint-Agents (stale-claims, Pattern-Promotion, Cross-Ref-Sinn)
// bleiben Agent/Mensch — dieser Skill macht nur die mechanischen Checks.
// Exit: 0 = keine Broken-Links · 1 = ≥1 Broken-Link · 2 = Nutzungsfehler.

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
    // --- interne Links ---
    for (const m of text.matchAll(/\[[^\]]*\]\(([^)]+)\)/g)) {
      let target = m[1].trim().split('#')[0];
      if (!target || /^(https?:|mailto:|#)/.test(target)) continue;
      if (!target.endsWith('.md')) continue;
      const abs = resolve(dirname(file), target);
      linkedTargets.add(abs);
      if (!existsSync(abs)) brokenLinks.push({ from: relative(wikiRoot, file), target });
    }
    // --- Frontmatter ---
    if (!text.startsWith('---')) {
      frontmatterIssues.push({ file: relative(wikiRoot, file), issue: 'kein YAML-Frontmatter' });
    } else {
      const end = text.indexOf('\n---', 3);
      const fm = end > 0 ? text.slice(3, end) : '';
      const missing = REQUIRED_FRONTMATTER.filter((k) => !new RegExp(`^${k}\\s*:`, 'm').test(fm));
      if (missing.length) frontmatterIssues.push({ file: relative(wikiRoot, file), issue: `fehlende Keys: ${missing.join(', ')}` });
    }
  }

  // --- Orphans ---
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
  console.log(`Wiki-Lint — ${r.scanned} Seiten gescannt\n`);
  console.log(`🔗 Broken Links: ${r.brokenLinks.length}`);
  for (const b of r.brokenLinks) console.log(`   ✗ ${b.from} → ${b.target}`);
  console.log(`\n🟠 Orphans (keine eingehenden Links): ${r.orphans.length}`);
  for (const o of r.orphans) console.log(`   · ${o}`);
  console.log(`\n📋 Frontmatter-Probleme: ${r.frontmatterIssues.length}`);
  for (const f of r.frontmatterIssues) console.log(`   · ${f.file}: ${f.issue}`);
  process.exit(r.brokenLinks.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
