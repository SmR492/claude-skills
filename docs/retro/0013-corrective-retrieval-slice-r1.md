# Retro-ADR 0013 — Corrective Retrieval (NSAI-Edge Slice #R1)

**Status:** abgeschlossen (Re-Design nach Adversarial-NEIN) · autonom + self-merged (PR #13)
**Datum:** 2026-05-28
**Zweck:** Retrospektive eines Slice, dessen erster Wurf vom Adversarial-Audit zerlegt wurde — und der erst nach **konzeptionellem Re-Design** safe war. Stärkste Bestätigung für Stefans „weg von plumpen Halluzinationen, hin zu menschenähnlichem Gedächtnis mit Stärken aber ohne Schwächen".

## Kontext
Slice #R1 = Corrective Retrieval aus den RAG-2026-Pattern: „wenn `verify=unknown`, eine zweite Runde mit erweitertem Suchraum bevor man final unknown sagt". Erste Implementation hob `unknown` auf `supported` mittels Substring-Subgraph-Lookup — schien sauber, alle Tests grün.

## CDP5-geprüfte Architektur-Entscheidungen
- **Hint-Modell statt Verdikt-Lift** (re-designed nach Adversarial Runde 1): Stufe 2 ändert das Verdikt NIE. Sammelt nur `corrective_hints[]`. Konsument entscheidet, ob die Hinweise hilfreich sind.
- **Exakt-Knoten-Gate**: Subject muss in `knowledge_nodes` als exakter Name vorhanden sein — kein LIKE/Substring-Rescue.
- **Direkte BFS-Adjazenz statt PPR/`search`**: kein DoS-Vektor, deterministische Reihenfolge nach `triple_hash`.
- **multiValue-Pfad deaktiviert**: Tags/Eigenschaften sind Subject-spezifisch und dürfen nicht über verwandte Subjekte projiziert werden.

## Entscheidungschronik
- **E1** — Web-Recherche RAG-2026: Corrective RAG-Pattern bestätigt (96 % Halluzinations-Reduktion in Enterprise). Wir adaptieren das deterministisch.
- **E2** — Konzept-First UC-CR mit AC-16.1-16.10. Lint 10/10.
- **E3** — Implementation: `_maybeCorrective` via `search({max_hops: 2, as_of})` → Subgraph-Match auf (predicate, object) → wenn Quorum-supported → `verdict: 'supported', corrective: true, via_subject: c.subject`. 10/10 ACs grün direkt.
- **E4** — Adversarial-Audit Runde 1: **NEIN.** Zwei kritische Konfabulations-Pfade:
  - **🔴-1 Substring-Match-Konfabulation:** `search(term: subject)` nutzt SQL-LIKE auf `knowledge_nodes.name`. „KI-VO" matched „FAKE-KI-VO". Wenn ein bösartiges Tripel `(FAKE-KI-VO, verpflichtet_zu, KI-Manipulation)` mit Quorum vorliegt → `verify({subject: KI-VO, …}) === supported`. Stefans gefürchtete plumpe Halluzination.
  - **🔴-2 Cross-Subject-Tag-Leak:** `Doc-A relates_to Doc-B`, `Doc-B hat_tag blau` quorum-supported → `verify({subject: Doc-A, predicate: hat_tag, object: blau}) === supported`. Doc-A bekommt einen Tag zugeschrieben, der einem verbundenen Dokument gehört.
- **E5** — Re-Design: **Hint-Modell**. Stufe 2 ändert das Verdikt NIE; sammelt nur Hinweise.
  - Exakt-Knoten-Gate (kein LIKE).
  - BFS direkt über `knowledge_edges`-Adjazenz (kein `search`/PPR).
  - multiValue-Pfad explizit deaktiviert.
  - KONZEPT.md UC-CR komplett überarbeitet. Alle 10 AC umformuliert.
- **E6** — Adversarial-Audit Runde 2: **safe JA-mit-Einschränkung.** Beide 🔴-Pfade strukturell ausgeschlossen. Zwei 🟡 (Doku-Drift im Determinismus-Gate-Satz, MCP-Tool-Description-Klarstellung) — beide Doku-Edits, gemacht.
- **E7** — Self-Merge PR #13.

## Prozess-Lehre (Kern)
**Der erste Wurf eines „naheliegenden" Pattern-Slices kann strukturell unsicher sein, obwohl er den Concept-Constraint scheinbar erfüllt.** Slice-#R1-V1 erfüllte AC-16.7 *buchstäblich* („gefragtes Tripel muss physisch existieren") — aber der **starke** Constraint („das Verdikt muss sich auf das gefragte Subject beziehen, nicht auf einen Substring-Verwandten") war nicht codifiziert. Der Auditor hat den Constraint richtig gelesen, ich nicht.

**Lehre für CDP5:** Wenn ein neuer Lese-Pfad das Verdikt verändert (von unknown nach etwas Anderem), MUSS die AC-Tabelle einen Test enthalten, der einen *gegnerischen* Substring-Match einbaut und prüft, dass das Verdikt NICHT kippt. Nicht nur AC-positives Verhalten, sondern AC-negatives „darf das NIE tun".

**Stefans Klarstellung war die richtige Schwelle:** „weg von plumpen Halluzinationen, wenn Wissen fehlt" — der Substring-Match liefert exakt diese plumpe Halluzination. Der Audit hat das Vokabular der Konfabulation in Stefans Constraint aufgegriffen und damit das Verdikt 🔴 statt 🟡 gerechtfertigt.

**Eleganz der Lösung:** Das Hint-Modell ist semantisch ehrlicher als das Verdikt-Lift. Es gibt dem Konsumenten DIESELBE Information, ohne ein eigenes Urteil zu fällen, das durch keine logische Brücke gestützt ist. „Hier sind verwandte Subjekte, die diese Aussage tragen — was du daraus machst, ist deine Verantwortung."

## Inhaltliche Lehre
**Verdikt-Lift in Stufe 2 ist eine Konfabulationsfalle.** Egal wie konservativ die Filter, die Übertragung einer Aussage von einem Subject auf ein anderes (via Substring-Match, Synonym, Verwandtschaft) ist semantisch nicht zuverlässig zu rechtfertigen ohne Domain-Wissen. Das Hint-Modell vermeidet die Falle vollständig.

**multiValue-Prädikate sind eine eigene Klasse.** Sie sind Subject-spezifisch, nicht universell. Stufe-2-Pfade müssen multiValue explizit ausschließen, sonst entsteht Cross-Subject-Tag-Leak.

**BFS statt PPR für lokale Adjazenz.** PPR ist eine *Relevanz-Linse* für Multi-Hop-Retrieval, BFS ist eine *Struktur-Linse* für direkte Nachbarschaft. Für Stufe 2 (lokale Hinweise) ist BFS richtiger, schneller, deterministischer.

## Offen
- **Slice #R1b (deferred):** echte Alias-Tabelle (`aliases(node_id, alias)`) für Synonym-Hinweise. Wäre stark, braucht aber Domain-Wörterbuch. Backlog.
- **MCP-Konsumenten-Schutz:** wir warnen in der Tool-Description, dass `corrective_hints` keine Verdikt-Verstärkung sind. Ein LLM-Konsument könnte trotzdem Konfabulation produzieren. Härtung später (z. B. Hints nur auf expliziter Anfrage).
- **Slice #R2 / #R3:** Self-Critique-Pflicht-Pass, BM25-Seed-Ranking.
