#!/usr/bin/env node
// CDP5 §32.9 T1 skill — roadmap↔code drift (read-only): does every artefact a roadmap marks as
// DONE really exist in the repo? Prevents double builds + plan hallucinations.
// Exit: 0 = no 🔴 (no drift) · 1 = ≥1 🔴 (claimed artefact missing) · 2 = usage error.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { collectFiles, classify, locate, backtickTokens } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

// Status markers are matched against user roadmaps, which are often written in German;
// the German markers stay, English equivalents are accepted alongside them.
// Whole words only: `ABANDONED` must not count as DONE, `unimplemented` not as implemented.
const DONE_WORDS = ['GESCHLOSSEN', 'EXISTIERT', 'umgesetzt', 'geliefert', 'gelandet', 'DONE', 'CLOSED', 'EXISTS', 'implemented', 'delivered', 'landed'];
const DONE_RE = new RegExp(`(^|[^\\w])(${DONE_WORDS.join('|')})(?![\\w])`, 'gi');
const DONE_EMOJI = '✅';
const NOT_DONE = /(❌|🔴|🟡|\bnicht\b|\bkein\b|\boffen\b|\bTODO\b|\bTBD\b|\bgeplant\b|\bnot\b|\bplanned\b|\bpending\b)/i;
const NEGATION_WINDOW = 20;   // characters before the marker in which a negation cancels it
const CODE_EXT = ['.php', '.js', '.mjs', '.ts', '.twig', '.yaml', '.yml', '.sql', '.json', '.md'];

/** Positions of DONE markers in a line (word markers + ✅). */
function doneMarkers(line) {
  const out = [];
  for (const m of line.matchAll(DONE_RE)) out.push(m.index + m[1].length);
  let i = line.indexOf(DONE_EMOJI);
  while (i !== -1) { out.push(i); i = line.indexOf(DONE_EMOJI, i + DONE_EMOJI.length); }
  return out;
}

/** A line is DONE when at least one marker is not negated within the 20 characters before it. */
export function isDoneLine(line) {
  return doneMarkers(line).some((pos) => !NOT_DONE.test(line.slice(Math.max(0, pos - NEGATION_WINDOW), pos)));
}

export function parseClaims(md) {
  const out = [];
  md.split('\n').forEach((line, i) => {
    if (!isDoneLine(line)) return; // "nicht umgesetzt" (not implemented) / "❌ DONE" does not count as done
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
    results.push({ ...c, kind: r.kind, found: r.found, strength: r.strength, evidence: r.evidence, sev: r.found ? '🟢' : '🔴' });
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
  for (const x of r.results) console.log(`  ${x.sev} [${x.found ? 'found' : 'MISSING'}] ${x.token}  (line ${x.line}${x.evidence ? `, ${x.evidence}` : ''})`);
  console.log(r.drift ? `\nDRIFT: ${r.missing.length} missing.` : '\nNo drift.');
  process.exit(r.drift ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
