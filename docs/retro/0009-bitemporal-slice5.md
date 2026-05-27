# Retro-ADR 0009 — Bi-temporale Gültigkeit (NSAI-Edge Slice #5)

**Status:** abgeschlossen (Adversarial NEIN→Fix→safe) · autonom umgesetzt + self-merged (gmail)
**Datum:** 2026-05-27 (autonome Nacht-Session)
**Zweck:** Retrospektive des bi-temporalen Slice — „was galt zum Zeitpunkt T" — und der ersten autonom (ohne Mensch-Bestätigung pro Schritt) durchlaufenen + selbst gemergten Schleife.

## Kontext
Nutzer ging schlafen, autorisierte autonomen Loop + Self-Merge über den gmail/SmR492-Account, mit Auflage: Web-Ideen verifiziert + CDP5-geprüft, bevor sie in Betracht kommen. Slice #5 = §H.2-Punkt 5 (Frontier: Zep/Graphiti, +18,5 % LongMemEval).

## CDP5-geprüfte Architektur-Entscheidungen (vorab, kritisch)
- **Kein Wire-Bruch:** `valid_from` defaultet auf das signierte `asserted_at`; `valid_to` ist LOKAL (wie `retracted`) — nicht signiert/föderiert. So bi-temporal ohne Wire-v2/PHP-Parität-Bruch. Gegen `signingString`/`_edgeToWire` verifiziert.
- **Determinismus-Gate:** Graphitis LLM-Widerspruchs-Erkennung NICHT übernommen → temporale Supersession explizit/deterministisch.

## Entscheidungschronik
- **E1 — Web verifiziert + CDP5-Check:** Zep/Graphiti (4 Zeitstempel, valid-window, non-destruktive Invalidierung), BiTRDF. Übernommen: valid_from/valid_to + as-of + nicht-destruktive Supersession. Verworfen: LLM-Konflikt-Erkennung (Determinismus), föderierte Validität (Wire-Bruch).
- **E2 — Konzept-first UC-BT:** lint 10/10; reviewer **7,4/10** → 🔴 (Default-Materialisierung via COALESCE; as_of konjunktiv zu active; Migrations-Wechselwirkung mit retracted-Rebuild) eingearbeitet.
- **E3 — Umsetzung TDD:** valid_*-Spalten (SCHEMA + EDGES_REBUILD + additive ALTER), as_of auf query/resolveBelief, setValidity, supersedeTemporally, 3 MCP-Tools. **Migration an Live-DB-Kopie (12175 Edges + WAL) verifiziert: kein Datenverlust.**
- **E4 — Adversarial NEIN→Fix:** 🔴-1 supersedeTemporally konnte ein invertiertes Intervall erzeugen (`valid_to < valid_from`) → Vorgänger nirgends mehr sichtbar = stiller lokaler Verlust. + 🟡-5 lexikografischer Zeitvergleich (Offset-Zeiten fehl-sortiert) → UTC-Norm. + 🟡-2 verify ohne as_of. Alle gefixt + Regressionstests. 141/141.
- **E5 — Self-Merge** nach vollem Gate (lint/reviewer/adversarial safe/Tests grün/Live-Migration verifiziert).

## Prozess-Lehre (Kern)
**Autonomie heißt nicht weniger Rigorosität — sie heißt, das Gate selbst hart zu ziehen.** Vor dem Self-Merge: konzept-reviewer + adversarial-auditor (der einen echten Datenverlust-Pfad fand) + Migration an einer **Kopie der echten Live-DB** (nicht nur In-Memory-Fixtures), weil der Merge → MCP-Reload die Migration auf 12k echte Edges loslässt. Der Datenverlust-Fund (🔴-1) bestätigt erneut: der nicht-getestete Rand (Zukunfts-`valid_from` + Rück-Supersession, nur-`Z`-Tests) ist der Bug. [[feedback-green-tests-bypass-security]].
**Web-Validierung + CDP5-Check vor Übernahme** ([[feedback-websearch-in-concept-phase]]): Graphitis LLM-Konflikterkennung wäre verlockend gewesen, verletzt aber das Determinismus-Gate → bewusst auf die Agentenseite verwiesen.

## Inhaltliche Lehre
Bi-temporal ohne Wire-Bruch ist möglich, indem man eine Achse (valid-start) auf das bereits signierte `asserted_at` legt und nur das Ende (`valid_to`) lokal hält. Preis: temporale Ablösung ist lokal, nicht föderiert (🟡-3, dokumentiert). Lexikografischer Zeitvergleich verlangt UTC-Normalisierung — sonst lautlose Fehl-Fensterung bei Offsets.

## Offen
- Slice #5b: föderierte Gültigkeit (Wire-v2), `as_of` auf `search`. #6 (Backlog) gelernte Gewichtung. #1b/#2b/#3b/#4b deferred.
