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
  // Epistemische Autorität je source_type (Promille 0–1000) — inhaltsgebunden, NICHT Peer-Trust.
  // Konflikt-Gewichtung: Gesetz schlägt Web, egal wie viele Web-Quellen (BEWA-Quellen-Tupel-Äquivalent).
  authorityWeight: { gesetz: 1000, behoerde: 880, sensor: 820, fachquelle: 760, manual: 700, web: 450, llm: 300, default: 300 },
  // Recency: Halbwertszeit der Belief-Gewichtung in Tagen (neuer gewinnt; exponentiell).
  recencyHalflifeDays: 540,
  // Belief-Schärfe (Potenz-Normalisierung, ratio-basiert): belief ∝ score^sharpness.
  // Größer = schärfer (klarer Gewinner). Robust über stark unterschiedliche Score-Größen.
  beliefSharpness: 3,
  // Zweitplatzierter ab dieser Belief-Schwelle (Promille) → Aussage gilt als "umstritten".
  contestedThreshold: 150,
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
