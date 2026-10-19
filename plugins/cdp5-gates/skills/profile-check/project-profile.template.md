---
# project-profile — set once by the architect, afterwards only verified via `profile-check`.
# Copy into the target project (e.g. docs/ or the repo root), adjust the values, comment lines are optional.
project: <project name>

# Regulatory / security (architect decision, §1.9/§23)
eu_ai_act_class: minimal      # minimal | limited | high | prohibited
security_level: standard      # standard | elevated  (elevated → threat modeling §33.4 mandatory in the concept)
pii_policy: none              # none | redacted | allowed  (informational; cf. pii-scan)

# Tooling / runtime (expected markers in the repo)
runtime: node                 # node | php | python
test_framework: node:test     # node:test | phpunit | jest | vitest | pytest

# Language / conventions (informational)
code_language: en             # identifier language
doc_language: de

# Required tokens that every concept of this project must contain (free-form list;
# the examples below are the German section titles used in the CDP5 concept template —
# replace them with the headings your concepts actually use):
require_in_concept:
  - Probabilistik-Statement
  - Vendor-Risiko
  - Glossar
---

# Project profile: <project name>

Short rationale for the defaults set above (why this EU AI Act class, why this security level …).
`profile-check` verifies concepts/code against the frontmatter — this prose is for humans.
