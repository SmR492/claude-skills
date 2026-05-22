#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — Roadmap↔Code-Drift (read-only): jedes als FERTIG markierte
// Artefakt einer Roadmap real im Repo? Verhindert Doppelbau + Plan-Halluzinationen.
// Exit: 0 = kein Drift · 1 = ≥1 beanspruchtes Artefakt fehlt · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { collectFiles, classify, locate, backtickTokens } from '../../lib/scan.mjs';

const DONE = ['✅', 'GESCHLOSSEN', 'EXISTIERT', 'umgesetzt', 'geliefert', 'gelandet'];
const NOT_DONE = /(❌|🔴|🟡|\bnicht\b|\bkein\b|\boffen\b|\bTODO\b|\bTBD\b|\bgeplant\b)/i;
const CODE_EXT = ['.php', '.js', '.mjs', '.ts', '.twig', '.yaml', '.yml', '.sql', '.json', '.md'];

export function parseClaims(md) {
  const out = [];
  md.split('\n').forEach((line, i) => {
    if (!DONE.some((m) => line.includes(m))) return;
    if (NOT_DONE.test(line)) return; // „nicht umgesetzt" / „🟡 offen" zählt nicht als fertig
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
  const r = checkRoadmap(a.roadmap, a.repo);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.drift ? 1 : 0); }
  console.log(`Roadmap-Drift — ${r.results.length} beanspruchte Artefakte, ${r.scanned} Dateien\n`);
  for (const x of r.results) console.log(`  [${x.found ? '✓' : '✗ FEHLT'}] ${x.token}  (Zeile ${x.line}${x.evidence ? `, ${x.evidence}` : ''})`);
  console.log(r.drift ? `\nDRIFT: ${r.missing.length} fehlt.` : '\nKein Drift.');
  process.exit(r.drift ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
