import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// UC-TA Slice #6.1 — Peer-Trust-Adjustment (Vorschlags-Modus, KEIN Auto-Apply).
// Reine Lese-Operation, deterministisch, Integer-Promille.

function addPeer(e, label, { trust = 'full' } = {}) {
  const peerId = `peer:ta-${label}`;
  e.db.prepare('INSERT OR IGNORE INTO peers (peer_id, public_key, fingerprint, endpoint, trust_level) VALUES (?,?,?,?,?)')
    .run(peerId, `pk-${label}`, `fp-${label}`, null, trust);
  return peerId;
}
// Hilfs-Funktion: erzeugt N Tripel von einem Peer, davon `rejected` durch EXPLICIT user-reject().
// Adversarial-Lehre: nur explicit user-reject zählt — direkte local_status-Mutation
// (System-Quarantäne, Decay) darf NICHT als Trust-Signal gezählt werden.
function makeTriples(e, peerId, total, rejected) {
  for (let i = 0; i < total; i++) {
    const r = e.storeTriple({ subject: `${peerId}-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    // origin_peer_id auf den Test-Peer umschreiben (storeTriple nimmt self als origin)
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=? WHERE triple_hash=?").run(peerId, r.triple_hash);
    if (i < rejected) e.reject(r.triple_hash); // explicit user-reject (setzt user_rejected_at)
  }
}

test('AC-20.1: Peer mit reject-Rate ≥ 800‰ → Vorschlag untrusted', () => {
  const e = new Engine();
  const p = addPeer(e, 'bad', { trust: 'full' });
  makeTriples(e, p, 10, 9); // 900‰
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions.length, 1);
  assert.equal(r.suggestions[0].peer_id, p);
  assert.equal(r.suggestions[0].suggested_level, 'untrusted');
  assert.equal(r.suggestions[0].reject_rate_promille, 900);
});

test('AC-20.2: Peer mit reject-Rate zwischen 500‰ und 800‰ → Vorschlag limited', () => {
  const e = new Engine();
  const p = addPeer(e, 'mid', { trust: 'full' });
  makeTriples(e, p, 10, 6); // 600‰
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions[0].suggested_level, 'limited');
  assert.equal(r.suggestions[0].reject_rate_promille, 600);
});

test('AC-20.3: Peer mit reject-Rate < 500‰ → kein Vorschlag', () => {
  const e = new Engine();
  const p = addPeer(e, 'good', { trust: 'full' });
  makeTriples(e, p, 10, 2); // 200‰
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions.length, 0);
});

test('AC-20.4: Peer mit total < min_evidence → kein Vorschlag (Sybil-Schutz)', () => {
  const e = new Engine();
  const p = addPeer(e, 'few', { trust: 'full' });
  makeTriples(e, p, 3, 3); // 100% rejected, aber nur 3 Aussagen
  const r = e.learnTrustAdjustments({}); // Default min_evidence=5
  assert.equal(r.suggestions.length, 0);
});

test('AC-20.5: authoritative-Peer → kein Vorschlag', () => {
  const e = new Engine();
  const p = addPeer(e, 'auth', { trust: 'authoritative' });
  makeTriples(e, p, 10, 9); // 900‰
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions.length, 0);
});

test('AC-20.6: Self-Peer wird übersprungen', () => {
  const e = new Engine();
  // Self-Tripel mit hoher reject-Rate
  for (let i = 0; i < 10; i++) {
    const t = e.storeTriple({ subject: `Self-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    if (i < 9) e.db.prepare("UPDATE knowledge_edges SET local_status='superseded' WHERE triple_hash=?").run(t.triple_hash);
  }
  const r = e.learnTrustAdjustments({});
  // self soll nicht in der Liste auftauchen
  assert.ok(!r.suggestions.some((s) => s.peer_id === e.peerId));
});

test('AC-20.7: KEIN Auto-Apply — peers.trust_level bleibt unverändert', () => {
  const e = new Engine();
  const p = addPeer(e, 'rejected', { trust: 'full' });
  makeTriples(e, p, 10, 9);
  e.learnTrustAdjustments({});
  const after = e._peer(p);
  assert.equal(after.trust_level, 'full', 'trust_level darf nicht verändert sein');
});

test('AC-20.8: Audit-Belege — bis 20 jüngste rejected triple_hashes, deterministisch sortiert', () => {
  const e = new Engine();
  const p = addPeer(e, 'audit', { trust: 'full' });
  makeTriples(e, p, 30, 25); // mehr als 20 rejects
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions[0].evidence.length, 20, 'max 20 Belege');
  // Belege haben triple_hash und local_status
  for (const ev of r.suggestions[0].evidence) {
    assert.ok(ev.triple_hash);
    assert.ok(['superseded', 'retracted', 'quarantined'].includes(ev.local_status));
  }
  // Determinismus: zweiter Aufruf identisches Ergebnis
  const r2 = e.learnTrustAdjustments({});
  assert.deepEqual(r.suggestions[0].evidence, r2.suggestions[0].evidence);
});

test('AC-20.9 + AC-20.10: Determinismus + Integer-Promille', () => {
  const e = new Engine();
  const p1 = addPeer(e, 'a', { trust: 'full' });
  const p2 = addPeer(e, 'b', { trust: 'full' });
  makeTriples(e, p1, 10, 9);
  makeTriples(e, p2, 10, 6);
  const a = e.learnTrustAdjustments({});
  const b = e.learnTrustAdjustments({});
  assert.deepEqual(a.suggestions.map((s) => s.peer_id), b.suggestions.map((s) => s.peer_id));
  for (const s of a.suggestions) {
    assert.ok(Number.isInteger(s.reject_rate_promille));
    assert.ok(s.reject_rate_promille >= 0 && s.reject_rate_promille <= 1000);
  }
});

test('AC-20.11: ungültiges since → INVALID_PARAMETER_FORMAT', () => {
  const e = new Engine();
  assert.throws(() => e.learnTrustAdjustments({ since: 'kein-datum' }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-20.11b: min_evidence < 1 → INVALID_PARAMETER_FORMAT', () => {
  const e = new Engine();
  assert.throws(() => e.learnTrustAdjustments({ min_evidence: 0 }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-20.13 (Adversarial 🔴-1): System-Quarantäne zählt NICHT als reject (Konfabulations-Schutz)', () => {
  const e = new Engine();
  const p = addPeer(e, 'sysquar', { trust: 'full' });
  // 10 Tripel mit system-quarantined (direkt im Status, KEIN explicit user-reject)
  for (let i = 0; i < 10; i++) {
    const r = e.storeTriple({ subject: `SQ-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=?, local_status='quarantined' WHERE triple_hash=?").run(p, r.triple_hash);
  }
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions.length, 0, 'System-Quarantäne darf KEINE Trust-Herabstufung vorschlagen — sonst wird ehrlicher Peer fälschlich heruntergestuft');
});

test('AC-20.14 (Adversarial 🔴-2): Decay-Supersede zählt NICHT als reject', () => {
  const e = new Engine();
  const p = addPeer(e, 'decayed', { trust: 'full' });
  // 10 Tripel via Decay superseded (direkter Status, kein reject())
  for (let i = 0; i < 10; i++) {
    const r = e.storeTriple({ subject: `D-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=?, local_status='superseded' WHERE triple_hash=?").run(p, r.triple_hash);
  }
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions.length, 0, 'Decay-Supersede darf NICHT als reject zählen — sonst wird Peer mit veralteten Aussagen fälschlich herabgestuft');
});

test('AC-20.13 + AC-20.14: gemischt — nur explicit reject() zählt zwischen 10 system-Aktionen', () => {
  const e = new Engine();
  const p = addPeer(e, 'mixed', { trust: 'full' });
  // 9 system-quarantined + 9 decay-superseded + 5 explicit user-rejected = 23 total, 5 echt rejected.
  for (let i = 0; i < 9; i++) {
    const r = e.storeTriple({ subject: `Q-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=?, local_status='quarantined' WHERE triple_hash=?").run(p, r.triple_hash);
  }
  for (let i = 0; i < 9; i++) {
    const r = e.storeTriple({ subject: `D-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=?, local_status='superseded' WHERE triple_hash=?").run(p, r.triple_hash);
  }
  for (let i = 0; i < 5; i++) {
    const r = e.storeTriple({ subject: `UR-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=? WHERE triple_hash=?").run(p, r.triple_hash);
    e.reject(r.triple_hash);
  }
  const r = e.learnTrustAdjustments({});
  // 23 total Aussagen, davon 5 explicit reject → 217‰ — unter 500‰-Schwelle → kein Vorschlag.
  assert.equal(r.suggestions.length, 0, '5/23 explicit reject = 217‰ < 500‰ → kein Vorschlag (die 18 system-Aktionen zählen NICHT)');
});

test('AC-20.15 (Adversarial 🟡-4): Peer nicht in peers-Tabelle → current_level: "unknown"', () => {
  const e = new Engine();
  // Tripel mit unbekanntem Origin-Peer (kein peers-Row)
  const unknownPeer = 'peer:unregistered-test';
  for (let i = 0; i < 10; i++) {
    const r = e.storeTriple({ subject: `Unk-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=? WHERE triple_hash=?").run(unknownPeer, r.triple_hash);
    e.reject(r.triple_hash);
  }
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions[0].current_level, 'unknown', 'nicht-registrierter Peer → current_level: "unknown"');
});

test('AC-20.16 (Re-Audit 🟡-B): promote() löscht user_rejected_at — Un-Reject', () => {
  // promote() prüft Origin-Signatur — wir testen mit Self-Tripeln (Self-Pubkey verfügbar).
  const e = new Engine();
  const hashes = [];
  for (let i = 0; i < 10; i++) {
    const r = e.storeTriple({ subject: `UnRej-S${i}`, predicate: 'ist', object: `O${i}`, confidence: 700 });
    hashes.push(r.triple_hash);
    if (i < 9) e.reject(r.triple_hash);
  }
  // Self-Peer wird im learnTrustAdjustments übersprungen (AC-20.6) — daher prüfen wir die
  // Reject-Spalten direkt, plus den Effekt von promote auf user_rejected_at.
  const rejectedBefore = e.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE user_rejected_at IS NOT NULL").get().c;
  assert.equal(rejectedBefore, 9);
  for (let i = 0; i < 9; i++) e.promote(hashes[i]);
  const rejectedAfter = e.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE user_rejected_at IS NOT NULL").get().c;
  assert.equal(rejectedAfter, 0, 'promote() löscht user_rejected_at — Un-Reject-Mechanik');
  // local_status zurück auf active
  const activeCount = e.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='active'").get().c;
  assert.equal(activeCount, 10);
});

test('AC-20.12: leeres Repo → leere suggestions', () => {
  const e = new Engine();
  const r = e.learnTrustAdjustments({});
  assert.deepEqual(r.suggestions, []);
});

test('Bias-Schutz: das System schreibt keinen Belief, suggested_level ≠ current_level', () => {
  // Auch wenn der Reject-Rate exakt die Schwelle trifft, ändert sich nichts am Peer.
  // Konsument MUSS aktiv peerTrust() rufen.
  const e = new Engine();
  const p = addPeer(e, 'demo', { trust: 'full' });
  makeTriples(e, p, 10, 5); // 500‰ → genau Schwelle limited
  const r = e.learnTrustAdjustments({});
  assert.equal(r.suggestions[0].suggested_level, 'limited');
  assert.notEqual(r.suggestions[0].suggested_level, r.suggestions[0].current_level);
  // peer_trust wurde NICHT applied
  assert.equal(e._peer(p).trust_level, 'full');
  // Manueller Apply funktioniert separat
  e.peerTrust(p, 'limited');
  assert.equal(e._peer(p).trust_level, 'limited');
});
