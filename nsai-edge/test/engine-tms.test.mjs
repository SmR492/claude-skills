import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';
import { DEFAULT_SPEC } from '../src/rules.mjs';

// UC-TMS (Slice #1) — Justification-basierte Belief-Revision (Retraktions-Richtung).

const frostSetup = () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 900 });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900 });
  e.infer();
  return e;
};
const CONCL = tripleHash('Fahrbahn', 'zustand', 'gefaehrlich');
const PREM1 = tripleHash('Glatteis', 'ist_ein', 'Strassengefahr');
const PREM2 = tripleHash('Temperatur', 'zustand', 'unter_null');

test('AC-9.1: verlorene Prämisse → Schlussfolgerung wird retracted (eine Transaktion)', () => {
  const e = frostSetup();
  assert.equal(e._getEdge(CONCL).local_status, 'active');
  e.reject(PREM1);
  assert.equal(e._getEdge(CONCL).local_status, 'retracted');
});

test('AC-9.2: transitive Kette A→B→C propagiert vollständig', () => {
  const spec = { ...DEFAULT_SPEC, inferenceRules: [
    { id: 'r1', premises: [{ subject: '?x', predicate: 'hat', object: 'aa' }], conclusion: { subject: '?x', predicate: 'folgt', object: 'bb' }, factor: 900 },
    { id: 'r2', premises: [{ subject: '?x', predicate: 'folgt', object: 'bb' }], conclusion: { subject: '?x', predicate: 'dann', object: 'cc' }, factor: 900 },
  ] };
  const e = new Engine({ spec });
  e.storeTriple({ subject: 'Ss', predicate: 'hat', object: 'aa', confidence: 1000 });
  e.infer();
  const bH = tripleHash('Ss', 'folgt', 'bb'); const cH = tripleHash('Ss', 'dann', 'cc');
  assert.equal(e._getEdge(bH).local_status, 'active');
  assert.equal(e._getEdge(cH).local_status, 'active');
  e.reject(tripleHash('Ss', 'hat', 'aa'));
  assert.equal(e._getEdge(bH).local_status, 'retracted'); // direkt undercut
  assert.equal(e._getEdge(cH).local_status, 'retracted'); // transitiv
});

test('AC-9.3a: infer() verbietet zyklus-bildende Justification (DAG-Invariante)', () => {
  const spec = { ...DEFAULT_SPEC, inferenceRules: [
    { id: 'self', premises: [{ subject: '?x', predicate: 'pp', object: 'bb' }], conclusion: { subject: '?x', predicate: 'pp', object: 'bb' }, factor: 900 },
  ] };
  const e = new Engine({ spec });
  e.storeTriple({ subject: 'Ss', predicate: 'pp', object: 'bb', confidence: 900 });
  const r = e.infer();
  assert.equal(r.created, 0); // Selbst-Ableitung übersprungen, kein Zyklus
});

test('AC-9.3b: Propagation terminiert trotz zyklischer derived_from (visited-Set)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 900 });
  e.storeTriple({ subject: 'Cc', predicate: 'pp', object: 'Dd', confidence: 900 });
  const h1 = tripleHash('Aa', 'pp', 'Bb'); const h2 = tripleHash('Cc', 'pp', 'Dd');
  e.db.prepare('UPDATE knowledge_edges SET derived_from=? WHERE triple_hash=?').run(JSON.stringify({ from: [h2], rule_id: 'x' }), h1);
  e.db.prepare('UPDATE knowledge_edges SET derived_from=? WHERE triple_hash=?').run(JSON.stringify({ from: [h1], rule_id: 'x' }), h2);
  const n = e._tx(() => e._propagateRetraction(h1)); // muss terminieren
  assert.ok(n >= 1);
});

test('AC-9.4: strikter (eternal) Fakt wird NICHT relabelt', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Prem', predicate: 'pp', object: 'Xx', confidence: 900 });
  const ph = tripleHash('Prem', 'pp', 'Xx');
  e.storeTriple({ subject: 'Concl', predicate: 'qq', object: 'Yy', confidence: 900, temporality: 'eternal' });
  const ch = tripleHash('Concl', 'qq', 'Yy');
  e.db.prepare('UPDATE knowledge_edges SET derived_from=? WHERE triple_hash=?').run(JSON.stringify({ from: [ph], rule_id: 'x' }), ch);
  e.reject(ph);
  assert.equal(e._getEdge(ch).local_status, 'active'); // eternal = strikt (A5)
});

test('AC-9.5: Propagation ist status-only — Live-Konfidenz + vector_clock unverändert', () => {
  const e = frostSetup();
  const before = e._getEdge(CONCL);
  e.reject(PREM1);
  const after = e._getEdge(CONCL);
  assert.equal(after.local_status, 'retracted');
  assert.equal(after.confidence, before.confidence);          // Live-Konfidenz unberührt
  assert.equal(after.vector_clock, before.vector_clock);      // VC nicht getickt
  assert.equal(after.asserted_confidence, before.asserted_confidence);
});

test('AC-9.6: Minimalität — selbst-behauptete Fakten (kein derived_from) werden nie retracted', () => {
  const e = frostSetup();
  e.storeTriple({ subject: 'Unrelated', predicate: 'ist', object: 'Stabil', confidence: 800 });
  e.reject(PREM1);
  assert.equal(e._getEdge(PREM2).local_status, 'active'); // andere Prämisse bleibt
  assert.equal(e._getEdge(tripleHash('Unrelated', 'ist', 'Stabil')).local_status, 'active');
});

test('AC-9.7: Determinismus — Konklusion fällt unabhängig davon, WELCHE Prämisse wegfällt', () => {
  const e1 = frostSetup(); e1.reject(PREM1);
  const e2 = frostSetup(); e2.reject(PREM2);
  assert.equal(e1._getEdge(CONCL).local_status, 'retracted');
  assert.equal(e2._getEdge(CONCL).local_status, 'retracted');
});

test('AC-9.8: Föderations-Parität — retracted wird nicht exportiert', () => {
  const e = frostSetup();
  e.reject(PREM1);
  const exported = e.exportSince({}).map((w) => w.triple_hash);
  assert.ok(!exported.includes(CONCL)); // retracted bleibt lokal, nicht im Wire
});

test('decayPass retraktiert abgeleitete Fakten, deren Prämisse weg-decayed (ephemeral)', () => {
  const e = new Engine();
  // Prämisse hoch genug, dass die Schlussfolgerung aktiv entsteht (≥ quarantineThreshold),
  // aber ephemeral → fällt über zwei Decay-Pässe (je -200) unter die Lösch-Schwelle.
  e.storeTriple({ subject: 'Sensor', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 400, temporality: 'ephemeral' });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900 });
  e.infer();
  const concl = tripleHash('Fahrbahn', 'zustand', 'gefaehrlich');
  assert.equal(e._getEdge(concl).local_status, 'active'); // 360 ≥ 300
  e.decayPass();                                           // Prämisse 400 → 200 (noch aktiv)
  assert.equal(e._getEdge(concl).local_status, 'active');
  const r = e.decayPass();                                 // Prämisse 200 → 0 (< 50 → superseded)
  assert.ok(r.superseded >= 1 && r.retracted >= 1);
  assert.equal(e._getEdge(concl).local_status, 'retracted');
});
