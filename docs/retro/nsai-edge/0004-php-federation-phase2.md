# Retro-ADR 0004 — PHP federation counterpart (NSAI-Edge phase 2)

**Status:** completed (implementation + review) · ai-bundle branch `feature/graph-federation-phase2` NOT pushed/merged
**Date:** 2026-05-27
**Purpose:** Retrospective of the phase-2 loop — PHP counterpart of the federation (`nsai:graph:ingest`/`export`) in the Symfony bundle `smr492/neuro-symbolic-ai-bundle`, Konzept-first (Konzept = concept document) per CDP5.

## Context
After the merge of PR #1 (nsai-edge live in the marketplace), the user-authorized phase 2: PHP becomes a co-equal P2P peer. Options confirmed: ingest **with** Ed25519 verify, export **with** vector-clock delta. Requirement: Konzept-first, full loop (Konzept→implementation→review→retro→refinement).

## Decision chronicle
- **E1 — Interop de-risked first:** before the Konzept, a spike (PHP sodium verifies Node PKCS8 Ed25519 via raw key from SPKI PEM; triple_hash + signingString byte-identical). Lesson from the adversarial rounds: prove risky interop empirically, do not assume it.
- **E2 — Konzept v1.1:** lint 10/10, konzept-reviewer 6.5→9.0/10 after incorporation. threat-modeler found 7 federation-specific classes (T1–T8) → anchored as parity ACs F1.9–F1.15.
- **E3 — Model impedance:** shadow table `FederationEdge` (wire 1:1) instead of federation columns on the count-based `KnowledgeEdge` — both trust models coexist; native projection via `ingestFact()`.
- **E4 — Implementation TDD-first:** WireCanonical/FederationMerge/WireValidator/PeerRegistry/ingest+export service/commands + Doctrine migration. 37 federation tests (crypto/merge cross-conformance against Node fixtures + functional), 142/142 bundle green.
- **E5 — Adversarial review:** verdict safe-with-reservation, no forgery gap. 3 findings fixed (type gate, strict date, U+2028 conformance).

## Process lesson (core) — verify the finding against REALITY, not against the assumption
The adversarial-auditor reported 🟡-1 "signingString diverges at U+2028: Node escapes, PHP does not". The divergence was **real**, but the claimed **direction wrong**: a hexdump of `JSON.stringify` showed that Node outputs the raw UTF-8 bytes (does NOT escape), while **PHP** itself escapes. Blindly following the finding (additionally escaping in PHP) would have **broken** byte identity in the first place. Correct was `JSON_UNESCAPED_LINE_TERMINATORS` (PHP → raw = Node). → Even a qualified, "certain"-sounding review is a claim; check against the source before implementing ([[feedback-green-tests-bypass-security]], review-verify doctrine). The green tests masked it because all fixtures were ASCII — exactly the gap that "green tests ≠ security" warns about.

## Substantive lesson
Byte identity of two engines across language boundaries is fragile at a few, precisely named places: JSON escaping (slashes/Unicode/line terminators), number-vs-string types of signed fields, date-parser permissiveness. Each of these places belongs pinned as a cross-conformance fixture + negative test, not as a prose assurance.

## Open
- **Node parity hardening (§1.2):** F1.9–F1.15 apply as parity ACs also to `engine.mjs` (free peer_id, VC plausibility, quarantine in the UPDATE branch, live cap). Own slice — to be confirmed individually against the code by the konzept-reviewer. Still open.
- The ai-bundle branch is local; push/PR is a Mensch-Gate (human gate).
- Phase 3: HTTP transport (Trifecta precondition: egress allowlist/approval).
