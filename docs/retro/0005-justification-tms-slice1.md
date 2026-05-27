# Retro-ADR 0005 — Justification-TMS (NSAI-Edge Slice #1)

**Status:** abgeschlossen (Review-Runde 2, safe JA) · Branch `nsai-edge-tms-slice1`, PR offen
**Datum:** 2026-05-27
**Zweck:** Retrospektive der Forschungs→Konzept→Umsetzungs-Schleife für die erste Verfeinerung aus §H: ein Justification-basiertes Truth-Maintenance-System (Belief-Revision mit Retraktions-Propagation) für NSAI-Edge.

## Kontext
Nutzer-Auftrag: tiefere Web-Recherche zu neuro-symbolischer KI, Quellen vergleichen, hervorstechende Annahmen ableiten, dann strikt nach CDP5 im Loop ausarbeiten **und umsetzen**. Ziel-Anker: das ai-bundle-Goal „erklärbares, halluzinationsfreies Reasoning" + NSAI-Edge als revidierbares Gedächtnis.

## Recherche → Annahmen (A1–A5, §H.1)
Quellenvergleich (Kautz-Taxonomie; Doyle JTMS / de Kleer ATMS; AGM-Belief-Revision + Entrenchment; Pollock-Defeater; MYCIN-CF-Kritik; NS-Mem 3-Schichten; GraphRAG). Hervorstechend: **A1** Foundations (Glaube nur mit lebender Begründung) → Retraktion gegen Halluzination; **A2** Trust = epistemische Entrenchment-Ordnung (Minimal Change); **A3** Rebutting (Belief-Softmax, vorhanden) vs. Undercutting (TMS, neu); **A4** Konfidenz = Evidenz-Gewicht ≠ Wahrscheinlichkeit (kein naives Produkt — MYCIN-Lehre); **A5** `eternal` = strikt.

## Entscheidungschronik
- **E1 — Konzept-first §H + UC-TMS:** lint 10/10; konzept-reviewer **6,4/10** → drei Scope-Fragen entschieden (eigener Status `retracted`; Re-Aktivierung+Multi-Justification = Slice #1b; DAG-Invariante + Single-Justification). Nachgearbeitet → reif.
- **E2 — Umsetzung TDD:** `_propagateRetraction` (BFS, visited, status-only), DAG-Guard in `infer()`, `retracted`-Status + crash-sichere DB-Migration. Trigger: decayPass + reject (+ peerRevoke nach Review).
- **E3 — Adversarial-Runde 1: NEIN.** Drei echte 🔴 (zwei mit Datenverlust): nicht-crash-sichere Migration, nicht-atomarer decayPass, fehlender quarantine/peerRevoke-Trigger (verwaiste Fakten blieben aktiv UND wurden exportiert — genau der Halluzinationspfad).
- **E4 — Refinement + Adversarial-Runde 2: safe JA.** Migration in einer Transaktion + Resumption; decayPass atomar; peerRevoke propagiert; je Pfad ein Regressionstest. 91/91 grün.

## Prozess-Lehre (Kern)
**Der gegnerische Review ist der eigentliche Wertschöpfer — die grüne Suite war der blinde Fleck.** Beide Audit-Runden fanden Defekte, die 87/91 grüne Tests NICHT zeigten, weil kein Test `peerRevoke`, den decayPass-Abbruch oder den Migrations-Crash fuhr. Bestätigt [[feedback-green-tests-bypass-security]]: Sicherheits-/Konsistenz-Invarianten END-TO-END über die echten Fehlerpfade testen; jeder Adversarial-Fund wird als Regressionstest codifiziert.
Zweite Lehre: **Findings gegen die Realität prüfen** — der Reviewer schlug für den mergeIncoming-Quarantäne-Flip eine Propagation vor; empirisch ist der Pfad aber über die trust-primäre Präzedenz unerreichbar (F1.13 „dead-but-correct") → toten, non-atomaren Zweig entfernt statt halb-defensiv zu flicken.

## Inhaltliche Lehre
Eine persistente CHECK-Constraint-Änderung in SQLite braucht einen **transaktionalen Tabellen-Rebuild mit Resumption** — und namensbasierte Spaltenkopie, weil frühere `ALTER ADD COLUMN` die Reihenfolge verschieben (an Live-DB-Kopie + synthetischem Alt-Schema verifiziert). Belief-Revision ist Status-only: nie die signierte Aussage/Live-Konfidenz/Vector-Clock anfassen → Föderations-/CRDT-Parität bleibt.

## Offen
- Slice #1b: Re-Aktivierung OUT→IN (Trigger im re-assert-Pfad + „kein offenes Rebutting" via resolveBelief) + Multi-Justification.
- §H-Roadmap: 3-Schichten-Gedächtnis (NS-Mem), Hybrid-Retrieval (GraphRAG), gelernte Gewichtung.
- Generator `gen-federation-fixtures.mjs` deterministisch seeden (sonst instabile Conformance-Vektoren).
- PR-Merge (Mensch); Live-MCP-Reload triggert die DB-Migration (an Kopie verifiziert).
