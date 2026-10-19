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

Exit: `0` no 🔴 (no UC fully missing) · `1` ≥1 🔴 (a UC whose artefacts are all missing) · `2` usage or input error.

Every UC is printed as a finding with its status and severity — 🟢 `✓`/`n/a`, 🟡 `partial`, 🔴 `missing` — followed by one line per artefact: `found (decl)` (declaration in a code file), `found (path)` (file exists / route literal in code), `weak` (bare word occurrence only, e.g. in a YAML comment or `composer.json`) or `missing`, each with its evidence file. `--json` returns `[{ uc, id, line, status, sev, found, total, weak[], missing[], artefacts[{ token, kind, state, strength, evidence }] }]`.

## Convention (what the core works on)

- A **UC** is a `## UC-…` or `### UC-…` section (shared parser `parseUCs` in `lib/scan.mjs`, the same one `ac-to-test-scaffold` uses; H3 UCs usually sit under `## N. Use Cases`). Any other H1/H2 heading ends it; H3 sub-headings such as `### Akzeptanzkriterien` stay inside.
- **Verifiable artefacts** are written in `` `…` `` backticks: paths (`src/Foo.php`), classes/symbols (`Article`, `Foo\Bar`, `Class::method`), routes (`/api/items`). CLI commands / flags / snake_case values are skipped (not verifiable).
- Status per UC: **✓** every artefact found by declaration or path · **partial** some found, or at least one only **weak** · **missing** none found · **n/a** nothing verifiable. A weak hit never yields ✓: a class name in a comment is not an implementation.

## Afterwards (main agent, not the skill)

The skill only detects. Assessing gaps / catching the code up / updating the concept remains LLM/human work (CDP5 §32.9: deterministic core, LLM as interpretation shell).
