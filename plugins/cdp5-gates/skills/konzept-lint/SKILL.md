---
name: konzept-lint
description: Read-only lint of a concept document against the deterministic part of the maturity policy. Decides the gate items a program can decide (numbered steps, head, error tables, lifecycle, probabilistic statement, AC tables, glossary, changelog), flags vague acceptance criteria and missing evidence types, and reports the deterministic dimension scores. Run it before konzept-reviewer, on "lint the concept", "is the spec structurally complete".
---

# konzept-lint (CDP5 T1 gate)

The deterministic first pass of the concept review. It reads the maturity policy (`policy/reife-rubrik.policy.json`, generated from `policy/reife-rubrik.policy.md`), decides every gate item of kind `det`, scores the deterministic dimensions and leaves the judgment items and the final verdict to `konzept-reviewer`. Zero model tokens, reproducible output, the output is the evidence.

## Usage

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-lint/konzept-lint.mjs" --konzept=<konzept.md> [--rubric=<policy.json>] [--json]
```

Exit codes: `0` every deterministic gate item passes · `1` at least one fails (not ready regardless of score) · `2` usage error (missing file, unreadable policy).

`--rubric` takes a project's own policy JSON (same schema, generated from the project's copy of the Markdown policy) or a legacy `{"weights": {…}}` file; without it the plugin's default policy applies.

## What it decides

- Gate (layer 1): G1 numbered steps in every UC, G2 head with Version and Scope, G3 error-case table per UC, G4 status lifecycle, G6 probabilistic statement when LLM UCs exist, G7 AC table per UC, G8 glossary, G9 changelog. G5, G10 and G11 are judgment items and are listed as such.
- Dimensions (layer 2): `struktur`, `uc_schritte`, `ac` (minus 2 per vague criterion row: should, ideally, roughly, etc.), `fehlerfaelle`, `nachweis` (mandatory statements with an evidence type), `glossar`. Each is the fraction of checks met on a 0–10 scale.
- Conditional fields: an LLM UC needs the probabilistic statement and the §13.1 fields (context, output, validation, fallback, cutoff); a RAG UC the §20.3 fields (chunking, embedding, retriever, caching, invalidation). Both feed `struktur`.

## Output

Gate list with pass/fail per item, per-UC findings, dimension scores, the deterministic contribution (out of the deterministic weight) and the normalized partial score. The threshold and the judgment dimension belong to the reviewer; the lint never declares "ready".

## Limits

Presence, not completeness: a present error table may still miss cases; that is the reviewer's dimension score. Headings are matched in German and English (Fehlerfälle/Error cases, Glossar/Glossary, Rollen/Roles). The evidence-type check looks at lines containing "Pflicht" or "mandatory".
