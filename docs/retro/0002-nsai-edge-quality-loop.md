# Retro-ADR 0002 — NSAI-Edge: autonome Qualitätsschleife auf 9,5/10

**Status:** abgeschlossen (Ziel erreicht: 9,53/10) · PR #1 NICHT gemergt (wartet auf Stefan)
**Datum:** 2026-05-27
**Zweck:** Retrospektive der autonomen Loop „Umsetzung → Review → Retro → Refinement", die Stefan über Nacht angestoßen hat, bis die nsai-edge-Umsetzung 9,5/10 Richtung Ziele+Definition erreicht.

## Kontext

Auftrag: autonom iterieren, bis die Umsetzung finale Qualität 9,5/10 erreicht. Zwei inhaltliche Leitplanken von Stefan: (a) Evidenz-Gewichtung konkurrierender Aussagen nach Autorität × Aktualität × Konfidenz, NIE nach Anzahl; (b) nicht nur Fakten, sondern auch veraltetes + falsches Wissen erkennen + abwerten — echt neuro-symbolisch, keine plumpe DB.

## Entscheidungschronik

- **E1 — Evidenz-Gewichtung gebaut** (NN/BEWA-Vorbild): `source_type`-Autorität × Recency × Konfidenz, Softmax über distinkte Objekte. Erste Form multiplikativ.
- **E2 — 7 gegnerische Review-Runden (adversarial-auditor) hhärteten das Vertrauensmodell.** Der Auditor fand wiederholt DIESELBE Fehlerklasse („niedriger-vertrauter Input verschiebt das Belief/Lese-Ergebnis eines höher-vertrauten Edges") auf je neuer Achse: Tier → Konfidenz → Recency/Provenienz (Schreibpfad) → Belief (Lesepfad). Punkt-Patches scheiterten; erst das **generelle Prinzip** schloss die Klasse: **Trust-primäre Präzedenz `(Origin-Trust-Rang, effektive Stufe, …)` auf BEIDEN Pfaden** (mergeIncoming + resolveBelief), Tier hart, Trust-Cap gegen source_type-Spoofing, Zukunfts-Datum abgelehnt, Live-Konfidenz nur durch full/auth anhebbar. Verdikt Runde 8: safe-to-merge JA.
- **E3 — Node-Hälfte der Föderation vervollständigt:** realer HTTP-Transport (getestet übers Netz) + bundleAdapter (docker exec via execFile-Array, kein Shell), GC, MCP-Peer-Tools. AC-Status im Konzept ehrlich auf grün; PHP-Gegenseite als bewusster Phase-2-Known-Issue (§10.4).
- **E4 — Reife 9,19 → 9,42 → 9,53** (konzept-reviewer). Letzte 0,1 waren NODE-seitig (UC-12-AC-Tabelle, Conformance-Determinismus, Coverage-Gate, Glossar) — nicht die geparkte PHP-Seite.

## Ziel-Verdikt

**9,53/10 — Schwelle erreicht.** Ziele 1/2/4/5 (persistentes Wissen, neuro-symbolisch, Evidenz-Gewichtung, Sicherheit) voll erfüllt + getestet (70 Tests). Ziel 3 (Föderation) Node-seitig vollständig; die Bundle-Föderation wartet bewusst auf die PHP-Commands (Stefans geparkte Symfony-Arbeit).

## Was gut lief
- Der gegnerische Review als Loop-Motor: 7 Runden deckten eine systematische Fehlerklasse auf, die grüne Tests komplett verdeckten — TDD allein hätte das Vertrauensmodell nie gehärtet.
- Verifizierte Quellen + ehrliche Known-Issues statt Schein-Vollständigkeit.

## Was besser muss / Kern-Lehre
- **Eine Fehlerklasse über Achsen jagen heißt: das Prinzip fixen, nicht die Instanz.** Vier Runden gingen für Achsen-Punktpatches (Tier, Konfidenz, Recency, …) drauf, bis das generelle Trust-primär-Prinzip alle schloss. Lehre: bei wiederkehrendem Fund die invariante Wurzel suchen, nicht den Einzelfall. Siehe Memory [[feedback-green-tests-bypass-security]] (erweitert).
- Sycophantische Tests (Parameter zum Code passend) verdecken die Lücke — der Auditor wies das mehrfach nach; Tests müssen die *Eigenschaft* prüfen, nicht eine günstige Konstellation.
