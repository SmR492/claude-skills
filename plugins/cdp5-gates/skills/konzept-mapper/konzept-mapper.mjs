#!/usr/bin/env node
// CDP5 §32.9 T1 skill — concept↔code mapping (read-only report).
// For each UC in the concept: do the named artefacts (paths, classes, routes, test classes)
// exist in the repo? Status ✓ (all found by declaration/path) / partial / missing / n/a (nothing verifiable).
// Convention: a UC is a `## UC-…` or `### UC-…` section (shared parser lib/scan.mjs); verifiable artefacts
// are written in `…` backticks. An artefact found only as a bare word occurrence is "weak" → UC at most partial.
// Exit: 0 = no 🔴 (no UC fully missing) · 1 = ≥1 🔴 (UC "missing") · 2 = usage error.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { collectFiles, locate, backtickTokens, parseUCs } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

export { parseUCs };

const CODE_EXT = ['.php', '.js', '.mjs', '.ts', '.twig', '.yaml', '.yml', '.sql', '.json'];
const STATE_LABEL = { declaration: 'found (decl)', path: 'found (path)', occurrence: 'weak' };
const SEV = { '✓': '🟢', 'n/a': '🟢', partial: '🟡', missing: '🔴' };

export function mapKonzept(konzeptPath, repoRoot) {
  const md = readFileSync(konzeptPath, 'utf8');
  const files = collectFiles(repoRoot, CODE_EXT).filter((f) => f !== konzeptPath);
  const rows = [];
  for (const uc of parseUCs(md)) {
    const tokens = [...new Set(backtickTokens(uc.body))];
    const artefacts = tokens
      .map((t) => ({ token: t, ...locate(t, repoRoot, files) }))
      .filter((r) => r.kind !== null)
      .map((r) => ({ token: r.token, kind: r.kind, state: r.found ? (r.strength === 'occurrence' ? 'weak' : 'found') : 'missing', strength: r.strength, evidence: r.evidence }));
    const found = artefacts.filter((r) => r.state === 'found');
    const weak = artefacts.filter((r) => r.state === 'weak').map((r) => r.token);
    const missing = artefacts.filter((r) => r.state === 'missing').map((r) => r.token);
    let status;
    if (artefacts.length === 0) status = 'n/a';
    else if (found.length === artefacts.length) status = '✓';
    else if (found.length === 0 && weak.length === 0) status = 'missing';
    else status = 'partial';   // some missing, or some only weak (bare occurrence)
    rows.push({ uc: uc.title, id: uc.id, line: uc.line, status, sev: SEV[status], found: found.length, total: artefacts.length, weak, missing, artefacts });
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
      console.log(`  ${r.sev} [${r.status}] ${r.uc}  (${r.found}/${r.total} found, line ${r.line})`);
      for (const a of r.artefacts) console.log(`      ${a.state === 'found' ? STATE_LABEL[a.strength] : a.state}: ${a.token}${a.evidence ? `  — ${a.evidence}` : ''}`);
    }
    const missing = rows.filter((r) => r.status === 'missing').length;
    const partial = rows.filter((r) => r.status === 'partial').length;
    console.log(`\n${rows.filter((r) => r.status === '✓').length} ✓ · ${partial} partial · ${missing} missing · ${rows.filter((r) => r.status === 'n/a').length} n/a`);
  }
  process.exit(rows.some((r) => r.status === 'missing') ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
