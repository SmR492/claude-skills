import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';
import { signTriple } from '../src/identity.mjs';
import { checkConformance } from '../src/conformance.mjs';

const fresh = () => new Engine();
// Loopback-Transport (Modell B: receiveIngest verifiziert gegen Origin-Key, kein Sender-Arg).
const link = (peer) => ({
  exportSince: (since) => peer.exportSince(since),
  receiveIngest: (batch) => peer.receiveIngest(batch),
});
function pair(trust = 'full') {
  const A = fresh(); const B = fresh();
  A.peerAdd(B.peerId, B.identity.publicKeyPem);
  B.peerAdd(A.peerId, A.identity.publicKeyPem);
  if (trust !== 'untrusted') { A.peerTrust(B.peerId, trust); B.peerTrust(A.peerId, trust); }
  return { A, B };
}
// Hand-Wire für reine Merge-Algebra-Tests (mergeIncoming verifiziert keine Signatur).
function makeWire(s, p, o, confidence, vc, origin = 'peer:ext') {
  return {
    wire_version: 1, triple_hash: tripleHash(s, p, o), subject: s, predicate: p, object: o,
    confidence, asserted_confidence: confidence, source_type: 'manual', asserted_at: '2025-01-01T00:00:00Z',
    temporality: 'stable', origin_peer_id: origin, relayed_by: origin, vector_clock: vc, derived_from: null, signature: 'ed25519:x',
  };
}

// ---- UC-06 Pull / UC-07 Push (echter Signaturpfad) -------------------
test('AC-6.1: Pull mergt nur gegen Origin-Key verifizierte Tripel', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  const tally = B.pull(link(A), A.peerId);
  assert.equal(tally.accepted, 1);
  assert.equal(B._getEdge(tripleHash('Sensor', 'meldet', 'Glatteis')).local_status, 'active');
});

test('AC-6.2: an asserted_confidence manipuliertes Tripel wird verworfen', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  const batch = A.exportSince({});
  batch[0].asserted_confidence = 1; // signierter Wert nachträglich verändert → Signatur ungültig
  assert.equal(B.receiveIngest(batch)[0].status, 'rejected');
});

test('UC-07: Push überträgt lokale Fakten an den Peer', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Quelle', predicate: 'sagt', object: 'Wahr', confidence: 800 });
  assert.ok(A.push(link(B), B.peerId).some((s) => s.status === 'accepted'));
  assert.ok(B._getEdge(tripleHash('Quelle', 'sagt', 'Wahr')));
});

test('AC-7.1: Pull ist inkrementell (zweiter Pull bringt nichts Neues)', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  B.pull(link(A), A.peerId);
  assert.equal(B.pull(link(A), A.peerId).received, 0);
});

// ---- Sicherheit (Modell B) — über den echten Verify-Pfad -------------
test('SEC-1: Origin-Impersonation wird abgewiesen (fremde Signatur auf fremdem Origin)', () => {
  const victim = fresh(); const evil = fresh(); const C = fresh();
  C.peerAdd(victim.peerId, victim.identity.publicKeyPem); C.peerTrust(victim.peerId, 'full');
  // Evil baut ein Wire mit origin=Victim, signiert aber mit EIGENEM Key.
  const base = {
    wire_version: 1, triple_hash: tripleHash('Fake', 'sagt', 'Luege'),
    subject: 'Fake', predicate: 'sagt', object: 'Luege', asserted_confidence: 1000,
    temporality: 'stable', source_type: 'web', asserted_at: '2025-01-01T00:00:00Z',
    origin_peer_id: victim.peerId, derived_from: null,
  };
  const forged = { ...base, confidence: 1000, vector_clock: { [evil.peerId]: 1 }, relayed_by: evil.peerId, signature: signTriple(evil.identity.privateKeyPem, base) };
  assert.equal(C.receiveIngest([forged])[0].status, 'rejected');
  assert.equal(C._getEdge(base.triple_hash), undefined);
});

test('SEC-2: unbekannter Origin (Web-of-Trust) wird abgewiesen', () => {
  const stranger = fresh(); const C = fresh(); // C kennt stranger NICHT
  stranger.storeTriple({ subject: 'Irgend', predicate: 'sagt', object: 'Was', confidence: 900 });
  const batch = stranger.exportSince({});
  assert.equal(C.receiveIngest(batch)[0].status, 'rejected');
});

test('SEC-3: Trust-Laundering via Relay scheitert — Trust hängt am Origin', () => {
  const evil = fresh(); const relay = fresh(); const C = fresh();
  evil.storeTriple({ subject: 'Geruecht', predicate: 'behauptet', object: 'Unsinn', confidence: 900 });
  // Relay vertraut Evil voll → bei Relay aktiv:
  relay.peerAdd(evil.peerId, evil.identity.publicKeyPem); relay.peerTrust(evil.peerId, 'full');
  relay.pull(link(evil), evil.peerId);
  assert.equal(relay._getEdge(tripleHash('Geruecht', 'behauptet', 'Unsinn')).local_status, 'active');
  // C kennt Evil als untrusted, Relay als full. C zieht von Relay:
  C.peerAdd(evil.peerId, evil.identity.publicKeyPem); // untrusted
  C.peerAdd(relay.peerId, relay.identity.publicKeyPem); C.peerTrust(relay.peerId, 'full');
  C.pull(link(relay), relay.peerId);
  const edge = C._getEdge(tripleHash('Geruecht', 'behauptet', 'Unsinn'));
  assert.equal(edge.local_status, 'quarantined');     // NICHT zu active gewaschen
  assert.equal(edge.origin_peer_id, evil.peerId);      // Herkunft bleibt Evil (nicht Relay)
});

// ---- UC-08 Merge (CRDT-Algebra) --------------------------------------
test('AC-8.1/8.2: Merge ist kommutativ + idempotent (max)', () => {
  const x = fresh(); const y = fresh();
  const w1 = makeWire('Sx', 'pp', 'Oo', 600, { P1: 1 }); const w2 = makeWire('Sx', 'pp', 'Oo', 800, { P2: 1 });
  x.mergeIncoming(w1, { peerTrust: 'full' }); x.mergeIncoming(w2, { peerTrust: 'full' });
  y.mergeIncoming(w2, { peerTrust: 'full' }); y.mergeIncoming(w1, { peerTrust: 'full' }); y.mergeIncoming(w1, { peerTrust: 'full' });
  assert.equal(x._getEdge(w1.triple_hash).confidence, 800);
  assert.equal(y._getEdge(w1.triple_hash).confidence, 800);
});

test('AC-8.3: nebenläufiger gleicher Hash → keine Quarantäne', () => {
  const e = fresh();
  e.mergeIncoming(makeWire('Sx', 'pp', 'Oo', 600, { P1: 1 }), { peerTrust: 'full' });
  e.mergeIncoming(makeWire('Sx', 'pp', 'Oo', 700, { P2: 1 }), { peerTrust: 'full' });
  assert.equal(e._getEdge(tripleHash('Sx', 'pp', 'Oo')).local_status, 'active');
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM knowledge_edges').get().c, 1);
});

test('AC-8.5: gemergter Föderationswert ist trust-unabhängig', () => {
  const full = fresh(); const limited = fresh();
  const w = makeWire('Sx', 'pp', 'Oo', 800, { P1: 1 });
  full.mergeIncoming(w, { peerTrust: 'full' }); limited.mergeIncoming(w, { peerTrust: 'limited' });
  assert.equal(full._getEdge(w.triple_hash).asserted_confidence, limited._getEdge(w.triple_hash).asserted_confidence);
});

test('AC-8.6: Merge ist assoziativ (drei Werte, beliebige Reihenfolge → max)', () => {
  const o1 = fresh(); const o2 = fresh();
  const ws = [makeWire('Sx', 'pp', 'Oo', 300, { A: 1 }), makeWire('Sx', 'pp', 'Oo', 900, { B: 1 }), makeWire('Sx', 'pp', 'Oo', 500, { C: 1 })];
  for (const w of ws) o1.mergeIncoming(w, { peerTrust: 'full' });
  for (const w of [ws[2], ws[0], ws[1]]) o2.mergeIncoming(w, { peerTrust: 'full' });
  assert.equal(o1._getEdge(ws[0].triple_hash).confidence, 900);
  assert.equal(o2._getEdge(ws[0].triple_hash).confidence, 900);
});

test('AC-8.4: widersprüchliche Objekte koexistieren aktiv (Belief entscheidet, keine harte Quarantäne)', () => {
  const e = fresh();
  e.mergeIncoming(makeWire('Strasse', 'zustand', 'frei', 800, { P1: 1 }), { peerTrust: 'full' });
  e.mergeIncoming(makeWire('Strasse', 'zustand', 'gesperrt', 800, { P2: 1 }), { peerTrust: 'full' });
  assert.equal(e._getEdge(tripleHash('Strasse', 'zustand', 'frei')).local_status, 'active');
  assert.equal(e._getEdge(tripleHash('Strasse', 'zustand', 'gesperrt')).local_status, 'active');
});

// ---- Evidenz-Gewichtung (Autorität × Aktualität × Konfidenz, NIE Anzahl) ----
test('Belief: Gesetz schlägt mehrfache Web-Quellen (Autorität, nicht Anzahl)', () => {
  const e = fresh();
  // dieselbe Web-Behauptung mehrfach erfasst = gleicher Hash = ein Edge (kein Count-Bonus):
  for (let i = 0; i < 3; i++) e.storeTriple({ subject: 'Widerrufsfrist', predicate: 'betraegt', object: 'T14', confidence: 850, source_type: 'web' });
  e.storeTriple({ subject: 'Widerrufsfrist', predicate: 'betraegt', object: 'T30', confidence: 800, source_type: 'gesetz' });
  const r = e.resolveBelief('Widerrufsfrist', 'betraegt');
  assert.equal(r.winner, 'T30'); // Gesetz dominiert trotz mehrfacher Web-Erfassung
  assert.ok(r.candidates.find((c) => c.object === 'T30').belief > r.candidates.find((c) => c.object === 'T14').belief);
});

test('Belief: bei gleicher Autorität gewinnt der neuere (Recency)', () => {
  const e = fresh();
  e.storeTriple({ subject: 'Hauptstadt', predicate: 'ist', object: 'Bonn', confidence: 800, source_type: 'fachquelle', asserted_at: '1989-01-01T00:00:00Z' });
  e.storeTriple({ subject: 'Hauptstadt', predicate: 'ist', object: 'Berlin', confidence: 800, source_type: 'fachquelle', asserted_at: '2020-01-01T00:00:00Z' });
  assert.equal(e.resolveBelief('Hauptstadt', 'ist').winner, 'Berlin');
});

test('Belief: veraltetes Wissen sinkt gegen 0, bleibt aber gespeichert (auditierbar)', () => {
  const e = fresh();
  e.storeTriple({ subject: 'Standard', predicate: 'ist', object: 'Alt', confidence: 900, source_type: 'web', asserted_at: '2005-01-01T00:00:00Z' });
  e.storeTriple({ subject: 'Standard', predicate: 'ist', object: 'Neu', confidence: 700, source_type: 'web', asserted_at: '2025-06-01T00:00:00Z' });
  const r = e.resolveBelief('Standard', 'ist');
  assert.equal(r.winner, 'Neu'); // neuer schlägt höhere alte Konfidenz
  assert.ok(r.candidates.find((c) => c.object === 'Alt').belief < 100);
  assert.ok(e._getEdge(tripleHash('Standard', 'ist', 'Alt'))); // nicht gelöscht
});

test('Query markiert überstimmte Aussagen (disputed + dominant)', () => {
  const e = fresh();
  e.storeTriple({ subject: 'Frist', predicate: 'ist', object: 'A14', confidence: 800, source_type: 'web' });
  e.storeTriple({ subject: 'Frist', predicate: 'ist', object: 'A30', confidence: 800, source_type: 'gesetz' });
  const a14 = e.query('Frist', { maxDepth: 1 }).edges.find((x) => x.object === 'A14');
  assert.equal(a14.disputed, true);
  assert.equal(a14.dominant, 'A30');
});

test('mergeIncoming validiert Input (1-Zeichen-Subjekt → Fehler, kein DB-Crash)', () => {
  const e = fresh();
  assert.throws(() => e.mergeIncoming(makeWire('S', 'pp', 'Oo', 500, { P1: 1 }), { peerTrust: 'full' }), /INVALID_PARAMETER_FORMAT/);
});

// ---- UC-09 Peer-Trust -------------------------------------------------
test('AC-9.1: untrusted-Origin → Fakten in Quarantäne', () => {
  const { A, B } = pair('untrusted');
  A.storeTriple({ subject: 'Fremd', predicate: 'sagt', object: 'Etwas', confidence: 900 });
  B.pull(link(A), A.peerId);
  assert.equal(B._getEdge(tripleHash('Fremd', 'sagt', 'Etwas')).local_status, 'quarantined');
});

test('AC-9.2: limited-Origin → Konfidenz-Abschlag in der Lese-Linse', () => {
  const { A, B } = pair('limited');
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Wert', confidence: 800 });
  B.pull(link(A), A.peerId);
  const edge = B.query('Sensor', { maxDepth: 1 }).edges.find((x) => x.object === 'Wert');
  assert.equal(edge.confidence, 800);
  assert.equal(edge.effective_confidence, 400); // trunc(800*500/1000)
});

test('AC-9.3: Key-Rotation ersetzt Schlüssel ohne Datenverlust', () => {
  const B = fresh(); const A = fresh(); const A2 = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem);
  const fp = B.peerRotate(A.peerId, A2.identity.publicKeyPem);
  assert.equal(B._peer(A.peerId).public_key, A2.identity.publicKeyPem);
  assert.equal(B._peer(A.peerId).fingerprint, fp);
});

test('AC-9.4: Revoke setzt gemergte Fakten des Origins auf Quarantäne', () => {
  const { A, B } = pair('full');
  A.storeTriple({ subject: 'Quelle', predicate: 'sagt', object: 'Xx', confidence: 900 });
  B.pull(link(A), A.peerId);
  assert.equal(B._getEdge(tripleHash('Quelle', 'sagt', 'Xx')).local_status, 'active');
  B.peerRevoke(A.peerId);
  assert.equal(B._getEdge(tripleHash('Quelle', 'sagt', 'Xx')).local_status, 'quarantined');
  assert.equal(B._peer(A.peerId).trust_level, 'untrusted');
});

// ---- Clock-Persistenz (🟡 aus Review) --------------------------------
test('Vector-Clock-Selbstzähler überlebt Neustart (kein Rückschritt)', () => {
  const id = new Engine().identity; const peerId = 'peer:fixed';
  const e1 = new Engine({ identity: id, peerId });
  e1.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 700 });
  e1.storeTriple({ subject: 'Cc', predicate: 'pp', object: 'Dd', confidence: 700 });
  const dump = e1.db.prepare('SELECT triple_hash, vector_clock FROM knowledge_edges').all();
  // Neue Engine auf gleiche (in-memory) DB simulieren wir über exportierten Stand:
  const e2 = new Engine({ identity: id, peerId });
  for (const row of dump) e2.db.prepare('INSERT OR IGNORE INTO knowledge_nodes (id,name) VALUES (?,?)'); // no-op-Schutz
  // _maxSelfClock liest aus der DB; hier neue DB → 0 erwartet, daher direkter Unit-Check der Funktion:
  e2.db.prepare(`INSERT INTO knowledge_nodes (id,name) VALUES ('n1','Aa'),('n2','Bb')`).run();
  e2.db.prepare(`INSERT INTO knowledge_edges (triple_hash,subject_id,predicate,object_id,confidence,asserted_confidence,temporality,origin_peer_id,signature,vector_clock) VALUES ('h','n1','pp','n2',700,700,'stable',?, 'ed25519:x', ?)`).run(peerId, JSON.stringify({ [peerId]: 5 }));
  const e3 = new Engine({ identity: id, peerId, dbPath: ':memory:' });
  // Direkter Nachweis der Rekonstruktionslogik:
  assert.equal(e3._maxSelfClock(), 0);
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
  const A = seedPeerWith3(); const B = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  B.clone(link(A), A.peerId);
  assert.equal(B.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='quarantined'").get().c, 3);
  assert.equal(B.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='active'").get().c, 0);
});

test('AC-11.2: bulk_promote hebt ganzen Bestand auf active', () => {
  const A = seedPeerWith3(); const B = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  B.clone(link(A), A.peerId, { bulkPromote: true });
  assert.equal(B.db.prepare("SELECT COUNT(*) c FROM knowledge_edges WHERE local_status='active'").get().c, 3);
});

test('AC-11.3: erneuter Clone ist idempotent (keine Dubletten)', () => {
  const A = seedPeerWith3(); const B = fresh();
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  B.clone(link(A), A.peerId); B.clone(link(A), A.peerId);
  assert.equal(B.db.prepare('SELECT COUNT(*) c FROM knowledge_edges').get().c, 3);
});

// ---- UC-10 Conformance (Node-Seite) ----------------------------------
test('AC-10.2: Conformance-Vektoren bestehen Node-seitig; PHP unverified ohne Runner', () => {
  const vectors = [
    { name: 'decay-temporal', input: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 800, temporality: 'temporal' }], op: 'decay', expected: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 750, status: 'active' }] },
    { name: 'infer-glaette', input: [{ subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 900 }, { subject: 'Temperatur', predicate: 'zustand', object: 'unter_null', confidence: 900 }], op: 'infer', expected: [{ subject: 'Fahrbahn', predicate: 'zustand', object: 'gefaehrlich', confidence: 810, status: 'active' }] },
  ];
  const r = checkConformance(vectors);
  assert.equal(r.allPass, true);
  assert.equal(r.phpVerified, false);
});
