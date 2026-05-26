# Konzept — Input-Robustheits-Vertrag für T1-Skills

**Version:** 1.1
**Stand:** 2026-05-26
**Scope:** Ein einheitlicher Vertrag, nach dem **jeder** `cdp5-gates`-T1-Skill fehlerhafte Eingaben (fehlendes/falsches Argument, Pfad-Typ-Fehler, malformed strukturierter Inhalt) **deterministisch mit Exit-Code 2 + lesbarer Meldung** quittiert — statt mit einer uncaught Exception und Stacktrace abzubrechen. **Nicht enthalten:** Änderung der fachlichen Skill-Logik, neue Detektoren, Behandlung *valider* Eingaben (bleibt unverändert), Schreib-/Mutations-Operationen (Skills bleiben read-only), Rückgabe-Form-Vereinheitlichung von `scanRepo` (eigener Folge-Punkt).

## Determinismus

Alle UCs sind rein deterministisch (Node-Programm, kein Modell-Aufruf) → Toleranz-Schwelle / Validierungsstrategie / Fallback **n/a**. Gleicher (fehlerhafter) Input → gleicher Exit-Code + gleiche Meldung. **Vendor-Risiko n/a:** reines Node.js (nur `node:`-Builtins), kein externer Dienst, kein Modell. Nachweis je UC: `node:test`-Test auf Exit-Code/Rückgabe.

## 1. Rollen

| Rolle | Beschreibung |
|---|---|
| `Orchestrator` | ruft Skills mit Argumenten auf; verlässt sich auf die Exit-Codes (0/1/2) als CI-Gate-Signal |
| `T1-Skill` | deterministisches read-only Node-Programm; **muss** den Input-Vertrag erfüllen |
| `Operator` | Mensch; liest die Fehlermeldung und korrigiert den Aufruf |

## 2. Use-Case-Übersicht (§2.2)

UC-01 Fehlendes/leeres Pflicht-Argument · UC-02 Pfad-Argument falschen Typs (Datei ↔ Verzeichnis) · UC-03 Malformed strukturierter Input · UC-04 Geteilter Guard + Vertrags-Abdeckung.

## 3. Use Cases

### UC-01: Fehlendes oder leeres Pflicht-Argument
**Akteur:** `Operator`/`Orchestrator` · **Schritt-Typ:** Deterministisch

**Verhalten**
1. Skill wird ohne ein Pflicht-Argument aufgerufen (z. B. `secrets-scan` ohne `--repo`).
2. Der Skill prüft die Pflicht-Argumente **vor** jeder Datei-/Verarbeitungs-Operation.
3. Bei Fehlen: eine `Usage:`-Zeile nach **stderr**, danach `process.exit(2)`.

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Mehrere Pflicht-Args fehlen | eine `Usage:`-Zeile (alle Args genannt), Exit 2 |
| Pflicht-Arg ohne Wert (`--repo=`) | wie fehlend behandelt → Exit 2 |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Fehlt ein Pflicht-Arg → Exit-Code genau `2` + `Usage:`-Zeile auf stderr | Integration | grün |
| AC-2 | Kein Stacktrace / kein uncaught Throw auf stdout/stderr | Integration | grün |

### UC-02: Pfad-Argument falschen Typs (Datei ↔ Verzeichnis)
**Akteur:** `Operator`/`Orchestrator` · **Schritt-Typ:** Deterministisch

**Verhalten**
1. Ein Pfad-Argument wird übergeben (z. B. `retro-memory-loop-check --retro=datei.md`, erwartet ein **Verzeichnis**).
2. Der Skill prüft **vor** der Verarbeitung Existenz **und** Typ des Pfades (über `lstatSync`/`statSync`, nicht erst implizit beim `readdir`/`read`).
3. Bei Typ-Mismatch: Meldung „erwartet \<Verzeichnis|Datei\>, ist \<Datei|Verzeichnis\>: \<pfad\>", Exit 2.

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Pfad existiert nicht | Exit 2, Meldung „nicht gefunden: \<pfad\>" |
| Datei statt Verzeichnis (ENOTDIR-Klasse) | Exit 2, **kein** `scandir`-Crash |
| Verzeichnis statt Datei (EISDIR-Klasse) | Exit 2, **kein** `read`-Crash |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Datei, wo Verzeichnis erwartet → Exit `2` + Typ-Hinweis, **kein** ENOTDIR-Crash | Integration | grün |
| AC-2 | Nicht-existenter Pfad → Exit `2` mit „nicht gefunden" | Integration | grün |

### UC-03: Malformed strukturierter Input (JSON / YAML-Frontmatter)
**Akteur:** `Operator`/`Orchestrator` · **Schritt-Typ:** Deterministisch

**Verhalten**
1. Ein Skill liest eine strukturierte Eingabe (z. B. `konzept-lint --rubric=…json`, `mcp-config-lint --config=…json`, `profile-check`-Frontmatter).
2. Das Parsen liegt in `try/catch`.
3. Bei Parse-Fehler: Meldung mit Datei + Ursache (`e.message`), Exit 2. Bei fehlendem optionalem Feld: definierter Default (kein Crash).

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Leere / teil-geschriebene JSON-Datei | Exit 2 + Parse-Meldung |
| Gültiges JSON, aber Pflicht-Schlüssel fehlt | dokumentierter Default **oder** Exit 2 (je Skill definiert), kein Crash |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Malformed JSON → Exit `2` + Parse-Meldung, **kein** `SyntaxError`-Stacktrace | Integration | grün |
| AC-2 | Gültige Datei → unverändertes Verhalten (Regression, kein Score-/Report-Drift) | Integration | grün |

### UC-04: Geteilter Guard + Vertrags-Abdeckung
**Akteur:** `T1-Skill` (Implementierer) · **Schritt-Typ:** Deterministisch

**Verhalten**
1. `lib/args.mjs` (neu) stellt **pure** Validatoren bereit: `pathTypeError(pfad, 'file'|'dir')` → `null | Meldung`; `usage(msg)` (schreibt stderr, exit 2).
2. Jeder `main()` ruft die Validatoren und mappt einen Fehler auf `console.error(msg); process.exit(2)`.
3. Jeder Skill mit Pfad-Argument bekommt einen Vertrags-Test (Bad-Input → Exit 2 bzw. `pathTypeError` ≠ null).

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Guard-Helfer wirft selbst eine Exception | Bug → Unit-Test fängt es; `pathTypeError` darf nie werfen |
| Skill umgeht den Guard (Alt-Code) | Vertrags-Test des Skills schlägt rot an |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | `pathTypeError` ist pure (gibt `Meldung\|null`, ruft **nie** `process.exit`, wirft nie) | Unit | grün |
| AC-2 | Jeder Skill mit Pfad-Argument hat einen „Bad-Input → Exit 2"-Test | CI | grün |

## 4. Entitäten / Artefakte

| Artefakt | Typ | Ort |
|---|---|---|
| `lib/args.mjs` | **neu** — pure Input-Guards (`pathTypeError`, `usage`) | `plugins/cdp5-gates/lib/` |
| `lib/args.test.mjs` | **neu** — Unit-Tests der Guards | `plugins/cdp5-gates/lib/` |
| retro-memory-loop-check | anzupassen (UC-02, ENOTDIR) | `…/skills/retro-memory-loop-check/` |
| konzept-lint | bereits teil-gehärtet (UC-03 try/catch); UC-02 für `--konzept` ergänzen | `…/skills/konzept-lint/` |
| profile-check, mcp-config-lint, konzept-mapper, roadmap-drift, test-gap, wiki-lint, secrets-scan, pii-scan, ac-to-test-scaffold, konzept-model-api, cdp5-reference | Pfad-Arg-Guards via `lib/args` (UC-01/02/03) | `…/skills/*/` |

## 5. Glossar

| Begriff | Definition |
|---|---|
| Exit-Code-Vertrag | `0` = Pass/sauber · `1` = Befund/Drift · `2` = Nutzungs-/Input-Fehler |
| Input-Vertrag | Garantie eines T1-Skills, jede fehlerhafte Eingabe als Exit 2 + Meldung zu quittieren, nie als uncaught Exception |
| Pfad-Typ-Fehler | Pfad existiert, hat aber den falschen Typ (Datei statt Verzeichnis = ENOTDIR-Klasse; umgekehrt = EISDIR) |
| pure Validator | Funktion ohne Seiteneffekt: gibt Meldung/`null` zurück, ruft kein `process.exit`, wirft nicht |

## 6. Changelog

**v1.0 (2026-05-26):** Erstkonzept. Auslöser: zwei uncaught-Exception-Befunde derselben Klasse in einer Session — `konzept-lint --rubric`-`SyntaxError` (gefixt) und `retro-memory-loop-check`-ENOTDIR bei Datei-statt-Verzeichnis. Vereinheitlicht zum Input-Robustheits-Vertrag (Exit 2 statt Crash) über alle 13 T1-Skills, mit geteiltem `lib/args.mjs` + Vertrags-Tests. Bezug: CDP5 §32.9 (T1-Determinismus inkl. Fehlerpfad), §10.7 (Nachweis je AC). `konzept-reviewer`-Score = **9,7/10** (konzept-lint-Teil 10/10).

**v1.1 (2026-05-26, umgesetzt):** Implementiert nach Score-Freigabe. Neu: `lib/args.mjs` (`pathTypeError` pure + `usage`/`guardPaths`) + `lib/args.test.mjs` (7 Unit-Tests). `guardPaths` in alle 13 Pfad-nehmenden Skills eingezogen (Datei↔Verzeichnis-Typ-Check vor Verarbeitung). UC-03-Fixierung: `mcp-config-lint` malformed Config → Exit 2 (statt 1). Symlink-Schutz in `retro-memory-loop-check`-Walk nachgezogen. AC-Status rot→grün. **59/59 Tests grün**; ursprünglicher ENOTDIR-Fall liefert jetzt „erwartet Verzeichnis, ist keine" + Exit 2.
