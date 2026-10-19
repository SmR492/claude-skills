---
name: konzept-model-api
description: Read-only model↔API drift detector. Diffs PHP enum cases against OpenAPI enum arrays and PHP entity properties against OpenAPI schema properties (of the same name). Use for "enum drift", "check model against OpenAPI", "API consistency", end of sprint.
---

# konzept-model-api (CDP5 T1 gate)

The deterministic diff part of the former `konzept-model-api` agent as a program (CDP5 §32.8(1) explicitly names enum drift + model↔OpenAPI diff as deterministic). The semantic **concept vocabulary drift** assessment (same term, different meaning) remains LLM/human work.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-model-api/model-api-drift.mjs" \
  --repo=<repo-root> --openapi=<path/openapi.yaml> [--json]
```

Exit: `0` no drift · `1` drift found · `2` usage error.

## Checks (name match, normalised)

- **Enum drift** — PHP `enum X { case … }` (backing value or case name) ↔ OpenAPI `enum: […]` of the same name; reports a missing counterpart + differing value sets.
- **Property drift** — PHP entity properties (`private/protected/public … $x`) ↔ OpenAPI schema `properties:` of the same name; reports "only OpenAPI" / "only entity".

## Limits (dependency-free)

The OpenAPI parser is a compact line scanner (not a full YAML parser): it captures `components.schemas.*.properties` and `enum` blocks/inline arrays. It may be imprecise for exotic YAML constructs — findings are hints that the main agent verifies (CDP5 §10.6).
