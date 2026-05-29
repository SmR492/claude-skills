// UC-10: Cross-Language-Conformance — Node-Seite.
// Führt Vektoren (Input-Graph → erwarteter Output nach op) durch eine frische
// Engine und vergleicht Integer-exakt. Die PHP-Seite wird über einen optionalen
// phpRunner eingehängt; fehlt er, bleibt die Gegenseite 'unverified' (kein grünes Gate).
import { Engine } from './engine.mjs';
import { tripleHash } from './canonical.mjs';
import { DEFAULT_SPEC as _DS } from './rules.mjs';

export function runVector(vector, { spec } = {}) {
  const e = new Engine({ spec });
  for (const t of vector.input) e.storeTriple(t);
  // R7 (UC-AD Spaced-Repetition): optionales `recall`-Feld markiert Tripel als gerade-abgerufen
  // VOR dem op — Conformance-Vektor für Recall-Bonus in `decayPass`. Hash-stabil über Sprachen
  // (canonical), Zeitstempel ≈ now auf beiden Seiten (Diff < recallProtectionMs → beide Seiten
  // sehen den Bonus identisch).
  if (Array.isArray(vector.recall) && vector.recall.length > 0) {
    const hashes = vector.recall.map((t) => tripleHash(t.subject, t.predicate, t.object));
    e.markRecalled(hashes);
  }
  if (vector.op === 'decay') e.decayPass();
  else if (vector.op === 'infer') e.infer();
  const out = {};
  for (const ex of vector.expected) {
    const hash = tripleHash(ex.subject, ex.predicate, ex.object);
    const edge = e.db.prepare('SELECT confidence, local_status FROM knowledge_edges WHERE triple_hash = ?').get(hash);
    out[hash] = edge ? { confidence: edge.confidence, status: edge.local_status } : null;
  }
  return out;
}

export function checkConformance(vectors, { spec, phpRunner = null, requiredOps = ['decay', 'infer'] } = {}) {
  const results = vectors.map((v) => {
    const actual = runVector(v, { spec });
    const pass = v.expected.every((ex) => {
      const a = actual[tripleHash(ex.subject, ex.predicate, ex.object)];
      return a && a.confidence === ex.confidence && (!ex.status || a.status === ex.status);
    });
    return { name: v.name, pass };
  });
  // Coverage-Gate (AC-10.3): die Vektor-Suite muss die geforderten Grenzfall-Operationen abdecken,
  // sonst ist das Gate nicht aussagekräftig → allPass=false (entkoppelt vom PHP-Runner).
  const coveredOps = new Set(vectors.map((v) => v.op));
  const coverageMet = requiredOps.every((op) => coveredOps.has(op));
  return {
    results,
    coverageMet,
    allPass: coverageMet && results.every((r) => r.pass),
    phpVerified: typeof phpRunner === 'function', // ohne PHP-Runner: false (kein grünes Cross-Lang-Gate)
  };
}

// UC-MS Slice #M.1: Quorum-Konstanten-Spiegel für PHP-Parität (Auditor 🟡-1).
// Beide Seiten lesen denselben Konstanten-Vektor; eine Drift-PR-Diff wäre damit sofort sichtbar.
export const QUORUM_CONSTANTS = Object.freeze({
  quorumAuthFloor: _DS.quorumAuthFloor,
  quorumMulti: _DS.quorumMulti,
  quorumTrustRank: Object.freeze({ ..._DS.quorumTrustRank }),
});

// R7 (PHP-Parität-Schuld): zusätzliche Konstanten-Spiegel für die Slices, die NACH M.1
// hinzukamen — ohne diese Spiegel kann die PHP-Seite die Slices nicht bit-exakt nachbauen
// und das Konformanz-Gate kein 🟢 melden. Reine Lese-Bindung, kein Verhaltens-Eingriff.
//
// UC-TA Slice #6.1 — Offline-Peer-Trust-Adjustment (learnTrustAdjustments).
export const LEARN_CONSTANTS = Object.freeze({
  demoteLimitedThreshold: _DS.demoteLimitedThreshold,
  demoteUntrustedThreshold: _DS.demoteUntrustedThreshold,
  trustAdjustMinEvidence: _DS.trustAdjustMinEvidence,
});
// UC-AD Slice #6.3 + R5/R6 — Zugriffs-basiertes Decay + Lösch-Schwelle (decayPass).
// Werte sind Integer (Tage/Promille/Divisor) — kein Float, keine Lokal-Abhängigkeit.
export const DECAY_RECALL_CONSTANTS = Object.freeze({
  decayPerPeriod: Object.freeze({ ..._DS.decayPerPeriod }),
  deleteThreshold: _DS.deleteThreshold,
  quarantineThreshold: _DS.quarantineThreshold,
  recallProtectionDays: _DS.recallProtectionDays,
  recallDecayDivisor: _DS.recallDecayDivisor,
});
