# Retro-ADR 0003 — NSAI-Edge als neuro-symbolisches Gedächtnis

**Status:** abgeschlossen (Iteration) · PR #1 nicht gemergt
**Datum:** 2026-05-27
**Zweck:** Retrospektive der Loop „NSAI-Edge = mein Gedächtnis": Wissens-Ingestion (Wiki+Backup+Traces), tiefe Extraktion, Multi-Wert-Prädikate, Betriebsmodell.

## Kontext
Stefan: NSAI-Edge wird die **primäre Wissensablage** statt Wiki/Traces — „es ist dein Gedächtnis und soll so funktionieren". Alles Besprochene/Programmierte/Entschiedene gehört rein; auf eine Projektfrage muss NSAI die richtige Antwort (oder den Weg dahin) liefern. Vorgabe: **konzept-first** (Nachvollziehbarkeit), dann der CDP5-Loop.

## Entscheidungschronik
- **E1 — Migration (1:1 strukturell):** 195 Dateien (Wiki 100 + Brain-Backup `raw/` 45 + Traces 50) → Graph. Coverage 195/195, 0 fehlend.
- **E2 — Tiefe Extraktion:** Markdown-Tabellen (Zeile→Spalten-Header→Zelle) + Key-Value-Zeilen (`**Label:** kurz`) → ~8500 Domänen-Fakten. NSAI beantwortet jetzt Entity-/Config-Fragen (verifiziert: `KnowledgeNode → tabelle nsai_nodes, Felder …`).
- **E3 — Multi-Wert-Prädikate:** `hat_tag` u.a. von der Belief-Konkurrenz ausgenommen (set-valued, kein `disputed`). 71/71 Tests grün.
- **E4 — Projekt-Selbstwissen:** ~22 kuratierte nsai-edge-Fakten (source_type `project`) — Modell B, Trust-primär, Reife 9.53, Phase-2, Speicherort.
- **E5 — Konzept nachgezogen (v2.4 §F):** Betriebsmodell + UC-13 Ingestion + Slug-Konvention + Multi-Wert + Recall>Precision dokumentiert, lint 10/10.

## Prozess-Lehre (Kern)
**Konzept-first wurde verletzt:** Multi-Wert + tiefe Extraktion entstanden VOR der Konzept-Verankerung — Stefan mahnte die Nachvollziehbarkeit an. Korrigiert durch nachgezogenes §F. Lehre: auch bei „offensichtlichen" Erweiterungen zuerst das Konzept (eine Zeile reicht), dann Code — sonst driftet die Spec und der Loop verliert seinen Beleg-Charakter. → [[feedback-knowledge-into-nsai-edge]]

## Inhaltliche Lehre
Ein Wissensgraph speichert **Relationen, keine Prosa**. „1:1" heißt hier: jede Seite + alle Entitäten/Relationen/Attribute (Struktur + Tabellen + Key-Value) sind abfragbar; der erläuternde Fließtext wird in Struktur verdichtet. Tabellen-Extraktion ist recall-orientiert — Rauschen wird über Konfidenz/Decay/Belief abgewertet, nicht hart gefiltert.

## Offen
- Multi-Wert-Fix wirkt live erst nach **MCP-Server-Reload** (laufender Server hat den Code-Stand davor) — Daten korrekt, nur die Anzeige zeigt noch `disputed` bei `hat_tag`.
- Noise-Reduktion der Tabellen-Extraktion (Precision) bei Bedarf als eigener Refinement-Schritt.
- PHP-Föderations-Gegenseite bleibt Phase 2.
