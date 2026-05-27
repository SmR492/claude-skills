import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';
import { verifyTriple } from '../src/identity.mjs';

const fresh = () => new Engine();

// ---- UC-01: Erfassen --------------------------------------------------
test('AC-1.1: Tripel legt Knoten an und ist Ed25519-signiert', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 900 });
  assert.equal(r.created, true);
  const edge = e._getEdge(r.triple_hash);
  assert.ok(edge.signature.startsWith('ed25519:'));
  assert.ok(verifyTriple(e.identity.publicKeyPem, e._edgeToWire(edge), edge.signature));
});

test('AC-1.2: identischer triple_hash mergt Konfidenz statt Duplikat', () => {
  const e = fresh();
  const a = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 600 });
  const b = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 800 });
  assert.equal(b.created, false);
  assert.equal(b.confidence, 800); // max
  const count = e.db.prepare('SELECT COUNT(*) c FROM knowledge_edges WHERE triple_hash=?').get(a.triple_hash).c;
  assert.equal(count, 1);
});

test('AC-1.3: ungültiges Format bricht fail-closed ab', () => {
  const e = fresh();
  assert.throws(() => e.storeTriple({ subject: 'A', predicate: 'p', object: 'B' }), /INVALID_PARAMETER_FORMAT/); // subject zu kurz
  assert.throws(() => e.storeTriple({ subject: 'Aa', predicate: 'HAT GROSS', object: 'Bb' }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-1.4: Konfidenz außerhalb 0–1000 wird abgewiesen', () => {
  const e = fresh();
  assert.throws(() => e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 1500 }), /INVALID_PARAMETER_FORMAT/);
});

// ---- UC-02: Abfragen --------------------------------------------------
test('AC-2.1: Mehrebenen-Abfrage (Depth 2) liefert verbundene Kanten', () => {
  const e = fresh();
  e.storeTriple({ subject: 'ModuleA', predicate: 'depends_on', object: 'ModuleB', confidence: 900 });
  e.storeTriple({ subject: 'ModuleB', predicate: 'depends_on', object: 'ModuleC', confidence: 900 });
  const res = e.query('ModuleA', { maxDepth: 2 });
  assert.equal(res.edges.length, 2);
  assert.ok(res.edges.some((x) => x.object === 'ModuleC'));
  assert.equal(res.edges[0].effective_confidence, 900); // eigenes Wissen = voll
});

test('AC-2.2: >25 Pfade werden gekappt + truncated markiert', () => {
  const e = fresh();
  for (let i = 0; i < 26; i++) e.storeTriple({ subject: 'Hub', predicate: 'links_to', object: `Obj${i}`, confidence: 500 });
  const res = e.query('Hub', { maxDepth: 1 });
  assert.equal(res.truncated, true);
  assert.equal(res.edges.length, 25);
});

test('AC-2.3: Zyklus führt nicht zur Endlosschleife', () => {
  const e = fresh();
  e.storeTriple({ subject: 'NodeA', predicate: 'depends_on', object: 'NodeB', confidence: 900 });
  e.storeTriple({ subject: 'NodeB', predicate: 'depends_on', object: 'NodeA', confidence: 900 });
  const res = e.query('NodeA', { maxDepth: 3 });
  assert.ok(res.edges.length >= 1);
});

// ---- UC-03: Inferenz --------------------------------------------------
test('AC-3.1: ForwardChaining leitet erwarteten Fakt ab', () => {
  const e = fresh();
  e.storeTriple({ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 900 });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900 });
  const r = e.infer();
  assert.equal(r.created, 1);
  const hash = tripleHash('Fahrbahn', 'zustand', 'gefaehrlich');
  const edge = e._getEdge(hash);
  assert.equal(edge.confidence, 810); // trunc(900*900/1000)
  assert.equal(edge.local_status, 'active');
});

test('AC-3.2: abgeleitete Konfidenz unter Schwelle → Quarantäne', () => {
  const e = fresh();
  e.storeTriple({ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 300 });
  e.storeTriple({ subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 300 });
  e.infer();
  const edge = e._getEdge(tripleHash('Fahrbahn', 'zustand', 'gefaehrlich'));
  assert.equal(edge.confidence, 270); // trunc(300*900/1000) < 300
  assert.equal(edge.local_status, 'quarantined');
});

// ---- UC-04: Decay & Reinforcement ------------------------------------
test('AC-4.1: temporal-Fakt verliert Promille gemäß Tabelle', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 800, temporality: 'temporal' });
  e.decayPass();
  assert.equal(e._getEdge(r.triple_hash).confidence, 750); // 800 - 50
});

test('AC-4.2: eternal-Fakt bleibt unverändert', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Pi', predicate: 'ist', object: 'Konstante', confidence: 1000, temporality: 'eternal' });
  e.decayPass();
  assert.equal(e._getEdge(r.triple_hash).confidence, 1000);
});

test('Decay unter Lösch-Schwelle → superseded', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Buzz', predicate: 'ist', object: 'kurz', confidence: 60, temporality: 'ephemeral' });
  e.decayPass();
  assert.equal(e._getEdge(r.triple_hash).local_status, 'superseded');
});

test('AC-4.4: Reinforcement addiert Delta mit Deckel 1000', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Oft', predicate: 'genutzt', object: 'Fakt', confidence: 980 });
  assert.equal(e.reinforce(r.triple_hash), 1000); // 980+50 gedeckelt
});

// ---- UC-05: Quarantäne ------------------------------------------------
test('AC-5.2: Promote eines ungültig signierten Fakts wird blockiert', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Xx', predicate: 'pp', object: 'Yy', confidence: 200 });
  e.db.prepare("UPDATE knowledge_edges SET local_status='quarantined', signature='ed25519:AAAA' WHERE triple_hash=?").run(r.triple_hash);
  assert.throws(() => e.promote(r.triple_hash), /UNVERIFIED_ORIGIN/);
});

// ---- Multi-Wert-Prädikate (set-valued, kein Widerspruch) -------------
test('Multi-Wert-Prädikat hat_tag: mehrere Objekte gleichzeitig gültig, kein disputed', () => {
  const e = fresh();
  e.storeTriple({ subject: 'BundleX', predicate: 'hat_tag', object: 'symfony', confidence: 900 });
  e.storeTriple({ subject: 'BundleX', predicate: 'hat_tag', object: 'auth_lib', confidence: 900 });
  const r = e.resolveBelief('BundleX', 'hat_tag');
  assert.equal(r.multiValue, true);
  assert.equal(r.candidates.length, 2);
  assert.ok(r.candidates.every((c) => c.belief === 1000)); // beide voll gültig
  assert.ok(e.query('BundleX', { maxDepth: 1 }).edges.every((x) => x.disputed === undefined));
});

// ---- GC (§8.4) -------------------------------------------------------
test('GC entfernt alte superseded-Tombstones + Waisen-Knoten', () => {
  const e = fresh();
  const r = e.storeTriple({ subject: 'Alt', predicate: 'ist', object: 'Weg', confidence: 600 });
  e.db.prepare("UPDATE knowledge_edges SET local_status='superseded', updated_at='2000-01-01 00:00:00' WHERE triple_hash=?").run(r.triple_hash);
  const res = e.gc({ maxAgeDays: 30 });
  assert.equal(res.edgesDeleted, 1);
  assert.equal(e._getEdge(r.triple_hash), undefined);
  assert.ok(res.nodesDeleted >= 2); // Alt + Weg verwaist
});
