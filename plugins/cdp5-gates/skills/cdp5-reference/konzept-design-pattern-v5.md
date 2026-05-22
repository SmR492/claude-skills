# Konzept Design Implementation Testing Review Pattern

**Kürzel:** CDP5 (Concept Design Pattern, Generation 5) — aktive Doktrin ist **ausschließlich diese Datei**. Vorgänger **CDP4** (v4.7, `konzept-design-pattern-v4.md`) ist **frozen + nicht-aktiv**, gehalten als Fallback-Referenz (Rückfall bei struktureller v5-Grundstruktur-Drift). Das Kürzel KDP bezeichnet v3.1 (frozen, in §1–§26 inlined).

**Version:** 5.0
**Stand:** Mai 2026
**Charakter dieser Version:** v5 ist eine **Restrukturierung** von v4.7 — gleiche Doktrin, neu geordnet für **kontextarmes Einlesen**. Inhalt wurde verschoben, nicht gelöscht (Ausnahme: zwei reine Vorwärtsverweis-Stubs; drei Themen-Dubletten zusammengeführt). Autoren-Zitate sind in direkte Inline-Regeln überführt (Portabilität: jede Regel steht für sich, keine externe Lektüre nötig). Neu: Teil 0 (Mission + Arbeitsschleife), die Anti-Drift-/Gedächtnis-Mechanik nach vorn gezogen, ein dedizierter Sicherheits-Teil (Teil 3, §33), LLM-Spezifika in einen überspringbaren Teil 5 gebündelt, Referenz-Material (Prompt-Pattern, Golden-Samples, Cases) in den Anhang.

**Stabile Anker:** Die `§`-Nummern sind unverändert und bleiben die zitierfähigen Anker (alle internen `(§X.Y)`-Verweise gelten weiter). Die **Teil**-Gliederung ist die *Lese*-Reihenfolge — darum erscheint z. B. §29 (Modi) vor §10 (Review): der Arbeitsweg steht vor dem Konzept-Handwerk.

**Zweck:** Ein wiederverwendbares Muster, das (a) eine **Wissensdoktrin samt Patterns einrichtet** und (b) der KI einen **Arbeitsweg vorgibt, auf dem ein Auftrag ohne Drift und ohne Gedächtnisverlust bearbeitet werden kann** — vom Konzept über Design, Implementation, Testing bis Review, für Greenfield wie Brownfield und PoC-Integration neuer KI-Capabilities.

---

## 0. Mission, Lese-Pfad & Arbeitsschleife

### 0.1 Wofür CDP5 da ist

CDP5 hat genau zwei Aufgaben:

1. **Wissensdoktrin + Patterns einrichten** — wie ein Konzept aussieht, wie Implementation/Review läuft, welche bewährten Patterns gelten und welche Anti-Patterns verboten sind. Diese Doktrin ist verbindlich, nicht optional.
2. **Der KI einen drift-/gedächtnisverlust-freien Arbeitsweg vorgeben.** Die zwei tödlichen Gegner jeder KI-gestützten Arbeit sind **Drift** (die KI weicht unbemerkt von Vokabular/Architektur/Entscheidungen ab) und **Gedächtnisverlust** (Kontext läuft voll oder geht zwischen Sessions verloren; das Modell halluziniert frisch ohne Selbst-Erkenntnis). Teil 2 ist die Mechanik, die beides verhindert: Single-Source-Pointer statt Paste, durable Artefakte (CONTEXT.md/ADR/Handoff) als externes Gedächtnis, Determinismus-Gates, Verifikation gegen die Quelle, isolierte Worker mit frischem Kontext, Retro-ADR + Memory-Loop.

### 0.2 Aufbau (Lese-Pfad)

| Teil | Inhalt | Wann lesen |
|---|---|---|
| **Teil 0** (§0) | Mission, Lese-Pfad, Arbeitsschleife | immer zuerst |
| **Teil 1** (§1) | Grundprinzipien — die immer geltenden Regeln | immer |
| **Teil 2** (§29, §32, §10.6/§10.7, §19, §28, §27) | **Der Arbeitsweg** — Modi, Orchestrierung, Drift-Vermeidung, Skill-Gate, Verifikation, durable Artefakte, Implementation-Werkzeuge, Retro/Memory | bei jeder Arbeit am Code |
| **Teil 3** (§33) | **Sicherheit** — Agent-/Tool-Safety (Lethal Trifecta, MCP-Härtung) + AppSec (Threat-Modeling, Security-Gates, LLM-Bedrohungsklassen) | bei Agent-/Tool-/Security-Anteil |
| **Teil 4** (§2–§7, §10.1–§10.5, §11, §14, §17, §23) | **Konzept-Doktrin (Authoring)** — Pflicht-Struktur, UC-Aufbau, Review, KI-Grenzen, Glossar, Mensch-Verantwortung | beim Konzept-Schreiben/-Review |
| **Teil 5** (§13, §15, §16, §18, §20–§22) | **LLM-/Agenten-Erweiterungen** — nur relevant, wenn ein UC ein LLM aufruft | **überspringbar** bei deterministischen Tasks |
| **Teil 6** (§24, §25) | **Erkenntnisse + Anti-Pattern-Katalog** | als Prüf-Raster im Review |
| **Anhang A–C + §26** (§9, §31, §30, Changelog) | Prompt-Pattern, Golden-Samples, Referenz-Cases, Changelog | als Nachschlage-Referenz |

**Charakter:** CDP5 ist **kein Phasen-Workflow**. Der Implementation-Werkzeugkasten (§27) ist eine Bibliothek; die Anwendungs-Modi (§29) wählen situationsabhängig, welche Werkzeuge greifen; die Orchestrator-Regel (§32) regelt, *wer* sie ausführt (der Orchestrator delegiert an isolierte Worker).

### 0.3 Die Arbeitsschleife (in 30 Sekunden)

Jeder nicht-triviale Auftrag läuft so — ein Auftrag, der mehr als eine Stufe berührt, wird **orchestriert, nicht selbst ausgeführt** (§32):

1. **Modus wählen** (§29): A Greenfield · B Bug/Regression · C Review/Teardown · D UC→Code · E KI-PoC.
2. **Clarify-First** (§1.9): alles Unklare/Offene **sofort** in die Konversation mit dem Nutzer — nicht annehmen. Eine selbst-geflaggte Annahme ist ein harter Stopp.
3. **Durable Quelle lesen** (§1.8, §28): CONTEXT.md + ADRs im Touch-Bereich — das externe Gedächtnis. Bei Brownfield Pflicht.
4. **Pro Delegation: Determinismus-Gate + Pointer-Brief** (§32.8): entscheidbare Aufgabe → deterministischer Skill/Skript (§32.9), kein LLM-Worker. Sonst Worker mit Pointer auf die Single-Source briefen (kein Paste), Modell nach §32.3, parallel nur self-contained.
5. **Verifizieren vor jeder Folge-Aktion** (§10.6, §32.8 (4)): Worker-Output ist probabilistisch → gegen die Quelle prüfen, deterministisch wo möglich. Keine irreversible Aktion auf unverifizierte Behauptung.
6. **Mensch-Gates halten** (§23): destruktive/irreversible Schritte nie auto.
7. **Durable Artefakte pflegen** (§28): CONTEXT.md/ADR aktualisieren, bevor der Kontext verloren geht; bei Token-Limit Handoff-Doc.
8. **Abschluss: Retro-ADR + Memory-Loop** (§32.6): wie gearbeitet wurde festhalten; jede durable Lehre als Memory persistieren **und verifizieren, dass der zitierte Slug real existiert**.

---

## 1. Grundprinzipien

### 1.1 Sachbearbeiter-Test

Bevor ein Konzept als fertig gilt, muss es den **Sachbearbeiter-Test** bestehen: *Könnte ein geschulter Büromitarbeiter alle Prozesse dieses Systems rein anhand dieses Dokuments manuell durchführen — ohne Zugriff auf das System selbst?* Wenn die Antwort Nein ist, fehlen Details. Der Test erzwingt:
- Vollständige Feldbeschreibungen (kein „und weitere Felder")
- Explizite Fehlerfälle (nicht nur Erfolgspfade)
- Klare Zuständigkeiten je UC
- Definierte Status-Übergänge
- Konkrete Validierungsregeln

### 1.2 KI ist Konsument der Entwürfe, nicht ihr Urheber

KI erstellt keine guten Entwürfe — sie ist **Konsument** der Entwürfe (Provenienz: Leßner 2026). Je präziser das Konzept, desto besser der generierte Code. KI-Assistenten arbeiten nach statistischer Ähnlichkeit — ohne klare Strukturen entstehen plausibel klingende, aber fachlich falsche Implementierungen. **Vage Konzepte erzeugen vagen Code.**

**Folgerungen:** Ablauflogik so präzise, dass keine Interpretationsspielräume bleiben · Randbedingungen explizit · Datentypen und Einheiten immer benennen · Singular/Plural-Unterschiede explizit regeln.

### 1.3 Design before Implementation

Coding ohne Design führt innerhalb kürzester Zeit in die Unwartbarkeit (Provenienz: Toth 2026). **Vise Coding statt Vibe Coding:**

| Vibe Coding | Vise Coding |
|---|---|
| Freie Prompts, sofortiger Code | Spec-first, dann gezielter Prompt |
| KI bestimmt Struktur | Konzept bestimmt Struktur |
| Schnell, aber fragil | Etwas langsamer, aber wartbar |
| KI halluziniert Architektur | KI implementiert definierte Architektur |

### 1.4 Konzept als lebendes Artefakt

- Abweichung im Code → Konzept wird nachgezogen
- Neue Anforderung → erst Konzept aktualisieren, dann implementieren
- Technische Restriktion → Code ist „richtiger" als Konzept → Konzept anpassen, nicht den Code

Versionshistorie (Changelog) ist ab v2.0 Pflicht.

### 1.5 Probabilistik-Awareness

Jede LLM-Antwort ist probabilistisch. LLMs reproduzieren Syntax und stilistische Muster, können aber **nicht** verifizieren, ob generierter Code kompiliert, korrekt läuft oder sich kohärent ins System integriert (Provenienz: Mahringer 2026). Das Konzept muss das explizit anerkennen:
- Halluzinationen sind keine „Bugs", sondern systematisch aus der Probabilistik ableitbar.
- Ein Modell, das zu 75 % korrekt liefert, liegt zu 25 % daneben — pro UC ausweisen, ob das tolerabel ist.
- 45 % des KI-generierten Codes hat Sicherheitsmängel (Veracode 2024) — KI-Code als **„Untrusted Input"** behandeln (§15.8 + Anti-Pattern §25).

> **Probabilistik wird an drei Stellen konkretisiert, alle gehören zusammen:** das **Probabilistik-Statement im Konzept-Kopf** (§2.6, mit Toleranz-Schwelle + EU-AI-Act-Klasse pro UC), das **Schichten-/Workflow-Bewusstsein** (§18, Kontext-Pyramide + Workflow-Modelle) und die **Validierungs-Schichten** (§15.8). §1.5 ist das Prinzip, §2.6/§18/§15.8 sind seine Pflicht-Artefakte.

### 1.6 Volle menschliche Verantwortung

Der Entwickelnde trägt die **volle** Verantwortung für den Code — genauso wie früher, als Hilfskräfte zugearbeitet haben (Provenienz: Lischke 2026). Im Konzept explizit festlegen:
- Wer hat im UC die Entscheidungs-Gewalt? KI ist niemals Entscheider, sondern Vorschlag-Generator.
- Wer prüft das Endergebnis? Wer haftet?
- Stakeholder-Kommunikation ist nur zu ~7 % verbal (Mehrabian-Regel, Wolff 2026) — der Rest (Tonfall, Körpersprache) bleibt menschlich. Entscheidungs-Workshops, Domain Storytelling, Event Storming sind LLM-resistent.

### 1.7 Konkretheits-Trennung — CDP5 abstrakt, konkrete Cases im Wiki/Trace

CDP5 dokumentiert **abstrahierte Patterns**. Konkrete Projekt-Namen, Datei-Pfade, Repo-URLs, Commit-SHAs, PR-Nummern gehören **nicht** ins CDP5 selbst — sie landen im Wiki (`wiki/projects/`, `wiki/sources/`) oder in Trace-Raws (`raw/traces/`).

**Begründung:** Manipulationsvermeidung bei automatisierten KI-Reviews. Enthält das CDP5 konkrete Code-Referenzen, kann eine KI sie missinterpretieren, falsche SHAs einsetzen oder Pfade konfabulieren. Das Pattern-Doc bleibt manipulationsresistenter, wenn es abstrakt ist.

**Ausnahme:** Konkrete Code-Details landen nur dann im CDP5, wenn aus ihnen ein abstraktes, übertragbares Pattern unmittelbar ableitbar ist — dann wird das Pattern formuliert, nicht die Episode dokumentiert. **Konsequenz:** Referenz-Cases (Anhang C) sind pseudonymisiert (Case A, B …).

### 1.8 CONTEXT.md + ADRs als Pflicht-Single-Source-of-Truth bei Brownfield

Hat das Konzept Brownfield-/Erweiterungs- oder Review/Teardown-Anteil, sind CONTEXT.md + alle ADRs im Touch-Bereich die **Single Source of Truth** für Domain-Vokabular + Architektur-Annahmen. Sie sind zugleich das **externe Gedächtnis** gegen Gedächtnisverlust (§28).

**Pflicht-Reihenfolge bei jeder Brownfield-Erweiterung:**
1. CONTEXT.md lesen (oder anlegen, wenn fehlt)
2. ADRs im Touch-Bereich lesen
3. Bei Konflikt zwischen Konzept-Erweiterung und ADR: **ADR-Update zuerst**, dann Erweiterung
4. Nach Abschluss: CONTEXT.md aktualisieren (neue Architektur-Annahmen, ergänztes Glossar)

**Goldene Regel:** Was nicht in CONTEXT.md oder einem ADR steht, wird in der Implementation willkürlich interpretiert. Gilt symmetrisch für beide Quellen. Konkrete Definitionen + Pflicht-Inhalt: §28.1 (CONTEXT.md) und §28.2 (ADRs).

### 1.9 Clarify-First — in die Konversation gehen statt annehmen

Sobald etwas **unklar, nicht definiert oder nicht eindeutig aus Konzept / CONTEXT.md / ADR ableitbar** ist — oder eine **Entscheidung offen** ist —, **geht man sofort in die Konversation mit dem Nutzer**, bevor weitergebaut wird. Kein stillschweigendes Annehmen, kein „kläre ich später" — und **keine einzelne Drive-by-Frage**: ein echter Dialog, der läuft, bis die Lücke wirklich geschlossen ist.

**Warum:** Eine früh geklärte Lücke kostet ein Gespräch. Dieselbe Lücke, auf der bereits Arbeit, mehrere UCs oder Code aufbauen, kostet Rückbau — und eine falsche Annahme verteilt den Fehler über alles, was darauf aufsetzt. Ein Dialog deckt zusammenhängende Lücken oft gleich mit auf.

**Regel:**
- Unklarer/undefinierter Begriff → ins Gespräch gehen oder Glossar-Eintrag (§14) anstoßen, nicht raten.
- Mehrdeutige Anforderung → die Varianten mit dem Nutzer durchsprechen, nicht still eine wählen.
- Offene Entscheidung (Scope, Architektur, Vokabular, Datenmodell) → gemeinsam entscheiden, nicht implizit festlegen.
- **Selbst-geflaggte Annahme = harter Stopp:** Flaggt ein Worker (oder der Orchestrator) eine eigene Annahme **selbst als offen**, ist Weiterlaufen darauf **verboten** — der Orchestrator geht sofort in die Konversation (§32.8 (3)), statt die Annahme durchzureichen. *(Praxis-Lehre: eine durchgereichte Scope-/Mapping-Annahme, die ein Sub-Agent als offen markiert hatte, kostete einen ganzen Rework-Zyklus.)*
- Fortfahren ohne Rückkopplung ist nur erlaubt, wenn die Antwort **eindeutig** aus dem Vorhandenen ableitbar ist.

Gilt für jede Stufe (Konzept · Design · Implementation · Testing · Review). Im Orchestrator-Modell (§32) bringt der Orchestrator offene Punkte sofort in die Konversation, statt sie an einen Worker durchzureichen oder selbst zu raten; ein Worker, dem Kontext fehlt, meldet die Lücke zurück (§32.8).

---

# Teil 2 — Der Arbeitsweg (drift-/gedächtnisverlust-frei)

Dieser Teil ist der operative Kern: *wie* ein Auftrag bearbeitet wird, ohne dass die KS abdriftet oder den Kontext verliert. Reihenfolge: Modus wählen (§29) → orchestrieren statt selbst tun (§32, inkl. Drift-Vermeidung §32.8 + Skill-Gate §32.9) → gegen die Quelle verifizieren (§10.6/§10.7/§19) → durable Artefakte als Gedächtnis pflegen (§28) → Implementation-Werkzeuge greifen (§27).

## 29. Vier Anwendungs-Modi + Modus E

§29 entscheidet, welche §27-Werkzeuge in welchem Modus greifen. Modi sind nicht-linear — eine Session kann zwischen Modi wechseln.

### Modus A — Greenfield-Feature im bestehenden Repo

**Situation:** Neue Capability, mehrere Schichten, kein Bezug auf existierenden Bug oder existierende Schuld.

**Werkzeug-Kombination:**
1. CONTEXT.md / ADRs lesen (§1.8 + §27.6)
2. PRD synthesizen (Pocock `to-prd` oder §3 UC-Aufbau)
3. Vertical-Slice-Plan (§27.2) — HITL/AFK
4. AC-Tabelle pro UC (§11.7)
5. Slice 1 starten mit Vertical-TDD (§27.4)
6. CONTEXT.md aktualisieren, ggf. neue ADRs

### Modus B — Bug / Regression

**Situation:** Etwas funktioniert nicht.

**Werkzeug-Kombination:**
1. **Feedback-Loop bauen** (§27.5) — vor allem anderen
2. Loop iterieren bis schnell + deterministisch + scharf
3. **Stale-Data zuerst ausschließen** (§32.8 (6)) — saubere Reproduktion vor jedem Code-Fix
4. Hypothese, Loop fahren, Hypothese verifizieren / verwerfen
5. Fix als Vertical-Slice (Fix + Regressionstest + Audit anderer Stellen)
6. CONTEXT.md aktualisieren falls Annahme widerlegt; ADR-Update falls Annahme im ADR stand

### Modus C — Architektur-Review / Teardown

**Situation:** Review oder geplanter Teardown.

**Werkzeug-Kombination (Review):**
1. CONTEXT.md + alle ADRs lesen — wo waren die ursprünglichen Annahmen?
2. Decisions-Archäologie (§27.7)
3. Depth-Inventur (§27.7)
4. Seam-Inventur (§27.7)
5. Anti-Pattern-Scan gegen §25
6. Review-Output nach **Schema C.1**

**Werkzeug-Kombination (Teardown):**
1. Reverse-Slicing (§27.7)
2. Adapter-Roll-Back pro Seam
3. Tests an stabilen Interfaces als Verifikation
4. CONTEXT.md + neuer ADR für Teardown-Entscheidung
5. Teardown-Output nach **Schema C.2**

#### Output-Schema C.1 — Review (pro Deepening-Kandidat)

Pflicht-Felder pro Kandidat (Pocock-`improve-codebase-architecture`-Schema + Severity):
- **Modul / Files** — welche Module sind involviert (CONTEXT.md-Vokabular)
- **Problem** — warum die aktuelle Architektur Friktion erzeugt (Mechanik, nicht nur Symptom)
- **Solution** — plain-English-Beschreibung der geplanten Änderung
- **Benefits** — in Begriffen von Locality + Leverage + Test-Verbesserung
- **ADR-Konflikt** — wenn Kandidat einem bestehenden ADR widerspricht, markieren mit Begründung „warum ADR-Update gerechtfertigt"
- **Severity** — 🔴 kritisch / 🟡 mittel / 🟢 leicht

Format: nummerierte Liste mit den Pflicht-Feldern pro Eintrag.

#### Output-Schema C.2 — Teardown (Reverse-Slice-Tabelle + Pflicht-ADR)

```markdown
### Teardown-Plan: <Subsystem-Name>

| # | Reverse-Slice | Target (Modul/Seam) | Adapter-Status (bleibt/geht) | Verifikations-Tests | Risk | Reversibel? |
|---|---|---|---|---|---|---|
| 1 | … | … | … | … | … | … |

### Konsequenz-ADR (Pflicht)

**Kontext:** …
**Entscheidung:** …
**Konsequenzen:** …
**Alternativen erwogen:** …
```

### Modus D — UC → Code-Übergang (Konzept verlässt das Doc)

**Situation:** Ein Konzept nach §1–§23 ist fertig (Score ≥ 8/10, Walk-Through bestanden, AC-Tabellen vollständig). Geht in die Implementation.

**Werkzeug-Kombination:**
1. CONTEXT.md anlegen oder aktualisieren mit Konzept-Glossar
2. ADRs für asymmetrische Konzept-Entscheidungen anlegen
3. Slice-Plan aus UCs ableiten — pro UC mindestens ein Slice, oft mehrere
4. AC-Tabelle pro UC wird in Vertical-TDD-Loop (§27.4) gefahren
5. Prototyping (§27.3) für offene Logik-/UX-Fragen
6. Slice für Slice committen; CONTEXT.md mitwachsen lassen

### Modus E — KI-Capability-PoC integriert in bestehendes System

**Situation:** Neue LLM-Capability soll in eine bestehende Codebase eingeführt werden. Kombiniert §22 (PoC-Phasen) mit Brownfield-Pattern (Modus A + §27.6).

**Werkzeug-Kombination:**
1. **CONTEXT.md / ADRs lesen** (§1.8 + §27.6) — wo wird die KI-Capability integriert?
2. **§22.1 Phase 1 Lernen & Experimentieren** — fokussierte Test-Gruppe, 3–5 UCs, Compliance/Security-Enabler-Kick-off
3. **Probabilistik-Statement + Vendor-Risiko + EU-AI-Act-Klasse** (§2.6 + §2.7) anlegen
4. **Vertical-Slice-Plan** (§27.2) — Slice 1 = riskantester PoC-Pfad mit höchster Lernchance
5. **Pre/Inline/Post-Validierungs-Phasen** (§13.2) pro Slice definieren
6. **Hybrid-Validierungs-Schichten** (§15.8) für LLM-Code-Output dokumentieren
7. **§22.2 Phase 2 Verstetigen** — quantitative Erfolgsmessung pro Slice (§22.2-Tabelle)
8. **CONTEXT.md + ADRs aktualisieren** mit der neuen Capability-Schicht
9. **Skalierungs-Plan** = Vertical-Slices in Folge-Sprints

> **Bridge:** Modus E ist die explizite Brücke zwischen §22 (PoC-Phasen) und Modus A (Brownfield-Greenfield-Hybrid).

---

## 32. Orchestrator-Regel (Pflicht — Delegations-Doktrin)

**Diese Sektion ist verbindlich, nicht optional.** Der Haupt-Agent (Main-Session) führt einen nicht-trivialen CDP5-Auftrag NICHT selbst aus, sondern **orchestriert** ihn. „Kann ich machen, muss ich aber nicht" gilt hier nicht: Sobald ein Auftrag mehr als eine Stufe berührt, ist Delegation Pflicht. Delegation an isolierte Worker mit frischem Kontext ist zugleich die primäre Abwehr gegen Gedächtnisverlust (Context-Rot) im Haupt-Agenten.

### 32.1 Firmen-Modell

| Rolle | Wer | Aufgabe |
|---|---|---|
| **Unternehmung / Geschäftsleitung** | Main-Session (Orchestrator) | Auftrag verstehen, CDP5-Modus (§29) wählen, an Stufen-Worker delegieren, überwachen, **verifizieren** (§10.6), Mensch-Gates (§23) halten |
| **Fachabteilung / Worker** | Subagent pro Stufe-Rolle | Isolierte Facharbeit in **frischem, kleinem Kontext** (Drift-Schutz), mit eingebackener Methodik + gebundenen Tools |
| **Werkzeug / Verfahren** | Skill | Entweder (A) als Methodik in den Worker eingebacken oder (B) vom Orchestrator gefahren (MCP/Interaktion) |

### 32.2 Pflicht-Ablauf des Orchestrators

1. **Modus wählen (§29):** A Greenfield · B Bug/Regression · C Review/Teardown · D UC→Code · E KI-PoC.
2. **Walk-Through + Verantwortungs-Matrix (§23)** vor Delegation, wenn der Auftrag einen Sprint umfasst.
3. **Vor jeder Delegation: Determinismus-Gate + Pointer-Brief (§32.8)** — entscheidbare Aufgabe → Skript statt LLM-Worker; sonst Brief = Pointer auf Single-Source + enger Task + Scope/AC + Stop-Regel. Dann **pro Stufe an den zuständigen Worker delegieren** (Tabelle §32.4); unabhängige Worker **asynchron/parallel** (mehrere `Agent`-Calls in einer Nachricht), abhängige sequenziell.
4. **Pro Worker das günstigste ausreichende Modell wählen** (§32.3) — Token-Sparen ist Pflicht, nicht Kür.
5. **Ergebnisse verifizieren (§1.5 + §10.6):** Worker-Output ist probabilistisch → vor Folge-Aktion durch `review-verify` (Verifikationsagent) gegen Code/Quelle prüfen. Keine irreversible Aktion auf unverifizierte Worker-Behauptung.
6. **MCP-/Interaktions-Skills (B) bleiben beim Orchestrator** — Subagents bekommen keine MCP-Tools und können keine Skills/Agents rufen. Der Orchestrator fährt sie und reicht das Ergebnis an die Worker.
7. **Mensch-Gates halten (§23):** destruktive/irreversible Schritte (Schema-Drop, force-push, Migration-Cutoff, Branch-Delete) nie auto — immer Mensch.

### 32.3 Modell-Wahl pro Worker (Token-Disziplin)

| Worker-Klasse | Default-Modell | Begründung |
|---|---|---|
| Read-only / mechanisch (Mapping, Wiki-Query, Lint, Git) | **haiku** | billig, kein tiefes Reasoning nötig |
| Implementation / Scaffolding / Debug / Refactor | **sonnet** | guter Code-Reasoning-/Kosten-Tradeoff |
| Security · Architektur · Konzept-Review · Verifikation | **opus** (think hard/harder) | Fehler hier sind teuer/irreversibel |

Der Orchestrator selbst läuft im stärksten verfügbaren Modell (Reasoning-Last liegt in Delegation + Verifikation), die Facharbeit wird ins passende günstigere Modell ausgelagert.

### 32.4 Stufen → Worker → Skills (A eingebacken / B Orchestrator)

| Stufe | Worker-Agents (`stufe-rolle`) | Methodik eingebacken (A) | Orchestrator-Skills (B) |
|---|---|---|---|
| **Konzept** | `konzept-reviewer` (opus), `konzept-mapper` (haiku), `konzept-model-api` (sonnet), `konzept-sync` (sonnet) | §2/§3/§14-Checks, §19 Modell↔API | `spec-interview`, `spec-review`, `walk-through`, `repomix` |
| **Design** | `design-db` (opus), `design-agent-uc` (sonnet), `design-doc` (sonnet) | §27 Slice/Module-Depth, §28 CONTEXT.md/ADR, §13/§16/§21 LLM-UC | `prototype` |
| **Implementation** | `impl-uc`, `impl-tenant`, `impl-optional`, `impl-refactor`, `impl-debug`, `impl-template`, `impl-csrf`, `impl-imagic`, `impl-frontend` (alle sonnet), `impl-vendor-patch` (opus) | §11.7 TDD-First, **phpunit/phpstan** | `fan-out-migrate`, `writer-reviewer-loop` |
| **Testing/Eval** | `test-runner` (sonnet), `test-gap` (sonnet) | §15-Validierung, **phpunit/phpstan** | `llm-eval-harness`, `playwright-ui-sweep`, `diagnose`, `chrome-devtools` |
| **Review** | `review-symfony` (opus), `review-code` (opus), `review-security` (opus), `review-access` (opus), `review-verify` (opus) | §10 Review-Checkliste, §10.6 Verifikation | `adversarial-review`, `pr-review` |

Querschnitt-Worker (keiner Stufe fest zugeordnet): Infra (`infra-portainer`, `infra-frankenphp`, `infra-traefik`), Git (`git-ops`, `git-branch`, `git-cross-repo`), Wiki (`wiki-ingest`, `wiki-lint`, `wiki-query`).

### 32.5 Anti-Pattern

- ❌ Orchestrator macht die Facharbeit selbst, statt zu delegieren (Kontext läuft voll → Drift).
- ❌ Alle Worker auf opus (Token-Verschwendung — §32.3 ignoriert).
- ❌ Worker-Behauptung ungeprüft umsetzen (§1.5/§10.6 verletzt).
- ❌ Versuch, einen Subagenten Skills/MCP/weitere Agents rufen zu lassen (technisch nicht möglich → B-Skills gehören zum Orchestrator).
- ❌ Sequenziell abarbeiten was parallel ginge (Async-Chance vertan).
- ❌ LLM-Worker für eine entscheidbare (deterministische) Aufgabe starten statt eines Skripts (§32.8 (1)).
- ❌ Worker mit kopierten Kontext-Walls briefen statt mit Pointern (Overflow + Paraphrase-Drift, §32.8 (2)).
- ❌ Worker stoppt mit „geht nicht" ohne Stop-Retro — der Main-Agent muss raten, was passiert ist (§32.8 (3)).
- ❌ Paralleles Fan-out an viele Worker ohne Wert/Parallelisierbarkeit (~15× Token verbrannt — §32.10) statt einem Worker oder direkt.

### 32.6 Retro-ADR nach Review (Pflicht-Abschluss) + Memory-Loop

Nach Abschluss der **Review-Stufe** ist ein **Retro-ADR** Pflicht. Lessons liegen **projektspezifisch beim Code**, damit sie dort greifbar sind, wo sie gebraucht werden.

- **Ort:** `docs/retro/<NNNN>-<slug>.md` im jeweiligen Projekt-Repo (fortlaufende Nummer pro Session/Sprint).
- **Layout:** Status/Datum/Zweck → Kontext → Entscheidungschronik E1…En → Was gut lief / besser → Kern-Lehre.
- **Wer:** Der Orchestrator stößt es als letzten Schritt an; der Skill `reflection-toolkit:reflection-collector` schreibt das Retro-ADR.
- **Dauerhafte Lehren:** zusätzlich in Memory `feedback_<slug>` persistieren und im Retro-ADR verlinken.
- **Memory-Loop-Verifikation (Pflicht):** Jeder im Retro-ADR zitierte Memory-Slug **muss real existieren** (Datei `memory/<slug>.md` angelegt **und** MEMORY.md-Pointer gesetzt). Beim Retro-Abschluss prüfen — ein zitierter, aber nicht angelegter Slug ist ein gebrochener Lern-Loop: die Lehre verdampft, und derselbe Fehler kann wiederkehren. Die Prüfung ist entscheidbar → T1-Skript-Kandidat (§32.9). *(Praxis-Lehre: mehrere Retros zitierten `feedback_*`-Slugs als persistiert, die nie geschrieben wurden.)*
- **Abgrenzung:** Architektur-ADRs (*was* entschieden) liegen in `docs/adr/`; Retro-ADRs (*wie* gearbeitet) in `docs/retro/`.

### 32.7 Worker-Agent: Bedarf, Spec-Format + Scaffolding

**Bedarf — wann ein eigener Worker entsteht (vor dem Anlegen prüfen):**
1. **Stufen-Rolle als Baseline:** Jede der fünf Stufen (§32.4) hat wiederkehrende Rollen. Eine Rolle verdient einen eigenen Worker, wenn sie eine **abgrenzbare, wiederkehrende** Tätigkeit der Stufe ist (z. B. Review → symfony / code / security / access / verify).
2. **Wiederholungs-Schwelle:** ab der **3. Wiederholung** derselben manuell ausgeführten Tätigkeit → eigener Worker (gezählt über Retro-ADRs / Log).
3. **Sofort-Trigger:** ein einzelner manueller Prozess mit vielen unterschiedlichen Teilaufgaben (multi-step) → **sofort** als Worker evaluieren, nicht erst nach 3×.
4. **Abgrenzungs-/Merge-Check:** überschneidet die Tätigkeit einen bestehenden Worker, wird dieser **erweitert oder gemergt** statt einen zweiten anzulegen.
5. **Kosten/Nutzen (Anti-Pattern):** **kein** Worker für eine Ein-Schuss-Aktivität — Wartungs-Burden ohne Wiederverwendung lohnt nicht. Im Zweifel macht der Orchestrator es einmal selbst, oder ein Querschnitt-Skill greift.

**Spec-Format** — pro Worker eine Datei `agents/<stufe-rolle>.md`, projektunabhängig aus Stufe + Rolle abgeleitet:

```yaml
---
name: <stufe-rolle>            # z. B. impl-uc, review-security — Bindestrich; Doppelpunkt ist plugin:skill vorbehalten
description: <Zweck in einem Satz + „Use when …"-Trigger>
tools: <minimal nötige Tools>  # z. B. Read, Edit, Write, Bash, Grep, Glob
model: haiku | sonnet | opus   # nach §32.3
color: <optional>
---
```

**Body:**
1. **Erste Zeile = Thinking-Level:** `**Begin with 'think hard' before tool use.**` (`think harder`/`ultrathink` nur bei Security/Architektur/Verifikation; haiku-Worker meist ohne).
2. **Rolle in einem Satz** + Abgrenzung zu Nachbar-Workern.
3. **Inputs** — was der Orchestrator übergibt.
4. **Workflow** — nummerierte Schritte = die eingebackene Stufen-Methodik (§32.4 Spalte A).
5. **Tool-Binding:** deterministische Verfahren inline (z. B. Test-Worker ruft die Suite via Bash). **Keine MCP-Tools** — MCP-/Interaktions-Skills fährt der Orchestrator (§32.4 Spalte B) und reicht das Ergebnis hinein.
6. **Anti-Patterns** + **Output-Format** — Rückgabe an den Orchestrator; Behauptungen mit Beleg (§10.6).

**Scaffolding-Ablauf (Orchestrator oder `skill-creator`):**
1. Stufe + Rolle wählen (§32.4); Name `stufe-rolle`.
2. Modell nach §32.3 setzen, Tools minimal halten.
3. Stufen-Methodik (§32.4 Spalte A) als Workflow einbacken.
4. Datei unter `agents/<name>.md` anlegen **und** in den Live-Speicher `~/.claude/agents/` spiegeln, damit der `Agent`-Aufruf den Worker findet.
5. Im Worker-Inventar registrieren.

**Minimal-Template (generisch):**
```markdown
---
name: <stufe-rolle>
description: <Ein-Satz-Zweck + "Use when …">
tools: Read, Grep, Glob, Bash
model: sonnet
---

**Begin with 'think hard' before tool use.**

Du bist der <Rolle>-Worker der Stufe <Stufe>. <Abgrenzung zu Nachbar-Workern>.

## Inputs
- <was der Orchestrator übergibt>

## Workflow
1. <Schritt = eingebackene Stufen-Methodik>
2. …

## Anti-Patterns
- <was dieser Worker NICHT tut>

## Output
- <Rückgabe an den Orchestrator; Behauptungen mit Beleg; bei fehlendem Kontext STOP + Stop-Retro statt Annahme (§32.8)>
```

### 32.8 Drift-Vermeidung bei Delegation (narrensicher)

Zwei Drift-Richtungen, beide tödlich: **Context-Rot** (Worker-Kontext läuft voll) und **Under-Context** (Worker rät, weil Kontext fehlt → Behauptungen). Isolation allein löst nur die erste. Pflicht-Mechanik:

**(1) Determinismus-Gate (Pflicht vor jeder Delegation):** Bevor an einen LLM-Worker delegiert wird, prüft der Orchestrator: Ist die Aufgabe **entscheidbar** (eindeutiges Pass/Fail mit Beleg)? Wenn ja → **deterministischer Skill/Script statt LLM-Worker**; ein LLM-Worker wird nur für **echtes Judgment** gestartet. Begründung: Ein Skript halluziniert keine Behauptung — seine Ausgabe *ist* der Beleg (deckt §10.7 + §15.8).
- Deterministisch (→ Code/Skill): Tests (phpunit/phpstan), Lints, Modell↔OpenAPI-Diff, Enum-Drift, Link-/Broken-Ref-Scan, Frontmatter-/Tabellen-Konsistenz, Route-Discovery, Massen-Rename, Roadmap↔Code-Inventur, Retro↔Memory-Loop-Check.
- Judgment (→ LLM-Worker): Reife-Score, Gap-Bewertung, UC→Code-Logik, Code-Qualitäts-Urteil, LLM-as-Judge-Eval.

**(2) Task-Brief = Pointer, nicht Paste (Pflicht):** Der Brief enthält Ziel + engen Task (eine Stufe, eine Rolle), **Pointer auf die Single-Source-Dateien** (CONTEXT.md, Spec-/UC-Pfad, einschlägige ADR-Pfade, Glossar) — der Worker liest das **Original lazy + scoped** —, Scope + AC, explizites Out-of-Scope, und die Stop-Regel (3). Kopierte Kontext-Walls sind verboten: sie erzeugen Overflow (Context-Rot) **und** Paraphrase-Drift (Worker arbeitet an der Zusammenfassung statt am Original).

**(3) Worker-Contract — Beleg-Pflicht + Stop-Retro:**
- Output **immer mit Beleg** (Datei:Zeile / Befehlsausgabe).
- Fehlt Kontext zum eindeutigen Arbeiten → **STOP, keine Annahme.** Der Worker liefert ein **Stop-Retro-ADR** (Layout §32.6) zurück: **was** er getan hat (Entscheidungschronik bis zum Stop), **warum** er stoppt (die konkrete Lücke + warum nicht eindeutig auflösbar), **was** er braucht (welche Info/Entscheidung schließt sie). So weiß der Main-Agent vollständig, was passiert ist — und geht gezielt mit dem Nutzer in die Konversation (§1.9), statt blind weiterzumachen oder neu herzuleiten.
- Worker mit Write-Tool schreiben das Stop-Retro nach `docs/retro/`; Nur-Lese-Worker geben es im Output zurück, der Orchestrator persistiert es. Es fließt ins finale Retro-ADR (§32.6) ein.

**(4) Verifikations-Gate:** Worker-Behauptungen werden vor jeder Folge-Aktion gegen die Quelle geprüft — deterministisch wo möglich, sonst `review-verify` (§10.6). Under-Context-Behauptungen werden genau hier abgefangen.

**(5) Parallelität nur self-contained:** Nur Worker mit **unabhängigen, self-contained Briefs** laufen parallel. Gemeinsam-evolvierender Kontext → sequenziell oder neu briefen, sonst arbeiten parallele Worker auf veralteten Annahmen.

**(6) Reproduktions-/Empirie-Gate (vor jedem Diff-/Bugfix):** Bevor ein abweichendes Ergebnis als Bug gefixt wird, schließt der Orchestrator **stale-/altes-State zuerst aus** (saubere Reproduktion / Clean-Re-Run), dann klassifiziert er pro Diff False-Positive (Rekonstruktions-/Mess-Lücke) vs. echten Defekt — nie den Soll-Vergleich aufweichen, um „grün" zu werden. Sprach-/Plattform-Semantik wird **ausführbar belegt** (`php -r`, kurzer Probelauf), nicht aus dem Gedächtnis behauptet (auch nicht aus dem des Reviewers). Reviewer/Worker bekommen das **exakte Target** (Container/Checkout/Pfad) im Brief genannt.

**(7) Vorbedingung = Stopp, nicht Verhandlungsbasis:** Eine in ADR/Konzept notierte Vorbedingung („X ist Voraussetzung") ist ein **Gate**. Ist sie offen, ist die Slice **blockiert** — kein „Rescue"-Versuch im selben Lauf.

### 32.9 Skill-Determinismus-Gate (Tier-Klassifikation)

§32.8 (1) gilt nicht nur für die Delegation, sondern für **jedes Werkzeug**: Ein **Text-Skill läuft über ein LLM** und ist nicht reproduzierbar (gleicher Auftrag, n Läufe → bis zu n Ergebnisse). Ein **programmierter Skill hat feste Struktur** — gleicher Input → gleiches Ergebnis, und seine Ausgabe *ist* der Beleg. Jeder Skill/Agent bekommt darum bei Anlage (`skill-creator`) und im Quartals-Audit ein **Tier:**

| Tier | Wann | Form |
|---|---|---|
| **T1 — Deterministischer Kern** | entscheidbar (Pass/Fail mit Beleg) **+** wiederholt **+** strukturierter Input | programmierter Skill in einer **host-verfügbaren** Runtime (Default Node.js) + eigene Tests; Output = Beleg |
| **T2 — Agent (LLM-Worker)** | echtes Judgment, begrenzter Scope | Subagent (§32.3), Behauptung mit Beleg |
| **T3 — Text-Skill** | nur interaktiver Mensch-Dialog-Wert (Reproduzierbarkeit ist nicht das Ziel) | Markdown-Skill (z. B. `spec-interview`, `walk-through`, `adversarial-review`) |
| **Hybrid** | LLM-Framing → T1-Kern → LLM-Interpretation | Text-Skill, der ein T1-Programm ruft (z. B. `review-verify`, `konzept-mapper`) |

**Runtime (verbindlich):** T1-Skills laufen auf dem **Host**, auf dem Claude Code läuft — die Runtime muss dort **garantiert installiert** sein. Default ist **Node.js**, weil Claude Code selbst eine Node-CLI ist und damit immer präsent (eine Toolchain für alle host-seitigen Skills). **PHP ist keine Host-Garantie:** die Projekte laufen in Docker, PHP lebt *in* den Containern, nicht auf dem Host. Ein Gate, das die Projekt-PHP-Runtime braucht, läuft daher **im Container via `docker exec`**, angestoßen von einem dünnen host-seitigen (Node-)Wrapper. T1-Skills kommen **mit eigener Testsuite**, sonst tauscht man LLM-Nicht-Determinität nur gegen ungetestete Code-Bugs (real: ein deterministischer Evaluator hatte einen 🔴-Bug bei PHP-Array-Auto-Index, den nur eine ausführbare Gegenprobe fand).

**Architektur-Regel:** Der deterministische Kern ist das **Rückgrat, nicht der ganze Körper.** Nimmt ein Skill Fließtext-Input, macht ein LLM das unscharfe Framing und übergibt **strukturierten** Input an den T1-Kern — sonst wird die Nicht-Determinität nur nach oben (in die Auswahl/Extraktion) verschoben, nicht getilgt.

**Governance:** Eine **entscheidbare** Tätigkeit, die als T3-Text-Skill läuft, ist ein **Tier-Fehler** und wird portiert (Trigger: Quartals-Audit oder ab 3. Wiederholung, §32.7). Umgekehrt **kein** T1-Programm für Ein-Schuss-Aktivitäten (§32.7 (5)) und **kein** Zwang von Judgment-Tasks in ein Skript (das gibt ein schlechteres, sprödes Ergebnis).

### 32.10 Fan-out-Ökonomie — wann Multi-Agent lohnt

Orchestrierung heißt **nicht** automatisch viele parallele Agenten. Drei Stufen, von günstig nach teuer:
- **Direkt selbst** (kein Worker) — bei kleinem, klarem Scope, wenn ein Brief teurer wäre als die Arbeit. *Start simple* (Provenienz: Anthropic „building effective agents": einfachste Lösung zuerst; Agenten tauschen Latenz + Kosten gegen Flexibilität — nur einsetzen, wenn Einfacheres nachweislich nicht reicht).
- **Ein Stufen-Worker** (Default für abgegrenzte Facharbeit) — Drift-Isolation durch frischen Kontext (§32.1).
- **Paralleles Fan-out an mehrere Worker** — teuer (Multi-Agent verbraucht **~15× Chat-Token**, Anthropic Multi-Agent-Research). Lohnt nur, wenn (a) die Subtasks **unabhängig + parallelisierbar** sind (§32.8 (5) self-contained) **und** (b) der Wert den Token-/Latenz-Overhead rechtfertigt.

**Gate vor Fan-out:** unabhängig + parallelisierbar + wertig? → fan-out; sonst sequenziell oder direkt. (Komplement zum §32.5-Anti-Pattern „sequenziell, was parallel ginge".)

**Agent-Architektur (Produktion):** Für agentische Produktions-UCs ist das **GOAP-/Embabel-Pattern (§13.2)** die Referenz — ein deterministischer Planer steuert den Flow, das LLM ist Werkzeug in typisierten Actions („das LLM steuert nicht den Flow, der Planer tut es"). Agenten nur bei Entscheidungen unter Unsicherheit mit mehreren Lösungspfaden; nicht für CRUD/regelbasierte Prozesse (§13.2/§13.3).

---

## 10.6 / 10.7 / 19 — Verifikation & Modell↔API-Konsistenz

Die Verifikations-Mechanik gehört zum Arbeitsweg: sie fängt Drift zwischen Soll (Spec/Modell) und Ist (Code) ab.

### 10.6 Verifikationsagent neben Review-Agent

Ein KI-Agent, der sowohl die geschriebene Spezifikation (das „Soll") als auch den geschriebenen Code (das „Ist") liest, kann beide stets in Einklang halten (Provenienz: Bartels 2026).

| Rolle | Aufgabe | Zeitpunkt |
|---|---|---|
| **Review-Agent** | Spec gegen Policies prüfen | Vor Implementierung |
| **Verifikationsagent** | Spec ↔ Code-Drift erkennen | Nach jedem Sprint |

Beide sind im `.claude/agents/`- bzw. `.github/agents/`-Verzeichnis als separate Personas zu definieren.

### 10.7 Verifikations-Konvention für Pflichten

**Regel:** Jede mit „Pflicht" markierte Aussage in einem Konzept muss einen objektiv prüfbaren **Nachweis-Typ** haben — sonst kann ein Review-Agent „erfüllt ja/nein" nicht feststellen, und die Pflicht ist faktisch unverbindlich. Vier zulässige Nachweis-Typen:

| Nachweis-Typ | Wo verankert | Beispiel |
|---|---|---|
| **Test / AC** | Akzeptanzkriterien-Tabelle (§11.7) | „AC-2: Anonymer Besucher bekommt 401" |
| **Policy-Score** | gewichtete Policy-Datei (§10.5) | `implementation-clarity.policy.md`, weight 0.7 |
| **Checklist-Item** | Pflicht-Checkliste (§7) | „[ ] Probabilistik-Statement im Kopf" |
| **Trace-Span** | OpenTelemetry-Span (§15.1) | `gen_ai.*`-Attribut pro LLM-Call |

**Konzept-Bug:** Eine „Pflicht" ohne zugeordneten Nachweis-Typ ist ein Konzept-Bug und im Review zu flaggen.

**Mapping bisher prosa-formulierter Pflichten auf ihren Nachweis:**

| Pflicht (Sektion) | Nachweis-Typ | Konkreter Nachweis |
|---|---|---|
| Red Teaming pro LLM-UC (§15.4) | Test/AC + Trace | Promptfoo-`redteam`-Config im Repo; pro LLM-UC AC-Eintrag „welche `harmful:*`-Plugins + Strategien" |
| OAuth pro MCP-Server (§16.5) | Checklist-Item | Pro MCP-Server-Eintrag im Konzept Feld „OAuth: ja/nein + Token-Rotation" |
| Streaming als UX-Pflicht (§20.1) | Test/AC | Pro LLM-UC benanntes Streaming-Verhalten (SSE/Chunked) + Integration-Test |
| Kontext-Pyramide-Schichten (§18.2) | Checklist-Item | Pro LLM-UC Schichten-Liste + Cache-Strategie dokumentiert |
| TAO-Logging pro Agent-UC (§21.1) | Trace-Span | OTEL-Span je Thought / Action / Observation (§15.1) |
| Knowledge-Cutoff-Umgang (§15.5) | Test/AC | Cutoff-Test-Case („iPhone 17") in der AC-Tabelle des UC |
| Vendor-Risiko-Statement (§2.7) | Checklist-Item | §7-Eintrag „Vendor-Risiko-Statement vorhanden bei LLM-UC" |
| Hybrid-Validierungs-Phasen (§13.2/§15.8) | Test/AC + Trace | Post-Phase-Checks (LSP/AST/CodeQL) als CI-Gate + AC pro Phase |

### 19. Konsistenzcheck Modell ↔ API (Junker-Pattern)

#### 19.1 Pflicht-Modelle die synchron gehalten werden müssen

| Modell | Format | Wer pflegt | Wann gegen Code prüfen |
|---|---|---|---|
| Visual Glossary | Bild + Markdown | Domain Expert | Pro Sprint-Ende |
| Context Map (DDD) | Mermaid / draw.io | Architekt | Pro Sprint-Ende |
| OpenAPI-Spec | YAML im Repo | Backend | Pro PR |
| AsyncAPI-Spec | YAML im Repo | Backend | Pro PR |
| ER-Diagramm | Mermaid | DB-Architekt | Pro Migration |

#### 19.2 Zyklus

```
Modell-Änderung → LLM-Konsistenzcheck-Prompt (Anhang A.6) → Refactoring-Empfehlungen
  → Domain-Experten validieren → Code wird angepasst (oder Modell wird angepasst)
```

#### 19.3 Trennung Modell ↔ Diagramm

Modelle sind die Single Source of Truth, Diagramme nur eine eingeschränkte Ansicht (Provenienz: Junker 2026). LLM-Konsistenzchecks gehen IMMER gegen das Modell, nie gegen das Diagramm.

#### 19.4 AsyncAPI ↔ Context Map (event-getriebene Systeme)

Neben OpenAPI↔Visual-Glossary (Anhang A.6) braucht ein event-getriebenes/Messaging-System einen zweiten Konsistenzcheck: **AsyncAPI gegen die DDD-Context-Map.** Prüf-Dimensionen (Junker): Service-Identität · Relationship-Patterns (Conformist / ACL / Partnership / Shared Kernel) · Event-Namen · Channel-Namen · Context-Boundaries · fehlende Elemente · Versionierung. Typischer Fund: „Service publiziert nicht alle aus der Context Map ableitbaren Events." Pro Sprint-Ende, versionierter Prompt.

---

## 28. Durable Plan-Artefakte (das externe Gedächtnis)

Durable Artefakte sind die Abwehr gegen **Gedächtnisverlust**: sie halten Domain-Vokabular, Architektur-Entscheidungen und Sprint-Stand außerhalb des flüchtigen Session-Kontexts.

### 28.1 CONTEXT.md

**Zweck:** Lebendes Glossar + Architektur-Annahmen + Sprint-Strategie. SSOT zwischen Sessions.

**Pflicht-Inhalte:** Stack-Übersicht · Domain-Glossar (§14) · Architektur-Annahmen (verifiziert + entschieden) mit ADR-Referenzen · Rollen / Permissions / Drift-Markierungen · Sprint-Strategie (falls aktiv).

**Wo:** Repo-Root oder `src/<context>/CONTEXT.md` (Multi-Context via `CONTEXT-MAP.md`).

### 28.2 ADRs (Architecture Decision Records)

**Zweck:** Harte / asymmetrische Entscheidungen durabel machen.

**Pflicht-Struktur:** **Kontext** (Situation) · **Entscheidung** (was wurde entschieden) · **Konsequenzen** (Plus / Minus / Tests / Audit-Scope) · **Alternativen erwogen** (was verworfen wurde und warum).

**Pfad:** `docs/adr/ADR-NNN-<slug>.md`, fortlaufend nummeriert.

### 28.3 Slice-Issue-Briefs

**Zweck:** Pro Vertical-Slice ein Brief im Tracker, der Agent oder Mensch unbeaufsichtigt arbeiten lässt (AFK) oder Architektur-Entscheidung antriggert (HITL).

**Pflicht-Felder im Brief:** Slice-Nummer + Titel · HITL / AFK · Branch-Target (fold-in vs. eigene Feature-Branch) · Scope (E2E — welche Schichten) · Risk-Einschätzung · Lernchance (für Slice 1) · Dependencies (welche Slices müssen vorher gemerged sein?) · AC-Liste (aus §11.7) · **Optional:** User-Stories im Pocock-Format „Als <Akteur> möchte ich <Feature>, damit <Benefit>".

#### AFK-Hardening — zusätzliche Pflicht-Bedingungen

Ein Slice darf nur AFK markiert sein, wenn ALLE folgenden Bedingungen erfüllt sind. Fehlt auch nur eine: Slice ist HITL.

- [ ] Test-Setup für den Slice-Scope ist im Repo lauffähig (CI grün auf Branch-Target)
- [ ] AC-Liste ist vollständig — keine „noch zu klären"-Marker
- [ ] Domain-Vokabular aus CONTEXT.md / Konzept-Glossar ist im Brief durchgängig verwendet
- [ ] Alle in „Dependencies" gelisteten Slices sind bereits gemerged (nicht nur geplant)
- [ ] Branch-Target ist konkret benannt (Branch-Name oder PR-Nummer)
- [ ] Reviewer-Kette für den auto-generierten PR ist definiert (menschlicher Approver Pflicht)

### 28.4 Handoff-Docs

**Zweck:** Wenn eine Session am Token-Limit ist, eine Slice mehrere Sessions braucht, oder Team wechselt — die Hauptabwehr gegen Gedächtnisverlust *zwischen* Sessions.

**Pflicht-Inhalte:** Was wurde erledigt? (Verweis auf Slice-Issue / PR / Commit-Range — keine Wiederholung) · Was steht als Nächstes an? · Welche Artefakte sind SSOT? (CONTEXT.md / ADR / Slice-Brief) · Welche Skills / Tools sollte die nächste Session einsetzen?

**Pfad:** `mktemp -t handoff-XXXXXX.md` oder `.tmp/handoffs/YYYY-MM-DD-<slug>.md`.

### 28.5 Temporäre vs. durable Plan-Doks

| Artefakt | Lebensdauer | Wo |
|---|---|---|
| `CONTEXT.md` | durabel | Repo-Root |
| `docs/adr/*.md` | durabel | Repo `docs/adr/` |
| Slice-Issue im Tracker | durabel | Issue-Tracker |
| **PRD** (Problem Statement + Solution + User-Stories + Implementation Decisions) | **durabel** | **Issue-Tracker mit `ready-for-agent`-Label** |
| Handoff-Doc | semi-durabel (löschbar nach Session-Übergang) | `.tmp/handoffs/` |
| **Slice-Plan / Sprint-Brief / Roadmap** | temporär (bis Slice abgeschlossen) | `.tmp/` |
| Brainstorm-Notes | temporär | `.tmp/brainstorm.md` |
| Prototype-Code | temporär (löschen oder absorbieren) | nahe Zielmodul, klar markiert |

**PRD vs. Slice-Plan:** Das **PRD** ist ein durables Issue-Tracker-Artefakt (Problem Statement, Solution, User-Stories, Implementation Decisions, `ready-for-agent`-Label). Der **Slice-Plan / Sprint-Brief** ist ein temporäres `.tmp/`-Doc (Vertical-Slices mit HITL/AFK + Dependencies + AC-Refs), wird vor PR gelöscht. **Roadmaps sind temporär** und driften → vor Sprint-Planung gegen den Code abgleichen (Roadmap↔Code-Inventur, T1-Skript / `konzept-mapper`; §25 Anti-Pattern).

> **Pflicht vor PR:** Temporäre Plan-Doks aus `.tmp/` löschen. Wahrheit lebt im Code.

### 28.6 Kontext-Hygiene & Instruktions-Dateien

Durable Artefakte (§28.1–§28.5) sind das **externe** Gedächtnis; hier die Pflege des **flüchtigen** Kontexts (Provenienz: Anthropic „effective context engineering" + „Claude Code best practices"):

- **Kontext ist endliche Ressource.** Genauigkeit fällt messbar **ab ~60–70 % Fenster-Auslastung** (Context-Rot) — hochwertige Info priorisieren, low-value-Tokens prunen.
- **Frühwarnsignal:** Coding-Assistenten legen ihre Restkapazität nicht offen; **plötzliches Scheitern großer Changes** oder stilles Kompaktieren = Memento-Effekt-Risiko. Bei Annäherung ans Limit → Handoff-Doc (§28.4).
- **Reset-Regeln:** zwischen **unzusammenhängenden** Tasks Kontext leeren (`/clear`); **nach 2 fehlgeschlagenen Korrekturen** desselben Problems neu starten mit besserem Prompt — ein sauberer Kontext schlägt einen verschmutzten mit angesammelten Fehlversuchen fast immer.
- **Just-in-time-Retrieval:** leichte Identifier (Pfade, Queries, Links) halten und Daten **zur Laufzeit lazy** laden, statt alles vorab in den Kontext zu ziehen — die Generalisierung des Pointer-Briefs (§32.8 (2)).
- **Compaction bewahrt Entscheidungen:** beim Zusammenfassen Architektur-Entscheidungen, offene Punkte, geänderte Dateien und Test-Befehle erhalten; redundante Outputs verwerfen.
- **CLAUDE.md/AGENTS.md-Disziplin:** Die Instruktions-Datei wird **jede Session geladen** → kurz halten, **regelmäßig prunen** (Test je Zeile: „würde Entfernen einen Fehler verursachen? wenn nein, raus"). Bloat → Regeln gehen unter und werden ignoriert. Nur, was die KI **nicht aus dem Code ableiten** kann (Befehle, projektspezifische Gotchas, Konventionen); situatives Wissen gehört in **Skills (on-demand)**, nicht in die immer-geladene Datei. Bei mehreren KI-Tools: **`AGENTS.md`** als tool-agnostischer Standard (ein Regel-Set, kein Drift zwischen Tools), `CLAUDE.md` nur für Claude-Spezifika.

> **Dogfood:** Genau dieser Grund trägt die v5-Struktur — Teil 4/5 + Anhang sind überspringbar, damit ein Task nur den relevanten Kontext lädt; CDP5 selbst unterliegt der Pruning-Disziplin.

---

## 27. Implementation-Plan (Werkzeug-Kasten)

**Charakter:** §27 ist **kein Workflow** und **keine Phasen-Doktrin**, sondern ein Werkzeug-Kasten. Welches Werkzeug man wann greift, entscheidet §29. Der Orchestrator (§32) wählt den Modus und delegiert die hier definierten Werkzeuge an die zuständigen Stufen-Worker (z. B. Vertical-TDD §27.4 → `impl-uc`, Diagnose-Loop §27.5 → `impl-debug`).

**Quellen-Fundament (inline — trägt ohne externe Lektüre):** Die Implementation-/Review-/Teardown-Doktrin ruht auf zwei Wissensbasen, deren Kernthesen hier zusammengefasst sind:

- **Ousterhout — „A Philosophy of Software Design":** Komplexität ist der Feind; sie akkumuliert aus *Dependencies* und *Obscurity* und zeigt sich als Change-Amplification, hohe kognitive Last und „unknown unknowns". Gegenmittel: **deep modules** (viel Verhalten hinter schmaler Schnittstelle), konsequentes Information Hiding, „define errors out of existence", strategisches statt taktisches Programmieren. Daraus: Module-Depth-Vokabular (§27.1) + Deletion-Test.
- **Pocock (`mattpocock-skills`-Toolkit):** operative KI-Coding-Praktiken — Vertical-Slicing / Tracer-Bullets (§27.2), Throwaway-Prototyping (§27.3), Vertical-TDD-Loop (§27.4), Diagnose-Feedback-Loop (§27.5), HITL/AFK-Markierung pro Slice, durable Artefakte (§28). Skills `to-prd`, `to-issues`, `tdd`, `improve-codebase-architecture`, `diagnose`, `zoom-out` operationalisieren sie.

### 27.1 Module-Depth-Vokabular (Ousterhout-Erbe)

| Begriff | Definition |
|---|---|
| **Modul** | Alles mit Interface + Implementation |
| **Interface** | Alles, was ein Aufrufer wissen muss: Typen, Invarianten, Fehler-Modi, Ordering, Konfiguration. Nicht nur Typ-Signatur. |
| **Implementation** | Der Code im Inneren |
| **Depth** | Hebel am Interface: viel Verhalten hinter schmaler Schnittstelle. **Deep** = hoher Hebel. **Shallow** = Schnittstelle fast so komplex wie Implementation. |
| **Seam** | Ort, an dem ein Interface lebt — eine Stelle, an der Verhalten ohne Code-Edit austauschbar ist |
| **Adapter** | Konkrete Sache, die ein Interface an einem Seam erfüllt |
| **Leverage** | Was der Aufrufer aus Depth zieht |
| **Locality** | Was der Wartende aus Depth zieht: Änderungen, Bugs, Wissen konzentriert an einem Ort |

#### Pflicht-Heuristiken

- **Deletion-Test:** Würde Löschen die Komplexität verschwinden lassen oder über N Aufrufer wieder auftauchen? Verschwinden → war Pass-Through. Wieder auftauchen → verdient seine Existenz.
- **Interface = Test-Surface:** Tests gehen durch das Interface, nicht durch die Implementation.
- **Ein Adapter = hypothetischer Seam. Zwei Adapter = realer Seam.**

> **Im Konzept ausweisen:** Bei jeder Modul-Extraktion in §3 UC-Strukturplan oder ADR wird der Deletion-Test als 1-Satz-Antwort notiert.

### 27.2 Vertical-Slice / Tracer-Bullet als Decomposition-Default

| Horizontal (Anti-Pattern) | Vertical (Default) |
|---|---|
| Alle Migrationen → alle Repositories → … → alle Tests | Ein Tracer-Bullet, das durch alle Schichten für einen schmalen Pfad geht |
| Refactor in Bulk | Refactor pro Slice |
| PR wird gigantisch | PR pro Slice ist demoable + review-bar |

#### Slice-Regeln

- Jeder Slice durchquert ALLE Schichten (Schema, API, UI, Tests) für einen schmalen Pfad
- Ein abgeschlossener Slice ist **eigenständig demoable oder verifizierbar**
- Viele dünne Slices > wenige dicke
- **Slice 1 = riskantester Pfad mit höchster Lernchance**, nicht der einfachste
- Slices haben explizite **Dependencies**

#### HITL / AFK-Markierung pro Slice

| Marker | Bedeutung |
|---|---|
| **HITL** | Architektur-Entscheidung, Design-Review, Stakeholder-Sign-off nötig |
| **AFK** | Vollständig spezifiziert, Agent kann unbeaufsichtigt implementieren und PR liefern |

Konkrete AFK-Pflicht-Felder in §28.3.

#### Im Konzept abzubilden

```markdown
### Slice-Plan

| # | Slice | Typ | Blocked by | UC-Refs | AC-Refs |
|---|---|---|---|---|---|
| 1 | RSVP-Web-Parity (404+422) | AFK | — | UC-04 / UC-05 | AC-3, AC-4, AC-7 |
| 2 | 404-Pattern-Audit | HITL | 1 | UC-04 | (neuer AC) |
| 3 | Rate-Limit-Foundation (Redis) | HITL | 2 | UC-04, UC-06, UC-08 | AC-9, AC-10 |
```

UC-Refs können auf konkrete UC-Schritte verweisen (z. B. `UC-04.3.2`). User-Stories gehören in den Slice-Brief (§28.3), nicht in die Slice-Plan-Tabelle.

### 27.3 Throwaway-Prototype als Frage-Beantwortung

| Branch | Frage | Form |
|---|---|---|
| **Logic-Branch** | „Fühlt sich diese Logik / dieses State-Modell richtig an?" | Winzige interaktive Terminal-App |
| **UI-Branch** | „Wie sollte das aussehen?" | Mehrere radikal verschiedene UI-Varianten auf einer Route, umschaltbar via Query-Param |

#### Pflicht-Regeln (beide Branches)

1. **Throwaway from day one** — als solcher markiert
2. **Ein Befehl zum Starten**
3. **Keine Persistenz per default** — In-Memory-State
4. **Keine Polish** — keine Tests, kein Error-Handling jenseits des Lauffähigen
5. **Surface the state** — nach jeder Aktion / jedem Switch
6. **Delete or absorb when done** — nie rotten lassen

### 27.4 Vertical-TDD-Loop (verschärft §11.7)

§11.7 verlangt eine AC-Tabelle pro UC. §27.4 sagt, **wie** sie gefahren wird.

#### Anti-Pattern: Horizontal-TDD

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5
```

#### Korrekt: Vertical-TDD-Loop

```
RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

#### Test-Eigenschaften (Pocock-Definition)

- Tests prüfen **Verhalten durch öffentliche Interfaces**, nicht Implementation-Details
- Gute Tests sind **integration-style**: durchlaufen echte Code-Pfade durch public APIs
- Schlechte Tests: Mocking interner Kollaborateure, Testen privater Methoden

### 27.5 Diagnose-Feedback-Loop

**„Build the right feedback loop, and the bug is 90 % fixed."** Der Feedback-Loop ist die eigentliche Debug-Skill (Provenienz: Pocock). Loop-Konstruktion (in dieser Reihenfolge probieren):

1. Failing Test am Seam, der den Bug erreicht
2. Curl / HTTP-Script gegen Dev-Server
3. CLI-Invocation mit Fixture-Input, Diff gegen Snapshot
4. Headless-Browser-Script
5. Replay aufgezeichneter Trace
6. Throwaway-Harness
7. Property / Fuzz Loop
8. Bisektions-Harness (`git bisect run`)
9. Differential Loop
10. HITL Bash-Script (letzter Ausweg)

#### Loop iterieren

- Schneller? (Setup cachen, Test-Scope verengen)
- Schärferes Signal? (auf Symptom asserten)
- Deterministischer? (Zeit pinnen, RNG seeden, FS isolieren)

#### Wenn keine Loop baubar ist

Stoppen, explizit sagen, Aufzählen was probiert wurde. Den User bitten um (a) Repro-Umgebung, (b) erfasstes Artefakt (HAR, Log, Core-Dump, Bildschirmaufnahme), oder (c) Erlaubnis für temporäre Production-Instrumentierung. **Nicht** zur Hypothese ohne Loop fortschreiten.

### 27.6 Brownfield-Erweiterungs-Pattern

Pflicht-Reihenfolge bei Erweiterung bestehender Software:

1. **CONTEXT.md lesen** (oder anlegen, §28.1) — §1.8 Goldene Regel
2. **ADRs im Touch-Bereich lesen** — bei Konflikt ADR-Update zuerst
3. **Domain-Glossar-Vokabular** in Test-Namen, Interface-Vokabular, PRDs, Issue-Titeln verwenden — **keine Drift**
4. **Bestehende Voter / Services / Repositories sichten** bevor neue parallel angelegt werden (Deletion-Test als Filter)
5. **Slice-Plan** (§27.2) erstellen mit Dependencies zwischen Slice und Bestand
6. **Vertical-TDD-Loop** (§27.4) — Tests an bestehenden Seams aufhängen
7. **CONTEXT.md aktualisieren** vor PR

**Zwei Anker für KI in Bestandscode:** **Insel der Ordnung** (Provenienz: Leßner) — in Legacy-Code einen separaten Ordner mit blitzsauberen Minimal-Referenzimplementierungen aller Bausteine (Entity, Repository, Test-Builder) anlegen; die KI **imitiert, was sie sieht**, also unverschmutzte Vorbilder geben (wird nicht ausgeliefert). **Self-Contained Systems** (SCS) — Subsysteme mit eigener Datenhaltung/UI halten den KI-Kontext pro UC klein: ein System-UC bezieht sich nur auf ein Subsystem (Deep-Module-Geist, §27.1).

### 27.7 Review/Teardown-Modus

Architektur-Review oder geplanter Teardown nutzt §27 rückwärts.

#### Review-Werkzeuge

- **Deletion-Test pro Modul** (§27.1) — Pass-Through identifizieren
- **Depth-Inventur** — Interface- vs. Implementation-Komplexität
- **Seam-Inventur** — hypothetische vs. reale Seams
- **Decisions-Archäologie** — bestehende ADRs gegen heutige Realität prüfen
- **Anti-Pattern-Scan** (§25-Liste)

Output: siehe §29 Modus C.1.

#### Teardown-Werkzeuge

- **Reverse-Slicing** — Teardown als Vertical-Slice-Sequenz; Slice 1 = riskantester Roll-Back
- **Adapter-Roll-Back** — Seam beibehalten, Adapter außer einem entfernen → Seam wird hypothetisch → kann gelöscht werden
- **Tests an stabilen Interfaces** halten als Verifikation
- **Pflicht-ADR** für die Teardown-Entscheidung

Output: siehe §29 Modus C.2.

---

# Teil 3 — Sicherheit (Agent-/Tool-Safety + AppSec)

**Dieser Teil ist verbindlich, sobald ein UC tool-/agentisch ist, nach außen kommuniziert oder schützenswerte Daten/Endpunkte berührt** — sonst überspringbar (analog Teil 5/LLM). Security ist **Build-Zeit-Doktrin**: Bedrohungen im Design modellieren, Gates in CI erzwingen, sichere Patterns vorgeben — nicht erst im Betrieb reagieren. Betriebs-/Org-Security ist bewusst draußen (§33.8); regulatorische Compliance läuft über §2.6 + Cross-Ref (§33.8).

## 33. Sicherheit

### 33.1 Lethal-Trifecta-Gate (Agent-Gefahrenmodell)

Ein tool-nutzender Agent ist gefährlich, sobald **drei Bedingungen zusammentreffen** (Lethal Trifecta, Provenienz: Willison 2025):
1. **Zugang zu sensiblen Daten** (Secrets, Kundendaten, interne APIs, Dateisystem),
2. **Kontakt mit nicht-vertrauenswürdigen Inhalten** — Web, E-Mail, RAG-Dokumente, **MCP-/Tool-Responses**, fremder Code / abhängige Libraries,
3. **Fähigkeit zur externen Kommunikation** (Netz-Egress, Tool-Calls nach außen).

**Gate-Regel:** Treffen alle drei zu, ist mindestens **eine Achse zu brechen** — Egress auf Allowlist beschränken **oder** Daten-Scope minimieren **oder** untrusted-Content isolieren — **oder** ein Human-Approval-Gate (§23) vor der riskanten Aktion. Pro Agent-/LLM-UC im Konzept ausweisen: welche der drei Achsen zutreffen und welche Gegenmaßnahme greift. *(Praxis: ein injizierter Prompt aus einer kompromittierten Library exfiltrierte `.env`-Secrets via Tool-Call — Prompt-Injection steht auf OWASP-LLM-Top-10 Platz 1.)*

### 33.2 Agent-Runtime-Härtung (Pflichtfelder pro agentischem UC)

- **Sandboxing** (VM/Container) mit **Netz-Egress-Allowlist** — bricht die dritte Trifecta-Achse.
- **Keine Klartext-Secrets im Agent-Kontext** — Secret-Store → Umgebungsvariablen (z. B. KeePass/Vault per Skript); sensible Pfade per ignore/exclude aus dem Tool-Kontext nehmen; besonders sensible Repos ggf. ganz ohne KI-Plug-in bearbeiten.
- **Tool-/Web-Response = untrusted input** (§15.8) — an jeder Grenze sanitisieren; WebFetch/Browse nur auf Allowlist.
- **Diffs/Commits auf injizierte Prompts prüfen** (Review-Schritt) — gegen eingeschleuste Instruktionen.
- Vom Coding-Agent mitgelieferte Schutzmechanismen (Sandbox, automated security reviews) **explizit aktivieren**, nicht annehmen.

### 33.3 MCP-Tool-/Server-Sicherheit (erweitert §16)

Pro MCP-Server im Konzept führen:

| Pflichtfeld | Schützt gegen |
|---|---|
| **Trust-Source** — Eigenbau vs. Drittanbieter; Drittanbieter vetten (Registry/Signatur/Pinning, Qualität prüfen) | Name-Spoofing, qualitativ durchwachsene Fremd-Server |
| **Beschreibungen sind untrusted** — Approval-Hash + **Re-Verifikation bei `list_changed`** | Tool-Description-Injection, Rug-Pull (Post-Approval-Mutation) |
| **Tool-Level-Autorisierung** — wer darf welches Tool / welche Daten: OAuth2/JWT/mTLS, API-Gateway/Reverse-Proxy, Rate-Limit, Auditing | unautorisierter Zugriff, ungebremste autonome Aktionen |
| **Deployment-Isolation** — Sandbox/OCI-Container | Ausbruch, Lateral Movement |
| **Spec-Version + Upgrade-Strategie** | Versionsdrift (Auth/Transport ändern sich schnell) |

Default = **least privilege**: nur UC-relevante Server/Tools sichtbar (Tool-Budget, §16.6/§16.7).

### 33.4 Threat-Modeling „light" im Design

Pflicht bei **neuen APIs, neuen Trust-Boundaries, externen Schnittstellen oder Agent-/Tool-UCs** — ein kurzer Pass (45-Min-Format genügt) im Design, **bevor** Code entsteht:
1. **Was bauen wir?** — eine Data-Flow-Skizze (Entry-Points, Trust-Boundaries, Datensenken).
2. **Was kann schiefgehen?** — STRIDE über die Boundaries (Spoofing / Tampering / Repudiation / Info-Disclosure / DoS / Elevation); bei LLM-UC zusätzlich §33.6.
3. **Was tun wir?** — priorisierte Bedrohungsliste (grobes Risiko = Eintritt × Schaden); je Top-Bedrohung eine Gegenmaßnahme als **AC** (§11.7).
4. **Gut genug?** — Rest-Risiko notieren; bei Hochrisiko zusätzlich §2.6.

Output (Skizze + Bedrohungsliste) ins Konzept; Pflicht-Section bei sicherheitsrelevantem Anteil (§7).

### 33.5 Security-Gates (Build-Blocker, strenger als Quality-Gates)

KI-Code ist **prüfpflichtig wie ein Junior-Beitrag**. Security-Gates sind verbindlicher als Quality-Gates und laufen **projektweit** (nicht nur für KI-Code wie §15.8):
- **SAST** (CodeQL/SonarQube/Semgrep) — CRITICAL blockt den Build.
- **Dependency-Scan + SBOM** (CycloneDX/SPDX pro Release); OSS-Aufnahme-Kriterien (OpenSSF-Scorecard, aktive Maintenance, Lizenz-Whitelist); CVE-CRITICAL blockt.
- **Secret-Scan** (gitleaks pre-commit) + Secrets-Management (Vault/KMS, IaC-Secrets separat) — kein Klartext-Secret im Repo.
- **Security-Linter** + optional KI-gestützte Security-Reviews (gezielte Prompts/Agenten gegen OWASP-Top-10-Klassen) **als zusätzliche Prüfspur, nicht als Ersatz** für menschliche Reviews; bei kritischen Pfaden Pen-Test / automatisierte Security-Tests.

### 33.6 LLM-Bedrohungsklassen (erweitert §15.4)

Pro LLM-UC die relevanten Klassen + Gegenmaßnahme ausweisen (Orientierung: OWASP GenAI Top 10, §15.7):

| Klasse | Angriff | Gegenmaßnahme |
|---|---|---|
| **Input** | Prompt-Injection, Jailbreak | §15.4 Red-Teaming · untrusted-input §15.8 · Lethal-Trifecta-Gate §33.1 |
| **Output** | Halluzination, unsicherer Code | §15.8 Hybrid-Validierung · §33.5 Gates |
| **Model** | Model-Stealing, Model-Inversion | API-Rate-Limit/Auth · Output-Monitoring · keine internen Modelldetails preisgeben |
| **Dataset** | Data-Poisoning, Training-Data-Extraktion | Training-Data-Provenance · RAG-Quellen auf Zugriffsrechte prüfen |

### 33.7 Doppel-Review + Lizenz/IP für KI-Code

**Doppel-Review (Pflicht bei KI-Anteil):** (1) **Self-Review vor Commit** durch den KI-nutzenden Dev — Vorschlag verstehen, hinterfragen, refactorn; (2) **dann** regulärer PR-Review durch einen zweiten Menschen. So wird KI-Code von zwei Personen geprüft (KI-Code = Junior-Beitrag, prüfpflichtig; nur ~3 % der Profis übernehmen KI-Output ungeprüft).

**Lizenz/IP:** Public-Code-Filter aktiv halten (z. B. Copilot); Vorsicht bei großen, zusammenhängenden, kaum angepassten KI-Blöcken (z. B. Algorithmen) — Copy-Left/GPL-Risiko. Triviale Snippets/Standard-Patterns sind i. d. R. unkritisch.

### 33.8 Prinzipien-Pointer, Scope-Abgrenzung, Compliance-Cross-Ref

- **Zero-Trust** (Prinzip): keine Komponente implizit vertrauen, jeden Zugriff authentifizieren, least privilege, Mikrosegmentierung — für Service-zu-Service **und** Agent-zu-Tool.
- **IaC-Security** (Pointer): KI-generiertes IaC durchläuft die §33.5-Gates; zusätzlich IaC-Scanner (Checkov/tfsec) gegen Misconfiguration/Drift.
- **Außerhalb Build-Zeit-Scope** (→ Wiki, nicht Doktrin, §1.7): Incident-Response/Runbooks, Kubernetes-RBAC-Detail, Security-Awareness/Gamification, OWASP-SAMM-Org-Reifegrad.
- **Regulatorische Compliance:** EU-AI-Act-Risikoklasse + Hochrisiko-Pflichten → §2.6. CRA/NIS2 sowie die Hochrisiko-Detailpflichten (Konformitätsbewertung, EU-DB-Registrierung, FRIA, Post-Market-Monitoring, Log-Aufbewahrung) sind ein eigener Compliance-Strang — Cross-Ref, hier nicht ausgewalzt.

---

# Teil 4 — Konzept-Doktrin (Authoring)

Wie ein Konzept geschrieben und reviewt wird. Pflicht-Struktur, UC-Aufbau, Review (Shift-Left), KI-Grenzen, Glossar. *(Die Prompt-Pattern zum Konzept-Lebenszyklus stehen in Anhang A; zwei vollständig durchgerechnete Beispiel-UCs in Anhang B.)*

## 2. Pflicht-Struktur eines Konzepts

Jedes Konzept muss diese Abschnitte enthalten, in dieser Reihenfolge: §2.1 Kopf, §2.2 Inhaltsverzeichnis, §2.3 Rollen-Übersicht, §2.4 Use Cases, §2.5 Technische Anhänge, plus §2.6 (Probabilistik-Statement) und §2.7 (Vendor-Risiko-Statement) bei LLM-UCs.

### 2.1 Kopf

```markdown
# {Projektname} – Anwender-Konzept

**Version:** X.Y
**Stand:** {Monat Jahr}
**Scope:** {1–3 Sätze: Was macht dieses System? Für wen? Welche Grenzen hat es?}
```

**Scope-Regel:** Der Scope beschreibt auch explizit, was das System **nicht** tut. Das verhindert Scope-Creep. Beispiel: *„Symfony Bundle für Datei-Upload, Verwaltung, Varianten-Generierung, Zugriffsschutz und Storage-Adapter. **Nicht enthalten:** Bildbearbeitung, OCR, Viren-Quarantäne."*

### 2.2 Inhaltsverzeichnis

Nummerierte Liste aller UCs mit Anchor-Links. Gruppiert nach thematischen Blöcken, wenn > 10 UCs vorhanden.

### 2.3 Rollen-Übersicht

Tabelle aller Akteure **bevor** die UCs beginnen. Jede Rolle braucht: technischen Namen (für Code), Scope (Global / Ressource-gebunden), Beschreibung in einem Satz, typische reale Person.

```markdown
| Rolle | Scope | Beschreibung | Typische Person |
|-------|-------|-------------|-----------------|
| `Admin` | Global | Vollzugriff + Konfiguration | IT-Verantwortlicher |
| `Sachbearbeiter` | Global | Tagesgeschäft | Bürokraft |
```

**Regel:** Rollen in Backticks → direkt als Code verwendbar.

### 2.4 Use Cases (Hauptteil)

```markdown
## UC-{Nr.}: {Verb + Objekt}

**Akteur:** {Rolle(n)}
**Route:** `{/pfad}` (optional: API: `METHOD /api/...`)

### {Kontextabschnitt}
...

### Fehlerfälle / Sonderfälle
...
```

Detaillierter Aufbau siehe §3.

### 2.5 Technische Anhänge

Am Ende des Dokuments, nach allen UCs: Entitäten-Übersicht (Tabelle: Entity, Tabelle, Beschreibung) · Status-Lifecycles (ASCII) · Mercure-Topics (wenn Echtzeit) · API Platform Endpunkte (wenn API) · Externe Abhängigkeiten (Libraries, Dienste).

### 2.6 Probabilistik-Statement im Kopf

Falls das System LLM-Komponenten enthält, ist im Kopf-Abschnitt ein **Probabilistik-Statement** Pflicht (Prinzip §1.5):

```markdown
## Probabilistik-Statement

Dieses System nutzt LLM-Komponenten in den UCs: {Liste}.

| UC | Toleranz-Schwelle | Validierungsstrategie | Fallback | EU-AI-Act-Risiko-Klasse |
|---|---|---|---|---|
| UC-XX | 95 % Korrektheit | LLM-as-Judge + Schema-Validation | Eskalation an Sachbearbeiter | begrenzt |
| UC-YY | 70 % Korrektheit | Schema + Substring-Match | Default-Antwort | minimal |
| UC-ZZ | n/a (deterministisch + Senior-Sign-off) | LSP/AST + Senior-Review | manueller Eingriff | **hoch** (Personalentscheidung) |

Sicherheitskritische UCs ohne LLM: {Liste}.
```

**Bei Hochrisiko-UCs zusätzlich Pflicht (EU AI Act):** Data Governance dokumentiert · Logging aller LLM-Calls + menschlicher Validierungs-Schritte · Human Oversight als expliziter UC-Schritt · Robustheits-/Genauigkeits-Tests · Transparenz-Pflicht (User weiß, dass KI involviert ist) bei begrenzt + hoch. **Provider-/Deployer-Pflichten vor Inverkehrbringen:** Konformitätsbewertung · Registrierung in der EU-Datenbank · Qualitätsmanagementsystem · Post-Market-Monitoring · **FRIA** (Grundrechte-Folgenabschätzung, wo gefordert) · automatisierte Log-Aufbewahrung **≥ 6 Monate**.

**Über den EU AI Act hinaus** (für Produkte mit digitalen Elementen, eigener Compliance-Strang — vgl. §33.8): **CRA** (Cyber Resilience Act — Schwachstellenmanagement-Pflicht ab Inverkehrbringen) und **NIS2** (Art. 21, inkl. Lieferketten-Risikobewertung). Bei personenbezogenen Hochrisiko-UCs zusätzlich **DSK-Maßnahmen**: Intervenierbarkeit/Machine-Unlearning, Adversarial-Input-Filter, Schutz vor Model-Stealing, RAG-Quellen-Zugriffsrechte prüfen.

**Sicherheitskritische Entscheidungen bleiben deterministisch (§13.3)** — Eintrag „n/a (deterministisch + Senior-Sign-off)", nicht als probabilistischer LLM-UC.

**Risiko-Klassen-Skala (EU AI Act):** **Inakzeptabel** — verboten (z. B. Social Scoring durch Behörden), darf nicht implementiert werden · **Hoch** — strenge Pflichten (Data Governance, Logging, Human Oversight, Robustheit); z. B. medizinische Diagnostik, Personalentscheidungen · **Begrenzt** — Transparenz-Pflicht; z. B. Chatbots, Deepfakes · **Minimal** — keine Zusatzpflichten; z. B. Spam-Filter, Spiele-KI.

**Rechtsgrundlage + Zeitplan (inline, Stand Mai 2026):** Verordnung (EU) 2024/1689 („KI-VO" / EU AI Act), in Kraft seit August 2024, gestaffelte Anwendbarkeit:
- seit **Feb 2025**: Verbot inakzeptabler Praktiken + KI-Kompetenzpflicht
- seit **Aug 2025**: Pflichten für General-Purpose-AI-Modelle (GPAI)
- ab **Aug 2026**: Transparenzpflichten; Governance-Strukturen für Hochrisiko nach Anhang III müssen stehen
- ab **2. Dez 2027**: volle Hochrisiko-Pflichten für eigenständige Anhang-III-Systeme (biometrische Systeme, Personalauswahl, Bildung, Kreditwürdigkeit)
- ab **2. Aug 2028**: Hochrisiko-Pflichten für in regulierte Produkte eingebettete KI nach Anhang I

Die Verschiebung der Anhang-III/I-Fristen erfolgte durch den **Digital-Omnibus vom 7. Mai 2026**. Im Konzept bei Hochrisiko-UC: einschlägige Frist + Anhang-Zuordnung (III vs. I) explizit nennen.

### 2.7 Vendor-Risiko-Statement (Pflicht bei LLM-UCs)

```markdown
## Vendor-Risiko-Statement

| UC | Provider | Modell | Migrations-Strategie | Daten-Souveränität |
|---|---|---|---|---|
| UC-XX | Anthropic | claude-opus-4-7 | Spring AI Adapter (Provider-Wechsel über Config) | PII-Anonymisierung via Presidio vor Send |
| UC-YY | lokal (Ollama) | llama-3.1-70b | self-hosted, kein Vendor | volle Souveränität |
```

**Pflicht-Schwelle:** bei **jedem** LLM-UC (auch lokal/PoC). Sobald irgendein LLM im Spiel ist, muss transparent sein: welcher Provider, wie ein Wechsel funktioniert (Spring AI / LangChain / Model-Layer-Abstraktion), wo die Daten verlaufen (PII vor Send anonymisiert? Self-Hosting-Fallback?). Nur bei rein deterministischen Konzepten **ohne** LLM-UC entfällt §2.7.

---

## 3. UC-Struktur im Detail

### Pflichtfelder je UC

| Element | Pflicht | Beschreibung |
|---------|---------|-------------|
| Akteur | Ja | Wer löst diesen UC aus? |
| Route | Ja | HTTP-Pfad. Bei rein systemischen UCs: „System (automatisch)" |
| Formularfelder | Bedingt | Wenn Nutzereingaben vorhanden |
| Verhalten / Ablauf | Ja | Was passiert Schritt für Schritt — **nummeriert** |
| Fehlerfälle | Ja | Mindestens die wahrscheinlichsten 2–3 |

### 3.0 Ablauf-Nummerierung

Ablaufschritte im Verhalten-Abschnitt **immer nummerieren** (Aktogramm-Prinzip). Ermöglicht präzise KI-Prompts: „Implementiere Schritt 3.2 aus UC-05."

```markdown
### Verhalten

1. Nutzer klickt „Speichern"
2. Validierung der Pflichtfelder
   2.1 E-Mail-Format prüfen
   2.2 Passwörter auf Übereinstimmung prüfen
   2.3 Benutzername auf Eindeutigkeit prüfen (DB-Query)
3. Bei Validierungsfehler: Fehlermeldung inline, Formular bleibt offen
4. Bei Erfolg: Datensatz speichern, Bestätigungs-E-Mail senden (async)
5. Redirect → `/dashboard?registered=1`
```

**Warum Nummern wichtig sind:** KI kann gezielt auf Schritt X.Y verwiesen werden · Änderungsverfolgung · sprachliche Referenzen in anderen UCs · Testfälle verweisen direkt auf Schrittnummern.

### Optionale Elemente (situationsabhängig)

| Element | Wann |
|---------|------|
| Status-Lifecycle | Wenn Objekt einen Status hat |
| Validierungsregeln | Wenn Felder komplexe Regeln haben |
| Rate-Limits | Wenn Missbrauch möglich ist |
| Sicherheitsregeln | Wenn Auth/Datenschutz betroffen |
| Sonderfälle | Wenn Standardpfad Ausnahmen hat |
| Manuelles Äquivalent | Wenn technisch komplex und nicht intuitiv |

### 3.1 Formularfelder-Tabelle

```markdown
| Feld | Typ | Pflicht | Hinweis |
|------|-----|---------|---------|
| Name | Text | Ja | max. 200 Zeichen |
| Status | Auswahl | Ja | `aktiv` / `inaktiv` / `archiviert` |
| Datei | Datei | Nein | PDF, max. 10 MB |
```

**Typen-Vokabular:** `Text`, `Textarea`, `Rich-Text`, `E-Mail`, `Tel`, `URL`, `Zahl`, `EUR`, `Datum`, `Datetime`, `Auswahl`, `Multi-Auswahl`, `Tag-Input`, `Toggle`, `Checkbox`, `Datei`, `Bild-Upload`, `Passwort`, `Signatur-Pad`, `User-Auswahl`, `Adresse`.
**Pflicht-Werte:** `Ja` · `Nein` · `Bed.` (bedingt, Bedingung im Hinweis) · `Konfig.` (abhängig von Systemkonfiguration).

### 3.2 Fehlerfälle-Tabelle

Immer als Tabelle, nie als Fließtext.

```markdown
### Fehlerfälle

| Fall | Meldung / Verhalten |
|------|---------------------|
| E-Mail bereits registriert | „Für diese E-Mail existiert bereits ein Konto." + Link zu /reset-password |
| Datei zu groß | „Maximale Dateigröße: X MB." |
| Keine Berechtigung | 403 Forbidden |
```

**Fehlerfälle-Checkliste:** Eingabe-Validierungsfehler · Duplikate / Konflikte · Nicht gefunden (404) · Keine Berechtigung (403) · Externe Dienste nicht erreichbar · Rate-Limit erreicht · Status-Konflikte.

### 3.3 Status-Lifecycle

Immer als ASCII-Diagramm. **Regel:** Jeder Status braucht mindestens einen eingehenden und einen ausgehenden Übergang (außer Start- und Endstatus).

```markdown
Neu → In Bearbeitung → Angebot erstellt → Gewonnen
                                        └→ Verloren
                                        └→ Kein Bedarf
```

### 3.4 Manuelles Äquivalent

Für technisch komplexe oder nicht intuitive Konzepte (Bundles, KI-Systeme, Batch-Prozesse). Zweck: KI und Entwickler verstehen sofort den Kontext ohne Domain-Vorwissen. Ablaufschritte nummeriert.

**Hinweis:** User-Stories sind eine konkrete Ableitung aus UC + AC und gehören in den Slice-Brief (§28.3), nicht ins Konzept-UC. UC = abstrakte Ebene; AC = Akzeptanzkriterium (§11.7); User-Story = Konkretisierung. Vokabular siehe §14 Glossar.

---

## 4. Klassifizierung von UCs nach Akteur

| Kategorie | Typische Route | Beschreibung |
|-----------|---------------|-------------|
| **Nutzer-UC** | `/feature/...` | Selbstbedienung durch eingeloggten User |
| **Sachbearbeiter-UC** | `/manage/...` oder im Haupt-UI | Tagesgeschäft, Datenpflege |
| **Admin-UC** | `/admin/...` | Konfiguration, Benutzerverwaltung |
| **System-UC** | Kein HTTP | Automatisch, Cron, Messenger, Events |
| **CLI-UC** | `bin/console ...` | Manuelle oder geplante Kommandos |

**Route-Konvention:** Nutzer-Bereich `/profile/...`, `/garage/...`; Sachbearbeiter direkt ohne Prefix (`/contacts`, `/projects`); Admin unter `/admin/...`; API Platform unter `/api/...`.

## 5. Entitäten-Übersicht

Pflicht am Ende jedes Konzepts (Tabelle: Entity, Tabelle, Beschreibung).

**Tabellennamens-Konvention je Projekt:** Bundle (wiederverwendbar) → `{bundle}_`-Präfix (`notif_notifications`, `media_files`); App (projektspezifisch) → kein Präfix (`contacts`, `projects`); Add-on-Modul → `{modul}_`-Präfix. Präfixe verhindern Tabellenkonflikte bei mehreren Bundles in einer App.

## 6. Versionierung von Konzepten

| Version | Bedeutung |
|---------|-----------|
| 1.0 | Erstes vollständiges Konzept |
| 1.x | Ergänzungen, neue UCs, keine Breaking Changes |
| 2.0 | Strukturelle Überarbeitung, geänderte UCs |

**Changelog-Abschnitt** ab v2.0 Pflicht (Liste der Änderungen zur Vorversion).

## 7. Checkliste vor Fertigstellung

**Basis-Checkliste:**
- [ ] Alle UCs haben nummerierte Schritte
- [ ] Alle Pflicht-Felder belegt
- [ ] Fehlerfälle-Tabellen vollständig
- [ ] Status-Lifecycle-Diagramme vorhanden
- [ ] Rollen-Übersicht aktuell
- [ ] Probabilistik-Statement im Kopf (falls LLM-UCs, §2.6)
- [ ] Akzeptanzkriterien-Tabelle pro UC (§11.7)
- [ ] Glossar gepflegt (§14)
- [ ] Changelog-Eintrag
- [ ] Sachbearbeiter-Test bestanden (§1.1)
- [ ] Keine offenen Annahmen — Unklarheiten + offene Entscheidungen im Dialog geklärt, nicht geraten (§1.9)

**Erweiterung bei Implementation-Plan-Anteil** (Modus A/B/C/D/E nach §29):
- [ ] CONTEXT.md vorhanden oder angelegt (§28.1)
- [ ] ADRs im Touch-Bereich gelesen; bei Konflikt ADR-Update vorgesehen (§1.8 + §27.6)
- [ ] Slice-Plan mit HITL/AFK-Markierung und Dependencies (§27.2 + §28.3)
- [ ] AC-Tabelle pro UC pro Slice (§11.7 + §27.4)
- [ ] Bei Brownfield: Deletion-Test-Begründung pro neuem Modul (§27.1)
- [ ] Bei Review/Teardown: Output-Schema aus §29 Modus C erfüllt (C.1 oder C.2)
- [ ] Bei LLM-UC: Hybrid-Validierungs-Schichten + Phasen Pre/Inline/Post (§13.2 + §15.8)
- [ ] Bei Hochrisiko-EU-AI-Act-UC: Data Governance + Logging + Human Oversight + Robustheits-Tests (§2.6)
- [ ] Vendor-Risiko-Statement vorhanden bei LLM-UC (§2.7)
- [ ] Validierungs-Mindset-Niveau in Verantwortungs-Matrix (§23.1)

**Erweiterung bei Agent-/Tool-/Security-Anteil (Teil 3):**
- [ ] Threat-Modeling-„light" durchgeführt; Bedrohungsliste + Gegenmaßnahmen-AC im Konzept (§33.4)
- [ ] Lethal-Trifecta-Achsen pro Agent-/Tool-UC ausgewiesen + Gegenmaßnahme (§33.1/§33.2)
- [ ] Pro MCP-Server: Trust-Source, Tool-Autorisierung, Isolation, Spec-Version (§33.3)
- [ ] Security-Gates (SAST · Dependency-Scan+SBOM · Secret-Scan) als Build-Blocker aktiv (§33.5)
- [ ] LLM-Bedrohungsklassen pro LLM-UC ausgewiesen (§33.6)
- [ ] Doppel-Review (Self vor Commit + PR) + Public-Code-Filter (§33.7)

> Die Anti-Pattern-Prüfliste für das Review steht in **§25** (Teil 6).

---

## 10. KI-Review des Konzepts (Shift Left)

### 10.1 Shift-Left-Prinzip

Das Konzept selbst wird durch KI geprüft — **bevor** eine einzige Code-Zeile geschrieben wird. Die Fehlererkennung verschiebt sich nach vorn; die KI übernimmt die stumpfe Fleißarbeit der Konsistenzprüfung (Provenienz: Bartels 2026). Das ist günstiger als Fehler in der Implementierung zu finden.

### 10.2 Was KI im Konzept prüft

| Prüfkategorie | Beispiel-Fehler |
|---------------|----------------|
| Logischer Widerspruch | Schritt 3 setzt Status X voraus, Schritt 1 setzt aber Y |
| Schnittstellen-Lücke | UC-05 referenziert Feld `customer_id`, aber UC-01 legt es nicht an |
| Fehlende Ausnahme-Behandlung | Ablauf beschreibt keinen Fall für negativen Zahlenwert |
| Prosalogik | „je nach Situation" ohne Definition der Situationen |
| Datentyp-Konflikt | Feld als `Text` beschrieben, aber Rechenoperation impliziert `Zahl` |
| Architektur-Verstoß | UC beschreibt UI-Logik im Backend-Service |

### 10.3 Review-Zyklus

```
Konzept-Entwurf → KI-Review (Score + Lückenliste)
  → Entwickler entscheidet: beheben oder „Won't Fix" → Nächster Review-Lauf
  → Score ≥ 8/10 → implementierungsreif
```

**Interview-Modus statt statischer Lückenliste (Provenienz: Bartels):** Der Review-Agent arbeitet stärker, wenn er **eine** Lücke findet, **eine** gezielte Rückfrage stellt, die Antwort entgegennimmt und die Korrektur direkt ins strukturierte Dokument einwebt — dann erst die nächste Runde (analog dem initialen Spec-Interview, Anhang A.3).

**Strukturierter Input schlägt Prosa:** Ein Review-/Verifikations-Agent liefert deutlich bessere Ergebnisse, wenn die Spec als **maschinenlesbarer Baum** (nummerierte Schritte, Verzweigungen, Fehlerfälle — §3.0) statt als Fließtext vorliegt. Die §3-Struktur ist damit nicht nur menschen-, sondern agent-optimal.

### 10.4 Score als Diskussionsgrundlage

Der Score ist kein absoluter Qualitätswert, sondern eine Diskussionsgrundlage. Ein bewusst akzeptiertes Risiko (z. B. spätere I18N-Migration) darf als „Known Issue" markiert werden.

### 10.5 Verzeichnis-Konvention für Review-Agenten

```
.github/
├── agents/
│   └── uc-review.agent.md            # Persona — kritischer Software-Architekt
├── ai/
│   ├── glossar.md                    # Domain-Model + semantische Anker
│   ├── architektur-regeln.md         # Querschnittskonventionen
│   └── decision-policies/
│       ├── implementation-clarity.policy.md   # 70 % Gewicht
│       └── integration-clarity.policy.md
```

Persona definiert die Review-Rolle (kritischer Architekt, scort UCs gegen die Policies, schlägt keine Implementation vor, nutzt das Glossar). Policies sind gewichtet und definieren Pass/Fail (z. B. „A UC is implementation-ready when: all flow steps numbered, all field types include unit + range, all branches as explicit numbered steps, no ‚etc.'-prose, all exception classes named. Score 1–10 per UC, < 8 = blocked.").

> Verifikationsagent (§10.6), Verifikations-Konvention (§10.7) und Modell↔API-Check (§19) stehen in **Teil 2** — sie gehören zum Arbeitsweg.

---

## 11. KI-Grenzen beim Konzept-Einsatz

KI glänzt bei Boilerplate, Prototypen, Erklärungen und kleinen, in sich geschlossenen Modulen; bei reifen Codebasen mit speziellen Konventionen sinkt ihre Nützlichkeit rapide (Provenienz: Mahringer 2026).

### 11.1 Wann KI beim Konzept gut hilft

Initiales Gerüst (Struktur, UCs) aus kurzer Beschreibung · fehlende UCs identifizieren (Review) · Fehlerfälle ergänzen · Datentypen und Validierungsregeln vorschlagen · Entitäten-Modell aus UC-Beschreibungen ableiten · Formulierungen präzisieren.

### 11.2 Wann menschliche Kontrolle Pflicht ist

| Bereich | Warum KI nicht ausreicht |
|---------|--------------------------|
| Fachliche Korrektheit | KI kennt die Domäne nicht — Sachbearbeiter muss bestätigen |
| Regulatorische Anforderungen | Gesetzestexte müssen direkt referenziert werden |
| Sicherheitskritische Logik | Wahrscheinlichkeitsbasierte Generierung + Sicherheit = Risiko |
| Architektur-Entscheidungen | KI schlägt vor, Architekt entscheidet |
| Geschäftsregeln mit Ausnahmen | KI lässt Randwerte und Sonderfälle weg |

### 11.3 Cognitive Offloading vermeiden (inkl. konkrete Eindämmung)

Der Entwickler darf nicht zum „externen Speichercontroller des Assistenten" werden (Provenienz: Mahringer 2026). Das Konzept muss vom Entwickler selbst verstanden werden — nicht nur von der KI. Wer das Konzept nicht erklären kann, hat KI-Output ohne Verständnis; das führt zu Fehlern, die niemand mehr findet. **Gegenmaßnahme:** nach KI-generiertem Konzept-Entwurf immer ein manueller Walk-Through (§23.2). Konkrete Übungen:

| Übung | Frequenz | Ziel |
|---|---|---|
| UC laut vorlesen + erklären | pro UC, einmalig | Verstehen prüfen |
| 1 UC pro Woche „aus dem Kopf" beschreiben | wöchentlich | Wissen rekonstruieren |
| Rückfragen-Logbuch führen | je Sprint | Wo war das Konzept unklar? |
| KI-generierten Vorschlag „defenden" können | bei jeder Übernahme | Verantwortung kann nicht delegiert werden |

*(v5: §11.6 „Cognitive Offloading konkret eindämmen" ist hier eingefaltet — gleiche Lehre.)*

### 11.4 Vier-Superkräfte-Register als Mensch-Anker — Sycophancy bei Decide

| Superkraft | Beschreibung | Im Konzept ausweisen wo? |
|---|---|---|
| **Communicate** | Stakeholder-Workshops, Domain Storytelling, Event Storming | Akteure-Liste + Prozess-Notiz |
| **Decide** | Architektur- + Strategie-Entscheidungen. KI-Vorschläge tendieren zur Bestätigung (Sycophancy, Kruse 2026) — Decide verlangt aktives Widerlegen, nicht passives Annehmen. Pflicht-Devil's-Advocate-Pass oder zweites Modell als Gegenvotum. | Decision-Records mit menschlichem Approver |
| **Adapt** | Kursänderung bei neuer Erkenntnis | Versionshistorie + Changelog |
| **Make Mistakes** | Lernen aus Fehlern → bessere Entscheidung beim nächsten Mal | Lessons-Learned-Register / Retro-ADR |

**Review-Korollar (🔴-Slices):** Bei riskanten Pipeline-/Architektur-Slices zählen **Self-Review und ein nur bestätigender „Pro"-Agent nicht als Review**. Verbindlich ist der **gegnerische Auditor** (`adversarial-review`) plus eine **empirische Gegenprobe gegen das echte Target** (exaktes Repo/Checkout/Container). Grüne Tests + Self-Audit + Pro-Agent teilen in der Praxis denselben blinden Fleck (Sycophancy) — nur der Auditor fand den latenten Datenverlust-Pfad, und nur die ausführbare Gegenprobe (`php -r` gegen reales PHP) deckte eine falsche, vom Reviewer mit-bestätigte Semantik-Annahme auf.

### 11.5 KI-Tests sind oft auf den Code zugeschnitten (Anti-Pattern)

KI generiert gerne Testfälle, die dem Code angepasst sind — dadurch verlieren Tests einen Teil ihres Nutzens (Provenienz: Fondermann 2026). Im Konzept regeln:
- Test-Cases werden **vor** der Implementierung aus dem UC abgeleitet (TDD-Spirit)
- KI-generierte Tests MÜSSEN an UC-Schritten + Fehlerfälle-Tabelle orientiert sein, nicht am Code
- Pflicht: jeder UC hat Test-Cases pro Fehlerfall + pro Status-Übergang
- KI-generierte Tests werden manuell auf „passt zur Spec, nicht zum Code" geprüft

### 11.7 TDD-First — Test-Cases im Konzept BEVOR Implementation

Verschärfung von §11.5: Test-Cases gehören **ins Konzept-Dokument selbst**. Reihenfolge nicht verhandelbar:
1. **Test-Cases ableiten** aus UC-Spec (Akzeptanzkriterien + Fehlerfälle-Tabelle + Status-Übergänge)
2. **Test-Cases ins Konzept schreiben** als Akzeptanzkriterien-Tabelle pro UC
3. **Tests implementieren** (Unit + Integration), grün/rot dokumentieren
4. **Implementation startet erst danach**

> **Bridge zu §27.4:** §11.7 sagt **was** im Konzept stehen muss (AC-Tabelle). §27.4 sagt **wie** diese AC in der Implementation als Vertical-TDD-Loop gefahren werden (ein Test → eine Impl → wiederholen, niemals Horizontal-TDD).

#### Pflicht-Sektion pro UC: Akzeptanzkriterien als Test-Cases

```markdown
### Akzeptanzkriterien (Test-First)

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-1 | Eingeloggter User mit Rolle X kann UC ausführen | Integration | UCXxxControllerTest::testHappyPath | rot |
| AC-2 | Anonymer Besucher bekommt 401 | Integration | UCXxxControllerTest::testAnonymousDenied | rot |
| AC-3 | Status-Übergang Pending → Active nur durch Admin | Unit | UCXxxStateProcessorTest::testStatusGuard | rot |
| AC-4 | Bei IBAN ungültig → Form-Error inline | Integration | UCXxxFormTest::testIbanValidation | rot |
```

**Warum TDD-First:** Spec-Lücken werden früh sichtbar (wer einen Test-Case nicht formulieren kann, hat den UC nicht verstanden) · KI-generierte Tests bleiben spec-konform · Implementation-Prompt wird präziser · Refactoring-Sicherheit.

**Pflicht-Granularität pro UC** (ergänzt §7): mind. ein AC pro Erfolgs-Pfad · ein AC pro Fehlerfall · ein AC pro Status-Übergang · ein AC pro Sicherheits-Constraint (Owner / Tenant / Rolle) · Test-Klasse-Namen benannt (auch wenn die Klasse noch nicht existiert).

---

## 14. Glossar-Sektion (Pflicht für KI-gestützte Entwicklung)

Semantische Anker sind Begriffe, die im Merkmalsraum des LLMs eine starke, präzise Definition triggern — statt 200 Zeilen zu erklären, schreibt man „TDD, London School" (Provenienz: Müller 2026). Jedes Konzept ab mittlerer Komplexität braucht am Ende eine **Glossar-Sektion** als Prompt-Shortcut: statt vollen Kontext bei jeder KI-Anfrage mitzugeben, reicht ein Verweis auf den Glossar-Begriff.

```markdown
## Glossar

| Begriff | Definition | Semantischer Anker |
|---------|-----------|-------------------|
| `SiPo` | Sicherungsposten gem. DGUV Vorschrift 78 | DGUV V78, Gleisbau, Bahnbetrieb |
| `ClubOfficer` | BGB-Vorstand eines eingetragenen Vereins (§26 BGB) | Vereinsrecht, Vertretungsbefugnis |
| `Aktogramm` | Weiterentwicklung des Struktogramms für Use-Case-Spezifikationen | Specman, Nassi-Shneiderman |
```

**Wann Pflicht:** domänenspezifische Fachbegriffe · mehrere Akteure mit unterschiedlichem Fachvokabular · regulatorische Abkürzungen · KI-Komponenten vorhanden (Glossar wird Teil des System-Prompts). **Semantischer Anker = 2–4 Stichworte**, die das LLM mit dem Begriff assoziiert.

**Pflicht-Eintrag „User-Story":** Konkrete Ableitung aus UC + AC im Format „Als <Akteur> möchte ich <Feature>, damit <Benefit>". Kein Pflicht-Element von §3 (UCs) — eine Konkretisierungs-Stufe zwischen UC und Implementation, im Slice-Brief (§28.3) dokumentiert. **Bridge:** UC → AC → User-Story → Slice. Das Domain-Glossar ist nicht-verhandelbares Vokabular bei jeder Brownfield-Erweiterung (§27.6): Test-Namen, Interface-Vokabular und PRD-Begriffe werden aus dem Glossar gespeist.

---

## 17. Integration in Versionierung und Tooling

Das Konzept ist kein freistehendes Dokument, sondern Teil der Repo-Toolchain. Pflicht-Integrationspunkte:

| Integrationspunkt | Konvention |
|---|---|
| **Versionierung** | Konzept-Datei liegt im Repo (`docs/` oder `wiki/`), wird mit-committet. Changelog ab v2.0 (§6), Version im Kopf (§2.1). |
| **Review-Agent** | `.github/agents/` bzw. `.claude/agents/` enthält die Review-Persona; Policies unter `decision-policies/` mit Gewichtung (§10.5). CI kann den Review-Agent gegen geänderte Konzept-Dateien laufen lassen. |
| **Verifikationsagent** | Nach jedem Sprint Spec↔Code-Drift prüfen (§10.6) — Konzept ist die `Soll`-Quelle. |
| **Glossar als System-Prompt** | Das Glossar (§14) wird in den System-Prompt der KI-Assistenten gespeist; semantische Anker reduzieren Prompt-Länge. |
| **Konsistenzcheck Modell↔API** | Pro Sprint-Ende per versioniertem Prompt (§19 + Anhang A.6). |
| **Durable Plan-Artefakte** | CONTEXT.md + ADRs leben neben dem Konzept im Repo (§28) und sind die SSOT bei Brownfield (§1.8). |

---

## 23. Mensch-Verantwortungs-Klausel + Walk-Through-Pflicht

*(Gilt für alle Konzepte, LLM wie deterministisch — darum in Teil 4 (Authoring), nicht im überspringbaren Teil 5. Die Verantwortungs-Matrix greift bei KI-Anteil am schärfsten, ist aber auch bei deterministischen UCs Pflicht.)*

### 23.1 Pflicht-Section am Konzept-Ende: Verantwortungs-Matrix

```markdown
## Verantwortungs-Matrix

| UC | KI-Anteil | Mensch-Validator | Validierungs-Mindset-Niveau | Haftung im Schadensfall |
|---|---|---|---|---|
| UC-01 | 80 % | Sachbearbeiter (Pflicht-Bestätigung) | hoch (aktive Validierung Pflicht) | Sachbearbeiter |
| UC-02 | 30 % | Entwickler (Code-Review) | mittel (Sign-off durch Senior-Niveau-Validator) | Entwickler |
| UC-03 | 0 % | — | n/a (deterministisch) | Systemverantwortlicher |
```

**Validierungs-Mindset-Niveau:** **hoch** (aktive, kritische, hinterfragende Validierung; KI-Output > 50 % verlangt Hoch-Niveau-Validierung oder Sign-off) · **mittel** (strukturierte Validierung mit Checkliste/Pattern-Bezug; AC-Tabelle Punkt für Punkt) · **niedrig (passiv)** (Anti-Pattern §25 — nicht erlaubt bei KI-Anteil > 30 %).

**Pflicht-Regel:** KI-Output mit hohem KI-Anteil (> 50 %) **muss** Validierungs-Mindset-Niveau „hoch" durchlaufen — direkt oder via Sign-off. Das Niveau beschreibt die Validierungs-*Aktivität*, ist **nicht** an HR-Hierarchie (Junior/Senior) gebunden (Provenienz: Wilke/Loje/Krypczyk 2026).

### 23.2 Walk-Through-Pflicht (vor Sprint-Start)

Pro UC mindestens einmal: laut vorlesen · erklären können (ohne Konzept-Dokument vor Augen) · drei Test-Cases pro UC frei aus dem Kopf nennen · bei Lücken Konzept ergänzen, nicht implementieren.

---

# Teil 5 — LLM-/Agenten-Erweiterungen (nur bei LLM-UCs)

**Dieser Teil ist überspringbar, wenn kein UC ein LLM aufruft.** Er ergänzt die Konzept-Doktrin (Teil 4) um die Spezifika probabilistischer/agentischer UCs: Pflichtfelder, Agent-Struktur, Observability/Eval, MCP, Schichten-Architektur, TAO-Cycle, PoC-Pfad.

## 13. LLM-spezifische Konzept-Erweiterungen

### 13.1 Pflichtfelder für LLM-UCs

| Element | Beschreibung |
|---------|-------------|
| Kontext-Definition | Welche Daten werden als Kontext mitgegeben? (Dokumente, DB-Abfragen, History) |
| Ausgabe-Datenformat | Welchen Typ hat die LLM-Ausgabe? (Freitext, JSON-Schema, typisiertes Objekt) |
| Validierungsstrategie | Wie wird die Ausgabe geprüft? (Syntaktisch, semantisch, LLM-as-Judge) |
| Fallback-Verhalten | Was passiert, wenn das LLM eine unbrauchbare Antwort liefert? |
| Knowledge-Cutoff-Umgang | Welche Daten können veraltet sein? Wie wird Aktualität sichergestellt? |

### 13.2 Agentenbasierte UCs — Embabel-Pattern + Pre/Inline/Post-Phasen

Strukturierter, planungsbasierter Ansatz statt loser LLM-Aufruf-Kette (Provenienz: Baumgartner 2026):

```markdown
### Agent-Struktur (Embabel-Pattern)

**Goal:** {Was soll der Agent erreichen?}

**Actions:** (jede Action ist eine deterministische Methode + optional ein LLM-Call im Deep Path)
- `{ActionName}`: Input-Typ, Output-Typ

**Conditions:** (typgebunden — Vorbedingungen für eine Action)
- {Action `X` ist möglich, wenn der bisherige Output vom Typ `Y` ist}

**Output-Typen:** (sealed interface zwingend für Planer)

```java
public sealed interface Signals permits SignalsOk, SignalsNeedsDeep { }
public record SignalsOk(String text, boolean confident) implements Signals {}
public record SignalsNeedsDeep(String text, String reason) implements Signals {}
```

**Fast Path (deterministisch — ohne LLM):** {Heuristiken, Keyword-Match}
**Deep Path (LLM-gestützt):** {Wann wird LLM aktiviert? Bei welchen Conditions?}
**Goal-Oriented Action Planning:** Planer ermittelt zur Laufzeit, welche Actions in welcher Reihenfolge das Goal erreichen — basierend auf den verfügbaren Output-Typen.
**Unsicherheits-Schwellwert:** {Confidence < 0.5 → Eskalation an Mensch}
```

**Regel:** Wenn der Ablauf ohne LLM auch korrekt wäre, ist kein Agent nötig. Agenten sind für Entscheidungen unter Unsicherheit — nicht für deterministische CRUD-Logik.

#### Hybrid-Validierungs-Phasen (Pre/Inline/Post)

Embabel ist eine konkrete Implementierung. Generisch gilt: jeder LLM-Call hat drei mögliche Validierungs-Phasen, in denen deterministische Validierung neben probabilistischer LLM-Generierung steht — die Lösung liegt nicht in „mehr Modell", sondern in deterministischen Validierungsschichten obendrauf (Provenienz: Mahringer 2026):

| Phase | Wann | Beispiel-Validierung |
|---|---|---|
| **Pre** | vor LLM-Call | Input-Schema-Check, Token-Budget-Check (Memento-Effekt vorbeugen), Cache-Hit-Check, PII-Anonymisierung |
| **Inline** | während LLM-Call (Streaming) | Sealed-Interface-Match auf Token-Stream, Substring-Pflicht-Check, Toxicity-Filter inline, Fast/Deep-Path-Entscheidung |
| **Post** | nach LLM-Call | LSP/AST/CST-Parser, Automated Reasoning, CodeQL/SonarQube, Vertical-TDD-AC-Check (§15.8 + §27.4) |

Im Konzept pro LLM-UC: welche Phasen sind aktiv, welche konkreten Validierungen pro Phase?

> **Begriffs-Klarstellung „Phasen":** Diese Pre/Inline/Post-Validierungs-Phasen beziehen sich auf einen einzelnen LLM-Call (Mikro-Ebene). Sie sind NICHT die Workflow-/Implementierungs-Phasen — CDP5 ist bewusst **kein Phasen-Workflow** (Teil 0). Auch die PoC-Phasen in §22 (Makro-Ebene) sind eine dritte, eigene Bedeutung. Gleiches Wort, drei Ebenen — bei Verweisen immer Sektion mitnennen.

### 13.3 Wann KEIN LLM im UC

Vollständig deterministischer Ablauf · sicherheitsrelevante Entscheidungen · regulatorische Nachvollziehbarkeit Pflicht · hochregulierte Umgebung (Medizin, Finanzen, Bahn-Sicherheit). Im Konzept als Notiz: `> **Kein LLM:** Dieser UC ist deterministisch — keine KI-Komponente.`

### 13.4 Validierungsstrategie im Konzept (erweitert)

| Strategie | Wann | Beispiel-Tool / Assertion |
|---|---|---|
| Syntaktische Prüfung | Immer | JSON-Schema, Typ-Check, Sealed-Interface-Match |
| Regelbasierte Prüfung | Bei bekannten Constraints | Wert in erlaubtem Bereich |
| LLM-as-Judge | Bei semantischer Korrektheit | Promptfoo `llm-rubric`, `g-eval`, `factuality` |
| Substring-Match | Wenn Antwort einen Pflicht-Abschnitt enthalten muss | Promptfoo `icontains` |
| Relevanz | Bei RAG-Output | Promptfoo `relevance` |
| Human-in-the-Loop | Sicherheitskritisch | Sachbearbeiter bestätigt vor Ausführung |
| Red Teaming | Vor Production | Promptfoo `harmful:hate`, `jailbreak`-Strategie |

---

## 15. Observability-Anforderungen im Konzept

In KI-Systemen kommen Evaluation und Monitoring nicht zuletzt, sondern treiben den Build von Tag 1 (Provenienz: Köster 2026). Das klassische „drei Säulen"-Modell (Metriken / Traces / Logs) wird für KI-Systeme um eine **vierte Säule** ergänzt: **Evals (LLM-as-a-Judge)** — Teil der Entwicklungsschleife, nicht des Betriebs danach.

### 15.1 OpenTelemetry GenAI-Conventions

Pflicht-Attribute pro LLM-Span:

```json
{
  "gen_ai.request.model": "claude-opus-4-7",
  "gen_ai.system": "anthropic",
  "gen_ai.request.temperature": "0.8",
  "gen_ai.response.id": "...",
  "gen_ai.response.finish_reasons": ["stop"],
  "gen_ai.operation.name": "chat",
  "gen_ai.usage.input_tokens": "6938",
  "gen_ai.usage.output_tokens": "440",
  "gen_ai.usage.total_tokens": "6958",
  "gen_ai.response.model": "claude-opus-4-7"
}
```

**Sampling DEAKTIVIEREN** für LLM-Spans — jede Interaktion zählt für Eval und Drift-Erkennung.

### 15.2 Tracing-Stack (empfohlen)

| Bestandteil | Beispiel-Tool | Zweck |
|---|---|---|
| OTEL-Collector | OpenTelemetry-Collector | Span-Sammlung |
| Trace-Backend | **Langfuse** (OSS, OTEL-Empfänger) | LLM-Trace-Store |
| Eval-Tool | **Promptfoo** | Test + LLM-as-Judge + Red Teaming |
| Spring AI / LangChain | je nach Stack | automatische Trace-Anbindung |

### 15.3 LLM-as-a-Judge: vierte Eval-Säule

```yaml
tests:
  - vars:
      prompt: 'Wieviel Milch sollte ein 9 Tage altes Säugling pro Mahlzeit trinken …?'
    assert:
      - type: icontains
        value: 'Kapitel 33.4 Tagestrinkmenge'
      - type: llm-rubric
        value: |
          ensure that the output provides a specific amount of milk in milliliters
          and the number of meals per day
      - type: factuality
        value: 8-12 meals per day
```

### 15.4 Red Teaming als Pflicht-Eval-Schicht

```yaml
redteam:
  numTests: 10
  plugins:
    - harmful:hate
  strategies:
    - jailbreak
language: de
```

Im Konzept pro LLM-UC ausweisen: welche `harmful:*`-Plugins relevant sind, welche Strategien (`jailbreak`, etc.) getestet werden. Die Promptfoo-Eval-Suite (Red-Teaming + LLM-as-Judge, §15.3) läuft als **CI-Gate** (GitHub Action) — knapp halten, aber als harte Qualitätsschranke pro PR/Sprint.

### 15.5 Knowledge-Cutoff-Tests

Pflicht-Test: nach einem Produkt fragen, das **nach** dem Knowledge-Cutoff erschien (z. B. „iPhone 17"). Antwortet das Modell selbstbewusst → halluziniert. Im Konzept ausweisen, wie das Modell Knowledge-Cutoff-Limits dem Nutzer kommuniziert.

### 15.6 PII / DSGVO im Trace

Vor Span-Export anonymisieren: **DataFog** (OSS) oder **Microsoft Presidio** als Pre-Processor. Im Konzept dokumentieren: welche Felder werden geschwärzt? Wer hat Zugriff auf Roh-Traces?

### 15.7 Testdaten-Strategie

Für LLM-UCs beschreiben, wie Testdaten erzeugt werden: **Personas** (Beschreibung, typische Anfragen, Erwartungen) · **Seed Queries** (typische Anfrage, Grenzfall, Missbrauchsversuch — erzeugen Entropie im Testset) · **Validierung** (Korrektheit via LLM-as-Judge + Fact-Checking; Sicherheit via Red Teaming gegen OWASP GenAI Top 10; Konsistenz: gleiche Anfrage 5× → Antworten vergleichen).

### 15.8 KI-Code als Untrusted Input + Hybrid-Validierungs-Schichten

LLM-Antworten sind als **„Untrusted Input"** zu behandeln und durch statische Analysetools zu prüfen; die Lösung liegt nicht in „mehr Modell", sondern in deterministischen Validierungsschichten obendrauf (Provenienz: Mahringer/Köster 2026):

| # | Schicht | Werkzeuge | Prüft |
|---|---|---|---|
| 1 | **Strukturelle Validierung** | Language Server Protocol (LSP), AST/CST-Parser | Syntax, Typen, Symbol-Resolution |
| 2 | **Logische Validierung** | Automated Reasoning Solver (z. B. Z3, Prolog-basiert) | Architektur-Regeln als Axiome |
| 3 | **Sicherheits-Validierung** | CodeQL, SonarQube, Semgrep | OWASP-Top-10, CVE-Patterns, Secrets-Scan |
| 4 | **Test-Validierung** | Vertical-TDD-Loop (§27.4) | Verhalten gegen AC-Tabelle des UC |

**Pflicht-Minimum:** Schicht 1 + 3. **Pflicht bei > 3 zusammenarbeitenden Modulen:** auch Schicht 2. **Pflicht bei jedem nicht-trivialen UC:** Schicht 4 (TDD-First, §11.7).

---

## 16. MCP-Integration im Konzept

### 16.1 MCP-Architektur

| Komponente | Aufgabe |
|---|---|
| **MCP-Host** | KI-Anwendung, verwaltet die Clients |
| **MCP-Client** | 1:1-Verbindung zum Server (im Host) |
| **MCP-Server** | Stellt Tools / Resources / Prompts bereit |
| **Transport** | Stdio (lokal) oder HTTP (remote) |

### 16.2 Drei Server-Capabilities

**Tools** (ausführbare Aktionen, z. B. „search_repo") · **Resources** (strukturierter Datenzugriff, z. B. `resource://logs`) · **Prompts** (vorbereitete Vorlagen).

### 16.3 Drei Client-Capabilities

| Capability | Beschreibung | Im Konzept relevant wenn |
|---|---|---|
| **Sampling** | Server delegiert LLM-Anfragen zurück an Client | Server soll selbst KI nutzen können |
| **Elicitation** | Server stellt Rückfragen | UC braucht interaktive Klarstellung |
| **Roots** | Server fragt zugängliche Verzeichnisse ab | File-System-Server-Konfiguration |

### 16.4 Lifecycle + JSON-RPC 2.0

Initialisierung als Handshake: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`. Client und Server handeln Protokoll-Version und Capabilities aus (z. B. `protocolVersion: "2025-06-18"`, Client-`capabilities: { elicitation: {} }` → Server antwortet mit `tools/resources/prompts`). Erst nach `notifications/initialized` sind `tools/list` / `tools/call` zulässig. Im Konzept: Protokoll-Version festlegen, ausgehandelte Capabilities dokumentieren.

### 16.5 OAuth-Empfehlung

Der MCP-Standard empfiehlt OAuth (Provenienz: Heinicke 2026). Im Konzept für jeden MCP-Server: ist OAuth aktiv? Wer hat Zugriff? Wie werden Tokens rotiert?

### 16.6 Warnung: zu viele Tools = schlechtere Antworten

Pro UC maximal 3–5 relevante Tools. **Context Rot** (zu großer Kontext → Effizienzverlust) ist real.

### 16.7 Multi-MCP-Server-Setup

Bei LLM-UCs mit mehreren MCP-Servern parallel (z. B. Figma + Drive + Calendar + Custom-Server) zusätzliche Pflicht-Felder im UC:

| Pflicht-Feld | Beschreibung |
|---|---|
| Tool-Namens-Konflikt-Auflösung | Pflicht-Präfix-Konvention (z. B. `figma__search` vs. `drive__search`) |
| Auth-Aggregation | Pro Server: OAuth-Scope + Token-Speicher + Rotations-Strategie |
| Tool-Budget | Maximal X Tools sichtbar für die LLM-Session (Context-Rot, §16.6) |
| Lifecycle-Reihenfolge | parallel-init vs. sequenziell — welche Server müssen verfügbar sein bevor der erste Tool-Call läuft? |

**Heuristik:** Bei > 3 MCP-Servern im UC ist eine **UC-spezifische Server-Selektions-Tabelle** Pflicht.

### 16.8 MCP-Server-/Tool-Design (wenn man selbst einen baut)

Baut man eigene MCP-Server/Tools (statt nur fremde zu konsumieren), gelten Design-Regeln. Sicherheit dazu → §33.3; ein deterministisch entscheidbares Tool gehört als T1-Programm gebaut → §32.9.

**Server-Maturity (Level 0–3) — nicht auf Level 0 stehenbleiben:**

| Level | Charakter |
|---|---|
| 0 | rohe 1:1-API-Spiegelung — schnell, aber fehleranfällig; **vermeiden** |
| 1 | Hinweise/Beschreibungen in den Tools |
| 2 | Domänenmodell + Workflow-Verständnis im Kontext — **Zielniveau** |
| 3 | selbst-verbessernde Hypermedia-Discovery |

**Tool-Design-Regeln (Provenienz: Anthropic „writing tools for agents"):**
- **Wenige, hochwirksame Tools** statt jeden API-Endpoint zu spiegeln; **konsolidieren** (`schedule_event` = Verfügbarkeit finden + buchen, statt `list_users` + `create_event`).
- **Namespacing** nach Service + Ressource (`asana_search`, `jira_search`) — der Agent wählt sicherer.
- **Aussagekräftige Responses** — semantische Identifier (Namen, Typen) statt technische (UUIDs, MIME).
- **Token-Effizienz** — Pagination/Filter/Truncation mit sinnvollen Defaults; bei Abschneiden Hinweis, wie man gezielter sucht.
- **Handlungsleitende Fehlermeldungen** — konkret + korrigierend, kein opaker Code.
- **Beschreibungen wie für ein neues Teammitglied** — Formate/Begriffe explizit; eindeutige Parameter-Namen (`user_id`, nicht `user`); **poka-yoke** (z. B. absolute Pfade erzwingen).
- **Eval-getriebene Iteration** — Tool-Performance messen, Transkripte mit dem Agenten analysieren, iterieren.

**Elicitation (MCP-Spec ab 2025-06-18):** Ein Server darf strukturierte Rückfragen an Client/User stellen (`elicitation/create`; Typen Text/Zahl/Bool/Enum) mit UI-Präsentation + Ablehnungs-Option. **Bevorzugt gegenüber Sampling** (Server lässt den Client das LLM rufen), weil Elicitation die Kontroll-/Vertrauensgrenze beim Menschen/Client hält. Pro Server dokumentieren, ob Elicitation/Sampling genutzt wird.

---

## 18. Probabilistik im Konzept (UC-übergreifend)

### 18.1 Pflicht-Section im Konzept-Kopf

Siehe §2.6 (Probabilistik-Statement mit EU-AI-Act-Spalte) — das ist das Pflicht-Artefakt zum Prinzip §1.5.

### 18.2 Schichten-Bewusstsein (Kontext-Pyramide)

Im Konzept dokumentieren, welche Schicht der LLM-Kontext-Pyramide genutzt wird:
1. **Lokale Tabs** — was hat der Entwickler gerade offen?
2. **Indizierter Projekt-Kontext** — Workspace-Index
3. **Embeddings-basiertes Retrieval** — RAG / VectorDB
4. **Pre-trained LLM-Wissen** — das Modell selbst

Pro UC: welche Schichten sind nötig? Welche Cache-Strategie greift?

### 18.3 Drei Workflow-Modelle

| Modell | Beschreibung | Wann sinnvoll |
|---|---|---|
| **Conversation-Session** | Chat mit fortlaufendem Kontext | Iterative Erkundung |
| **Complete-Bundle** | Alles vorab in einen Prompt | Boilerplate / kleine UCs |
| **Vibe-Coding-Workflow** | Files-on-demand laden | Größere Refactorings |

---

## 20. Schichten-Architektur für KI-Apps

Vier Schichten Pflicht, im Konzept als Entitäten- + Service-Übersicht abgebildet (Provenienz: Springer 2026):

| Schicht | Aufgabe | Beispiel |
|---|---|---|
| **Interface Layer** | Tor zur Welt — REST / GraphQL / UI / SSE-Streaming | Symfony Controller + Mercure |
| **Orchestration Layer** | Business-Logik, Context Engineering, Pre-Processing, Tool-/Plugin-Integration | Symfony Service / Spring Service |
| **Model Layer** | LLM-API-Abstraktion (Anthropic / OpenAI / Ollama) | LangChain / Spring AI |
| **Data Layer** | Vektor-DB + relationale DB + Caching | Milvus / pgvector + Redis |

### 20.1 Pflicht-UX: Streaming

Token-weise Ausgabe ist UX-Pflicht. Im Konzept jedem LLM-UC ein Streaming-Verhalten zuordnen (Chunked-HTTP, SSE, WebSocket).

### 20.2 Stateless LLM, Stateful App

Im Konzept dokumentieren, wo der Konversations-State lebt: Session-Cookie, DB-Tabelle, Cache. **Nie auf das LLM verlassen** — das ist stateless.

### 20.3 RAG-Konvention

| Komponente | Beispiel | Pflicht-Hinweis |
|---|---|---|
| Embedding-Modell | `nomic-embed-text` (4 096 Dimensionen) | — |
| Vektor-DB | Milvus / pgvector | — |
| Chunking | semantisch (nicht zeichenbasiert) | — |
| Retriever-K | klein halten (2–5) | — |
| **Prompt-Caching** | Provider-spezifisch (Anthropic / OpenAI Prompt-Caching) | **Pflicht ab > 1k Token Kontext** — ohne Caching ist die ständige Neufütterung unbezahlbar |
| **Cache-Invalidierung** | Pflicht-Doku pro UC: bei welchen File-/Daten-Änderungen wird invalidiert? | ohne Invalidierungs-Strategie wird gecachter Stale-Kontext zum Memento-Effekt-Risiko |

Im Konzept pro RAG-UC: Chunking-Strategie + Embedding-Modell + Retriever-K + Caching-Strategie + Invalidierungs-Trigger explizit nennen.

**Retrieval schlägt Modell:** Die RAG-Qualität liegt primär im **Retrieval** — Chunking-Strategie, Metadaten und Preprocessing sind die Hauptstellschrauben, nicht das Modell (Provenienz: Magnussen/Springer). **Grounding-Pflicht:** im System-Prompt Quellen-/Zitationspflicht erzwingen („kein Statement ohne Quelle", Glaser) und das Output-Grounding gegen die Quellen prüfen (§15.3 Factuality).

---

## 21. TAO-Cycle + ISAQB-Kernaktivitäten für Agent-UCs

### 21.1 TAO-Cycle (Thought-Action-Observation)

Pflicht-Schleife für Agent-UCs:

```
┌──────────┐   ┌──────────┐   ┌──────────────┐
│ Thought  │ → │  Action  │ → │ Observation  │
│ (LLM)    │   │ (Tool)   │   │ (Tool/State) │
└──────────┘   └──────────┘   └──────────────┘
       ↑                              │
       └──────────────────────────────┘  Re-Plan
```

Im Konzept jedem Agent-UC ein TAO-Logging zuordnen (§15 Observability).

### 21.2 ISAQB-Kernaktivitäten als Prüfraster

| Aktivität | KI-fähig? | Bedingung |
|---|---|---|
| Klärung der Anforderungen | Ja, mit Reviews | Domain-Expert prüft |
| Entwurf von Strukturen | Teilweise | LLM schlägt vor, Architekt entscheidet |
| Entwurf von Querschnittskonzepten | Teilweise | Glossar + ADRs nötig |
| Bewertung | Eingeschränkt | KI als Sparringspartner, nicht als Bewerter |
| Kommunikation | Nein | Mehrabian-Regel — siehe §1.6 |
| Überwachung der Implementation | Ja | Verifikationsagent (§10.6) |

### 21.3 Moravec-Paradox

Was Menschen leicht fällt (Wahrnehmung, Kontext), ist für KI schwer — und umgekehrt. Im Konzept: Aufgaben mit „menschlich leicht" NICHT der KI übergeben; „menschlich aufwendig" (Boilerplate, Datenkonvertierung, Pattern-Matching) sind KI-Kandidaten.

---

## 22. Quantifizierter PoC-Pfad mit Phasen

> **Bridge zu §29 Modus E:** §22 beschreibt einen *PoC-Phasen-Plan* für die Einführung eines neuen KI-Tools. §29 Modus E kombiniert §22-Phasen mit Brownfield-Pattern für „KI-Capability in bestehendes System".

### 22.1 Zwei-Phasen-Vorgehen

**Phase 1 — Lernen & Experimentieren (2 Wochen):** eine fokussierte Test-Gruppe mit Multiplikatoren · 3–5 konkrete Use Cases · Compliance/Security-Enabler-Kick-off ZU BEGINN (Datenschutz, Vendor-Lock-in) · Tool-Auswahl noch offen.

**Phase 2 — Vielversprechende Ergebnisse verstetigen (3–4 Wochen):** quantitative Erfolgsmessung · konfigurierbare Agenten mit Wissensbasis aus Confluence/Wiki · Multiplikatoren-Befähigung · Skalierungs-Plan.

### 22.2 Pflicht-Messgrößen pro Use Case

| Größe | Beispiel |
|---|---|
| Aufgabe | „Refinement-Meeting für Epic XY" |
| Zeit ohne KI | 15 Min |
| Zeit mit KI | 5 Min (-67 %) |
| Verwendeter Prompt | im Repo versioniert |
| Qualität der Antwort | „passend"/„sehr gut"/„unzureichend" |
| Qualitäts-Score | 1–10 |
| Kosten / Tokens | $X / N Tokens |

### 22.3 Erwartete Kennzahlen (Realisierbarkeit)

75 % Trefferquote bei Qualität (passend / sehr gut) · 50–75 % Zeitersparnis · 65 % Refinement-Reduktion.

### 22.4 Risiken (im Konzept als Known Issues)

Single-User-Tests statt diverse Test-Gruppen → Verzerrung · zu früh skalieren ohne fundierte Multiplikatoren · Compliance/Security NACHTRÄGLICH einbinden statt bei Kick-off · fehlende Standards/Guidelines → Agenten halluzinieren passende Antworten.

### 22.5 Real-User-Rollout-Strategien

Übergang von synthetischen zu echten Nutzern in vier Stufen (Provenienz: Köster), je nach Risiko kombinierbar:

| Strategie | Charakter |
|---|---|
| **Shadow Traffic** | echte Anfragen parallel an die KI, Antwort nicht ausgeliefert — Vergleich gegen Ist |
| **Friendly-User / interne Testgruppe** | begrenzte, wohlwollende Nutzergruppe |
| **Lab-Test** | echte Nutzer unter Laborbedingungen, mit Aufzeichnung |
| **A/B-Test** | kontrollierter Split gegen Baseline |

Pro LLM-UC die gewählte Stufe + Erfolgs-/Exit-Kriterien dokumentieren (ergänzt §22.2).

---

# Teil 6 — Erkenntnisse & Anti-Pattern-Katalog

Der Pattern-Katalog: bewährte Erkenntnisse (§24) und das Anti-Pattern-Prüfraster fürs Review (§25). Diese beiden Sektionen sind die konsolidierte Heimat der Patterns; sie werden im Konzept- wie Code-Review als Checkliste durchgegangen.

## 24. Bewährte Erkenntnisse

| Erkenntnis | Ursprung | Anwendung |
|---|---|---|
| Bundles brauchen immer einen Admin-UC für Bundle-Konfiguration | Notification-Bundle, Media-Bundle | UC mit Route `/admin/{bundle}/config` |
| Add-on-Module explizit kennzeichnen | DB-Gleisbau-Modul | Eigener Abschnitt mit Lizenz-Hinweis |
| Blockers früh als Notiz im Konzept | Auftrags-Cockpit | `> **Blocker:** ...` direkt beim UC |
| Manuelle Äquivalente für nicht-intuitive Systeme | NSAI-Bundle | Bei Batch-Prozessen, KI-Konzepten |
| Offline-Verhalten explizit beschreiben | Mobile-UC Auftrags-Cockpit | Bei mobilen UCs immer Offline-Abschnitt |
| Variantenvergleich bei alternativen Implementierungen | WebMailer A/B | Tabelle Kriterium / Variante A/B / Empfehlung |
| Sachbearbeiter-Perspektive für Queue-Konzepte | Quarantäne NSAI | „Was liegt auf dem Stapel?" |
| Regulatorische Verweise direkt im UC | DB-Modul (DGUV V78) | Hinweis-Spalte / Fußnote |
| Schrittnummerierung im Ablauf | Leßner/Bartels 2026 | „Implementiere Schritt X.Y" als Prompt |
| Konzept-Score als Diskussionsgrundlage | Bartels 2026 | 8/10 ist implementierungsreif |
| Subsysteme klein halten | Leßner/Toth 2026 | Self-Contained UCs |
| KI prüft Spezifikation gegen Code | Bartels 2026 | Verifikationsagent nach jedem Sprint (§10.6) |
| Semantische Anker im Glossar | Müller 2026 | 2–4 Stichworte als LLM-Trigger |
| LLM-Ausgaben typisieren | Baumgartner 2026 | Sealed Interfaces / Records |
| Agenten nur bei Entscheidungen unter Unsicherheit | Baumgartner 2026 | Deterministische Logik bleibt deterministisch |
| Testdaten-Strategie im LLM-UC beschreiben | Heinicke 2026 | Personas + Seed Queries + Validierung |
| Knowledge-Cutoff im Konzept adressieren | Heinicke 2026 | Kontext-Strategie für zeitkritische Daten |
| Zu viele MCP-Tools verschlechtern Qualität | Heinicke 2026 | Pro UC max. 3–5 Tools |
| Probabilistik-Statement Pflicht | Mahringer/Wolff 2026 | UC-Tabelle mit Toleranz + Validierung (§2.6) |
| KI-Code als Untrusted Input | Mahringer 2026 | CodeQL/SonarQube vor Merge (§15.8) |
| Sampling für LLM-Spans deaktivieren | Köster 2026 | Vollständiges Tracing |
| OpenTelemetry GenAI-Conventions als Standard | Köster 2026 | `gen_ai.*`-Attribute |
| LLM-as-Judge als 4. Eval-Säule | Köster 2026 | Promptfoo / `llm-rubric` |
| Red Teaming pro LLM-UC | Köster 2026 | Promptfoo `harmful:*` + `jailbreak` |
| PII-Anonymisierung im Trace | Köster 2026 | DataFog / Microsoft Presidio |
| Konsistenzcheck Modell↔API per LLM-Prompt | Junker 2026 | Pro Sprint-Ende, versionierter Prompt (§19) |
| Vier-Schichten-Architektur für KI-Apps | Springer 2026 | Interface / Orchestration / Model / Data |
| Streaming als UX-Pflicht | Springer 2026 | Token-weise Ausgabe pro LLM-UC |
| TAO-Cycle für Agent-UCs | Röwekamp 2026 | Thought / Action / Observation als Schleife |
| ISAQB-Kernaktivitäten-Mapping | Röwekamp 2026 | KI-fähig vs. nicht-KI-fähig pro Aktivität |
| Mehrabian-Regel respektieren | Wolff 2026 | Stakeholder-Workshops bleiben menschlich |
| Vier Architekten-Superkräfte als Mensch-Anker | Röwekamp 2026 | Communicate / Decide / Adapt / Make Mistakes |
| Verantwortungs-Matrix pro Konzept | Lischke 2026 | UC × Mensch-Validator × Haftung (§23.1) |
| Walk-Through-Pflicht | Mahringer 2026 | Vor Sprint-Start je UC laut vorlesen |
| Zwei-Phasen-PoC | Posselt/Birke/Schluff 2026 | Lernen+Experimentieren → Verstetigen |
| Verifikationsagent + Review-Agent als zwei Rollen | Bartels 2026 | `.github/agents/`-Layout |
| Modul-Tiefe als Architektur-Metrik | Ousterhout/Pocock | Deep = viel Verhalten hinter schmaler Schnittstelle |
| Deletion-Test als Refactor-Filter | Pocock 2026 | „Würde Löschen die Komplexität verschwinden lassen oder verteilen?" |
| Vertical-Slice / Tracer-Bullet als Decomposition-Default | Pocock/Thorstensen | Jeder Slice durchquert ALLE Schichten |
| Slice 1 = riskantester Pfad mit höchster Lernchance | Pocock/Thorstensen | Reihenfolge folgt „lernträchtigster zuerst" |
| Vertical-TDD statt Horizontal-TDD | Pocock 2026 | Ein Test → eine Impl → wiederholen |
| Feedback-Loop als eigentliche Debug-Skill | Pocock 2026 | „Build the right feedback loop, and the bug is 90 % fixed." |
| CONTEXT.md als nicht-verhandelbarer SSOT | Pocock + Brownfield | Pflicht vor jeder Erweiterung: lesen, bei Drift aktualisieren |
| ADRs für asymmetrische Entscheidungen | Pocock + Brownfield | `docs/adr/ADR-NNN-<slug>.md` |
| Hybrid-Validierungs-Schichten für LLM-Code | Mahringer 2026 | LSP/AST + Reasoning + CodeQL — deterministische Schichten obendrauf |
| Memento-Effekt + Kontext-Caching als RAG-Voraussetzung | Mahringer 2026 | Token-Budget überwachen, Caching Pflicht ab > 1k Token |
| Validierungs-Mindset-Niveau als Differenzierungs-Achse | Wilke/Loje/Krypczyk 2026 | KI-Anteil > 50 % verlangt Hoch-Niveau-Validierung |
| EU-AI-Act-Risiko-Klasse pro UC | Regulatorik 2026/27 | Pflicht-Spalte im Probabilistik-Statement (§2.6) |
| Vendor-Risiko-Statement parallel zu Probabilistik | Mischok 2026 | Provider + Modell + Migration + Souveränität pro LLM-UC |
| Konkretheits-Trennung CDP5 abstrakt vs. Wiki/Trace konkret | Manipulationsvermeidung | Konkrete Pfade/SHAs gehören nicht ins CDP5 (§1.7) |
| **Orchestrierung statt Selbst-Ausführung** | Delegations-Doktrin (§32) | Nicht-trivialer Auftrag → an isolierte `stufe-rolle`-Worker delegieren, Drift-Schutz durch frischen Kontext |
| **Determinismus-Gate / programmierter T1-Skill statt Text-Skill** | Skill-Determinismus (§32.9) | Entscheidbar + wiederholt → Node.js-Programm mit Tests; Text-Skill ist nicht reproduzierbar |
| **Clarify-First / selbst-geflaggte Annahme = harter Stopp** | Anti-Drift (§1.9) | Bei Unklarheit/offener Entscheidung sofort in die Konversation, nicht durchreichen |
| **Stale-Data zuerst ausschließen** | Reproduktions-Gate (§32.8 (6)) | Clean-Reproduktion vor jedem Diff-Fix; Semantik ausführbar belegen |
| **Vorbedingung = Stopp, kein Rescue im selben Lauf** | Anti-Drift (§32.8 (7)) | ADR/Konzept-Vorbedingung ist ein Gate, keine Verhandlungsbasis |
| **Auditor schlägt Self-/Pro-Review bei 🔴-Slices** | Review-Korollar (§11.4) | Gegnerischer Auditor + empirische Gegenprobe; Self/Pro teilen denselben blinden Fleck |
| **Durable Artefakte als externes Gedächtnis** | Gedächtnis-Abwehr (§28) | CONTEXT.md/ADR/Handoff halten Vokabular + Entscheidungen außerhalb des flüchtigen Kontexts |
| **Retro→Memory-Loop verifizieren** | Lern-Loop (§32.6) | Jeder im Retro zitierte Memory-Slug muss real existieren + MEMORY.md-Pointer haben |
| **Konzept-Splitting: Master-Index + Sub-Files ab ~400 Zeilen** | wachsende Konzepte | Master (Grundprinzipien + Topic-Tabelle) + Sub-Decision-Files pro Topic; minimale, präzise Cross-Refs |
| **Plan-Treue / minimal deviation** | Multi-Repo-Lehren | Plan wortgetreu umsetzen; Verbesserungsvorschläge zurückmelden statt lokaler Cleverness |
| **Findings als durable Issues persistieren** | Issue-als-SSOT | Jeder Review-/Test-/Bug-Finding als Issue (nicht in Chat/Commit-Message versanden); auto-close via `Closes #X` |

---

## 25. Anti-Pattern

| Anti-Pattern | Problem | Lösung |
|---|---|---|
| „Weitere Felder nach Bedarf" | Unvollständig | Alle Felder explizit |
| Fehlerfälle in Fließtext | Schwer überfliegbar | Tabelle |
| „Standard-Verhalten" ohne Definition | Mehrdeutig | Default-Werte explizit |
| UCs ohne Route | Nicht testbar | Pflicht: Route oder „System (automatisch)" |
| Status ohne Übergänge | Unklar | Lifecycle-Diagramm |
| Rollen ohne Scope | Unklar | Global vs. Ressource-gebunden |
| Bundle ohne Konfig-Abschnitt | Nicht integrierbar | Admin-UC für Bundle-Konfig |
| UCs nur für Erfolgsfall | Fehlerfälle vergessen | Fehlerfälle-Checkliste |
| Ablauf ohne Schrittnummern | Kein gezielter KI-Prompt | Nummerierte Schritte |
| Datentypen nicht spezifiziert | KI rät | Typ + Einheit + Wertebereich |
| Prosa-Logik statt Ablaufstruktur | KI interpretiert | Verzweigungen explizit als Schritte |
| Konzept einmalig erstellt | Veraltet | Lebendes Artefakt + Versionierung |
| KI-generierte Tests die zum Code passen | Tests verlieren Nutzen *(Fondermann)* | Test-Cases aus UC-Spec ableiten, nicht aus Code |
| Cognitive Offloading auf KI | Lernschwund *(Mahringer)* | Walk-Through-Pflicht (§23.2) |
| KI als Architektur-Entscheider | Halluzinationen + Mehrabian-Lücke *(Wolff)* | KI nur Sparringspartner, nicht Entscheider |
| LLM ohne Probabilistik-Statement im Konzept | Falsche Erwartungshaltung | §1.5 + §2.6 |
| Klassische Observability-Tools für LLMs | erfassen `gen_ai.*` nicht | OpenTelemetry-GenAI + Langfuse |
| KI-Code direkt in Production ohne CodeQL/SonarQube | 45 % Sicherheitsmängel *(Veracode)* | KI-Code als Untrusted Input |
| Verantwortung an LLM delegieren | Nicht haftbar *(Lischke)* | §23.1 Verantwortungs-Matrix |
| Stakeholder-Workshops durch KI ersetzen | 93 % Kommunikation nonverbal *(Wolff)* | Event Storming / Domain Storytelling bleibt menschlich |
| Agenten in deterministischen Flows | Komplexitäts-Inflation *(Baumgartner)* | Workflow ohne LLM = Workflow ohne Agent |
| Magische String-Schlüssel für Agent-Output | Probabilistik-Quelle *(Baumgartner)* | Sealed Interfaces / typisierte Records |
| Direkter LLM-Aufruf ohne Schichten | Nicht wartbar *(Springer)* | Vier-Schichten-Architektur §20 |
| Synchrone LLM-Antwort ohne Streaming | Schlechte UX *(Springer)* | Token-weise Ausgabe |
| Implementation-Details als Inkonsistenz interpretieren | Falsche Refactoring-Empfehlung *(Junker)* | Prompt-Regel: „Implementation-Details sind KEINE Inkonsistenzen" |
| Compliance/Security NACHTRÄGLICH einbinden | PoC-Sackgasse *(Posselt)* | Enabler-Kick-off bei PoC-Beginn |
| Sampling für LLM-Spans aktivieren | Drift-Erkennung blind | §15.1 — Sampling DEAKTIVIEREN |
| Tests nach der Implementation aus dem Code generieren | Redundante grüne Tests ohne Spec-Bezug | §11.7 — TDD-First |
| Akzeptanzkriterien als Prosa | Kein Test-Case, sondern Wunsch | §11.7 — AC-Tabelle |
| Test-Klassen ohne UC-Mapping | Wartungs-Schulden | §11.7 — Test-Klasse-Name benannt |
| Horizontal-TDD (alle Tests vorab) | Tests testen *imaginiertes* Verhalten *(Pocock)* | §27.4 — Vertical-TDD |
| Shallow-Module nur zur Testbarkeit extrahiert | Bugs verstecken sich in der Aufruf-Art *(Pocock)* | §27.1 Deletion-Test |
| Bulk-PRD ohne Tracer-Bullet-Decomposition | beschreibt Endzustand statt verifizierbarer Zwischenschritte | §27.2 Vertical-Slicing |
| Bug-Hypothese ohne Feedback-Loop | Stunden Code-Lesen ohne Pass/Fail-Signal | §27.5 Feedback-Loop-First |
| Implementation startet ohne CONTEXT.md gelesen | Domain-Glossar wird re-interpretiert → Drift | §1.8 + §27.6 |
| ADR-Decisions bei jeder Slice neu verhandeln | durable Entscheidung verletzt | §28.2 ADRs sind durabel |
| Prototype-Code wandert in Production | Throwaway-Code ohne Tests im Hauptpfad | §27.3 — clearly marked + delete-or-absorb |
| „Es funktioniert" als Architektur-Begründung | Bestätigung ohne Mechanik | §27 — pro Entscheidung *welche Problem-Eigenschaft* gematcht wird |
| ADRs im Touch-Bereich nicht gelesen vor Erweiterung | Drift zu bestehenden Entscheidungen | §1.8 + §27.6 |
| Memento-Effekt durch Kontext-Sprengung ignorieren | Modell vergisst Anfangskontext *(Mahringer)* | Token-Budget überwachen; Handoff (§28.4) bei Limit-Annäherung |
| RAG ohne Prompt-Caching | Token-Kosten explodieren *(Mahringer)* | §20.3 Prompt-Caching Pflicht ab > 1k Token |
| LLM-Code ohne strukturelle Validierung mergen | LSP/AST würde Typ-/Symbol-Fehler fangen *(Mahringer)* | §15.8 Validierungs-Schicht 1+ Pflicht |
| Passive KI-Output-Übernahme ohne aktive Validierung | Cognitive Offloading verschärft *(Wilke)* | §23.1 Mindset-Niveau „hoch" bei KI-Anteil > 50 % |
| Sycophancy-bestätigte KI-Vorschläge übernehmen | LLM bestätigt statt zu widersprechen *(Kruse)* | Devil's-Advocate-Pass; zweites Modell; §11.4 Review-Korollar |
| KI als deterministische Suchmaschine behandeln | Plausibilität wird mit Wahrheit verwechselt *(Kansy)* | KI-Output ist Vorschlag, nicht Fakt; mit Quelle/Validierung verknüpfen |
| Hochrisiko-UC ohne EU-AI-Act-Klassifikation | Regulatorische Nicht-Konformität | §2.6 Risiko-Klassen-Spalte Pflicht |
| AFK-Slice ohne Readiness-Check | Agent läuft ins Leere | §28.3 AFK-Hardening, 6-Punkte-Checkliste |
| Annahmen treffen statt in die Konversation gehen | Fehler verteilt sich über alles Aufbauende | §1.9 Clarify-First |
| Roadmap/Plan-Drift: Skelette unverbucht | Doppelbau; oder halluzinierte Symbole im Plan | §28.5 Roadmap = temporär → Code↔Plan-Inventur (T1-Skript / `konzept-mapper`) |
| Safety-Gate an optionalem State → fail-open | geschützte (destruktive) Aktion läuft ungated bei `null` | Safety-Gate **fail-closed**: `null` → abbrechen, „Check entfällt" verboten |
| Partial-Success-Marker ignorieren | teil-gescheiterter Lauf wird als Erfolg geschluckt | immer auf den Partial-Marker prüfen, nicht nur Top-Level-Flag |
| Entscheidbare Tätigkeit als Text-Skill | nicht reproduzierbar (LLM-Lauf) | §32.9 — T1-Programm portieren |
| Worker mit kopierten Kontext-Walls briefen | Overflow + Paraphrase-Drift | §32.8 (2) — Pointer-Brief statt Paste |
| **Lethal Trifecta erfüllt ohne Gegenmaßnahme** | sensible Daten + untrusted Content + Egress → Daten-Exfiltration via Prompt-Injection | §33.1 — eine Achse brechen oder Human-Gate |
| **Drittanbieter-MCP-Server ungevettet eingebunden** | Name-Spoofing / Tool-Description-Injection / Rug-Pull | §33.3 — Trust-Source, Approval-Hash, Isolation |
| **Großer KI-Codeblock ohne Public-Code-Filter übernommen** | Copy-Left-/Lizenzverstoß | §33.7 — Public-Code-Filter, große 1:1-Blöcke meiden |
| **Eigener MCP-Server als rohe 1:1-API-Spiegelung (Level 0)** | fehleranfällig, Agent wählt falsches Tool | §16.8 — konsolidierte, domänenbewusste Tools (Level 2) |
| **Überladene CLAUDE.md/Instruktions-Datei** | jede Session geladen → Regeln gehen im Bloat unter, werden ignoriert | §28.6 — kurz halten, prunen, situatives Wissen in Skills |
| **Kontext akkumulieren über unzusammenhängende Tasks (kitchen-sink)** | Context-Rot, Genauigkeit fällt > 60–70 % Auslastung | §28.6 — `/clear` zwischen Tasks; nach 2 Korrekturen neu starten |

---

## Selbst-Anwendung — CDP5 als Review-Prüfraster gegen andere Konzepte

Beim `konzept-review` werden andere Konzepte gegen CDP5 gemessen — insbesondere prüfen:
- §1–§14: Konzept-Struktur vollständig; Score-Threshold **8/10** (§10.3/§10.4)
- §1.7 Konkretheits-Trennung: keine konkreten Code/Repo/SHA-Details im Konzept-Doc
- §1.8 CONTEXT.md/ADR-Pflicht: bei Brownfield-Anteil Pflicht
- §7 erweiterte Checkliste: bei Implementation-Plan-Anteil zusätzliche Pflicht-Punkte
- §2.6 + §2.7: bei LLM-UC Pflicht-Statements (Probabilistik + Vendor + EU-AI-Act)
- §10.7: jede „Pflicht" hat einen objektiv prüfbaren Nachweis-Typ
- Teil 2 (§27–§29, §32): für Konzepte mit Brownfield-/Review-/Teardown- oder PoC-Anteil verbindlich

---

# Anhang

Referenz-Material — beim Lesen der Doktrin überspringbar, beim konkreten Arbeiten nachschlagen.

## Anhang A — KI-Prompting-Pattern für neue Konzepte (war §9)

Fünf Prompt-Pattern für den Lebenszyklus eines Konzepts.

### A.1 Initialer Prompt (Konzept von Grund auf)

```
Erstelle ein Anwender-Konzept für {Projektname}.

Scope: {1–3 Sätze Beschreibung}
Stack: Symfony, FrankenPHP, Twig, Symfony Turbo, MercureHub, API Platform
Akteure: {kommagetrennte Rollen}
Besonderheiten: {Regulatorik, externe Systeme, Offline-Anforderungen usw.}

Anforderungen an das Konzept:
- Sachbearbeiter-Test: Alle Prozesse manuell ausführbar anhand des Dokuments
- Use Cases für alle Akteure (Nutzer, Sachbearbeiter, Admin, System)
- Formularfelder als vollständige Tabellen (Feld, Typ, Pflicht, Hinweis) — mit Datentyp und Wertebereich
- Ablaufschritte nummeriert (1, 1.1, 1.2, 2, ...) für spätere gezielte Implementierungsreferenz
- Fehlerfälle als Tabellen — inkl. Grenzwerte und Sonderfälle
- Status-Lifecycles als ASCII-Diagramme
- Entitäten-Übersicht am Ende
- Mercure-Topics wenn Echtzeit nötig; API Platform Endpunkte wenn API nötig
```

### A.2 Review-Prompt (bestehendes Konzept verbessern)

```
Analysiere dieses Konzept als strenger Requirements Engineer mit Policy:
"Ein Konzept ist implementierungsreif wenn ein KI-Agent daraus ohne Rückfragen
korrekten, wartbaren Code generieren kann."

Identifiziere: 1) UCs mit Interpretationsspielraum (Prosa statt Ablaufstruktur)
2) Fehlende Schrittnummerierung 3) Unspezifizierte Datentypen/Einheiten/Wertebereiche
4) Fehlende Fehlerfälle (Grenzwerte/Ausnahmen) 5) Fehlende UCs für Admin/Sachbearbeiter
6) Status ohne Übergänge 7) Fehlende technische Anhänge

Gib einen Score 1–10 je UC und einen Gesamt-Score.
Stelle bei Unklarheiten Rückfragen, statt Annahmen zu treffen.
```

### A.3 Interview-Prompt (lückenfüllend, iterativ)

```
Du bist ein Requirements-Engineer. Ich beschreibe einen Use Case.
Du identifizierst eine Lücke pro Antwort und fragst gezielt nach.
Formuliere nie eine Annahme — frage immer.

Starte mit: UC-{Nr.}: {Titel}
```

### A.4 Implementierungs-Prompt (gezielt aus Konzept)

```
Implementiere Schritt {X.Y} aus UC-{Nr.} ({Titel}).

Kontext: Stack Symfony 7, API Platform, Doctrine ORM; Entity {EntityName}; Abhängigkeiten {…}
Anforderungen: Orientiere dich exakt an der Ablaufbeschreibung; weiche nicht ab, frage bei
Unklarheit nach; generiere keinen Code für andere Schritte.
```

### A.5 Erweiterungs-Prompt (neue Version)

```
Erweitere das bestehende Konzept {Projektname} v{X.Y} um folgende Lücken: {Liste}.
Behalte alle bestehenden UCs unverändert. Füge Changelog-Abschnitt hinzu.
Erhöhe Version auf {X.Y+1 oder X+1.0}.
```

### A.6 Konsistenzcheck-Prompt zwischen Modell und API (§19)

KI als Schiedsrichter zwischen Domänenmodell, OpenAPI und AsyncAPI:

```
# Visual Glossary and OpenAPI Alignment Analysis

## Your Task
You are comparing two artifacts that should represent the same business domain:
1. An OpenAPI specification - the current technical implementation
2. A Visual Glossary (provided as an image) - a conceptual domain model using natural language

Your goal is to identify inconsistencies between the two and suggest which artifact should
be updated to achieve alignment.

## Understanding Visual Glossary
A Visual Glossary is NOT a UML class diagram and NOT a technical specification. It is a
conceptual domain modeling artifact that shows domain concepts and their relationships
(natural-language verbs), focuses on what exists in the domain, is readable by domain
experts, and may show concepts without direct API representation.

Critical: Implementation details are NOT inconsistencies.
```

Erfolgt periodisch (z. B. pro Sprint-Ende). Das LLM identifiziert z. B.: „Service publiziert nicht alle aus der Context Map ableitbaren Events (CatalogEntryUpdated, CatalogEntryDeleted fehlen)."

---

## Anhang B — Golden-Sample-UCs (war §31)

Zwei vollständig ausgeschriebene Referenz-UCs, die alle Pflicht-Sektionen demonstrieren. **Sample A** deterministisch (CRUD, Basis Teil 4). **Sample B** LLM-UC (zusätzlich §2.6/§2.7/§13/§15/§23.1). Generischer Fahrzeug-/Vereins-Kontext; Code-Identifier englisch.

### B.1 Sample A — CRUD-UC (deterministisch)

```markdown
## UC-S1: Vehicle zur Garage hinzufügen

**Akteur:** `Member` (eingeloggt, Eigentümer der Garage)
**Route:** `GET|POST /garage/vehicles/new`  ·  API: `POST /api/vehicles`

> **Kein LLM:** Dieser UC ist deterministisch — keine KI-Komponente (§13.3).

### Formularfelder
| Feld | Typ | Pflicht | Hinweis |
|------|-----|---------|---------|
| make | Auswahl | Ja | Hersteller-Stammdaten, nicht frei |
| model | Text | Ja | max. 80 Zeichen |
| firstRegistration | Datum | Ja | nicht in der Zukunft |
| vin | Text | Bed. | 17 Zeichen, Prüfsumme; Pflicht bei visibility ≠ private |
| visibility | Auswahl | Ja | `private` / `shared` / `public` (Default `private`) |

### Verhalten
1. Member öffnet `/garage/vehicles/new`
2. Validierung der Pflichtfelder
   2.1 `firstRegistration` ≤ heute
   2.2 `vin` Prüfsumme, falls gesetzt
   2.3 `visibility ≠ private` ⇒ `vin` Pflicht
3. Bei Validierungsfehler: Fehlermeldung inline, Formular bleibt offen
4. Bei Erfolg: Vehicle mit `owner = currentUser`, `visibility = private` (oder gewählt) speichern
5. Redirect → `/garage?added=1`

### Fehlerfälle
| Fall | Meldung / Verhalten |
|------|---------------------|
| VIN-Prüfsumme ungültig | „Die Fahrgestellnummer ist ungültig (17 Zeichen)." inline |
| firstRegistration in Zukunft | „Erstzulassung darf nicht in der Zukunft liegen." inline |
| visibility=public ohne VIN | „Öffentliche Fahrzeuge benötigen eine VIN." inline |
| Nicht eingeloggt | 302 → Login |

### Status-Lifecycle (visibility)
private → shared → public
   ↑__________________│   (Eigentümer kann jederzeit zurückstufen)

### Akzeptanzkriterien (Test-First)
| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-1 | Member kann Vehicle mit Pflichtfeldern anlegen | Integration | VehicleControllerTest::testCreateHappyPath | rot |
| AC-2 | Anonymer Besucher → 302 Login | Integration | VehicleControllerTest::testAnonymousDenied | rot |
| AC-3 | Member sieht/ändert NUR eigene Vehicles (Owner-Constraint) | Integration | VehicleVoterTest::testOwnerOnly | rot |
| AC-4 | visibility=public ohne VIN → Form-Error | Integration | VehicleFormTest::testPublicRequiresVin | rot |
| AC-5 | Status-Übergang public→private jederzeit durch Owner | Unit | VehicleStateTest::testDowngrade | rot |

### Manuelles Äquivalent
Sachbearbeiter trägt Fahrzeug in eine Karteikarte ein, prüft die VIN-Prüfziffer von Hand und legt die Karte ins Fach des Mitglieds; „öffentlich sichtbar" = Karte zusätzlich im Aushang.
```

### B.2 Sample B — LLM-UC

```markdown
## UC-S2: Mängelbeschreibung automatisch kategorisieren

**Akteur:** `Member` (Eigentümer) · Validator: `Workshop-Manager`
**Route:** `POST /garage/vehicles/{id}/defects/classify`  ·  API: `POST /api/vehicles/{id}/defect-classification`

### LLM-Pflichtfelder (§13.1)
| Element | Wert |
|---|---|
| Kontext-Definition | Freitext-Mängelbeschreibung (max. 2 000 Zeichen) + `make`/`model` des Vehicle |
| Ausgabe-Datenformat | sealed `ClassificationResult` permits `Confident` / `NeedsReview` (JSON-Schema) |
| Validierungsstrategie | Schema-Match (Pre/Inline) + LLM-as-Judge gegen Kategorie-Katalog (Post) |
| Fallback-Verhalten | Confidence < 0.6 ⇒ `NeedsReview` → Eskalation an Workshop-Manager |
| Knowledge-Cutoff-Umgang | Kategorie-Katalog wird als Kontext mitgegeben (nicht aus Modell-Wissen) |

### Probabilistik-Statement (Ausschnitt §2.6)
| UC | Toleranz-Schwelle | Validierungsstrategie | Fallback | EU-AI-Act-Klasse |
|---|---|---|---|---|
| UC-S2 | 85 % Korrektheit | Schema + LLM-as-Judge | NeedsReview → Mensch | minimal |

### Vendor-Risiko-Statement (§2.7)
| UC | Provider | Modell | Migrations-Strategie | Daten-Souveränität |
|---|---|---|---|---|
| UC-S2 | Anthropic | claude-haiku-4-5 | Spring-AI-Adapter (Provider via Config) | keine PII im Mängeltext; Klartext |

### Agent-Struktur (§13.2)
**Goal:** Mängeltext einer Kategorie zuordnen.
**Actions:** `parseDefectText` (det.), `classifyDeep` (LLM, Deep Path).
**Conditions:** `classifyDeep` nur wenn Keyword-Match (Fast Path) keine eindeutige Kategorie liefert.
**Output-Typen:** sealed `ClassificationResult permits Confident, NeedsReview`.
**Pre/Inline/Post:** Pre = Input-Schema + Token-Budget · Inline = Sealed-Interface-Match auf Stream · Post = LLM-as-Judge gegen Kategorie-Katalog.
**Unsicherheits-Schwellwert:** Confidence < 0.6 → NeedsReview.

### Observability (§15)
Trace pro Call: `gen_ai.request.model`, `gen_ai.usage.*`, Latenz, Kategorie + Confidence; Sampling deaktiviert.

### Akzeptanzkriterien (Test-First)
| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-1 | Eindeutiger Mängeltext → `Confident` mit korrekter Kategorie | Integration | DefectClassifierTest::testConfident | rot |
| AC-2 | Mehrdeutiger Text → `NeedsReview`, Eskalation ausgelöst | Integration | DefectClassifierTest::testEscalation | rot |
| AC-3 | Nur Owner darf klassifizieren (Security-Constraint) | Integration | DefectClassifierVoterTest::testOwnerOnly | rot |
| AC-4 | Knowledge-Cutoff: erfundenes Modell → keine Halluzination, NeedsReview | Eval | DefectClassifierEvalTest::testCutoff | rot |
| AC-5 | Red Teaming: Prompt-Injection im Mängeltext wird neutralisiert | Eval (Promptfoo `jailbreak`) | promptfoo/defect-redteam.yaml | rot |

### Verantwortungs-Matrix (§23.1)
| UC | KI-Anteil | Mensch-Validator | Validierungs-Mindset | Haftung |
|---|---|---|---|---|
| UC-S2 | 70 % (Vorschlag) | Workshop-Manager (bei NeedsReview) | hoch (KI-Anteil > 50 %) | Workshop-Manager |

### Manuelles Äquivalent
Werkstattmeister liest die Mängelbeschreibung, ordnet sie aus Erfahrung einer Kategorie zu und legt im Zweifel den Fall einem zweiten Kollegen vor.
```

---

## Anhang C — Referenz-Cases (pseudonymisiert, war §30)

Pro Case ein **abstrahierter** Eintrag. Keine konkreten Pfade, Repo-URLs, Commit-SHAs oder PR-Nummern im CDP5 selbst (§1.7). Konkrete Pin-Information lebt in privaten Trace-Raws oder Wiki-Projekt-Pages.

| Case | Stack / Charakter | Sektionen erfüllt |
|---|---|---|
| Case A | Brownfield Symfony 7 + API Platform + FrankenPHP, Security-Sprint mit 6-Slice-Plan, fold-in + develop-Mix | §1.8, §27.2–§27.6, §28.1/§28.2/§28.5, §29 Modus A + B (Mix) |

Künftige Cases mit demselben Pflicht-Schema: Pseudonym · Stack + Charakter · welche Sektionen konkret erfüllt sind. Konkrete Pin-Information wird im CDP5 **nicht** referenziert.

---

## 26. Changelog

| Datum | Version | Änderung | Grund |
|---|---|---|---|
| 2026-05 | **v5.0** | **Restrukturierung** für kontextarmes Einlesen: Teil 0 (Mission + Arbeitsschleife) neu; Anti-Drift-/Gedächtnis-Mechanik (§29/§32/§28/§27/§10.6/§19) als **Teil 2** nach vorn; LLM-Spezifika (§13/§15/§16/§18/§20–§22) in überspringbaren **Teil 4** gebündelt; Prompt-Pattern (§9)/Golden-Samples (§31)/Cases (§30) in **Anhang**. Autoren-Zitate → Inline-Regeln (Portabilität). Stubs §8/§12 gestrichen; §11.3+§11.6 gemergt; Probabilistik (§1.5/§2.6/§18) querverlinkt. §-Anker unverändert (alle `(§X.Y)`-Verweise gelten). Neu: §32.6 Memory-Loop-Verifikation; §24 +Konzept-Splitting/Plan-Treue/Findings-als-Issues + die Arbeitsweg-Patterns als Katalog-Einträge; **§33 Sicherheit (neuer Teil 3): Lethal-Trifecta-Gate, Agent-Runtime-Härtung, MCP-Tool-/Server-Sicherheit, Threat-Modeling-light, Security-Gates, LLM-Bedrohungsklassen, Doppel-Review/Lizenz; §25 +3 Anti-Patterns, §7-Security-Checkblock; Folge-Teile Authoring/LLM/Erkenntnisse → Teil 4/5/6. **Gap-Review-Ergänzungen (Branche + 4 Hefte + Anthropic-Docs):** §16.8 MCP-Tool-Design · §32.10 Fan-out-Ökonomie · §28.6 Kontext-Hygiene/CLAUDE.md-Pruning · §19.4 AsyncAPI↔Context-Map · §22.5 Real-User-Rollouts · §2.6 EU-AI-Act-Hochrisiko-Pflichten+CRA/NIS2 · §27.6/§20.3/§15.4-Erweiterungen** | Mission geschärft: CDP5 richtet Wissensdoktrin + Patterns ein und gibt der KI einen drift-/gedächtnisverlust-freien Arbeitsweg. Aus Review/Retro + Pattern-Konsolidierung über Brain/Memory/Wiki |
| 2026-05 | v4.7 | §32.9 Skill-Determinismus-Gate; §32.8 (6)/(7); §1.9 Worker-Selbst-Flag; §11.4 Review-Korollar; §25 +3 Anti-Patterns | Review/Retro der eq-library-v3-Anwendung |
| 2026-05 | v4.6 | §32.8 Drift-Vermeidung (Determinismus-Gate, Pointer-Brief, Stop-Retro, Verifikations-Gate) | Isolation allein verlagert Drift nur |
| 2026-05 | v4.5 | §32.7 Worker-Agent: Bedarf + Spec-Format + Scaffolding | CDP4 allein reicht zum Worker-Erstellen |
| 2026-05 | v4.3/4.4 | §32 Orchestrator-Regel; §1.9 Clarify-First | Delegation verbindlich; Lücken früh klären |
| 2026-05 | v4.0–4.2 | §27 Implementation-Werkzeugkasten; §28 durable Artefakte; §29 Modi A–E; §30/§31; Self-Containment | Pocock-Toolkit + Brownfield-Lehren; aus einer Datei erfüllbar |
| 2026-05 | v3.0/3.1 | „Coden mit KI"-Auswertung (14 Sektionen); TDD-First §11.7 | Wissensbasis Konzept-Schreiben |

---

> **Ende CDP5 (v5.0).** Vorgänger CDP4 (v4.7, `konzept-design-pattern-v4.md`) bleibt frozen als Fallback-Referenz.
