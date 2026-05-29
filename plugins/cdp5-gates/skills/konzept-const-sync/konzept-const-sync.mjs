#!/usr/bin/env node
// CDP5 §32.8 T1-Skill — konzept-const-sync (read-only): difft NUMERISCHE Konstanten in einem
// Konzept-Dokument (Prosa/Tabellen) gegen die Single-Source-of-Truth-Spec (rules.mjs) und
// optional gegen conformance.mjs. Schließt die Fehlerklasse „Konstante in Prosa ≠ Code", die
// grüne Tests (lesen nur die Spec) UND Adversarial-Audits (prüfen nur Verhalten) systematisch
// übersehen — z. B. eine in der Spec geänderte sourceTier-Skala, die im Konzept-Text alt bleibt
// und so eine PHP-Re-Implementierung nach dem Text in die Paritäts-Drift führt.
//
// Drei deterministische Checks (kein LLM):
//   1. Annotation   `name(zahl)`         → name muss in der Spec genau diesen Wert haben.
//   2. Deklaration  `name = zahl` / `:`  → für tier-Namen + benannte Skalare (+ ‰ für Decay).
//   3. Arithmetik   `a × b = c`          → Produkt muss stimmen (rein numerisch + annotiert).
//   + Phantom-Key   unbekannter `name=zahl` in einer Tier-Enumerations-Zeile.
//
// Exit: 0 = konsistent · 1 = Drift gefunden · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import { guardPaths } from '../../lib/args.mjs';

const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  if (!a.startsWith('--')) return [a, true];
  const parts = a.slice(2).split('=');
  return parts.length === 1 ? [parts[0], true] : [parts[0], parts.slice(1).join('=')];
}));
if (!ARGS.konzept || !ARGS.spec) {
  console.error('Usage: konzept-const-sync.mjs --konzept=<KONZEPT.md> --spec=<rules.mjs> [--conformance=<conformance.mjs>] [--json]');
  process.exit(2);
}
guardPaths([[ARGS.konzept, 'file'], [ARGS.spec, 'file'], [ARGS.conformance, 'file']]);

// ---- Spec laden (Single Source of Truth) ----------------------------------
let SPEC;
try {
  const mod = await import(pathToFileURL(resolvePath(ARGS.spec)).href);
  SPEC = mod.DEFAULT_SPEC;
  if (!SPEC || typeof SPEC !== 'object') {
    console.error(`nicht gefunden: export DEFAULT_SPEC in ${ARGS.spec}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`spec-import fehlgeschlagen: ${e.message}`);
  process.exit(2);
}

// ---- Tracked-Konstanten aus der Spec ableiten -----------------------------
// tier-Namen: Skala, die im Konzept-Text als `name(N)` / `name=N` erscheinen darf.
const TIER = SPEC.sourceTier ?? {};
const tierNames = Object.keys(TIER).filter((k) => k !== 'default');
// trustRank-Namen: NUR Annotationsform `name(N)` prüfen (bare `name=N` würde mit der
// trustFactor-Skala kollidieren, in der `authoritative`=1000 statt 1500 ist).
const TRUSTRANK = SPEC.quorumTrustRank ?? {};
const trustRankNames = Object.keys(TRUSTRANK);
// Decay-pro-Periode: nur ‰-verankert prüfen (Namen kollidieren sonst mit Temporalitäts-Prosa).
const DECAY = SPEC.decayPerPeriod ?? {};
const decayNames = Object.keys(DECAY).filter((k) => k !== 'default');
// Normative Verdikt-Schwellen: definieren Verhalten kategorisch, werden im Konzept als feste
// Werte deklariert (`AUTH_FLOOR=4500`). Bare-Deklarations-Check + Annotationsform.
const NORMATIVE_SCALARS = {
  quorumAuthFloor: SPEC.quorumAuthFloor, AUTH_FLOOR: SPEC.quorumAuthFloor,
  quorumMulti: SPEC.quorumMulti,
  deleteThreshold: SPEC.deleteThreshold,
  quarantineThreshold: SPEC.quarantineThreshold,
  contestedThreshold: SPEC.contestedThreshold,
  beliefSharpness: SPEC.beliefSharpness,
};
// Tunables: in der Spec überschreibbar und in AC-Szenarien an Grenzwerten demonstriert
// (z. B. „`recallProtectionDays = 0` deaktiviert das Feature"). NUR Annotationsform `KEY(N)`
// prüfen — eine bare `KEY = 0`-Zeile ist hier ein Szenario, KEINE Default-Behauptung.
const TUNABLE_SCALARS = {
  reinforceDelta: SPEC.reinforceDelta,
  recallProtectionDays: SPEC.recallProtectionDays,
  recallDecayDivisor: SPEC.recallDecayDivisor,
  demoteLimitedThreshold: SPEC.demoteLimitedThreshold,
  demoteUntrustedThreshold: SPEC.demoteUntrustedThreshold,
  trustAdjustMinEvidence: SPEC.trustAdjustMinEvidence,
};
const SCALARS = { ...NORMATIVE_SCALARS, ...TUNABLE_SCALARS }; // für Annotation + Phantom-Tracking

// Annotationsform `name(N)` → erlaubte Namen + Sollwert.
const annot = new Map();
for (const k of tierNames) annot.set(k, TIER[k]);
for (const k of trustRankNames) annot.set(k, TRUSTRANK[k]); // gewinnt bei Namens-Kollision (quorum-Domäne)
for (const [k, v] of Object.entries(SCALARS)) if (Number.isFinite(v) && !annot.has(k)) annot.set(k, v);

const findings = [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lines = readFileSync(resolvePath(ARGS.konzept), 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const ln = i + 1;

  // --- Check 1: Annotation `name(N)` -------------------------------------
  for (const [name, want] of annot) {
    const re = new RegExp(`\\b${escapeRe(name)}\\((\\d+)\\)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) findings.push({ line: ln, kind: 'annotation', detail: `\`${name}(${got})\` ≠ Spec-Wert ${want}` });
    }
  }

  // --- Check 2a: tier-Deklaration `name = N` / `name: N` ------------------
  for (const name of tierNames) {
    const re = new RegExp(`\\b${escapeRe(name)}\\s*[=:]\\s*(\\d+)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== TIER[name]) findings.push({ line: ln, kind: 'tier-decl', detail: `\`${name}=${got}\` ≠ sourceTier ${TIER[name]}` });
    }
  }

  // --- Check 2b: Skalar-Deklaration `KEY = N` / `KEY: N` (nur NORMATIVE) --
  for (const [key, want] of Object.entries(NORMATIVE_SCALARS)) {
    if (!Number.isFinite(want)) continue;
    const re = new RegExp(`\\b${escapeRe(key)}\\s*[=:]\\s*(\\d+)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) findings.push({ line: ln, kind: 'scalar-decl', detail: `\`${key}=${got}\` ≠ Spec ${want}` });
    }
  }

  // --- Check 2c: Decay-pro-Periode `name … N ‰` (‰-verankert) -------------
  for (const name of decayNames) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b[^\\d‰]{0,6}(\\d+)\\s*‰`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== DECAY[name]) findings.push({ line: ln, kind: 'decay-decl', detail: `\`${name} ${got}‰\` ≠ decayPerPeriod ${DECAY[name]}‰` });
    }
  }

  // --- Check 3a: annotierte Arithmetik `name(A) × name(B) = C` ------------
  {
    const re = /[A-Za-zÄÖÜäöü_]+\((\d+)\)\s*[×x*]\s*[A-Za-zÄÖÜäöü_]+\((\d+)\)\s*=\s*(\d+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (a * b !== c) findings.push({ line: ln, kind: 'arithmetic', detail: `${a} × ${b} = ${c} (korrekt: ${a * b})` });
    }
  }
  // --- Check 3b: reine Arithmetik `A × B = C` ----------------------------
  {
    const re = /(?<![\w(])(\d+)\s*[×x*]\s*(\d+)\s*=\s*(\d+)(?![\w)])/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (a * b !== c) findings.push({ line: ln, kind: 'arithmetic', detail: `${a} × ${b} = ${c} (korrekt: ${a * b})` });
    }
  }

  // --- Check 4: Phantom-Key in einer Tier-Enumerations-Zeile -------------
  // Eine Zeile mit ≥2 bekannten tier-Namen in `name=N`-Form ist klar eine Tier-Enumeration;
  // ein WEITERER `name=N`-Token mit unbekanntem Namen ist ein Phantom-Konstante (z. B. `audit=6`).
  {
    const tokenRe = /\b([A-Za-zÄÖÜäöü_]+)\s*[=:]\s*\d+/g;
    const tokens = [...line.matchAll(tokenRe)].map((m) => m[1]);
    const knownTierTokens = tokens.filter((t) => tierNames.includes(t));
    if (knownTierTokens.length >= 2) {
      const allTracked = new Set([...annot.keys(), ...Object.keys(SCALARS), ...decayNames]);
      for (const t of tokens) {
        if (!allTracked.has(t)) findings.push({ line: ln, kind: 'phantom', detail: `unbekannte Konstante \`${t}\` in Tier-Enumeration (nicht in der Spec)` });
      }
    }
  }
}

// ---- Optionaler Bonus: rules.mjs ↔ conformance.mjs Spiegel-Drift -----------
let conformanceChecked = false;
if (ARGS.conformance) {
  try {
    const cmod = await import(pathToFileURL(resolvePath(ARGS.conformance)).href);
    conformanceChecked = true;
    const q = cmod.QUORUM_CONSTANTS;
    if (q) {
      if (q.quorumAuthFloor !== SPEC.quorumAuthFloor) findings.push({ line: 0, kind: 'mirror', detail: `conformance.QUORUM_CONSTANTS.quorumAuthFloor=${q.quorumAuthFloor} ≠ rules ${SPEC.quorumAuthFloor}` });
      if (q.quorumMulti !== SPEC.quorumMulti) findings.push({ line: 0, kind: 'mirror', detail: `conformance.QUORUM_CONSTANTS.quorumMulti=${q.quorumMulti} ≠ rules ${SPEC.quorumMulti}` });
    }
    const d = cmod.DECAY_RECALL_CONSTANTS;
    if (d) {
      if (d.deleteThreshold !== SPEC.deleteThreshold) findings.push({ line: 0, kind: 'mirror', detail: `conformance.DECAY_RECALL_CONSTANTS.deleteThreshold=${d.deleteThreshold} ≠ rules ${SPEC.deleteThreshold}` });
      if (d.recallDecayDivisor !== SPEC.recallDecayDivisor) findings.push({ line: 0, kind: 'mirror', detail: `conformance.DECAY_RECALL_CONSTANTS.recallDecayDivisor=${d.recallDecayDivisor} ≠ rules ${SPEC.recallDecayDivisor}` });
    }
  } catch (e) {
    console.error(`conformance-import fehlgeschlagen: ${e.message}`);
    process.exit(2);
  }
}

const summary = { konzept: ARGS.konzept, lines_scanned: lines.length, tracked_constants: annot.size, findings: findings.length, conformance_checked: conformanceChecked };

if (ARGS.json) {
  console.log(JSON.stringify({ ...summary, findings }, null, 2));
} else {
  console.log(`konzept-const-sync — ${summary.lines_scanned} Zeilen, ${annot.size} getrackte Konstanten, ${findings.length} Drift-Stellen\n`);
  for (const f of findings) console.log(`  ✗ ${f.line ? `Z${f.line}` : 'mirror'} [${f.kind}] — ${f.detail}`);
  if (findings.length === 0) console.log('keine Drift — Konzept-Konstanten stimmen mit der Spec überein.');
}

process.exit(findings.length === 0 ? 0 : 1);
