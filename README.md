# claude-skills

Ein **Claude-Code-Plugin-Marketplace** mit projektunabhängigen, deterministischen Werkzeugen nach **CDP5 §32.9** (Skill-Determinismus-Gate): entscheidbare, wiederholte Tätigkeiten laufen als **programmierte T1-Skills** (Node.js, host-seitig) statt über ein LLM — gleicher Input → gleiches Ergebnis, der Output *ist* der Beleg.

## Installation (für Kolleg:innen)

```
/plugin marketplace add SmR492/claude-skills
/plugin install cdp5-gates@claude-skills
```

## Plugin `cdp5-gates` — read-only deterministische Skills (T1)

| Skill | Was | Aufruf-Kern |
|---|---|---|
| **konzept-mapper** | UC↔Code-Mapping (✓/teilweise/fehlt) | `--konzept=… --repo=…` |
| **wiki-lint** | Broken-Links · Orphans · Frontmatter-Konsistenz | `--wiki=…` |
| **konzept-model-api** | Enum-Drift + Modell↔OpenAPI-Property-Diff | `--repo=… --openapi=…` |
| **test-gap** | sicherheitskritische Klassen (Voter/State-Processor/Authenticator) ohne Test | `--repo=…` |
| **roadmap-drift** | als FERTIG markierte Roadmap-Artefakte real im Code? | `--roadmap=… --repo=…` |
| **retro-memory-loop-check** | in Retro-ADRs zitierte Memory-Slugs real angelegt + Pointer? | `--retro=… --memory=…` |
| **mcp-config-lint** | MCP-Config-Risiken (Tool-Poisoning, Rug-Pull, Cleartext-Secrets) | `--config=…` |
| **secrets-scan** | Klartext-Secrets im Repo (Keys/Tokens/Private-Keys/.env) | `--repo=…` |
| **cdp5-reference** | CDP5-Doktrin abfragbar nach §-Nummer oder Schlagwort (just-in-time, statt 2000 Zeilen) | `--section=… \| --keyword=… \| --list` |
| **konzept-lint** | Konzept-Struktur + AC-Tabellen + binär/verifizierbare AC + bedingt LLM-/RAG-Felder + deterministischer Teil-Score (konfig. Rubrik) | `--konzept=… [--rubric=…]` |
| **ac-to-test-scaffold** | failing Test-Skelette AUS den Konzept-AC (TDD-First, druckt read-only) | `--konzept=… [--lang=php\|js]` |
| **pii-scan** | Klartext-PII (E-Mail/IBAN/Telefon/Kreditkarte+Luhn), redacted, Hybrid | `--repo=…` |
| **profile-check** | Konzept + Repo gegen einmal deklariertes `project-profile.md` (EU-AI-Act/Security/Runtime/Test-Framework/Pflicht-Tokens) | `--profile=… [--konzept=… --repo=…]` |

Alle Skills sind **read-only**, **parametrisiert** (kein projektspezifischer Pfad/Code eingebacken) und **dependency-frei** (nur `node:`-Builtins). Jeder liefert einen Report; der Main-Agent handelt darauf.

## Plugin `cdp5-agents` — projektunabhängige Judgment-Agents

| Agent | Was |
|---|---|
| **konzept-reviewer** | Gap-Analyse + Reife-Score eines Konzepts (CDP5 §2/§7/§10) |
| **review-verify** | Behauptungen gegen Quelle/Code verifizieren (§10.6) |
| **adversarial-auditor** | gegnerischer Review für 🔴-Slices + empirische Gegenprobe (§11.4) |
| **threat-modeler** | STRIDE-light über Entry-Points/Trust-Boundaries (§33.4) |
| **mcp-security-reviewer** | MCP-Integration: Lethal Trifecta, Tool-Härtung, Maturity (§33.1/§33.3/§16.8) |

Agents sind **read-only** (Findings + Vorschläge, keine destruktiven Aktionen), self-contained (Methode inline) und projektunabhängig.

**Pflicht-Vorlauf:** Jeder Agent holt sich vor der Arbeit den nötigen CDP5-Kontext über das `cdp5-reference`-Skill (Abfrage per § / Schlagwort) bzw. liest/grept die gebündelte Doktrin — so hat er den vollen Kontext, ohne dass die 2000-Zeilen-Doktrin in jeden Prompt geladen werden muss (CDP5 §28.6 just-in-time-Retrieval). Den Pfad gibt der aufrufende Orchestrator im Brief mit (Subagents bekommen keine Skills durchgereicht, lesen die Datei aber direkt).

## Tests

```bash
node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs
```

## Lizenz / Beitrag

Projektunabhängig gehalten — enthält keine Struktur oder Code konkreter Projekte. PRs willkommen.
