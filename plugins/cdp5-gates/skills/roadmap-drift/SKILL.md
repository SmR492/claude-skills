---
name: roadmap-drift
description: Read-only roadmap↔code drift check. Deterministically verifies that every artefact a roadmap/plan file marks as DONE really exists in the code. Use for "check roadmap against code", before sprint planning, "are the planned things really built".
---

# roadmap-drift (CDP5 T1 gate)

Prevents the anti-pattern "the plan lists already-built code as not started" or "the plan claims symbols that do not exist" (CDP5 §25 / §28.5).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/roadmap-drift/roadmap-drift.mjs" --roadmap=<roadmap.md> --repo=<root> [--json]
```

Exit: `0` no drift · `1` ≥1 DONE artefact missing · `2` usage error.

## Convention

A line counts as DONE when it carries a marker (`✅`, `GESCHLOSSEN`, `EXISTIERT`, "umgesetzt", "geliefert", "gelandet", or the English `DONE`, `CLOSED`, `EXISTS`, "implemented", "delivered", "landed") and no negation (`❌`, `🔴`, `🟡`, "nicht"/"not", "offen"/"planned", `TODO`, `TBD`, …); the `` `…` `` tokens in it (paths, classes, routes) are checked against the repo. Non-verifiable tokens (CLI commands, flags, snake_case) are skipped. The German markers are kept because real roadmaps are written in German.
