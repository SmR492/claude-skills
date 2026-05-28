# Retro-ADR 0011 — UTC-Z auf der Datenseite (NSAI-Edge Slice #5d)

**Status:** abgeschlossen (Adversarial NEIN→Fix→JA-mit-Einschränkung→JA) · autonom + self-merged (PR #11)
**Datum:** 2026-05-28
**Zweck:** Retrospektive des UTC-Z-Datenseite-Slice und der zwei Adversarial-Audit-Runden — der zweite Audit fand drei weitere 🔴-Pfade, die ich beim Erstausbau übersehen hatte.

## Kontext
Slice #5 (UC-BT) hatte UTC-Z nur auf der **Lese-Seite** normalisiert (`_validClause(as_of)` via `_normIso`). Die **Datenseite** (`storeTriple`/`mergeIncoming`/`clone` etc.) legte `asserted_at`/`occurred_at` verbatim ab — Offset-Notationen wie `+02:00` blieben drin, und der lexikografische SQLite-Vergleich verschob die Sichtbarkeit eines mit `+02:00` gespeicherten Fakts um die Offset-Differenz in die Zukunft. Auditor hatte das in Slice #5b als 🟡-C aufgedeckt und als „eigener Folge-Slice" deferred — heute eingelöst.

## CDP5-geprüfte Architektur-Entscheidung
**`asserted_at` ist Teil des `signingString` → keine In-Place-Mutation möglich**, sonst würden Origin-Signaturen invalidieren (wir können nicht resignieren, Origin-Privatkey fehlt). Lösung: **abgeleitete Spalten** `asserted_at_norm` + `occurred_at_norm` (additiv, idempotent gefüllt). `_edgeToWire` ignoriert `_norm` → Wire/Signatur unangetastet.

`valid_from`/`valid_to` sind dagegen LOKAL (nicht im Wire) → In-Place-Normalisierung zulässig (Defense-in-Depth in der Migration ergänzt).

## Entscheidungschronik
- **E1** — Konzept-First: UC-5d ins KONZEPT.md mit Design-Constraint, AC-5d.1–8, Fehlerfällen. Lint 10/10.
- **E2** — Implementation: Schema-Erweiterung, Migration-Helper, alle Schreib-Pfade (storeTriple/mergeIncoming/clone/infer/recordEpisode) schreiben `_norm` mit; Lese-Pfade (`_validClause`/`_withinWeight`/recallEpisodes since-until) auf COALESCE umgestellt. 155/155 Tests.
- **E3** — Live-DB-Kopie-Verifikation: 12193 Edges, Migration in 74 ms durchgelaufen, 100 % _norm-filled, zweiter Lauf 3 ms no-op. Aktuelle Live-DB hat KEINE Offset-Bestände (Defekt war potentiell, kein historischer Schaden).
- **E4** — Adversarial-Audit Runde 1: **NEIN**, drei übersehene 🔴-Pfade:
  - 🔴-1 `episodicGc` `DELETE FROM episodes WHERE occurred_at < ?` → echter Datenverlust bei Offset-Episoden.
  - 🔴-2 `recallEpisodes` `ORDER BY occurred_at DESC` → falsche Limit-Reihenfolge.
  - 🔴-3 `episodesForTriple` `ORDER BY e.occurred_at DESC` → Provenienz-Sortierung.
- **E5** — Fix: drei einzeilige `COALESCE(_norm, original)`-Anpassungen + drei Regressionstests (158/158 grün).
- **E6** — Adversarial-Audit Runde 2: **JA-mit-Einschränkung**. Drei 🔴 sauber gefixt + empirisch verifiziert. Neuer 🟡: Migration normalisierte `valid_from`/`valid_to` nicht (asymmetrisch zu `_norm`-Spalten). Im aktuellen Engine-Pfad nicht erreichbar, aber Defense-in-Depth-Lücke. **Im selben Slice mitgefixt** (4 Zeilen, gleiche UTC-Z-Klasse), AC dazu. 159/159.
- **E7** — Re-Verifikation Live-DB-Kopie: 0 residuale Offset-Werte in valid_from/valid_to (sauber).
- **E8** — Self-Merge PR #11.

## Prozess-Lehre (Kern)
**Der erste Adversarial-Audit findet selten ALLES.** Slice #5b lieferte einen Auditor mit 3 Findings — Slice #5d lieferte zwei Auditor-Runden mit ingesamt vier Findings (3×🔴 + 1×🟡), die ich beim Erstausbau übersehen hatte. Insbesondere die `ORDER BY`/`DELETE`-Pfade wurden **erst beim systematischen Pfad-Sweep** entdeckt — ich hatte WHERE-Filter angepasst, ohne die SORT-/DELETE-Pfade derselben Spalte mitzuziehen. **Lehre:** bei einer Spalten-Semantik-Änderung (raw → normalisiert) MÜSSEN ALLE Vorkommen der Spalte ge-grep-t und einzeln entschieden werden — nicht nur die offensichtlichen Lese-Klauseln.

**Re-Audit nach Fix ist nicht optional, sondern Pflicht.** Der erste Fix-Vorschlag wäre vielleicht „die drei Stellen fixen" — aber der Re-Audit fand die vierte (Migrations-Asymmetrie). Das ist genau das Anti-Sycophancy-Muster, das wir verlangen: ein bestätigender zweiter Reviewer würde „grün" sagen, weil drei Findings sauber gefixt sind; ein gegnerischer findet die übrig gebliebene Asymmetrie. [[feedback-green-tests-bypass-security]]

**Live-DB-Kopie-Verifikation hat Pflichtgewicht.** Migration auf 12k+ echten Edges verläuft anders als auf In-Memory-Fixtures (Idempotenz, Performance, residuale Werte). Verifikation an der Kopie ist günstig (74 ms), aber liefert harte Belege.

## Inhaltliche Lehre
**Wire-Vertrag verbietet In-Place-Mutation signierter Felder.** `asserted_at` ist Teil des `signingString` — eine nachträgliche UTC-Z-Normalisierung würde die Origin-Signatur unverifizierbar machen. Abgeleitete Spalten sind das saubere Pattern: Original für Signatur intakt, `_norm` für lokale Lese-Linsen. `_edgeToWire` muss explizit `_norm`-Spalten ausschließen — wäre sonst ein Wire-Leak.

**`valid_from`/`valid_to` sind anders zu behandeln.** Diese Spalten sind LOKAL (nicht im Wire/Signatur), also In-Place-Normalisierung in der Migration zulässig und einfacher als eine zweite `_norm`-Spalte.

**Lexikografischer SQL-Vergleich braucht UTC-Z-Konsistenz an ALLEN Vergleichs-Stellen.** Eine WHERE-Klausel mit `_norm` und ein ORDER BY ohne sind eine Inkonsistenz, die zur Drift-an-der-Schwelle führt (siehe 🔴-2/-3).

## Offen
- 🟡 Performance-Index auf `_norm`-Spalten (Auditor-Empfehlung, kein Korrektheits-Bug). Bei aktuellen DB-Größen unkritisch — Backlog.
- Re-Audit-Pattern als Skill in den Workflow nehmen (immer zweite Runde nach Fix).
