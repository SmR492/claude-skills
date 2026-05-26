// NSAI-Edge Engine — lokaler neuro-symbolischer Wissensgraph-Knoten.
// Implementiert KONZEPT v2.2: UC-01..UC-11. Fixed-Point (Promille 0–1000),
// trust-unabhängiger CRDT-Merge, Trust nur als lokale Lese-Linse.
import { randomUUID } from 'node:crypto';
import { openDb } from './db.mjs';
import { tripleHash } from './canonical.mjs';
import { createIdentity, signTriple, verifyTriple, fingerprint } from './identity.mjs';
import { DEFAULT_SPEC, WIRE_VERSION, trunc, trustFactor } from './rules.mjs';

const RE_SUBJECT = /^[\w\-\\.:]{2,160}$/;
const RE_PREDICATE = /^[a-z_]{2,50}$/;
const TEMPORALITIES = new Set(['eternal', 'stable', 'temporal', 'ephemeral']);

export class EngineError extends Error {
  constructor(code, message) {
    super(message ? `${code}: ${message}` : code);
    this.code = code;
  }
}

// Elementweises Maximum zweier Vector-Clocks.
function clockMax(a, b) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
}
// a ≤ b (kausal dominiert): jeder Eintrag aus a ist ≤ b.
function clockLEQ(a, b) {
  return Object.entries(a).every(([k, v]) => v <= (b[k] ?? 0));
}

export class Engine {
  constructor({ dbPath = ':memory:', identity, spec = DEFAULT_SPEC, peerId } = {}) {
    this.db = openDb(dbPath);
    this.identity = identity ?? createIdentity();
    this.spec = spec;
    this.peerId = peerId ?? `peer:${this.identity.fingerprint.slice(0, 12)}`;
    this._clock = 0; // Self-Zähler der Vector-Clock
  }

  // ---- interne Helfer -------------------------------------------------
  _ensureNode(name) {
    const row = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(name);
    if (row) return row.id;
    const id = randomUUID();
    this.db.prepare('INSERT INTO knowledge_nodes (id, name) VALUES (?, ?)').run(id, name);
    return id;
  }
  _nodeName(id) {
    return this.db.prepare('SELECT name FROM knowledge_nodes WHERE id = ?').get(id)?.name;
  }
  _getEdge(hash) {
    return this.db.prepare('SELECT * FROM knowledge_edges WHERE triple_hash = ?').get(hash);
  }
  _tick() {
    this._clock += 1;
    return { [this.peerId]: this._clock };
  }
  _peer(peerId) {
    return this.db.prepare('SELECT * FROM peers WHERE peer_id = ?').get(peerId);
  }

  // ---- UC-01: Tripel lokal erfassen ----------------------------------
  storeTriple({ subject, predicate, object, confidence = 700, temporality = 'stable', context_slug = null }) {
    if (!RE_SUBJECT.test(String(subject ?? '')) || !RE_SUBJECT.test(String(object ?? '')) || !RE_PREDICATE.test(String(predicate ?? ''))) {
      throw new EngineError('INVALID_PARAMETER_FORMAT', 'subject/predicate/object verletzen das Format');
    }
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 1000) {
      throw new EngineError('INVALID_PARAMETER_FORMAT', 'confidence außerhalb 0–1000');
    }
    if (!TEMPORALITIES.has(temporality)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'temporality ungültig');
    if (!this.identity) throw new EngineError('NO_PEER_IDENTITY', 'keine lokale Identität');

    const hash = tripleHash(subject, predicate, object);
    const existing = this._getEdge(hash);
    const clock = this._tick();

    if (existing) {
      // CRDT-Merge des Föderationswerts: max (trust-unabhängig).
      const merged = Math.max(existing.confidence, confidence);
      const vc = clockMax(JSON.parse(existing.vector_clock), clock);
      const triple = this._wire({ hash, subject, predicate, object, confidence: merged, temporality: existing.temporality, vector_clock: vc, derived_from: existing.derived_from });
      this.db.prepare(
        "UPDATE knowledge_edges SET confidence=?, vector_clock=?, signature=?, updated_at=datetime('now') WHERE triple_hash=?",
      ).run(merged, JSON.stringify(vc), triple.signature, hash);
      return { triple_hash: hash, confidence: merged, status: existing.local_status, created: false };
    }

    const subjectId = this._ensureNode(subject);
    const objectId = this._ensureNode(object);
    const triple = this._wire({ hash, subject, predicate, object, confidence, temporality, vector_clock: clock, derived_from: null });
    this.db.prepare(
      `INSERT INTO knowledge_edges
        (triple_hash, subject_id, predicate, object_id, confidence, temporality, local_status, origin_peer_id, signature, vector_clock, derived_from, context_slug)
       VALUES (?,?,?,?,?,?, 'active', ?,?,?, NULL, ?)`,
    ).run(hash, subjectId, predicate, objectId, confidence, temporality, this.peerId, triple.signature, JSON.stringify(clock), context_slug);
    return { triple_hash: hash, confidence, status: 'active', created: true };
  }

  // Baut die signierte Wire-Repräsentation eines Tripels.
  _wire({ hash, subject, predicate, object, confidence, temporality, vector_clock, derived_from, origin_peer_id }) {
    const t = {
      wire_version: WIRE_VERSION,
      triple_hash: hash,
      subject, predicate, object,
      confidence, temporality,
      origin_peer_id: origin_peer_id ?? this.peerId,
      vector_clock,
      derived_from: derived_from ?? null,
    };
    t.signature = signTriple(this.identity.privateKeyPem, t);
    return t;
  }

  // Exportierbares Wire-Tripel aus einer Edge-Zeile (für Push/Export).
  _edgeToWire(edge) {
    return {
      wire_version: WIRE_VERSION,
      triple_hash: edge.triple_hash,
      subject: this._nodeName(edge.subject_id),
      predicate: edge.predicate,
      object: this._nodeName(edge.object_id),
      confidence: edge.confidence,
      temporality: edge.temporality,
      origin_peer_id: edge.origin_peer_id,
      vector_clock: JSON.parse(edge.vector_clock),
      derived_from: edge.derived_from ? JSON.parse(edge.derived_from) : null,
      signature: edge.signature,
    };
  }

  // ---- UC-02: Abfragen (Subgraph + effektive Konfidenz) --------------
  query(term, { maxDepth = 1, explain = false } = {}) {
    let depth = Number.isInteger(maxDepth) ? maxDepth : 1;
    if (depth > 3) depth = 3;
    if (depth < 1) depth = 1;

    const start = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(term);
    if (!start) return { nodes: [], edges: [], truncated: false, message: 'No matching nodes found.' };

    const visited = new Set([start.id]);
    let frontier = [start.id];
    const edgeRows = new Map();
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const nid of frontier) {
        const rows = this.db.prepare(
          "SELECT * FROM knowledge_edges WHERE (subject_id=? OR object_id=?) AND local_status='active'",
        ).all(nid, nid);
        for (const e of rows) {
          edgeRows.set(e.triple_hash, e);
          const other = e.subject_id === nid ? e.object_id : e.subject_id;
          if (!visited.has(other)) { visited.add(other); next.push(other); }
        }
      }
      frontier = next;
    }

    const all = [...edgeRows.values()];
    const truncated = all.length > 25;
    const edges = all.slice(0, 25).map((e) => {
      const out = {
        subject: this._nodeName(e.subject_id),
        predicate: e.predicate,
        object: this._nodeName(e.object_id),
        confidence: e.confidence,
        effective_confidence: this._effectiveConfidence(e),
        origin_peer_id: e.origin_peer_id,
      };
      if (explain && e.derived_from) out.derived_from = JSON.parse(e.derived_from);
      return out;
    });
    return { nodes: [...visited].map((id) => this._nodeName(id)), edges, truncated };
  }

  // Lokale Lese-Linse: effektive Konfidenz = trunc(conf * trustFactor / 1000).
  _effectiveConfidence(edge) {
    if (edge.origin_peer_id === this.peerId) return edge.confidence; // eigenes Wissen
    const peer = this._peer(edge.origin_peer_id);
    const level = peer?.trust_level ?? 'untrusted';
    return trunc((edge.confidence * trustFactor(this.spec, level)) / 1000);
  }

  // ---- UC-03: Forward-Chaining-Inferenz ------------------------------
  infer() {
    let created = 0, updated = 0;
    for (const rule of this.spec.inferenceRules) {
      for (const binding of this._matchPremises(rule.premises)) {
        const concl = this._bind(rule.conclusion, binding.vars);
        const minConf = Math.min(...binding.confidences);
        const confidence = trunc((minConf * rule.factor) / 1000);
        const hash = tripleHash(concl.subject, concl.predicate, concl.object);
        const existing = this._getEdge(hash);
        const status = confidence < this.spec.quarantineThreshold ? 'quarantined' : 'active';
        const derived = JSON.stringify({ from: binding.hashes, rule_id: rule.id });
        const clock = this._tick();
        if (existing) {
          const merged = Math.max(existing.confidence, confidence);
          this.db.prepare("UPDATE knowledge_edges SET confidence=?, derived_from=?, updated_at=datetime('now') WHERE triple_hash=?")
            .run(merged, derived, hash);
          updated++;
        } else {
          const sId = this._ensureNode(concl.subject);
          const oId = this._ensureNode(concl.object);
          const triple = this._wire({ hash, ...concl, confidence, temporality: 'stable', vector_clock: clock, derived_from: { from: binding.hashes, rule_id: rule.id } });
          this.db.prepare(
            `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, temporality, local_status, origin_peer_id, signature, vector_clock, derived_from)
             VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
          ).run(hash, sId, concl.predicate, oId, confidence, 'stable', status, this.peerId, triple.signature, JSON.stringify(clock), derived);
          created++;
        }
      }
    }
    return { created, updated };
  }

  _activeEdges() {
    return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all();
  }
  // Sehr einfaches Pattern-Matching mit '?var'-Bindungen über alle Prämissen.
  _matchPremises(premises) {
    let states = [{ vars: {}, confidences: [], hashes: [] }];
    for (const pat of premises) {
      const next = [];
      for (const st of states) {
        for (const e of this._activeEdges()) {
          const triple = { subject: this._nodeName(e.subject_id), predicate: e.predicate, object: this._nodeName(e.object_id) };
          const m = this._unify(pat, triple, st.vars);
          if (m) next.push({ vars: m, confidences: [...st.confidences, e.confidence], hashes: [...st.hashes, e.triple_hash] });
        }
      }
      states = next;
    }
    return states;
  }
  _unify(pattern, triple, vars) {
    const out = { ...vars };
    for (const field of ['subject', 'predicate', 'object']) {
      const p = pattern[field];
      if (p.startsWith('?')) {
        if (out[p] !== undefined && out[p] !== triple[field]) return null;
        out[p] = triple[field];
      } else if (p !== triple[field]) return null;
    }
    return out;
  }
  _bind(pattern, vars) {
    const r = (v) => (v.startsWith('?') ? vars[v] : v);
    return { subject: r(pattern.subject), predicate: r(pattern.predicate), object: r(pattern.object) };
  }

  // ---- UC-04: Decay & Reinforcement ----------------------------------
  decayPass({ dryRun = false } = {}) {
    const edges = this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all();
    let decayed = 0, superseded = 0;
    for (const e of edges) {
      const reduction = this.spec.decayPerPeriod[e.temporality] ?? 0;
      if (reduction === 0) continue;
      const newConf = Math.max(0, e.confidence - reduction);
      if (newConf < this.spec.deleteThreshold) {
        superseded++;
        if (!dryRun) this.db.prepare("UPDATE knowledge_edges SET confidence=?, local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(newConf, e.triple_hash);
      } else {
        decayed++;
        if (!dryRun) this.db.prepare("UPDATE knowledge_edges SET confidence=?, updated_at=datetime('now') WHERE triple_hash=?").run(newConf, e.triple_hash);
      }
    }
    return { decayed, superseded, dryRun };
  }
  reinforce(hash) {
    const e = this._getEdge(hash);
    if (!e) return null;
    const newConf = Math.min(e.confidence + this.spec.reinforceDelta, 1000);
    this.db.prepare("UPDATE knowledge_edges SET confidence=?, updated_at=datetime('now') WHERE triple_hash=?").run(newConf, hash);
    return newConf;
  }

  // ---- UC-05: Quarantäne ---------------------------------------------
  quarantineList() {
    return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='quarantined'").all().map((e) => this._edgeToWire(e));
  }
  promote(hash) {
    const e = this._getEdge(hash);
    if (!e) return false;
    if (!verifyTriple(this._originPubKey(e), this._edgeToWire(e), e.signature)) {
      throw new EngineError('UNVERIFIED_ORIGIN', 'Signatur nicht verifizierbar');
    }
    this.db.prepare("UPDATE knowledge_edges SET local_status='active', updated_at=datetime('now') WHERE triple_hash=?").run(hash);
    return true;
  }
  reject(hash) {
    this.db.prepare("UPDATE knowledge_edges SET local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(hash);
  }
  _originPubKey(edge) {
    if (edge.origin_peer_id === this.peerId) return this.identity.publicKeyPem;
    return this._peer(edge.origin_peer_id)?.public_key;
  }

  // ---- UC-08: Merge eines eingehenden Wire-Tripels -------------------
  // Gibt 'accepted' | 'quarantined' | 'rejected' | 'ignored' zurück.
  mergeIncoming(wire, { peerTrust = 'untrusted' } = {}) {
    if (wire.wire_version !== WIRE_VERSION) return 'rejected'; // Versions-Gate
    const existing = this._getEdge(wire.triple_hash);

    // Replay-Schutz: superseder + kausal dominiert → ignorieren.
    if (existing && existing.local_status === 'superseded') {
      if (clockLEQ(wire.vector_clock, JSON.parse(existing.vector_clock))) return 'ignored';
    }

    if (existing) {
      // Gleicher Hash = gleicher Inhalt: nur Konfidenz/Clock mergen (trust-unabhängig).
      const merged = Math.max(existing.confidence, wire.confidence);
      const vc = clockMax(JSON.parse(existing.vector_clock), wire.vector_clock);
      this.db.prepare("UPDATE knowledge_edges SET confidence=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
        .run(merged, JSON.stringify(vc), wire.triple_hash);
      return 'accepted';
    }

    // Inhaltlicher Widerspruch (gleiches S+P, anderes O) → Quarantäne; authoritative gewinnt lokal.
    const sId = this._ensureNode(wire.subject);
    const oId = this._ensureNode(wire.object);
    const conflict = this.db.prepare(
      "SELECT * FROM knowledge_edges WHERE subject_id=? AND predicate=? AND object_id!=? AND local_status='active'",
    ).all(sId, wire.predicate, oId);

    let status = peerTrust === 'untrusted' ? 'quarantined' : 'active';
    if (conflict.length > 0) {
      if (peerTrust === 'authoritative') {
        for (const c of conflict) this.reject(c.triple_hash); // authoritative gewinnt lokal
        status = 'active';
      } else {
        status = 'quarantined';
        for (const c of conflict) this.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE triple_hash=?").run(c.triple_hash);
      }
    }
    this.db.prepare(
      `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, temporality, local_status, origin_peer_id, signature, vector_clock, derived_from)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(wire.triple_hash, sId, wire.predicate, oId, wire.confidence, wire.temporality, status, wire.origin_peer_id, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
    return status === 'active' ? 'accepted' : 'quarantined';
  }

  // ---- UC-09: Peer-Trust & Identität ---------------------------------
  peerAdd(peerId, publicKeyPem, endpoint = null) {
    const fp = fingerprint(publicKeyPem);
    const existing = this._peer(peerId);
    if (existing) throw new EngineError('PEER_EXISTS', 'Peer existiert bereits — peerRotate nutzen');
    this.db.prepare('INSERT INTO peers (peer_id, public_key, fingerprint, endpoint, trust_level) VALUES (?,?,?,?,?)')
      .run(peerId, publicKeyPem, fp, endpoint, 'untrusted');
    return { peerId, fingerprint: fp, trust_level: 'untrusted' };
  }
  peerTrust(peerId, level) {
    if (!['untrusted', 'limited', 'full', 'authoritative'].includes(level)) throw new EngineError('INVALID_TRUST_LEVEL');
    this.db.prepare('UPDATE peers SET trust_level=? WHERE peer_id=?').run(level, peerId);
  }
  peerRotate(peerId, newPublicKeyPem) {
    const fp = fingerprint(newPublicKeyPem);
    this.db.prepare('UPDATE peers SET public_key=?, fingerprint=? WHERE peer_id=?').run(newPublicKeyPem, fp, peerId);
    return fp;
  }
  peerRevoke(peerId) {
    this.db.prepare("UPDATE peers SET trust_level='untrusted' WHERE peer_id=?").run(peerId);
    // bereits gemergte Fakten dieses Peers → Quarantäne zur Re-Review
    this.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE origin_peer_id=? AND local_status='active'").run(peerId);
  }

  // ---- Export/Pull/Push/Clone (UC-06/07/11) --------------------------
  // Exportiert Wire-Tripel; --since als Vector-Clock-Delta. Beim Export
  // re-signiert dieser Knoten mit eigenem Schlüssel (transitives Vouching),
  // origin_peer_id = self → der Empfänger prüft gegen den Sender-Key.
  exportSince(sinceClock = {}) {
    const rows = this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status IN ('active','quarantined')").all();
    return rows
      .map((e) => this._edgeToWire(e))
      .filter((w) => !clockLEQ(w.vector_clock, sinceClock))
      .map((w) => this._reSignForExport(w));
  }
  _reSignForExport(wire) {
    const w = { ...wire, origin_peer_id: this.peerId };
    w.signature = signTriple(this.identity.privateKeyPem, w);
    return w;
  }
  // Empfängt einen signierten Batch (Gegenstück zum Push des Peers).
  receiveIngest(batch, peerId) {
    const peer = this._peer(peerId);
    const result = [];
    for (const wire of batch) {
      if (wire.wire_version !== WIRE_VERSION) { result.push({ triple_hash: wire.triple_hash, status: 'rejected' }); continue; }
      const pub = peer?.public_key;
      if (!pub || !verifyTriple(pub, wire, wire.signature)) {
        result.push({ triple_hash: wire.triple_hash, status: 'rejected' });
        continue;
      }
      const status = this.mergeIncoming(wire, { peerTrust: peer?.trust_level ?? 'untrusted' });
      result.push({ triple_hash: wire.triple_hash, status });
    }
    return result;
  }

  // Pull: holt Delta vom Peer-Transport, verifiziert + merged.
  pull(transport, peerId) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const since = peer.last_clock ? JSON.parse(peer.last_clock) : {};
    const batch = transport.exportSince(since);
    const tally = { received: 0, accepted: 0, quarantined: 0, rejected: 0, ignored: 0 };
    let maxClock = since;
    for (const wire of batch) {
      tally.received++;
      if (wire.wire_version !== WIRE_VERSION || !verifyTriple(peer.public_key, wire, wire.signature)) {
        tally.rejected++;
        continue;
      }
      const status = this.mergeIncoming(wire, { peerTrust: peer.trust_level });
      tally[status] = (tally[status] ?? 0) + 1;
      maxClock = clockMax(maxClock, wire.vector_clock);
    }
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return tally;
  }

  // Push: sendet lokales Delta an den Peer-Transport.
  push(transport, peerId) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const since = peer.last_clock ? JSON.parse(peer.last_clock) : {};
    const batch = this.exportSince(since);
    const statuses = transport.receiveIngest(batch, this.peerId);
    let maxClock = since;
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return statuses;
  }

  // UC-11: Clone — Voll-Replik, Default in Quarantäne, optional Bulk-Promote.
  clone(transport, peerId, { bulkPromote = false } = {}) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const batch = transport.exportSince({});
    let cloned = 0, rejected = 0;
    for (const wire of batch) {
      if (wire.wire_version !== WIRE_VERSION || !verifyTriple(peer.public_key, { ...wire, signature: undefined }, wire.signature)) { rejected++; continue; }
      const sId = this._ensureNode(wire.subject);
      const oId = this._ensureNode(wire.object);
      const status = bulkPromote ? 'active' : 'quarantined';
      this.db.prepare(
        `INSERT OR IGNORE INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, temporality, local_status, origin_peer_id, signature, vector_clock, derived_from)
         VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(wire.triple_hash, sId, wire.predicate, oId, wire.confidence, wire.temporality, status, wire.origin_peer_id, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
      cloned++;
    }
    let maxClock = {};
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return { cloned, rejected, bulkPromote };
  }
}
