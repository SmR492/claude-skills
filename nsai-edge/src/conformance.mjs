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
  // R12 (Wurzelursache K1/K2): Quorum-Verhaltens-Vektor. Der als „PHP-spiegelbar" deklarierte
  // Quorum-Pfad (`clusterContribution = trustRank × effTier`, AUTH_FLOOR/Q-Schwellen) hatte bis R12
  // KEINEN Conformance-Vektor — Drift in `sourceTier` (K1) oder der Schwellen-Arithmetik (K2) war
  // für das Gate strukturell unsichtbar. `op:'quorum'` schließt das: Endorsements aufnehmen, dann
  // `_quorumFor` integer-exakt prüfen (weighted_support/cluster_count/verdict). Self-Endorsement
  // (origin=self=full) ist hermetisch und übt sourceTier × quorumTrustRank × AUTH_FLOOR direkt aus.
  if (vector.op === 'quorum') {
    for (const en of vector.endorsements ?? []) e.endorseTriple(en);
    const out = {};
    for (const ex of vector.expected) {
      const hash = tripleHash(ex.subject, ex.predicate, ex.object);
      const q = e._quorumFor(hash, { as_of: vector.as_of ?? null });
      out[hash] = { weighted_support: q.weighted_support, cluster_count: q.cluster_count, verdict: q.verdict };
    }
    return out;
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

// R12: `quorum` ist jetzt Pflicht-Coverage — der Quorum-Pfad ist als PHP-spiegelbar deklariert,
// also muss das Gate ihn fordern (sonst bleibt die Klasse K1/K2 unsichtbar, s. runVector).
export function checkConformance(vectors, { spec, phpRunner = null, requiredOps = ['decay', 'infer', 'quorum'] } = {}) {
  const results = vectors.map((v) => {
    const actual = runVector(v, { spec });
    // Feld-generischer Vergleich: jede `expected`-Eigenschaft außer s/p/o muss integer-exakt
    // stimmen — funktioniert für {confidence,status} (decay/infer) UND
    // {weighted_support,cluster_count,verdict} (quorum), ohne Op-Spezialfall.
    const pass = v.expected.every((ex) => {
      const a = actual[tripleHash(ex.subject, ex.predicate, ex.object)];
      if (!a) return false;
      return Object.entries(ex).every(([k, want]) =>
        ['subject', 'predicate', 'object'].includes(k) || a[k] === want);
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
// R12 (Wurzelursache K1): `sourceTier` + `trustTierCap` aufgenommen — sie sind die `tier`-Eingabe
// der Formel `clusterContribution = trustRank × min(sourceTier, trustTierCap)` und gehörten von
// Anfang an in den als PHP-spiegelbar deklarierten Quorum-Vertrag. Ihr Fehlen war die Konstanten-
// Spiegel-Hälfte der K1-Wurzelursache (die Verhaltens-Hälfte schließt der `op:'quorum'`-Vektor).
export const QUORUM_CONSTANTS = Object.freeze({
  quorumAuthFloor: _DS.quorumAuthFloor,
  quorumMulti: _DS.quorumMulti,
  quorumTrustRank: Object.freeze({ ..._DS.quorumTrustRank }),
  sourceTier: Object.freeze({ ..._DS.sourceTier }),
  trustTierCap: Object.freeze({ ..._DS.trustTierCap }),
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
  // F-1: Response-Caps mitspiegeln (§G.2 nennt sie parität-relevant). Hinweis: `learnTrustAdjustments`
  // ist ein LOKALER Lese-Op (AC-20.12, kein Wire-Inhalt) — dieser Spiegel ist nur dann bindend, wenn
  // die PHP-Seite ein EIGENES learnTrustAdjustments anbietet; dann müssen die Caps bit-identisch sein.
  suggestionCap: _DS.suggestionCap,
  suggestionEvidenceCap: _DS.suggestionEvidenceCap,
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
