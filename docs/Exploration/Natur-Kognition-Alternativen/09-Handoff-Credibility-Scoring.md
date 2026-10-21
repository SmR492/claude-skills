# Handoff: Credibility Scoring (CDP5 §28.4)

> **Handover document** for the continuation of the credibility-scoring strand. Status 2026-06-01. Self-contained: what stands, what blocks, where to continue.
>
> **Relation to the entrenchment strand:** This scoring supplies the **trust/credibility substrate** for the ADR "belief from terminal authority → defeasible entrenchment" (which the other strand drives). The order remains: **(1) entrenchment ADR → (2) this scoring → (3) mode axis (`assertion_mode`/worlds).** Full model background: `07-Bruecke-zu-Defeasible-Entrenchment.md`; open fundamental decisions: `08-Offene-Punkte-zum-Entscheiden.md`.

## TL;DR
There is a CDP5 Konzept (concept document) **`nsai-edge/KONZEPT-credibility-scoring.md` (v0.3, konzept-lint 10/10, 11 UCs)**. Two review rounds completed. **The deterministic core is solid; the adversarial security of the *learned* layer is not** — and that is an architecture decision, not a patch. **Blocked on a Stefan decision (A/B/hybrid, see below).**

## ✅ Decision made: A — integrate MeritRank (Stefan, 2026-06-01)

**Reasoning:** "We develop everything first anyway and then go live" → the dependency on the C3 MeritRank slice is not a blocker; what gets built is the adversarially clean full architecture (A), not the scaled-down B variant.

Background — the re-audit (v0.3) showed: all security mechanisms of the learned layer (variance gate, corroboration quorum, domain separation) rest on `independentRoots` = "DAG-disjoint provenance". That is **constructible by the attacker at ingest** → no Sybil resistance → circular precondition (§32.8(7)). **Structural ≠ unmanipulable, as long as the attacker builds the ingest graph.**

→ Sybil resistance is a **prerequisite, not an accessory**. Three paths:

| Option | Content | Consequence |
|---|---|---|
| **A** | integrate MeritRank (C3) → `independentRoots` Sybil-resistant (connectivity decay) | adversarially sound, but scoring **depends on the C3 slice** |
| **B** | scale down: only **gated anchors + human** are security-relevant; lock path (c); domain/structure only from **endorsed ontology**; learned propagation = **labeled, non-adversarial ranking hint** | immediately secure, smaller scope |
| **Hybrid** *(recommendation)* | **B now** (defensible core) **+ A as roadmap** (the learned layer gets teeth when C3 lands) | solves N-1/N-3/N-4/N-6 in one cut |

**Consequence of A:** `independentRoots` becomes Sybil-resistant via MeritRank (C3) (connectivity/transitivity decay, **seed = the exogenous gated/human anchors**). This couples this slice to **C3 MeritRank** (itself still `evaluated_pending`, §I.3-C3) — both must be co-designed, `independentRoots` is the shared interface. The seed (gated/human) becomes load-bearing (decentralized-reputation trilemma: MeritRank sacrifices seed independence for Sybil tolerance — fits the "exogenous anchor" line from 07/08).

## What stands (defensible)
- **Model (07):** credibility = internal, deterministic read lens over ordinary nodes; Beta balance `(α,β)` → score `floordiv(1000·α/(α+β))`; skeptical prior Beta(3,7)=300‰; 5 bands; trust-dependent recency; calibration + surprise weight; propagation via `ist_ein` (partial pooling); domain separation; anchor-bound adjudication.
- **Mechanics fixes HOLD (empirically confirmed in the re-audit):** **F-1** (reversion sign, high score → slow fading), **F-2** (asymmetric limiter: penalties bypass the cap), **F-4** (egress only 5 bands, gated/human adjudication, learned nodes never adjudicate), **F-5** (`floordiv` toward −∞, division in floor, Node↔PHP parity incl. negative numerators).
- **Lint:** structural partial score 10/10, all 11 UCs with binary AC + error cases. Test skeletons derivable via `ac-to-test-scaffold` (32+ AC).

## Review history
| Round | Gate | Result |
|---|---|---|
| v0.1 | konzept-lint | 10/10 (after AC-ID/scope fix) |
| v0.1 | konzept-reviewer (a) | **6.4/10** — core under-specified (L1 black-box formulas, L2 determinism, L3 scale), 3 missing UCs (adjudicate, pin/unpin, audit log) |
| v0.1 | adversarial-auditor (b) | **NO** — F-1 (sign), F-2 (velocity axis), F-3 (variance gate inverted against Sybils), F-4 (circular adjudicator), F-5 (float/parity) |
| v0.2 | fixes | F-1/F-2/F-3/F-4/F-5 + L1/L8/L9/L10 + UC-08/09/10 |
| v0.3 | V1/V2/V3 + Gemini ledger (§10) | domain trust-independent single-primary (UC-11); coherence three-valued + numeric tolerance; absolute floor + cold-start cap |
| v0.3 | adversarial-auditor (re-audit) | **NO** — mechanics hold, but new 🔴: ingest-manipulable structure (see findings) |

## Open findings → v0.4 worklist
**A core (solves F-3/N-3):**
- **F-3/N-3 🔴 → A:** redefine `independentRoots` via a **MeritRank-weighted walk** (seed = gated/human anchors; **connectivity decay** dampens N Sybil roots behind *one* bridge to ~1; **transitivity decay** dampens with distance to the seed). Thus `independentRoots` is no longer ingest-forgeable → variance gate + quorum hold, **path (c) can safely be re-enabled** (the anchor must additionally corroborate the disputed (S,P,O)). Shared interface to the C3 slice.

**Also needed under A (A does NOT subsume this — correction of the earlier grouping):**
- **N-1 🔴** `domainOf` ingest-manipulable via content `ist_ein` — MeritRank concerns the *provenance-trust* graph, **not the content ontology**. Still needed: `domainOf` uses only **gated/endorsed** content `ist_ein`; ingest-new edges → default domain `unzugeordnet`. (AC-11.5)
- **N-4 🟡** `source_tier` **not self-assertable** (default web until endorsement); `COLD_DOMAIN_CAP` → 500 (never up to the `plausibel` threshold).
- **N-6 🟡** domain creation gated (ingest-free → shared `unzugeordnet` collection domain); liveness AC.

**Fork-independent (immediately, pure mechanics):**
- **N-2 🔴** V3 tolerance band breaks the float contract (`value()` nowhere specified as integer; AC-8.4 example "180,2" is float + does not test the boundary). Fix: `value()` as **fixed-point integer (milli) per predicate type**; tolerance integer-only; AC-8.4 with a real boundary value (181,8→corrob., 181,9→contra.) + `anchor=0` special case; Node↔PHP boundary AC.
- **N-5 🟡** Audit-log gap: `velocityLimit`/`rollback` mutate the balance **after** the audit entry without their own entry. Fix: velocity/rollback/release/revert each write one entry; **Δ conservation** (balance = Σ audit deltas). (AC-10.4)
- **§3.0** Number the behavior steps of all UCs (packed inline in v0.3 → lint warning "steps not numbered", no gate fail, but §3.0 obligation).
- **V4** Constants tuning (k, `LAM_MIN/MAX`, `VELOCITY_CAP`, `BANDS`, `TIER_BASELINE`, `NUMERIC_TOLERANCE`, `COLD_DOMAIN_CAP`, `BLEND_W`, `INDEP_CAP`) — Stefan decision.

## Core lesson (for every ingest-driven trust mechanic)
**Sybil resistance is a prerequisite, not an accessory.** Every security property that rests on a graph-structural property (domain, independent roots, provenance diversity) is worthless as long as the attacker builds the structure at ingest. Adversarial guarantees exist only at **exogenous anchors** (gated/institutional, human endorsement) or via the **identity/cost axis (MeritRank)** — never from the learned layer alone. This coincides with the entrenchment finding (07/08): the human / `user_rejected_at` is the only external oracle; everything else is defeasible and manipulable.

## Next step for the agent taking over
1. ✅ **Decision A made** (2026-06-01) — no more blocker.
2. Write v0.4: §3.0 numbering + N-2 + N-5 (immediately, fork-independent) + **A** (`independentRoots` via MeritRank) + the also-needed-under-A **N-1/N-4/N-6**.
3. `konzept-lint` → `konzept-reviewer` → **renewed `adversarial-auditor` run** (🔴 obligation).
4. Anchor the **C3 MeritRank slice** as a precondition in the roadmap (§I.7); define `independentRoots` Sybil-resistant there (shared interface). C3 is itself `evaluated_pending` → needs its own slice concept; **co-design C3 and this scoring.**
5. Integration as `§J` into the main `KONZEPT.md` **only after** the entrenchment ADR (V5).
