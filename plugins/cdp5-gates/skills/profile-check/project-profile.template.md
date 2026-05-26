---
# project-profile — einmal vom Architekten gesetzt, danach via `profile-check` nur noch verifiziert.
# Kopieren in das Zielprojekt (z. B. nach docs/ oder Repo-Wurzel), Werte anpassen, Kommentar-Zeilen optional.
project: <Projektname>

# Regulatorik / Sicherheit (Architekt-Entscheidung, §1.9/§23)
eu_ai_act_class: minimal      # minimal | limited | high | prohibited
security_level: standard      # standard | elevated  (elevated → Threat-Modeling §33.4 im Konzept Pflicht)
pii_policy: none              # none | redacted | allowed  (informativ; vgl. pii-scan)

# Tooling / Runtime (erwartete Marker im Repo)
runtime: node                 # node | php | python
test_framework: node:test     # node:test | phpunit | jest | vitest | pytest

# Sprache / Konventionen (informativ)
code_language: en             # Identifier-Sprache
doc_language: de

# Pflicht-Tokens, die jedes Konzept dieses Projekts enthalten muss (freie Liste):
require_in_concept:
  - Probabilistik-Statement
  - Vendor-Risiko
  - Glossar
---

# Projekt-Profil: <Projektname>

Kurze Begründung der oben gesetzten Defaults (warum diese EU-AI-Act-Klasse, warum dieses Sicherheits-Level …).
`profile-check` verifiziert Konzepte/Code gegen das Frontmatter — diese Prosa ist für den Menschen.
