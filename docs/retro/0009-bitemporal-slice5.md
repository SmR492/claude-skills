# Retro-ADR 0009 — Bi-temporal validity (NSAI-Edge Slice #5)

**Status:** completed (adversarial NO→fix→safe) · implemented autonomously + self-merged (gmail)
**Date:** 2026-05-27 (autonomous night session)
**Purpose:** Retrospective of the bi-temporal slice — "what held at time T" — and the first loop run autonomously (without human confirmation per step) + self-merged.

## Context
The user went to sleep, authorized the autonomous loop + self-merge via the gmail/SmR492 account, with the Auflage (condition): web ideas verified + CDP5-checked before they are considered. Slice #5 = §H.2 item 5 (frontier: Zep/Graphiti, +18.5 % LongMemEval).

## CDP5-checked architecture decisions (upfront, critical)
- **No wire break:** `valid_from` defaults to the signed `asserted_at`; `valid_to` is LOCAL (like `retracted`) — not signed/federated. Thus bi-temporal without a wire-v2/PHP-parity break. Verified against `signingString`/`_edgeToWire`.
- **Determinism gate:** Graphiti's LLM contradiction detection NOT adopted → temporal supersession explicit/deterministic.

## Decision chronicle
- **E1 — Web verified + CDP5 check:** Zep/Graphiti (4 timestamps, valid window, non-destructive invalidation), BiTRDF. Adopted: valid_from/valid_to + as-of + non-destructive supersession. Discarded: LLM conflict detection (determinism), federated validity (wire break).
- **E2 — Konzept-first UC-BT** (Konzept = concept document): lint 10/10; reviewer **7.4/10** → 🔴 (default materialization via COALESCE; as_of conjunctive with active; migration interaction with the retracted rebuild) incorporated.
- **E3 — Implementation TDD:** valid_* columns (SCHEMA + EDGES_REBUILD + additive ALTER), as_of on query/resolveBelief, setValidity, supersedeTemporally, 3 MCP tools. **Migration verified on a live-DB copy (12175 edges + WAL): no data loss.**
- **E4 — Adversarial NO→fix:** 🔴-1 supersedeTemporally could create an inverted interval (`valid_to < valid_from`) → predecessor no longer visible anywhere = silent local loss. + 🟡-5 lexicographic time comparison (offset times mis-sorted) → UTC norm. + 🟡-2 verify without as_of. All fixed + regression tests. 141/141.
- **E5 — Self-merge** after the full gate (lint/reviewer/adversarial safe/tests green/live migration verified).

## Process lesson (core)
**Autonomy does not mean less rigor — it means pulling the gate hard yourself.** Before the self-merge: konzept-reviewer + adversarial-auditor (which found a real data-loss path) + migration on a **copy of the real live DB** (not just in-memory fixtures), because the merge → MCP reload unleashes the migration on 12k real edges. The data-loss finding (🔴-1) confirms again: the untested edge (future `valid_from` + backward supersession, `Z`-only tests) is the bug. [[feedback-green-tests-bypass-security]].
**Web validation + CDP5 check before adoption** ([[feedback-websearch-in-concept-phase]]): Graphiti's LLM conflict detection would have been tempting, but violates the determinism gate → deliberately referred to the agent side.

## Substantive lesson
Bi-temporal without a wire break is possible by placing one axis (valid start) on the already signed `asserted_at` and keeping only the end (`valid_to`) local. Price: temporal supersession is local, not federated (🟡-3, documented). Lexicographic time comparison demands UTC normalization — otherwise silent mis-windowing with offsets.

## Open
- Slice #5b: federated validity (wire v2), `as_of` on `search`. #6 (backlog) learned weighting. #1b/#2b/#3b/#4b deferred.
