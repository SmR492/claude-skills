# Retro-ADR 0015 — FTS5+BM25 Volltext-Suche im Episoden-Recall (NSAI-Edge Slice #R3)

**Status:** abgeschlossen · autonom + self-merged (PR #15) · 2 Adversarial-Audit-Runden
**Datum:** 2026-05-28
**Zweck:** Retrospektive eines Slices, in dem die Wahl der Datenbank-Erweiterung **kritisch evaluiert** wurde — Stefan hatte explizit zwei Gemini-Snippets als Diskussionsgrundlage geteilt mit der Aufforderung „bewerte es aber bitte vorher". Genau das ist der Memory-Pattern „externe KI-Entwürfe nur Startmaterial".

## Kontext
RAG-2026-Pattern: BM25 als Minimum-Viable-Baseline für Retrieval. Stefan teilte zwei SQLite-Code-Snippets (FTS5-MATCH + Recursive-CTE-Graph-Traversal) mit der Bitte, sie zu bewerten BEVOR Übernahme. Resultat: nur einer der zwei Snippets wurde übernommen — und auch der nur mit substanzieller Anpassung.

## CDP5-geprüfte Architektur-Entscheidungen
- **FTS5 nur auf `episodes.content`** — echter Volltext (1–8000 Zeichen) profitiert von BM25-Ranking. `knowledge_nodes.name` (atomare Identifier wie `EU-KI-VO`) bleibt LIKE — Whole-Token-Identifier lohnen FTS5 nicht.
- **Recursive CTE bewusst NICHT übernommen** — würde unsere deterministische BFS-Reihenfolge (#R1), die Status-Konjunktion (#M.1) und die UC-BT-Lese-Linse (#5d) zurücksetzen. Vier Slices Härtung wären verloren.
- **Vektor-Embeddings bewusst NICHT** — Determinismus-Bruch. 2026er Benches zeigen: BM25 schlägt sogar text-embedding-3-large.
- **Phrase-Quote-Sanitization** — jeder Token nach Allowlist-Filter in `"token"` eingebettet. Schützt strukturell vor textuellen FTS5-Operatoren (AND/OR/NOT/NEAR).

## Entscheidungschronik
- **E1** — Stefan teilt Gemini-Snippets, fordert Bewertung vor Übernahme. Snippet 1 (Recursive CTE) verworfen mit 6 Begründungen (Determinismus, Status, UC-BT, Performance, Wartbarkeit, gerichtet vs. ungerichtet). Snippet 2 (FTS5 MATCH+BM25) übernommen als Pattern, mit Sanitization-Pflicht.
- **E2** — Empirische Vorabprüfung: FTS5 in `node:sqlite` verfügbar. Bindestrich-Identifier brauchen besondere Behandlung (Phrase-Mode). Trigram-Tokenizer hat 3-Zeichen-Minimum (matched `KI` nicht). Unicode61 mit tokenchars+`-` behält Whole-Tokens — aber Substring-Match auf Whole-Tokens funktioniert nicht. **Konsequenz**: FTS5 nicht für Knoten-Namen, sondern für Episode-Volltext (Sweet-Spot).
- **E3** — Stefan bestätigt: Mehrwort-Anfragen nicht ausschließen, „normal weitermachen". Slice-Scope umfokussiert.
- **E4** — Implementation: Schema (FTS5 + 3 Trigger), Sanitization-Helper, `recallEpisodes`-Erweiterung, idempotente Migration. 12 AC-Tests + 2 bestehende Tests angepasst.
- **E5** — Adversarial-Audit Runde 1: **NEIN.** Zwei kritische Findings:
  - 🔴-1 **Operator-Injection durch textuelle Operatoren**: Allowlist `\p{L}\p{N}\s` lässt `AND`/`OR`/`NOT`/`NEAR` durch. Empirisch: „Operatoren AND OR" → SQL-CRASH. „Sicherheit NOT wichtig" → maskiert das Matching. Stefans Halluzinations-Constraint direkt verletzt.
  - 🔴-2 **Migrations-Bug bei Pre-R3-DBs**: `COUNT(*) FROM episodes_fts` reflektiert bei `content='episodes'`-FTS5-Tables die **Quell-Tabelle**, nicht den Index. Jede bestehende DB hätte nach R3-Update einen leeren FTS5-Index, der nie gefüllt würde → systematisch leere Treffer. Genau Stefans „plumpe Halluzination wenn Wissen fehlt"-Szenario.
- **E6** — Fix Runde 1:
  - 🔴-1: jeder Token in Phrase-Quotes (`"token"`) — FTS5 nimmt Phrasen wörtlich, keine Operator-Interpretation.
  - 🔴-2: Migrations-Check auf FTS5-Shadow-Table `episodes_fts_docsize` (echte Index-Größe).
  - 🟡: KONZEPT-Aussage zu k1/b-Pinning entschärft (FTS5 erlaubt keinen SQL-Override), Doku-Hinweis auf SQLite-Mindestversion.
  - Regressionstests für beide 🔴 + term=''-Schutz.
- **E7** — Adversarial-Audit Runde 2: **safe JA.** Phrase-Quoting strukturell wirksam (Quote-Injection via Allowlist ausgeschlossen). Migrations-Pfad mit Shadow-Count korrekt. Prefix-Matching jetzt nicht mehr möglich — als bewusste Scope-Grenze im KONZEPT dokumentiert (ergänzt).
- **E8** — Self-Merge PR #15.

## Prozess-Lehre (Kern)
**Externer Code von KIs ist Startmaterial, nicht Lösung.** Stefans expliziter Reflex „bewerte es bitte VORHER" war richtig. Snippet 1 (Recursive CTE) wäre ein Rückschritt gewesen — alle vier vorigen Slice-Härtungen (Determinismus, Status, UC-BT, BFS-Reihenfolge) gingen verloren. Snippet 2 (FTS5 MATCH) war Standard-Boilerplate, aber **ohne Sanitization** eine Operator-Injection-Falle. Nur durch Bewertung gegen die bestehenden Leitplanken (Determinismus-Gate, Open-World, Adversarial-Audit-Lehren) konnte gefiltert werden, was tatsächlich passt. [[feedback-pushback-welcome]] · [[feedback-websearch-in-concept-phase]]

**FTS5 hat zwei Operator-Klassen, nicht eine.** Symbol-Operatoren (`-`, `+`, `:`, `*`, `^`, `(`, `)`, `"`) sind die offensichtliche Klasse. Textuelle Operatoren (`AND`, `OR`, `NOT`, `NEAR`) sind die heimtückische — sie sind reine Letters und passieren naive Allowlists. Eine zufällig groß geschriebene deutsche Konjunktion am Satzanfang einer User-Anfrage konnte den ganzen Such-Pfad crashen. Adversarial-Audit ist genau dafür da.

**External-Content-FTS5-Tables haben subtile Count-Semantik.** `SELECT COUNT(*) FROM episodes_fts` liefert *nicht* die Index-Größe sondern die **Quell-Tabellen-Größe**. Wer Migrations-Bedingungen darüber baut, baut auf Sand. Die FTS5-Shadow-Table `episodes_fts_docsize` ist der korrekte Pfad. Stefan-Audit-Lehre: jede neue DB-Konstruktion empirisch verifizieren, nicht aus Doku ableiten.

## Inhaltliche Lehre
**FTS5 ist mächtig genau dort wo Volltext ist.** Knoten-Namen sind Identifier — FTS5 würde sie als Whole-Tokens speichern, der Gewinn ist null. Episoden sind Volltext — FTS5+BM25 wirkt semantisch. Klare Scope-Trennung gewonnen.

**Phrase-Quote-Sanitization ist die saubere Lösung für User-Input in FTS5.** Statt jeden Operator einzeln zu erkennen und zu entfernen (Cat-and-Mouse), wird jedes Token in Phrase-Quotes verpackt. FTS5 nimmt Phrasen wörtlich — alle Operatoren werden zu Literal-Tokens. Mehrwort-Suche bleibt erhalten via implicit-AND zwischen Phrasen. Defensiver Default, der auch zukünftige FTS5-Operatoren strukturell ausschließt.

**Bewusste Scope-Grenzen im KONZEPT explizit machen.** Prefix-Matching (`KI*`) ist mit Phrase-Quoting strukturell ausgeschlossen. Statt das implizit hinzunehmen, im KONZEPT explizit dokumentiert: „was NICHT angeboten wird". Schließt Konsumenten-Erwartungen ehrlich aus.

## Offen
- **Slice #R3b (deferred):** Alias-Tabelle für Synonym-Knoten (Domain-Wörterbuch). Stemming für Deutsch (Wortstamm-Match „Schulungen" findet „Schulung").
- **MCP-Schema-Cap für `term`-Länge** (DoS-Härtung) — nicht-blockierend, gleicher Stand wie pre-R3.
- **Conformance-Vektor für FTS5-BM25** — falls die PHP-Seite je ihre eigene Volltext-Implementierung gegen unsere validieren will, brauchen wir einen kanonischen Test-Vektor.
