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
const MAX_CLOCK_JUMP = 1000000; // F1.11: erlaubter VC-Sprung je Peer-Eintrag über den lokalen Stand

export class EngineError extends Error {
  constructor(code, message) { super(message ? `${code}: ${message}` : code); this.code = code; }
}

const clockMax = (a, b) => { const o = { ...a }; for (const [k, v] of Object.entries(b)) o[k] = Math.max(o[k] ?? 0, v); return o; };
const clockLEQ = (a, b) => Object.entries(a).every(([k, v]) => v <= (b[k] ?? 0));
// F1.11: eingehende VC-Werte müssen ganzzahlig, nicht-negativ und ohne implausiblen Sprung
// über den lokalen Stand sein (Clock-Vergiftung verhindern).
const clockPlausible = (inc, local) => {
  if (!inc || typeof inc !== 'object') return false;
  for (const [k, v] of Object.entries(inc)) {
    if (!Number.isInteger(v) || v < 0) return false;
    if (v > (local[k] ?? 0) + MAX_CLOCK_JUMP) return false;
  }
  return true;
};

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

  // F1.11: feldweises Maximum aller bekannten Vector-Clocks (Plausibilitäts-Referenz).
  _localClock() {
    let clock = {};
    for (const row of this.db.prepare('SELECT vector_clock FROM knowledge_edges').all()) {
      try { clock = clockMax(clock, JSON.parse(row.vector_clock)); } catch { /* ignore */ }
    }
    return clock;
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
    let ts = asserted_at ?? new Date(this._now()).toISOString();
    if (Date.parse(ts) > this._now()) ts = new Date(this._now()).toISOString(); // kein Zukunftsdatum (Fix 🔴2)
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

  // ---- Belief-Scoring (neuro-symbolische Lese-Linse, Tier-basiert) ---
  _sourceTier(st) { return this.spec.sourceTier[st] ?? this.spec.sourceTier.default ?? 0; }
  _trustTierCap(trust) { return this.spec.trustTierCap[trust] ?? -1; }
  // Effektive Autoritäts-Stufe: source_type-Tier, gekappt durch Origin-Trust (Fix 🔴1).
  _effTier(edge) { return Math.min(this._sourceTier(edge.source_type), this._trustTierCap(this._originTrust(edge.origin_peer_id))); }
  _recencyFactor(assertedAt, temporality = 'stable') {
    const half = this.spec.recencyHalflifeDays[temporality] ?? this.spec.recencyHalflifeDays.default ?? 3650;
    if (!Number.isFinite(half)) return 1; // eternal → kein Recency-Decay
    const t = Date.parse(assertedAt);
    if (Number.isNaN(t)) return 1;
    const ageDays = Math.max(0, (this._now() - t) / 86400000); // Zukunft → wie age 0 (Faktor 1, nie >1)
    return Math.pow(2, -ageDays / half); // ∈ (0,1]
  }
  // Innerhalb derselben Tier-Stufe: Aktualität × Konfidenz × Liefer-Trust (Float, rein lokal).
  _withinWeight(edge) {
    return this._recencyFactor(edge.asserted_at, edge.temporality) * edge.confidence * (trustFactor(this.spec, this._originTrust(edge.origin_peer_id)) / 1000);
  }

  // Löst konkurrierende Aussagen (gleiches subject+predicate) zu einer gewichteten
  // Belief-Verteilung über die DISTINKTEN Objekte auf. Softmax über max-Score je Objekt
  // → anzahl-unabhängig. Gibt nach Belief absteigend sortierte Kandidaten + Gewinner.
  resolveBelief(subject, predicate) {
    const sNode = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(subject);
    if (!sNode) return null;
    const edges = this.db.prepare("SELECT * FROM knowledge_edges WHERE subject_id=? AND predicate=? AND local_status='active'").all(sNode.id, predicate);
    if (edges.length === 0) return null;
    // Mehrwertiges Prädikat (z.B. hat_tag): alle distinkten Objekte sind GLEICHZEITIG gültig —
    // keine Belief-Konkurrenz, kein disputed. Jedes Objekt belief 1000.
    if ((this.spec.multiValuePredicates || []).includes(predicate)) {
      const objs = [...new Set(edges.map((e) => this._nodeName(e.object_id)))];
      return { subject, predicate, multiValue: true, winner: null, contested: false, candidates: objs.map((o) => ({ object: o, belief: 1000 })) };
    }
    // Pro Objekt beste Repräsentanz nach Präzedenz (Origin-Trust, effektive Stufe, within-weight) —
    // konsistent zur trust-primären Provenienz im Schreibpfad.
    const RANK = { untrusted: 0, limited: 1, full: 2, authoritative: 3 };
    const rankOf = (o) => RANK[this._originTrust(o)] ?? 0;
    const better = (a, b) => a.trustRank > b.trustRank || (a.trustRank === b.trustRank && (a.tier > b.tier || (a.tier === b.tier && a.weight > b.weight)));
    const byObject = new Map();
    for (const e of edges) {
      const obj = this._nodeName(e.object_id);
      const cand = { object: obj, trustRank: rankOf(e.origin_peer_id), tier: this._effTier(e), weight: this._withinWeight(e), source_type: e.source_type, asserted_at: e.asserted_at, confidence: e.confidence, origin_peer_id: e.origin_peer_id };
      const cur = byObject.get(obj);
      if (!cur || better(cand, cur)) byObject.set(obj, cand);
    }
    const cands = [...byObject.values()];
    // Einzelne Aussage ohne Konkurrenz → Gewinner per Default (auch bei niedrigem Tier).
    if (cands.length === 1) {
      const c = cands[0]; c.belief = 1000; c.weight = Math.round(c.weight);
      return { subject, predicate, winner: c.object, contested: false, candidates: [c] };
    }
    // HARTE Autoritäts-Dominanz: nur die höchste Tier-Stufe konkurriert um den Belief;
    // niedrigere Stufen → belief 0 (sichtbar als disputed). Innerhalb der Top-Stufe:
    // Potenz-Normalisierung über within-weight (Aktualität × Konfidenz × Liefer-Trust).
    const p = this.spec.beliefSharpness;
    const W = (c) => Math.pow(Math.max(c.weight, 0), p);
    // HARTE Präzedenz: höchster Origin-Trust zuerst, dann höchste Autoritäts-Stufe (mit nicht-leerem
    // Gewicht). Ein niedriger-vertrauter Kandidat drückt einen höher-vertrauten NIE auf belief 0 —
    // auch nicht per effTier-Sprung; eigene Inferenz (self=full) bleibt geschützt.
    let top = [], sum = 0;
    const valid = cands.filter((c) => c.tier >= 0 && c.trustRank > 0);
    if (valid.length) {
      const maxTrust = Math.max(...valid.map((c) => c.trustRank));
      const trustPool = valid.filter((c) => c.trustRank === maxTrust);
      const tiers = [...new Set(trustPool.map((c) => c.tier))].sort((a, b) => b - a);
      for (const t of tiers) {
        const group = trustPool.filter((c) => c.tier === t);
        const s = group.reduce((a, c) => a + W(c), 0);
        if (s > 0) { top = group; sum = s; break; }
      }
    }
    const allZero = !(sum > 0);
    for (const c of cands) { c.belief = (top.includes(c) && !allZero) ? Math.round((W(c) / sum) * 1000) : 0; c.weight = Math.round(c.weight); }
    // Deterministischer Tiebreak: belief desc, tier desc, dann lexikografisch nach object
    // (Föderations-Determinismus — gleicher Bestand → gleicher Gewinner, 🟡-2).
    cands.sort((a, b) => (b.belief - a.belief) || (b.tier - a.tier) || (a.object < b.object ? -1 : a.object > b.object ? 1 : 0));
    const winner = allZero ? null : cands[0].object;
    const contested = cands.length > 1 && cands[1].belief >= this.spec.contestedThreshold;
    return { subject, predicate, winner, contested, candidates: cands };
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
        belief: cand?.belief ?? 1000, source_type: e.source_type,
        effective_tier: cand?.tier ?? this._effTier(e), // trust-gekappte Autoritäts-Stufe (nicht der rohe source_type-Anspruch, 🟡-3)
        asserted_at: e.asserted_at, origin_peer_id: e.origin_peer_id,
      };
      if (res && !res.multiValue && res.candidates.length > 1 && res.winner !== object) { out.disputed = true; out.dominant = res.winner; }
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
  // GC: alte superseded-Tombstones + Waisen-Knoten physisch entfernen (KONZEPT §8.4).
  gc({ maxAgeDays = 30 } = {}) {
    const cutoff = new Date(this._now() - maxAgeDays * 86400000).toISOString().replace('T', ' ').slice(0, 19);
    const edges = this.db.prepare("DELETE FROM knowledge_edges WHERE local_status='superseded' AND updated_at < ?").run(cutoff);
    const nodes = this.db.prepare('DELETE FROM knowledge_nodes WHERE id NOT IN (SELECT subject_id FROM knowledge_edges UNION SELECT object_id FROM knowledge_edges)').run();
    return { edgesDeleted: edges.changes, nodesDeleted: nodes.changes };
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
    // F1.15: das unsignierte Live-Feld hebt den Belief nie über die signierte asserted_confidence.
    const incLive = Math.min(wire.confidence ?? asserted, asserted);
    const sourceType = wire.source_type ?? 'llm';
    const assertedAt = wire.asserted_at ?? EPOCH;
    const SKEW = 86400000; // 1 Tag Clock-Skew-Toleranz
    if (Date.parse(assertedAt) > this._now() + SKEW) return 'rejected'; // kein Zukunftsdatum (Fix 🔴2)
    if (!clockPlausible(wire.vector_clock, this._localClock())) return 'rejected'; // F1.11: VC-Plausibilität
    const existing = this._getEdge(wire.triple_hash);
    if (existing && existing.local_status === 'superseded' && clockLEQ(wire.vector_clock, JSON.parse(existing.vector_clock))) return 'ignored';
    if (existing) {
      // Live-Konfidenz darf NUR durch full/authoritative-Beiträge per max angehoben werden —
      // sonst inflationiert ein untrusted/limited Re-Assert desselben Hashes die Konfidenz eines
      // vertrauten Edges und kippt den Belief-Gewinner (Fix 🔴-NEU, Review 0005). VC mergt trotzdem.
      const trusted = peerTrust === 'full' || peerTrust === 'authoritative';
      const liveConf = trusted ? Math.max(existing.confidence, incLive) : existing.confidence;
      const vc = clockMax(JSON.parse(existing.vector_clock), wire.vector_clock);
      // Provenienz folgt der höheren AUTORITÄT, nicht der höheren Konfidenz (Fix 🟡4) —
      // sonst könnte eine niedrig-autoritative aber hoch-konfidente Quelle den source_type kapern.
      // Live-Konfidenz bleibt CRDT-max. Gespeicherte Aussage bleibt eine kohärente, signierte Origin-Aussage.
      // Provenienz-Übernahme ist TRUST-ASYMMETRISCH: ein niedriger-vertrautes Incoming darf ein
      // höher-vertrautes Edge in KEINEM belief-relevanten Feld (source_type/asserted_at/origin)
      // kapern. Präzedenz lexikografisch: (effektive Stufe, Origin-Trust-Rang, asserted_confidence,
      // origin_id). Schließt die Fehlerklasse generell — nicht nur eine Achse (Reviews 0004/0005/0006).
      const trustRank = (t) => ({ untrusted: 0, limited: 1, full: 2, authoritative: 3 }[t] ?? 0);
      const incTier = Math.min(this._sourceTier(sourceType), this._trustTierCap(peerTrust));
      const exTier = Math.min(this._sourceTier(existing.source_type), this._trustTierCap(this._originTrust(existing.origin_peer_id)));
      const incR = trustRank(peerTrust); const exR = trustRank(this._originTrust(existing.origin_peer_id));
      // PROVENIENZ-Übernahme (gleicher Hash, wessen signierter Record bleibt): Origin-Trust ist
      // PRIMÄR — ein niedriger-vertrauter Peer übernimmt NIE den Record eines höher-vertrauten,
      // egal welche Autoritäts-Stufe sein source_type-Anspruch erreicht. Schließt die Fehlerklasse
      // endgültig (auch der effTier-Sprung durch niedrigeren Trust greift nicht). Hinweis: die
      // BELIEF-Auflösung zwischen VERSCHIEDENEN Objekten bleibt autoritäts-primär (andere Operation).
      const incWins = incR > exR
        || (incR === exR && incTier > exTier)
        || (incR === exR && incTier === exTier && asserted > existing.asserted_confidence)
        || (incR === exR && incTier === exTier && asserted === existing.asserted_confidence && wire.origin_peer_id < existing.origin_peer_id);
      if (incWins) {
        // F1.13: geht die Provenienz auf einen untrusted-Origin über, wird der Record quarantänisiert
        // (kein stiller Verbleib als active), sonst bleibt der bisherige Status erhalten.
        const newStatus = peerTrust === 'untrusted' ? 'quarantined' : existing.local_status;
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, source_type=?, asserted_at=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, local_status=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(liveConf, asserted, sourceType, assertedAt, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(vc), newStatus, wire.triple_hash);
      } else {
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(liveConf, JSON.stringify(vc), wire.triple_hash);
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
    if (!pub) return false;
    // F1.9: Fingerprint-Bindung — der origin_peer_id MUSS aus dem Origin-Key abgeleitet sein
    // (verhindert Key-Confusion: frei gewählter peer_id mit fremdem Key). Greift am Sicherheits-Gate.
    if (wire.origin_peer_id !== `peer:${fingerprint(pub).slice(0, 12)}`) return false;
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
  async pull(transport, peerId) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const since = peer.last_clock ? JSON.parse(peer.last_clock) : {};
    const batch = await transport.exportSince(since);
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
  async push(transport, peerId) {
    const peer = this._peer(peerId);
    if (!peer) throw new EngineError('PEER_UNKNOWN');
    const since = peer.last_clock ? JSON.parse(peer.last_clock) : {};
    const batch = this.exportSince(since);
    const statuses = await transport.receiveIngest(batch);
    let maxClock = since;
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return statuses;
  }
  async clone(transport, peerId, { bulkPromote = false } = {}) {
    if (!this._peer(peerId)) throw new EngineError('PEER_UNKNOWN');
    const batch = await transport.exportSince({});
    let cloned = 0, rejected = 0;
    const SKEW = 86400000;
    for (const wire of batch) {
      if (!this._verifyAgainstOrigin(wire)) { rejected++; continue; }
      try { validateTriple(wire.subject, wire.predicate, wire.object); } catch { rejected++; continue; }
      if (Date.parse(wire.asserted_at ?? EPOCH) > this._now() + SKEW) { rejected++; continue; } // kein Zukunftsdatum (Fix 🔴C)
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
