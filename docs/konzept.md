# claude-skills — Anwender-Konzept

**Version:** 1.4
**Stand:** Mai 2026
**Scope:** Ein projektunabhängiger Claude-Code-Marketplace, der **CDP5-basierte Skills und Agents** bereitstellt, mit denen ein KI-Orchestrator Konzept→Code-Arbeit **effektiv** (geringer Tokenverbrauch), **schnell** (< 5 min je interaktivem Schritt) und **genau** (Konzept-Reife ≥ 9,0/10, ≤ 3 Drifts je Konzeptumsetzung) leistet. **Nicht enthalten:** projekt-/framework-spezifische Implementierungs-Agents (bleiben lokal beim jeweiligen Projekt), Code-mutierende Automatik ohne Mensch-Gate, eigene LLM-Inferenz (nutzt Claude Code).

## Probabilistik-Statement (§2.6)

Das System mischt **deterministische Skills** (T1, kein LLM — reproduzierbar, keine Toleranz-Schwelle, Ausgabe = Beleg) und **Judgment-Agents** (T2, LLM — probabilistisch).

| UC | Toleranz-Schwelle | Validierungsstrategie | Fallback | EU-AI-Act-Klasse |
|---|---|---|---|---|
| UC-01 Konzept-Review | ~90 % (Score-Vorschlag) | `review-verify` (§10.6) + Architekt-Sign-off | Architekt entscheidet, iteriert | minimal¹ |
| UC-02/03/04 (T1) | n/a (deterministisch) | Output = Beleg (Exit-Code) | — | minimal¹ |
| UC-05 Threat/MCP-Review | ~85 % | deterministische Vor-Checks (secrets-scan/mcp-config-lint) + Security-Sign-off | Senior-Review | minimal¹ |
| UC-06 Adversarial-Audit | n/a (gegnerisch, kein Auto-Merge) | empirische Gegenprobe + Operator-Entscheid | Eskalation an Operator | minimal¹ |

¹ **Architekt-Festlegung (offen, §1.9/§11.2):** read-only Code-/Doku-Analyse ohne Personen-/Kreditentscheidung → **minimal** plausibel; regulatorisch vom Architekten zu bestätigen.

## Vendor-Risiko-Statement (§2.7)

| UC | Provider | Modell | Migrations-Strategie | Daten-Souveränität |
|---|---|---|---|---|
| UC-01/05/06 (Judgment) | Anthropic / Claude Code | opus | CDP5-Methode portabel; Agent-Mechanik Claude-Code-gebunden; Methode auf anderen Agent-Runner übertragbar | read-only Code/Doku, keine PII gesendet |
| UC-02/03/04 (T1) | — (kein LLM) | — | reines Node.js, **vendor-/LLM-unabhängig**, überlebt Provider-Wechsel | rein lokal, kein Send |

---

## 1. Ziele & Erfolgs-Kennzahlen (§22 quantifiziert)

Drei gleichberechtigte Qualitätsziele, je mit Messgröße, Mechanik und Schwelle:

| Ziel | Messgröße | Schwelle | Mechanik (wie erreicht) |
|---|---|---|---|
| **Effektiv** (Token) | Modell-Token je Schritt (`gen_ai.usage.*`, OTEL §15.1) vs. Budget pro UC-Typ | T1-Schritt ≈ 0 Modell-Token; Judgment-Schritt ≤ Budget (s. u.) | T1-Determinismus · `cdp5-reference` JIT statt Voll-Doktrin · Pointer-Briefs · Modell-Tier · Kontext-Hygiene §28.6 |
| **Schnell** (Latenz) | Wall-clock je **interaktivem** Dev-Schritt | **< 5 min** je interaktivem Schritt; T1 < 30 s. Voller Eval-/Test-Suite-Lauf = **CI-Batch**, kein „Schritt" | T1 läuft lokal (kein LLM-Roundtrip) · scoped Briefs · günstigstes ausreichendes Modell · unabhängige Worker parallel |
| **Genau** (Qualität) | (a) Konzept-Reife-Score · (b) Drifts je Umsetzung | (a) **≥ 9,0/10** (nach ≤ 2 Iterationen) · (b) **≤ 3 Drifts** | konzept-reviewer-Rubrik (a) · Drift-Detektoren konzept-mapper/konzept-model-api/roadmap-drift (b) · Doppel-Review + §10.6-Verifikation |
| **Sicher** (eigener Gate) | offene 🔴-Security-Findings | **0** — separat, **nicht** in der Drift-Zahl | Threat-Modeling §33.4 · `secrets-scan`/`pii-scan`/`mcp-config-lint` · `adversarial-auditor`/`mcp-security-reviewer` |

**Token-Budget pro UC-Typ (Richtwert, Baseline für „effektiv"):** deterministischer Check (T1) = 0 Modell-Token; Wissens-Abruf (cdp5-reference) ≤ 1k; Verifikation/Review (Agent, scoped) ≤ 40k; Konzept-Review (opus) ≤ 80k. Überschreitung = Finding.

**Drift-Definition (messbar):** ein Konzept-Artefakt, das im Code abweicht — ein UC ohne Code-Pendant (konzept-mapper „fehlt"), ein Enum-/Property-Mismatch Modell↔OpenAPI (konzept-model-api), eine als FERTIG markierte, aber fehlende Roadmap-Position (roadmap-drift). Gezählt **nach** einer Konzeptumsetzung; jeder Drift wird als Issue dokumentiert.

---

## 2. Rollen-Übersicht

| Rolle | Scope | Beschreibung |
|---|---|---|
| `Orchestrator` | Global | Main-Session: wählt Modus, delegiert, fährt Skills, verifiziert, hält Mensch-Gates (CDP5 §32) |
| `T1-Skill` | Werkzeug | Deterministisches Node-Programm (read-only Detektor/Report); Ausgabe = Beleg |
| `Judgment-Agent` | Werkzeug | Isolierter Subagent (Findings + Vorschläge, keine destruktiven Aktionen) |
| `Operator` | Global | Mensch: Merge-/Push-Verantwortung, Freigabe destruktiver Schritte, Final-Sign-off |

---

## 3. Use Cases

**UC-Übersicht (§2.2):** UC-01 Konzept-Review · UC-02 Drift-Gate · UC-03 T1-Check fahren · UC-04 CDP5-Retrieval · UC-05 Security-/Threat-Review · UC-06 Adversarial-Audit (🔴-Slice).

### UC-01: Konzept auf Implementierungsreife prüfen
**Akteur:** `Orchestrator` (delegiert an `konzept-reviewer`, opus) · **Schritt-Typ:** Judgment

**Verhalten**
1. Orchestrator brieft `konzept-reviewer` mit Pointer auf das Konzept-Dokument (kein Paste — §32.8(2)).
2. Agent konsultiert per `cdp5-reference` die einschlägigen §§ (§2/§7/§10/§10.7) — JIT, nicht die Volldoktrin.
3. Agent prüft gegen die Reife-Rubrik (s. §4), vergibt Score 0–10 je UC + Gesamt, priorisiert Lücken.
4. Bei Gesamt < 9,0: Lückenliste + Schließungs-Vorschläge zurück; Orchestrator klärt offene Punkte mit dem Nutzer (§1.9), iteriert.

**Fehlerfälle**

| Fall | Verhalten |
|---|---|
| Konzept-Datei fehlt/leer | Abbruch mit Hinweis, kein Score |
| Score-Behauptung unbelegt | `review-verify` gegenprüfen (§10.6) |
| Zeit-/Token-Budget (AC-3) überschritten | Abbruch mit Teil-Score + bisheriger Lückenliste; Orchestrator entscheidet Re-Run/Eskalation |

**Akzeptanzkriterien (Test-First)**

| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Score-Ausgabe ist eine Zahl 0–10 je UC + Gesamt | Integration | rot |
| AC-2 | Score je Iteration in Mess-Harness §6 protokolliert, bis Gesamt ≥ 9,0 | Eval | rot |
| AC-3 | Schritt-Token ≤ 80k, Laufzeit < 5 min | Trace/Metrik | rot |

### UC-02: Drift-Gate nach Konzeptumsetzung
**Akteur:** `Orchestrator` (fährt T1-Skills) · **Schritt-Typ:** Deterministisch

**Verhalten**
1. Nach der Implementierung: `konzept-mapper --konzept=… --repo=…` (UC↔Code), `konzept-model-api --repo=… --openapi=…` (Enum/Property-Drift), `roadmap-drift --roadmap=… --repo=…`.
2. Befunde aggregieren = Drift-Zahl.
3. Bei > 3 Drifts: Gate rot — pro Drift ein Issue, Umsetzung nachziehen oder Konzept aktualisieren (lebendes Artefakt §1.4).
4. Bei ≤ 3: Gate grün, dokumentiert.

**Fehlerfälle**

| Fall | Verhalten |
|---|---|
| Konzept nicht §3-konform (keine `## UC-…`, keine Backtick-Artefakte) | Mapper meldet n/a → Konzept-Bug, zurück an UC-01 |

**Akzeptanzkriterien (Test-First)**

| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Drift-Zahl = Summe der drei Detektor-Reports | Integration | rot |
| AC-2 | Exit 1 wenn > 3 Drifts (CI-Gate-fähig) | Integration | rot |
| AC-3 | Gesamt-Laufzeit < 5 min, 0 Modell-Token | Metrik | rot |

### UC-03: Deterministischen Check fahren (jeder T1-Skill)
**Akteur:** `Orchestrator` · **Schritt-Typ:** Deterministisch

**Verhalten**
1. Determinismus-Gate (§32.9): ist die Aufgabe entscheidbar? → T1-Skill statt Agent.
2. Skill mit strukturiertem Input (Pfade/Args) aufrufen; Output = Report (Exit-Code = Pass/Fail).
3. Orchestrator interpretiert den Report (LLM-Schale um den deterministischen Kern).

**T1-Skill-Vertrag (generisch, für alle 9 Skills aus §7):** Input = Args `--<name>=<wert>`; Output = Report (stdout) + Exit-Code (`0` Pass · `1` Befund/Drift · `2` Nutzungsfehler); reproduzierbar; eigene `node:test`-Suite.

**Fehlerfälle**

| Fall | Verhalten |
|---|---|
| Pflicht-Arg fehlt | Exit 2 + Usage-Hinweis |
| Ziel-Pfad/Datei nicht lesbar | Exit 2, kein Teil-Report |
| Skill nicht-deterministisch (Fund) | Bug-Issue gegen den Skill; bis Fix nicht als Gate nutzen |

**Akzeptanzkriterien**

| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Gleicher Input → gleicher Output (reproduzierbar) | Unit | rot |
| AC-2 | 0 Modell-Token im Kern, Laufzeit < 30 s typisch | Metrik | rot |
| AC-3 | Eigene Testsuite vorhanden (node:test) | CI | grün |

### UC-04: CDP5-Wissen abrufen (Token-Economy)
**Akteur:** `Judgment-Agent` / `Orchestrator` · **Schritt-Typ:** Deterministisch (Retrieval)

**Verhalten**
1. Statt die 2000-Zeilen-Doktrin zu laden: `cdp5-reference --section=<§>` oder `--keyword=<term>`.
2. Nur der relevante Ausschnitt fließt in den Kontext (§28.6 just-in-time).

**Fehlerfälle**

| Fall | Verhalten |
|---|---|
| Unbekannte §-Nummer | Exit 1 + Hinweis „`--list` zeigt alle Sektionen" |
| Mehrdeutiges Keyword (viele Treffer) | alle Treffer-Blöcke mit Snippet; Orchestrator verengt die Abfrage |
| Doktrin-Versions-Mismatch (Anker nicht vorhanden) | Befund; gegen die ausgelieferte Version prüfen (§7) |

**Akzeptanzkriterien**

| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | `--section=33.1` liefert genau die Sektion inkl. Untersektionen | Unit | grün |
| AC-2 | Abruf ≤ 1k Token statt ~30k (Volldoktrin) | Metrik | rot |

### UC-05: Sicherheits-/Threat-Review (bei Agent-/Tool-/Security-Anteil)
**Akteur:** `Orchestrator` (delegiert `threat-modeler` / `mcp-security-reviewer`; fährt `secrets-scan`/`mcp-config-lint`) · **Schritt-Typ:** Hybrid

**Verhalten**
1. Deterministisch zuerst: `secrets-scan --repo=…`, `pii-scan --repo=…`, `mcp-config-lint --config=…` (entscheidbare Negativ-Checks → speisen den Sicher-Gate, §1).
2. Judgment danach: `threat-modeler` (STRIDE-light) bzw. `mcp-security-reviewer` (Lethal Trifecta, Tool-Härtung).
3. Findings → Gegenmaßnahmen als AC (§33).

> **Lethal-Trifecta-Achsen (§33.1):** Die `cdp5-agents` sind **read-only** (Read/Grep/Glob, Bash nur lesend) → Achse (c) Egress + Schreib-/Mutations-Pfade entfallen; das Trifecta-Risiko ist strukturell entschärft.

**Fehlerfälle**

| Fall | Verhalten |
|---|---|
| Heuristik-Parser-False-Positive (mcp-config-lint/model-api) | als Hinweis kennzeichnen, `review-verify` gegenprüfen (§10.6) |
| Externes Scan-Tool (semgrep/syft) nicht installiert | dependency-freie Skills (secrets-scan) als Minimal-Gate; Lücke dokumentieren |

**Akzeptanzkriterien**

| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Secret-/Config-Funde mit Exit 1, redacted Output | Integration | grün |
| AC-2 | Lethal-Trifecta-Verdikt + Härtungs-Empfehlungen | Eval | rot |

### UC-06: Riskanten Diff gegnerisch reviewen (🔴-Slice)
**Akteur:** `Orchestrator` (delegiert `adversarial-auditor`, opus) · **Schritt-Typ:** Judgment

**Verhalten**
1. Bei 🔴-Slice: `adversarial-auditor` mit exaktem Target.
2. Auditor sucht den latenten Fehler-/Verlust-Pfad, macht eine empirische Gegenprobe, fällt Verdikt (JA/JA-m.-Einschr./NEIN).
3. Self-Review + grüne Tests zählen **nicht** als Ersatz (§11.4).

**Fehlerfälle**

| Fall | Verhalten |
|---|---|
| Keine empirische Gegenprobe konstruierbar | Auditor stoppt, listet Versuchtes, eskaliert an Operator (kein Verdikt aus Bauchgefühl) |
| Verdikt NEIN, aber Operator will mergen | Folge-Issue + Risiko-Vermerk; Merge-Verantwortung explizit beim Operator (§1.6) |
| Zeit-Budget (AC-2, < 5 min) überschritten | Auditor liefert Zwischenstand + offene Achsen; Operator entscheidet Fortsetzung/Eskalation |

**Akzeptanzkriterien**

| # | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-1 | Verdikt + ≥1 empirische Gegenprobe (Befehl+Ausgabe) | Eval | rot |
| AC-2 | Schritt-Laufzeit < 5 min | Metrik | rot |

---

## 4. Reife-Rubrik (für das „≥ 9,0/10"-Ziel)

Score = gewichteter Mittelwert (0–10) über: **Sachbearbeiter-Test** (0,2) · **Pflicht-Struktur vollständig** (0,2) · **UC-Schritte nummeriert + verzweigt** (0,15) · **AC-Tabelle je UC** (0,15) · **Fehlerfälle vollständig** (0,1) · **Nachweis-Konvention** §10.7 (0,1) · **Glossar/Vokabular** (0,1). Jede „Pflicht" ohne Nachweis-Typ = automatischer Abzug. ≥ 9,0 = implementierungsreif. Als §10.5-Policy verankert (Gewichte reproduzierbar, nicht nur Prosa): [`reife-rubrik.policy.md`](reife-rubrik.policy.md).

---

## 5. Mechanik — wie die drei Ziele systematisch erreicht werden

- **Effektiv:** (1) Determinismus-Gate (§32.9): entscheidbare Arbeit → T1 = 0 Modell-Token. (2) `cdp5-reference` JIT statt Voll-Doktrin. (3) Pointer-Briefs statt Paste (§32.8(2)). (4) Modell-Tier pro Worker (§32.3) — haiku für mechanisch. (5) Kontext-Hygiene + `/clear` (§28.6).
- **Schnell:** T1-Skills lokal in Sekunden; LLM-Schritte eng geschnitten; unabhängige Worker parallel (§32.10 nur wenn lohnend); kein Voll-Doktrin-Laden.
- **Genau:** konzept-reviewer (Rubrik §4) treibt 9,0/10; die drei Drift-Detektoren messen ≤3 Drifts; Doppel-Review (Self vor Commit + PR) + `review-verify` (§10.6) + `adversarial-auditor` bei 🔴.

---

## 6. Mess-Harness (§22.2)

Pro UC-Schritt erfasst: **Token** (`gen_ai.usage.total_tokens`, Sampling aus §15.1), **Latenz** (Wall-clock), **Score** (konzept-reviewer-Ausgabe), **Drifts** (Summe der Detektor-Exit-Reports). Aggregation als Tabelle (UC | Token | Zeit | Score | Drifts | Schwelle erfüllt?). T1-Schritte: Token = 0, Zeit = Skript-Laufzeit. Erwartete Kennzahlen: ≥ 90 % der Schritte unter Budget + < 5 min; Konzept-Score ≥ 9,0 nach ≤ 2 Iterationen.

---

## 7. Entitäten / Artefakte-Übersicht

| Artefakt | Typ | Tabelle/Ort |
|---|---|---|
| `cdp5-gates` | Plugin (13 T1-Skills) | `plugins/cdp5-gates/` |
| `cdp5-agents` | Plugin (5 Judgment-Agents) | `plugins/cdp5-agents/` |
| `cdp5-reference` | T1-Skill (Doktrin + Query) | `…/skills/cdp5-reference/` |
| Marketplace-Manifest | Config | `.claude-plugin/marketplace.json` (+ je Plugin `.claude-plugin/plugin.json`) |
| Skill-Struktur | Konvention | `plugins/<plugin>/skills/<name>/{SKILL.md, *.mjs, *.test.mjs}` |
| **Reife-Rubrik (Policy)** | §10.5-Artefakt | `docs/reife-rubrik.policy.md` — 7 Gewichte für „≥ 9,0" (UC-01), reproduzierbar |
| **CDP5-Doktrin (ausgeliefert)** | Wissensbasis | `…/cdp5-reference/konzept-design-pattern-v5.md` — **v5 (aktiv)**; v4.7 FROZEN, **nicht** gebündelt |

---

## 8. Verantwortungs-Matrix (§23.1)

| UC | KI-Anteil | Mensch-Validator | Validierungs-Mindset | Haftung |
|---|---|---|---|---|
| UC-01 Konzept-Review | 70 % (Vorschlag) | Architekt (Score-Sign-off) | hoch | Architekt |
| UC-02 Drift-Gate | 0 % (deterministisch) | Operator (entscheidet bei > 3) | mittel | Operator |
| UC-03/04 T1-Checks | 0 % | — | n/a | Systemverantwortlicher |
| UC-05/06 Security/Audit | 60 % | Security/Senior (Sign-off) | hoch | Security-Verantwortlicher |

Destruktive Aktionen (Push/Merge/Schema-Drop) nie auto — Operator (§1.6/§23).

---

## 9. Glossar (§14)

| Begriff | Definition | Anker |
|---|---|---|
| `T1-Skill` | Deterministisches Node-Programm, Output = Beleg, 0 Modell-Token | CDP5 §32.9 |
| `Judgment-Agent` | LLM-Subagent für Urteils-Arbeit, Findings + Vorschläge | CDP5 §32 |
| `Drift` | Konzept-Artefakt, das im Code abweicht/fehlt | konzept-mapper/-model-api |
| `Reife-Score` | gewichteter 0–10-Wert der Implementierungsreife (7-Dim-Rubrik) | §4 (Rubrik) · `reife-rubrik.policy.md` · CDP5 §10.5 |
| `Orchestrator` | Main-Session: wählt Modus, delegiert, fährt Skills, verifiziert, hält Mensch-Gates | CDP5 §32 |
| `Operator` | Mensch mit Merge-/Push-Verantwortung + Final-Sign-off | CDP5 §1.6 / §23 |
| `JIT-Retrieval` | nur den nötigen Doktrin-Ausschnitt laden | CDP5 §28.6 |
| `Lethal Trifecta` | sensible Daten + untrusted Content + Egress | CDP5 §33.1 |
| Drift-Detektoren | `konzept-mapper` · `konzept-model-api` · `roadmap-drift` (T1) | messen die Drift-Zahl (UC-02) |
| Audit-/Security-Agents | `adversarial-auditor` · `threat-modeler` · `mcp-security-reviewer` (T2) | Judgment in UC-05/06 |

---

## 10. Anti-Patterns (was vermieden wird)

- Entscheidbare Aufgabe als Agent statt T1-Skill fahren (Token + Latenz verbrannt, §32.9).
- Volldoktrin in jeden Prompt laden statt `cdp5-reference` JIT (§28.6).
- Score/Findings ungeprüft übernehmen (§10.6 verletzt).
- > 3 Drifts „durchwinken" ohne Issue/Konzept-Update.
- Projekt-/framework-spezifischen Code in den Marketplace bringen (Negativ-Anforderung → grep-Gate).

---

## 11. Risiken / Known Issues (§22.4)

- Heuristische Parser (mcp-config-lint, konzept-model-api YAML-Scanner) → Befunde sind Hinweise, vom Orchestrator zu verifizieren (§10.6).
- **`pii-scan` ist Hybrid:** der Regex-Detektor ist deterministisch, die *semantische* PII-Einstufung (Name vs. Zufallsstring) braucht ein `review-verify`-Overlay — kein finaler Wahrheits-Gate allein.
- Score-/Drift-Messung gegen ein **CDP5-konformes** Konzept (nummerierte UCs, Backtick-Artefakte) — nicht-konforme Konzepte liefern n/a (Konzept-Bug, zurück an UC-01).
- Token-/Latenz-Budgets sind Richtwerte; pro Repo-Größe kalibrieren.
- **Scope-Ehrlichkeit:** das eigentliche **Coding** deckt der Marketplace **nicht** ab (projektgebundene lokale impl-Agents). Die „< 5 min/Schritt" beim Coden hängen am **Vertical-Slicing** (§27.2), nicht an diesen Tools — der Marketplace sichert die Stufen *um* das Coding (Konzept · Test-Scaffold · Drift · Review · Security).

---

## 12. Changelog

**v1.0 (Mai 2026):** Erstkonzept. Ziele effektiv/schnell/genau quantifiziert (§1), 6 UCs mit AC, Reife-Rubrik (§4), Mechanik (§5) + Mess-Harness (§6). Bezug: CDP5 v5 (§32.9 Determinismus, §28.6 Kontext-Economy, §33 Sicherheit, §10/§22 Score/PoC).
**v1.1 (Mai 2026, Dogfood-Review-Patch):** Konzept vom `konzept-reviewer` gescored (8,4 → Ziel ≥9,0). Geschlossen: §2.6 Probabilistik- + §2.7 Vendor-Risiko-Statement als Pflicht-Tabellen (je UC); Fehlerfälle-Tabellen für UC-03/04/05/06; T1-Skill-Vertrag (UC-03); Lethal-Trifecta-Achsen-Ausweis (UC-05/06, read-only → entschärft); Glossar +Drift-Detektoren/Audit-Agents; §7 Anhang +Skill-Struktur +ausgelieferte CDP5-Version (v5). Offen (Architekt, §1.9): finale EU-AI-Act-Klassen-Bestätigung.

**v1.2 (Mai 2026, Simulations-Patch):** Aus 5 fiktiven Durchläufen präzisiert: §1 „Schnell" = **< 5 min je interaktivem Schritt** (voller Eval = CI-Batch, kein „Schritt"); §1 „Genau" = ≥ 9,0 **nach ≤ 2 Iterationen**; neue **4. Zeile „Sicher"** (0 offene 🔴-Security-Findings, separat von der Drift-Zahl). UC-05 + §11 `pii-scan` als Hybrid (deterministischer Regex + `review-verify`-Overlay, kein finaler Wahrheits-Gate). +Scope-Ehrlichkeit (Coding-Qualität hängt am Vertical-Slicing, nicht am Skill allein).

**v1.3 (2026-05-26, Re-Score-Patch):** `konzept-reviewer`-Re-Score = 9,0/10 (Goal erreicht, exakt auf Schwelle). Für Puffer geschlossen: Kopf-Versions-Drift (1.0 → 1.3, Self-Dogfood des eigenen Drift-Gates UC-02); §7 Skill-Count 9 → **12** (stale); §2.2 UC-Übersicht; Glossar +`Orchestrator`/`Operator` + `Reife-Score`-Anker auf §4/§10.5 geschärft; Timeout-/Budget-Fehlerfälle für UC-01/UC-06; AC-2 (UC-01) an Mess-Harness §6 gebunden (testbar); **Reife-Rubrik als §10.5-Policy** `reife-rubrik.policy.md` verankert (reproduzierbar, nicht nur Prosa). Offen (Architekt, §1.9): EU-AI-Act-Klassen-Bestätigung.

**v1.4 (2026-05-26, profile-check):** Neuer T1-Skill `profile-check` (§7 Count 12 → 13) — setzt „Default einmal setzen, danach nur Konformitäts-Checks" um: ein Projekt deklariert Vorgaben einmal in `project-profile.md` (YAML-Frontmatter: EU-AI-Act-Klasse, security_level, Runtime, Test-Framework, Pflicht-Tokens), der Skill verifiziert Konzept + Repo deterministisch dagegen statt neu zu fragen. Löst den offenen EU-AI-Act-Punkt strukturell (Architekt setzt die Klasse einmal im Profil). Fällt unter UC-03 (kein neuer UC). 7 Tests, Dogfood gegen claude-skills selbst grün. Re-Score v1.4 = **9,7/10**.
