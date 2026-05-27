# Retro-ADR 0008 — Verifikation `verify(claim)` (NSAI-Edge Slice #4)

**Status:** abgeschlossen (Adversarial NEIN→Fix→safe) · Branch `nsai-edge-verify-slice4`, PR offen
**Datum:** 2026-05-27
**Zweck:** Retrospektive des Verifikations-Slice — der „Schlussstein" für halluzinationsfreies Reasoning — und der durch ihn aufgedeckte vorbestehende resolveBelief-Bug.

## Kontext
Nach Recherche-Runde 2 (2026-Frontier) hat der Nutzer die §H-Roadmap umpriorisiert: **Verifikation = neues Slice #4** (frontier-validiert, deterministisch, trifft das Ziel direkt), bi-temporal = #5, „gelernte Gewichtung" → #6 Backlog (nicht-deterministisch). `verify(s,p,o)` → supported/contradicted/unknown.

## Entscheidungschronik
- **E1 — Web-validierte Methode:** VeriCoT (Logik-Verifikation von CoT), Eidoku („kein Pfad ⇒ ablehnen"), ClaimVer (KG-Claim-Attribution). Kern: die symbolische Basis prüft die LLM-Aussage.
- **E2 — Designentscheidung:** `verify` als **reine Projektion von resolveBelief** (keine zweite Belief-Logik → keine Drift). Open-World-Pflicht: Abwesenheit → unknown, nie contradicted.
- **E3 — Konzept-first UC-V:** lint 10/10; konzept-reviewer **7,9/10** → 🔴 eingearbeitet: `winner===null` (allZero) muss → unknown (nicht contradicted!); `present` = Kandidat-Ebene; contested-Flag-AC; Projektions-Invariante. §H.2-Roadmap umgeschrieben.
- **E4 — Umsetzung TDD:** `verify()` + MCP `graph__verify`. 127/127.
- **E5 — Adversarial-Review: NEIN.** 🔴-1: der `cands.length===1`-Kurzschluss in `resolveBelief` lief VOR dem Gültigkeitsfilter → eine **einzelne untrusted/gewichtslose** Aussage (erreichbar via `clone bulkPromote`) wurde Belief-Gewinner mit belief 1000 → `verify` lieferte fälschlich contradicted/supported. Fix in resolveBelief (gleicher Gültigkeitstest wie Multi-Pfad → winner=null bei untrusted/weightless). 128/128, keine Bestands-Regression.

## Prozess-Lehre (Kern)
**Ein neues Feature deckt latente Bugs im Bestand auf — und der gefundene Fehler war schlimmer als „nur Slice #4".** Der allZero-Single-Candidate-Bug saß seit der Belief-Linse in `resolveBelief`; ohne `verify` wäre er unsichtbar geblieben (query markiert ihn nur als belief-1000-„Gewinner"). Der Adversarial-Review fand ihn über den **Föderationspfad** (clone bulkPromote → aktive untrusted-Kante) — exakt der Fall, den die grünen Tests (zwei untrusted Kandidaten, nie EINER) ausließen. Bestätigt erneut [[feedback-green-tests-bypass-security]]: der nicht-getestete Rand (genau EIN gewichtsloser Kandidat) war der Bug. **Fix am Prinzip** (Single-Pfad an Multi-Pfad-Gültigkeit angleichen), nicht in verify — sonst zweiter Belief-Pfad (AC-12.11-Verletzung).

## Inhaltliche Lehre
„Halluzinationsfrei" hat zwei Richtungen: nichts Falsches behaupten (contradicted nur bei echtem, durchsetzungsfähigem Gegen-Belief) UND Nichtwissen ehrlich als `unknown` ausweisen (Open-World). Ein falsches `contradicted` ist gefährlicher als Schweigen — es behauptet aktiv Gegenwissen. Genau deshalb ist der allZero→unknown-Pfad die Kern-Invariante.

## Offen
- Slice #5 bi-temporale Gültigkeit · #6 (Backlog) gelernte Gewichtung.
- Slice #4b: strukturelle Pfad-Verifikation (Eidoku, via search/PPR `related`), Multi-Tripel-Claim-Zerlegung.
- PR-Merge (Mensch).
