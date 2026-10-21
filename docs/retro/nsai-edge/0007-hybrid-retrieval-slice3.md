# Retro-ADR 0007 — Deterministic hybrid retrieval (NSAI-Edge Slice #3)

**Status:** completed (adversarial safe YES) · branch `nsai-edge-retrieval-slice3`, PR open
**Date:** 2026-05-27
**Purpose:** Retrospective of the third §H roadmap refinement: query-first retrieval via lexical seeds + belief/trust-weighted Personalized PageRank — **purely deterministic** (user decision).

## Context
Continuing in the CDP5 loop. User requirements for this phase: (a) **purely deterministic** (no vector embeddings), (b) **web research in the Konzept phase (Konzept = concept document), critically validated**, (c) search queries with the **current year (2026)**. Goal: "the right answer OR the way to it" even without an exact node name.

## Decision chronicle
- **E1 — Web-validated design fork:** lexical + Personalized PageRank (model: HippoRAG) instead of vector embeddings (external/LLM → breaks determinism). **Danger recognized (meta-analysis 2025/26):** GraphRAG gains are overestimated → exact lookup stays primary, PPR is enrichment. **2026 finding:** hub dilution (high-degree nodes dilute PPR) → dampened via k-hop bound + confidence.
- **E2 — Konzept-first UC-HR:** lint 10/10; konzept-reviewer **7.35/10** → 🔴/🟡 incorporated: determinism hardening (fixed edge summation order by triple_hash + stable tie-break — IEEE-754 non-associativity!), unambiguous triple score `(r_subj+r_obj)×weight`, k-hop subgraph (perf/hub), parameter table, `converged` flag, convergence math (d=0.85 → tol=1e-6/max_iter=100).
- **E3 — Implementation TDD:** `search()` (seed→k-hop→PPR→ranking→hybrid with episodes), MCP tool. Local read-only read lens (not federated, no wire).
- **E4 — Adversarial review: safe YES.** Determinism over 200+ permutations + mass conservation (Σr=1, err≤4e-16) + read-only + injection empirically confirmed. 3 🟡 fixed: parameter clamping (max_hops/max_iter/tol — CPU DoS), and above all **🟡-3 trust discount**: the ranking used raw `confidence` → a limited/low-trusted peer could have wrongly ranked at the top via federation. Fix: edge weight = `confidence × trustFactor(originTrust)`. 116/116 green.

## Process lesson (core)
**A determinism claim ≠ a fixed node order alone.** The reviewer found that IEEE-754 addition is not associative → unsorted `_activeEdges` made the PPR summation insert-dependent. Only the fixed **edge** summation order (triple_hash) + stable tie-break make the ranking reproducible. Float determinism is subtler than "sort the nodes".
**Relevance ≠ credibility.** The adversarial review revealed that retrieval relevance and belief resolution can diverge (raw confidence vs. trust-primary belief lens). Solution: trust-discounted relevance + clear Konzept separation (`search` = what is relevant, `resolveBelief` = what holds). [[feedback-green-tests-bypass-security]] confirmed again: the tests only checked the single-peer case, the federation case was the blind spot.

## Substantive lesson
PPR as a local float read lens is legitimate (like resolveBelief) — determinism here is "reproducible within one engine", not cross-language bit identity (that applies only to the federated wire). The k-hop bound solves perf AND hub dilution in one. Web research delivered both the method (HippoRAG/PPR) and the necessary skepticism (meta-analysis: do not oversell).

## Open
- Slice #3b: real semantic similarity (vector embeddings, external/LLM — agent side); hub cap/degree normalization.
- §H roadmap: Slice #4 (learned weighting) remains the last item — observe the determinism gate.
- Slice #1b (OUT→IN), Slice #2b (LLM extraction). PR merge (human).
