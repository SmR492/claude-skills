# Retro-ADR 0005 — Justification-TMS (NSAI-Edge Slice #1)

**Status:** completed (review round 2, safe YES) · branch `nsai-edge-tms-slice1`, PR open
**Date:** 2026-05-27
**Purpose:** Retrospective of the research→Konzept→implementation loop (Konzept = concept document) for the first refinement from §H: a justification-based truth maintenance system (belief revision with retraction propagation) for NSAI-Edge.

## Context
User assignment: deeper web research on neuro-symbolic AI, compare sources, derive salient assumptions, then elaborate strictly per CDP5 in the loop **and implement**. Goal anchor: the ai-bundle goal "explainable, hallucination-free reasoning" + NSAI-Edge as revisable memory.

## Research → assumptions (A1–A5, §H.1)
Source comparison (Kautz taxonomy; Doyle JTMS / de Kleer ATMS; AGM belief revision + entrenchment; Pollock defeaters; MYCIN CF critique; NS-Mem 3 layers; GraphRAG). Salient: **A1** foundations (belief only with a living justification) → retraction against hallucination; **A2** trust = epistemic entrenchment order (minimal change); **A3** rebutting (belief softmax, present) vs. undercutting (TMS, new); **A4** confidence = evidence weight ≠ probability (no naive product — MYCIN lesson); **A5** `eternal` = strict.

## Decision chronicle
- **E1 — Konzept-first §H + UC-TMS:** lint 10/10; konzept-reviewer **6.4/10** → three scope questions decided (own status `retracted`; re-activation+multi-justification = Slice #1b; DAG invariant + single justification). Reworked → mature.
- **E2 — Implementation TDD:** `_propagateRetraction` (BFS, visited, status-only), DAG guard in `infer()`, `retracted` status + crash-safe DB migration. Triggers: decayPass + reject (+ peerRevoke after review).
- **E3 — Adversarial round 1: NO.** Three real 🔴 (two with data loss): non-crash-safe migration, non-atomic decayPass, missing quarantine/peerRevoke trigger (orphaned facts stayed active AND were exported — exactly the hallucination path).
- **E4 — Refinement + adversarial round 2: safe YES.** Migration in one transaction + resumption; decayPass atomic; peerRevoke propagates; one regression test per path. 91/91 green.

## Process lesson (core)
**The adversarial review is the real value creator — the green suite was the blind spot.** Both audit rounds found defects that 87/91 green tests did NOT show, because no test exercised `peerRevoke`, the decayPass abort or the migration crash. Confirms [[feedback-green-tests-bypass-security]]: test security/consistency invariants END-TO-END over the real error paths; every adversarial finding is codified as a regression test.
Second lesson: **check findings against reality** — the reviewer proposed a propagation for the mergeIncoming quarantine flip; empirically, however, the path is unreachable via the trust-primary precedence (F1.13 "dead-but-correct") → removed the dead, non-atomic branch instead of patching it half-defensively.

## Substantive lesson
A persistent CHECK-constraint change in SQLite needs a **transactional table rebuild with resumption** — and name-based column copying, because earlier `ALTER ADD COLUMN` shift the order (verified on a live-DB copy + synthetic old schema). Belief revision is status-only: never touch the signed statement/live confidence/vector clock → federation/CRDT parity remains.

## Open
- Slice #1b: re-activation OUT→IN (trigger in the re-assert path + "no open rebutting" via resolveBelief) + multi-justification.
- §H roadmap: 3-layer memory (NS-Mem), hybrid retrieval (GraphRAG), learned weighting.
- Seed the generator `gen-federation-fixtures.mjs` deterministically (otherwise unstable conformance vectors).
- PR merge (human); live MCP reload triggers the DB migration (verified on a copy).
