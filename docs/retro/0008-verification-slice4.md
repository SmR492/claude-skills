# Retro-ADR 0008 — Verification `verify(claim)` (NSAI-Edge Slice #4)

**Status:** completed (adversarial NO→fix→safe) · branch `nsai-edge-verify-slice4`, PR open
**Date:** 2026-05-27
**Purpose:** Retrospective of the verification slice — the "keystone" for hallucination-free reasoning — and the pre-existing resolveBelief bug it uncovered.

## Context
After research round 2 (2026 frontier), the user reprioritized the §H roadmap: **verification = new Slice #4** (frontier-validated, deterministic, hits the goal directly), bi-temporal = #5, "learned weighting" → #6 backlog (non-deterministic). `verify(s,p,o)` → supported/contradicted/unknown.

## Decision chronicle
- **E1 — Web-validated method:** VeriCoT (logic verification of CoT), Eidoku ("no path ⇒ reject"), ClaimVer (KG claim attribution). Core: the symbolic base checks the LLM statement.
- **E2 — Design decision:** `verify` as a **pure projection of resolveBelief** (no second belief logic → no drift). Open-world obligation: absence → unknown, never contradicted.
- **E3 — Konzept-first UC-V** (Konzept = concept document): lint 10/10; konzept-reviewer **7.9/10** → 🔴 incorporated: `winner===null` (allZero) must → unknown (not contradicted!); `present` = candidate level; contested-flag AC; projection invariant. §H.2 roadmap rewritten.
- **E4 — Implementation TDD:** `verify()` + MCP `graph__verify`. 127/127.
- **E5 — Adversarial review: NO.** 🔴-1: the `cands.length===1` short-circuit in `resolveBelief` ran BEFORE the validity filter → a **single untrusted/weightless** statement (reachable via `clone bulkPromote`) became the belief winner with belief 1000 → `verify` wrongly returned contradicted/supported. Fix in resolveBelief (same validity test as the multi path → winner=null for untrusted/weightless). 128/128, no regression in existing behavior.

## Process lesson (core)
**A new feature uncovers latent bugs in existing code — and the error found was worse than "just Slice #4".** The allZero single-candidate bug had sat in `resolveBelief` since the belief lens; without `verify` it would have remained invisible (query only marks it as a belief-1000 "winner"). The adversarial review found it via the **federation path** (clone bulkPromote → active untrusted edge) — exactly the case the green tests (two untrusted candidates, never ONE) left out. Confirms again [[feedback-green-tests-bypass-security]]: the untested edge (exactly ONE weightless candidate) was the bug. **Fix at the principle** (align the single path with multi-path validity), not in verify — otherwise a second belief path (AC-12.11 violation).

## Substantive lesson
"Hallucination-free" has two directions: assert nothing false (contradicted only with a real, prevailing counter-belief) AND honestly report not-knowing as `unknown` (open world). A false `contradicted` is more dangerous than silence — it actively asserts counter-knowledge. That is exactly why the allZero→unknown path is the core invariant.

## Open
- Slice #5 bi-temporal validity · #6 (backlog) learned weighting.
- Slice #4b: structural path verification (Eidoku, via search/PPR `related`), multi-triple claim decomposition.
- PR merge (human).
