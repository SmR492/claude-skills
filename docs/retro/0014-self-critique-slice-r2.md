# Retro-ADR 0014 — Self-Critique-Pflicht-Pass (NSAI-Edge Slice #R2)

**Status:** abgeschlossen · autonom + self-merged (PR #14) · 2 Adversarial-Audit-Runden
**Datum:** 2026-05-28
**Zweck:** Multi-Claim-Verify als Pflicht-Schnittstelle für Agenten. Retrospektive einer subtilen Konfabulationsfalle, die ein bestätigender Reviewer übersehen hätte: Wenn das Aggregat `contested:true`-Claims als `all_supported` maskiert, publiziert der Agent stillschweigend erkannte Konflikte.

## Kontext
Slice #R2 = Self-Critique aus RAG-2026 (LLM prüft seine Antwort gegen die Retrieval-Quellen, bevor er antwortet). Wir liefern das **deterministisch** als Bulk-Verify mit kategorischem Aggregat — der LLM ist Konsument, nicht Teil der Bewertung.

## CDP5-geprüfte Architektur-Entscheidungen
- **Kategorische Aggregate, KEINE Wahrscheinlichkeiten** — Output ist `any_contradicted` / `any_contested` / `any_unknown` / `all_supported`, mit eindeutiger Priorität. Konsument trifft binäre Entscheidungen.
- **Per-Claim-Output Allowlist-Strip** — nur kategorische Felder im Result (`verdict`, `contested`, `multiValue`, `dominant`, `present`, `corrective_hints` mit ID-Feldern, `corrective_searched`). Numerische Provenienz (`belief`, `quorum.weighted_support`, `derived_from`-Ketten) MUSS über separate Tools abgerufen werden.
- **Read-Snapshot via Transaktion** — alle Per-Claim-verify-Aufrufe sehen denselben DB-Zustand, selbst unter konkurrenten Schreibungen.
- **fail-closed as_of-Validierung** — ungültiges ISO-Datum wirft, keine stille Coercion auf jetzt.

## Entscheidungschronik
- **E1** — Konzept-First UC-SC mit AC-17.1-17.11. Lint 10/10.
- **E2** — Implementation: einfache Schleife über `verify` + 3-stufige Aggregat-Regel. 12 Tests grün.
- **E3** — Adversarial-Audit Runde 1 (durch API-Overload verzögert, dann nachgeholt): **NEIN.** Zwei kritische Findings:
  - 🔴-5 **`contested:true` als `all_supported` maskiert**: Ein Claim mit Quorum-supported, aber resolveBelief-Konflikt zu anderem Objekt → `verdict='supported', contested:true`. Mein Aggregat hatte nur drei Stufen; `contested` rutschte in `all_supported`. Empirisch reproduziert: 50/50-Konflikt liefert `aggregate:'all_supported'` — Agent würde stillschweigend einen Konflikt publizieren. Genau der Halluzinations-Pfad, den Slice #R2 verhindern soll.
  - 🔴-1/4 **Probabilistik-Leak im Per-Claim-Result**: das verify-Resultat wurde 1:1 durchgereicht inkl. `belief: 500`-Promille und `quorum.weighted_support: 7500`. Das sind numerische Wahrscheinlichkeits-Repräsentationen — gegen Stefans expliziten „keine Wahrscheinlichkeiten"-Constraint.
  - Plus 🟡: silent as_of-fail-open, keine Read-Tx, AC-17.8 nicht trennscharf.
- **E4** — Fix:
  - Neue Aggregat-Kategorie `any_contested` zwischen contradicted und unknown.
  - Per-Claim-Output **Allowlist-Strip**: kategorische Felder durchgelassen, numerische gefiltert.
  - `_validIso`-Vorprüfung pro Claim → INVALID_PARAMETER_FORMAT statt Coercion.
  - `assertClaims` in `_tx(...)` wrappen.
  - AC-17.3b/17.8 (numerische Provenienz)/17.12/17.13.
- **E5** — Adversarial-Audit Runde 2: **safe JA.** Beide 🔴 strukturell geschlossen (Strip ist Allowlist, Aggregat-Priorität eindeutige if/else-Kette). Drei kleine 🟡-Doku/Verfeinerungs-Hinweise — eine als Doku-Edit übernommen (derived_from-Strip), zwei als Backlog (Read-only-Tx-Variante, Validierungs-Reihenfolge).
- **E6** — Self-Merge PR #14.

## Prozess-Lehre (Kern)
**Aggregations-Logik ist eine Konfabulations-Falle.** Wenn der Per-Claim-Output mehrere Achsen trägt (Verdikt + contested-Flag + multiValue-Flag), MUSS das Aggregat alle relevanten Achsen abdecken. Ein einfaches `if (any contradicted) ... else if (any unknown) ... else all_supported` ignoriert die contested-Achse — und das ist genau die stille Halluzination, die Slice #R2 verhindern sollte. Der Auditor hat das in einer Probe konstruiert (Probe 8), die mein Test-Set nicht hatte.

**Probabilistische Provenienz darf nicht in kategorische Outputs leaken.** Ein Per-Claim-`belief: 500` (Promille) ist semantisch ein Wahrscheinlichkeits-Wert — auch wenn er Integer kodiert ist. Stefan's Constraint „keine Wahrscheinlichkeiten" gilt nicht nur für Float-Felder, sondern für die semantische Kategorie. Allowlist-Strip ist der saubere Fix: explizit, was rausgeht; alles andere bleibt drinnen.

**„Tests grün + Self-Audit = grünes Licht" ist ein bekannter blinder Fleck.** Die 12 AC-17-Tests hatten *keine* Probe für `contested + supported` zusammen, und die Probabilistik-AC (17.8) prüfte nur String-Tokens (`%`, „vermutlich"), nicht numerische Integer-Felder. Adversarial-Audit fand beides in einer Probe. [[feedback-green-tests-bypass-security]]

## Inhaltliche Lehre
**Aggregat-Priorität ist eine Stefan-Direkte-Entscheidung.** „contested→`any_contested`" oder „contested→`any_unknown` (konservativ)" — beide sind verteidigbar. Ich habe `any_contested` als eigene Kategorie gewählt, weil es semantisch ehrlicher ist: ein contested-Claim ist *nicht* unbekannt (Wissen ist da), sondern *umstritten* (mehrere Quellen widersprechen). Das ist eine wichtige Unterscheidung für den Agenten — bei `any_unknown` muss er recherchieren, bei `any_contested` muss er den Konflikt thematisieren.

**Allowlist statt Blocklist für Output-Strip.** Eine Blocklist (`delete v.belief`) bricht, sobald ein neues numerisches Feld dazukommt. Eine Allowlist (`{ verdict: v.verdict, contested: v.contested, … }`) bleibt sicher — neue Felder müssen explizit aufgenommen werden, ein Vergessen führt zu „weniger Output", nicht zu „neuem Leak". Defensiver Default.

## Offen
- **Read-only-Tx-Variante** (`BEGIN DEFERRED` statt `BEGIN IMMEDIATE` für reine Read-Operationen) — Backlog, Performance-Optimierung unter konkurrenten Schreibungen. Nicht-blockierend bei aktueller Last.
- **Validierungs-Reihenfolge** (Format-Validierung VOR Tx, statt während verify) — kosmetisch.
- **`graph__verify` als „voller Provenienz"-Pfad** dokumentiert (KONZEPT.md UC-SC) — Konsumenten wissen jetzt, wo sie numerische Provenienz herholen.
- **Slice #R3 BM25-Seed-Ranking** — nächster Slice; mit Mehrwort-Support (Stefan-Entscheidung). FTS5 als deterministische SQLite-Erweiterung.
