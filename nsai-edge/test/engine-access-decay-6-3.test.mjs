import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// UC-AD Slice #6.3 — Zugriffs-basiertes Decay / Spaced-Repetition.
// Recall-Bonus innerhalb recallProtectionDays; deterministisch, Integer-Promille.

test('AC-21.1: markRecalled([h]) setzt last_recalled_at (ISO-UTC-Z)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Recall-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  const before = e._getEdge(r.triple_hash).last_recalled_at;
  assert.equal(before, null);
  const out = e.markRecalled([r.triple_hash]);
  assert.equal(out.recalled, 1);
  const after = e._getEdge(r.triple_hash).last_recalled_at;
  assert.ok(after);
  assert.match(after, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, 'ISO-UTC-Z');
});

test('AC-21.2: unbekannte Hashes werden silent übersprungen', () => {
  const e = new Engine();
  const out = e.markRecalled(['sha256:gibts-nicht', 'sha256:auch-nicht']);
  assert.equal(out.recalled, 0);
  // Keine neuen Rows
  const cnt = e.db.prepare('SELECT COUNT(*) c FROM knowledge_edges').get().c;
  assert.equal(cnt, 0);
});

test('AC-21.3: recall-protected Tripel verliert nur decayPerPeriod/recallDecayDivisor (Integer-Div)', () => {
  const e = new Engine();
  // temporal: decayPerPeriod=50, divisor=2 → erwartete Reduktion = 25
  const r = e.storeTriple({ subject: 'TR-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  e.markRecalled([r.triple_hash]);
  e.decayPass();
  const after = e._getEdge(r.triple_hash);
  assert.equal(after.confidence, 800 - 25, 'recall-protected: nur halber Decay (25 statt 50)');
});

test('AC-21.4: nicht-recall-protected: voller Decay (unverändert wie vor #6.3)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'NR-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  // KEIN markRecalled
  e.decayPass();
  const after = e._getEdge(r.triple_hash);
  assert.equal(after.confidence, 800 - 50, 'voller Decay (50)');
});

test('AC-21.5: last_recalled_at = NULL → voller Decay', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'NL-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  assert.equal(e._getEdge(r.triple_hash).last_recalled_at, null);
  e.decayPass();
  assert.equal(e._getEdge(r.triple_hash).confidence, 800 - 50, 'NULL = voller Decay');
});

test('AC-21.6: recall älter als recallProtectionDays → voller Decay (Protection verfallen)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'EX-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  // last_recalled_at manuell auf 60 Tage in der Vergangenheit setzen (Protection = 30 Tage)
  const oldRecall = new Date(Date.now() - 60 * 86400000).toISOString();
  e.db.prepare("UPDATE knowledge_edges SET last_recalled_at=? WHERE triple_hash=?").run(oldRecall, r.triple_hash);
  e.decayPass();
  assert.equal(e._getEdge(r.triple_hash).confidence, 800 - 50, 'Protection verfallen → voller Decay');
});

test('AC-21.7: query/verify/resolveBelief schreiben NICHT in last_recalled_at (keine impliziten Side-Effects)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Side-S', predicate: 'ist', object: 'wahr', confidence: 800 });
  assert.equal(e._getEdge(r.triple_hash).last_recalled_at, null);
  // Read-Pfade aufrufen
  e.query('Side-S');
  e.verify({ subject: 'Side-S', predicate: 'ist', object: 'wahr' });
  e.resolveBelief('Side-S', 'ist');
  // last_recalled_at MUSS noch NULL sein
  assert.equal(e._getEdge(r.triple_hash).last_recalled_at, null, 'Read-Pfade dürfen last_recalled_at nicht mutieren');
});

test('AC-21.8: Wire-Vertrag — last_recalled_at taucht NICHT in _edgeToWire/exportSince', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Wire-S', predicate: 'ist', object: 'wahr', confidence: 800 });
  e.markRecalled([r.triple_hash]);
  const wire = e._edgeToWire(e._getEdge(r.triple_hash));
  assert.equal('last_recalled_at' in wire, false);
  const exp = e.exportSince({}).find((w) => w.triple_hash === r.triple_hash);
  assert.equal('last_recalled_at' in exp, false);
});

test('AC-21.9: Determinismus — gleicher Graph + gleiche _now() → identische Decay-Werte', () => {
  const build = () => {
    const e = new Engine();
    const r = e.storeTriple({ subject: 'Det-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
    e.markRecalled([r.triple_hash]);
    // _now() einfrieren
    const fixed = Date.parse('2026-06-01T00:00:00Z');
    e._now = () => fixed;
    e.decayPass();
    return e._getEdge(r.triple_hash).confidence;
  };
  assert.equal(build(), build());
});

test('AC-21.10: dryRun=true schreibt nichts auch bei recall-protection', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Dry-S', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  e.markRecalled([r.triple_hash]);
  const before = e._getEdge(r.triple_hash).confidence;
  e.decayPass({ dryRun: true });
  const after = e._getEdge(r.triple_hash).confidence;
  assert.equal(after, before, 'dryRun darf nichts schreiben');
});

test('AC-21.11: markRecalled([]) → no-op', () => {
  const e = new Engine();
  const out = e.markRecalled([]);
  assert.equal(out.recalled, 0);
});

test('AC-21.12 (Adversarial 🟡-1): markRecalled schreibt NUR auf active Edges', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Non-Active-S', predicate: 'ist', object: 'wahr', confidence: 800 });
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(r.triple_hash);
  const out = e.markRecalled([r.triple_hash]);
  assert.equal(out.recalled, 0, 'retracted Edge darf nicht recall-markiert werden');
  assert.equal(e._getEdge(r.triple_hash).last_recalled_at, null);
  // Auch quarantined und superseded
  for (const st of ['quarantined', 'superseded']) {
    e.db.prepare("UPDATE knowledge_edges SET local_status=? WHERE triple_hash=?").run(st, r.triple_hash);
    const out2 = e.markRecalled([r.triple_hash]);
    assert.equal(out2.recalled, 0, `${st} Edge darf nicht recall-markiert werden`);
  }
});

test('AC-21.13 (Adversarial 🟡-1): promote() setzt last_recalled_at = NULL zurück', () => {
  const e = new Engine();
  // Test mit Self-Tripel (promote() prüft Signatur)
  const r = e.storeTriple({ subject: 'Promote-AD', predicate: 'ist', object: 'wahr', confidence: 800 });
  e.markRecalled([r.triple_hash]);
  assert.ok(e._getEdge(r.triple_hash).last_recalled_at);
  // Quarantäne setzen + promote
  e.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE triple_hash=?").run(r.triple_hash);
  e.promote(r.triple_hash);
  assert.equal(e._getEdge(r.triple_hash).last_recalled_at, null, 'promote löscht last_recalled_at');
});

test('AC-21.14 (Adversarial 🟡-2): recallProtectionDays=0 deaktiviert Feature', () => {
  const e = new Engine({ spec: { ...e_defaultSpec(), recallProtectionDays: 0 } });
  const r = e.storeTriple({ subject: 'Zero-Prot', predicate: 'ist', object: 'wahr', confidence: 800, temporality: 'temporal' });
  e.markRecalled([r.triple_hash]);
  e.decayPass();
  assert.equal(e._getEdge(r.triple_hash).confidence, 800 - 50, 'recallProtectionDays=0 → voller Decay (Feature aus)');
});

function e_defaultSpec() {
  // Aktuelle Spec aus DEFAULT_SPEC clonen für Override
  return {
    decayPerPeriod: { eternal: 0, stable: 5, temporal: 50, ephemeral: 200 },
    deleteThreshold: 50,
    recallDecayDivisor: 2,
    sourceTier: { gesetz: 6, behoerde: 5, sensor: 4, fachquelle: 3, manual: 2, web: 1, llm: 0, inference: 0, default: 0 },
    trustTierCap: { untrusted: -1, limited: 1, full: 6, authoritative: 6 },
    trustFactor: { untrusted: 0, limited: 500, full: 1000, authoritative: 1000 },
    quarantineThreshold: 300,
    reinforceDelta: 50,
    recencyHalflifeDays: { eternal: Infinity, stable: 3650, temporal: 180, ephemeral: 30, default: 3650 },
    beliefSharpness: 3,
    contestedThreshold: 150,
    multiValuePredicates: [],
    inferenceRules: [],
  };
}

test('AC-21.15 (Adversarial 🟡-3): markRecalled mit > 200 Hashes → INVALID_PARAMETER_FORMAT', () => {
  const e = new Engine();
  const hashes = Array.from({ length: 201 }, (_, i) => `sha256:test-${i}`);
  assert.throws(() => e.markRecalled(hashes), /INVALID_PARAMETER_FORMAT/);
});

test('markRecalled idempotent — zweiter Aufruf aktualisiert Timestamp', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Idem-S', predicate: 'ist', object: 'wahr', confidence: 800 });
  e.markRecalled([r.triple_hash]);
  const first = e._getEdge(r.triple_hash).last_recalled_at;
  // Kurz warten und nochmal markieren (mock _now())
  e._now = () => Date.now() + 1000;
  e.markRecalled([r.triple_hash]);
  const second = e._getEdge(r.triple_hash).last_recalled_at;
  assert.notEqual(first, second, 'Re-markRecalled aktualisiert Timestamp');
});
