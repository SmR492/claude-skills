#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — konzept-lint (read-only): die ENTSCHEIDBAREN Konzept-Checks +
// ein deterministischer Teil-Score der §4-Rubrik. Fängt die mechanischen Lücken in 0-Token,
// bevor der opus-konzept-reviewer (Judgment) läuft → schneller + billiger + reproduzierbar.
// Exit: 0 = keine strukturelle Lücke · 1 = strukturelle Lücke · 2 = Nutzungsfehler.

import { readFileSync, existsSync } from 'node:fs';

const VAGUE = /\b(should|ideally|sollte|idealerweise|möglichst|ungefähr|ca\.|etc\.|evtl\.|mehr oder weniger|o\.\s?ä\.)\b/i;
const DEFAULT_WEIGHTS = { struktur: 0.25, ac_tabelle: 0.25, fehlerfaelle: 0.20, ac_binaer: 0.15, llm_rag: 0.15 };

export function parseUCs(md) {
  const lines = md.split('\n');
  const ucs = []; let cur = null;
  for (const line of lines) {
    const h = line.match(/^##\s+(UC[-\s][^\n]*)/i);
    if (h) { cur = { title: h[1].trim(), body: '' }; ucs.push(cur); continue; }
    if (/^#{1,2}\s/.test(line) && !/^##\s+UC/i.test(line)) cur = null;
    if (cur) cur.body += line + '\n';
  }
  return ucs;
}

const has = (t, re) => re.test(t);

export function lintKonzept(md, weights = DEFAULT_WEIGHTS) {
  const ucs = parseUCs(md);
  const isLLM = has(md, /\bLLM\b|KI-UC|Probabilistik|gen_ai/i);
  const isRAG = has(md, /\bRAG\b|Retriever|Embedding|Vektor(db|datenbank)/i);

  const perUC = ucs.map((uc) => {
    const acRows = uc.body.split('\n').filter((l) => /^\|\s*AC-?\d/i.test(l));
    const vagueAC = acRows.filter((l) => VAGUE.test(l));
    return {
      uc: uc.title,
      hasAC: acRows.length > 0,
      hasFehlerfaelle: has(uc.body, /Fehlerf[äa]lle/),
      stepsNumbered: /^\s*1\.\s/m.test(uc.body),
      vagueAC: vagueAC.map((l) => l.trim().slice(0, 80)),
    };
  });

  const global = {
    hatUCs: ucs.length > 0,
    hatGlossar: has(md, /^##?\s*Glossar/im),
    hatKopf: has(md, /\*\*Version:/i) && has(md, /\*\*Scope:/i),
    llm: isLLM, rag: isRAG,
    hatProbabilistik: !isLLM || has(md, /Probabilistik-Statement/i),
    llmFelder: !isLLM || ['Kontext', /Ausgabe|Output/, /Validierung/, /Fallback/, /Cutoff/].every((p) => has(md, p instanceof RegExp ? p : new RegExp(p, 'i'))),
    ragFelder: !isRAG || [/Chunk/, /Embedding/, /Retriever|Retrieval/, /Caching|Cache/, /Invalidier/].every((p) => has(md, p)),
  };

  // Deterministische Dimensionen (0–10)
  const frac = (n, d) => (d ? (n / d) * 10 : 0);   // 0 UCs → 0 (nicht irreführend 10)
  const acViolations = perUC.reduce((s, u) => s + u.vagueAC.length, 0);
  const dims = {
    struktur: ([global.hatUCs, global.hatGlossar, global.hatKopf, global.hatProbabilistik].filter(Boolean).length / 4) * 10,
    ac_tabelle: frac(perUC.filter((u) => u.hasAC).length, perUC.length),
    fehlerfaelle: frac(perUC.filter((u) => u.hasFehlerfaelle).length, perUC.length),
    ac_binaer: Math.max(0, 10 - acViolations * 2),
    llm_rag: ((global.llmFelder ? 1 : 0) + (global.ragFelder ? 1 : 0)) / 2 * 10,
  };
  const teilScore = Object.entries(weights).reduce((s, [k, w]) => s + w * (dims[k] ?? 0), 0);

  const strukturGap = !global.hatUCs || !global.hatKopf || !global.hatGlossar
    || perUC.some((u) => !u.hasAC || !u.hasFehlerfaelle)
    || !global.hatProbabilistik || !global.llmFelder || !global.ragFelder;

  return { perUC, global, dims, teilScore: Math.min(10, Math.round(teilScore * 10) / 10), strukturGap };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (!a.konzept) { console.error('Usage: konzept-lint.mjs --konzept=<konzept.md> [--rubric=<rubric.json>] [--json]'); process.exit(2); }
  const weights = typeof a.rubric === 'string' && existsSync(a.rubric)
    ? JSON.parse(readFileSync(a.rubric, 'utf8')).weights ?? DEFAULT_WEIGHTS : DEFAULT_WEIGHTS;
  const r = lintKonzept(readFileSync(a.konzept, 'utf8'), weights);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.strukturGap ? 1 : 0); }
  console.log(`konzept-lint — ${r.perUC.length} UCs · LLM=${r.global.llm} RAG=${r.global.rag}\n`);
  for (const u of r.perUC) {
    const f = [!u.hasAC && 'keine AC-Tabelle', !u.hasFehlerfaelle && 'keine Fehlerfälle', !u.stepsNumbered && 'Schritte nicht nummeriert', u.vagueAC.length && `${u.vagueAC.length} vage AC`].filter(Boolean).join(' · ');
    console.log(`  [${f ? '✗' : '✓'}] ${u.uc}${f ? '  — ' + f : ''}`);
  }
  const g = [!r.global.hatKopf && 'Kopf/Scope', !r.global.hatGlossar && 'Glossar', !r.global.hatProbabilistik && 'Probabilistik-Statement (LLM-UC)', !r.global.llmFelder && '§13.1-LLM-Felder', !r.global.ragFelder && '§20.3-RAG-Felder'].filter(Boolean);
  if (g.length) console.log(`\nGlobal fehlt: ${g.join(' · ')}`);
  console.log(`\nDeterministischer Teil-Score: ${r.teilScore}/10 (Dimensionen: ${Object.entries(r.dims).map(([k, v]) => `${k} ${v.toFixed(0)}`).join(' · ')})`);
  console.log('Judgment-Dimensionen (Sachbearbeiter-Test, semantische Vollständigkeit) offen → konzept-reviewer.');
  process.exit(r.strukturGap ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
