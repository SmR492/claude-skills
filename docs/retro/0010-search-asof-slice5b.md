# Retro-ADR 0010 — `as_of` im Hybrid-Retrieval (NSAI-Edge Slice #5b)

**Status:** abgeschlossen (Adversarial JA-mit-Einschränkung → drei 🟡 differenziert behandelt) · autonom umgesetzt + self-merged (gmail/SmR492, PR #10)
**Datum:** 2026-05-28 (Fortsetzung der autonomen Nacht-Session)
**Zweck:** Slice #5b — `search({as_of:T})` schließt die letzte Lese-Linsen-Lücke; Retrospektive des kleinen, narrow scope gehaltenen Sub-Slices und der differenzierten Adversarial-Behandlung (mitfixen, entautologisieren, deferred).

## Kontext
§H.2-Punkt 5 (Slice #5) hatte `as_of` an `query`/`verify`/`resolveBelief` gebracht, aber `search` blieb außen vor. Damit lieferte ein historisches `search` jetzt-gültige Kanten und Zukunfts-Episoden — Hybrid-Antwort zwischen den Achsen inkonsistent. Slice #5b schließt die Lücke.

Vorlauf war der reale End-to-End-Test gegen die EU-KI-VO-Compliance (`/tmp/demo-kivo.mjs`): Episode + autoritäts-gewichtete Fakten („gesetz" schlägt „llm" 1000:0), verify supported/contradicted/unknown (open-world), PPR-Multi-Hop, bi-temporal as-of, supersedeTemporally Entwurf→final, Provenienz. Alle Pfade wie erwartet — bestätigt die Stack-Reife.

## CDP5-geprüfte Architektur-Entscheidungen (vorab)
- **Narrow scope:** gleiche `_validClause`-Klausel wie `query`/`verify`/`resolveBelief`, keine eigene Lese-Logik. Linsen-Konsistenz strukturell (gleiche SQL), nicht behauptet.
- **Determinismus-Gate unangetastet:** PPR bleibt lokale Float-Linse; `as_of` ist read-only, nicht im Wire, nicht in der Signatur, nicht in `exportSince`.

## Entscheidungschronik
- **E1 — Demo zuerst** (`node /tmp/demo-kivo.mjs`): bestätigt, dass der Stack auf einem realen Compliance-Szenario die erwarteten Verdikte/Beliefs/Pfade liefert. Eine Subtilität: nach `reject` zeigt `verify` das Gerücht weiter als `contradicted` (statt `unknown`) — konsistent zur Dominanz-Logik, aber für die Erklärbarkeit fragwürdig (in Backlog notiert, kein 5b-Scope).
- **E2 — Patch-statt-Slice:** kein eigener Konzept-Vorlauf, sondern UC-HR-Erweiterung (Schritt 2, AC-11.11–11.14). Lint blieb 10/10.
- **E3 — Implementation TDD:** `search(as_of=null)` + `_validIso`-Vorprüfung + `_validClause`-Verkettung; `recallEpisodes(until=…)`; MCP-Schema + Aufruf. 145/145 grün (vor 🟡-Fixes).
- **E4 — Adversarial-Audit (JA-mit-Einschränkung), differenziert behandelt:**
  - **🟡-A** (recallEpisodes ignoriert `as_of` → Lese-Linsen-Bruch zwischen Kanten- und Episoden-Achse): **im 5b mitgefixt** — `recallEpisodes` bekommt `until`, `search` reicht `as_of` als until durch. AC-11.14/11.14b dazu.
  - **🟡-B** (AC-11.13 testete objekt-bezogen → tautologisch belegt): **entautologisiert** zum per-Kante-Vertrag. KONZEPT-Text klargestellt: `search ⊆ query` ist NICHT der Vertrag (Topologie-Reichweiten unterscheiden sich, LIKE+k-Hop vs. exact+1-Hop). Der echte Vertrag: identische Validitäts-Klausel.
  - **🟡-C** (UTC-Z nur lese-seitig, nicht daten-seitig — vorbestehender Defekt): **als Slice #5d deferred**, mit Repro-Case + Fix-Plan im KONZEPT.md eingetragen. Kein Scope-Creep in 5b.
- **E5 — Konzept-Hygiene:** Fehlerfall-Block synchron mit AC-11.12 (🟡-1), Test-Belege bei AC-11.12/11.13 ergänzt (🟡-3).
- **E6 — Self-Merge** (PR #10) nach vollem Gate.

## Prozess-Lehre (Kern)
**Adversarial-Findings sind nicht eine Liste „zu fixen" — sie sind eine Liste mit drei Antworten: (a) jetzt fixen, (b) im Konzept klarstellen, (c) sauber deferred dokumentieren.** Slice #5b zeigt alle drei: 🟡-A war eine echte Folge des #5b-Designs, also gehört der Fix ins #5b. 🟡-B war ein Test-Schwäche-Fund (Tautologie) — entautologisieren und Vertrag korrekt formulieren. 🟡-C war ein vorbestehender Defekt, den #5b nur sichtbar macht — der gehört als eigener Slice in den Plan, nicht als Last in 5b. Diese Differenzierung schützt Reviewer + Auditor vor „Findings-Inflation" und hält den narrow scope wirklich narrow.

**Den Test als Vertrag lesen, nicht als Indikator.** AC-11.13 war grün — der Auditor zeigte aber, dass der grüne Test nichts beweist (Tautologie über ein bestimmtes Objekt). Lehre wieder einmal: ein grüner Test ohne präzise Vertragsaussage gibt falsche Sicherheit. [[feedback-green-tests-bypass-security]]

**Nicht jeder Fund ist neu.** Der ⚡ Effekt-Test war: der Auditor fand auch das vorbestehende UTC-Z-Datenseite-Loch — ein Bug, den Slice #5b nicht erzeugt, aber sichtbarer macht. Kein 5b-Stopper, aber ein guter Anstoß für #5d.

## Inhaltliche Lehre
Lese-Linsen-Konsistenz ist eine **strukturelle** Eigenschaft, nicht eine behauptete: gleiche SQL-Klausel an allen Lese-Pfaden (resolveBelief, query, verify, search). Wo sich Topologie unterscheidet (LIKE vs. exact, k-Hop vs. 1-Hop), kann es trotzdem keine Validität-Inkonsistenz geben — der Vertrag ist „dieselbe Filter-Klausel", nicht „derselbe Subgraph".

Episoden-Achse braucht ihre eigene Linse (`occurred_at`, nicht `valid_*`) — bewusst getrennt, damit Episoden-GC und bi-temporale Sichtbarkeit nicht miteinander interferieren.

## Offen
- **Slice #5d** (deferred, dokumentiert): UTC-Z auf der Datenseite (`storeTriple`/`mergeIncoming` `asserted_at`) + einmalige Migration der Bestands-Spalte. Eigene Risiko-Betrachtung, Live-DB-Kopie-Test, dann eigener PR.
- Föderierte Gültigkeit (Wire-v2) bleibt weiter deferred — bewusst.
- `reject`-vs-`verify`-Subtilität (rejected-Tripel zeigt `contradicted` solange Dominanz besteht) — UX-Schliff für UC-V, keine Korrektheit-Lücke, Backlog.
