import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

// UC-BT (Slice #5) — bi-temporale Gültigkeit + as-of.
const PAST = '2019-01-01T00:00:00.000Z';
const T2021 = '2021-01-01T00:00:00.000Z';
const T2023 = '2023-01-01T00:00:00.000Z';

test('AC-13.1/13.9: valid_from default=asserted_at via COALESCE, offen = jetzt sichtbar', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 900, asserted_at: PAST });
  // valid_* bleiben NULL
  const edge = e._getEdge(tripleHash('Glatteis', 'verursacht', 'Unfall'));
  assert.equal(edge.valid_from, null);
  // jetzt sichtbar (COALESCE→asserted_at PAST ≤ jetzt) und as_of in der Vergangenheit (>= asserted) auch
  assert.equal(e.query('Glatteis').edges.length >= 1, true);
  assert.equal(e.query('Glatteis', { as_of: T2021 }).edges.length >= 1, true);
});

test('AC-13.2: as_of halb-offen [from,to)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Vertrag', predicate: 'gilt', object: 'aktiv', confidence: 800, asserted_at: PAST });
  const h = tripleHash('Vertrag', 'gilt', 'aktiv');
  e.setValidity(h, { valid_from: T2021, valid_to: T2023 });
  const has = (asOf) => e.query('Vertrag', { as_of: asOf }).edges.some((x) => x.object === 'aktiv');
  assert.equal(has('2022-01-01T00:00:00Z'), true);  // drin
  assert.equal(has('2020-01-01T00:00:00Z'), false); // vor valid_from
  assert.equal(has(T2023), false);                  // == valid_to (exklusiv)
});

test('AC-13.3/13.4: supersedeTemporally nicht-destruktiv — beide active, as-of trennt', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Firma', predicate: 'ceo', object: 'Alice', confidence: 900, asserted_at: PAST });
  e.supersedeTemporally({ subject: 'Firma', predicate: 'ceo', object: 'Bob', as_of: T2023, confidence: 900 });
  const alice = e._getEdge(tripleHash('Firma', 'ceo', 'Alice'));
  const bob = e._getEdge(tripleHash('Firma', 'ceo', 'Bob'));
  assert.equal(alice.local_status, 'active'); assert.equal(alice.valid_to, T2023); // geschlossen, nicht gelöscht
  assert.equal(bob.local_status, 'active'); assert.equal(bob.valid_from, T2023);
  assert.equal(e.resolveBelief('Firma', 'ceo', { as_of: T2021 }).winner, 'Alice'); // Vergangenheit
  assert.equal(e.resolveBelief('Firma', 'ceo').winner, 'Bob');                      // jetzt
});

test('AC-13.5/13.10: resolveBelief as_of + konjunktiv zu active (retracted erscheint nie)', () => {
  const e = new Engine();
  const h = e.storeTriple({ subject: 'Xx', predicate: 'ist', object: 'Alt', confidence: 800, asserted_at: PAST }).triple_hash;
  e.setValidity(h, { valid_from: PAST, valid_to: T2021 });
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(h);
  // zu 2020 war es gültig, aber retracted → erscheint NICHT (konjunktiv zu active)
  assert.equal(e.resolveBelief('Xx', 'ist', { as_of: '2020-06-01T00:00:00Z' }), null);
});

test('AC-13.6: leeres Intervall / ungültiges ISO → Fehler; unbekannter Hash → null', () => {
  const e = new Engine();
  const h = e.storeTriple({ subject: 'Aa', predicate: 'ist', object: 'Bb', confidence: 700, asserted_at: PAST }).triple_hash;
  assert.throws(() => e.setValidity(h, { valid_from: T2023, valid_to: T2021 }), /INVALID_PARAMETER_FORMAT/); // to ≤ from
  assert.throws(() => e.setValidity(h, { valid_from: 'kein-datum' }), /INVALID_PARAMETER_FORMAT/);
  assert.equal(e.setValidity('sha256:gibtsnicht', { valid_to: T2023 }), null);
});

test('AC-13.7: Föderations-Parität — valid_* nicht im Wire, Signatur unverändert', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 900 });
  const sigBefore = e._getEdge(r.triple_hash).signature;
  e.setValidity(r.triple_hash, { valid_from: PAST, valid_to: T2023 });
  const wire = e.exportSince({}).find((w) => w.triple_hash === r.triple_hash);
  assert.ok(wire && !('valid_from' in wire) && !('valid_to' in wire)); // nicht im Wire
  assert.equal(e._getEdge(r.triple_hash).signature, sigBefore);        // Signatur unberührt
});

test('AC-13.11: supersedeTemporally — Mehrwert-Prädikat abgewiesen; existierender Hash idempotent', () => {
  const e = new Engine();
  assert.throws(() => e.supersedeTemporally({ subject: 'BundleX', predicate: 'hat_tag', object: 'php', as_of: T2023 }), /NOT_APPLICABLE/);
  e.storeTriple({ subject: 'Firma', predicate: 'ceo', object: 'Bob', confidence: 900, asserted_at: PAST });
  e.supersedeTemporally({ subject: 'Firma', predicate: 'ceo', object: 'Bob', as_of: T2023 }); // gleicher Hash
  assert.equal(e.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE predicate='ceo'").get().c, 1); // kein Duplikat
  assert.equal(e._getEdge(tripleHash('Firma', 'ceo', 'Bob')).valid_from, T2023);
});

test('AC-13.12: Zukunfts-valid_from erlaubt; erscheint erst ab valid_from', () => {
  const e = new Engine();
  const future = new Date(Date.now() + 30 * 86400000).toISOString();
  const h = e.storeTriple({ subject: 'Plan', predicate: 'startet', object: 'bald', confidence: 700 }).triple_hash;
  e.setValidity(h, { valid_from: future }); // kein Fehler (geplante Gültigkeit)
  assert.equal(e.query('Plan').edges.some((x) => x.object === 'bald'), false);            // jetzt noch nicht
  assert.equal(e.query('Plan', { as_of: new Date(Date.now() + 60 * 86400000).toISOString() }).edges.some((x) => x.object === 'bald'), true); // später
});
