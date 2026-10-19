---
name: konzept-mapper
description: Read-only concept↔code mapping. Produces a deterministic table of which UCs of a concept document exist in the code (✓/partial/missing). Use for "map concept against code", "which UCs are implemented", end-of-sprint inventory, before strategic decisions.
---

# konzept-mapper (CDP5 T1 gate)

Deterministic detector — replaces the former `konzept-mapper` agent. The output is the evidence; **no** LLM judgement in the core. The main agent runs the program and acts on the report.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-mapper/konzept-mapper.mjs" \
  --konzept=<path/to/konzept.md> --repo=<repo-root> [--json]
```

Exit: `0` no fully missing UC · `1` ≥1 UC "missing" (drift) · `2` usage error.

## Convention (what the core works on)

- A **UC** is a `## UC-…:` section (any other `#`/`##` heading ends it).
- **Verifiable artefacts** are written in `` `…` `` backticks: paths (`src/Foo.php`), classes/symbols (`Article`, `Foo\Bar`, `Class::method`), routes (`/api/items`). CLI commands / flags / snake_case values are skipped (not verifiable).
- Status per UC: **✓** all artefacts found · **partial** some · **missing** none · **n/a** nothing verifiable.

## Afterwards (main agent, not the skill)

The skill only detects. Assessing gaps / catching the code up / updating the concept remains LLM/human work (CDP5 §32.9: deterministic core, LLM as interpretation shell).
