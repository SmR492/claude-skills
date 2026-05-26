# Konzept — cdp5-init (Hybrid-Skill: CLAUDE.md an den Marketplace anbinden)

**Version:** 1.1
**Stand:** 2026-05-26
**Scope:** Ein Skill `cdp5-init`, der die **CLAUDE.md eines Konsumenten** an den `claude-skills`-Marketplace anbindet: ein projektunabhängiger **Marker-Block** (`<!-- cdp5:start -->…<!-- cdp5:end -->`) mit Verweis auf **CDP5**, das **`cdp5-reference`-Gate** („vor jeder Aufgabe Doktrin-Ausschnitt laden"), die **Trigger-Map** (User-Aussage → Skill/Agent) und die Liste der `cdp5-gates`-Skills + `cdp5-agents`. Erneuter Lauf = **Update** (Block wird idempotent ersetzt). **Nicht enthalten:** Schreiben außerhalb des Marker-Blocks, projekt-spezifische Inhalte im Block, Änderung von Skills/Agents selbst, `settings.json`/Hook-Setup (das macht `tooling/install.sh` im jeweiligen Repo).

## Determinismus-Profil (Hybrid, §32.9)

| Teil | Art | Nachweis |
|---|---|---|
| Merge/Diff-Kern (`cdp5-init.mjs`: Block zwischen Marker einfügen/ersetzen, Diff berechnen) | **deterministisch (T1)** | `node:test` (Idempotenz, Marker-Erhalt) |
| Bestätigungs-Schleife + KI-Anpassung bei Ablehnung | **interaktiv/probabilistisch** | Diff-Gegenprobe + Nutzer-Bestätigung (s. Probabilistik-Statement) |

## Probabilistik-Statement (§2.6, nur UC-03)

| UC | Toleranz-Schwelle | Validierungsstrategie | Fallback | EU-AI-Act-Klasse |
|---|---|---|---|---|
| UC-01/02/04 (Merge/Diff/Write) | n/a (deterministisch) | Output = Beleg (Diff/Exit-Code) | — | minimal |
| UC-03 KI-Block-Anpassung | ~85 % (Vorschlag) | **Kontext** = aktuelle CLAUDE.md + Anpassungswunsch; **Ausgabe** = angepasster Block; **Validierung** = erneuter deterministischer Diff + Nutzer-Bestätigung; **Fallback** = Operator editiert manuell; **Cutoff** n/a (kein externer Wissensabruf) | Operator-Handedit | minimal |

**Vendor-Risiko:** Merge-Kern reines Node.js (vendor-unabhängig); der KI-Anpassungs-Zweig nutzt Claude Code (Methode auf anderen Agent-Runner übertragbar).

## 1. Rollen

| Rolle | Beschreibung |
|---|---|
| `Operator` | Mensch; bestätigt den Diff (ja/nein), formuliert Anpassungswünsche, trägt Verantwortung fürs Schreiben |
| `Orchestrator` | Haupt-Agent: fährt `cdp5-init.mjs`, zeigt Diff, stellt die ja/nein-Frage, übernimmt bei „nein" die KI-Anpassung |
| `cdp5-init.mjs` | deterministischer T1-Kern (Diff/Merge/Write), read-only außer mit `--write` |

## 2. Use-Case-Übersicht (§2.2)

UC-01 Diff-Vorschau (read-only) · UC-02 Bestätigen + Übernehmen · UC-03 Ablehnen → KI-Anpassung · UC-04 Idempotenz-/Update-Vertrag.

## 3. Use Cases

### UC-01: Diff-Vorschau (read-only, Default)
**Akteur:** `Orchestrator`/`Operator` · **Schritt-Typ:** Deterministisch

**Verhalten**
1. `cdp5-init.mjs --target=<CLAUDE.md>` (ohne `--write`) liest die Ziel-Datei (existiert sie nicht → leerer Ausgangstext).
2. Berechnet den Soll-Zustand: Marker-Block vorhanden → ersetzen; nicht vorhanden → am Ende anhängen.
3. Gibt einen **unified Diff** (Ist → Soll) auf stdout aus, **schreibt nichts**. Exit 0.

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| `--target` fehlt | Exit 2 + Usage |
| `--target` ist Verzeichnis statt Datei | Exit 2 (`guardPaths`, Input-Robustheits-Vertrag) |
| Block-Quelle (`cdp5-block.md`) nicht lesbar | Exit 2 + Hinweis |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Ohne `--write` wird die Ziel-Datei **nicht** verändert (read-only) | Integration | grün |
| AC-2 | Diff zeigt Anhängen (kein Marker) bzw. Ersetzen (Marker vorhanden) korrekt | Unit | grün |

### UC-02: Bestätigen + Übernehmen
**Akteur:** `Operator` (Bestätigung) · **Schritt-Typ:** Interaktiv → Deterministisch

**Verhalten**
1. Orchestrator zeigt den UC-01-Diff und stellt **eine** ja/nein-Frage.
2. Bei **ja**: `cdp5-init.mjs --target=<CLAUDE.md> --write` → idempotenter Marker-Merge, Datei geschrieben. Exit 0.
3. Bestätigung der Übernahme (Pfad + ersetzt/angehängt).

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Ziel-Datei nicht schreibbar | Exit 2 + Meldung, kein Teil-Write |
| Schreiben bricht ab | Datei unverändert (atomar: erst vollständig zusammenbauen, dann schreiben) |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | `--write` schreibt den Block nur zwischen den Markern; Inhalt außerhalb bleibt **byte-identisch** | Integration | grün |
| AC-2 | Schreiben erfolgt nur nach `--write` (also nach Operator-„ja") | Integration | grün |

### UC-03: Ablehnen → KI-gestützte Anpassung
**Akteur:** `Operator` + `Orchestrator` · **Schritt-Typ:** Interaktiv/probabilistisch

**Verhalten**
1. Bei **nein** fragt der Orchestrator, **was** angepasst werden soll.
2. Der Orchestrator passt den Block-Inhalt KI-gestützt an (z. B. nur Trigger-Map, andere Reihenfolge) und übergibt ihn als `--block=<angepasst.md>`.
3. Erneuter UC-01-Diff (deterministische Gegenprobe) → zurück zu UC-02 (ja/nein). Schleife bis „ja" oder Abbruch.

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Wiederholte Ablehnung / kein Konsens | Abbruch; Operator editiert die CLAUDE.md manuell (Fallback) |
| KI-Anpassung verletzt Marker-Format | deterministischer Merge weist es ab (Marker müssen erhalten bleiben) |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | `--block=<datei>` ersetzt den Default-Block-Inhalt im Merge (KI-Ausgabe einspeisbar) | Unit | grün |
| AC-2 | Nach Anpassung wird erneut ein Diff gezeigt + bestätigt (kein Schreiben ohne erneutes „ja") | Integration | grün |

### UC-04: Idempotenz-/Update-Vertrag
**Akteur:** `cdp5-init.mjs` · **Schritt-Typ:** Deterministisch

**Verhalten**
1. Zweiter `--write`-Lauf mit gleichem Block → Datei ist **unverändert** (Block ersetzt sich selbst, kein Duplikat).
2. Bei Block-Aktualisierung (neue Skills/Agents) → nur der Marker-Block ändert sich, der Rest der CLAUDE.md bleibt unangetastet.

**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Mehrere Marker-Paare in der Datei | erstes Paar wird ersetzt, weitere gemeldet (Warnung), kein stilles Mehrfach-Schreiben |
| Nur Start- oder nur End-Marker vorhanden (kaputt) | Exit 2 + Hinweis „Marker-Paar inkonsistent", kein Write |

**Akzeptanzkriterien**
| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Zweiter identischer `--write`-Lauf → 0 Byte Diff (idempotent) | Integration | grün |
| AC-2 | Inkonsistentes Marker-Paar → Exit 2, kein Write | Integration | grün |

## 4. Entitäten / Artefakte

| Artefakt | Typ | Ort |
|---|---|---|
| `cdp5-init.mjs` | T1-Kern: `mergeBlock(md, block)`, `computeDiff(a, b)`, CLI `--target/--diff/--write/--block` | `…/skills/cdp5-init/` |
| `cdp5-init.test.mjs` | Tests (Idempotenz, Marker-Erhalt, read-only-Default, inkonsistente Marker) | `…/skills/cdp5-init/` |
| `SKILL.md` | interaktive Orchestrierung (Diff → ja/nein → KI-Anpassung-Schleife) | `…/skills/cdp5-init/` |
| `cdp5-block.md` | **Source-of-Truth** des Marker-Blocks (CDP5-Verweis, cdp5-reference-Gate, Trigger-Map, Skills-/Agents-Liste) | `…/skills/cdp5-init/` |
| `lib/args.mjs` (`guardPaths`) | wiederverwendet für `--target`/`--block`-Pfad-Guards | `…/lib/` |

## 5. Glossar

| Begriff | Definition |
|---|---|
| Marker-Block | Bereich zwischen `<!-- cdp5:start -->` und `<!-- cdp5:end -->`; einzige Stelle, die `cdp5-init` schreibt |
| idempotenter Merge | erneuter Lauf mit gleichem Block ändert die Datei nicht (Block ersetzt sich selbst) |
| Hybrid-Skill | deterministischer Kern (T1) + interaktive/probabilistische Orchestrierung (SKILL.md), §32.9 |
| cdp5-reference-Gate | Direktive im Block: „vor jeder Aufgabe Doktrin-Ausschnitt via `cdp5-reference` laden" (§28.6 JIT) |

## 6. Changelog

**v1.0 (2026-05-26):** Erstkonzept. Schließt die Lücke „Marketplace-Neuinstallation verdrahtet keine CLAUDE.md": ein Hybrid-Skill `cdp5-init` merged einen projektunabhängigen Marker-Block (CDP5-Verweis + cdp5-reference-Gate + Trigger-Map + Skills/Agents) idempotent in die Ziel-CLAUDE.md. Flow: read-only Diff → Operator-Bestätigung (ja/nein) → bei „ja" `--write`, bei „nein" KI-Anpassung + erneuter Diff. Erster schreibender `cdp5-gates`-Skill — daher Schreiben nur zwischen Markern, nur mit `--write`, nur nach Bestätigung. Bezug: CDP5 §32.9 (Hybrid), §1.6/§23 (Mensch-Verantwortung beim Schreiben), Input-Robustheits-Vertrag (`guardPaths`). `konzept-reviewer`-Score = **9,5/10** (konzept-lint-Teil 10/10).

**v1.1 (2026-05-26, umgesetzt):** Implementiert nach Score-Freigabe (14. cdp5-gates-Skill). `cdp5-init.mjs` (deterministischer Kern: `mergeBlock`/`computeDiff`/`findBlock` + CLI `--target`/`--diff`/`--write`/`--block`) + `cdp5-block.md` (Source-of-Truth-Block) + interaktive `SKILL.md`. Reviewer-Polish Dim 6 eingearbeitet: deterministische **Block-Invariante** (`blockInvariantError` — CDP5-Verweis + cdp5-reference-Gate müssen erhalten bleiben, sonst Reject Exit 2; deckt den KI-Anpassungs-Zweig) + Test, dass der Default-Block das Gate enthält. 11 Tests; Dogfood: Diff→write→idempotent, Bestand erhalten. AC rot→grün. Marketplace/README/§7-Count (13→14) nachgezogen.
