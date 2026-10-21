# Retro-ADR 0013 — Corrective Retrieval (NSAI-Edge Slice #R1)

**Status:** completed (re-design after adversarial NO) · autonomous + self-merged (PR #13)
**Date:** 2026-05-28
**Purpose:** Retrospective of a slice whose first attempt was taken apart by the adversarial audit — and which was only safe after a **conceptual re-design**. Strongest confirmation of Stefan's „weg von plumpen Halluzinationen, hin zu menschenähnlichem Gedächtnis mit Stärken aber ohne Schwächen".

## Context
Slice #R1 = corrective retrieval from the RAG-2026 patterns: "if `verify=unknown`, a second round with an expanded search space before finally saying unknown". The first implementation lifted `unknown` to `supported` by means of a substring subgraph lookup — seemed clean, all tests green.

## CDP5-checked architecture decisions
- **Hint model instead of verdict lift** (re-designed after adversarial round 1): stage 2 NEVER changes the verdict. It only collects `corrective_hints[]`. The consumer decides whether the hints are helpful.
- **Exact-node gate**: the subject must be present in `knowledge_nodes` as an exact name — no LIKE/substring rescue.
- **Direct BFS adjacency instead of PPR/`search`**: no DoS vector, deterministic order by `triple_hash`.
- **multiValue path disabled**: tags/properties are subject-specific and must not be projected across related subjects.

## Decision chronicle
- **E1** — Web research RAG-2026: corrective RAG pattern confirmed (96 % hallucination reduction in enterprise). We adapt it deterministically.
- **E2** — Konzept-first UC-CR (Konzept = concept document) with AC-16.1-16.10. Lint 10/10.
- **E3** — Implementation: `_maybeCorrective` via `search({max_hops: 2, as_of})` → subgraph match on (predicate, object) → if quorum-supported → `verdict: 'supported', corrective: true, via_subject: c.subject`. 10/10 ACs green right away.
- **E4** — Adversarial audit round 1: **NO.** Two critical confabulation paths:
  - **🔴-1 Substring-match confabulation:** `search(term: subject)` uses SQL LIKE on `knowledge_nodes.name`. "KI-VO" matches "FAKE-KI-VO". If a malicious triple `(FAKE-KI-VO, verpflichtet_zu, KI-Manipulation)` with quorum is present → `verify({subject: KI-VO, …}) === supported`. Stefan's dreaded crude hallucination.
  - **🔴-2 Cross-subject tag leak:** `Doc-A relates_to Doc-B`, `Doc-B hat_tag blau` quorum-supported → `verify({subject: Doc-A, predicate: hat_tag, object: blau}) === supported`. Doc-A gets attributed a tag that belongs to a connected document.
- **E5** — Re-design: **hint model**. Stage 2 NEVER changes the verdict; only collects hints.
  - Exact-node gate (no LIKE).
  - BFS directly over `knowledge_edges` adjacency (no `search`/PPR).
  - multiValue path explicitly disabled.
  - KONZEPT.md UC-CR completely reworked. All 10 ACs reformulated.
- **E6** — Adversarial audit round 2: **safe YES-with-reservation.** Both 🔴 paths structurally excluded. Two 🟡 (doc drift in the determinism-gate sentence, MCP tool description clarification) — both doc edits, done.
- **E7** — Self-merge PR #13.

## Process lesson (core)
**The first attempt at an "obvious" pattern slice can be structurally unsafe even though it seemingly satisfies the concept constraint.** Slice #R1 V1 satisfied AC-16.7 *literally* ("the queried triple must physically exist") — but the **strong** constraint ("the verdict must refer to the queried subject, not to a substring relative") was not codified. The auditor read the constraint correctly, I did not.

**Lesson for CDP5:** when a new read path changes the verdict (from unknown to something else), the AC table MUST contain a test that builds in an *adversarial* substring match and checks that the verdict does NOT flip. Not only AC-positive behavior, but AC-negative "must NEVER do this".

**Stefan's clarification was the right threshold:** „weg von plumpen Halluzinationen, wenn Wissen fehlt" — the substring match delivers exactly this crude hallucination. The audit picked up the vocabulary of confabulation in Stefan's constraint and thereby justified the verdict 🔴 instead of 🟡.

**Elegance of the solution:** the hint model is semantically more honest than the verdict lift. It gives the consumer THE SAME information without passing its own judgment that no logical bridge supports. "Here are related subjects that carry this statement — what you make of it is your responsibility."

## Substantive lesson
**Verdict lift in stage 2 is a confabulation trap.** No matter how conservative the filters, transferring a statement from one subject to another (via substring match, synonym, relatedness) cannot be reliably justified semantically without domain knowledge. The hint model avoids the trap completely.

**multiValue predicates are their own class.** They are subject-specific, not universal. Stage-2 paths must explicitly exclude multiValue, otherwise a cross-subject tag leak arises.

**BFS instead of PPR for local adjacency.** PPR is a *relevance lens* for multi-hop retrieval, BFS is a *structure lens* for direct neighborhood. For stage 2 (local hints) BFS is more correct, faster, more deterministic.

## Open
- **Slice #R1b (deferred):** real alias table (`aliases(node_id, alias)`) for synonym hints. Would be strong, but needs a domain dictionary. Backlog.
- **MCP consumer protection:** we warn in the tool description that `corrective_hints` are not a verdict reinforcement. An LLM consumer could still produce confabulation. Hardening later (e.g. hints only on explicit request).
- **Slice #R2 / #R3:** self-critique mandatory pass, BM25 seed ranking.
