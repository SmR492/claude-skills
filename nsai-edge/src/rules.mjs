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
