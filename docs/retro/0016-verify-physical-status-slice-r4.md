# Retro-ADR 0016 — Verify-Physical-Status (NSAI-Edge Slice #R4)

**Status:** completed · autonomous + self-merged (PR #16) · 1 adversarial audit round + 3 🟡 followed up
**Date:** 2026-05-28
**Purpose:** Retrospective of a pure explainability slice that closes a subtlety discovered in the AI Act demo — without verdict drift, without a new confabulation class.

## Context
The AI Act live demo showed: after `reject(hash)`, `verify` keeps showing the rumor as `contradicted`. Consistent with the single-value dominance logic (AI competence dominates, "nothing" is refuted), but hostile to explainability for the consumer — he does not see that he rejected the triple himself. Stefan marked this as a backlog subtlety. Slice #R4 closes this gap via an **additive** `physical_status` field.

## CDP5-checked architecture decisions
- **Additive field, no verdict drift**: `verify` stays with the three verdict categories. `physical_status` is a pure read lens on `knowledge_edges.local_status`, attached only additively.
- **Open world absolute**: if the triple does not physically exist, the field is ABSENT — not `'none'`. Absence is signaled by the field being missing, consistent with our open-world obligation.
- **Wrapper pattern**: the existing `verify` logic was renamed to `_verifyCore()`, `verify` is the public wrapper. Guarantees: existing verdict paths unchanged.
- **Categorical string from schema CHECK constraint**: 4 possible values (`active`/`superseded`/`retracted`/`quarantined`), structurally guaranteed by SQLite CHECK. No probabilistics leak possible.
- **Strip allowlist extended**: the `assertClaims` strip lets `physical_status` through (categorical string), but stays strict for numeric provenance.

## Decision chronicle
- **E1** — AI Act demo subtlety prioritized from the backlog (Stefan's option 3).
- **E2** — Konzept-first UC-VPS (Konzept = concept document) with AC-19.1-19.10. Lint 10/10.
- **E3** — Implementation: wrapper pattern (`verify` → `_verifyCore`), additive field, strip allowlist extended. 10 AC tests green.
- **E4** — Adversarial audit: **safe YES-with-reservation.** Three 🟡 (all doc/test polish, no code defect):
  - 🟡-1 MCP tool descriptions did not mention `physical_status` → consumer sycophancy risk (an LLM could misinterpret the field as a "belief value"). **Fix**: tool descriptions extended with a clear note "pure explainability, no verdict drift".
  - 🟡-2 `present` and `physical_status` can both appear at the same time → seemingly contradictory. **Fix**: KONZEPT clarification — both describe different read lenses (rb lens vs. edge lens).
  - 🟡-3 AC-19.5 tested `retracted` via direct DB mutation, not via real TMS propagation. **Fix**: AC-19.5b added — derived_from chain + premise reject → propagateRetraction sets the derived fact to retracted.
- **E5** — Self-merge PR #16.

## Process lesson (core)
**Explainability polish is not a cosmetic issue.** The AI Act demo subtlety was not a bug — the logic was correct. But the consumer got an answer he could not readily interpret as "you rejected that yourself". This is exactly where the hallucination trap for the consumer lies: without an explainability hint he constructs his own story (why doesn't the system just say "unknown"?). Slice #R4 closes this via a precise additive field — no hallucination source, no probabilistic statement, simply more context.

**The wrapper pattern for additive fields is safer than nested returns.** Had I tried to build the field into each of the 7+ return statements of `verify`, one would certainly have been forgotten. The public wrapper sees the final result and adds centrally — maintenance defense built in.

**MCP tool descriptions are consumer sycophancy protection.** The auditor found: the field exists in the output, but the tool description does not mention it. An LLM consumer reads the description, sees the field in the output, builds its own explanation. Structural drift risk. Tool descriptions must document **everything** that can appear in the output — otherwise silent consumer confabulation arises. [[feedback-green-tests-bypass-security]]

**Tests must test the REAL path.** AC-19.5 set `retracted` via direct UPDATE — that checked the pass-through, but not the TMS propagation, which in the production case is the path to `retracted`. Had `_propagateRetraction` acquired a bug that forgets the field, the test would have stayed green. AC-19.5b now adds the real path with a derived_from chain.

## Substantive lesson
**Status is not bi-temporal.** Stefan had already documented this in #R2 as a deliberate decision. `physical_status` reflects the **current** local_status — even for `as_of` queries in the past. A bi-temporal status axis would be a complete additional column and its own slice (#Future); for the explainability use of #R4 the current status suffices.

**Schema CHECK constraints are defensive defaults for categorical fields.** `local_status` is restricted to 4 values via CHECK constraint. That makes the allowlist in the JS code redundant — but the safety comes from the schema, not from the code. That is the right layering.

## Open
- **MCP tool descriptions as a CDP5 AC** — idea from the audit: every slice extension that brings a new output field should explicitly check that the tool description was updated. Could become a deterministic `mcp-doc-drift` gate skill (backlog).
- **Bi-temporal status axis** (Slice #Future) — if historical status queries are ever wanted, an own column `status_history(triple_hash, status, valid_from, valid_to)`. Not currently required.
