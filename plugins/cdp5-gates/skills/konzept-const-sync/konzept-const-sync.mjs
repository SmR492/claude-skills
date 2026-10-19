#!/usr/bin/env node
// CDP5 §32.8 T1 skill — konzept-const-sync (read-only): diffs NUMERIC constants in a
// concept document (prose/tables) against the single-source-of-truth spec (rules.mjs) and
// optionally against conformance.mjs. Closes the error class "constant in prose ≠ code", which
// green tests (they only read the spec) AND adversarial audits (they only check behaviour)
// systematically miss — e.g. a sourceTier scale changed in the spec that stays old in the concept
// text and thus leads a PHP re-implementation written from the text into parity drift.
//
// Three deterministic checks (no LLM):
//   1. Annotation   `name(number)`        → name must have exactly this value in the spec.
//   2. Declaration  `name = number` / `:` → for tier names + named scalars (+ ‰ for decay).
//   3. Arithmetic   `a × b = c`           → product must be correct (purely numeric + annotated).
//   + Phantom key   unknown `name=number` in a tier enumeration line.
//
// Exit: 0 = consistent · 1 = drift found · 2 = usage error.

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

// ---- Load spec (single source of truth) -----------------------------------
let SPEC;
try {
  const mod = await import(pathToFileURL(resolvePath(ARGS.spec)).href);
  SPEC = mod.DEFAULT_SPEC;
  if (!SPEC || typeof SPEC !== 'object') {
    console.error(`not found: export DEFAULT_SPEC in ${ARGS.spec}`);
    process.exit(2);
  }
} catch (e) {
  console.error(`spec import failed: ${e.message}`);
  process.exit(2);
}

// ---- Derive tracked constants from the spec --------------------------------
// Tier names: scale that may appear in the concept text as `name(N)` / `name=N`.
const TIER = SPEC.sourceTier ?? {};
const tierNames = Object.keys(TIER).filter((k) => k !== 'default');
// trustRank names: check ONLY the annotation form `name(N)` (a bare `name=N` would collide with
// the trustFactor scale, where `authoritative`=1000 instead of 1500).
const TRUSTRANK = SPEC.quorumTrustRank ?? {};
const trustRankNames = Object.keys(TRUSTRANK);
// Decay per period: check only when ‰-anchored (names otherwise collide with temporality prose).
const DECAY = SPEC.decayPerPeriod ?? {};
const decayNames = Object.keys(DECAY).filter((k) => k !== 'default');
// Normative verdict thresholds: define behaviour categorically and are declared in the concept as
// fixed values (`AUTH_FLOOR=4500`). Bare declaration check + annotation form.
const NORMATIVE_SCALARS = {
  quorumAuthFloor: SPEC.quorumAuthFloor, AUTH_FLOOR: SPEC.quorumAuthFloor,
  quorumMulti: SPEC.quorumMulti,
  deleteThreshold: SPEC.deleteThreshold,
  quarantineThreshold: SPEC.quarantineThreshold,
  contestedThreshold: SPEC.contestedThreshold,
  beliefSharpness: SPEC.beliefSharpness,
};
// Tunables: overridable in the spec and demonstrated at boundary values in AC scenarios
// (e.g. "`recallProtectionDays = 0` disables the feature"). Check ONLY the annotation form `KEY(N)`
// — a bare `KEY = 0` line is a scenario here, NOT a default claim.
const TUNABLE_SCALARS = {
  reinforceDelta: SPEC.reinforceDelta,
  recallProtectionDays: SPEC.recallProtectionDays,
  recallDecayDivisor: SPEC.recallDecayDivisor,
  demoteLimitedThreshold: SPEC.demoteLimitedThreshold,
  demoteUntrustedThreshold: SPEC.demoteUntrustedThreshold,
  trustAdjustMinEvidence: SPEC.trustAdjustMinEvidence,
};
const SCALARS = { ...NORMATIVE_SCALARS, ...TUNABLE_SCALARS }; // for annotation + phantom tracking

// Annotation form `name(N)` → allowed names + expected value.
const annot = new Map();
for (const k of tierNames) annot.set(k, TIER[k]);
for (const k of trustRankNames) annot.set(k, TRUSTRANK[k]); // wins on name collision (quorum domain)
for (const [k, v] of Object.entries(SCALARS)) if (Number.isFinite(v) && !annot.has(k)) annot.set(k, v);

const findings = [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const lines = readFileSync(resolvePath(ARGS.konzept), 'utf8').split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  const ln = i + 1;

  // --- Check 1: annotation `name(N)` -------------------------------------
  for (const [name, want] of annot) {
    const re = new RegExp(`\\b${escapeRe(name)}\\((\\d+)\\)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) findings.push({ line: ln, kind: 'annotation', detail: `\`${name}(${got})\` ≠ spec value ${want}` });
    }
  }

  // --- Check 2a: tier declaration `name = N` / `name: N` ------------------
  for (const name of tierNames) {
    const re = new RegExp(`\\b${escapeRe(name)}\\s*[=:]\\s*(\\d+)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== TIER[name]) findings.push({ line: ln, kind: 'tier-decl', detail: `\`${name}=${got}\` ≠ sourceTier ${TIER[name]}` });
    }
  }

  // --- Check 2b: scalar declaration `KEY = N` / `KEY: N` (NORMATIVE only) --
  for (const [key, want] of Object.entries(NORMATIVE_SCALARS)) {
    if (!Number.isFinite(want)) continue;
    const re = new RegExp(`\\b${escapeRe(key)}\\s*[=:]\\s*(\\d+)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) findings.push({ line: ln, kind: 'scalar-decl', detail: `\`${key}=${got}\` ≠ spec ${want}` });
    }
  }

  // --- Check 2c: decay per period `name … N ‰` (‰-anchored) ---------------
  for (const name of decayNames) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b[^\\d‰]{0,6}(\\d+)\\s*‰`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== DECAY[name]) findings.push({ line: ln, kind: 'decay-decl', detail: `\`${name} ${got}‰\` ≠ decayPerPeriod ${DECAY[name]}‰` });
    }
  }

  // --- Check 3a: annotated arithmetic `name(A) × name(B) = C` -------------
  // (umlauts kept in the identifier class: concept documents may use German names)
  {
    const re = /[A-Za-zÄÖÜäöü_]+\((\d+)\)\s*[×x*]\s*[A-Za-zÄÖÜäöü_]+\((\d+)\)\s*=\s*(\d+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (a * b !== c) findings.push({ line: ln, kind: 'arithmetic', detail: `${a} × ${b} = ${c} (correct: ${a * b})` });
    }
  }
  // --- Check 3b: pure arithmetic `A × B = C` -----------------------------
  {
    const re = /(?<![\w(])(\d+)\s*[×x*]\s*(\d+)\s*=\s*(\d+)(?![\w)])/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (a * b !== c) findings.push({ line: ln, kind: 'arithmetic', detail: `${a} × ${b} = ${c} (correct: ${a * b})` });
    }
  }

  // --- Check 4: phantom key in a tier enumeration line --------------------
  // A line with ≥2 known tier names in `name=N` form is clearly a tier enumeration;
  // a FURTHER `name=N` token with an unknown name is a phantom constant (e.g. `audit=6`).
  {
    const tokenRe = /\b([A-Za-zÄÖÜäöü_]+)\s*[=:]\s*\d+/g;
    const tokens = [...line.matchAll(tokenRe)].map((m) => m[1]);
    const knownTierTokens = tokens.filter((t) => tierNames.includes(t));
    if (knownTierTokens.length >= 2) {
      const allTracked = new Set([...annot.keys(), ...Object.keys(SCALARS), ...decayNames]);
      for (const t of tokens) {
        if (!allTracked.has(t)) findings.push({ line: ln, kind: 'phantom', detail: `unknown constant \`${t}\` in tier enumeration (not in the spec)` });
      }
    }
  }
}

// ---- Optional bonus: rules.mjs ↔ conformance.mjs mirror drift ---------------
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
    console.error(`conformance import failed: ${e.message}`);
    process.exit(2);
  }
}

const summary = { konzept: ARGS.konzept, lines_scanned: lines.length, tracked_constants: annot.size, findings: findings.length, conformance_checked: conformanceChecked };

if (ARGS.json) {
  console.log(JSON.stringify({ ...summary, findings }, null, 2));
} else {
  console.log(`konzept-const-sync — ${summary.lines_scanned} lines, ${annot.size} tracked constants, ${findings.length} drift findings\n`);
  for (const f of findings) console.log(`  ✗ ${f.line ? `L${f.line}` : 'mirror'} [${f.kind}] — ${f.detail}`);
  if (findings.length === 0) console.log('no drift — concept constants match the spec.');
}

process.exit(findings.length === 0 ? 0 : 1);
