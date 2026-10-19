#!/usr/bin/env node
// CDP5 §32.9 T1 skill — concept↔code mapping (read-only report).
// For each UC in the concept: do the named artefacts (paths, classes, routes, test classes)
// exist in the repo? Status ✓ (all) / partial / missing / n/a (nothing verifiable).
// Convention: a UC is a `## UC-…:` section; verifiable artefacts are written in `…` backticks.
// Exit: 0 = no fully missing UC · 1 = ≥1 UC "missing" · 2 = usage error.

import { readFileSync } from 'node:fs';
import { collectFiles, locate, backtickTokens } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

const CODE_EXT = ['.php', '.js', '.mjs', '.ts', '.twig', '.yaml', '.yml', '.sql', '.json'];

/** UC sections from the concept Markdown. */
export function parseUCs(md) {
  const lines = md.split('\n');
  const ucs = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(UC[-\s][^\n]*)/i);
    if (h) { cur = { title: h[1].trim(), body: '' }; ucs.push(cur); continue; }
    if (/^#{1,2}\s/.test(line) && !/^##\s+UC/i.test(line)) cur = null; // any other heading ends the UC
    if (cur) cur.body += line + '\n';
  }
  return ucs;
}

export function mapKonzept(konzeptPath, repoRoot) {
  const md = readFileSync(konzeptPath, 'utf8');
  const files = collectFiles(repoRoot, CODE_EXT).filter((f) => f !== konzeptPath);
  const rows = [];
  for (const uc of parseUCs(md)) {
    const tokens = [...new Set(backtickTokens(uc.body))];
    const checked = tokens.map((t) => ({ token: t, ...locate(t, repoRoot, files) })).filter((r) => r.kind !== null);
    const found = checked.filter((r) => r.found);
    const missing = checked.filter((r) => !r.found).map((r) => r.token);
    let status;
    if (checked.length === 0) status = 'n/a';
    else if (found.length === checked.length) status = '✓';
    else if (found.length === 0) status = 'missing';
    else status = 'partial';
    rows.push({ uc: uc.title, status, found: found.length, total: checked.length, missing });
  }
  return rows;
}

function main(argv) {
  const args = Object.fromEntries(argv.slice(2).map((a) => { const [k, v] = a.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!args.konzept || !args.repo) {
    console.error('Usage: konzept-mapper.mjs --konzept=<konzept.md> --repo=<repo-root> [--json]');
    process.exit(2);
  }
  guardPaths([[args.konzept, 'file'], [args.repo, 'dir']]);
  const rows = mapKonzept(args.konzept, args.repo);
  if (args.json) { console.log(JSON.stringify(rows, null, 2)); }
  else {
    console.log(`Concept↔code mapping — ${rows.length} UCs\n`);
    for (const r of rows) {
      const m = r.missing.length ? `  · missing: ${r.missing.join(', ')}` : '';
      console.log(`  [${r.status}] ${r.uc}  (${r.found}/${r.total})${m}`);
    }
    const missing = rows.filter((r) => r.status === 'missing').length;
    const partial = rows.filter((r) => r.status === 'partial').length;
    console.log(`\n${rows.filter((r) => r.status === '✓').length} ✓ · ${partial} partial · ${missing} missing`);
  }
  process.exit(rows.some((r) => r.status === 'missing') ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
