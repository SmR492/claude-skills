import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S2a — entrenchment-gewichtete Präzedenz (Modell C, §4.6).
// resolveBelief moduliert die effektive Autoritäts-Stufe mit trustOf des Tripels:
// bandShift = clamp(trunc((trustOf−300)/200), −K, +K), K=2; eternal floort negativen Shift (AC-T.12).
// trustRank(Peer) bleibt primärer Gate; trustOf/_effTier unberührt; safe-by-default (kein Event → heutiges Tier-Verhalten).

const FIX = Date.parse('2026-06-01T00:00:00Z');
const mkEngine = () => { const e = new Engine(); e._now = () => FIX; return e; };
// hebt trustOf eines Tripels über N direkte human_endorse (clamp-frei, eine Epoche → hoch)
const endorse = (e, hash, n = 30) => { for (let i = 0; i < n; i++) e.recordAdjudication({ target_id: hash, adj_class: 'human_endorse', delta: 1000 }); };
const reject = (e, hash, n = 30) => { for (let i = 0; i < n; i++) e.recordAdjudication({ target_id: hash, adj_class: 'human_reject', delta: -1000 }); };

test('AC-S2a.1: safe-by-default — ohne Adjudikation gewinnt die höhere Tier-Stufe (kein Regress ggü. heute)', () => {
  const e = mkEngine();
  e.storeTriple({ subject: 'XX', predicate: 'ist', object: 'A_gesetz', source_type: 'gesetz' });
  e.storeTriple({ subject: 'XX', predicate: 'ist', object: 'B_web', source_type: 'web' });
  const r = e.resolveBelief('XX', 'ist');
  assert.equal(r.winner, 'A_gesetz', `Gesetz (tier6) muss ungedämpft gegen Web (tier1) gewinnen: ${r.winner}`);
});

test('AC-S2a.2: Entrenchment promoviert — ein stark-entrenchtes niedrigeres Tier überholt ein höheres', () => {
  const e = mkEngine();
  const lo = e.storeTriple({ subject: 'YY', predicate: 'ist', object: 'MANUAL', source_type: 'manual' }); // tier2
  e.storeTriple({ subject: 'YY', predicate: 'ist', object: 'FACHQ', source_type: 'fachquelle' });          // tier3
  assert.equal(e.resolveBelief('YY', 'ist').winner, 'FACHQ', 'ohne Adjudikation: fachquelle(3) > manual(2)');
  endorse(e, lo.triple_hash, 30); // trustOf(manual) hoch → bandShift +2 → effTier 4
  assert.ok(e.trustOf(lo.triple_hash) >= 700, `Entrenchment sollte hoch sein: ${e.trustOf(lo.triple_hash)}`);
  assert.equal(e.resolveBelief('YY', 'ist').winner, 'MANUAL', 'entrenchtes manual(2→4) überholt fachquelle(3)');
});

test('AC-S2a.3: Widerlegung demoviert (nicht-eternal) — refutierte Stufe sinkt (max −1 Band)', () => {
  const e = mkEngine();
  const hi = e.storeTriple({ subject: 'ZZ', predicate: 'ist', object: 'FACHQ', source_type: 'fachquelle', temporality: 'stable' }); // tier3
  const en = e.storeTriple({ subject: 'ZZ', predicate: 'ist', object: 'WEB', source_type: 'web' });                                 // tier1
  assert.equal(e.resolveBelief('ZZ', 'ist').winner, 'FACHQ', 'ohne Adjudikation: fachquelle(3) > web(1)');
  reject(e, hi.triple_hash, 30);     // fachquelle refutiert → effTier 3−1=2
  endorse(e, en.triple_hash, 30);    // web entrenchet → effTier 1+2=3
  assert.equal(e.resolveBelief('ZZ', 'ist').winner, 'WEB', 'refutierte fachquelle(2) verliert gegen entrenchtes web(3)');
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

test('AC-S2a.4: Sybil-Bound — auto-gepumptes Item (Kappe 600 → +1) überholt ein Gesetz NICHT', () => {
  const e = mkEngine();
  e.storeTriple({ subject: 'SS', predicate: 'ist', object: 'GESETZ', source_type: 'gesetz' });
  const web = e.storeTriple({ subject: 'SS', predicate: 'ist', object: 'WEB', source_type: 'web' });
  for (let i = 0; i < 100; i++) e.recordAdjudication({ target_id: web.triple_hash, adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  assert.ok(e.trustOf(web.triple_hash) <= 600, `auto bleibt gedeckelt: ${e.trustOf(web.triple_hash)}`);
  assert.equal(e.resolveBelief('SS', 'ist').winner, 'GESETZ', 'auto-Schwall (web 1→max 3) sprengt die Gesetz-Dominanz (6) nicht');
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
