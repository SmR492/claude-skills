#!/usr/bin/env node
// CDP5 §32.9 T1 skill — roadmap↔code drift (read-only): does every artefact a roadmap marks as
// DONE really exist in the repo? Prevents double builds + plan hallucinations.
// Exit: 0 = no drift · 1 = ≥1 claimed artefact missing · 2 = usage error.

import { readFileSync } from 'node:fs';
import { collectFiles, classify, locate, backtickTokens } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

// Status markers are matched against user roadmaps, which are often written in German;
// the German markers stay, English equivalents are accepted alongside them.
const DONE = ['✅', 'GESCHLOSSEN', 'EXISTIERT', 'umgesetzt', 'geliefert', 'gelandet', 'DONE', 'CLOSED', 'EXISTS', 'implemented', 'delivered', 'landed'];
const NOT_DONE = /(❌|🔴|🟡|\bnicht\b|\bkein\b|\boffen\b|\bTODO\b|\bTBD\b|\bgeplant\b|\bnot\b|\bplanned\b|\bpending\b)/i;
const CODE_EXT = ['.php', '.js', '.mjs', '.ts', '.twig', '.yaml', '.yml', '.sql', '.json', '.md'];

export function parseClaims(md) {
  const out = [];
  md.split('\n').forEach((line, i) => {
    if (!DONE.some((m) => line.includes(m))) return;
    if (NOT_DONE.test(line)) return; // "nicht umgesetzt" (not implemented) / "🟡 offen" (open) does not count as done
    for (const t of backtickTokens(line)) out.push({ token: t, line: i + 1 });
  });
  return out;
}

export function checkRoadmap(roadmapPath, repoRoot) {
  const md = readFileSync(roadmapPath, 'utf8');
  const resolved = roadmapPath;
  const files = collectFiles(repoRoot, CODE_EXT).filter((f) => f !== resolved);
  const results = [];
  for (const c of parseClaims(md)) {
    if (classify(c.token) === null) continue;
    const r = locate(c.token, repoRoot, files);
    results.push({ ...c, kind: r.kind, found: r.found, evidence: r.evidence });
  }
  const missing = results.filter((r) => !r.found);
  return { results, missing, drift: missing.length > 0, scanned: files.length };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, v] = x.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!a.roadmap || !a.repo) { console.error('Usage: roadmap-drift.mjs --roadmap=<roadmap.md> --repo=<root> [--json]'); process.exit(2); }
  guardPaths([[a.roadmap, 'file'], [a.repo, 'dir']]);
  const r = checkRoadmap(a.roadmap, a.repo);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.drift ? 1 : 0); }
  console.log(`Roadmap drift — ${r.results.length} claimed artefacts, ${r.scanned} files\n`);
  for (const x of r.results) console.log(`  [${x.found ? '✓' : '✗ MISSING'}] ${x.token}  (line ${x.line}${x.evidence ? `, ${x.evidence}` : ''})`);
  console.log(r.drift ? `\nDRIFT: ${r.missing.length} missing.` : '\nNo drift.');
  process.exit(r.drift ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
