---
name: konzept-lint
description: Read-only lint of a concept document against the deterministic part of the maturity policy. Decides the gate items a program can decide (numbered steps, head, Actor and Route per UC, error-case tables, lifecycle, roles overview, probabilistic and vendor-risk statements, AC tables, glossary, entity overview, responsibility matrix, changelog), flags vague acceptance criteria and missing evidence types, and reports the deterministic dimension scores. Run it before konzept-reviewer, on "lint the concept", "is the spec structurally complete".
---

# konzept-lint (CDP5 T1 gate)

The deterministic first pass of the concept review. It reads the maturity policy (`policy/reife-rubrik.policy.json`, generated from `policy/reife-rubrik.policy.md`), decides every gate item of kind `det`, scores the deterministic dimensions and leaves the judgment items and the final verdict to `konzept-reviewer`. Zero model tokens, reproducible output, the output is the evidence. German and English concepts are read alike; every pattern accepts both.

## Usage

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-lint/konzept-lint.mjs" --konzept=<konzept.md> [--rubric=<policy.json>] [--json]
```

Exit codes: `0` every deterministic gate item passes (no 🔴) · `1` at least one fails (not ready regardless of score) · `2` usage error (missing file, unreadable policy).

`--rubric` takes a project's own policy JSON (same schema, generated from the project's copy of the Markdown policy) or a legacy `{"weights": {…}}` file; without it the plugin's default policy applies. The lint and the policy list the same deterministic check names; a det row without a lint check is reported as such instead of passing silently.

## What it decides

Gate (layer 1), deterministic items:

| id | item | how the lint decides |
|---|---|---|
| G1 | numbered, branched steps per UC | a `1.` line followed later in the UC by `2.` or `1.1` |
| G2 | document head | `**Version:**` and `**Scope:**` / `**Geltungsbereich:**` / `**Umfang:**` |
| G3 | error-case table per UC | a heading containing Fehlerfälle / Error cases followed by a table row within five lines and before the next heading; prose fails |
| G4 | status lifecycle | a lifecycle section (Lifecycle, Lebenszyklus, stateDiagram, Statusdiagramm, Zustandsdiagramm, Status-Übergänge, state transitions) or the sentence `No status lifecycle: <reason>` / `Kein Status-Lebenszyklus: <Grund>` (§3 makes the lifecycle optional) |
| G5a | roles overview present | a heading containing Rollen / Roles, or a table whose first column is Rolle / Role |
| G6 | probabilistic statement | only when the concept has LLM UCs: `Probabilistik-Statement` / `Probabilistic statement` / `Probabilistics Statement` |
| G7 | AC table per UC | at least one table row starting with `AC-n` |
| G8 | glossary present | a heading containing Glossar / Glossary |
| G9 | changelog | a Changelog heading or `**Changelog`, or the parsed `**Version:**` is below 2.0 (§6: mandatory from v2.0); without a parsable version the changelog is required |
| G12 | Actor and Route per UC | `**Actor:**` / `**Akteur:**` and `**Route:**` in the UC body |
| G13 | vendor risk statement | only when the concept has LLM UCs: Vendor Risk / Vendor-Risiko |
| G14 | entity overview | a heading containing Entity / Entities / Entität (§5) |
| G15 | responsibility matrix | Responsibility Matrix / Verantwortungs-Matrix (§23.1) |

G5b (roles overview current), G10 (clerk test) and G11 (no open assumptions) are judgment items and are listed as such.

LLM detection: the concept has LLM UCs when `LLM`, `KI-UC`, `Probabilistik` or `gen_ai` occurs after dropping lines that carry the §13.3 note (`No LLM`, `Kein LLM`, `Deterministic UC`). RAG detection: `RAG`, Retriever, Embedding, Vektor-DB.

Dimensions (layer 2), each the fraction of checks met on a 0–10 scale:

- `struktur`: UCs present, head, Actor and Route per UC, roles overview, lifecycle, probabilistic statement, vendor risk statement, §13.1 LLM fields (Kontext/Context, Ausgabe/Output, Validierung/Validation, Fallback, Cutoff/Cut-off), §20.3 RAG fields (Chunk, Embedding, Retriever/Retrieval, Cache/Caching, Invalidierung/Invalidation), entity overview, responsibility matrix. Conditional checks pass when the condition does not apply.
- `uc_schritte`: fraction of UCs with at least two numbered steps (as G1).
- `ac`: fraction of UCs with an AC table, minus 2 per vague criterion row (should, ideally, typically, roughly, approximately, usually, sollte, idealerweise, typisch(erweise), möglichst, ungefähr, in der Regel, ca., etc., evtl., mehr oder weniger, o. ä.), down to 0. "about" is not a hedge.
- `fehlerfaelle`: fraction of UCs with an error-case table (as G3).
- `nachweis`: obligation statements are lines outside headings and tables that contain `Pflicht:`, `mandatory:` (or an em dash), `is mandatory`, `ist Pflicht` or `MUSS`; the score is the fraction that names one of the four §10.7 evidence types: Test/AC (or an `AC-n` reference), Policy score, Checklist item, Trace span. Eval and Metric are not evidence types until §10.7 says so. A document without obligation statements scores 10. The §3.1 form-table column "Mandatory" is a table cell and does not count.
- `glossar`: 0 without a glossary; with one, the fraction of backticked glossary terms that occur in at least one UC body (case-insensitive). A glossary without backticked terms scores on presence alone.

## Output

Gate list with 🟢 (passed), 🔴 (failed) or `…` (judgment item) per item, per-UC lines (🔴 missing structure, 🟡 only vague AC rows, 🟢 clean) with one 🟡 line per vague AC row, dimension scores, failed `struktur` checks, unused glossary terms, the deterministic contribution (out of the deterministic weight) and the normalized partial score. `--json` prints the full result object. The threshold and the judgment dimension belong to the reviewer; the lint never declares "ready".

## Limits

Presence, not completeness: a present error table may still miss cases; that is the reviewer's dimension score. A UC is a level-2 or level-3 heading starting with `UC-`; its body ends at the next level-1 or level-2 heading. Glossary term usage is substring matching, not vocabulary analysis across roles. The doctrine's golden samples (cdp5-reference Appendix B) are the regression fixture: they pass every per-UC and LLM gate item and, framed with the document-level sections (head, roles, entity overview, glossary), the whole gate.
