#!/usr/bin/env node
// CDP5 §32.8 T1 skill — konzept-const-sync: diffs NUMERIC constants in a
// concept document (prose/tables) against the single-source-of-truth spec (rules.mjs) and
// optionally against conformance.mjs. Closes the error class "constant in prose ≠ code", which
// green tests (they only read the spec) AND adversarial audits (they only check behaviour)
// systematically miss — e.g. a sourceTier scale changed in the spec that stays old in the concept
// text and thus leads a PHP re-implementation written from the text into parity drift.
// NOTE: spec and conformance modules are loaded via import(), which EXECUTES their top-level code —
// run only on code built in this repository (§33.1).
//
// Three deterministic checks (no LLM):
//   1. Annotation   `name(number)`        → name must have exactly this value in the spec.
//   2. Declaration  `name = number` / `:` → for map keys + normative scalars (+ ‰ for permille maps).
//   3. Arithmetic   `a × b = c`           → product must be correct (purely numeric + annotated).
//   + Phantom key   unknown `name=number` in a map enumeration line.
//
// The tracked keys come from --keys=<json> (array); without it the NSAI-Edge default set applies.
// Exit: 0 = no 🔴 · 1 = ≥1 🔴 (drift) · 2 = usage error.

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve as resolvePath } from 'node:path';
import { guardPaths } from '../../lib/args.mjs';

// ---- Default key set (NSAI-Edge rules.mjs). Entry = name | { name, mode?, spec? } --------------
// modes: scalar (annotation + declaration, default for numbers) · annotation (annotation only, for
// tunables that appear at boundary values in AC scenarios) · map (every key: annotation + declaration,
// default for objects) · map-annotation (every key: annotation only) · permille (every key: `name … N ‰`).
// `spec` = the spec key to read when the concept uses an alias (AUTH_FLOOR → quorumAuthFloor).
// Later entries win on name collision (quorumTrustRank.authoritative=1500 over any tier of that name).
export const DEFAULT_KEYS = [
  { name: 'sourceTier', mode: 'map' },
  { name: 'quorumTrustRank', mode: 'map-annotation' },
  { name: 'decayPerPeriod', mode: 'permille' },
  'quorumAuthFloor', { name: 'AUTH_FLOOR', spec: 'quorumAuthFloor' },
  'quorumMulti', 'deleteThreshold', 'quarantineThreshold', 'contestedThreshold', 'beliefSharpness',
  { name: 'reinforceDelta', mode: 'annotation' },
  { name: 'recallProtectionDays', mode: 'annotation' },
  { name: 'recallDecayDivisor', mode: 'annotation' },
  { name: 'demoteLimitedThreshold', mode: 'annotation' },
  { name: 'demoteUntrustedThreshold', mode: 'annotation' },
  { name: 'trustAdjustMinEvidence', mode: 'annotation' },
];
const MODES = new Set(['scalar', 'annotation', 'map', 'map-annotation', 'permille']);

const ARGS = Object.fromEntries(process.argv.slice(2).map((a) => {
  if (!a.startsWith('--')) return [a, true];
  const parts = a.slice(2).split('=');
  return parts.length === 1 ? [parts[0], true] : [parts[0], parts.slice(1).join('=')];
}));
if (!ARGS.konzept || !ARGS.spec) {
  console.error('Usage: konzept-const-sync.mjs --konzept=<KONZEPT.md> --spec=<rules.mjs> [--conformance=<conformance.mjs>] [--keys=<keys.json>] [--json]');
  process.exit(2);
}
guardPaths([[ARGS.konzept, 'file'], [ARGS.spec, 'file'], [ARGS.conformance, 'file'], [ARGS.keys, 'file']]);

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

// ---- Load + normalise the tracked key list ----------------------------------
let KEYS = DEFAULT_KEYS;
if (ARGS.keys) {
  try { KEYS = JSON.parse(readFileSync(resolvePath(ARGS.keys), 'utf8')); } catch (e) { console.error(`keys file unreadable: ${e.message}`); process.exit(2); }
  if (!Array.isArray(KEYS)) { console.error(`keys file must contain a JSON array of names: ${ARGS.keys}`); process.exit(2); }
}
const entries = [];
for (const raw of KEYS) {
  const e = typeof raw === 'string' ? { name: raw } : raw;
  if (!e || typeof e.name !== 'string' || !e.name) { console.error(`keys entry without a name: ${JSON.stringify(raw)}`); process.exit(2); }
  if (e.mode !== undefined && !MODES.has(e.mode)) { console.error(`keys entry "${e.name}": unknown mode "${e.mode}" (${[...MODES].join(' | ')})`); process.exit(2); }
  const specKey = e.spec ?? e.name;
  const value = SPEC[specKey];
  if (value === undefined) continue;                               // not in this spec → nothing to diff
  const mode = e.mode ?? (value !== null && typeof value === 'object' ? 'map' : 'scalar');
  entries.push({ name: e.name, specKey, mode, value });
}

// ---- Derive tracked constants from the spec --------------------------------
const mapEntries = entries.filter((e) => e.mode === 'map' || e.mode === 'map-annotation');
const mapKeys = (e) => Object.entries(e.value).filter(([k, v]) => k !== 'default' && Number.isFinite(v));
// Map keys in declaration form `name = N` (mode map only; map-annotation keys collide with other scales).
const tier = new Map();
for (const e of mapEntries.filter((x) => x.mode === 'map')) for (const [k, v] of mapKeys(e)) tier.set(k, { want: v, of: e.name });
const tierNames = [...tier.keys()];
// Permille maps: check only when ‰-anchored (names otherwise collide with temporality prose).
const decay = new Map();
for (const e of entries.filter((x) => x.mode === 'permille')) for (const [k, v] of mapKeys(e)) decay.set(k, { want: v, of: e.name });
// Scalars in declaration form `KEY = N` — normative (mode scalar) only.
const normative = new Map();
for (const e of entries.filter((x) => x.mode === 'scalar' && Number.isFinite(x.value))) normative.set(e.name, e.value);
const scalarNames = entries.filter((e) => e.mode === 'scalar' || e.mode === 'annotation').map((e) => e.name);

// Annotation form `name(N)` → allowed names + expected value (later entries win on collision).
const annot = new Map();
for (const e of entries) {
  if (e.mode === 'map' || e.mode === 'map-annotation') for (const [k, v] of mapKeys(e)) annot.set(k, v);
  else if (e.mode !== 'permille' && Number.isFinite(e.value)) annot.set(e.name, e.value);
}

const findings = [];
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const push = (line, kind, detail) => findings.push({ sev: '🔴', line, kind, detail });

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
      if (got !== want) push(ln, 'annotation', `\`${name}(${got})\` ≠ spec value ${want}`);
    }
  }

  // --- Check 2a: map-key declaration `name = N` / `name: N` ---------------
  for (const [name, { want, of }] of tier) {
    const re = new RegExp(`\\b${escapeRe(name)}\\s*[=:]\\s*(\\d+)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) push(ln, 'tier-decl', `\`${name}=${got}\` ≠ ${of} ${want}`);
    }
  }

  // --- Check 2b: scalar declaration `KEY = N` / `KEY: N` (NORMATIVE only) --
  for (const [key, want] of normative) {
    const re = new RegExp(`\\b${escapeRe(key)}\\s*[=:]\\s*(\\d+)`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) push(ln, 'scalar-decl', `\`${key}=${got}\` ≠ spec ${want}`);
    }
  }

  // --- Check 2c: permille `name … N ‰` (‰-anchored) ------------------------
  for (const [name, { want, of }] of decay) {
    const re = new RegExp(`\\b${escapeRe(name)}\\b[^\\d‰]{0,6}(\\d+)\\s*‰`, 'g');
    let m;
    while ((m = re.exec(line)) !== null) {
      const got = Number(m[1]);
      if (got !== want) push(ln, 'decay-decl', `\`${name} ${got}‰\` ≠ ${of} ${want}‰`);
    }
  }

  // --- Check 3a: annotated arithmetic `name(A) × name(B) = C` -------------
  // (umlauts kept in the identifier class: concept documents may use German names)
  {
    const re = /[A-Za-zÄÖÜäöü_]+\((\d+)\)\s*[×x*]\s*[A-Za-zÄÖÜäöü_]+\((\d+)\)\s*=\s*(\d+)/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (a * b !== c) push(ln, 'arithmetic', `${a} × ${b} = ${c} (correct: ${a * b})`);
    }
  }
  // --- Check 3b: pure arithmetic `A × B = C` -----------------------------
  {
    const re = /(?<![\w(])(\d+)\s*[×x*]\s*(\d+)\s*=\s*(\d+)(?![\w)])/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const a = Number(m[1]), b = Number(m[2]), c = Number(m[3]);
      if (a * b !== c) push(ln, 'arithmetic', `${a} × ${b} = ${c} (correct: ${a * b})`);
    }
  }

  // --- Check 4: phantom key in a map enumeration line ---------------------
  // A line with ≥2 known map keys in `name=N` form is clearly an enumeration;
  // a FURTHER `name=N` token with an unknown name is a phantom constant (e.g. `audit=6`).
  {
    const tokenRe = /\b([A-Za-zÄÖÜäöü_]+)\s*[=:]\s*\d+/g;
    const tokens = [...line.matchAll(tokenRe)].map((m) => m[1]);
    const knownTierTokens = tokens.filter((t) => tierNames.includes(t));
    if (knownTierTokens.length >= 2) {
      const allTracked = new Set([...annot.keys(), ...scalarNames, ...decay.keys()]);
      for (const t of tokens) {
        if (!allTracked.has(t)) push(ln, 'phantom', `unknown constant \`${t}\` in tier enumeration (not in the spec)`);
      }
    }
  }
}

// ---- Optional bonus: rules.mjs ↔ conformance.mjs mirror drift ---------------
// Every exported object of conformance.mjs is compared key by key against the tracked scalars.
let conformanceChecked = false;
if (ARGS.conformance) {
  try {
    const cmod = await import(pathToFileURL(resolvePath(ARGS.conformance)).href);
    conformanceChecked = true;
    const trackedScalars = new Map(entries.filter((e) => Number.isFinite(e.value)).map((e) => [e.specKey, e.value]));
    for (const [exp, obj] of Object.entries(cmod)) {
      if (!obj || typeof obj !== 'object' || Array.isArray(obj)) continue;
      for (const [k, v] of Object.entries(obj)) {
        if (trackedScalars.has(k) && v !== trackedScalars.get(k))
          push(0, 'mirror', `conformance.${exp}.${k}=${v} ≠ rules ${trackedScalars.get(k)}`);
      }
    }
  } catch (e) {
    console.error(`conformance import failed: ${e.message}`);
    process.exit(2);
  }
}

const exitCode = findings.some((f) => f.sev === '🔴') ? 1 : 0;
// executed_target_modules: the imports above ran the modules' top-level code on this host; the consumer sees it in
// every output so the "code built in this repository" rule stays visible where the result is read.
const executed = [ARGS.spec, ...(conformanceChecked ? [ARGS.conformance] : [])];
const summary = { konzept: ARGS.konzept, lines_scanned: lines.length, tracked_constants: annot.size, keys_source: ARGS.keys || 'default (NSAI-Edge)', findings: findings.length, conformance_checked: conformanceChecked, executed_target_modules: executed, exit: exitCode };

if (ARGS.json) {
  console.log(JSON.stringify({ ...summary, findings }, null, 2));
} else {
  console.log(`konzept-const-sync — ${summary.lines_scanned} lines, ${annot.size} tracked constants, ${findings.length} drift findings (imported ${executed.join(', ')}; top-level code ran)\n`);
  for (const f of findings) console.log(`  ${f.sev} ${f.line ? `L${f.line}` : 'mirror'} [${f.kind}] — ${f.detail}`);
  if (findings.length) console.log('');
  console.log(findings.length === 0 ? `no drift — concept constants match the spec  ·  exit ${exitCode}` : `${findings.length} drift  ·  exit ${exitCode}`);
}

process.exit(exitCode);
