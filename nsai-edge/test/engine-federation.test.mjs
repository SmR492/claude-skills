import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';
import { checkConformance } from '../src/conformance.mjs';

const fresh = () => new Engine();
// Loopback-Transport: bildet einen Peer als lokale Engine ab.
const link = (peer) => ({
  exportSince: (since) => peer.exportSince(since),
  receiveIngest: (batch, peerId) => peer.receiveIngest(batch, peerId),
});
// Registriert sich-gegenseitig kennende Peers.
function pair(trust = 'full') {
  const A = fresh();
  const B = fresh();
  A.peerAdd(B.peerId, B.identity.publicKeyPem);
  B.peerAdd(A.peerId, A.identity.publicKeyPem);
  if (trust !== 'untrusted') { A.peerTrust(B.peerId, trust); B.peerTrust(A.peerId, trust); }
  return { A, B };
}
function makeWire(s, p, o, confidence, vc, origin = 'peer:ext') {
  return {
    wire_version: 1, triple_hash: tripleHash(s, p, o),
    subject: s, predicate: p, object: o, confidence, temporality: 'stable',
    origin_peer_id: origin, vector_clock: vc, derived_from: null, signature: 'ed25519:x',
  };
}

// ---- UC-06 Pull / UC-07 Push -----------------------------------------
test('AC-6.1: Pull mergt nur signaturgeprüfte Tripel', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  const tally = B.pull(link(A), A.peerId);
  assert.equal(tally.accepted, 1);
  const edge = B._getEdge(tripleHash('Sensor', 'meldet', 'Glatteis'));
  assert.equal(edge.local_status, 'active');
});

test('AC-6.2: manipuliertes Tripel wird verworfen', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  const batch = A.exportSince({});
  batch[0].confidence = 1; // nach Signatur verändert → Signatur ungültig
  const res = B.receiveIngest(batch, A.peerId);
  assert.equal(res[0].status, 'rejected');
});

test('AC-7.1: Push ist inkrementell (zweiter Pull bringt nichts Neues)', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  B.pull(link(A), A.peerId);
  const second = B.pull(link(A), A.peerId);
  assert.equal(second.received, 0);
});

test('UC-07: Push überträgt lokale Fakten an den Peer', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Quelle', predicate: 'sagt', object: 'Wahr', confidence: 800 });
  const statuses = A.push(link(B), B.peerId);
  assert.ok(statuses.some((s) => s.status === 'accepted'));
  assert.ok(B._getEdge(tripleHash('Quelle', 'sagt', 'Wahr')));
});

// ---- UC-08 Merge (CRDT) ----------------------------------------------
test('AC-8.1/8.2: Merge ist kommutativ + idempotent (max)', () => {
  const x = fresh(); const y = fresh();
  const w1 = makeWire('Sx', 'pp', 'Oo', 600, { P1: 1 });
  const w2 = makeWire('Sx', 'pp', 'Oo', 800, { P2: 1 });
  x.mergeIncoming(w1, { peerTrust: 'full' }); x.mergeIncoming(w2, { peerTrust: 'full' });
  y.mergeIncoming(w2, { peerTrust: 'full' }); y.mergeIncoming(w1, { peerTrust: 'full' });
  y.mergeIncoming(w1, { peerTrust: 'full' }); // idempotent
  assert.equal(x._getEdge(w1.triple_hash).confidence, 800);
  assert.equal(y._getEdge(w1.triple_hash).confidence, 800);
});

test('AC-8.3: nebenläufiger gleicher Hash → keine Quarantäne', () => {
  const e = fresh();
  e.mergeIncoming(makeWire('Sx', 'pp', 'Oo', 600, { P1: 1 }), { peerTrust: 'full' });
  e.mergeIncoming(makeWire('Sx', 'pp', 'Oo', 700, { P2: 1 }), { peerTrust: 'full' });
  const edge = e._getEdge(tripleHash('Sx', 'pp', 'Oo'));
  assert.equal(edge.local_status, 'active');
  assert.equal(e.db.prepare("SELECT COUNT(*) c FROM knowledge_edges").get().c, 1);
});

test('AC-8.5: gemergter Föderationswert ist trust-unabhängig', () => {
  const full = fresh(); const limited = fresh();
  const w = makeWire('Sx', 'pp', 'Oo', 800, { P1: 1 });
  full.mergeIncoming(w, { peerTrust: 'full' });
  limited.mergeIncoming(w, { peerTrust: 'limited' });
  assert.equal(full._getEdge(w.triple_hash).confidence, limited._getEdge(w.triple_hash).confidence);
});

test('AC-8.6: Merge ist assoziativ (drei Werte, beliebige Reihenfolge → max)', () => {
  const order1 = fresh(); const order2 = fresh();
  const ws = [makeWire('Sx', 'pp', 'Oo', 300, { A: 1 }), makeWire('Sx', 'pp', 'Oo', 900, { B: 1 }), makeWire('Sx', 'pp', 'Oo', 500, { C: 1 })];
  for (const w of ws) order1.mergeIncoming(w, { peerTrust: 'full' });
  for (const w of [ws[2], ws[0], ws[1]]) order2.mergeIncoming(w, { peerTrust: 'full' });
  assert.equal(order1._getEdge(ws[0].triple_hash).confidence, 900);
  assert.equal(order2._getEdge(ws[0].triple_hash).confidence, 900);
});

test('AC-8.4/5.3: widersprüchliches Objekt → Quarantäne; authoritative gewinnt lokal', () => {
  const e = fresh();
  e.mergeIncoming(makeWire('Strasse', 'zustand', 'frei', 800, { P1: 1 }), { peerTrust: 'full' });
  e.mergeIncoming(makeWire('Strasse', 'zustand', 'gesperrt', 800, { P2: 1 }), { peerTrust: 'authoritative' });
  assert.equal(e._getEdge(tripleHash('Strasse', 'zustand', 'frei')).local_status, 'superseded');
  assert.equal(e._getEdge(tripleHash('Strasse', 'zustand', 'gesperrt')).local_status, 'active');
});

// ---- UC-09 Peer-Trust -------------------------------------------------
test('AC-9.1: untrusted-Peer → Fakten in Quarantäne', () => {
  const { A, B } = pair('untrusted');
  A.storeTriple({ subject: 'Fremd', predicate: 'sagt', object: 'Etwas', confidence: 900 });
  B.pull(link(A), A.peerId);
  assert.equal(B._getEdge(tripleHash('Fremd', 'sagt', 'Etwas')).local_status, 'quarantined');
});

test('AC-9.2: limited-Peer → Konfidenz-Abschlag in der Lese-Linse', () => {
  const { A, B } = pair('limited');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Wert', confidence: 800 });
  B.pull(link(A), A.peerId);
  const res = B.query('Sensor', { maxDepth: 1 });
  const edge = res.edges.find((x) => x.object === 'Wert');
  assert.equal(edge.confidence, 800);
  assert.equal(edge.effective_confidence, 400); // trunc(800*500/1000)
});

test('AC-9.3: Key-Rotation ersetzt Schlüssel ohne Datenverlust', () => {
  const B = fresh(); const A = fresh(); const A2 = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem);
  const fp = B.peerRotate(A.peerId, A2.identity.publicKeyPem);
  const peer = B._peer(A.peerId);
  assert.equal(peer.public_key, A2.identity.publicKeyPem);
  assert.equal(peer.fingerprint, fp);
});

test('AC-9.4: Revoke setzt gemergte Fakten des Peers auf Quarantäne', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Quelle', predicate: 'sagt', object: 'Xx', confidence: 900 });
  B.pull(link(A), A.peerId);
  assert.equal(B._getEdge(tripleHash('Quelle', 'sagt', 'Xx')).local_status, 'active');
  B.peerRevoke(A.peerId);
  assert.equal(B._getEdge(tripleHash('Quelle', 'sagt', 'Xx')).local_status, 'quarantined');
  assert.equal(B._peer(A.peerId).trust_level, 'untrusted');
});

// ---- UC-11 Clone ------------------------------------------------------
function seedPeerWith3() {
  const A = fresh();
  A.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'B1', confidence: 700 });
  A.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'B2', confidence: 700 });
  A.storeTriple({ subject: 'Cc', predicate: 'qq', object: 'D1', confidence: 700 });
  return A;
}
test('AC-11.1: Clone landet vollständig in Quarantäne (Default)', () => {
  const A = seedPeerWith3();
  const B = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  B.clone(link(A), A.peerId);
  assert.equal(B.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='quarantined'").get().c, 3);
  assert.equal(B.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='active'").get().c, 0);
});

test('AC-11.2: bulk_promote hebt ganzen Bestand auf active', () => {
  const A = seedPeerWith3();
  const B = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  B.clone(link(A), A.peerId, { bulkPromote: true });
  assert.equal(B.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='active'").get().c, 3);
});

test('AC-11.3: erneuter Clone ist idempotent (keine Dubletten)', () => {
  const A = seedPeerWith3();
  const B = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  B.clone(link(A), A.peerId);
  B.clone(link(A), A.peerId);
  assert.equal(B.db.prepare('SELECT COUNT(*) c FROM knowledge_edges').get().c, 3);
});

// ---- UC-10 Conformance (Node-Seite) ----------------------------------
test('AC-10.2: Conformance-Vektoren bestehen Node-seitig; PHP unverified ohne Runner', () => {
  const vectors = [
    {
      name: 'decay-temporal',
      input: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 800, temporality: 'temporal' }],
      op: 'decay',
      expected: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 750, status: 'active' }],
    },
    {
      name: 'infer-glaette',
      input: [
        { subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 900 },
        { subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900 },
      ],
      op: 'infer',
      expected: [{ subject: 'Fahrbahn', predicate: 'zustand', object: 'gefaehrlich', confidence: 810, status: 'active' }],
    },
  ];
  const r = checkConformance(vectors);
  assert.equal(r.allPass, true);
  assert.equal(r.phpVerified, false); // ohne PHP-Runner kein grünes Cross-Lang-Gate
});
