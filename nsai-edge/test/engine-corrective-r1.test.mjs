import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// UC-CR Slice #R1 — Corrective Retrieval (Hint-Modell, kein Verdikt-Hochheben).
// Adversarial-Lehre: Stufe 2 ÄNDERT VERDIKT NIE — sonst Substring-Match-Konfabulation
// und Cross-Subject-Tag-Leak. Stattdessen `corrective_hints[]` als Diagnose-Hinweise.

function addPeer(e, label, { trust = 'authoritative', cluster = null } = {}) {
  const peerId = `peer:cr-${label}`;
  e.db.prepare('INSERT OR IGNORE INTO peers (peer_id, public_key, fingerprint, endpoint, trust_level, cluster_id) VALUES (?,?,?,?,?,?)')
    .run(peerId, `pk-${label}`, `fp-${label}`, null, trust, cluster);
  return peerId;
}
function pushE(e, hash, peerId, { source_type = 'behoerde', confidence = 800, asserted_at = '2026-01-01T00:00:00Z' } = {}) {
  e.db.prepare('INSERT OR IGNORE INTO triple_endorsements (triple_hash, origin_peer_id, source_type, asserted_confidence, asserted_at, asserted_at_norm, signature) VALUES (?,?,?,?,?,?,?)')
    .run(hash, peerId, source_type, confidence, asserted_at, asserted_at, 'sig-stub');
}

test('AC-16.1 + AC-16.7 (Open-World absolut): Stufe-2 ändert das Verdikt NIE — unknown bleibt unknown', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'A-CR', predicate: 'relates_to', object: 'B-CR', confidence: 700 });
  const r = e.storeTriple({ subject: 'B-CR', predicate: 'hat_attribut', object: 'kritisch', confidence: 700 });
  pushE(e, r.triple_hash, addPeer(e, 'b1', { trust: 'authoritative', cluster: 'cl-b' }), { source_type: 'gesetz' });
  // A-CR ist relates_to B-CR, B-CR hat_attribut kritisch (Quorum). Verify A-CR hat_attribut kritisch.
  // Stufe 2 darf NICHT supported sagen — A-CR ist nicht B-CR.
  const v = e.verify({ subject: 'A-CR', predicate: 'hat_attribut', object: 'kritisch' });
  assert.equal(v.verdict, 'unknown');
  // Stattdessen wird ein Hint geliefert
  assert.ok(Array.isArray(v.corrective_hints));
  assert.equal(v.corrective_hints[0].via_subject, 'B-CR');
});

test('AC-16.2 + AC-16.4: corrective_hints[] sammelt verwandte supported-Tripel im 2-Hop-Subgraph', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Sub-CR', predicate: 'relates_to', object: 'Real-CR', confidence: 700 });
  const r = e.storeTriple({ subject: 'Real-CR', predicate: 'gilt', object: 'final', confidence: 700 });
  pushE(e, r.triple_hash, addPeer(e, 'd1', { trust: 'authoritative', cluster: 'cl' }), { source_type: 'gesetz' });
  const v = e.verify({ subject: 'Sub-CR', predicate: 'gilt', object: 'final' });
  assert.equal(v.verdict, 'unknown');
  assert.equal(v.corrective_hints.length, 1);
  assert.equal(v.corrective_hints[0].via_subject, 'Real-CR');
});

test('AC-16.5 (Substring-Match-Schutz, Adversarial 🔴-1): Subject existiert nicht exakt → KEIN Substring-Rescue', () => {
  const e = new Engine();
  // FAKE-KI-VO existiert mit Quorum-Endorsement; die Anfrage gilt aber dem nicht existenten "KI-VO".
  const r = e.storeTriple({ subject: 'FAKE-KI-VO', predicate: 'verpflichtet_zu', object: 'KI-Manipulation', confidence: 700 });
  pushE(e, r.triple_hash, addPeer(e, 'fake', { trust: 'authoritative', cluster: 'cl' }), { source_type: 'gesetz' });
  // KI-VO ist KEIN Knoten — Stufe 2 darf KEIN supported via Substring-Match liefern.
  const v = e.verify({ subject: 'KI-VO', predicate: 'verpflichtet_zu', object: 'KI-Manipulation' });
  assert.equal(v.verdict, 'unknown');
  assert.equal(v.corrective, undefined);
  assert.equal(v.corrective_hints, undefined, 'kein LIKE-Match darf hints produzieren');
});

test('AC-16.7 (kein Subgraph-Match): das (predicate, object) existiert nicht im erreichbaren Subgraph → unknown ohne hints', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'X-CR', predicate: 'relates_to', object: 'Y-CR', confidence: 700 });
  e.storeTriple({ subject: 'Y-CR', predicate: 'andere_prop', object: 'andere_obj', confidence: 700 });
  const v = e.verify({ subject: 'X-CR', predicate: 'gesuchte_prop', object: 'gesuchtes_obj' });
  assert.equal(v.verdict, 'unknown');
  assert.equal(v.corrective_hints, undefined);
});

test('AC-16.7 (kein Quorum): Tripel existiert im Subgraph, aber NICHT quorum-supported → kein Hint', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'P-CR', predicate: 'relates_to', object: 'Q-CR', confidence: 700 });
  e.storeTriple({ subject: 'Q-CR', predicate: 'gilt', object: 'wert', confidence: 700 }); // KEIN Endorsement
  const v = e.verify({ subject: 'P-CR', predicate: 'gilt', object: 'wert' });
  assert.equal(v.verdict, 'unknown');
  assert.equal(v.corrective_hints, undefined, 'nicht-supported-Tripel dürfen kein Hint sein');
});

test('AC-16.6: Determinismus — gleicher Graph + Anfrage → gleicher Output unabhängig von Insert-Reihenfolge', () => {
  const build = (insertOrder) => {
    const e = new Engine();
    for (const t of insertOrder) {
      if (t === 'a') e.storeTriple({ subject: 'S-CR', predicate: 'relates_to', object: 'R-CR', confidence: 700 });
      if (t === 'b') {
        const r = e.storeTriple({ subject: 'R-CR', predicate: 'gilt', object: 'fest', confidence: 700 });
        pushE(e, r.triple_hash, addPeer(e, 'd1', { trust: 'authoritative', cluster: 'cl' }), { source_type: 'gesetz' });
      }
    }
    return e.verify({ subject: 'S-CR', predicate: 'gilt', object: 'fest' });
  };
  const va = build(['a', 'b']);
  const vb = build(['b', 'a']);
  assert.deepEqual({ v: va.verdict, h: va.corrective_hints?.map((x) => x.via_subject) }, { v: vb.verdict, h: vb.corrective_hints?.map((x) => x.via_subject) });
});

test('AC-16.9 (Cross-Subject-Tag-Leak-Schutz, Adversarial 🔴-2): multiValue → Stufe 2 deaktiviert', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Doc-A-CR', predicate: 'relates_to', object: 'Doc-B-CR', confidence: 700 });
  const tag = e.storeTriple({ subject: 'Doc-B-CR', predicate: 'hat_tag', object: 'blau', confidence: 700 });
  pushE(e, tag.triple_hash, addPeer(e, 't1', { trust: 'authoritative', cluster: 'cl' }), { source_type: 'behoerde' });
  // Doc-A-CR hat_tag blau — falsch zu sagen, dass Doc-A "blau" hat (das ist Doc-B). Verdikt unknown, KEIN Hint-Leak.
  const v = e.verify({ subject: 'Doc-A-CR', predicate: 'hat_tag', object: 'blau' });
  assert.equal(v.verdict, 'unknown');
  assert.equal(v.multiValue, true);
  assert.equal(v.corrective_hints, undefined, 'multiValue-Hints würden Cross-Subject-Tag-Leak ermöglichen');
});

test('AC-16.10: UC-BT-Verträglichkeit — Stufe 2 respektiert as_of', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'XX-CR', predicate: 'relates_to', object: 'YY-CR', confidence: 700, asserted_at: '2019-01-01T00:00:00Z' });
  const r = e.storeTriple({ subject: 'YY-CR', predicate: 'gilt', object: 'neu', confidence: 700, asserted_at: '2019-01-01T00:00:00Z' });
  pushE(e, r.triple_hash, addPeer(e, 't1', { trust: 'authoritative', cluster: 'cl' }), { source_type: 'gesetz', asserted_at: '2030-01-01T00:00:00Z' });
  // as_of=jetzt: 2030-Endorsement zählt nicht → Hint NICHT geliefert
  const vNow = e.verify({ subject: 'XX-CR', predicate: 'gilt', object: 'neu', as_of: '2026-05-01T00:00:00Z' });
  assert.equal(vNow.verdict, 'unknown');
  assert.equal(vNow.corrective_hints, undefined, 'Zukunfts-Endorsement darf für 2026-Anfrage kein Hint sein');
});

test('AC-16.3: keine PPR/search-Calls — Stufe 2 läuft über simple BFS-Adjazenz', () => {
  // Smoke-Test: 100 Edges, viele verify-Aufrufe — kein DoS-Risiko (Adversarial 🟡-3)
  const e = new Engine();
  for (let i = 0; i < 100; i++) e.storeTriple({ subject: `N${i}`, predicate: 'verbindet', object: `N${i + 1}`, confidence: 700 });
  const t0 = Date.now();
  for (let i = 0; i < 50; i++) e.verify({ subject: `N${i}`, predicate: 'gilt', object: 'xx' });
  const dt = Date.now() - t0;
  assert.ok(dt < 1000, `50 verify-Calls sollten < 1s sein, war ${dt}ms (regress: kein PPR/search)`);
});

test('AC-16.4: Verdikt-supported (Stufe 1) → kein corrective_searched (Stufe 2 wird nicht angefasst)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'OK-CR', predicate: 'ist', object: 'aktiv', confidence: 900 });
  const v = e.verify({ subject: 'OK-CR', predicate: 'ist', object: 'aktiv' });
  assert.equal(v.verdict, 'supported');
  assert.equal(v.corrective_searched, undefined);
  assert.equal(v.corrective_hints, undefined);
});
