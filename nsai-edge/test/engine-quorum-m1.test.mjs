import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

// UC-MS Slice #M.1 — Trust-Quorum-Endorsement.
// Kategorische Verdikte (supported/unknown/contested) — KEINE Wahrscheinlichkeit.
// Echo-Schutz (Max-pro-Cluster), Sybil-Schutz (untrusted → 0), Idempotenz, Open-World.

// Helfer: einen externen Peer mit Identity + Trust + optionalem Cluster anlegen + sein
// Endorsement direkt in die DB schreiben (simuliert einen via Wire eingegangenen Endorser).
function addPeer(engine, label, { trust = 'full', cluster = null } = {}) {
  // erzeuge eine eigene Identity-äquivalente Schlüssel-ID (nutze einen Test-Peer-ID-Stub)
  const peerId = `peer:test-${label}`;
  engine.db.prepare('INSERT OR IGNORE INTO peers (peer_id, public_key, fingerprint, endpoint, trust_level, cluster_id) VALUES (?,?,?,?,?,?)')
    .run(peerId, `pk-${label}`, `fp-${label}`, null, trust, cluster);
  return peerId;
}
function pushEndorsement(engine, hash, peerId, { source_type = 'fachquelle', confidence = 800, asserted_at = '2026-01-01T00:00:00Z' } = {}) {
  engine.db.prepare('INSERT OR IGNORE INTO triple_endorsements (triple_hash, origin_peer_id, source_type, asserted_confidence, asserted_at, asserted_at_norm, signature) VALUES (?,?,?,?,?,?,?)')
    .run(hash, peerId, source_type, confidence, asserted_at, asserted_at, 'sig-stub');
}

test('AC-15.1: mehrere Endorsements aus unterschiedlichen Clustern erreichen Quorum (supported)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 700, source_type: 'manual' });
  // Ausgangs-Verdikt: ohne Endorsements liefert _quorumFor 'unknown'.
  assert.equal(e._quorumFor(r.triple_hash).verdict, 'unknown');
  // Zwei `full`-Peers aus verschiedenen Clustern mit fachquelle (tier 3) → je 1000×3=3000 → Σ=6000 ≥ Q_multi(2000) UND cluster_count≥2.
  const p1 = addPeer(e, 'p1', { trust: 'full', cluster: 'org-A' });
  const p2 = addPeer(e, 'p2', { trust: 'full', cluster: 'org-B' });
  pushEndorsement(e, r.triple_hash, p1);
  pushEndorsement(e, r.triple_hash, p2);
  const q = e._quorumFor(r.triple_hash);
  assert.equal(q.verdict, 'supported');
  assert.equal(q.cluster_count, 2);
  assert.equal(q.weighted_support, 6000);
});

test('AC-15.2: mehrere Endorsements im GLEICHEN Cluster wirken NICHT doppelt (Echo-Schutz)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Echo-Test', predicate: 'ist', object: 'Beispiel', confidence: 700, source_type: 'manual' });
  // Drei Peers, ALLE in cluster 'echo-cluster' → MAX-Beitrag zählt, nicht Summe.
  const peers = ['e1', 'e2', 'e3'].map((l) => addPeer(e, l, { trust: 'full', cluster: 'echo-cluster' }));
  for (const p of peers) pushEndorsement(e, r.triple_hash, p, { source_type: 'fachquelle' }); // alle gleich → contribution 3000
  const q = e._quorumFor(r.triple_hash);
  // Erwartung: cluster_count=1, weighted_support=3000 (NICHT 9000), verdict=unknown (kein Auth-Floor + nur 1 Cluster < 2).
  assert.equal(q.cluster_count, 1);
  assert.equal(q.weighted_support, 3000);
  assert.equal(q.verdict, 'unknown');
});

test('AC-15.3: einzelnes authoritative-Endorsement (tier behoerde+) schaltet supported (single-auth-Pfad)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'AuthTest', predicate: 'ist', object: 'wahr', confidence: 700, source_type: 'manual' });
  const auth = addPeer(e, 'authoritative', { trust: 'authoritative', cluster: 'gov' });
  // authoritative × gesetz(6): trustRank=1500, tier=6 (cap=6) → 1500*6 = 9000 ≥ AUTH_FLOOR(4500)
  pushEndorsement(e, r.triple_hash, auth, { source_type: 'gesetz' });
  const q = e._quorumFor(r.triple_hash);
  assert.equal(q.verdict, 'supported');
  assert.equal(q.cluster_count, 1);
  assert.ok(q.weighted_support >= 4500);
});

test('AC-15.4: 100 untrusted-Endorsements bewegen das Verdikt NICHT (Sybil)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Sybil-Test', predicate: 'ist', object: 'falsch', confidence: 700, source_type: 'manual' });
  for (let i = 0; i < 100; i++) {
    const p = addPeer(e, `untrusted-${i}`, { trust: 'untrusted', cluster: `c${i}` }); // jeder eigener Cluster
    pushEndorsement(e, r.triple_hash, p, { source_type: 'fachquelle' });
  }
  const q = e._quorumFor(r.triple_hash);
  // untrusted → trustTierCap=-1 → effTier negativ → contribution 0 → Sybil-Aussagen NICHT gezählt.
  assert.equal(q.cluster_count, 0);
  assert.equal(q.weighted_support, 0);
  assert.equal(q.verdict, 'unknown');
});

test('AC-15.5: Open-World — kein Endorsement → unknown (NIEMALS „vermutlich")', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'OW-Test', predicate: 'ist', object: 'frei', confidence: 700, source_type: 'manual' });
  const q = e._quorumFor(r.triple_hash);
  assert.equal(q.verdict, 'unknown');
  assert.equal(q.weighted_support, 0);
});

test('AC-15.6: Determinismus — gleiche Endorsement-Menge in beliebiger Reihenfolge → gleiches Verdikt', () => {
  const make = () => {
    const e = new Engine();
    const r = e.storeTriple({ subject: 'Det-Test', predicate: 'ist', object: 'gleich', confidence: 700, source_type: 'manual' });
    return { e, hash: r.triple_hash };
  };
  const a = make(); const b = make();
  const peersA = [['p1', 'org-A'], ['p2', 'org-B']];
  const peersB = [['p2', 'org-B'], ['p1', 'org-A']]; // umgekehrt
  for (const [label, cluster] of peersA) pushEndorsement(a.e, a.hash, addPeer(a.e, label, { trust: 'full', cluster }));
  for (const [label, cluster] of peersB) pushEndorsement(b.e, b.hash, addPeer(b.e, label, { trust: 'full', cluster }));
  const qa = a.e._quorumFor(a.hash); const qb = b.e._quorumFor(b.hash);
  assert.deepEqual({ v: qa.verdict, c: qa.cluster_count, w: qa.weighted_support }, { v: qb.verdict, c: qb.cluster_count, w: qb.weighted_support });
});

test('AC-15.7: konkurrierende Objekte aus verschiedenen Clustern → contested:true', () => {
  const e = new Engine();
  const r1 = e.storeTriple({ subject: 'Politik', predicate: 'meint', object: 'PartyA', confidence: 700, source_type: 'manual' });
  const r2 = e.storeTriple({ subject: 'Politik', predicate: 'meint', object: 'PartyB', confidence: 700, source_type: 'manual' });
  // jedes Objekt bekommt ein authoritative Endorsement aus eigenem Cluster
  pushEndorsement(e, r1.triple_hash, addPeer(e, 'a1', { trust: 'authoritative', cluster: 'cl1' }), { source_type: 'behoerde' });
  pushEndorsement(e, r2.triple_hash, addPeer(e, 'a2', { trust: 'authoritative', cluster: 'cl2' }), { source_type: 'behoerde' });
  const v1 = e.verify({ subject: 'Politik', predicate: 'meint', object: 'PartyA' });
  const v2 = e.verify({ subject: 'Politik', predicate: 'meint', object: 'PartyB' });
  assert.equal(v1.verdict, 'supported');
  assert.equal(v2.verdict, 'supported');
  assert.equal(v1.contested, true);
  assert.equal(v2.contested, true);
});

test('AC-15.10: Idempotenz — zweimaliger endorseTriple → genau eine Zeile', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Idem-Test', predicate: 'ist', object: 'ok', confidence: 700 });
  const r1 = e.endorseTriple({ subject: 'Idem-Test', predicate: 'ist', object: 'ok', source_type: 'manual', confidence: 800 });
  const r2 = e.endorseTriple({ subject: 'Idem-Test', predicate: 'ist', object: 'ok', source_type: 'manual', confidence: 800 });
  assert.equal(r1.triple_hash, r2.triple_hash);
  const cnt = e.db.prepare('SELECT COUNT(*) c FROM triple_endorsements WHERE triple_hash=?').get(r1.triple_hash).c;
  assert.equal(cnt, 1);
});

test('AC-15.12: retracted/quarantined Tripel akzeptiert KEIN Endorsement (Status-Konjunktion)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Status-Test', predicate: 'ist', object: 'xy', confidence: 700 });
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(r.triple_hash);
  assert.throws(() => e.endorseTriple({ subject: 'Status-Test', predicate: 'ist', object: 'xy' }), /NOT_APPLICABLE/);
});

test('AC-15.13: kein Probabilistik-Leak — Output enthält keine Float-Felder, kein %/believe/vermutlich', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Leak-Test', predicate: 'ist', object: 'frei', confidence: 700 });
  const auth = addPeer(e, 'auth', { trust: 'authoritative', cluster: 'gov' });
  pushEndorsement(e, tripleHash('Leak-Test', 'ist', 'frei'), auth, { source_type: 'gesetz' });
  const v = e.verify({ subject: 'Leak-Test', predicate: 'ist', object: 'frei' });
  const json = JSON.stringify(v);
  assert.equal(/(\b\d+\.\d+\b|%|vermutlich|believe_pct|probability)/i.test(json), false, `Float/Prozent-Leak gefunden: ${json}`);
  assert.ok(['supported', 'contradicted', 'unknown'].includes(v.verdict)); // kategorisch
  assert.ok(Number.isInteger(v.quorum.weighted_support));
});

test('AC-15.14: Föderations-Race — rejected → später re-pushed → idempotent angenommen', () => {
  const e = new Engine();
  // Erstes endorse: Tripel existiert nicht → NOT_APPLICABLE (rejected).
  assert.throws(() => e.endorseTriple({ subject: 'Race-Test', predicate: 'ist', object: 'spaet' }), /NOT_APPLICABLE/);
  // Edge kommt nachträglich:
  e.storeTriple({ subject: 'Race-Test', predicate: 'ist', object: 'spaet', confidence: 700 });
  const r = e.endorseTriple({ subject: 'Race-Test', predicate: 'ist', object: 'spaet' });
  assert.ok(r.triple_hash);
  // Zweiter Re-Push idempotent:
  const r2 = e.endorseTriple({ subject: 'Race-Test', predicate: 'ist', object: 'spaet' });
  assert.equal(r2.triple_hash, r.triple_hash);
  const cnt = e.db.prepare('SELECT COUNT(*) c FROM triple_endorsements WHERE triple_hash=?').get(r.triple_hash).c;
  assert.equal(cnt, 1);
});

test('AC-15.16 (Restrisiko dokumentiert): Default-Cluster=peer_id → drei full-Peers ohne explizite Cluster-Zuweisung = 3 unabhängige Cluster', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Risk-Test', predicate: 'ist', object: 'unbekannt', confidence: 700 });
  // KEINE explizite cluster_id → Default = peer_id (jeder als eigener Cluster).
  for (const l of ['p1', 'p2', 'p3']) pushEndorsement(e, r.triple_hash, addPeer(e, l, { trust: 'full', cluster: null }), { source_type: 'fachquelle' });
  const q = e._quorumFor(r.triple_hash);
  assert.equal(q.cluster_count, 3, 'Default-Restrisiko: jeder Peer als eigener Cluster gezählt — wie KONZEPT.md UC-MS deklariert');
  // verdict supported, weil weighted_support = 3×3000 = 9000 ≥ Q=2000 UND cluster_count≥2.
  assert.equal(q.verdict, 'supported');
});

test('🔴-1 (Audit-M.1): retracted/quarantined/superseded Edge liefert NIEMALS supported via Quorum (Status-Konjunktion)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Status-RB', predicate: 'ist', object: 'aktiv', confidence: 700 });
  // Auth-Quorum belegen
  const auth = addPeer(e, 'auth', { trust: 'authoritative', cluster: 'gov' });
  pushEndorsement(e, r.triple_hash, auth, { source_type: 'gesetz' });
  assert.equal(e.verify({ subject: 'Status-RB', predicate: 'ist', object: 'aktiv' }).verdict, 'supported');
  // Flip auf retracted
  e.db.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash=?").run(r.triple_hash);
  const v = e.verify({ subject: 'Status-RB', predicate: 'ist', object: 'aktiv' });
  assert.equal(v.verdict, 'unknown', 'retracted Edge darf trotz Quorum-Endorsements NICHT supported melden (Halluzinations-Schutz)');
  // Auch quarantined + superseded
  for (const st of ['quarantined', 'superseded']) {
    e.db.prepare("UPDATE knowledge_edges SET local_status=? WHERE triple_hash=?").run(st, r.triple_hash);
    assert.equal(e.verify({ subject: 'Status-RB', predicate: 'ist', object: 'aktiv' }).verdict, 'unknown', `${st} → unknown`);
  }
});

test('🔴-2 (Audit-M.1): Quorum-supported wird contested:true, wenn resolveBelief ein anderes Objekt dominant findet', () => {
  const e = new Engine();
  // Alpha: niedrige Single-Source-Autorität (fachquelle), aber Quorum-Auth-Endorsement
  const a = e.storeTriple({ subject: 'Pol-Conf', predicate: 'meint', object: 'Alpha', confidence: 700, source_type: 'fachquelle' });
  pushEndorsement(e, a.triple_hash, addPeer(e, 'a1', { trust: 'authoritative', cluster: 'cl-a' }), { source_type: 'behoerde' });
  // Beta: höchste Single-Source-Autorität (gesetz), KEIN Quorum-Endorsement
  e.storeTriple({ subject: 'Pol-Conf', predicate: 'meint', object: 'Beta', confidence: 700, source_type: 'gesetz' });
  const v = e.verify({ subject: 'Pol-Conf', predicate: 'meint', object: 'Alpha' });
  assert.equal(v.verdict, 'supported');
  assert.equal(v.contested, true, 'resolveBelief favorisiert Beta (gesetz>fachquelle) → Konflikt-Signal');
});

test('🔴-2 (Audit-M.1): Konkurrierendes Objekt mit Quorum-supported → das gefragte ist contradicted', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Vot-Conf', predicate: 'gewinnt', object: 'PartyX', confidence: 700, source_type: 'manual' });
  const y = e.storeTriple({ subject: 'Vot-Conf', predicate: 'gewinnt', object: 'PartyY', confidence: 700, source_type: 'manual' });
  pushEndorsement(e, y.triple_hash, addPeer(e, 'y1', { trust: 'authoritative', cluster: 'cl-y' }), { source_type: 'behoerde' });
  const v = e.verify({ subject: 'Vot-Conf', predicate: 'gewinnt', object: 'PartyX' });
  assert.equal(v.verdict, 'contradicted', 'PartyY ist quorum-supported → PartyX contradicted');
  assert.equal(v.dominant, 'PartyY');
});

test('🔴-3 (Audit-M.1): Quorum respektiert as_of — Zukunfts-Endorsement zählt für historische Anfrage NICHT', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Time-Q', predicate: 'ist', object: 'wahr', confidence: 700, asserted_at: '2019-01-01T00:00:00Z' });
  const auth = addPeer(e, 'auth', { trust: 'authoritative', cluster: 'gov' });
  pushEndorsement(e, r.triple_hash, auth, { source_type: 'gesetz', asserted_at: '2030-01-01T00:00:00Z' });
  // Zukunft (2030): supported.
  assert.equal(e.verify({ subject: 'Time-Q', predicate: 'ist', object: 'wahr', as_of: '2030-06-01T00:00:00Z' }).verdict, 'supported');
  // Vergangenheit (2025): das Endorsement von 2030 zählt nicht.
  const past = e.verify({ subject: 'Time-Q', predicate: 'ist', object: 'wahr', as_of: '2025-06-01T00:00:00Z' });
  // ohne Quorum fall-through auf resolveBelief — Tripel ist von 2019, also resolveBelief supported via Single-Source.
  // Wichtig: das Quorum-Aggregat selbst muss zu 2025 = unknown (sonst Zeit-Drift).
  const qPast = e._quorumFor(r.triple_hash, { as_of: '2025-06-01T00:00:00Z' });
  assert.equal(qPast.verdict, 'unknown', '2030-Endorsement darf für 2025-Anfrage nicht zählen');
  // verify selbst fällt durch zum resolveBelief-Pfad (Backwards-Compat)
  assert.ok(['supported', 'unknown'].includes(past.verdict));
});

test('🟡-2 (Audit-M.1): cluster_id="" (leerer String) wird wie NULL behandelt (jeder eigener Cluster)', () => {
  const e = new Engine();
  const r = e.storeTriple({ subject: 'Empty-Cluster', predicate: 'ist', object: 'test', confidence: 700, source_type: 'manual' });
  for (const l of ['p1', 'p2', 'p3']) pushEndorsement(e, r.triple_hash, addPeer(e, l, { trust: 'full', cluster: '' }), { source_type: 'fachquelle' });
  const q = e._quorumFor(r.triple_hash);
  assert.equal(q.cluster_count, 3, 'leerer String darf nicht als gemeinsamer Cluster gelten');
});

test('🔴 (Re-Audit-M.1): multiValue-Prädikate — Geschwister-Endorsement verursacht KEINE Konfabulation', () => {
  const e = new Engine();
  // hat_tag ist in spec.multiValuePredicates — mehrere Tags koexistieren legitim.
  const tagRot = e.storeTriple({ subject: 'Dokument', predicate: 'hat_tag', object: 'rot', confidence: 700, source_type: 'manual' });
  e.storeTriple({ subject: 'Dokument', predicate: 'hat_tag', object: 'blau', confidence: 700, source_type: 'manual' });
  // Beide bekommen Quorum-Support aus unterschiedlichen Clustern
  pushEndorsement(e, tagRot.triple_hash, addPeer(e, 'tr', { trust: 'authoritative', cluster: 'cl-r' }), { source_type: 'behoerde' });
  // beide quorum-supported, KEIN contested:true, KEIN contradicted
  const vRot = e.verify({ subject: 'Dokument', predicate: 'hat_tag', object: 'rot' });
  const vBlau = e.verify({ subject: 'Dokument', predicate: 'hat_tag', object: 'blau' });
  assert.equal(vRot.verdict, 'supported');
  assert.notEqual(vRot.contested, true, 'multiValue darf nicht contested setzen (Geschwister-Tags sind kein Widerspruch)');
  assert.equal(vRot.multiValue, true);
  // blau hat zwar kein Endorsement, aber das endorsed-rot darf NICHT zu contradicted für blau führen
  assert.notEqual(vBlau.verdict, 'contradicted', 'multiValue + Geschwister-Endorsement darf NICHT contradicted erzeugen');
});

test('verify ohne Endorsements verhält sich wie vor #M.1 (Backwards-Compat)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Compat-Test', predicate: 'ist', object: 'alt', confidence: 900 });
  const v = e.verify({ subject: 'Compat-Test', predicate: 'ist', object: 'alt' });
  // ohne Endorsements: Quorum unknown → fall-through auf bestehende resolveBelief-Logik
  assert.equal(v.verdict, 'supported');
  assert.equal(v.belief, 1000); // wie heute
});
