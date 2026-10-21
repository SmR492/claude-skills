# Retro-ADR 0002 — NSAI-Edge: autonomous quality loop to 9.5/10

**Status:** completed (goal reached: 9.53/10) · PR #1 NOT merged (waiting for Stefan)
**Date:** 2026-05-27
**Purpose:** Retrospective of the autonomous loop "implementation → review → retro → refinement" that Stefan kicked off overnight, until the nsai-edge implementation reaches 9.5/10 against goals+definition.

## Context

Assignment: iterate autonomously until the implementation reaches a final quality of 9.5/10. Two substantive guardrails from Stefan: (a) evidence weighting of competing statements by authority × recency × confidence, NEVER by count; (b) not only recognize facts, but also recognize + downgrade outdated + false knowledge — genuinely neuro-symbolic, no crude DB.

## Decision chronicle

- **E1 — Evidence weighting built** (NN/BEWA model): `source_type` authority × recency × confidence, softmax over distinct objects. First form multiplicative.
- **E2 — 7 adversarial review rounds (adversarial-auditor) hardened the trust model.** The auditor repeatedly found THE SAME error class ("lower-trusted input shifts the belief/read result of a higher-trusted edge") on a new axis each time: tier → confidence → recency/provenance (write path) → belief (read path). Point patches failed; only the **general principle** closed the class: **trust-primary precedence `(Origin-Trust-Rang, effektive Stufe, …)` on BOTH paths** (mergeIncoming + resolveBelief), tier hard, trust cap against source_type spoofing, future date rejected, live confidence raisable only by full/auth. Verdict round 8: safe-to-merge YES.
- **E3 — Node half of the federation completed:** real HTTP transport (tested over the network) + bundleAdapter (docker exec via execFile array, no shell), GC, MCP peer tools. AC status in the Konzept (concept document) honestly set to green; PHP counterpart as a deliberate phase-2 Known-issue (§10.4).
- **E4 — Maturity 9.19 → 9.42 → 9.53** (konzept-reviewer). The last 0.1 were NODE-side (UC-12 AC table, conformance determinism, coverage gate, glossary) — not the parked PHP side.

## Goal verdict

**9.53/10 — threshold reached.** Goals 1/2/4/5 (persistent knowledge, neuro-symbolic, evidence weighting, security) fully met + tested (70 tests). Goal 3 (federation) complete on the Node side; the bundle federation deliberately waits for the PHP commands (Stefan's parked Symfony work).

## What went well
- The adversarial review as loop engine: 7 rounds uncovered a systematic error class that green tests completely masked — TDD alone would never have hardened the trust model.
- Verified sources + honest Known-issues instead of sham completeness.

## What must be better / core lesson
- **Chasing one error class across axes means: fix the principle, not the instance.** Four rounds were spent on per-axis point patches (tier, confidence, recency, …) until the general trust-primary principle closed all of them. Lesson: for a recurring finding, look for the invariant root, not the individual case. See memory [[feedback-green-tests-bypass-security]] (extended).
- Sycophantic tests (parameters fitted to the code) mask the gap — the auditor demonstrated this several times; tests must check the *property*, not a convenient constellation.
