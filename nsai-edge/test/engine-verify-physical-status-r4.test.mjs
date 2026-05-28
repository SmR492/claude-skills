import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

// UC-VPS Slice #R4 — Verify-Physical-Status (additives Feld für reject/retract-UX).
// Verdikt-Stabilität, kein Probabilistik-Leak, Open-World absolut.

test('AC-19.1: nach reject → verify liefert contradicted + physical_status: superseded (KI-VO-Demo-Schliff)', () => {
  const e = new Engine();
  // gesetz-Tripel (dominant)
  e.storeTriple({ subject: 'EU-KI-VO', predicate: 'verpflichtet_zu', object: 'KI-Kompetenz', confidence: 980, source_type: 'gesetz' });
  // llm-Gerücht
  const g = e.storeTriple({ subject: 'EU-KI-VO', predicate: 'verpflichtet_zu', object: 'nichts', confidence: 950, source_type: 'llm' });
  // Gerücht ablehnen
  e.reject(g.triple_hash);
  // verify auf das rejected Tripel:
  const v = e.verify({ subject: 'EU-KI-VO', predicate: 'verpflichtet_zu', object: 'nichts' });
  assert.equal(v.verdict, 'contradicted'); // weiter contradicted (single-value-Dominanz)
  assert.equal(v.dominant, 'KI-Kompetenz');
  assert.equal(v.physical_status, 'superseded'); // UX-Schliff: Konsument sieht „du hast das schon abgelehnt"
});

test('AC-19.2: Verdikt-Stabilität — kein bestehender Pfad ändert sich', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Stable', predicate: 'ist', object: 'wahr', confidence: 900 });
  const v = e.verify({ subject: 'Stable', predicate: 'ist', object: 'wahr' });
  assert.equal(v.verdict, 'supported');
  // physical_status: 'active' wird gesetzt — das ist additiv, kein Verdikt-Drift.
  assert.equal(v.physical_status, 'active');
});

test('AC-19.3: Open-World absolut — Tripel existiert nicht physisch → physical_status fehlt', () => {
  const e = new Engine();
  const v = e.verify({ subject: 'Unknown-VPS', predicate: 'ist', object: 'leer' });
  assert.equal(v.verdict, 'unknown');
  assert.equal('physical_status' in v, false, 'Abwesenheit wird durch FEHLEN des Felds signalisiert, NICHT durch \'none\'');
});

test('AC-19.4: konkurrierendes existierendes Tripel → physical_status: active (nicht-gewählt-aber-da)', () => {
  const e = new Engine();
  // höhere Autorität für Aa
  e.storeTriple({ subject: 'Conf-VPS', predicate: 'ist', object: 'Aa', confidence: 900, source_type: 'gesetz' });
  // niedrigere Autorität für Bb
  e.storeTriple({ subject: 'Conf-VPS', predicate: 'ist', object: 'Bb', confidence: 900, source_type: 'llm' });
  const v = e.verify({ subject: 'Conf-VPS', predicate: 'ist', object: 'Bb' });
  assert.equal(v.verdict, 'contradicted');
  assert.equal(v.dominant, 'Aa');
  assert.equal(v.physical_status, 'active'); // Bb existiert weiterhin active im Graph
});

test('AC-19.5: retracted/quarantined-Status werden durchgereicht (inkl. echter TMS-Propagation)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Retract-VPS', predicate: 'ist', object: 'alt', confidence: 800 });
  // Direkter Status-Übergang als Sanity-Check
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(r.triple_hash);
  const v1 = e.verify({ subject: 'Retract-VPS', predicate: 'ist', object: 'alt' });
  assert.equal(v1.physical_status, 'retracted');

  e.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE triple_hash=?").run(r.triple_hash);
  const v2 = e.verify({ subject: 'Retract-VPS', predicate: 'ist', object: 'alt' });
  assert.equal(v2.physical_status, 'quarantined');
});

test('AC-19.5b (Adversarial 🟡-3): TMS-Propagation — Premise reject → abgeleiteter Fakt zeigt retracted', () => {
  // Echter UC-TMS-Pfad: derived_from-Kette, dann Premise reject → propagateRetraction setzt
  // den abgeleiteten Fakt auf retracted. Wir prüfen, dass physical_status das korrekt durchreicht.
  const e = new Engine();
  // Premise A → B; abgeleiteter Fakt mit derived_from-Verweis auf den Premise-Hash.
  const pr = e.storeTriple({ subject: 'Prem-VPS', predicate: 'ist', object: 'wahr', confidence: 900 });
  const dr = e.storeTriple({ subject: 'Derived-VPS', predicate: 'folgt', object: 'aus-prem', confidence: 700 });
  // derived_from manuell anhängen (in echtem System macht das infer())
  e.db.prepare("UPDATE knowledge_edges SET derived_from=? WHERE triple_hash=?").run(JSON.stringify({ from: [pr.triple_hash], rule_id: 'test' }), dr.triple_hash);
  // Premise reject → propagateRetraction setzt abgeleiteten Fakt auf retracted
  e.reject(pr.triple_hash);
  const v = e.verify({ subject: 'Derived-VPS', predicate: 'folgt', object: 'aus-prem' });
  assert.equal(v.physical_status, 'retracted', 'TMS-Propagation muss physical_status=retracted am abgeleiteten Fakt erreichen');
});

test('AC-19.6: Föderation/Wire — physical_status NIE in _edgeToWire / exportSince', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Wire-VPS', predicate: 'ist', object: 'test', confidence: 800 });
  const wire = e._edgeToWire(e._getEdge(r.triple_hash));
  assert.equal('physical_status' in wire, false);
  const exp = e.exportSince({}).find((w) => w.triple_hash === r.triple_hash);
  assert.ok(exp);
  assert.equal('physical_status' in exp, false);
});

test('AC-19.7: UC-BT-Verträglichkeit — physical_status reflektiert aktuellen Status, nicht zum Zeitpunkt T', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'BT-VPS', predicate: 'ist', object: 'jetzt-aktiv', confidence: 800, asserted_at: '2019-01-01T00:00:00Z' });
  // jetzt active — bei as_of in Vergangenheit auch active (Status ist nicht bi-temporal).
  const v = e.verify({ subject: 'BT-VPS', predicate: 'ist', object: 'jetzt-aktiv', as_of: '2020-01-01T00:00:00Z' });
  assert.equal(v.physical_status, 'active');
  // Nach reject → jetzt superseded; auch verify zu 2020 zeigt superseded (Status ist nicht historisch).
  e.reject(r.triple_hash);
  const v2 = e.verify({ subject: 'BT-VPS', predicate: 'ist', object: 'jetzt-aktiv', as_of: '2020-01-01T00:00:00Z' });
  assert.equal(v2.physical_status, 'superseded');
});

test('AC-19.8: Output bleibt kategorisch — physical_status ist String aus festem Set', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Cat-VPS', predicate: 'ist', object: 'aktiv', confidence: 800 });
  const v = e.verify({ subject: 'Cat-VPS', predicate: 'ist', object: 'aktiv' });
  assert.ok(['active', 'superseded', 'retracted', 'quarantined'].includes(v.physical_status));
  // keine Float-/Prozent-Leaks im Erweiterungsfeld
  assert.equal(/(\b\d+\.\d+\b|%)/.test(v.physical_status), false);
});

test('AC-19.9: Determinismus — gleicher Graph + Anfrage → identischer Output', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Det-VPS', predicate: 'ist', object: 'wahr', confidence: 800 });
  const a = e.verify({ subject: 'Det-VPS', predicate: 'ist', object: 'wahr' });
  const b = e.verify({ subject: 'Det-VPS', predicate: 'ist', object: 'wahr' });
  assert.deepEqual(a, b);
});

test('AC-19.10: assertClaims-Strip-Allowlist erlaubt physical_status', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Bulk-VPS', predicate: 'ist', object: 'aktiv', confidence: 800 });
  e.reject(r.triple_hash);
  const out = e.assertClaims([
    { subject: 'Bulk-VPS', predicate: 'ist', object: 'aktiv' },
  ]);
  // verdict bleibt unknown (kein konkurrierender Belief, das gefragte Tripel ist superseded
  // und daher nicht im Belief-Pfad), aber physical_status kommt mit durch.
  assert.equal(out.results[0].physical_status, 'superseded');
});
