#!/usr/bin/env node
// CDP5 §32.9 T1 skill — konzept-lint (read-only): the decidable part of the concept maturity policy.
// Layer 1: gate items of kind det are decided here and reported pass/fail; jdg items are listed for konzept-reviewer.
// Layer 2: deterministic dimensions are scored 0–10 as the fraction of checks met and weighted per policy.
// Exit: 0 = every deterministic gate item passes · 1 = a deterministic gate item fails · 2 = usage error.
// Every pattern accepts German and English concept documents.

import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { guardPaths } from '../../lib/args.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const DEFAULT_POLICY = join(HERE, '..', '..', 'policy', 'reife-rubrik.policy.json');

// Hedges in acceptance criteria. The terminator is a negative lookahead instead of \b so that the dot-terminated
// forms (ca., etc., evtl., o. ä.) match when a space, pipe or line end follows.
export const VAGUE = /\b(should|ideally|typically|roughly|approximately|usually|sollte|idealerweise|typisch|typischerweise|möglichst|ungefähr|in der Regel|ca\.|etc\.|evtl\.|mehr oder weniger|o\.\s?ä\.)(?![A-Za-zÄÖÜäöüß0-9_])/i;
// The four evidence types of §10.7: Test/AC, Policy score, Checklist item, Trace span. Eval and Metric are not among them.
export const EVIDENCE_TYPE = /\b(Test\/AC|AC-?\d+|Policy( score)?|Checklist( item)?|Trace( span)?)\b/i;
// An obligation is a statement, not a table cell or a heading: "Pflicht:", "mandatory —", "is mandatory", "ist Pflicht", "MUSS".
export const OBLIGATION = /(Pflicht|[Mm]andatory)\s*[:—–-]|\bis mandatory\b|\bist Pflicht\b|\bMUSS\b/;
const NO_LLM_NOTE = /No LLM|Kein LLM|Deterministic UC/i;
const LIFECYCLE_EXEMPT = /No status lifecycle:|Kein Status-Lebenszyklus:/i;

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

// §3.0: a "1." line followed later by "2." or "1.1" — one numbered line alone is not a flow.
function numberedSteps(lines) {
  const i = lines.findIndex((l) => /^\s*1\.\s/.test(l));
  return i >= 0 && lines.slice(i + 1).some((l) => /^\s*(2\.|1\.1\.?)\s/.test(l));
}

// §3.2: an error-case heading followed by a table row within five lines and before the next heading; prose does not count.
function errorTable(lines) {
  const i = lines.findIndex((l) => /^#{1,6}\s[^\n]*(Fehlerf[äa]lle|Error cases)/i.test(l));
  if (i < 0) return false;
  for (const l of lines.slice(i + 1, i + 6)) {
    if (/^#{1,6}\s/.test(l)) return false;
    if (/^\|/.test(l)) return true;
  }
  return false;
}

// §14: backticked terms of the glossary section (up to the next heading of the same or a higher level).
export function glossaryTerms(md) {
  const lines = md.split('\n');
  const start = lines.findIndex((l) => /^#{1,3}\s[^\n]*(Glossar|Glossary)/i.test(l));
  if (start < 0) return [];
  const level = lines[start].match(/^#+/)[0].length;
  const stop = new RegExp(`^#{1,${level}}\\s`);
  const terms = new Set();
  for (const line of lines.slice(start + 1)) {
    if (stop.test(line)) break;
    for (const m of line.matchAll(/`([^`]+)`/g)) terms.add(m[1].trim());
  }
  return [...terms];
}

export function parseVersion(md) {
  const m = md.match(/\*\*Version:\*\*\s*v?(\d+(?:\.\d+)?)/i);
  return m ? Number(m[1]) : null;
}

export function collectChecks(md) {
  const ucs = parseUCs(md);
  const llmText = md.split('\n').filter((l) => !NO_LLM_NOTE.test(l)).join('\n');
  const llm = has(llmText, /\bLLM\b|KI-UC|Probabilistik|gen_ai/i);
  const rag = has(md, /\bRAG\b|Retriever|Embedding|Vektor(db|datenbank)/i);
  const perUC = ucs.map((uc) => {
    const lines = uc.body.split('\n');
    const acRows = lines.filter((l) => /^\|\s*AC-?\d/i.test(l));
    return {
      uc: uc.title,
      hasActor: has(uc.body, /\*\*(Actor|Akteur):\*\*/i),
      hasRoute: has(uc.body, /\*\*Route:\*\*/i),
      hasAC: acRows.length > 0,
      hasFehlerfaelle: errorTable(lines),
      stepsNumbered: numberedSteps(lines),
      vagueAC: acRows.filter((l) => VAGUE.test(l)).map((l) => l.trim().slice(0, 80)),
    };
  });
  const mandatory = md.split('\n').filter((l) => !/^\s*(#|\|)/.test(l) && OBLIGATION.test(l));
  const version = parseVersion(md);
  const terms = glossaryTerms(md);
  const inUC = (term) => ucs.some((uc) => uc.body.toLowerCase().includes(term.toLowerCase()));
  const global = {
    hatUCs: ucs.length > 0,
    hatKopf: has(md, /\*\*Version:/i) && has(md, /\*\*(Scope|Geltungsbereich|Umfang):/i),
    version,
    hatRollen: has(md, /^#{1,3}\s[^\n]*(Rollen|Roles)\b/im) || has(md, /^\|\s*(Rolle|Role)\s*\|/im),
    hatGlossar: has(md, /^#{1,3}\s[^\n]*(Glossar|Glossary)/im),
    glossarTerms: terms,
    glossarUnused: terms.filter((t) => !inUC(t)),
    hatChangelog: has(md, /^#{1,3}\s[^\n]*Changelog/im) || has(md, /\*\*Changelog/i) || (version !== null && version < 2),
    hatLifecycle: has(md, /Lifecycle|Lebenszyklus|stateDiagram|Statusdiagramm|Zustandsdiagramm|Status-?Übergäng|state transitions/i) || has(md, LIFECYCLE_EXEMPT),
    hatEntities: has(md, /^#{1,3}\s[^\n]*Entit(y|ies|ät)/im),
    hatResponsibilityMatrix: has(md, /Responsibility[\s-]?Matrix|Verantwortungs-?Matrix/i),
    llm, rag,
    hatProbabilistik: !llm || has(md, /Probabilisti(k|cs?)[\s-]Statement/i),
    hatVendorRisk: !llm || has(md, /Vendor[\s-]?Risk|Vendor-?Risiko/i),
    llmFelder: !llm || [/Kontext|Context/i, /Ausgabe|Output/i, /Validierung|Validation/i, /Fallback/i, /Cut-?off/i].every((p) => has(md, p)),
    ragFelder: !rag || [/Chunk/i, /Embedding/i, /Retriever|Retrieval/i, /Caching|Cache/i, /Invalidier|Invalidat/i].every((p) => has(md, p)),
    mandatoryStatements: mandatory.length,
    mandatoryTyped: mandatory.filter((l) => EVIDENCE_TYPE.test(l)).length,
  };
  return { perUC, global };
}

// Keyed by the "lint check" column of the policy; every det gate row needs an entry here and vice versa.
export const GATE_CHECKS = {
  uc_steps_numbered: (c) => c.global.hatUCs && c.perUC.every((u) => u.stepsNumbered),
  kopf: (c) => c.global.hatKopf,
  error_tables: (c) => c.global.hatUCs && c.perUC.every((u) => u.hasFehlerfaelle),
  lifecycle: (c) => c.global.hatLifecycle,
  roles_overview: (c) => c.global.hatRollen,
  probabilistik: (c) => c.global.hatProbabilistik,
  ac_tables: (c) => c.global.hatUCs && c.perUC.every((u) => u.hasAC),
  glossar: (c) => c.global.hatGlossar,
  changelog: (c) => c.global.hatChangelog,
  actor_route: (c) => c.global.hatUCs && c.perUC.every((u) => u.hasActor && u.hasRoute),
  vendor_risk: (c) => c.global.hatVendorRisk,
  entity_overview: (c) => c.global.hatEntities,
  responsibility_matrix: (c) => c.global.hatResponsibilityMatrix,
};

export function scoreDimensions(c) {
  const g = c.global;
  const structureChecks = {
    ucs: g.hatUCs,
    head: g.hatKopf,
    actor_route: GATE_CHECKS.actor_route(c),
    roles_overview: g.hatRollen,
    lifecycle: g.hatLifecycle,
    probabilistic_statement: g.hatProbabilistik,
    vendor_risk: g.hatVendorRisk,
    llm_fields: g.llmFelder,
    rag_fields: g.ragFelder,
    entity_overview: g.hatEntities,
    responsibility_matrix: g.hatResponsibilityMatrix,
  };
  const values = Object.values(structureChecks);
  const vagueRows = c.perUC.reduce((s, u) => s + u.vagueAC.length, 0);
  const terms = g.glossarTerms.length;
  return {
    struktur: frac(values.filter(Boolean).length, values.length),
    strukturFailed: Object.entries(structureChecks).filter(([, ok]) => !ok).map(([k]) => k),
    uc_schritte: frac(c.perUC.filter((u) => u.stepsNumbered).length, c.perUC.length),
    ac: Math.max(0, frac(c.perUC.filter((u) => u.hasAC).length, c.perUC.length) - 2 * vagueRows),
    fehlerfaelle: frac(c.perUC.filter((u) => u.hasFehlerfaelle).length, c.perUC.length),
    nachweis: g.mandatoryStatements ? frac(g.mandatoryTyped, g.mandatoryStatements) : 10,
    glossar: !g.hatGlossar ? 0 : terms ? frac(terms - g.glossarUnused.length, terms) : 10,
  };
}

export function lintKonzept(md, policy = loadPolicy()) {
  const c = collectChecks(md);
  const { strukturFailed, ...dims } = scoreDimensions(c);
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
    strukturFailed,
    gate: { passed: detFailed.length === 0, failed: detFailed.map((i) => i.id), items: gate },
    detWeight: round(weightSum * 100) / 100,
    contribution: round(contribution),
    teilScore: weightSum ? Math.min(10, round(contribution / weightSum)) : 0,
    strukturGap: detFailed.length > 0,
  };
}

const RED = '🔴', YELLOW = '🟡', GREEN = '🟢', OPEN = '…';

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (!a.konzept) { console.error('Usage: konzept-lint.mjs --konzept=<konzept.md> [--rubric=<policy.json>] [--json]'); process.exit(2); }
  guardPaths([[a.konzept, 'file'], [a.rubric, 'file']]);
  const policyPath = typeof a.rubric === 'string' ? a.rubric : DEFAULT_POLICY;
  let policy;
  try { policy = loadPolicy(policyPath); }
  catch (e) { console.error(`policy not readable (${policyPath}): ${e.message}`); process.exit(2); }
  const r = lintKonzept(readFileSync(a.konzept, 'utf8'), policy);
  if (a.json) { console.log(JSON.stringify(r, null, 2)); process.exit(r.strukturGap ? 1 : 0); }
  console.log(`konzept-lint — ${r.perUC.length} UCs · LLM=${r.global.llm} RAG=${r.global.rag} · policy v${r.policyVersion}, threshold ${r.threshold}\n`);
  console.log('Gate (layer 1):');
  for (const i of r.gate.items) {
    const mark = i.pass === null ? OPEN : i.pass ? GREEN : RED;
    console.log(`  ${mark} ${i.id} ${i.item}${i.detail ? '  — ' + i.detail : ''}`);
  }
  console.log('\nPer UC:');
  for (const u of r.perUC) {
    const gaps = [!u.hasActor && 'no Actor', !u.hasRoute && 'no Route', !u.hasAC && 'no AC table', !u.hasFehlerfaelle && 'no error-case table', !u.stepsNumbered && 'steps not numbered (1. and 2. or 1.1)'].filter(Boolean);
    const mark = gaps.length ? RED : u.vagueAC.length ? YELLOW : GREEN;
    console.log(`  ${mark} ${u.uc}${gaps.length ? '  — ' + gaps.join(' · ') : ''}`);
    for (const row of u.vagueAC) console.log(`     ${YELLOW} vague AC: ${row}`);
  }
  console.log(`\nDeterministic dimensions: ${Object.entries(r.dims).map(([k, v]) => `${k} ${v.toFixed(1)}`).join(' · ')}`);
  if (r.strukturFailed.length) console.log(`struktur checks failed: ${r.strukturFailed.join(', ')}`);
  if (r.global.glossarUnused.length) console.log(`glossary terms not used in any UC: ${r.global.glossarUnused.join(', ')}`);
  console.log(`Deterministic contribution: ${r.contribution} of ${r.detWeight * 10} (normalized ${r.teilScore}/10). Judgment dimension (${(1 - r.detWeight).toFixed(2)}) and the final verdict: konzept-reviewer.`);
  console.log(r.gate.passed ? `\n${GREEN} Gate: all deterministic items pass.` : `\n${RED} Gate: open items ${r.gate.failed.join(', ')} — not ready regardless of score.`);
  process.exit(r.strukturGap ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
