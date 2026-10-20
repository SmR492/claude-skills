---
name: konzept-model-api
description: Read-only model↔API drift detector. Diffs PHP enum cases against OpenAPI enum arrays and PHP entity properties against OpenAPI schema properties (of the same name). Use for "enum drift", "check model against OpenAPI", "API consistency", end of sprint.
---

# konzept-model-api (CDP5 T1 gate)

The deterministic diff part of the former `konzept-model-api` agent as a program (CDP5 §32.8(1) explicitly names enum drift + model↔OpenAPI diff as deterministic). The semantic **concept vocabulary drift** assessment (same term, different meaning) remains LLM/human work.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-model-api/konzept-model-api.mjs" \
  --repo=<repo-root> --openapi=<path/openapi.yaml> [--strict] [--json]
```

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error.

Every finding is printed with a severity; `--json` returns the finding array `[{ sev, type: enum|property, name, issue }]`.

| Finding | Severity |
|---|---|
| PHP enum and OpenAPI enum of the same name have different value sets | 🔴 |
| Entity and schema of the same name have different property sets | 🔴 |
| PHP enum without an OpenAPI counterpart | 🟡 (informational: many enums are internal) · 🔴 with `--strict` |

An entity without a schema of the same name is not reported (the mapping of entities to API resources is not 1:1).

## Checks (name match, normalised: case, `_`, `-` and whitespace ignored)

- **Enum drift** — PHP `enum X { case … }` (backing value if present, otherwise the case name) ↔ OpenAPI `enum: […]` (inline array or block list) whose owning key has the same name.
- **Property drift** — PHP entity properties ↔ OpenAPI `components.schemas.<Name>.properties` of the same name; reports "only OpenAPI" / "only entity". A property is any `private|protected|public [static] [readonly] [type] $name` declaration inside the class slice, so untyped (`private $x`) and static (`private static int $x`) properties are seen; promoted constructor properties count as properties.

## Limits (dependency-free)

The OpenAPI parser is a compact line scanner (not a full YAML parser): it captures `components.schemas.*.properties` and `enum` blocks/inline arrays. It may be imprecise for exotic YAML constructs — findings are hints that the main agent verifies (CDP5 §10.6).
