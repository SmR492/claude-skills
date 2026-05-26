// NSAI-Edge Engine — lokaler neuro-symbolischer Wissensgraph-Knoten.
// KONZEPT v2.2 + Provenienz-Modell B (Review 0001): origin_peer_id = Erstbehaupter,
// signiert über die UNVERÄNDERLICHE Aussage (asserted_confidence). Kein Re-Sign beim
// Export; relayed_by = letzter Hop (unsigniert). Trust hängt am Origin, nie am Relay.
// Decay/Reinforcement wirken nur auf den lokalen Live-Wert `confidence`.
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

const clockMax = (a, b) => {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) out[k] = Math.max(out[k] ?? 0, v);
  return out;
};
const clockLEQ = (a, b) => Object.entries(a).every(([k, v]) => v <= (b[k] ?? 0));

function validateTriple(subject, predicate, object) {
  if (!RE_SUBJECT.test(String(subject ?? '')) || !RE_SUBJECT.test(String(object ?? '')) || !RE_PREDICATE.test(String(predicate ?? ''))) {
    throw new EngineError('INVALID_PARAMETER_FORMAT', 'subject/predicate/object verletzen das Format');
  }
}

export class Engine {
  constructor({ dbPath = ':memory:', identity, spec = DEFAULT_SPEC, peerId } = {}) {
    this.db = openDb(dbPath);
    this.identity = identity ?? createIdentity();
    this.spec = spec;
    this.peerId = peerId ?? `peer:${this.identity.fingerprint.slice(0, 12)}`;
    // Vector-Clock-Selbstzähler aus der DB rekonstruieren (überlebt Neustart, kein Rückschritt).
    this._clock = this._maxSelfClock();
  }

  _maxSelfClock() {
    let max = 0;
    for (const row of this.db.prepare('SELECT vector_clock FROM knowledge_edges').all()) {
      try { max = Math.max(max, JSON.parse(row.vector_clock)[this.peerId] ?? 0); } catch { /* ignore */ }
    }
    return max;
  }

  // ---- interne Helfer -------------------------------------------------
  _ensureNode(name) {
    const row = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(name);
    if (row) return row.id;
    const id = randomUUID();
    this.db.prepare('INSERT INTO knowledge_nodes (id, name) VALUES (?, ?)').run(id, name);
    return id;
  }
  _nodeName(id) { return this.db.prepare('SELECT name FROM knowledge_nodes WHERE id = ?').get(id)?.name; }
  _getEdge(hash) { return this.db.prepare('SELECT * FROM knowledge_edges WHERE triple_hash = ?').get(hash); }
  _peer(peerId) { return this.db.prepare('SELECT * FROM peers WHERE peer_id = ?').get(peerId); }
  _tick() { this._clock += 1; return { [this.peerId]: this._clock }; }
  _tx(fn) {
    this.db.exec('BEGIN IMMEDIATE');
    try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; }
  }

  // Public-Key des Erstbehaupters (origin); self → eigene Identität, sonst Peer-Registry.
  _originPubKey(originPeerId) {
    if (originPeerId === this.peerId) return this.identity.publicKeyPem;
    return this._peer(originPeerId)?.public_key ?? null;
  }
  _originTrust(originPeerId) {
    if (originPeerId === this.peerId) return 'full';
    return this._peer(originPeerId)?.trust_level ?? 'untrusted';
  }

  // Signierte Wire-Aussage bauen (Origin = self, asserted_confidence ist der signierte Wert).
  _signSelf({ hash, subject, predicate, object, asserted_confidence, temporality, vector_clock, derived_from }) {
    const t = {
      wire_version: WIRE_VERSION, triple_hash: hash, subject, predicate, object,
      asserted_confidence, temporality, origin_peer_id: this.peerId, derived_from: derived_from ?? null,
    };
    t.signature = signTriple(this.identity.privateKeyPem, t);
    t.confidence = asserted_confidence;
    t.vector_clock = vector_clock;
    t.relayed_by = this.peerId;
    return t;
  }

  _edgeToWire(edge) {
    return {
      wire_version: WIRE_VERSION,
      triple_hash: edge.triple_hash,
      subject: this._nodeName(edge.subject_id),
      predicate: edge.predicate,
      object: this._nodeName(edge.object_id),
      confidence: edge.confidence,                       // lokaler Live-Wert
      asserted_confidence: edge.asserted_confidence,     // signierter Origin-Wert
      temporality: edge.temporality,
      origin_peer_id: edge.origin_peer_id,
      relayed_by: edge.relayed_by,
      vector_clock: JSON.parse(edge.vector_clock),
      derived_from: edge.derived_from ? JSON.parse(edge.derived_from) : null,
      signature: edge.signature,
    };
  }

  // ---- UC-01: Tripel lokal erfassen ----------------------------------
  storeTriple({ subject, predicate, object, confidence = 700, temporality = 'stable', context_slug = null }) {
    validateTriple(subject, predicate, object);
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 1000) {
      throw new EngineError('INVALID_PARAMETER_FORMAT', 'confidence außerhalb 0–1000');
    }
    if (!TEMPORALITIES.has(temporality)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'temporality ungültig');
    if (!this.identity) throw new EngineError('NO_PEER_IDENTITY', 'keine lokale Identität');

    const hash = tripleHash(subject, predicate, object);
    return this._tx(() => {
      const existing = this._getEdge(hash);
      const clock = this._tick();
      if (existing) {
        const asserted = Math.max(existing.asserted_confidence, confidence);
        const vc = clockMax(JSON.parse(existing.vector_clock), clock);
        const t = this._signSelf({ hash, subject, predicate, object, asserted_confidence: asserted, temporality: existing.temporality, vector_clock: vc, derived_from: existing.derived_from ? JSON.parse(existing.derived_from) : null });
        this.db.prepare(
          "UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?",
        ).run(Math.max(existing.confidence, confidence), asserted, this.peerId, this.peerId, t.signature, JSON.stringify(vc), hash);
        return { triple_hash: hash, confidence: Math.max(existing.confidence, confidence), status: existing.local_status, created: false };
      }
      const subjectId = this._ensureNode(subject);
      const objectId = this._ensureNode(object);
      const t = this._signSelf({ hash, subject, predicate, object, asserted_confidence: confidence, temporality, vector_clock: clock, derived_from: null });
      this.db.prepare(
        `INSERT INTO knowledge_edges
          (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from, context_slug)
         VALUES (?,?,?,?,?,?,?, 'active', ?,?,?,?, NULL, ?)`,
      ).run(hash, subjectId, predicate, objectId, confidence, confidence, temporality, this.peerId, this.peerId, t.signature, JSON.stringify(clock), context_slug);
      return { triple_hash: hash, confidence, status: 'active', created: true };
    });
  }

  // ---- UC-02: Abfragen (Subgraph + effektive Konfidenz) --------------
  query(term, { maxDepth = 1, explain = false } = {}) {
    let depth = Number.isInteger(maxDepth) ? maxDepth : 1;
    depth = Math.max(1, Math.min(3, depth));
    const start = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(term);
    if (!start) return { nodes: [], edges: [], truncated: false, message: 'No matching nodes found.' };

    const visited = new Set([start.id]);
    let frontier = [start.id];
    const edgeRows = new Map();
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const nid of frontier) {
        for (const e of this.db.prepare("SELECT * FROM knowledge_edges WHERE (subject_id=? OR object_id=?) AND local_status='active'").all(nid, nid)) {
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
        subject: this._nodeName(e.subject_id), predicate: e.predicate, object: this._nodeName(e.object_id),
        confidence: e.confidence, effective_confidence: this._effectiveConfidence(e),
        origin_peer_id: e.origin_peer_id,
      };
      if (e.relayed_by && e.relayed_by !== e.origin_peer_id) out.relayed_by = e.relayed_by;
      if (explain && e.derived_from) out.derived_from = JSON.parse(e.derived_from);
      return out;
    });
    return { nodes: [...visited].map((id) => this._nodeName(id)), edges, truncated };
  }

  // Lokale Lese-Linse: effektive Konfidenz = trunc(Live-confidence * trustFactor(ORIGIN) / 1000).
  _effectiveConfidence(edge) {
    if (edge.origin_peer_id === this.peerId) return edge.confidence;
    return trunc((edge.confidence * trustFactor(this.spec, this._originTrust(edge.origin_peer_id))) / 1000);
  }

  // ---- UC-03: Forward-Chaining-Inferenz ------------------------------
  infer() {
    return this._tx(() => {
      let created = 0, updated = 0;
      for (const rule of this.spec.inferenceRules) {
        for (const binding of this._matchPremises(rule.premises)) {
          const concl = this._bind(rule.conclusion, binding.vars);
          const confidence = trunc((Math.min(...binding.confidences) * rule.factor) / 1000);
          const hash = tripleHash(concl.subject, concl.predicate, concl.object);
          const existing = this._getEdge(hash);
          const status = confidence < this.spec.quarantineThreshold ? 'quarantined' : 'active';
          const derivedObj = { from: binding.hashes, rule_id: rule.id };
          const clock = this._tick();
          if (existing) {
            const asserted = Math.max(existing.asserted_confidence, confidence);
            this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, derived_from=?, updated_at=datetime('now') WHERE triple_hash=?")
              .run(Math.max(existing.confidence, confidence), asserted, JSON.stringify(derivedObj), hash);
            updated++;
          } else {
            const sId = this._ensureNode(concl.subject);
            const oId = this._ensureNode(concl.object);
            const t = this._signSelf({ hash, ...concl, asserted_confidence: confidence, temporality: 'stable', vector_clock: clock, derived_from: derivedObj });
            this.db.prepare(
              `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            ).run(hash, sId, concl.predicate, oId, confidence, confidence, 'stable', status, this.peerId, this.peerId, t.signature, JSON.stringify(clock), JSON.stringify(derivedObj));
            created++;
          }
        }
      }
      return { created, updated };
    });
  }

  _activeEdges() { return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all(); }
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
    for (const f of ['subject', 'predicate', 'object']) {
      const p = pattern[f];
      if (p.startsWith('?')) { if (out[p] !== undefined && out[p] !== triple[f]) return null; out[p] = triple[f]; }
      else if (p !== triple[f]) return null;
    }
    return out;
  }
  _bind(pattern, vars) {
    const r = (v) => (v.startsWith('?') ? vars[v] : v);
    return { subject: r(pattern.subject), predicate: r(pattern.predicate), object: r(pattern.object) };
  }

  // ---- UC-04: Decay & Reinforcement (nur lokaler Live-Wert) ----------
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
  quarantineList() { return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='quarantined'").all().map((e) => this._edgeToWire(e)); }
  promote(hash) {
    const e = this._getEdge(hash);
    if (!e) return false;
    const pub = this._originPubKey(e.origin_peer_id);
    if (!pub || !verifyTriple(pub, this._edgeToWire(e), e.signature)) {
      throw new EngineError('UNVERIFIED_ORIGIN', 'Origin-Signatur nicht verifizierbar');
    }
    this.db.prepare("UPDATE knowledge_edges SET local_status='active', updated_at=datetime('now') WHERE triple_hash=?").run(hash);
    return true;
  }
  reject(hash) { this.db.prepare("UPDATE knowledge_edges SET local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(hash); }

  // ---- UC-08: Merge eines bereits VERIFIZIERTEN Wire-Tripels ---------
  // peerTrust = Trust des ORIGIN (Erstbehaupter), nicht des Relays.
  mergeIncoming(wire, { peerTrust = 'untrusted' } = {}) {
    if (wire.wire_version !== WIRE_VERSION) return 'rejected';
    validateTriple(wire.subject, wire.predicate, wire.object);
    const asserted = wire.asserted_confidence ?? wire.confidence;
    const existing = this._getEdge(wire.triple_hash);

    if (existing && existing.local_status === 'superseded' && clockLEQ(wire.vector_clock, JSON.parse(existing.vector_clock))) {
      return 'ignored'; // Replay-Schutz
    }
    if (existing) {
      const newAsserted = Math.max(existing.asserted_confidence, asserted);
      const vc = clockMax(JSON.parse(existing.vector_clock), wire.vector_clock);
      // Höhere Origin-Aussage gewinnt + bringt ihre Signatur/Origin mit (Zeile bleibt verifizierbar).
      if (asserted > existing.asserted_confidence) {
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(Math.max(existing.confidence, asserted), newAsserted, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(vc), wire.triple_hash);
      } else {
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(Math.max(existing.confidence, asserted), JSON.stringify(vc), wire.triple_hash);
      }
      return 'accepted';
    }

    const sId = this._ensureNode(wire.subject);
    const oId = this._ensureNode(wire.object);
    const conflict = this.db.prepare("SELECT * FROM knowledge_edges WHERE subject_id=? AND predicate=? AND object_id!=? AND local_status='active'").all(sId, wire.predicate, oId);
    let status = peerTrust === 'untrusted' ? 'quarantined' : 'active';
    if (conflict.length > 0) {
      if (peerTrust === 'authoritative') { for (const c of conflict) this.reject(c.triple_hash); status = 'active'; }
      else { status = 'quarantined'; for (const c of conflict) this.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE triple_hash=?").run(c.triple_hash); }
    }
    this.db.prepare(
      `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(wire.triple_hash, sId, wire.predicate, oId, asserted, asserted, wire.temporality, status, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
    return status === 'active' ? 'accepted' : 'quarantined';
  }

  // Verifiziert ein Wire gegen den ORIGIN-Key (Modell B). Unbekannter Origin → null (reject).
  _verifyAgainstOrigin(wire) {
    if (wire.wire_version !== WIRE_VERSION) return false;
    const pub = this._originPubKey(wire.origin_peer_id);
    if (!pub) return false; // Web-of-Trust: Origin muss bekannt sein
    return verifyTriple(pub, wire, wire.signature);
  }

  // ---- UC-09: Peer-Trust & Identität ---------------------------------
  peerAdd(peerId, publicKeyPem, endpoint = null) {
    if (this._peer(peerId)) throw new EngineError('PEER_EXISTS', 'Peer existiert bereits — peerRotate nutzen');
    const fp = fingerprint(publicKeyPem);
    this.db.prepare('INSERT INTO peers (peer_id, public_key, fingerprint, endpoint, trust_level) VALUES (?,?,?,?,?)').run(peerId, publicKeyPem, fp, endpoint, 'untrusted');
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
    this.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE origin_peer_id=? AND local_status='active'").run(peerId);
  }

  // ---- Export / Pull / Push / Clone (UC-06/07/11) --------------------
  // Export forwarded die UNVERÄNDERTE Origin-Signatur (kein Re-Sign), setzt nur relayed_by=self.
  exportSince(sinceClock = {}) {
    return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all()
      .map((e) => this._edgeToWire(e))
      .filter((w) => !clockLEQ(w.vector_clock, sinceClock))
      .map((w) => ({ ...w, relayed_by: this.peerId }));
  }
  // Empfängt einen Batch: verifiziert je Tripel gegen den ORIGIN-Key, Trust = Origin-Trust.
  receiveIngest(batch) {
    const result = [];
    for (const wire of batch) {
      if (!this._verifyAgainstOrigin(wire)) { result.push({ triple_hash: wire.triple_hash, status: 'rejected' }); continue; }
      let status;
      try { status = this.mergeIncoming(wire, { peerTrust: this._originTrust(wire.origin_peer_id) }); }
      catch { result.push({ triple_hash: wire.triple_hash, status: 'rejected' }); continue; }
      result.push({ triple_hash: wire.triple_hash, status });
    }
    return result;
  }
  pull(transport, peerId) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const since = peer.last_clock ? JSON.parse(peer.last_clock) : {};
    const batch = transport.exportSince(since);
    const tally = { received: 0, accepted: 0, quarantined: 0, rejected: 0, ignored: 0 };
    let maxClock = since;
    for (const wire of batch) {
      tally.received++;
      if (!this._verifyAgainstOrigin(wire)) { tally.rejected++; continue; }
      let status;
      try { status = this.mergeIncoming(wire, { peerTrust: this._originTrust(wire.origin_peer_id) }); }
      catch { tally.rejected++; continue; }
      tally[status] = (tally[status] ?? 0) + 1;
      maxClock = clockMax(maxClock, wire.vector_clock);
    }
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return tally;
  }
  push(transport, peerId) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const since = peer.last_clock ? JSON.parse(peer.last_clock) : {};
    const batch = this.exportSince(since);
    const statuses = transport.receiveIngest(batch);
    let maxClock = since;
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return statuses;
  }
  clone(transport, peerId, { bulkPromote = false } = {}) {
    if (!this._peer(peerId)) throw new EngineError('PEER_UNKNOWN');
    const batch = transport.exportSince({});
    let cloned = 0, rejected = 0;
    for (const wire of batch) {
      if (!this._verifyAgainstOrigin(wire)) { rejected++; continue; }
      try { validateTriple(wire.subject, wire.predicate, wire.object); } catch { rejected++; continue; }
      const sId = this._ensureNode(wire.subject);
      const oId = this._ensureNode(wire.object);
      const asserted = wire.asserted_confidence ?? wire.confidence;
      this.db.prepare(
        `INSERT OR IGNORE INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(wire.triple_hash, sId, wire.predicate, oId, asserted, asserted, wire.temporality, bulkPromote ? 'active' : 'quarantined', wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
      cloned++;
    }
    let maxClock = {};
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return { cloned, rejected, bulkPromote };
  }
}
