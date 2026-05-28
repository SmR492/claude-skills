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
  storeTriple({ subject, predicate, object, confidence = 700, temporality = 'stable', source_type = 'manual', asserted_at = null, context_slug = null, episode_id = null }) {
    validateTriple(subject, predicate, object);
    if (!Number.isInteger(confidence) || confidence < 0 || confidence > 1000) throw new EngineError('INVALID_PARAMETER_FORMAT', 'confidence außerhalb 0–1000');
    if (!TEMPORALITIES.has(temporality)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'temporality ungültig');
    if (!this.identity) throw new EngineError('NO_PEER_IDENTITY', 'keine lokale Identität');
    let ts = asserted_at ?? new Date(this._now()).toISOString();
    if (Date.parse(ts) > this._now()) ts = new Date(this._now()).toISOString(); // kein Zukunftsdatum (Fix 🔴2)
    // UC-5d: Wire/Signatur bleibt unangetastet (Original `ts` geht in den signingString); die
    // lokale Normalisierung wandert in `asserted_at_norm` (UTC-Z) für lexikografisch korrekte Filter.
    const tsNorm = this._normIso(ts);
    const hash = tripleHash(subject, predicate, object);
    return this._tx(() => {
      const existing = this._getEdge(hash);
      const clock = this._tick();
      let result;
      if (existing) {
        const asserted = Math.max(existing.asserted_confidence, confidence);
        const vc = clockMax(JSON.parse(existing.vector_clock), clock);
        const t = this._signSelf({ hash, subject, predicate, object, asserted_confidence: asserted, source_type, asserted_at: ts, temporality: existing.temporality, vector_clock: vc, derived_from: existing.derived_from ? JSON.parse(existing.derived_from) : null });
        // local_status BLEIBT unberührt (UC-EP: kein OUT→IN durch Re-Assert, das ist Slice #1b).
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, source_type=?, asserted_at=?, asserted_at_norm=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(Math.max(existing.confidence, confidence), asserted, source_type, ts, tsNorm, this.peerId, this.peerId, t.signature, JSON.stringify(vc), hash);
        result = { triple_hash: hash, confidence: Math.max(existing.confidence, confidence), status: existing.local_status, created: false };
      } else {
        const sId = this._ensureNode(subject); const oId = this._ensureNode(object);
        const t = this._signSelf({ hash, subject, predicate, object, asserted_confidence: confidence, source_type, asserted_at: ts, temporality, vector_clock: clock, derived_from: null });
        this.db.prepare(
          `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, asserted_at_norm, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from, context_slug)
           VALUES (?,?,?,?,?,?,?,?,?,?, 'active', ?,?,?,?, NULL, ?)`,
        ).run(hash, sId, predicate, oId, confidence, confidence, source_type, ts, tsNorm, temporality, this.peerId, this.peerId, t.signature, JSON.stringify(clock), context_slug);
        result = { triple_hash: hash, confidence, status: 'active', created: true };
      }
      // UC-EP: Konsolidierungs-Link in DERSELBEN Transaktion (atomar). Episode muss existieren,
      // sonst Link überspringen (Tripel bleibt gültig). Status-unabhängiger Audit-Trail.
      if (episode_id) {
        if (this.db.prepare('SELECT 1 FROM episodes WHERE id=?').get(episode_id)) {
          this.db.prepare('INSERT OR IGNORE INTO episode_triples (episode_id, triple_hash) VALUES (?,?)').run(episode_id, hash);
          result.episode_linked = true;
        } else {
          result.episode_linked = false; // nicht-existente Episode → Link übersprungen
        }
      }
      return result;
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
    // UC-5d: Recency über UTC-Z-normalisierte Form — sonst kann ein Offset-Zeitstempel im Wire
    // einen semantisch identischen Fakt mit Z um die Offset-Differenz „älter" machen lassen.
    return this._recencyFactor(edge.asserted_at_norm ?? edge.asserted_at, edge.temporality) * edge.confidence * (trustFactor(this.spec, this._originTrust(edge.origin_peer_id)) / 1000);
  }

  // Löst konkurrierende Aussagen (gleiches subject+predicate) zu einer gewichteten
  // Belief-Verteilung über die DISTINKTEN Objekte auf. Softmax über max-Score je Objekt
  // → anzahl-unabhängig. Gibt nach Belief absteigend sortierte Kandidaten + Gewinner.
  resolveBelief(subject, predicate, { as_of = null } = {}) {
    const sNode = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(subject);
    if (!sNode) return null;
    const vc = this._validClause(as_of); // UC-BT: as-of-Linse konjunktiv zu active
    const edges = this.db.prepare(`SELECT * FROM knowledge_edges WHERE subject_id=? AND predicate=? AND local_status='active'${vc.sql}`).all(sNode.id, predicate, ...vc.args);
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
    // Einzelne Aussage ohne Konkurrenz → Gewinner per Default — ABER nur wenn durchsetzungsfähig
    // (gleicher Gültigkeits-Test wie im Multi-Pfad: tier ≥ 0 UND trustRank > 0). Eine einzelne
    // untrusted/gewichtslose Aussage (z.B. via clone bulkPromote aktiv) ist KEIN Belief-Gewinner →
    // winner=null/belief 0 (allZero-Semantik). Sonst würde verify daraus fälschlich
    // contradicted/supported ableiten (Adversarial 🔴-1, Open-World-Verletzung).
    if (cands.length === 1) {
      const c = cands[0]; c.weight = Math.round(c.weight);
      const enforceable = c.tier >= 0 && c.trustRank > 0;
      c.belief = enforceable ? 1000 : 0;
      return { subject, predicate, winner: enforceable ? c.object : null, contested: false, candidates: [c] };
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
  // UC-BT: SQL-Klausel für die as-of-Lese-Linse (konjunktiv zu local_status='active').
  // Default-valid_from = asserted_at via COALESCE; halb-offenes Intervall [from, to).
  // UTC-Z-Normalisierung (🟡-5): lexikografischer SQLite-Vergleich ist nur korrekt, wenn alle
  // Zeitstempel UTC-Z sind. null bleibt null; ungültig → null (vom Aufrufer vorher validiert).
  _normIso(x) { if (x == null) return null; const t = Date.parse(x); return Number.isNaN(t) ? null : new Date(t).toISOString(); }
  _validClause(asOf) {
    const t = this._normIso(asOf) ?? new Date(this._now()).toISOString(); // Default „jetzt", normalisiert
    // UC-5d: lexikografischer SQL-Vergleich nur korrekt über UTC-Z-Form (asserted_at_norm).
    // Fallback `asserted_at` für Bestände ohne _norm (Migration füllt das beim DB-Open).
    return { sql: ' AND COALESCE(valid_from, asserted_at_norm, asserted_at) <= ? AND (valid_to IS NULL OR ? < valid_to)', args: [t, t] };
  }

  query(term, { maxDepth = 1, explain = false, as_of = null } = {}) {
    let depth = Number.isInteger(maxDepth) ? maxDepth : 1;
    depth = Math.max(1, Math.min(3, depth));
    const start = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(term);
    if (!start) return { nodes: [], edges: [], truncated: false, message: 'No matching nodes found.' };
    const visited = new Set([start.id]);
    let frontier = [start.id];
    const edgeRows = new Map();
    const vc = this._validClause(as_of);
    const edgeStmt = this.db.prepare(`SELECT * FROM knowledge_edges WHERE (subject_id=? OR object_id=?) AND local_status='active'${vc.sql}`);
    for (let d = 0; d < depth; d++) {
      const next = [];
      for (const nid of frontier) {
        for (const e of edgeStmt.all(nid, nid, ...vc.args)) {
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
      if (!beliefCache.has(key)) beliefCache.set(key, this.resolveBelief(subject, e.predicate, { as_of }));
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
          // DAG-Invariante (UC-TMS, AC-9.3): keine zyklus-bildende Justification — eine Prämisse
          // darf den Konklusions-Hash nicht (transitiv) selbst ableiten, sonst oszilliert die
          // Retraktions-Propagation. Solche Bindungen werden übersprungen.
          if (binding.hashes.includes(hash) || binding.hashes.some((h) => this._dependsOn(h, hash))) continue;
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
              `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, asserted_at_norm, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
               VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            ).run(hash, sId, concl.predicate, oId, confidence, confidence, 'inference', nowIso, nowIso, 'stable', status, this.peerId, this.peerId, t.signature, JSON.stringify(clock), JSON.stringify(derivedObj));
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

  // ---- UC-TMS: Justification-basierte Belief-Revision (Slice #1) ------
  // Premissen-Hashes eines Edges (Single-Justification: derived_from = {from:[…], rule_id}).
  _premises(hash) {
    const e = this._getEdge(hash);
    if (!e || !e.derived_from) return [];
    try { return JSON.parse(e.derived_from).from ?? []; } catch { return []; }
  }
  // Leitet `hash` (transitiv) aus `target` ab? (Zyklus-Schutz für die DAG-Invariante.)
  _dependsOn(hash, target, visited = new Set()) {
    if (visited.has(hash)) return false;
    visited.add(hash);
    for (const p of this._premises(hash)) {
      if (p === target || this._dependsOn(p, target, visited)) return true;
    }
    return false;
  }
  // Retraktions-Propagation (AC-9.1/9.2/9.4/9.6/9.7): verliert eine Prämisse den IN-Status,
  // werden alle (transitiv) darauf gegründeten, defeasiblen Edges auf `retracted` gesetzt.
  // Status-only: keine Live-Konfidenz-/Vector-Clock-Änderung (AC-9.5). Caller stellt die
  // Transaktion (vermeidet verschachtelte BEGIN). visited-Set garantiert Terminierung.
  _propagateRetraction(changedHash) {
    const queue = [changedHash];
    const visited = new Set();
    let retracted = 0;
    while (queue.length) {
      const h = queue.shift();
      if (visited.has(h)) continue;
      visited.add(h);
      // Dependents = aktive Edges, deren derived_from.from `h` enthält.
      for (const e of this.db.prepare("SELECT triple_hash, temporality, derived_from FROM knowledge_edges WHERE local_status='active'").all()) {
        if (!e.derived_from) continue;
        let from; try { from = JSON.parse(e.derived_from).from ?? []; } catch { from = []; }
        if (!from.includes(h)) continue;
        if (e.temporality === 'eternal') continue; // strikt (A5/AC-9.4)
        this.db.prepare("UPDATE knowledge_edges SET local_status='retracted', updated_at=datetime('now') WHERE triple_hash=?").run(e.triple_hash);
        retracted++;
        queue.push(e.triple_hash); // transitiv (AC-9.2)
      }
    }
    return retracted;
  }

  // ---- UC-04: Decay & Reinforcement (nur lokaler Live-Wert) ----------
  decayPass({ dryRun = false } = {}) {
    const edges = this.db.prepare("SELECT * FROM knowledge_edges WHERE local_status='active'").all();
    const plan = []; // { hash, newConf, supersede }
    let decayed = 0, superseded = 0;
    for (const e of edges) {
      const reduction = this.spec.decayPerPeriod[e.temporality] ?? 0;
      if (reduction === 0) continue;
      const newConf = Math.max(0, e.confidence - reduction);
      const supersede = newConf < this.spec.deleteThreshold;
      if (supersede) superseded++; else decayed++;
      plan.push({ hash: e.triple_hash, newConf, supersede });
    }
    if (dryRun) return { decayed, superseded, retracted: 0, dryRun };
    // 🔴-2: Decay-/Supersede-Writes UND Retraktions-Propagation in EINER Transaktion (fail-closed,
    // kein Zwischenzustand „Prämisse weg, Schlussfolgerung noch aktiv").
    const retracted = this._tx(() => {
      let r = 0;
      for (const p of plan) {
        if (p.supersede) this.db.prepare("UPDATE knowledge_edges SET confidence=?, local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(p.newConf, p.hash);
        else this.db.prepare("UPDATE knowledge_edges SET confidence=?, updated_at=datetime('now') WHERE triple_hash=?").run(p.newConf, p.hash);
      }
      for (const p of plan) if (p.supersede) r += this._propagateRetraction(p.hash);
      return r;
    });
    return { decayed, superseded, retracted, dryRun };
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
  reject(hash) {
    // UC-TMS: Reject einer Prämisse propagiert auf abgeleitete Fakten (eine Transaktion).
    return this._tx(() => {
      this.db.prepare("UPDATE knowledge_edges SET local_status='superseded', updated_at=datetime('now') WHERE triple_hash=?").run(hash);
      this._propagateRetraction(hash);
    });
  }

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
    // UC-5d: lokale UTC-Z-Form für lexikografische Lese-Linsen. Wire-`assertedAt` bleibt unverändert (Signatur prüft Original).
    const assertedAtNorm = this._normIso(assertedAt);
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
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, asserted_confidence=?, source_type=?, asserted_at=?, asserted_at_norm=?, origin_peer_id=?, relayed_by=?, signature=?, vector_clock=?, local_status=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(liveConf, asserted, sourceType, assertedAt, assertedAtNorm, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(vc), newStatus, wire.triple_hash);
        // Hinweis (Adversarial-Runde 2): der active→quarantined-Flip ist hier über die trust-primäre
        // Präzedenz unerreichbar (F1.13 „dead-but-correct"). Eine Retraktions-Propagation gehört NICHT
        // hierher — mergeIncoming läuft ohne Tx. Würde die Präzedenz je untrusted-Gewinne zulassen,
        // muss dieser Pfad transaktional werden und dann _propagateRetraction aufrufen (Slice #1b).
      } else {
        this.db.prepare("UPDATE knowledge_edges SET confidence=?, vector_clock=?, updated_at=datetime('now') WHERE triple_hash=?")
          .run(liveConf, JSON.stringify(vc), wire.triple_hash);
      }
      return 'accepted';
    }
    const sId = this._ensureNode(wire.subject); const oId = this._ensureNode(wire.object);
    const status = peerTrust === 'untrusted' ? 'quarantined' : 'active';
    this.db.prepare(
      `INSERT INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, asserted_at_norm, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    ).run(wire.triple_hash, sId, wire.predicate, oId, asserted, asserted, sourceType, assertedAt, assertedAtNorm, wire.temporality, status, wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
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
    // 🔴-3: quarantänisierte Edges sind verlorene Prämissen → ihre Schlussfolgerungen retraktieren
    // (sonst bleiben verwaiste Fakten aktiv UND werden weiter exportiert — Halluzinationspfad). Eine Tx.
    return this._tx(() => {
      this.db.prepare("UPDATE peers SET trust_level='untrusted' WHERE peer_id=?").run(peerId);
      const affected = this.db.prepare("SELECT triple_hash FROM knowledge_edges WHERE origin_peer_id=? AND local_status='active'").all(peerId).map((r) => r.triple_hash);
      this.db.prepare("UPDATE knowledge_edges SET local_status='quarantined' WHERE origin_peer_id=? AND local_status='active'").run(peerId);
      for (const h of affected) this._propagateRetraction(h);
    });
  }

  // ---- UC-EP: Episodisches Gedächtnis + Konsolidierung (Slice #2) -----
  // LOKAL/peer-privat — Episoden sind NICHT im Wire-Vertrag (keine Föderation).
  recordEpisode({ content, source_type = 'llm', occurred_at = null, context_slug = null } = {}) {
    if (typeof content !== 'string' || content.length < 1 || content.length > 8000) {
      throw new EngineError('INVALID_PARAMETER_FORMAT', 'content leer oder > 8000 Zeichen');
    }
    let ts = occurred_at ?? new Date(this._now()).toISOString();
    if (Date.parse(ts) > this._now() || Number.isNaN(Date.parse(ts))) ts = new Date(this._now()).toISOString();
    const tsNorm = this._normIso(ts); // UC-5d: UTC-Z für lexikografische Filter
    const id = randomUUID();
    this.db.prepare('INSERT INTO episodes (id, content, source_type, occurred_at, occurred_at_norm, context_slug) VALUES (?,?,?,?,?,?)')
      .run(id, content, source_type, ts, tsNorm, context_slug);
    return { episode_id: id, occurred_at: ts };
  }
  // UC-EP-Recall, optional zeit-fensterbar: `since` = untere Grenze (occurred_at ≥ since),
  // `until` = obere Grenze (occurred_at ≤ until). Slice #5b/🟡-A: `until` schließt die Lese-Linsen-
  // Lücke, durch die `search({as_of: T})` 2026er-Episoden zurücklieferte, obwohl der Aufrufer
  // einen historischen Snapshot zu T erwartete. `since`/`until` sind Episoden-Achse (occurred_at),
  // nicht die UC-BT-valid_*-Achse — bewusst getrennt (Episoden tragen kein Validitäts-Intervall).
  recallEpisodes({ context_slug = null, term = null, since = null, until = null, limit = 25 } = {}) {
    const cap = Math.min(Number.isInteger(limit) && limit > 0 ? limit : 25, 100);
    const where = []; const args = [];
    if (context_slug) { where.push('context_slug = ?'); args.push(context_slug); }
    if (term) { where.push("content LIKE ? ESCAPE '\\'"); args.push(`%${String(term).replace(/[\\%_]/g, (m) => `\\${m}`)}%`); }
    // UC-5d: Filter über UTC-Z-normalisierte Form (occurred_at_norm); Fallback occurred_at für Altbestände.
    if (since) { const t = Date.parse(since); if (!Number.isNaN(t)) { where.push('COALESCE(occurred_at_norm, occurred_at) >= ?'); args.push(new Date(t).toISOString()); } }
    if (until) { const t = Date.parse(until); if (!Number.isNaN(t)) { where.push('COALESCE(occurred_at_norm, occurred_at) <= ?'); args.push(new Date(t).toISOString()); } }
    // UC-5d 🔴-2 (Adversarial): ORDER BY ebenfalls über occurred_at_norm, sonst limit/DESC-Reihenfolge unter Offset-Mix falsch.
    const sql = `SELECT id, content, source_type, occurred_at, context_slug FROM episodes${where.length ? ' WHERE ' + where.join(' AND ') : ''} ORDER BY COALESCE(occurred_at_norm, occurred_at) DESC, id LIMIT ?`;
    const rows = this.db.prepare(sql).all(...args, cap + 1);
    const truncated = rows.length > cap;
    return { episodes: rows.slice(0, cap), truncated };
  }
  episodesForTriple(tripleHashValue) {
    const edge = this._getEdge(tripleHashValue);
    const rows = this.db.prepare(
      // UC-5d 🔴-3 (Adversarial): Provenienz-Reihenfolge ebenfalls über _norm.
      'SELECT e.id, e.content, e.source_type, e.occurred_at, e.context_slug FROM episode_triples l JOIN episodes e ON e.id = l.episode_id WHERE l.triple_hash = ? ORDER BY COALESCE(e.occurred_at_norm, e.occurred_at) DESC',
    ).all(tripleHashValue);
    // status-unabhängig: Tripel kann fehlen (GC) oder retracted sein — beides definiert.
    return { triple_hash: tripleHashValue, triple_status: edge ? edge.local_status : null, episodes: rows };
  }
  episodicGc({ maxAgeDays = 90 } = {}) {
    return this._tx(() => {
      const cutoff = new Date(this._now() - maxAgeDays * 86400000).toISOString();
      // UC-5d 🔴-1 (Adversarial): GC-DELETE über _norm — sonst werden Offset-Episoden fälschlich gelöscht (Datenverlust).
      const eps = this.db.prepare('DELETE FROM episodes WHERE COALESCE(occurred_at_norm, occurred_at) < ?').run(cutoff); // Links via CASCADE
      // verwaiste Links (Ziel-Tripel per GC entfernt) aufräumen — semantische Tripel bleiben unberührt.
      const orphans = this.db.prepare('DELETE FROM episode_triples WHERE triple_hash NOT IN (SELECT triple_hash FROM knowledge_edges)').run();
      return { episodesDeleted: eps.changes, orphanLinksDeleted: orphans.changes };
    });
  }

  // ---- UC-HR: Hybrid-Retrieval (Slice #3) — lexikalische Seeds + PPR --
  // Lokale, read-only Lese-Linse (Float wie resolveBelief; nicht föderiert, kein Wire).
  // Deterministisch durch feste Knoten-/Kanten-Summationsordnung (triple_hash) + stabilen Tie-Break.
  search({ term, limit = 10, max_hops = 3, max_iter = 100, tol = 1e-6, as_of = null } = {}) {
    const cap = Math.min(Number.isInteger(limit) && limit > 0 ? limit : 10, 50);
    // Parameter klemmen (Adversarial 🟡-1/2: ungeklemmt → CPU-DoS / still-leeres Ergebnis).
    max_hops = Math.min(Math.max(Number.isInteger(max_hops) ? max_hops : 3, 1), 5);
    max_iter = Math.min(Math.max(Number.isInteger(max_iter) ? max_iter : 100, 1), 200);
    tol = (Number.isFinite(tol) && tol > 0) ? tol : 1e-6;
    if (!this._validIso(as_of)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'as_of kein ISO-Datum'); // UC-BT (Slice #5b)
    if (typeof term !== 'string' || term.trim().length < 2) return { seeds: [], results: [], episodes: [], converged: true, truncated: false };
    const like = `%${term.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;
    const seeds = this.db.prepare("SELECT id, name FROM knowledge_nodes WHERE name LIKE ? ESCAPE '\\' ORDER BY name").all(like);
    if (!seeds.length) return { seeds: [], results: [], episodes: this.recallEpisodes({ term, until: as_of }).episodes, converged: true, truncated: false };

    // 1) k-Hop-Subgraph (ungerichtet für Mitgliedschaft) über aktive UND zu `as_of` gültige Kanten.
    // UC-BT (Slice #5b): konjunktiv zu local_status='active'; ohne as_of = jetzt — gleiche Lese-Linse
    // wie resolveBelief/query/verify, damit search nicht historische/zukünftige Fakten zeigt, die im
    // gewählten Zeitpunkt nicht gelten (Konsistenz zwischen den Lese-Pfaden).
    const vc = this._validClause(as_of);
    const edges = this.db.prepare(`SELECT triple_hash, subject_id, predicate, object_id, confidence, origin_peer_id FROM knowledge_edges WHERE local_status='active'${vc.sql}`).all(...vc.args);
    // Relevanz-Gewicht = trust-diskontierte Konfidenz (Adversarial 🟡-3): ein limited/niedrig-
    // vertrauter Origin soll nicht allein wegen hoher gespeicherter confidence oben ranken.
    // Das ist eine RELEVANZ-Linse, NICHT die volle Belief-Auflösung (resolveBelief bleibt zuständig).
    const edgeWeight = (e) => (e.confidence / 1000) * (trustFactor(this.spec, this._originTrust(e.origin_peer_id)) / 1000);
    const adjAll = new Map(); // node -> [{other, dir, e}]
    for (const e of edges) {
      (adjAll.get(e.subject_id) ?? adjAll.set(e.subject_id, []).get(e.subject_id)).push(e);
      (adjAll.get(e.object_id) ?? adjAll.set(e.object_id, []).get(e.object_id)).push(e);
    }
    const inSub = new Set(seeds.map((s) => s.id));
    let frontier = [...inSub];
    for (let hop = 0; hop < max_hops && frontier.length; hop++) {
      const next = [];
      for (const n of frontier) for (const e of adjAll.get(n) ?? []) {
        for (const o of [e.subject_id, e.object_id]) if (!inSub.has(o)) { inSub.add(o); next.push(o); }
      }
      frontier = next;
    }
    // 2) gerichtete Subgraph-Kanten, deterministisch nach triple_hash sortiert (Summationsordnung).
    const subEdges = edges.filter((e) => inSub.has(e.subject_id) && inSub.has(e.object_id))
      .sort((a, b) => (a.triple_hash < b.triple_hash ? -1 : a.triple_hash > b.triple_hash ? 1 : 0));
    const nodes = [...inSub].sort();
    const outW = new Map(); // summe der Out-Gewichte je Knoten (trust-diskontiert)
    for (const e of subEdges) outW.set(e.subject_id, (outW.get(e.subject_id) ?? 0) + edgeWeight(e));

    // 3) Personalized PageRank (Power-Iteration, deterministische Ordnung).
    const N = nodes.length;
    const p = new Map(); for (const s of seeds) if (inSub.has(s.id)) p.set(s.id, 0);
    const seedIds = [...p.keys()]; for (const id of seedIds) p.set(id, 1 / seedIds.length);
    let r = new Map(nodes.map((n) => [n, p.get(n) ?? 0]));
    const d = 0.85;
    let converged = false;
    for (let it = 0; it < max_iter; it++) {
      const nr = new Map(nodes.map((n) => [n, 0]));
      let dangling = 0;
      for (const n of nodes) if (!outW.get(n)) dangling += r.get(n); // Sinks: Masse → Teleport
      for (const e of subEdges) { // sortiert → feste Summationsreihenfolge
        const ow = outW.get(e.subject_id);
        if (!ow) continue; // dangling (kein effektives Out-Gewicht) → Masse via Teleport
        nr.set(e.object_id, nr.get(e.object_id) + d * (edgeWeight(e) / ow) * r.get(e.subject_id));
      }
      let delta = 0;
      for (const n of nodes) {
        const teleport = (1 - d) * (p.get(n) ?? 0) + d * dangling * (p.get(n) ?? 0);
        const val = nr.get(n) + teleport;
        nr.set(n, val); delta += Math.abs(val - r.get(n));
      }
      r = nr;
      if (delta < tol) { converged = true; break; }
    }
    // 4) Ranking: (r_subj + r_obj) × confidence/1000, stabiler Tie-Break nach triple_hash.
    const exactName = new Set(seeds.filter((s) => s.name === term).map((s) => s.id));
    const scored = subEdges.map((e) => ({
      subject: this._nodeName(e.subject_id), predicate: e.predicate,
      object: this._nodeName(e.object_id), confidence: e.confidence,
      score: (r.get(e.subject_id) + r.get(e.object_id)) * edgeWeight(e),
      source: (exactName.has(e.subject_id) || exactName.has(e.object_id)) ? 'lexical' : 'graph',
      triple_hash: e.triple_hash,
    })).sort((a, b) => (b.score - a.score) || (a.triple_hash < b.triple_hash ? -1 : 1));
    const truncated = scored.length > cap;
    return {
      seeds: seeds.map((s) => s.name), converged, truncated,
      results: scored.slice(0, cap),
      episodes: this.recallEpisodes({ term, until: as_of }).episodes, // Slice #5b/🟡-A: zu T begrenzen

    };
  }

  // ---- UC-V: Verifikation (Slice #4) — Claim gegen den Graphen prüfen --
  // Reine Projektion von resolveBelief (keine eigene Belief-Logik). Read-only, deterministisch.
  // Open-World: Abwesenheit/gewichtsloses Wissen → 'unknown', NIE 'contradicted'.
  verify({ subject, predicate, object, as_of = null } = {}) {
    validateTriple(subject, predicate, object);
    const base = { subject, predicate, object };
    const rb = this.resolveBelief(subject, predicate, { as_of }); // UC-BT: optional zu T verifizieren (🟡-2)
    if (rb === null) return { ...base, verdict: 'unknown' };                       // kein Subjekt / keine aktive Aussage
    if (rb.multiValue) {
      return rb.candidates.some((c) => c.object === object)
        ? { ...base, verdict: 'supported', multiValue: true }
        : { ...base, verdict: 'unknown', multiValue: true };                       // set-valued Abwesenheit ≠ Widerspruch
    }
    if (rb.winner === null) return { ...base, verdict: 'unknown' };                // allZero — kein durchsetzungsfähiger Gewinner (🔴-1)
    if (rb.winner === object) {
      const cand = rb.candidates.find((c) => c.object === object);
      const edge = this._getEdge(tripleHash(subject, predicate, object));
      const out = { ...base, verdict: 'supported', belief: cand?.belief ?? null, contested: !!rb.contested };
      if (edge?.derived_from) { try { out.derived_from = JSON.parse(edge.derived_from); } catch { /* ignore */ } }
      return out;
    }
    // winner ≠ null UND winner ≠ object → der Graph glaubt etwas anderes.
    return { ...base, verdict: 'contradicted', dominant: rb.winner, present: rb.candidates.some((c) => c.object === object) };
  }

  // ---- UC-BT: Bi-temporale Gültigkeit (Slice #5) — lokale valid_from/valid_to ----
  _validIso(v) { return v == null || (typeof v === 'string' && !Number.isNaN(Date.parse(v))); }
  // Setzt das lokale Gültigkeits-Intervall. Unbekannter Hash → null (wie reinforce). Zukunfts-
  // valid_from erlaubt (geplante Gültigkeit). valid_to ≤ valid_from → Fehler (leeres Intervall).
  setValidity(hash, { valid_from = undefined, valid_to = undefined } = {}) {
    const e = this._getEdge(hash);
    if (!e) return null;
    if (!this._validIso(valid_from) || !this._validIso(valid_to)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'valid_from/valid_to kein ISO-Datum');
    const vf = valid_from === undefined ? e.valid_from : this._normIso(valid_from);
    const vt = valid_to === undefined ? e.valid_to : this._normIso(valid_to);
    const effFrom = vf ?? e.asserted_at; // Default-Fallback
    if (vt != null && Date.parse(vt) <= Date.parse(effFrom)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'valid_to ≤ valid_from (leeres Intervall)');
    this.db.prepare("UPDATE knowledge_edges SET valid_from=?, valid_to=?, updated_at=datetime('now') WHERE triple_hash=?").run(vf ?? null, vt ?? null, hash);
    return { triple_hash: hash, valid_from: vf ?? null, valid_to: vt ?? null };
  }
  // Nicht-destruktive temporale Supersession (nur single-value): schließt alle offenen aktiven
  // same-(s,p)-Fakten mit valid_to=as_of und legt den neuen Fakt mit valid_from=as_of an.
  supersedeTemporally({ subject, predicate, object, as_of = null, confidence = 700, source_type = 'manual' } = {}) {
    validateTriple(subject, predicate, object);
    if ((this.spec.multiValuePredicates || []).includes(predicate)) {
      throw new EngineError('NOT_APPLICABLE', 'supersedeTemporally gilt nur für single-value-Prädikate');
    }
    if (!this._validIso(as_of)) throw new EngineError('INVALID_PARAMETER_FORMAT', 'as_of kein ISO-Datum');
    const at = this._normIso(as_of) ?? new Date(this._now()).toISOString(); // 🟡-5: UTC-Z
    const newHash = tripleHash(subject, predicate, object);
    const sNode = this.db.prepare('SELECT id FROM knowledge_nodes WHERE name = ?').get(subject);
    // 🔴-1: Inversions-Guard — schließt KEINEN Vorgänger, dessen Gültigkeit erst AB/NACH `at` beginnt
    // (sonst valid_to ≤ valid_from → leeres Intervall → Fakt nirgends mehr sichtbar = stiller Verlust).
    const openPred = sNode ? this.db.prepare("SELECT triple_hash, valid_from, asserted_at FROM knowledge_edges WHERE subject_id=? AND predicate=? AND local_status='active' AND valid_to IS NULL").all(sNode.id, predicate).filter((e) => e.triple_hash !== newHash) : [];
    for (const e of openPred) {
      if (Date.parse(e.valid_from ?? e.asserted_at) >= Date.parse(at)) {
        throw new EngineError('INVALID_PARAMETER_FORMAT', 'as_of liegt vor valid_from eines offenen Vorgängers (Intervall-Inversion)');
      }
    }
    // Neuen Fakt sicherstellen — VOR der Tx (storeTriple öffnet eine eigene Transaktion; kein nesting).
    if (!this._getEdge(newHash)) this.storeTriple({ subject, predicate, object, confidence, source_type, asserted_at: at });
    return this._tx(() => {
      for (const e of openPred) this.db.prepare("UPDATE knowledge_edges SET valid_to=?, updated_at=datetime('now') WHERE triple_hash=?").run(at, e.triple_hash);
      this.db.prepare("UPDATE knowledge_edges SET valid_from=?, valid_to=NULL, updated_at=datetime('now') WHERE triple_hash=?").run(at, newHash);
      return { triple_hash: newHash, valid_from: at };
    });
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
      const assertedAt = wire.asserted_at ?? EPOCH;                  // UC-5d: Wire-Original
      const assertedAtNorm = this._normIso(assertedAt);              //         lokale UTC-Z-Form
      this.db.prepare(
        `INSERT OR IGNORE INTO knowledge_edges (triple_hash, subject_id, predicate, object_id, confidence, asserted_confidence, source_type, asserted_at, asserted_at_norm, temporality, local_status, origin_peer_id, relayed_by, signature, vector_clock, derived_from)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      ).run(wire.triple_hash, sId, wire.predicate, oId, asserted, asserted, wire.source_type ?? 'llm', assertedAt, assertedAtNorm, wire.temporality, bulkPromote ? 'active' : 'quarantined', wire.origin_peer_id, wire.relayed_by ?? null, wire.signature, JSON.stringify(wire.vector_clock), wire.derived_from ? JSON.stringify(wire.derived_from) : null);
      cloned++;
    }
    let maxClock = {};
    for (const w of batch) maxClock = clockMax(maxClock, w.vector_clock);
    this.db.prepare('UPDATE peers SET last_clock=? WHERE peer_id=?').run(JSON.stringify(maxClock), peerId);
    return { cloned, rejected, bulkPromote };
  }
}
