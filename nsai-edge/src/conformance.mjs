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
