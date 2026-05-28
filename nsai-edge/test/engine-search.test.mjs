import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

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

test('🟡-3: trust-diskontiert — limited-Peer-Tripel rankt trotz höherer confidence nicht über full', () => {
  const e = new Engine();
  e.peerAdd('peer:lim', new Engine().identity.publicKeyPem); e.peerTrust('peer:lim', 'limited');
  e.storeTriple({ subject: 'Hub', predicate: 'zeigt', object: 'Voll', confidence: 600 });          // self=full → ×1.0 = 0.60
  const h = e.storeTriple({ subject: 'Hub', predicate: 'zeigt', object: 'Limit', confidence: 950 }).triple_hash;
  e.db.prepare("UPDATE knowledge_edges SET origin_peer_id='peer:lim' WHERE triple_hash=?").run(h); // limited → ×0.5 = 0.475
  const objs = e.search({ term: 'Hub' }).results.map((r) => r.object);
  assert.ok(objs.indexOf('Voll') < objs.indexOf('Limit')); // trotz 950 > 600 rankt Voll vorn
});

test('🟡-2: ungültige Parameter werden geklemmt (max_hops<=0 liefert trotzdem)', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta');
  assert.ok(e.search({ term: 'Alpha', max_hops: 0 }).results.length > 0);   // auf 1 geklemmt
  assert.ok(e.search({ term: 'Alpha', max_iter: -5, tol: 0 }).results.length > 0); // kein DoS/Crash
});

// Slice #5b — bi-temporale Lese-Linse auch im Hybrid-Retrieval (Konsistenz zu query/verify/resolveBelief).
test('AC-11.11 (Slice #5b): as_of filtert nicht-zu-T gültige Kanten aus dem Subgraphen', () => {
  const e = new Engine();
  // 2 Hops: Alpha → Beta (offen) → Gamma (nur 2023..2025 gültig)
  e.storeTriple({ subject: 'Alpha', predicate: 'verbindet', object: 'Beta', confidence: 800, asserted_at: '2019-01-01T00:00:00Z' });
  const h2 = e.storeTriple({ subject: 'Beta', predicate: 'verbindet', object: 'Gamma', confidence: 800, asserted_at: '2019-01-01T00:00:00Z' }).triple_hash;
  e.setValidity(h2, { valid_from: '2023-01-01T00:00:00Z', valid_to: '2025-01-01T00:00:00Z' });
  const now = e.search({ term: 'Alpha', max_hops: 3, as_of: '2026-05-01T00:00:00Z' }).results.map((r) => r.object);
  assert.ok(!now.includes('Gamma')); // 2026 > valid_to (2025) → Beta→Gamma raus, Gamma außer Reichweite
  const past = e.search({ term: 'Alpha', max_hops: 3, as_of: '2024-06-01T00:00:00Z' }).results.map((r) => r.object);
  assert.ok(past.includes('Gamma')); // 2024 im Intervall → drin
  const before = e.search({ term: 'Alpha', max_hops: 3, as_of: '2022-01-01T00:00:00Z' }).results.map((r) => r.object);
  assert.ok(!before.includes('Gamma')); // 2022 < valid_from → raus
});

test('AC-11.12 (Slice #5b): ungültiges as_of → INVALID_PARAMETER_FORMAT (fail-closed)', () => {
  const e = new Engine();
  chain(e, 'Alpha', 'Beta');
  assert.throws(() => e.search({ term: 'Alpha', as_of: 'kein-datum' }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-11.13 (Slice #5b): Lese-Linsen-Vertrag — keine zu T außerhalb-gültige Kante taucht in search auf (gleiche Klausel wie query/verify)', () => {
  // 🟡-B (Adversarial): kein objekt-Whitelist, sondern direkt der Linsen-Vertrag.
  // query (Tiefe 1) und search (k-Hop, LIKE-Seeds) haben unterschiedliche Topologie-Reichweite —
  // der echte Vertrag ist NICHT „search ⊆ query", sondern: search wendet die GLEICHE Validitäts-
  // Klausel an wie query/verify/resolveBelief. Wir verifizieren das, indem wir eine zu T außerhalb-
  // gültige Kante einbauen und prüfen, dass sie in KEINER Lese-Linse erscheint.
  const e = new Engine();
  const PAST = '2019-01-01T00:00:00Z';
  // Kette mit gestaffelten Intervallen, alle erreichbar von "Vertrag" aus.
  const triples = [
    { s: 'Vertrag', p: 'gilt', o: 'aktiv',  from: '2021-01-01T00:00:00Z', to: '2023-01-01T00:00:00Z' }, // ⤬ außerhalb T=2024
    { s: 'Vertrag', p: 'hat',  o: 'Anhang', from: '2020-01-01T00:00:00Z', to: '2030-01-01T00:00:00Z' }, // ✓ T drin
    { s: 'Vertrag', p: 'gilt', o: 'neu',    from: '2025-01-01T00:00:00Z', to: null },                   // ⤬ ab nach T
    { s: 'Vertrag', p: 'war',  o: 'alt',    from: PAST,                    to: '2020-01-01T00:00:00Z' }, // ⤬ vor T beendet
  ];
  const meta = new Map(); // hash → {outsideAtT}
  for (const t of triples) {
    const h = e.storeTriple({ subject: t.s, predicate: t.p, object: t.o, confidence: 800, asserted_at: PAST }).triple_hash;
    e.setValidity(h, { valid_from: t.from, valid_to: t.to });
    const fromT = Date.parse(t.from ?? PAST), toT = t.to ? Date.parse(t.to) : Infinity, atT = Date.parse('2024-06-01T00:00:00Z');
    meta.set(h, { outsideAtT: !(fromT <= atT && atT < toT) });
  }
  const T = '2024-06-01T00:00:00Z';
  const sHashes = new Set(e.search({ term: 'Vertrag', as_of: T, max_hops: 3 }).results.map((r) => r.triple_hash));
  // query liefert keine triple_hash-Spalte → über (s,p,o) rekonstruieren.
  const qHashes = new Set(e.query('Vertrag', { as_of: T }).edges.map((x) => tripleHash(x.subject, x.predicate, x.object)));
  // Der Linsen-Vertrag: keine zu T außerhalb-gültige Kante darf in einer Lese-Linse auftauchen.
  for (const [h, m] of meta) {
    if (m.outsideAtT) {
      assert.equal(sHashes.has(h), false, `search zeigt zu T außerhalb-gültige Kante ${h.slice(0, 16)}…`);
      assert.equal(qHashes.has(h), false, `query zeigt zu T außerhalb-gültige Kante ${h.slice(0, 16)}…`);
    }
  }
  // Sanity: die zu T gültige Kante MUSS in beiden Linsen sichtbar sein (sonst wäre das Setup defekt).
  const validHash = [...meta.entries()].find(([, m]) => !m.outsideAtT)[0];
  assert.ok(sHashes.has(validHash), 'gültige Kante fehlt in search — Setup-Fehler');
  assert.ok(qHashes.has(validHash), 'gültige Kante fehlt in query — Setup-Fehler');
});

test('AC-11.14 (Slice #5b 🟡-A): recallEpisodes respektiert as_of als obere Schranke (until=as_of)', () => {
  const e = new Engine();
  // recordEpisode lehnt Zukunfts-`occurred_at` ab (clampt auf jetzt) → wir setzen die Episoden
  // direkt mit definierten occurred_at-Werten, um die Linsen-Lücke deterministisch zu prüfen.
  const ts = (iso) => iso;
  e.recordEpisode({ content: 'Alpha frühe Notiz', occurred_at: '2009-06-01T00:00:00Z' });
  const future = e.recordEpisode({ content: 'Alpha sagt etwas Wichtiges' }); // jetzt
  e.db.prepare('UPDATE episodes SET occurred_at=? WHERE id=?').run('2030-01-01T00:00:00Z', future.episode_id);
  const past = e.search({ term: 'Alpha', as_of: ts('2010-01-01T00:00:00Z') });
  assert.equal(past.episodes.length, 1, 'nur die 2009er-Episode darf zu 2010 sichtbar sein');
  assert.equal(past.episodes[0].content, 'Alpha frühe Notiz');
  const now = e.search({ term: 'Alpha' }); // ohne as_of → alle
  assert.equal(now.episodes.length, 2);
});

test('AC-11.14b (Slice #5b 🟡-A): auch der „keine Seeds"-Frühausstieg filtert Episoden zu as_of', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'Zukunfts-Notiz mit Token Beta' });
  e.db.prepare('UPDATE episodes SET occurred_at=? WHERE id=?').run('2030-01-01T00:00:00Z', ep.episode_id);
  const r = e.search({ term: 'Beta', as_of: '2010-01-01T00:00:00Z' });
  assert.deepEqual(r.results, []); // keine Seeds (kein Knoten "Beta")
  assert.equal(r.episodes.length, 0); // Frühausstieg respektiert as_of → 2030er Episode raus
});
