# Retro-ADR 0017 — Peer-trust adjustment (NSAI-Edge Slice #6.1)

**Status:** completed · autonomous + self-merged (PR #17) · 2 adversarial audit rounds + 3 🟡 followed up
**Date:** 2026-05-28
**Purpose:** First offline learning slice. Retrospective of a slice whose first attempt introduced two confabulation sources (system protection actions counted as trust signal) — and how a column re-design closed that structurally.

## Context
In the #6 discussion Stefan had explicitly rejected option E (bias learner) with „evtl. drift, da zu wenig Kontext". Slice #6.1 is the weakened form (proposal mode, no auto-apply). The first implementation nevertheless fell into the same trap — on a subtler level.

## CDP5-checked architecture decisions
- **Proposal mode, no auto-apply** — the user decides explicitly via `peerTrust()`.
- **Only explicit user reject counts** — new column `user_rejected_at`, set ONLY by `reject(hash)`. System actions (low-conf inference, default quarantine, peerRevoke, decay) do not touch it.
- **Local trust axis**, not global spec tuning — `trust_level` is local by definition.
- **Integer per mille**, deterministic, no float.

## Decision chronicle
- **E1** — Konzept-first UC-TA (Konzept = concept document) with AC-20.1-20.12. Implementation: `learnTrustAdjustments` aggregates `local_status IN ('superseded', 'retracted', 'quarantined')` as reject rate.
- **E2** — Adversarial audit round 1: **NO.** Two critical confabulation paths:
  - 🔴-1 **`quarantined` ≠ user reject**: the system sets it on low-confidence inference, default quarantine on untrusted clone, peerRevoke. Empirically: a full peer with 10 low-conf inference triples → proposal `untrusted`. **Exactly Stefan's bias trap.**
  - 🔴-2 **`superseded` ≠ user reject**: decay supersede is time-driven, not user-driven. A peer with outdated statements → wrongful trust reduction.
- **E3** — Fix: new column `user_rejected_at` (additive, migrated idempotently). `reject()` sets it, `learnTrustAdjustments` counts only `user_rejected_at IS NOT NULL`. Schema CHECK constraint not extended (an additive column is cleaner than a CHECK migration).
- **E4** — Adversarial audit round 2: **YES-with-reservation.** Confabulation source structurally closed. Three 🟡:
  - 🟡-A **KONZEPT drift**: doc texts still said `updated_at` filter and `local_status` aggregation, the code already filtered on `asserted_at_norm` + `user_rejected_at`. Re-drift danger for future maintenance.
  - 🟡-B **`promote()` un-reject gap**: set local_status=active but left `user_rejected_at` set → "ghost counter" (the peer stays burdened even though the user withdrew the reject).
  - 🟡-C **Legacy data**: pre-slice rejects have `user_rejected_at=NULL` (the column did not exist yet) → invisible to the learner. Conservatively correct, but should be documented.
- **E5** — All 3 🟡 fixed: KONZEPT aligned, `promote()` clears `user_rejected_at`, legacy convention documented.
- **E6** — Self-merge PR #17.

## Process lesson (core)
**Subtle status semantics can topple a whole slice class.** My first attempt had 14 ACs, all green. But it satisfied the constraint only **literally** ("we learn from reject actions"), not **semantically** (what IS a reject action?). `local_status='quarantined'` is the formal marker in the schema — but semantically it is a mixture of user reject AND system protection. An allowlist by status name confuses the two. The clean solution was an **explicit user-action column** (`user_rejected_at`) that is structurally set by only a single code site.

**Lesson for Stefan's bias constraint**: "learning from user actions" is a sharp promise. It must be fulfilled by **structural** separation between user action and system action, not by heuristic status interpretation. The column name `user_rejected_at` encodes the semantics directly in the schema.

**The adversarial audit found the path I had not seen.** The auditor ran a few probes:
- 10 system-quarantined edges → `suggested: untrusted` ✗
- 10 decay-superseded edges → `suggested: untrusted` ✗
- mixed → confabulation systematic.

Classic sycophancy blind spot: 14 ACs all green, because all tests only mutated `local_status` directly. Real paths (system quarantine, decay) were not tested — the auditor uncovered that with two additional probes.

**Re-audit still finds something.** After the 🔴 fix, three 🟡 surfaced: doc drift (classic), `promote()` un-reject (semantic gap), legacy convention (undocumented). Three audit rounds would not have been surprising — the 🟡 were closable in one round without new code.

## Substantive lesson
**Explicit columns > implicit status interpretation.** If an action has different semantic meanings (system protection vs. user choice), that belongs in separate columns or status values. Otherwise a learner algorithm learns from the wrong source.

**`promote()` is the symmetric operation to `reject()`.** If `reject()` increments a learner counter, `promote()` must take it back — otherwise inconsistency arises as soon as the user changes their mind.

**Make legacy conventions explicit.** Pre-slice data is often "invisible" from the new view lens — that is conservatively correct (cannot be distinguished) and should stand in the KONZEPT as a deliberate convention.

## Open
- **Slice #6.3** (in progress): access-based decay / spaced repetition.
- **Slice #6.2** (pending): episode→schema consolidation.
- **Slice #6.4** (pending): global spec tuning signed+federated (the largest slice with wire extension).
- **Auto-apply variant** (deferred): on repeated proposals of the same demotion, a trust-decay mechanism could automate the apply — deliberately NOT in #6.1, because that heads back toward "encoded bias". Stefan would have to authorize that explicitly.
