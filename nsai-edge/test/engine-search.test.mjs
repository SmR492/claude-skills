import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// UC-HR (Slice #3) — Hybrid-Retrieval: lexikalische Seeds + Personalized PageRank.

const chain = (e, ...names) => {
  for (let i = 0; i < names.length - 1; i++) {
    e.storeTriple({ subject: names[i], predicate: 'verbindet', object: names[i + 1], confidence: 800 });
  }
};

test('AC-11.1: findet Multi-Hop-Tripel, das eine Tiefe-1-query nicht liefert', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta', 'Gamma');
  const objs = e.search({ term: 'Alpha', max_hops: 3 }).results.map((r) => r.object);
  assert.ok(objs.includes('Gamma')); // über 2 Hops gefunden
  const q1 = e.query('Alpha', { maxDepth: 1 }).edges.map((x) => x.object);
  assert.ok(!q1.includes('Gamma')); // Tiefe-1 sieht Gamma nicht
});

test('AC-11.2: keine Seeds → leeres Ergebnis (kein Crash)', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta');
  const r = e.search({ term: 'Nichtvorhanden' });
  assert.deepEqual(r.results, []);
  assert.equal(r.seeds.length, 0);
});

test('AC-11.3: Konfidenz-Gewichtung — höher-konfidentes Nachbar-Tripel rankt vorn', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Hub', predicate: 'zeigt', object: 'Stark', confidence: 950 });
  e.storeTriple({ subject: 'Hub', predicate: 'zeigt', object: 'Schwach', confidence: 200 });
  const res = e.search({ term: 'Hub' }).results.filter((r) => r.source === 'graph' || r.source === 'lexical');
  const stark = res.findIndex((r) => r.object === 'Stark');
  const schwach = res.findIndex((r) => r.object === 'Schwach');
  assert.ok(stark >= 0 && schwach >= 0 && stark < schwach);
});

test('AC-11.4: Determinismus — umgekehrte Insert-Reihenfolge → identisches Ranking', () => {
  const a = new Engine(); chain(a, 'Alpha', 'Beta', 'Gamma', 'Delta');
  const b = new Engine();
  // gleiche Tripel, umgekehrt eingefügt
  b.storeTriple({ subject: 'Gamma', predicate: 'verbindet', object: 'Delta', confidence: 800 });
  b.storeTriple({ subject: 'Beta', predicate: 'verbindet', object: 'Gamma', confidence: 800 });
  b.storeTriple({ subject: 'Alpha', predicate: 'verbindet', object: 'Beta', confidence: 800 });
  const ra = a.search({ term: 'Alpha' }).results.map((r) => r.triple_hash);
  const rb = b.search({ term: 'Alpha' }).results.map((r) => r.triple_hash);
  assert.deepEqual(ra, rb);
});

test('AC-11.5/11.10: Konvergenz-Flag + max_iter ohne Konvergenz liefert trotzdem', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta', 'Gamma');
  assert.equal(e.search({ term: 'Alpha' }).converged, true); // Defaults max_iter=100/tol=1e-6 konvergieren
  const r1 = e.search({ term: 'Alpha', max_iter: 1, tol: 1e-12 });
  assert.equal(r1.converged, false);     // bei 1 Iteration nicht konvergiert
  assert.ok(r1.results.length > 0);      // Ergebnis trotzdem geliefert
});

test('AC-11.6: nur active — retracted/superseded weder Seed noch im Ergebnis', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta', 'Gamma');
  const h = e.storeTriple({ subject: 'Beta', predicate: 'verbindet', object: 'Gamma', confidence: 800 }).triple_hash;
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(h);
  const objs = e.search({ term: 'Alpha' }).results.map((r) => r.object);
  assert.ok(!objs.includes('Gamma')); // retractete Kante fällt raus
});

test('AC-11.7: limit hart bei 50 gekappt + truncated', () => {
  const e = new Engine();
  for (let i = 0; i < 60; i++) e.storeTriple({ subject: 'Hub', predicate: 'hat', object: `Objekt${i}`, confidence: 500 });
  const r = e.search({ term: 'Hub', limit: 1000 });
  assert.equal(r.results.length, 50);
  assert.equal(r.truncated, true);
});

test('AC-11.8: read-only — keine Konfidenz-/Status-/VC-Änderung', () => {
  const e = new Engine();
  const h = e.storeTriple({ subject: 'Alpha', predicate: 'verbindet', object: 'Beta', confidence: 800 }).triple_hash;
  const before = e._getEdge(h);
  e.search({ term: 'Alpha' });
  const after = e._getEdge(h);
  assert.equal(after.confidence, before.confidence);
  assert.equal(after.local_status, before.local_status);
  assert.equal(after.vector_clock, before.vector_clock);
});

test('AC-11.9: k-Hop-Schranke — Tripel jenseits max_hops nicht im Ergebnis', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta', 'Gamma', 'Delta');
  const objs = e.search({ term: 'Alpha', max_hops: 1 }).results.map((r) => r.object);
  assert.ok(objs.includes('Beta'));
  assert.ok(!objs.includes('Gamma')); // 2 Hops weg, außerhalb max_hops=1
});

test('AC-11.2/EP: LIKE-Sonderzeichen im term literal; Episoden im Hybrid-Ergebnis', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Rate_50', predicate: 'ist', object: 'hoch', confidence: 700 });
  e.recordEpisode({ content: 'Notiz zu Rate_50' });
  const r = e.search({ term: 'Rate_50' });
  assert.ok(r.seeds.includes('Rate_50'));      // literal _ gematcht
  assert.equal(r.episodes.length, 1);          // Episoden-Recall im Hybrid
});
