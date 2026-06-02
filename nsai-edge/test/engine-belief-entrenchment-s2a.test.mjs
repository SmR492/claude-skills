import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S2a — entrenchment-gewichtete Präzedenz (Modell C, §4.6).
// resolveBelief moduliert die effektive Autoritäts-Stufe mit trustOf des Tripels:
//   POSITIVER bandShift = +min(K, trunc((trustOf−cap)/STEP)) — greift erst OBERHALB des auto-Caps
//   (trustAutoCorroborateCap=600); STEP=200, K=2. NEGATIVER Shift unverändert:
//   −min(K, trunc((prior−trustOf)/STEP)) für trustOf<prior(=300). [prior..cap] → KEIN Shift.
// AUDIT-HÄRTUNG (Adversarial-🔴): der positive Shift ist autoritäts-verankert — reine Korroboration
//   (auto_corroborate, im Fold auf cap=600 gedeckelt) erzeugt NIE einen positiven Shift; nur Autorität
//   (human_endorse/oracle_higher_tier) hebt trustOf über cap und verschiebt die Präzedenz. Die Anzahl-
//   Achse verschiebt keine Präzedenz mehr. eternal floort den negativen Shift (AC-T.12, UNVERÄNDERT).
// trustRank(Peer) bleibt primärer Gate; trustOf/_effTier unberührt; safe-by-default (kein Event → heute).

const FIX = Date.parse('2026-06-01T00:00:00Z');
const mkEngine = () => { const e = new Engine(); e._now = () => FIX; return e; };
// hebt trustOf eines Tripels via N AUTORITÄTS-Akte (human_endorse, clamp-frei) ÜBER cap=600 → positiver
// Band-Shift. n=60 → trustOf≈900 → +1. (auto_corroborate erreicht den positiven Shift nicht mehr.)
const endorse = (e, hash, n = 60) => { for (let i = 0; i < n; i++) e.recordAdjudication({ target_id: hash, adj_class: 'human_endorse', delta: 1000 }); };
const reject = (e, hash, n = 30) => { for (let i = 0; i < n; i++) e.recordAdjudication({ target_id: hash, adj_class: 'human_reject', delta: -1000 }); };

test('AC-S2a.1: safe-by-default — ohne Adjudikation gewinnt die höhere Tier-Stufe (kein Regress ggü. heute)', () => {
  const e = mkEngine();
  e.storeTriple({ subject: 'XX', predicate: 'ist', object: 'A_gesetz', source_type: 'gesetz' });
  e.storeTriple({ subject: 'XX', predicate: 'ist', object: 'B_web', source_type: 'web' });
  const r = e.resolveBelief('XX', 'ist');
  assert.equal(r.winner, 'A_gesetz', `Gesetz (tier6) muss ungedämpft gegen Web (tier1) gewinnen: ${r.winner}`);
});

test('AC-S2a.2: Entrenchment promoviert — ein autoritäts-entrenchtes niedrigeres Tier überholt ein höheres', () => {
  // Audit-Härtung: der positive Band-Shift greift erst >cap(600) und NUR via Autorität (human_endorse).
  // manual(tier2) wird per Autorität über cap gehoben → +1 → effTier 3, gleicht fachquelle(3) → und gewinnt
  // dann INNERHALB der Top-Stufe über das höhere within-tier-Gewicht (Konfidenz). Anzahl verschiebt nichts.
  const e = mkEngine();
  const lo = e.storeTriple({ subject: 'YY', predicate: 'ist', object: 'MANUAL', source_type: 'manual', confidence: 1000 }); // tier2
  e.storeTriple({ subject: 'YY', predicate: 'ist', object: 'FACHQ', source_type: 'fachquelle', confidence: 500 });          // tier3
  assert.equal(e.resolveBelief('YY', 'ist').winner, 'FACHQ', 'ohne Adjudikation: fachquelle(3) > manual(2)');
  endorse(e, lo.triple_hash); // AUTORITÄT hebt trustOf(manual) über cap=600 → bandShift +1 → effTier 3
  assert.ok(e.trustOf(lo.triple_hash) > 600, `Entrenchment muss >cap(600) sein (nur Autorität erreicht das): ${e.trustOf(lo.triple_hash)}`);
  assert.equal(e.resolveBelief('YY', 'ist').winner, 'MANUAL', 'autoritäts-entrenchtes manual(2→3) gewinnt die Top-Stufe per Gewicht');
});

test('AC-S2a.3: Widerlegung demoviert (nicht-eternal) — refutierte Stufe sinkt (max −1 Band)', () => {
  // Negativer Shift UNVERÄNDERT (Blame/Demotion). Positiver Shift jetzt autoritäts-verankert (>cap):
  // fachquelle wird refutiert (−1 → tier2), web per Autorität über cap entrenchet (+1 → tier2), und web
  // gewinnt die gemeinsame Top-Stufe per höherem within-tier-Gewicht (Konfidenz).
  const e = mkEngine();
  const hi = e.storeTriple({ subject: 'ZZ', predicate: 'ist', object: 'FACHQ', source_type: 'fachquelle', temporality: 'stable', confidence: 500 }); // tier3
  const en = e.storeTriple({ subject: 'ZZ', predicate: 'ist', object: 'WEB', source_type: 'web', confidence: 1000 });                                 // tier1
  assert.equal(e.resolveBelief('ZZ', 'ist').winner, 'FACHQ', 'ohne Adjudikation: fachquelle(3) > web(1)');
  reject(e, hi.triple_hash, 30);     // fachquelle refutiert (trustOf<prior) → effTier 3−1=2 (negativer Shift unverändert)
  endorse(e, en.triple_hash);        // web per AUTORITÄT >cap entrenchet → effTier 1+1=2
  assert.equal(e.resolveBelief('ZZ', 'ist').winner, 'WEB', 'refutierte fachquelle(2) verliert per Gewicht gegen autoritäts-entrenchtes web(2)');
});

test('AC-T.12: eternal = institutioneller Floor — negativer Fold senkt die Stufe NICHT, nur Vorschlag', () => {
  const e = mkEngine();
  const et = e.storeTriple({ subject: 'GG', predicate: 'gilt', object: 'GESETZ', source_type: 'gesetz', temporality: 'eternal' });
  const ns = e.storeTriple({ subject: 'GG', predicate: 'gilt', object: 'STABIL_GESETZ', source_type: 'gesetz', temporality: 'stable' });
  reject(e, et.triple_hash, 30);
  reject(e, ns.triple_hash, 30);
  const r = e.resolveBelief('GG', 'gilt');
  const cEt = r.candidates.find((c) => c.object === 'GESETZ');
  const cNs = r.candidates.find((c) => c.object === 'STABIL_GESETZ');
  assert.equal(cEt.tier, 6, `eternal-Gesetz behält effTier 6 trotz Widerlegung (Floor): ${cEt.tier}`);
  assert.equal(cEt.proposedDemotion, 5, `Senkung wird nur VORGESCHLAGEN (6−1): ${cEt.proposedDemotion}`);
  assert.equal(cNs.tier, 5, `stable-Gesetz wird real demoviert (6−1): ${cNs.tier}`);
});

test('AC-S2a.4: Sybil-Bound — auto-gepumptes Item (Kappe 600 → bandShift 0) überholt ein Gesetz NICHT', () => {
  // Audit-Härtung: auto_corroborate ist im Fold auf cap=600 gedeckelt → der positive Shift greift erst
  // OBERHALB von cap → reine Korroboration erzeugt jetzt bandShift 0 (vorher +1). Web bleibt strikt tier1.
  const e = mkEngine();
  e.storeTriple({ subject: 'SS', predicate: 'ist', object: 'GESETZ', source_type: 'gesetz' });
  const web = e.storeTriple({ subject: 'SS', predicate: 'ist', object: 'WEB', source_type: 'web' });
  for (let i = 0; i < 100; i++) e.recordAdjudication({ target_id: web.triple_hash, adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  assert.ok(e.trustOf(web.triple_hash) <= 600, `auto bleibt gedeckelt: ${e.trustOf(web.triple_hash)}`);
  assert.equal(e._entrenchBandShift({ triple_hash: web.triple_hash }), 0, 'reine Korroboration (≤cap) → KEIN positiver Shift mehr');
  assert.equal(e.resolveBelief('SS', 'ist').winner, 'GESETZ', 'auto-Schwall (web 1, Shift 0) sprengt die Gesetz-Dominanz (6) nicht');
});

test('AC-S2a.5: Determinismus — gleicher Bestand → gleicher Gewinner (resolveBelief reine Projektion)', () => {
  const build = () => {
    const e = mkEngine();
    const a = e.storeTriple({ subject: 'DD', predicate: 'ist', object: 'AA', source_type: 'manual' });
    e.storeTriple({ subject: 'DD', predicate: 'ist', object: 'BB', source_type: 'fachquelle' });
    endorse(e, a.triple_hash, 30);
    return e.resolveBelief('DD', 'ist').winner;
  };
  assert.equal(build(), build(), 'reproduzierbar');
});

test('S2a-Regress: resolveBelief bleibt für unkonkurrierte / multiValue-Fälle unverändert', () => {
  const e = mkEngine();
  e.storeTriple({ subject: 'MM', predicate: 'hat_tag', object: 'rot' });
  e.storeTriple({ subject: 'MM', predicate: 'hat_tag', object: 'blau' });
  const r = e.resolveBelief('MM', 'hat_tag');
  assert.equal(r.multiValue, true, 'multiValue-Prädikat unberührt');
  assert.equal(r.candidates.length, 2);
});
