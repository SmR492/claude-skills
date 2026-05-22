#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — Konzept↔Code-Mapping (read-only Report).
// Pro UC im Konzept: sind die genannten Artefakte (Pfade, Klassen, Routes, Test-Klassen)
// im Repo vorhanden? Status ✓ (alle) / teilweise / fehlt / n/a (keine verifizierbaren).
// Konvention: ein UC ist eine `## UC-…:`-Sektion; verifizierbare Artefakte stehen in `…`-Backticks.
// Exit: 0 = kein voll fehlender UC · 1 = ≥1 UC „fehlt" · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { collectFiles, locate, backtickTokens } from '../../lib/scan.mjs';

const CODE_EXT = ['.php', '.js', '.mjs', '.ts', '.twig', '.yaml', '.yml', '.sql', '.json'];

/** UC-Sektionen aus dem Konzept-Markdown. */
export function parseUCs(md) {
  const lines = md.split('\n');
  const ucs = [];
  let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(UC[-\s][^\n]*)/i);
    if (h) { cur = { title: h[1].trim(), body: '' }; ucs.push(cur); continue; }
    if (/^#{1,2}\s/.test(line) && !/^##\s+UC/i.test(line)) cur = null; // andere Überschrift beendet UC
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
    else if (found.length === 0) status = 'fehlt';
    else status = 'teilweise';
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
  const rows = mapKonzept(args.konzept, args.repo);
  if (args.json) { console.log(JSON.stringify(rows, null, 2)); }
  else {
    console.log(`Konzept↔Code-Mapping — ${rows.length} UCs\n`);
    for (const r of rows) {
      const m = r.missing.length ? `  · fehlt: ${r.missing.join(', ')}` : '';
      console.log(`  [${r.status}] ${r.uc}  (${r.found}/${r.total})${m}`);
    }
    const fehlt = rows.filter((r) => r.status === 'fehlt').length;
    const teil = rows.filter((r) => r.status === 'teilweise').length;
    console.log(`\n${rows.filter((r) => r.status === '✓').length} ✓ · ${teil} teilweise · ${fehlt} fehlt`);
  }
  process.exit(rows.some((r) => r.status === 'fehlt') ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
