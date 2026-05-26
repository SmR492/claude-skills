// NSAI-Edge Engine — lokaler neuro-symbolischer Wissensgraph-Knoten.
// KONZEPT v2.3 + Provenienz-Modell B + Evidenz-Gewichtung.
// - origin_peer_id = Erstbehaupter, signiert über die UNVERÄNDERLICHE Aussage
//   (asserted_confidence, source_type, asserted_at). Kein Re-Sign; relayed_by = Hop.
// - Trust am Origin (Web-of-Trust-Verify), nie am Relay.
// - Konflikt-Auflösung NEURO-SYMBOLISCH zur Lesezeit: belief = softmax über distinkte
//   Objekte mit score = authority(source_type) × recency(asserted_at) × confidence.
//   Anzahl der Quellen zählt nie (max je Objekt). Veraltetes/Falsches sinkt im Belief
//   gegen 0, bleibt aber auditierbar + revidierbar (non-monoton, BEWA-Stil).
import { randomUUID } from 'node:crypto';
import { openDb } from './db.mjs';
import { tripleHash } from './canonical.mjs';
import { createIdentity, signTriple, verifyTriple, fingerprint } from './identity.mjs';
import { DEFAULT_SPEC, WIRE_VERSION, trunc, trustFactor } from './rules.mjs';

const RE_SUBJECT = /^[\w\-\\.:]{2,160}$/;
const RE_PREDICATE = /^[a-z_]{2,50}$/;
const TEMPORALITIES = new Set(['eternal', 'stable', 'temporal', 'ephemeral']);
const EPOCH = '1970-01-01T00:00:00Z';

export class EngineError extends Error {
  constructor(code, message) { super(message ? `${code}: ${message}` : code); this.code = code; }
}

const clockMax = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Math.max(o[k] ?? 0, v); return o; };
const clockLEQ = (a, b) => Object.entries(a).every(([k, v]) => v <= (b[k] ?? 0));

function validateTriple(subject, predicate, object) {
  if (!RE_SUBJECT.test(String(subject ?? '')) || !RE_SUBJECT.test(String(object ?? '')) || !RE_PREDICATE.test(String(predicate ?? ''))) {
    throw new EngineError('INVALID_PARAMETER_FORMAT', 'subject/predicate/object verletzen das Format');
  }
}

export class Engine {
  constructor({ dbPath = ':memory:', identity, spec = DEFAULT_SPEC, peerId, now } = {}) {
    this.db = openDb(dbPath);
    this.identity = identity ?? createIdentity();
    this.spec = spec;
    this.peerId = peerId ?? `peer:${this.identity.fingerprint.slice(0, 12)}`;
    this._now = now ?? (() => Date.now()); // injizierbar für deterministische Tests
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
  _tx(fn) { this.db.exec('BEGIN IMMEDIATE'); try { const r = fn(); this.db.exec('COMMIT'); return r; } catch (e) { this.db.exec('ROLLBACK'); throw e; } }
  _originPubKey(o) { return o === this.peerId ? this.identity.publicKeyPem : (this._peer(o)?.public_key ?? null); }
  _originTrust(o) { return o === this.peerId ? 'full' : (this._peer(o)?.trust_level ?? 'untrusted'); }

  _signSelf({ hash, subject, predicate, object, asserted_confidence, source_type, asserted_at, temporality, vector_clock, derived_from }) {
    const t = {
      wire_version: WIRE_VERSION, triple_hash: hash, subject, predicate, object,
      asserted_confidence, temporality, source_type, asserted_at, origin_peer_id: this.peerId, derived_from: derived_from ?? null,
    };
    t.signature = signTriple(this.identity.privateKeyPem, t);
    t.confidence = asserted_confidence; t.vector_clock = vector_clock; t.relayed_by = this.peerId;
    return t;
  }
  _edgeToWire(e) {
    return {
      wire_version: WIRE_VERSION, triple_hash: e.triple_hash,
      subject: this._nodeName(e.subject_id), predicate: e.predicate, object: this._nodeName(e.object_id),
      confidence: e.confidence, asserted_confidence: e.asserted_confidence,
      source_type: e.source_type, asserted_at: e.asserted_at, temporality: e.temporality,
      origin_peer_id: e.origin_peer_id, relayed_by: e.relayed_by,
      vector_clock: JSON.parse(e.vector_clock), derived_from: e.derived_from ? JSON.parse(e.derived_from) : null,
      signature: e.signature,
    };
  }

  // ---- UC-01: Tripel lokal erfassen ----------------------------------
  storeTriple({ subject, predicate, object, confidence = 700, temporality = 'stable', source_type = 'manual', asserted_at = null, context_slug = null }) {
    validateTriple(subject, predicate, object);
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 1000) throw new EngineError('INVALID_PARAMETER_FORMAT', 'confidence außerhalb 0–1000');
    if (!TEMPORALITIES.has(temporality)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'temporality ungültig');
    if (!this.identity) throw new EngineError('NO_PEER_IDENTITY', 'keine lokale Identität');
    const ts = asserted_at ?? new Date(this._now()).toISOString();
    const hash = tripleHash(subject, predicate, object);
    return this._tx(() => {
      const existing = this._getEdge(hash);
      const clock = this._tick();
      if (existing) {
        const asserted = Math.max(existing.asserted_confidence, confidence);
        const vc = clockMax(JSON.parse(existing.vector_clock), clock);
        const t = this._signSelf({ hash, subject, predicate, object, asserted_confidence: asserted, source_type, asserted_at: ts, temporality: existing.temporality, vector_clock: vc, derived_from: existing.derived_from ? JSON.parse(existing.derived_from) : null });
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, source_type=?, asserted_at=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(Math.max(existing.confidence, confidence), asserted, source_type, ts, this.peerId, this.peerId, t.signature, JSON.stringify(vc), hash);
        return { triple_hash: hash, confidence: Math.max(existing.confidence, confidence), status: existing.local_status, created: false };
      }
      const sId = this._ensureNode(subject); const oId = this._ensureNode(object);
      const t = this._signSelf({ hash, subject, predicate, object, asserted_confidence: confidence, source_type, asserted_at: ts, temporality, vector_clock: clock, derived_from: null });
      this.db.prepare(
        `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from, context_slug)
         VALUES (?,?,?,?,?,?,?,?,?, 'active', ?,?,?,?, NULL, ?)`,
      ).run(hash, sId, predicate, oId, confidence, confidence, source_type, ts, temporality, this.peerId, this.peerId, t.signature, JSON.stringify(clock), context_slug);
      return { triple_hash: hash, confidence, status: 'active', created: true };
    });
  }

  // ---- Belief-Scoring (neuro-symbolische Lese-Linse) -----------------
  _authority(sourceType) { return this.spec.authorityWeight[sourceType] ?? this.spec.authorityWeight.default ?? 300; }
  _recencyFactor(assertedAt) {
    const t = Date.parse(assertedAt);
    if (Number.isNaN(t)) return 1;
    const ageDays = Math.max(0, (this._now() - t) / 86400000);
    return Math.pow(2, -ageDays / this.spec.recencyHalflifeDays); // ∈ (0,1]
  }
  // Evidenz-Score 0..1000 (Float, rein lokal — nicht föderiert/conformance-relevant).
  _score(edge) {
    return (this._authority(edge.source_type) / 1000) * this._recencyFactor(edge.asserted_at) * edge.confidence;
  }

  // Löst konkurrierende Aussagen (gleiches subject+predicate) zu einer gewichteten
  // Belief-Verteilung über die DISTINKTEN Objekte auf. Softmax über max-Score je Objekt
  // → anzahl-unabhängig. Gibt nach Belief absteigend sortierte Kandidaten + Gewinner.
  resolveBelief(subject, predicate) {
    const sNode = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(subject);
    if (!sNode) return null;
    const edges = this.db.prepare("SELECT * FROM knowledge_edges WHERE subject_id=? AND predicate=? AND local_status='active'").all(sNode.id, predicate);
    if (edges.length === 0) return null;
    const byObject = new Map();
    for (const e of edges) {
      const obj = this._nodeName(e.object_id);
      const sc = this._score(e);
      const cur = byObject.get(obj);
      if (!cur || sc > cur.score) byObject.set(obj, { object: obj, score: sc, source_type: e.source_type, asserted_at: e.asserted_at, confidence: e.confidence, origin_peer_id: e.origin_peer_id });
    }
    const cands = [...byObject.values()];
    // Ratio-basierte Potenz-Normalisierung: belief ∝ score^sharpness. Robust auch bei
    // stark unterschiedlichen Score-Größen (großer Ratio → klarer Gewinner).
    const p = this.spec.beliefSharpness;
    let sum = 0;
    for (const c of cands) { c._w = Math.pow(Math.max(c.score, 0), p); sum += c._w; }
    for (const c of cands) { c.belief = sum > 0 ? Math.round((c._w / sum) * 1000) : 0; delete c._w; c.score = Math.round(c.score); }
    cands.sort((a, b) => b.belief - a.belief);
    const contested = cands.length > 1 && cands[1].belief >= this.spec.contestedThreshold;
    return { subject, predicate, winner: cands[0].object, contested, candidates: cands };
  }

  // ---- UC-02: Abfragen (Subgraph + Belief-Anreicherung) --------------
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
    const beliefCache = new Map();
    const edges = all.slice(0, 25).map((e) => {
      const subject = this._nodeName(e.subject_id); const object = this._nodeName(e.object_id);
      const key = `${subject} ${e.predicate}`;
      if (!beliefCache.has(key)) beliefCache.set(key, this.resolveBelief(subject, e.predicate));
      const res = beliefCache.get(key);
      const cand = res?.candidates.find((c) => c.object === object);
      const out = {
        subject, predicate: e.predicate, object,
        confidence: e.confidence, effective_confidence: this._effectiveConfidence(e),
        belief: cand?.belief ?? 1000, source_type: e.source_type, asserted_at: e.asserted_at,
        origin_peer_id: e.origin_peer_id,
      };
      if (res && res.candidates.length > 1 && res.winner !== object) { out.disputed = true; out.dominant = res.winner; }
      if (e.relayed_by && e.relayed_by !== e.origin_peer_id) out.relayed_by = e.relayed_by;
      if (explain && e.derived_from) out.derived_from = JSON.parse(e.derived_from);
      return out;
    });
    return { nodes: [...visited].map((id) => this._nodeName(id)), edges, truncated };
  }
  // Peer-Liefer-Trust-Linse (orthogonal zur Belief-/Inhalts-Autorität).
  _effectiveConfidence(e) {
    if (e.origin_peer_id === this.peerId) return e.confidence;
    return trunc((e.confidence * trustFactor(this.spec, this._originTrust(e.origin_peer_id))) / 1000);
  }

  // ---- UC-03: Forward-Chaining-Inferenz ------------------------------
  infer() {
    return this._tx(() => {
      let created = 0, updated = 0;
      const nowIso = new Date(this._now()).toISOString();
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
            const sId = this._ensureNode(concl.subject); const oId = this._ensureNode(concl.object);
            const t = this._signSelf({ hash, ...concl, asserted_confidence: confidence, source_type: 'inference', asserted_at: nowIso, temporality: 'stable', vector_clock: clock, derived_from: derivedObj });
            this.db.prepare(
              `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            ).run(hash, sId, concl.predicate, oId, confidence, confidence, 'inference', nowIso, 'stable', status, this.peerId, this.peerId, t.signature, JSON.stringify(clock), JSON.stringify(derivedObj));
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
      for (const st of states) for (const e of this._activeEdges()) {
        const triple = { subject: this._nodeName(e.subject_id), predicate: e.predicate, object: this._nodeName(e.object_id) };
        const m = this._unify(pat, triple, st.vars);
        if (m) next.push({ vars: m, confidences: [...st.confidences, e.confidence], hashes: [...st.hashes, e.triple_hash] });
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
  _bind(pattern, vars) { const r = (v) => (v.startsWith('?') ? vars[v] : v); return { subject: r(pattern.subject), predicate: r(pattern.predicate), object: r(pattern.object) }; }

  // ---- UC-04: Decay & Reinforcement (nur lokaler Live-Wert) ----------
  decayPass({ dryRun = false } = {}) {
    const edges = this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all();
    let decayed = 0, superseded = 0;
    for (const e of edges) {
      const reduction = this.spec.decayPerPeriod[e.temporality] ?? 0;
      if (reduction === 0) continue;
      const newConf = Math.max(0, e.confidence - reduction);
      if (newConf < this.spec.deleteThreshold) { superseded++; if (!dryRun) this.db.prepare("UPDATE knowledge_edges SET confidence=?, local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(newConf, e.triple_hash); }
      else { decayed++; if (!dryRun) this.db.prepare("UPDATE knowledge_edges SET confidence=?, updated_at=datetime('now') WHERE triple_hash=?").run(newConf, e.triple_hash); }
    }
    return { decayed, superseded, dryRun };
  }
  reinforce(hash) {
    const e = this._getEdge(hash);
    if (!e) return null;
    const c = Math.min(e.confidence + this.spec.reinforceDelta, 1000);
    this.db.prepare("UPDATE knowledge_edges SET confidence=?, updated_at=datetime('now') WHERE triple_hash=?").run(c, hash);
    return c;
  }

  // ---- UC-05: Quarantäne ---------------------------------------------
  quarantineList() { return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='quarantined'").all().map((e) => this._edgeToWire(e)); }
  promote(hash) {
    const e = this._getEdge(hash);
    if (!e) return false;
    const pub = this._originPubKey(e.origin_peer_id);
    if (!pub || !verifyTriple(pub, this._edgeToWire(e), e.signature)) throw new EngineError('UNVERIFIED_ORIGIN', 'Origin-Signatur nicht verifizierbar');
    this.db.prepare("UPDATE knowledge_edges SET local_status='active', updated_at=datetime('now') WHERE triple_hash=?").run(hash);
    return true;
  }
  reject(hash) { this.db.prepare("UPDATE knowledge_edges SET local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(hash); }

  // ---- UC-08: Merge eines bereits verifizierten Wire-Tripels ---------
  // Widersprüche werden NICHT mehr hart quarantänisiert — sie koexistieren aktiv und
  // werden zur Lesezeit per Belief gewichtet (neuro-symbolisch). Peer-Trust bleibt der
  // Sicherheits-Gate: untrusted-Origin → Quarantäne (kein stiller Eintritt in den Belief).
  mergeIncoming(wire, { peerTrust = 'untrusted' } = {}) {
    if (wire.wire_version !== WIRE_VERSION) return 'rejected';
    validateTriple(wire.subject, wire.predicate, wire.object);
    const asserted = wire.asserted_confidence ?? wire.confidence;
    const sourceType = wire.source_type ?? 'llm';
    const assertedAt = wire.asserted_at ?? EPOCH;
    const existing = this._getEdge(wire.triple_hash);
    if (existing && existing.local_status === 'superseded' && clockLEQ(wire.vector_clock, JSON.parse(existing.vector_clock))) return 'ignored';
    if (existing) {
      const newAsserted = Math.max(existing.asserted_confidence, asserted);
      const vc = clockMax(JSON.parse(existing.vector_clock), wire.vector_clock);
      if (asserted > existing.asserted_confidence) {
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, source_type=?, asserted_at=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(Math.max(existing.confidence, asserted), newAsserted, sourceType, assertedAt, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(vc), wire.triple_hash);
      } else {
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(Math.max(existing.confidence, asserted), JSON.stringify(vc), wire.triple_hash);
      }
      return 'accepted';
    }
    const sId = this._ensureNode(wire.subject); const oId = this._ensureNode(wire.object);
    const status = peerTrust === 'untrusted' ? 'quarantined' : 'active';
    this.db.prepare(
      `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(wire.triple_hash, sId, wire.predicate, oId, asserted, asserted, sourceType, assertedAt, wire.temporality, status, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
    return status === 'active' ? 'accepted' : 'quarantined';
  }

  _verifyAgainstOrigin(wire) {
    if (wire.wire_version !== WIRE_VERSION) return false;
    const pub = this._originPubKey(wire.origin_peer_id);
    return pub ? verifyTriple(pub, wire, wire.signature) : false;
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
  peerRotate(peerId, newPublicKeyPem) { const fp = fingerprint(newPublicKeyPem); this.db.prepare('UPDATE peers SET public_key=?, fingerprint=? WHERE peer_id=?').run(newPublicKeyPem, fp, peerId); return fp; }
  peerRevoke(peerId) {
    this.db.prepare("UPDATE peers SET trust_level='untrusted' WHERE peer_id=?").run(peerId);
    this.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE origin_peer_id=? AND local_status='active'").run(peerId);
  }

  // ---- Export / Pull / Push / Clone (UC-06/07/11) --------------------
  exportSince(sinceClock = {}) {
    return this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all()
      .map((e) => this._edgeToWire(e)).filter((w) => !clockLEQ(w.vector_clock, sinceClock))
      .map((w) => ({ ...w, relayed_by: this.peerId }));
  }
  receiveIngest(batch) {
    const result = [];
    for (const wire of batch) {
      if (!this._verifyAgainstOrigin(wire)) { result.push({ triple_hash: wire.triple_hash, status: 'rejected' }); continue; }
      let status; try { status = this.mergeIncoming(wire, { peerTrust: this._originTrust(wire.origin_peer_id) }); } catch { result.push({ triple_hash: wire.triple_hash, status: 'rejected' }); continue; }
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
      let status; try { status = this.mergeIncoming(wire, { peerTrust: this._originTrust(wire.origin_peer_id) }); } catch { tally.rejected++; continue; }
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
      const sId = this._ensureNode(wire.subject); const oId = this._ensureNode(wire.object);
      const asserted = wire.asserted_confidence ?? wire.confidence;
      this.db.prepare(
        `INSERT OR IGNORE INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(wire.triple_hash, sId, wire.predicate, oId, asserted, asserted, wire.source_type ?? 'llm', wire.asserted_at ?? EPOCH, wire.temporality, bulkPromote ? 'active' : 'quarantined', wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
      cloned++;
    }
    let maxClock = {};
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return { cloned, rejected, bulkPromote };
  }
}
