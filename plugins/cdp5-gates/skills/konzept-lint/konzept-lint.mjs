#!/usr/bin/env node
// CDP5 §32.9 T1 skill — konzept-lint (read-only): the decidable part of the concept maturity policy.
// Layer 1: gate items of kind det are decided here and reported pass/fail; jdg items are listed for konzept-reviewer.
// Layer 2: deterministic dimensions are scored 0–10 as the fraction of checks met and weighted per policy.
// Exit: 0 = every deterministic gate item passes · 1 = a deterministic gate item fails · 2 = usage error.

import { readFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guardPaths } from '../../lib/args.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_POLICY = join(HERE, '..', '..', 'policy', 'reife-rubrik.policy.json');

const VAGUE = /\b(should|ideally|sollte|idealerweise|möglichst|ungefähr|ca\.|etc\.|evtl\.|mehr oder weniger|o\.\s?ä\.)\b/i;
const EVIDENCE_TYPE = /\b(Test|AC-?\d+|Trace|Span|Checklist|Policy|Metrik|Metric|Eval)\b/i;

export function loadPolicy(path = DEFAULT_POLICY) {
  const p = JSON.parse(readFileSync(path, 'utf8'));
  if (p.weights && !p.dimensions) return { ...defaultPolicy(), weights: { ...defaultPolicy().weights, ...p.weights } };
  if (!Array.isArray(p.gate) || !Array.isArray(p.dimensions)) throw new Error('policy JSON needs "gate" and "dimensions" arrays');
  return p;
}

function defaultPolicy() {
  return JSON.parse(readFileSync(DEFAULT_POLICY, 'utf8'));
}

export function parseUCs(md) {
  const lines = md.split('\n');
  const ucs = []; let cur = null;
  for (const line of lines) {
    const h = line.match(/^#{2,3}\s+(UC[-\s][^\n]*)/i);
    if (h) { cur = { title: h[1].trim(), body: '' }; ucs.push(cur); continue; }
    if (/^#{1,2}\s/.test(line) && !/^#{2,3}\s+UC/i.test(line)) cur = null;
    if (cur) cur.body += line + '\n';
  }
  return ucs;
}

const has = (t, re) => re.test(t);
const frac = (n, d) => (d ? (n / d) * 10 : 0);

export function collectChecks(md) {
  const ucs = parseUCs(md);
  const llm = has(md, /\bLLM\b|KI-UC|Probabilistik|gen_ai/i);
  const rag = has(md, /\bRAG\b|Retriever|Embedding|Vektor(db|datenbank)/i);
  const perUC = ucs.map((uc) => {
    const acRows = uc.body.split('\n').filter((l) => /^\|\s*AC-?\d/i.test(l));
    return {
      uc: uc.title,
      hasAC: acRows.length > 0,
      hasFehlerfaelle: has(uc.body, /Fehlerf[äa]lle|Error cases/i),
      stepsNumbered: /^\s*1\.\s/m.test(uc.body),
      vagueAC: acRows.filter((l) => VAGUE.test(l)).map((l) => l.trim().slice(0, 80)),
    };
  });
  const mandatory = md.split('\n').filter((l) => !/^#/.test(l) && /\bPflicht\b|\bmandatory\b/i.test(l));
  const global = {
    hatUCs: ucs.length > 0,
    hatKopf: has(md, /\*\*Version:/i) && has(md, /\*\*Scope:/i),
    hatGlossar: has(md, /^#{1,3}\s[^\n]*(Glossar|Glossary)/im),
    hatChangelog: has(md, /^#{1,3}\s[^\n]*Changelog/im) || has(md, /\*\*Changelog/i),
    hatLifecycle: has(md, /Lifecycle|stateDiagram|Statusdiagramm|Zustandsdiagramm|Status-?Übergäng|state transitions/i),
    llm, rag,
    hatProbabilistik: !llm || has(md, /Probabilistik-Statement|probabilistic statement/i),
    llmFelder: !llm || ['Kontext', /Ausgabe|Output/, /Validierung|Validation/, /Fallback/, /Cutoff/].every((p) => has(md, p instanceof RegExp ? p : new RegExp(p, 'i'))),
    ragFelder: !rag || [/Chunk/, /Embedding/, /Retriever|Retrieval/, /Caching|Cache/, /Invalidier|Invalidat/].every((p) => has(md, p)),
    mandatoryStatements: mandatory.length,
    mandatoryTyped: mandatory.filter((l) => EVIDENCE_TYPE.test(l)).length,
  };
  return { perUC, global };
}

const GATE_CHECKS = {
  uc_steps_numbered: (c) => c.global.hatUCs && c.perUC.every((u) => u.stepsNumbered),
  kopf: (c) => c.global.hatKopf,
  error_tables: (c) => c.global.hatUCs && c.perUC.every((u) => u.hasFehlerfaelle),
  lifecycle: (c) => c.global.hatLifecycle,
  probabilistik: (c) => c.global.hatProbabilistik,
  ac_tables: (c) => c.global.hatUCs && c.perUC.every((u) => u.hasAC),
  glossar: (c) => c.global.hatGlossar,
  changelog: (c) => c.global.hatChangelog,
};

export function scoreDimensions(c) {
  const g = c.global;
  const structureChecks = [g.hatUCs, g.hatKopf, g.hatLifecycle, g.hatProbabilistik, g.llmFelder, g.ragFelder];
  const vagueRows = c.perUC.reduce((s, u) => s + u.vagueAC.length, 0);
  return {
    struktur: frac(structureChecks.filter(Boolean).length, structureChecks.length),
    uc_schritte: frac(c.perUC.filter((u) => u.stepsNumbered).length, c.perUC.length),
    ac: Math.max(0, frac(c.perUC.filter((u) => u.hasAC).length, c.perUC.length) - 2 * vagueRows),
    fehlerfaelle: frac(c.perUC.filter((u) => u.hasFehlerfaelle).length, c.perUC.length),
    nachweis: g.mandatoryStatements ? frac(g.mandatoryTyped, g.mandatoryStatements) : 10,
    glossar: g.hatGlossar ? 10 : 0,
  };
}

export function lintKonzept(md, policy = loadPolicy()) {
  const c = collectChecks(md);
  const dims = scoreDimensions(c);
  const gate = policy.gate.map((item) => {
    if (item.kind !== 'det') return { ...item, pass: null, detail: 'judgment: konzept-reviewer' };
    const fn = GATE_CHECKS[item.check];
    if (!fn) return { ...item, pass: null, detail: `no lint check named ${item.check}` };
    return { ...item, pass: fn(c), detail: '' };
  });
  const detFailed = gate.filter((i) => i.pass === false);
  const scored = policy.dimensions.filter((d) => d.kind !== 'jdg');
  const weightOf = (d) => (policy.weights ? (policy.weights[d.id] ?? 0) : d.weight);
  const weightSum = scored.reduce((s, d) => s + weightOf(d), 0);
  const contribution = scored.reduce((s, d) => s + weightOf(d) * (dims[d.id] ?? 0), 0);
  const round = (x) => Math.round(x * 10) / 10;
  return {
    policyVersion: policy.version ?? null,
    threshold: policy.threshold ?? null,
    perUC: c.perUC,
    global: c.global,
    dims,
    gate: { passed: detFailed.length === 0, failed: detFailed.map((i) => i.id), items: gate },
    detWeight: round(weightSum * 100) / 100,
    contribution: round(contribution),
    teilScore: weightSum ? Math.min(10, round(contribution / weightSum)) : 0,
    strukturGap: detFailed.length > 0,
  };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (!a.konzept) { console.error('Usage: konzept-lint.mjs --konzept=<konzept.md> [--rubric=<policy.json>] [--json]'); process.exit(2); }
  guardPaths([[a.konzept, 'file'], [a.rubric, 'file']]);
  let policy;
  try { policy = loadPolicy(typeof a.rubric === 'string' && existsSync(a.rubric) ? a.rubric : DEFAULT_POLICY); }
  catch (e) { console.error(`policy not readable (${a.rubric ?? DEFAULT_POLICY}): ${e.message}`); process.exit(2); }
  const r = lintKonzept(readFileSync(a.konzept, 'utf8'), policy);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.strukturGap ? 1 : 0); }
  console.log(`konzept-lint — ${r.perUC.length} UCs · LLM=${r.global.llm} RAG=${r.global.rag} · policy v${r.policyVersion}, threshold ${r.threshold}\n`);
  console.log('Gate (layer 1):');
  for (const i of r.gate.items) {
    const mark = i.pass === null ? '…' : i.pass ? '✓' : '✗';
    console.log(`  [${mark}] ${i.id} ${i.item}${i.detail ? '  — ' + i.detail : ''}`);
  }
  console.log('\nPer UC:');
  for (const u of r.perUC) {
    const f = [!u.hasAC && 'no AC table', !u.hasFehlerfaelle && 'no error cases', !u.stepsNumbered && 'steps not numbered', u.vagueAC.length && `${u.vagueAC.length} vague AC`].filter(Boolean).join(' · ');
    console.log(`  [${f ? '✗' : '✓'}] ${u.uc}${f ? '  — ' + f : ''}`);
  }
  console.log(`\nDeterministic dimensions: ${Object.entries(r.dims).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}`);
  console.log(`Deterministic contribution: ${r.contribution} of ${r.detWeight * 10} (normalized ${r.teilScore}/10). Judgment dimension (${(1 - r.detWeight).toFixed(2)}) and the final verdict: konzept-reviewer.`);
  console.log(r.gate.passed ? '\nGate: all deterministic items pass.' : `\nGate: open items ${r.gate.failed.join(', ')} — not ready regardless of score.`);
  process.exit(r.strukturGap ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
