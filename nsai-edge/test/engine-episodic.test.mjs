import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

// UC-EP (Slice #2) — episodisches Gedächtnis + Konsolidierung.

test('AC-10.1: recordEpisode persistiert + klemmt Zukunftsdatum', () => {
  const e = new Engine();
  const r = e.recordEpisode({ content: 'Nutzer sagte: Glatteis ist gefährlich', occurred_at: '2099-01-01T00:00:00Z' });
  assert.ok(r.episode_id);
  assert.ok(Date.parse(r.occurred_at) <= Date.now() + 1000); // geklemmt
});

test('AC-10.1: leerer/überlanger content → fail-closed (AC-10.12)', () => {
  const e = new Engine();
  assert.throws(() => e.recordEpisode({ content: '' }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.recordEpisode({ content: 'x'.repeat(8001) }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-10.2: storeTriple mit episode_id legt genau einen Link an; ohne keinen', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'Beobachtung' });
  const r = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 800, episode_id: ep.episode_id });
  assert.equal(r.episode_linked, true);
  const links = e.db.prepare('SELECT COUNT(*) c FROM episode_triples WHERE triple_hash=?').get(r.triple_hash).c;
  assert.equal(links, 1);
  e.storeTriple({ subject: 'Aa', predicate: 'ist', object: 'Bb' }); // ohne episode_id
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM episode_triples').get().c, 1);
});

test('AC-10.3: Konsolidierung inflationiert Konfidenz NICHT (N Episoden, kein Count-Boost)', () => {
  const e = new Engine();
  const h = tripleHash('Strasse', 'zustand', 'glatt');
  for (let i = 0; i < 3; i++) {
    const ep = e.recordEpisode({ content: `Beobachtung ${i}` });
    e.storeTriple({ subject: 'Strasse', predicate: 'zustand', object: 'glatt', confidence: 700, episode_id: ep.episode_id });
  }
  assert.equal(e._getEdge(h).confidence, 700);                 // kein Boost durch 3 Episoden
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM episode_triples WHERE triple_hash=?').get(h).c, 3); // aber 3 Links
});

test('AC-10.4: Recency-Refresh — episode_id-Re-Assert aktualisiert asserted_at', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Strasse', predicate: 'zustand', object: 'glatt', confidence: 700, asserted_at: '2020-01-01T00:00:00.000Z' });
  const h = tripleHash('Strasse', 'zustand', 'glatt');
  const before = e._getEdge(h).asserted_at;
  const ep = e.recordEpisode({ content: 'erneut beobachtet' });
  e.storeTriple({ subject: 'Strasse', predicate: 'zustand', object: 'glatt', confidence: 700, episode_id: ep.episode_id });
  const after = e._getEdge(h).asserted_at;
  assert.ok(Date.parse(after) > Date.parse(before)); // Recency frisch
  assert.equal(e._getEdge(h).confidence, 700);        // ohne Konfidenz-Boost
});

test('AC-10.5: recallEpisodes recency-geordnet + Filter + limit-Cap', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'alt', occurred_at: '2020-01-01T00:00:00Z', context_slug: 'projekt-x' });
  e.recordEpisode({ content: 'neu', occurred_at: '2026-05-01T00:00:00Z', context_slug: 'projekt-x' });
  e.recordEpisode({ content: 'anderer kontext', context_slug: 'projekt-y' });
  const r = e.recallEpisodes({ context_slug: 'projekt-x' });
  assert.equal(r.episodes.length, 2);
  assert.equal(r.episodes[0].content, 'neu'); // DESC
  const term = e.recallEpisodes({ term: 'anderer' });
  assert.equal(term.episodes.length, 1);
});

test('🟡-1: recall mit LIKE-Sonderzeichen (%/_/\\) matcht literal, kein Wildcard-Leak', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Rabatt 50% deal heute' });
  e.recordEpisode({ content: 'snake_case bezeichner' });
  e.recordEpisode({ content: 'nichts dergleichen' });
  assert.equal(e.recallEpisodes({ term: '50%' }).episodes.length, 1);   // literal % gefunden
  assert.equal(e.recallEpisodes({ term: 'snake_case' }).episodes.length, 1); // literal _ gefunden
  // '%' als Literal matcht nur das „50%"-Episode (1), NICHT alle 3 → kein Wildcard-Leak.
  assert.equal(e.recallEpisodes({ term: '%' }).episodes.length, 1);
});

test('AC-10.6/10.7: episodesForTriple status-unabhängig; Re-Assert reaktiviert retracted NICHT', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'Quelle' });
  const r = e.storeTriple({ subject: 'Faktum', predicate: 'ist', object: 'Wahr', confidence: 800, episode_id: ep.episode_id });
  // künstlich retracted setzen
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(r.triple_hash);
  const ep2 = e.recordEpisode({ content: 'erneut' });
  e.storeTriple({ subject: 'Faktum', predicate: 'ist', object: 'Wahr', confidence: 800, episode_id: ep2.episode_id });
  assert.equal(e._getEdge(r.triple_hash).local_status, 'retracted'); // KEINE Reaktivierung (#1b)
  const ef = e.episodesForTriple(r.triple_hash);
  assert.equal(ef.triple_status, 'retracted');
  assert.equal(ef.episodes.length, 2); // beide Links sichtbar (status-unabhängig)
});

test('AC-10.8/10.9: episodicGc + verwaiste Links; episodesForTriple crasht nicht bei fehlendem Tripel', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'x', occurred_at: '2000-01-01T00:00:00Z' });
  const r = e.storeTriple({ subject: 'Weg', predicate: 'ist', object: 'Alt', confidence: 600, episode_id: ep.episode_id });
  // Tripel "GC'd" simulieren → verwaister Link
  e.db.prepare('DELETE FROM knowledge_edges WHERE triple_hash=?').run(r.triple_hash);
  const ef = e.episodesForTriple(r.triple_hash); // darf nicht crashen
  assert.equal(ef.triple_status, null);
  const gc = e.episodicGc({ maxAgeDays: 30 });
  assert.ok(gc.episodesDeleted >= 1);            // alte Episode weg
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM episode_triples').get().c, 0); // Links weg (cascade + orphan)
});

test('AC-10.10: Föderations-Parität — Episoden nicht im Wire', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'lokal' });
  const r = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 800, episode_id: ep.episode_id });
  const wire = e.exportSince({});
  const w = wire.find((x) => x.triple_hash === r.triple_hash);
  assert.ok(w);
  assert.ok(!('episode_id' in w) && !('content' in w) && !('episodes' in w)); // keine Episoden-Daten im Wire
});

test('AC-10.12: nicht-existente episode_id → Tripel bleibt gültig, Link übersprungen', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Aa', predicate: 'ist', object: 'Bb', confidence: 700, episode_id: 'nicht-da' });
  assert.equal(r.created, true);
  assert.equal(r.episode_linked, false);
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM episode_triples').get().c, 0);
});
