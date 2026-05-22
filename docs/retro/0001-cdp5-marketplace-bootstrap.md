# Retro-ADR 0001 — Aufbau des claude-skills-Marketplace

**Status:** abgeschlossen · **Datum:** 2026-05-22 · **Modus:** CDP5 §29 Modus A (Greenfield) + §32 Orchestrierung · **Review:** unabhängiger Pass (frischer Kontext) + 2 Test-Runden.

## Kontext

Im Anschluss an CDP5-Go-Live (v5 aktiv, §33 Sicherheit) sollten die deterministischen/trivialen Agents zu programmierten Skills werden und als **projektunabhängiger** Claude-Code-Marketplace (`SmR492/claude-skills`, public) für Kollegen verfügbar sein — kein Projekt-Code/-Struktur enthalten. Ergebnis: Plugin `cdp5-gates` (9 read-only Node-Skills) + `cdp5-agents` (5 Methodik-Agents), 22/22 Tests grün, live gepusht.

## Entscheidungschronik

- **E1 — §32.9-Gate als Auswahlfilter.** Determinismus-Gate über alle 34 Agents angewandt: nur **entscheidbare** Detektoren wurden T1-Skills (Node), echtes Judgment blieb Agent. Befund: der Großteil der bestehenden Agents ist **projekt-/framework-gekoppelt** (impl-tenant, infra-portainer, review-access …) und damit **nicht** shareable. Shareable sind nur parametrisierte Detektoren + generische CDP5-Methodik-Agents. → „projektunabhängig" ist ein harter, stark reduzierender Filter.
- **E2 — Catalog-First statt Mass-Generieren (§1.9).** Vor dem Bauen mehrfach Scope/Platzierung/Runtime/GitHub geklärt (AskUserQuestion); der Nutzer hat den Umfang zweimal nachjustiert („erst Katalog finalisieren", „aus den PDFs ableiten"). Das verhinderte verworfene Artefakte.
- **E3 — Geteilte Scan-Lib + Pilot-Pattern.** Die `roadmap-drift`-Pilot-Logik (Datei-Walk + `classify`/`locate`) wurde als `lib/scan.mjs` extrahiert und von mehreren Skills wiederverwendet — dependency-frei (nur `node:`).
- **E4 — Review fand echten 🔴.** Der unabhängige Review-Pass deckte einen Bug auf, den die grünen Tests **nicht** sahen: `parsePhp` wies *jeder* Klasse die Properties der *ganzen* Datei zu. Verifiziert (§10.6), per-Klassen-Slice gefixt, Regressionstest ergänzt. Wieder bestätigt: frischer-Kontext-Review schlägt Self-Review + grüne Tests — auch bei „einfachem" Code ([[feedback_auditor_over_self_review]], [[feedback_verify_agent]]).
- **E5 — Deterministischer Constraint-Check als Gate.** Die Anforderung „kein Projekt-Code" wurde per `grep` gegen verbotene Tokens (Projektnamen/Pfade) geprüft — und fand Reste (projekt-nahe Fixtures `Vehicle`/`garage`, ein Doc-Beispiel), die der LLM-Review unterbewertete. Eine **negative** Anforderung („X darf NICHT vorkommen") ist entscheidbar → Skript-Gate, nicht LLM (§32.9, §32.8(1)).
- **E6 — Subagent-Limit formt das Bootstrap-Design.** „Jeder Agent lädt vorab Skill X" ließ sich nicht als Skill-Invocation bauen (Subagents bekommen keine Skills). Lösung: `cdp5-reference` als Doktrin + Query-Tool (`cdp5.mjs --section/--keyword`), das der Agent per **Bash/Read** nutzt; der Orchestrator reicht den Pfad im Brief (§32.8(2)). Just-in-time-Retrieval statt 2000-Zeilen-Doktrin pro Prompt ([[feedback_deterministic_skills_over_text]], CDP5 §28.6).

## Was gut lief / besser

- **Gut:** Catalog-First + Confirm; geteilte Lib; Review→Improve→Review fand + fixte den 🔴; der grep-Constraint-Check als billiges, verlässliches „kein-Projekt-Code"-Gate; cdp5-reference dogfoodt §28.6.
- **Besser:** Den grep-Leak-Check **vor** dem Code-Review fahren (deterministisch zuerst, dann Judgment) — hätte die Fixture-Funde früher erledigt. `node --test <dir>` verhält sich anders als explizite Dateien (Gotcha) → immer Dateien übergeben.

## Kern-Lehre

Eine **negative/entscheidbare** Anforderung (hier: „enthält keinen Projekt-Code") gehört in ein deterministisches Gate (grep/Skript), nicht in einen LLM-Review — das ist §32.9 angewandt auf den *Bau* der Skills selbst. Und: der unabhängige Review bleibt auch bei kleinem, „offensichtlich korrektem" Code wertvoll — der 🔴 `parsePhp`-Bug war test-grün.

## Memory-Loop (§32.6)

Zitierte Slugs verifiziert vorhanden: [[feedback_auditor_over_self_review]], [[feedback_verify_agent]], [[feedback_deterministic_skills_over_text]], [[feedback_clarify_before_assuming_scope]]. Neu angelegt + MEMORY.md-Pointer: [[project_claude_skills_marketplace]].
