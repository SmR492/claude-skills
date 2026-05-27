// Generator für PHP-Cross-Conformance-Fixtures (KONZEPT-graph-federation §7.1, AC-3.x/3.6).
// Erzeugt deterministische Krypto- + Merge-Fixtures aus der echten nsai-edge-Engine,
// damit die PHP-Gegenseite byte-/semantik-gleich verifizieren + mergen kann.
//
// Aufruf:  node test/fixtures/gen-federation-fixtures.mjs <ziel-verzeichnis>
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { generateKeyPairSync, createPrivateKey, createPublicKey } from 'node:crypto';
import { tripleHash } from '../../src/canonical.mjs';
import { signTriple, signingString, fingerprint } from '../../src/identity.mjs';
import { Engine } from '../../src/engine.mjs';
import { WIRE_VERSION } from '../../src/rules.mjs';

const out = process.argv[2] || join(process.cwd(), 'fixtures-out');
mkdirSync(out, { recursive: true });

// Feste Identität (deterministischer Seed über fixe PEM) — reproduzierbare Fixtures.
function fixedIdentity() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ type: 'spki', format: 'pem' }).toString();
  const privateKeyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
  return { publicKeyPem, privateKeyPem, fingerprint: fingerprint(publicKeyPem) };
}

const id = fixedIdentity();
const peerId = `peer:${id.fingerprint.slice(0, 12)}`;
const rawPub = createPublicKey(id.publicKeyPem).export({ type: 'spki', format: 'der' }).subarray(-32).toString('base64');

// ---- 1) Krypto-Fixtures: Hash + signingString + Signatur -------------------
const cases = [
  { subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', asserted_confidence: 900, temporality: 'stable', source_type: 'manual' },
  { subject: 'Gefahr/Eis:Winter', predicate: 'ist_ein', object: 'Strassengefahr', asserted_confidence: 750, temporality: 'stable', source_type: 'fachquelle' },
  { subject: 'Mueller_Strasse.42', predicate: 'liegt_in', object: 'Stadtgebiet', asserted_confidence: 1000, temporality: 'eternal', source_type: 'behoerde' },
];
const cryptoFixtures = cases.map((c) => {
  const th = tripleHash(c.subject, c.predicate, c.object);
  const t = {
    wire_version: WIRE_VERSION, triple_hash: th, subject: c.subject, predicate: c.predicate, object: c.object,
    asserted_confidence: c.asserted_confidence, temporality: c.temporality, source_type: c.source_type,
    asserted_at: '2026-05-27T10:00:00.000Z', origin_peer_id: peerId, derived_from: null,
  };
  const sig = signTriple(id.privateKeyPem, t);
  return {
    description: `${c.subject} ${c.predicate} ${c.object}`,
    wire: { ...t, confidence: c.asserted_confidence, relayed_by: peerId, vector_clock: { [peerId]: 1 }, signature: sig },
    expected: { triple_hash: th, signingString: signingString(t), valid: true },
  };
});

// Tampered: Objekt nach dem Signieren verändert → Verify MUSS fehlschlagen.
const base = cryptoFixtures[0];
const tampered = {
  description: 'tampered: object nach Signatur verändert',
  wire: { ...base.wire, object: 'Stau' },
  expected: { valid: false },
};

writeFileSync(join(out, 'crypto.json'), JSON.stringify({
  origin_peer_id: peerId, public_key_pem: id.publicKeyPem, raw_public_key_b64: rawPub,
  fixtures: [...cryptoFixtures, tampered],
}, null, 2));

// ---- 2) Merge-Fixtures: echte mergeIncoming-Szenarien (AC-3.6) -------------
// Zwei Origin-Peers mit unterschiedlichem Trust/source_type → incWins-Präzedenz.
function scenario(name, { existing, incoming, existingTrust, incomingTrust }) {
  const e = new Engine({ identity: fixedIdentity() });
  // Peers anlegen + Trust setzen
  const mk = (rec) => {
    const pid = fixedIdentity();
    const ppeer = `peer:${pid.fingerprint.slice(0, 12)}`;
    const th = tripleHash(rec.subject, rec.predicate, rec.object);
    const t = { wire_version: WIRE_VERSION, triple_hash: th, subject: rec.subject, predicate: rec.predicate, object: rec.object,
      asserted_confidence: rec.asserted_confidence, temporality: rec.temporality ?? 'stable', source_type: rec.source_type,
      asserted_at: rec.asserted_at ?? '2026-05-20T00:00:00.000Z', origin_peer_id: ppeer, derived_from: null };
    const sig = signTriple(pid.privateKeyPem, t);
    return { id: pid, peerId: ppeer, wire: { ...t, confidence: rec.confidence ?? rec.asserted_confidence, relayed_by: ppeer, vector_clock: { [ppeer]: rec.clock ?? 1 }, signature: sig } };
  };
  const ex = mk(existing); const inc = mk(incoming);
  e.peerAdd(ex.peerId, ex.id.publicKeyPem); e.peerTrust(ex.peerId, existingTrust);
  e.peerAdd(inc.peerId, inc.id.publicKeyPem); e.peerTrust(inc.peerId, incomingTrust);
  e.mergeIncoming(ex.wire, { peerTrust: existingTrust });
  e.mergeIncoming(inc.wire, { peerTrust: incomingTrust });
  const row = e.db.prepare('SELECT * FROM knowledge_edges WHERE triple_hash=?').get(ex.wire.triple_hash);
  return {
    name,
    existing: { ...existing, origin_peer_id: ex.peerId, trust: existingTrust },
    incoming: { ...incoming, origin_peer_id: inc.peerId, trust: incomingTrust },
    expected: { owner_origin: row.origin_peer_id, live_confidence: row.confidence, asserted_confidence: row.asserted_confidence, source_type: row.source_type },
    note: row.origin_peer_id === inc.peerId ? 'incoming gewinnt' : 'existing bleibt',
  };
}

// hilfs: gleicher triple_hash über gleiche s/p/o, unterschiedliche Provenienz
const SPO = { subject: 'Hauptstrasse', predicate: 'zustand', object: 'gesperrt' };
const merge = [
  scenario('full schlägt limited (trust-primär)', {
    existing: { ...SPO, asserted_confidence: 900, source_type: 'web' }, existingTrust: 'limited',
    incoming: { ...SPO, asserted_confidence: 400, source_type: 'manual' }, incomingTrust: 'full',
  }),
  scenario('gleicher Trust: höhere effTier gewinnt', {
    existing: { ...SPO, asserted_confidence: 800, source_type: 'web' }, existingTrust: 'full',
    incoming: { ...SPO, asserted_confidence: 800, source_type: 'behoerde' }, incomingTrust: 'full',
  }),
  scenario('untrusted hebt Live-Konfidenz NICHT', {
    existing: { ...SPO, asserted_confidence: 600, source_type: 'manual', confidence: 600 }, existingTrust: 'full',
    incoming: { ...SPO, asserted_confidence: 1000, source_type: 'manual', confidence: 1000 }, incomingTrust: 'untrusted',
  }),
];

writeFileSync(join(out, 'merge.json'), JSON.stringify({ scenarios: merge }, null, 2));

console.log(JSON.stringify({ out, crypto: cryptoFixtures.length + 1, merge: merge.length }, null, 2));
