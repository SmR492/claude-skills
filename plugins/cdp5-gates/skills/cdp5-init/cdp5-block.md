<!-- Von `cdp5-init` verwalteter Block. Nicht von Hand editieren — `cdp5-init` aktualisiert ihn. -->
## CDP5 + claude-skills-Marketplace

Nicht-triviale Aufträge werden nach **CDP5** orchestriert (Konzept → Design → Implementation → Testing → Review), nicht ad hoc ausgeführt.

**cdp5-reference-Gate (Pflicht-Vorlauf):** Vor jeder Aufgabe den nötigen CDP5-Doktrin-Ausschnitt **just-in-time** laden statt anzunehmen —
`node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --section=<§> | --keyword=<Begriff> | --list`. Bei Unklarheit/offener Entscheidung in den Dialog mit dem Nutzer (Clarify-First).

**Entscheidbar + wiederholt → deterministischer T1-Skill (kein LLM-Rateweg). Urteilsarbeit → Judgment-Agent. Schreiben/Mergen/Pushen → nur mit Mensch-Bestätigung.**

### Trigger-Map (Aussage → Werkzeug)

| Aussage / Bedarf | Werkzeug (`cdp5-gates` Skill / `cdp5-agents` Agent) |
|---|---|
| „ist die Spec strukturell vollständig", Reife-Teilscore | `konzept-lint` |
| Tests aus Konzept-AC erzeugen (TDD-First) | `ac-to-test-scaffold` |
| Konzept ↔ Code-Mapping / Drift | `konzept-mapper`, `konzept-model-api`, `roadmap-drift` |
| Klartext-Secrets / PII im Repo | `secrets-scan`, `pii-scan` |
| MCP-Config-Risiken | `mcp-config-lint` |
| MCP-Tool-Description vs. Input-/Output-Felder (Consumer-Sycophancy-Schutz) | `mcp-doc-drift-gate` |
| numerische Konstanten in Konzept-Prosa vs. Code-Spec (Paritäts-Drift) | `konzept-const-sync` |
| Wiki-Health (Broken-Links/Orphans) | `wiki-lint` |
| ungetestete sicherheitskritische Klassen | `test-gap` |
| Retro→Memory-Loop prüfen | `retro-memory-loop-check` |
| Projekt-Defaults gegen Profil prüfen | `profile-check` |
| CLAUDE.md an den Marketplace anbinden/updaten | `cdp5-init` |
| Konzept-Reife/Gap-Review (Judgment) | `konzept-reviewer` |
| Behauptungen gegen Code/Quelle verifizieren | `review-verify` |
| gegnerischer Review eines 🔴-Slices | `adversarial-auditor` |
| Threat-Modeling / MCP-Security | `threat-modeler`, `mcp-security-reviewer` |
| Projekt-/Domänen-Wissen abrufen (read-before-act) bzw. verifiziert zurückschreiben | nsai-edge-MCP: lesen `graph__query_knowledge`/`graph__resolve_belief`/`graph__search`/`graph__recall_episodes` · schreiben `graph__store_triple`/`graph__record_episode`/`graph__endorse` · gefährlich/fremd → `graph__propose_*` + CLI `approve` (Two-Door) |

### Werkzeuge

- **`cdp5-gates`** (deterministische, read-only T1-Skills): konzept-lint · ac-to-test-scaffold · konzept-mapper · konzept-model-api · konzept-const-sync · roadmap-drift · secrets-scan · pii-scan · mcp-config-lint · mcp-doc-drift-gate · wiki-lint · test-gap · retro-memory-loop-check · profile-check · cdp5-init · cdp5-reference.
- **`cdp5-agents`** (Judgment, read-only): konzept-reviewer · review-verify · adversarial-auditor · threat-modeler · mcp-security-reviewer.

### Wissens-Abruf & Form/Inhalt-Trennung

**1. Faktischer Inhalt — kaskadierende Quellen-Hierarchie** (für **nicht-triviale Fakten der Projekt-/Domänen-Ebene**: Behauptungen, Definitionen, Zahlen, technische Constraints — das *WAS*; triviale/universelle Fakten wie Sprach-Syntax brauchen KEINEN Lookup):
1. **Tier 1 — registrierte MCP-Server / lokale Projekt-Wissensbasis (NUR via MCP):** primäre Wahrheitsquelle für kuratiertes Projekt-/Domänen-Wissen. **Kein DB-/Daten-Datei-Direktzugriff** — der MCP-Server ist die einzige gegatete Trust-Boundary. **Etablierte Wissensbasis = `nsai-edge`** (lokaler Defeasible-Wissensgraph): **read-before-act** — vor nicht-trivialer Arbeit zuerst hier nachschlagen. MCP-Tools tragen den `graph__`-Präfix (Harness-vollständig: `mcp__nsai-edge__graph__…`): `graph__query_knowledge` · `graph__search` · `graph__resolve_belief` (liefert Gewinner + `contested`/`contestation`) · `graph__recall_episodes` · `graph__verify` · `graph__trust_of`. Belief-Verdikte sind defeasible: `contested`/Provenienz mitlesen, nicht blind als wahr nehmen.
2. **Tier 2 — Web / externe Docs (WebSearch/Fetch, context7):** wenn Tier 1 nicht ausreicht — aktuelle/externe Fakten + Bibliotheks-Doku.
3. **Tier 3 — internes Trainingswissen:** NUR letzter Fallback, wenn 1+2 erschöpft sind; als unbestätigt kennzeichnen.

**Rückschreib-Pflicht (Wissens-Akkumulation):** Was in Tier 1 (MCP) FEHLTE, aber über Tier 2 (Web) gefunden wurde, MUSS **verifiziert** (gegen Leitplanken + Realität, nie blind übernehmen) und dann **VOLLSTÄNDIG** (nicht fragmentarisch) via MCP in die Wissensbasis eingetragen werden — mit Provenienz (Quelle + Quelltyp `web`/`fachquelle`), sodass es beim nächsten Lookup Tier 1 ist. So wächst der kuratierte Graph; das Modell rät nicht zweimal dasselbe. **Schreib-Tools (nsai-edge, `graph__`-Präfix):** kuratierte Fakten via `graph__store_triple` (mit `source_type`-Provenienz) · Erkenntnisse/Verläufe via `graph__record_episode` · Korroboration eines bestehenden Fakts via `graph__endorse` (Anzahl-Achse, gedeckelt). **Two-Door-Grenze (KI schreibt vs. Mensch vollzieht):** Die KI darf FREMDE Fakten/Trust NIE autonom herabstufen/retraktieren — gefährliche Änderungen laufen über `graph__propose_*` (`graph__propose_reject` · `graph__propose_supersede_temporal` · `graph__propose_set_validity` · `graph__propose_authority_endorse` · `graph__propose_peer_trust` · `graph__propose_promote_fiction`) → Mensch-Vollzug an der CLI (`review`/`approve`). Anfechtung via `graph__contest` (kippt nur das `contested`-Verdikt, senkt nie Trust). Eigene Fakten (self-origin) darf die KI direkt pflegen.

**2. Form, Logik, Prosa — Modell direkt (kein Lookup):** das *WIE* — syntaktisch korrekter Code/Struktur/Format; algorithmisches Schließen, Chain-of-Thought, Constraint-Auswertung; Satzbau, Ton, Übersetzung.

**Harte Grenze (Form ≠ Inhalt):** Modell-Parameter fürs *WIE*, die Tier-1–3-Hierarchie fürs *WAS*. So bleibt nachvollziehbar trennbar, was die KI *formuliert* und was als *Fakt* (provenienz-getrackt) behauptet wird — die Provenienz-/Autoritäts-Achse des Wissensmodells (Mensch/Autorität vs. KI/Ingest).
