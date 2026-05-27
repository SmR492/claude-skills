import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

// UC-V (Slice #4) — Verifikation: verify(claim) → supported / contradicted / unknown.

test('AC-12.1: aktive Belief-Gewinner-Aussage → supported (+ belief)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 900 });
  const v = e.verify({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall' });
  assert.equal(v.verdict, 'supported');
  assert.equal(v.belief, 1000); // einzige Aussage
});

test('AC-12.2: anderes dominantes Objekt → contradicted (+ dominant)', () => {
  const e = new Engine();
  // höher-autoritär (gesetz) gewinnt gegen llm
  e.storeTriple({ subject: 'Strasse', predicate: 'zustand', object: 'frei', confidence: 900, source_type: 'gesetz' });
  e.storeTriple({ subject: 'Strasse', predicate: 'zustand', object: 'gesperrt', confidence: 900, source_type: 'llm' });
  const v = e.verify({ subject: 'Strasse', predicate: 'zustand', object: 'gesperrt' });
  assert.equal(v.verdict, 'contradicted');
  assert.equal(v.dominant, 'frei');
  assert.equal(v.present, true); // gesperrt ist präsent, aber unterlegen
});

test('AC-12.3: Open-World — unbekanntes (s,p) → unknown, nie contradicted', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 900 });
  assert.equal(e.verify({ subject: 'Voellig', predicate: 'unbekannt', object: 'Ding' }).verdict, 'unknown'); // kein Subjekt
  assert.equal(e.verify({ subject: 'Glatteis', predicate: 'hat_farbe', object: 'blau' }).verdict, 'unknown'); // Subjekt da, Prädikat nicht
});

test('AC-12.4: Mehrwert-Prädikat — vorhanden→supported, fehlend→unknown', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'BundleX', predicate: 'hat_tag', object: 'symfony', confidence: 900 });
  e.storeTriple({ subject: 'BundleX', predicate: 'hat_tag', object: 'auth', confidence: 900 });
  assert.equal(e.verify({ subject: 'BundleX', predicate: 'hat_tag', object: 'symfony' }).verdict, 'supported');
  assert.equal(e.verify({ subject: 'BundleX', predicate: 'hat_tag', object: 'php' }).verdict, 'unknown'); // fehlend ≠ Widerspruch
});

test('AC-12.6: nur active — retracted/superseded-only → unknown (keine Stützung)', () => {
  const e = new Engine();
  const h = e.storeTriple({ subject: 'Faktum', predicate: 'ist', object: 'Wahr', confidence: 800 }).triple_hash;
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(h);
  assert.equal(e.verify({ subject: 'Faktum', predicate: 'ist', object: 'Wahr' }).verdict, 'unknown');
});

test('AC-12.7: supported einer abgeleiteten Aussage liefert die Begründung', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 900 });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900 });
  e.infer(); // leitet Fahrbahn zustand gefaehrlich ab
  const v = e.verify({ subject: 'Fahrbahn', predicate: 'zustand', object: 'gefaehrlich' });
  assert.equal(v.verdict, 'supported');
  assert.ok(v.derived_from && Array.isArray(v.derived_from.from)); // Stützung mitgeliefert
});

test('AC-12.8: read-only — keine DB-/Status-Änderung durch verify', () => {
  const e = new Engine();
  const h = e.storeTriple({ subject: 'Aa', predicate: 'ist', object: 'Bb', confidence: 700 }).triple_hash;
  const before = e._getEdge(h);
  e.verify({ subject: 'Aa', predicate: 'ist', object: 'Bb' });
  const after = e._getEdge(h);
  assert.equal(after.confidence, before.confidence);
  assert.equal(after.local_status, before.local_status);
  assert.equal(after.vector_clock, before.vector_clock);
});

test('AC-12.9: Open-World (allZero) — nur untrusted-Kandidaten → unknown, nie contradicted', () => {
  const e = new Engine();
  // zwei Objekte, beide von untrusted-Origin → kein durchsetzungsfähiger Gewinner (winner=null)
  for (const [o, peer] of [['Xx', 'peer:u1'], ['Yy', 'peer:u2']]) {
    const h = e.storeTriple({ subject: 'Thema', predicate: 'ist', object: o, confidence: 800 }).triple_hash;
    e.db.prepare('UPDATE knowledge_edges SET origin_peer_id=? WHERE triple_hash=?').run(peer, h);
  }
  const v = e.verify({ subject: 'Thema', predicate: 'ist', object: 'Xx' });
  assert.notEqual(v.verdict, 'contradicted'); // 🔴-1: NIE contradicted bei allZero
  assert.equal(v.verdict, 'unknown');
});

test('AC-12.10: knapper Belief → supported MIT contested-Flag', () => {
  const e = new Engine();
  // gleiche Autorität/Tier, ähnliche Konfidenz → contested
  e.storeTriple({ subject: 'Wetter', predicate: 'wird', object: 'Regen', confidence: 800, source_type: 'web' });
  e.storeTriple({ subject: 'Wetter', predicate: 'wird', object: 'Sonne', confidence: 780, source_type: 'web' });
  const winner = e.resolveBelief('Wetter', 'wird').winner;
  const v = e.verify({ subject: 'Wetter', predicate: 'wird', object: winner });
  assert.equal(v.verdict, 'supported');
  assert.equal(v.contested, true);
});

test('AC-12.11/Format: ungültiges Format → Fehler, kein Verdikt', () => {
  const e = new Engine();
  assert.throws(() => e.verify({ subject: 'A', predicate: 'p', object: 'B' }), /INVALID_PARAMETER_FORMAT/);
});
