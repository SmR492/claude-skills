# Concept maturity policy

<!-- policy-version: 3 -->

The single rubric for the maturity of a concept document. It replaces the five earlier variants (§7 checklist, §9 A.2 score line, §10.3 threshold, §10.5 example policy, the former `docs/reife-rubrik.policy.md`), which now point here. `reife-rubrik.policy.json` is generated from this file by `scripts/generate-rubric.mjs`; `konzept-lint` reads the JSON, `konzept-reviewer` reads this file from the brief. A project may ship its own copy with other weights or another threshold; the orchestrator names the copy in the brief.

Purpose statement (from §9 A.2): a concept is ready for implementation when an agent can produce correct, maintainable code from it without asking questions.

Threshold: **8.0**

## Verdict

The verdict has two parts and both are reported together:

1. Gate (layer 1): every gate item passes. `det` items are decided by `konzept-lint`; `jdg` items by `konzept-reviewer`. One open item means "not ready", whatever the score says.
2. Score (layer 2): the weighted sum of the dimension scores, 0–10. It orders the gaps and tracks progress between iterations. A score at or above the threshold with a passed gate means "ready".

A score never overrides an open gate item.

## Layer 1: gate

| id | item | kind | lint check |
|---|---|---|---|
| G1 | Every UC has numbered, branched steps: a `1.` line followed by `2.` or `1.1` (§3.0) | det | uc_steps_numbered |
| G2 | Document head present: Version and Scope (Scope, Geltungsbereich or Umfang; §2.1) | det | kopf |
| G3 | Every UC has an error-case table: an error-case heading followed by a table, not prose (§3.2) | det | error_tables |
| G4 | Status lifecycle present (diagram or transition table), or the document states `No status lifecycle: <reason>` / `Kein Status-Lebenszyklus: <Grund>` (§3: optional when no object has a status) | det | lifecycle |
| G5a | Roles overview present: a roles heading or a role table (§2.3) | det | roles_overview |
| G5b | Roles overview current: every actor named in a UC is a row, no stale role | jdg | roles_current |
| G6 | Probabilistic statement when the concept has LLM UCs (§2.6) | det | probabilistik |
| G7 | Every UC has an acceptance-criteria table (§11.7) | det | ac_tables |
| G8 | Glossary present (§14) | det | glossar |
| G9 | Changelog present, or the head's Version is below 2.0 (§6: changelog mandatory from v2.0; without a parsable Version the changelog is required) | det | changelog |
| G10 | Clerk test passed: a trained operator can run every UC from the document alone (§1.1) | jdg | clerk_test |
| G11 | No open assumptions: open questions were asked, not guessed (§1.9) | jdg | no_open_assumptions |
| G12 | Every UC names Actor and Route (`**Actor:**`/`**Akteur:**`, `**Route:**`; §3) | det | actor_route |
| G13 | Vendor risk statement when the concept has LLM UCs (§2.7) | det | vendor_risk |
| G14 | Entity overview present (§5) | det | entity_overview |
| G15 | Responsibility matrix present (§23.1) | det | responsibility_matrix |

Presence is decided by the lint. Completeness of G3, G7 and G8 (are the error cases, acceptance criteria and glossary terms the right ones and enough of them) is not a dimension score; `konzept-reviewer` reports it in the gap list with evidence, and the deterministic dimensions stay presence counts. The lint decides whether a concept has LLM UCs after dropping lines that carry the §13.3 note (`No LLM`, `Kein LLM`, `Deterministic UC`). Projects add their §29-mode and §33 items as further rows with ids G16 and up.

## Layer 2: dimensions

| id | dimension | weight | kind | scored by |
|---|---|---|---|---|
| sachbearbeiter | Clerk test (§1.1): the document alone suffices to run every UC deterministically | 0.20 | jdg | konzept-reviewer |
| struktur | Mandatory structure (§2, §5, §23.1): head, UCs with Actor and Route, roles overview, lifecycle, entity overview, responsibility matrix; probabilistic statement, vendor risk statement and §13.1 fields for LLM UCs, §20.3 fields for RAG UCs | 0.20 | det | konzept-lint |
| uc_schritte | UC steps numbered and branched (§3.0): fraction of UCs with at least two numbered steps | 0.15 | det | konzept-lint |
| ac | Acceptance criteria per UC, binary and verifiable (§11.7) | 0.15 | det | konzept-lint |
| fehlerfaelle | Error cases per UC (§3.2) | 0.10 | det | konzept-lint |
| nachweis | Evidence convention (§10.7): every obligation statement names one of the four evidence types (Test/AC, Policy score, Checklist item, Trace span) | 0.10 | mixed | konzept-lint scores presence of a type, konzept-reviewer may lower it with an anchored reason |
| glossar | Glossary and vocabulary (§14): glossary present and every backticked glossary term used in at least one UC | 0.10 | det | konzept-lint |

Weights sum to 1.00. The deterministic and mixed dimensions carry 0.80; the lint reports their contribution and a normalized partial score. The reviewer adds the judgment dimension and reports the total.

## Scales

Deterministic dimensions are the fraction of checks met, scaled to 0–10 (for example 3 of 4 UCs with an error table = 7.5). The `ac` dimension subtracts 2 points per vague criterion row (should, ideally, roughly, etc.) down to 0. The `nachweis` dimension counts obligation statements outside headings and tables (`Pflicht:`, `mandatory:`, `is mandatory`, `ist Pflicht`, `MUSS`) and scores the fraction that names an evidence type; a document without obligation statements scores 10. The `glossar` dimension is the fraction of backticked glossary terms that occur in at least one UC; a glossary without backticked terms scores on presence alone.

Judgment dimensions use three anchored levels and an explicit exit. No other values are used.

| dimension | 0 | 5 | 10 | Unknown |
|---|---|---|---|---|
| sachbearbeiter | At least one UC cannot be run from the document; the operator has to guess a step, a field type or a branch | Every UC runs, but at least one step needs an assumption the document does not state (named in the finding) | Every UC runs from the document alone; every field has type, unit and range; every branch is an explicit step | The reviewer lacks the domain knowledge to decide for a named UC; the finding says which |
| nachweis (reviewer adjustment) | A mandatory statement has an evidence type that cannot decide it (for example a checklist item for a runtime property) | Evidence types fit, but at least one is not reachable from the concept (no test name, no metric) | Every mandatory statement has an evidence type that decides it and names where it lives | The statement's intent is unclear; the finding quotes it |

## Known-issue record

An accepted risk, a Won't Fix or a dismissed lint flag is recorded, never silently dropped:

```
known-issue: <item or flag> | decided by: <person> | date: <YYYY-MM-DD> | reason: <one sentence> | source: <where the decision is recorded>
```

The review output lists every known issue it relied on. A dismissed lint flag without this line counts as open.

## Rigor levels

| Change | Rubric |
|---|---|
| Concept for a feature or system (§29 modes A, B) | full: gate and all dimensions |
| Small change with its own acceptance criteria | reduced gate: G1, G3, G7, G12 for the touched UCs; no score |
| Bug fix | exempt; the regression test is the evidence |

## Calibration

The judgment scale is calibrated against scored concepts. Calibration set: maintained in the repository's docs (target 20 concepts). Two reviewer runs over the same document in fresh contexts must agree within ±0.2 on the total; the calibration set is the CI eval for that rule.
