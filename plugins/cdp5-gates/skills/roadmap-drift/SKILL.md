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

Exit: `0` no 🔴 (every claimed artefact found) · `1` ≥1 🔴 (claimed artefact missing) · `2` usage or input error.

Every claimed artefact is printed as a finding: 🔴 `MISSING` or 🟢 `found` (with the evidence file and whether the hit is a declaration, a path or a bare occurrence). `--json` returns `{ results[{ token, line, kind, found, strength, evidence, sev }], missing, drift, scanned }`.

## Convention

- A line counts as DONE when it carries a marker: `✅`, or one of the words `GESCHLOSSEN`, `EXISTIERT`, "umgesetzt", "geliefert", "gelandet", `DONE`, `CLOSED`, `EXISTS`, "implemented", "delivered", "landed". Words are matched case-insensitively as **whole words** (`ABANDONED` is not `DONE`, `unimplemented` is not `implemented`). The German markers are kept because real roadmaps are written in German.
- A marker is cancelled by a negation (`❌`, `🔴`, `🟡`, "nicht"/"not", "kein", "offen"/"planned", "pending", `TODO`, `TBD`, "geplant") only when the negation appears **within the 20 characters before that marker** ("nicht umgesetzt", "❌ DONE"). Text after the marker does not cancel it: "✅ `App\Real` implemented, not yet documented" is a claim about `App\Real`.
- The `` `…` `` tokens of a DONE line (paths, classes, `Foo\Bar`, `Class::method`, routes) are checked against the repo with the shared `locate()` of `lib/scan.mjs`. Non-verifiable tokens (CLI commands, flags, snake_case) are skipped. The roadmap file itself is excluded from the search.

## Limits

A bare word occurrence (class name in a YAML comment, in `composer.json`) counts as found but is reported with `strength: occurrence`; read the evidence before trusting a 🟢 for such a hit.
