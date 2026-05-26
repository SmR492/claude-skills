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
| Wiki-Health (Broken-Links/Orphans) | `wiki-lint` |
| ungetestete sicherheitskritische Klassen | `test-gap` |
| Retro→Memory-Loop prüfen | `retro-memory-loop-check` |
| Projekt-Defaults gegen Profil prüfen | `profile-check` |
| CLAUDE.md an den Marketplace anbinden/updaten | `cdp5-init` |
| Konzept-Reife/Gap-Review (Judgment) | `konzept-reviewer` |
| Behauptungen gegen Code/Quelle verifizieren | `review-verify` |
| gegnerischer Review eines 🔴-Slices | `adversarial-auditor` |
| Threat-Modeling / MCP-Security | `threat-modeler`, `mcp-security-reviewer` |

### Werkzeuge

- **`cdp5-gates`** (deterministische, read-only T1-Skills): konzept-lint · ac-to-test-scaffold · konzept-mapper · konzept-model-api · roadmap-drift · secrets-scan · pii-scan · mcp-config-lint · wiki-lint · test-gap · retro-memory-loop-check · profile-check · cdp5-init · cdp5-reference.
- **`cdp5-agents`** (Judgment, read-only): konzept-reviewer · review-verify · adversarial-auditor · threat-modeler · mcp-security-reviewer.
