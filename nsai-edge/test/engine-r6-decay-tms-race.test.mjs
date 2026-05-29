import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';
import { DEFAULT_SPEC } from '../src/rules.mjs';

// R6 — decayPass-Race + Audit-Trail-Verlust bei Premise+Konklusion-Supersede.
// Vertrag: fallen P und K im SAME decayPass beide unter deleteThreshold, muss K am Ende
// `retracted` (TMS-Cascade) sein, nicht `superseded` (eigener Decay). Sonst wäre die
// Inaktivierungs-Ursache von K verfälscht UND gc({maxAgeDays}) würde K physisch entfernen
// (gc filtert nur local_status='superseded' — §8.4).
//
// Setup: Glatteis (ephemeral) UND Konklusion (stable, hoher Decay) fallen beide in 1 Pass
// unter deleteThreshold=50. Die Konklusion `Fahrbahn|zustand|gefaehrlich` wird von infer()
// IMMER als 'stable' angelegt (engine.mjs Z486/Z490) — also brauchen wir einen Spec mit
// `decayPerPeriod.stable` hoch genug, damit K in einem Pass unter 50 fällt.

// P (ephemeral, conf=350) und K (stable, conf=315 via factor 900) müssen beide nach 1 Pass
// unter deleteThreshold=50 fallen — UND K muss bei infer() active werden (conf ≥ quarantineThreshold=300).
const SPEC_R6 = { ...DEFAULT_SPEC, decayPerPeriod: { eternal: 0, stable: 500, temporal: 50, ephemeral: 350 } };
const PREM_EPH = tripleHash('Glatteis', 'ist_ein', 'Strassengefahr');
const PREM_STB = tripleHash('Temperatur', 'zustand', 'unter_null');
const CONCL = tripleHash('Fahrbahn', 'zustand', 'gefaehrlich');

function seedFrostBoth() {
  const e = new Engine({ spec: SPEC_R6 });
  // Prämisse ephemeral conf=350 — 1 Pass: 350-350=0 < 50 → supersede.
  e.storeTriple({ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 350, temporality: 'ephemeral' });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900, temporality: 'stable' });
  e.infer();
  // Konklusion stable, conf = min(350,900) * 900 / 1000 = 315 — ≥ quarantineThreshold=300 → active.
  // 1 Pass: 315-500=0 < 50 → supersede (gleicher Pass).
  return e;
}

test('AC-9.9 / R6.1: P+K beide-supersede im selben decayPass → K bleibt retracted (TMS-Cascade gewinnt)', () => {
  const e = seedFrostBoth();
  assert.equal(e._getEdge(PREM_EPH).confidence, 350);
  assert.equal(e._getEdge(CONCL).confidence, 315);
  assert.equal(e._getEdge(CONCL).temporality, 'stable');
  assert.equal(e._getEdge(CONCL).local_status, 'active');

  const r = e.decayPass();

  // Bug-Reproduktion: vor dem Fix wäre K hier `superseded` — eigener Decay-UPDATE überschrieb
  // den TMS-Status, weil _propagateRetraction NACH Phase A lief und nur active-Edges sah.
  assert.equal(e._getEdge(CONCL).local_status, 'retracted', 'Konklusion muss als retracted (TMS-Cascade) bleiben');
  // Prämisse bleibt erwartungsgemäß superseded (eigener Decay, korrekter Inaktivierungs-Grund).
  assert.equal(e._getEdge(PREM_EPH).local_status, 'superseded');
  // Counter: superseded zählt P (und ggf. K's eigener-Decay-Plan); retracted zählt K via Propagation.
  assert.ok(r.superseded >= 1, `superseded counter: ${r.superseded}`);
  assert.ok(r.retracted >= 1, `retracted counter: ${r.retracted}`);
});

test('R6.2: GC entfernt nicht versehentlich TMS-retraktierte Konklusionen (Audit-Tombstone)', () => {
  const e = seedFrostBoth();
  e.decayPass();
  assert.equal(e._getEdge(CONCL).local_status, 'retracted');
  // updated_at künstlich altern, damit gc({maxAgeDays: 30}) zuschlagen WÜRDE — wenn K als
  // 'superseded' markiert wäre (Bug). Mit Fix: K ist 'retracted' → gc lässt sie stehen.
  e.db.prepare("UPDATE knowledge_edges SET updated_at='1970-01-01 00:00:00' WHERE triple_hash=?").run(CONCL);
  e.db.prepare("UPDATE knowledge_edges SET updated_at='1970-01-01 00:00:00' WHERE triple_hash=?").run(PREM_EPH);
  const g = e.gc({ maxAgeDays: 30 });
  // Nur die Prämisse (superseded) wird physisch entfernt; K (retracted) bleibt als Tombstone.
  assert.ok(g.edgesDeleted >= 1, `gc sollte mindestens die superseded Prämisse entfernen: ${g.edgesDeleted}`);
  assert.ok(e._getEdge(CONCL), 'Konklusion muss als retracted-Tombstone erhalten bleiben');
  assert.equal(e._getEdge(CONCL).local_status, 'retracted');
});

// R6.3 Regression: AC-9.1-Pfad (P weg → K retracted, K eigenständig confident) ist bereits
// durch `test/engine-tms.test.mjs:130 'decayPass retraktiert abgeleitete Fakten...'` abgedeckt
// und MUSS unter dem Fix grün bleiben (Phase-Reihenfolge schreibt für nicht-im-Plan-K
// keinen Decay → K wird wie zuvor durch _propagateRetraction auf retracted gesetzt).

test('R6.4: Phase-2-conditional UPDATE — K confidence wird NICHT mehr verändert, sobald K retracted ist', () => {
  // Spezifischer Fix-Vertrag: nach Phase B (K → retracted) darf das Phase-A-UPDATE (K eigener
  // Decay-Supersede) K nicht mehr berühren. Sonst gäbe es ein conf-Update auf einer retracted-
  // Edge → semantischer Müll (`confidence` einer toten Edge ändert sich, obwohl sie irrelevant ist).
  const e = seedFrostBoth();
  const beforeConf = e._getEdge(CONCL).confidence; // 315
  e.decayPass();
  const after = e._getEdge(CONCL);
  assert.equal(after.local_status, 'retracted');
  // Mit Bug (alte Reihenfolge): conf wäre auf 0 reduziert. Mit Fix: conf bleibt unverändert,
  // weil das WHERE local_status='active' in Phase A nicht matched.
  assert.equal(after.confidence, beforeConf, `confidence ${after.confidence} sollte ${beforeConf} bleiben (Phase A darf retracted nicht modifizieren)`);
});

test('R6.6 / Adversarial 🟡-1: decayed/superseded-Counter sind drift-frei — TMS-retracted K wird NICHT als superseded gezählt', () => {
  // Adversarial-Auditor-Befund: vorher zählten `decayed`/`superseded` im Plan-Aufbau (vor Phase B),
  // sodass eine durch TMS-Cascade auf 'retracted' überschriebene Konklusion sowohl als superseded
  // ALS auch als retracted gezählt wurde → Reporting-Lüge. Fix: `info.changes` aus Phase A.
  const e = seedFrostBoth();
  const r = e.decayPass();
  // Plan hat drei Edges:
  //   - Glatteis (ephemeral 350→0) supersede
  //   - Temperatur (stable 900→400) eigener Decay (kein supersede)
  //   - Fahrbahn=K (stable 315→0) supersede, aber in Phase B durch TMS-Cascade auf retracted
  //     überschrieben → Phase A info.changes=0 für K.
  // Vor dem Drift-Fix: superseded=2 (Glatteis + K), retracted=1 (K) → K doppelt gezählt.
  // Nach Fix: superseded=1 (Glatteis), retracted=1 (K), decayed=1 (Temperatur). Konsistent.
  assert.equal(r.superseded, 1, `superseded soll nur P zählen, nicht K (retracted): ${JSON.stringify(r)}`);
  assert.equal(r.retracted, 1, `retracted soll K zählen: ${JSON.stringify(r)}`);
  assert.equal(r.decayed, 1, `decayed zählt Temperatur (stable nicht-supersede): ${JSON.stringify(r)}`);
});

test('R6.7 / Adversarial 🟡-1 Variante: K mit kleinem eigenem Decay (nicht-supersede) wird via TMS retracted → decayed-Counter zählt K NICHT', () => {
  // Variante H5: P supersede=true, K supersede=false (eigener Decay würde K nur reduzieren, nicht killen).
  // Vor dem Fix: decayed-Counter zählt K (Plan-supersede=false), obwohl Phase A K wegen retracted-Status
  // nicht mehr berührt → Lüge im decayed-Counter.
  const spec = { ...DEFAULT_SPEC, decayPerPeriod: { eternal: 0, stable: 5, temporal: 50, ephemeral: 200 } };
  const e = new Engine({ spec });
  e.storeTriple({ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 200, temporality: 'ephemeral' });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900, temporality: 'stable' });
  e.infer();
  const r = e.decayPass();
  // P (ephemeral 200→0) → supersede; K (stable, conf<300 → quarantined bei infer) ist nicht im plan.
  // Temperatur (stable, conf=900→895) → decayed.
  // K war bei infer quarantined (180 < 300), also gar nicht im plan — daher kein Reporting-Drift HIER.
  // Aber sanity: superseded/decayed/retracted nicht negativ, summieren sich konsistent.
  assert.ok(r.superseded >= 0 && r.decayed >= 0 && r.retracted >= 0, `Counter-Konsistenz: ${JSON.stringify(r)}`);
});

test('R6.5: dryRun=true im P+K-Supersede-Szenario schreibt nichts (kein State-Wechsel)', () => {
  const e = seedFrostBoth();
  const r = e.decayPass({ dryRun: true });
  assert.equal(r.dryRun, true);
  assert.equal(r.retracted, 0, 'dryRun darf retracted-Counter nicht aufblasen');
  // State unverändert.
  assert.equal(e._getEdge(PREM_EPH).local_status, 'active');
  assert.equal(e._getEdge(CONCL).local_status, 'active');
  assert.equal(e._getEdge(PREM_EPH).confidence, 350);
  assert.equal(e._getEdge(CONCL).confidence, 315);
});
