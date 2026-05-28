// Sprachneutrale Regel-Spec (KONZEPT §5). Single Source of Truth für Decay,
// Reinforcement, Inferenz, Quarantäne-Schwelle und Trust-Faktoren.
// Fixed-Point: alle Werte Integer-Promille (0–1000). Division: Trunkierung gegen Null.

export const WIRE_VERSION = 1;

export const DEFAULT_SPEC = {
  wire_version: WIRE_VERSION,
  // Promille-Reduktion pro Decay-Periode je Temporalität (§5 Beispieltabelle).
  decayPerPeriod: { eternal: 0, stable: 5, temporal: 50, ephemeral: 200 },
  // Konfidenz < deleteThreshold (Promille) → superseded (Lösch-Schwelle).
  deleteThreshold: 50,
  // Reinforcement additiv mit Deckel 1000.
  reinforceDelta: 50,
  // Abgeleitete/empfangene Fakten unter dieser Schwelle → Quarantäne.
  quarantineThreshold: 300,
  // Lokale Lese-Linse (UC-02/09): effektive Konfidenz = trunc(conf * factor / 1000).
  trustFactor: { untrusted: 0, limited: 500, full: 1000, authoritative: 1000 },
  // Autoritäts-STUFE je source_type (höher = dominanter). Tiers sind HART: eine höhere Stufe
  // schlägt eine niedrigere unabhängig von Anzahl, Aktualität oder Konfidenz. Gesetz dominiert.
  sourceTier: { gesetz: 6, behoerde: 5, sensor: 4, fachquelle: 3, manual: 2, web: 1, llm: 0, inference: 0, default: 0 },
  // Trust-Deckel: ein Origin kann keine höhere Autoritäts-Stufe behaupten als sein Trust erlaubt
  // (limited kann sich kein gesetz erschleichen → max. Web-Stufe). untrusted → ausgeschlossen.
  trustTierCap: { untrusted: -1, limited: 1, full: 6, authoritative: 6 },
  // Recency-Halbwertszeit je Temporalität (Tage). Autorität bleibt dominant: stabile/ewige
  // Fakten (z.B. geltende Gesetze) zerfallen kaum → ein altes gültiges Gesetz gilt NICHT als
  // "veraltet"; nur temporäre/flüchtige Aussagen verlieren schnell an Recency-Gewicht.
  recencyHalflifeDays: { eternal: Infinity, stable: 3650, temporal: 180, ephemeral: 30, default: 3650 },
  // Belief-Schärfe (Potenz-Normalisierung, ratio-basiert): belief ∝ score^sharpness.
  // Größer = schärfer (klarer Gewinner). Robust über stark unterschiedliche Score-Größen.
  beliefSharpness: 3,
  // Zweitplatzierter ab dieser Belief-Schwelle (Promille) → Aussage gilt als "umstritten".
  contestedThreshold: 150,
  // Mehrwertige (set-valued) Prädikate: mehrere Objekte sind GLEICHZEITIG gültig (kein Widerspruch).
  // Sie sind von der Belief-Konkurrenz/disputed-Logik ausgenommen — jedes Objekt belief 1000.
  multiValuePredicates: ['hat_tag', 'hat_abschnitt', 'verweist_auf', 'quelle', 'gehoert_zu', 'hat_wert', 'enthaelt', 'beispiel'],
  // UC-MS Slice #M.1 — Trust-Quorum-Endorsement (kategorische Verdikte):
  // - quorumAuthFloor: Schwelle für Single-Authoritative-Pfad in `clusterContribution = trustRank × tier`-Skala
  //   (Beispiel: trustRank=full(1000) × tier=fachquelle(3) = 3000 → unter AUTH_FLOOR; full × behoerde(5) = 5000 → erreicht).
  // - quorumMulti: Schwelle für Multi-Cluster-Pfad (≥2 beitragende Cluster).
  // PHP-spiegelbar via Conformance-Vektor.
  quorumAuthFloor: 4500,
  quorumMulti: 2000,
  // trustRank in Promille-Skala (analog trustFactor, aber NUR für Quorum-Aggregation —
  // authoritative > full hier, um die Single-Auth-Schwelle messbar abzubilden).
  quorumTrustRank: { untrusted: 0, limited: 500, full: 1000, authoritative: 1500 },
  // UC-TA Slice #6.1 — Offline-Peer-Trust-Adjustment (Vorschlags-Modus).
  // Reject-Rate (Promille) ab der ein Peer zu `limited` bzw. `untrusted` herabgestuft VORGESCHLAGEN
  // wird. KEIN Auto-Apply — der Nutzer muss explizit peerTrust(peer_id, level) rufen.
  demoteLimitedThreshold: 500,
  demoteUntrustedThreshold: 800,
  // Mindest-Anzahl Aussagen damit ein Peer überhaupt in die Auswertung eingeht (Sybil-Schutz).
  trustAdjustMinEvidence: 5,
  // UC-AD Slice #6.3 — Zugriffs-basiertes Decay (Spaced-Repetition).
  // Innerhalb recallProtectionDays seit dem letzten markRecalled wird decayPerPeriod[temporality]
  // durch recallDecayDivisor geteilt (Integer-Division). Default: Halbierung über 30 Tage.
  recallProtectionDays: 30,
  recallDecayDivisor: 2,
  // Forward-Chaining-Regeln. Pattern-Felder: konkreter String oder '?var'.
  inferenceRules: [
    {
      id: 'glaette-bei-frost',
      premises: [
        { subject: '?x', predicate: 'ist_ein', object: 'Strassengefahr' },
        { subject: 'Temperatur', predicate: 'zustand', object: 'unter_null' },
      ],
      conclusion: { subject: 'Fahrbahn', predicate: 'zustand', object: 'gefaehrlich' },
      factor: 900, // Promille
    },
  ],
};

// Trunkierung gegen Null (§5 normativ). Werte sind stets ≥ 0.
export const trunc = (x) => Math.trunc(x);

export function trustFactor(spec, level) {
  return spec.trustFactor[level] ?? 0;
}
