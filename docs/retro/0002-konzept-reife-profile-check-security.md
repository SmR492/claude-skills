# Retro-ADR 0002 — Konzept-Reifung (→10/10), profile-check & Security-Pass

**Status:** abgeschlossen · **Datum:** 2026-05-26 · **Modus:** CDP5 §29 Modus A/B + §32 Orchestrierung · **Review:** 3× `konzept-reviewer`-Re-Score (frischer Kontext) + `review-code`-Security-Pass + §10.6-Verifikation.

## Kontext

Fortsetzung von [[project_claude_skills_marketplace]] (Retro-ADR 0001). Aufgabenbogen dieser Session: (1) Produkt-Konzept `docs/konzept.md` von v1.2 auf Implementierungsreife treiben (Goal ≥ 9,0), (2) drei neue T1-Skills (`konzept-lint`, `ac-to-test-scaffold`, `pii-scan`) + `profile-check`, (3) `konzept-reviewer`-Brief für reproduzierbares Scoring härten, (4) Security-Check mit gängigen Methoden + Retro. Endstand: Konzept **10,0/10**, `cdp5-gates` **13 T1-Skills + lib**, **51 Tests grün**, 1 🔴 + 2 🟡 Security-Findings gefixt.

## Entscheidungschronik

- **E1 — Dogfooding war die dominante Wertquelle.** Jeder `konzept-reviewer`-Re-Score deckte einen **echten Drift in unseren eigenen Artefakten** auf, den grüne Tests nicht sahen: (a) `konzept-lint`/`ac-to-test-scaffold` fanden **0 UCs** im Flaggschiff-Konzept, weil der Parser nur `## UC-` (H2) statt auch `### UC-` (H3 unter `## N. Use Cases`) erkannte; (b) `hatGlossar` matchte `## 9. Glossar` (nummeriert) nicht; (c) Changelog hatte v1.2 doppelt + zerwürfelte Reihenfolge; (d) stale „9 Skills"-Referenz in UC-03 (§7 zählt 13). Die Gates funktionieren gegen sich selbst — die billigste QA war, das eigene Werkzeug aufs eigene Repo zu richten ([[feedback_verify_agent]], [[feedback_auditor_over_self_review]]).
- **E2 — Reproduzierbarer Score braucht eine verankerte Rubrik.** Der Reviewer gab anfangs einen Bauch-Gesamtscore. Lösung: Reife-Rubrik als **§10.5-Policy-Artefakt** (`reife-rubrik.policy.md` + `.json`) + Reviewer-Brief auf gewichtete 7 Dimensionen umgestellt, je markiert **[det]** (von `konzept-lint` vorprüfbar → verifizieren, nicht neu raten) vs. **[jdg]** + Pflicht-Dimensions-Tabelle + ±0,2-Reproduzierbarkeit. Score 9,0 → 9,7 → 10,0 wurde so nachvollziehbar statt geraten.
- **E3 — „Default einmal setzen, dann nur Checks" (profile-check).** Wiederkehrende Projekt-Vorgaben (EU-AI-Act-Klasse, security_level, Runtime, Test-Framework) gehören **einmal** in ein `project-profile.md` (YAML-Frontmatter), das `profile-check` deterministisch gegen Konzept + Repo verifiziert — statt sie pro Schritt neu zu erfragen. Das löste den offen-stehenden EU-AI-Act-Punkt **strukturell**. Die regulatorische Klassen-*Festlegung* selbst blieb ein Architekt-Gate (§23, AskUserQuestion bestätigt = minimal), nicht KI-Annahme ([[feedback_clarify_before_assuming_scope]]).
- **E4 — Security: deterministische Gates zuerst, dann OWASP-Judgment.** T1-Gates (`secrets-scan`/`pii-scan`) auf das Repo gefahren → nur absichtliche `*.test.mjs`-Fixtures, kein echtes Leck. Dann `review-code` (OWASP-orientiert: ReDoS, Prototype-Pollution, Path/Symlink, Injection, Redaction). Befund **🔴 ReDoS**: greedy E-Mail-Regex × 1-MB-Einzelzeile → O(n²), ~100 s Gate-DoS (empirisch gemessen). Plus 🟡 `JSON.parse` ohne try/catch (Crash + falscher exit 0) und 🟡 `statSync` folgt Symlinks (Out-of-tree-Read/Loop). Fix: gebundene Quantoren + Zeilen-Cap (100 s → **1 ms**); try/catch → exit 2; `lstatSync` + Symlink-Skip im geteilten `lib/scan.mjs` (deckt 6 Skills). Verifiziert (§10.6), bevor umgesetzt.
- **E5 — Test-Schreiben als Design-Feedback.** Beim Regressionstest für den Symlink-Fix fiel auf: `secrets-scan.scanRepo` liefert `{findings,scanned,hasSecrets}`, `pii-scan.scanRepo` ein **Array** — zwei Schwester-Skills mit inkonsistenter Rückgabe-Form. Der Test entlarvte die Inkonsistenz (Setup-Assertion schlug fehl). Die drei Findings hatten **keine** bestehende Test-Abdeckung — grüne Suite ≠ abgedeckt.

## Was gut lief / besser

- **Gut:** Re-Score-Schleife als Drift-Detektor aufs eigene Konzept; Rubrik-als-Policy machte 10/10 belegbar; deterministische Security-Gates vor dem Judgment-Review; ReDoS empirisch gemessen statt nur gelesen; Findings vor Umsetzung verifiziert.
- **Besser:** Parser-Annahme „UCs sind H2" hätte ein H3-Fixture im allerersten `konzept-lint`-Test früh gefangen — Test-Fixtures sollten reale Konzept-Strukturen spiegeln, nicht Minimalfälle. Rückgabe-Form der Scanner (`scanRepo`) sollte über die Skills vereinheitlicht werden (offener Folge-Punkt, nicht-blockierend).

## Kern-Lehre

Zwei Muster bestätigt: (1) **Dogfooding schlägt Tests** — das eigene Detektor-Werkzeug aufs eigene Repo/Konzept zu richten fand in jeder Runde echte Drifts, die test-grün waren. (2) **Security-Werkzeuge sind selbst Angriffsfläche** — ein Scanner, der untrusted Input mit greedy Regex matcht, ist ein ReDoS-Kandidat; gebundene Quantoren + Zeilen-Cap entschärfen die ganze Klasse. Reihenfolge bleibt: entscheidbare/deterministische Gates zuerst, Judgment danach ([[feedback_stale_data_first]], [[feedback_deterministic_skills_over_text]]).

## Memory-Loop (§32.6)

Zitierte Slugs verifiziert vorhanden (MEMORY.md-Pointer existieren): [[feedback_verify_agent]], [[feedback_auditor_over_self_review]], [[feedback_clarify_before_assuming_scope]], [[feedback_stale_data_first]], [[feedback_deterministic_skills_over_text]], [[project_claude_skills_marketplace]]. [[project_claude_skills_marketplace]] in dieser Session aktualisiert (13 Skills, Konzept v1.5 = 10/10). Kein neuer Slug nötig — die Lehren fallen unter bestehende Feedback-Memories.
