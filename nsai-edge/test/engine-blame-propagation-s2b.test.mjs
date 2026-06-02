import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

// ADR 0019 Slice S2b — Eltern-Attribuierung (Reject-Blame-Propagation, §4.2).
// human_reject eines abgeleiteten Fakts → `derived_blame`-Events an Prämissen (rebut, γ^d·/n·trust_ext-
// gedämpft) bzw. Regel-Knoten (undercut). trust_ext(P)=trustOf(P) (K-Pfad via DAG-Invariante ausgeschlossen).

const FIX = Date.parse('2026-06-01T00:00:00Z');
// Baut den Standard-Inferenz-Fall (glaette-bei-frost) auf und liefert Engine + Hashes.
function setup() {
  const e = new Engine(); e._now = () => FIX;
  const p1 = e.storeTriple({ subject: 'Glaette', predicate: 'ist_ein', object: 'Strassengefahr' });
  const p2 = e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null' });
  e.infer(); // erzeugt (Fahrbahn zustand gefaehrlich) mit derived_from={from:[p1,p2], rule_id:'glaette-bei-frost'}
  const concl = tripleHash('Fahrbahn', 'zustand', 'gefaehrlich');
  return { e, p1: p1.triple_hash, p2: p2.triple_hash, concl };
}
const PRIOR = 300;

test('AC-T.7: rebut — Blame ist γ^d·/n·trust_ext-gedämpft + gedeckelt; Prämissen-trustOf sinkt', () => {
  const { e, p1, p2, concl } = setup();
  assert.equal(e.trustOf(p1), PRIOR); assert.equal(e.trustOf(p2), PRIOR);
  const r = e.propagateRejectBlame(concl, { delta: -1000, attribution: 'rebut' });
  // blame = trunc(trunc(trunc(1000·γ500/1000)·(1000−300)/1000)/n2) = trunc(trunc(500·700/1000)/2) = trunc(350/2)=175
  assert.equal(r.propagated, 2, 'beide Prämissen belastet');
  for (const t of r.targets) assert.equal(t.blame, 175, `γ^1·/2·trust_ext-gedämpfte Blame: ${t.blame}`);
  assert.ok(e.trustOf(p1) < PRIOR && e.trustOf(p2) < PRIOR, 'Prämissen-Entrenchment sinkt durch derived_blame');
  // Deckel: Blame nie größer als der ungedämpfte Reject
  assert.ok(r.targets.every((t) => t.blame <= 1000));
});

test('AC-T.8: undercut vs rebut — undercut belastet NUR den Regel-Knoten, Prämissen unberührt', () => {
  const { e, p1, p2, concl } = setup();
  const r = e.propagateRejectBlame(concl, { delta: -1000, attribution: 'undercut' });
  assert.equal(r.propagated, 1, 'nur der Regel-Knoten');
  assert.equal(r.targets[0].id, 'glaette-bei-frost', 'Regel-Versagen → Regel-Knoten');
  assert.equal(e.trustOf(p1), PRIOR, 'Prämisse p1 bei undercut unberührt');
  assert.equal(e.trustOf(p2), PRIOR, 'Prämisse p2 bei undercut unberührt');
  assert.ok(e.trustOf('glaette-bei-frost') < PRIOR, 'Regel-Knoten sinkt');
});

test('AC-T.9: trust_ext schützt — gut-gestützte Prämisse (hohe trustOf) bekommt WENIGER Blame', () => {
  const { e, p1, p2, concl } = setup();
  for (let i = 0; i < 30; i++) e.recordAdjudication({ target_id: p1, adj_class: 'human_endorse', delta: 1000 }); // p1 entrenchet
  assert.ok(e.trustOf(p1) >= 700, `p1 sollte gut gestützt sein: ${e.trustOf(p1)}`);
  const r = e.propagateRejectBlame(concl, { delta: -1000, attribution: 'rebut' });
  const bP1 = r.targets.find((t) => t.id === p1).blame;
  const bP2 = r.targets.find((t) => t.id === p2).blame;
  assert.ok(bP1 < bP2, `entrenchte Prämisse geschont: blame(p1)=${bP1} < blame(p2)=${bP2}`);
});

test('AC-T.9b: Zirkel-Freiheit — K selbst wird nie belastet; trust_ext liest kein downstream-K', () => {
  const { e, concl } = setup();
  const r = e.propagateRejectBlame(concl, { delta: -1000, attribution: 'rebut' });
  assert.ok(!r.targets.some((t) => t.id === concl), 'die zurückgewiesene Konklusion K wird nicht selbst belastet');
});

test('AC-S2b.degenerate: Basis-Fakt / n=0 / Validierung', () => {
  const { e, p1, concl } = setup();
  assert.equal(e.propagateRejectBlame(p1, { delta: -1000 }).propagated, 0, 'Basis-Fakt (keine derived_from) → keine Propagation');
  assert.throws(() => e.propagateRejectBlame(concl, { delta: 500 }), /INVALID_PARAMETER_FORMAT/); // positiv verboten
  assert.throws(() => e.propagateRejectBlame(concl, { delta: -1000, attribution: 'foo' }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-S2b.fold: derived_blame ist append-only + foldet als negativer Impuls (kein anchored, kein auto-Cap)', () => {
  const { e, p1, concl } = setup();
  e.propagateRejectBlame(concl, { delta: -1000, attribution: 'rebut' });
  const rows = e.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE adj_class='derived_blame'").get().c;
  assert.equal(rows, 2, 'zwei derived_blame-Events');
  assert.throws(() => e.db.prepare("UPDATE trust_events SET delta_promille=0 WHERE adj_class='derived_blame'").run(), /append-only/);
  // derived_blame hebt NICHTS (kein positiver Anker) — ein nachfolgender auto-Schwall bleibt gedeckelt
  for (let i = 0; i < 50; i++) e.recordAdjudication({ target_id: p1, adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  assert.ok(e.trustOf(p1) <= 600, `derived_blame setzt kein anchored → auto bleibt gedeckelt: ${e.trustOf(p1)}`);
});

test('AC-S2b.determinism: gleiche Reject-Propagation → identischer Trust', () => {
  const run = () => { const { e, p1, concl } = setup(); e.propagateRejectBlame(concl, { delta: -1000 }); return e.trustOf(p1); };
  assert.equal(run(), run(), 'reproduzierbar');
});
