import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, EngineError } from '../src/engine.mjs';

// R10 — Performance-Härtung: Indizes auf normalisierten Lese-Pfaden + DoS-Cap auf search.term.
// Read-only-Sanity-Tests, kein TX-Verhalten.

function indexes(engine) {
  return engine.db.prepare("SELECT name FROM sqlite_master WHERE type='index'").all().map((r) => r.name);
}

test('AC-R10.1: Index idx_edges_asserted_norm existiert (UC-BT as_of/since/until Performance)', () => {
  const e = new Engine();
  assert.ok(indexes(e).includes('idx_edges_asserted_norm'));
});

test('AC-R10.2: Index idx_edges_user_rejected_at existiert (UC-TA learnTrustAdjustments)', () => {
  const e = new Engine();
  assert.ok(indexes(e).includes('idx_edges_user_rejected_at'));
});

test('AC-R10.3: Index idx_edges_last_recalled_at existiert (UC-AD Recall-Bonus in decayPass)', () => {
  const e = new Engine();
  assert.ok(indexes(e).includes('idx_edges_last_recalled_at'));
});

test('AC-R10.4: Index idx_episodes_occurred_norm existiert (UC-EP since/until Filter)', () => {
  const e = new Engine();
  assert.ok(indexes(e).includes('idx_episodes_occurred_norm'));
});

test('AC-R10.5: search.term > 256 Zeichen → INVALID_PARAMETER_FORMAT (DoS-Cap)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800 });
  const longTerm = 'x'.repeat(257);
  assert.throws(() => e.search({ term: longTerm }), (err) => err instanceof EngineError && err.code === 'INVALID_PARAMETER_FORMAT');
});

test('AC-R10.6: search.term = 256 Zeichen ist erlaubt (Cap-Grenze inklusiv)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800 });
  const term = 'x'.repeat(256);
  // Soll nicht throwen — wir kontrollieren nur fail-closed-Schwelle.
  const r = e.search({ term });
  assert.equal(r.truncated, false);
});

test('AC-R10.7: search.term < 2 Zeichen (nach trim) liefert leeres Ergebnis (Bestand)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800 });
  const r = e.search({ term: '   x  ' });
  assert.equal(r.results.length, 0);
});

test('AC-R10.8: Indizes überleben einen Engine-Neuaufsatz auf derselben DB (Idempotenz)', () => {
  const e1 = new Engine();
  const idx1 = indexes(e1).filter((n) => n.startsWith('idx_edges_')).sort();
  // Zweiter Engine-Konstruktor müsste die CREATE-IF-NOT-EXISTS idempotent durchlaufen — kein Drift.
  const e2 = new Engine();
  const idx2 = indexes(e2).filter((n) => n.startsWith('idx_edges_')).sort();
  assert.deepEqual(idx1, idx2);
});
