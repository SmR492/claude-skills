# Retro-ADR 0014 — Self-critique mandatory pass (NSAI-Edge Slice #R2)

**Status:** completed · autonomous + self-merged (PR #14) · 2 adversarial audit rounds
**Date:** 2026-05-28
**Purpose:** Multi-claim verify as a mandatory interface for agents. Retrospective of a subtle confabulation trap that a confirming reviewer would have overlooked: if the aggregate masks `contested:true` claims as `all_supported`, the agent silently publishes recognized conflicts.

## Context
Slice #R2 = self-critique from RAG-2026 (the LLM checks its answer against the retrieval sources before answering). We deliver this **deterministically** as bulk verify with a categorical aggregate — the LLM is consumer, not part of the evaluation.

## CDP5-checked architecture decisions
- **Categorical aggregates, NO probabilities** — output is `any_contradicted` / `any_contested` / `any_unknown` / `all_supported`, with unambiguous priority. The consumer makes binary decisions.
- **Per-claim output allowlist strip** — only categorical fields in the result (`verdict`, `contested`, `multiValue`, `dominant`, `present`, `corrective_hints` with ID fields, `corrective_searched`). Numeric provenance (`belief`, `quorum.weighted_support`, `derived_from` chains) MUST be retrieved via separate tools.
- **Read snapshot via transaction** — all per-claim verify calls see the same DB state, even under concurrent writes.
- **Fail-closed as_of validation** — an invalid ISO date throws, no silent coercion to now.

## Decision chronicle
- **E1** — Konzept-first UC-SC (Konzept = concept document) with AC-17.1-17.11. Lint 10/10.
- **E2** — Implementation: simple loop over `verify` + 3-level aggregate rule. 12 tests green.
- **E3** — Adversarial audit round 1 (delayed by API overload, then caught up): **NO.** Two critical findings:
  - 🔴-5 **`contested:true` masked as `all_supported`**: a claim with quorum-supported but a resolveBelief conflict with another object → `verdict='supported', contested:true`. My aggregate had only three levels; `contested` slipped into `all_supported`. Empirically reproduced: a 50/50 conflict yields `aggregate:'all_supported'` — the agent would silently publish a conflict. Exactly the hallucination path Slice #R2 is meant to prevent.
  - 🔴-1/4 **Probabilistics leak in the per-claim result**: the verify result was passed through 1:1 incl. `belief: 500` per mille and `quorum.weighted_support: 7500`. These are numeric probability representations — against Stefan's explicit „keine Wahrscheinlichkeiten" constraint.
  - Plus 🟡: silent as_of fail-open, no read tx, AC-17.8 not discriminating.
- **E4** — Fix:
  - New aggregate category `any_contested` between contradicted and unknown.
  - Per-claim output **allowlist strip**: categorical fields let through, numeric ones filtered.
  - `_validIso` pre-check per claim → INVALID_PARAMETER_FORMAT instead of coercion.
  - Wrap `assertClaims` in `_tx(...)`.
  - AC-17.3b/17.8 (numeric provenance)/17.12/17.13.
- **E5** — Adversarial audit round 2: **safe YES.** Both 🔴 structurally closed (strip is an allowlist, aggregate priority an unambiguous if/else chain). Three small 🟡 doc/refinement notes — one adopted as a doc edit (derived_from strip), two as backlog (read-only tx variant, validation order).
- **E6** — Self-merge PR #14.

## Process lesson (core)
**Aggregation logic is a confabulation trap.** If the per-claim output carries several axes (verdict + contested flag + multiValue flag), the aggregate MUST cover all relevant axes. A simple `if (any contradicted) ... else if (any unknown) ... else all_supported` ignores the contested axis — and that is exactly the silent hallucination that Slice #R2 was supposed to prevent. The auditor constructed this in a probe (probe 8) that my test set did not have.

**Probabilistic provenance must not leak into categorical outputs.** A per-claim `belief: 500` (per mille) is semantically a probability value — even if it is integer-encoded. Stefan's constraint „keine Wahrscheinlichkeiten" applies not only to float fields but to the semantic category. Allowlist strip is the clean fix: explicit about what goes out; everything else stays inside.

**"Tests green + self-audit = green light" is a known blind spot.** The 12 AC-17 tests had *no* probe for `contested + supported` together, and the probabilistics AC (17.8) only checked string tokens (`%`, „vermutlich"), not numeric integer fields. The adversarial audit found both in one probe. [[feedback-green-tests-bypass-security]]

## Substantive lesson
**Aggregate priority is a direct Stefan decision.** "contested→`any_contested`" or "contested→`any_unknown` (conservative)" — both are defensible. I chose `any_contested` as its own category because it is semantically more honest: a contested claim is *not* unknown (knowledge is there) but *disputed* (several sources contradict each other). That is an important distinction for the agent — with `any_unknown` it must research, with `any_contested` it must address the conflict.

**Allowlist instead of blocklist for the output strip.** A blocklist (`delete v.belief`) breaks as soon as a new numeric field is added. An allowlist (`{ verdict: v.verdict, contested: v.contested, … }`) stays safe — new fields must be added explicitly, forgetting leads to "less output", not to "a new leak". Defensive default.

## Open
- **Read-only tx variant** (`BEGIN DEFERRED` instead of `BEGIN IMMEDIATE` for pure read operations) — backlog, performance optimization under concurrent writes. Non-blocking at current load.
- **Validation order** (format validation BEFORE tx instead of during verify) — cosmetic.
- **`graph__verify` documented as the "full provenance" path** (KONZEPT.md UC-SC) — consumers now know where to get numeric provenance.
- **Slice #R3 BM25 seed ranking** — next slice; with multi-word support (Stefan decision). FTS5 as a deterministic SQLite extension.
