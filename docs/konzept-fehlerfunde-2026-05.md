---
title: Konzept error findings NSAI-Edge (independent adversarial review)
date: 2026-05-29
status: Finding list (read-only review, no code/Konzept edit)
scope: nsai-edge/KONZEPT.md v2.4
hinweis: Written while KONZEPT.md + engine.mjs were being edited in parallel by another agent. Findings apply to the disk snapshot at that time; engine.mjs was mid-write (NULL byte) → NOT counter-checked. Verified against intact rules.mjs/conformance.mjs/db.mjs.
---

# Konzept error findings NSAI-Edge

Independent second perspective (parallel to the ongoing Konzept (concept document) editing). Every finding confirmed firsthand at the source.

## 🔴 NEW & critical (parity-endangering, not mentioned in any retro)

### K1 — Contradictory `sourceTier` scale
- `rules.mjs:21` & §B: `gesetz 6, behoerde 5, sensor 4, fachquelle 3, manual 2, web 1, llm/inference 0`.
- KONZEPT **UC-MS line 1035**: `sensor=1, web=2, manual=0, behoerde=4, gesetz=5, audit=6` — completely different numbering; `audit` does not exist in the code.
- Effect: `clusterContribution = trustRank × tier` → `full × behoerde` = 5000 (code) vs. 4000 (UC-MS); reaches `AUTH_FLOOR=4500` in one case, not in the other. A PHP re-implementation following UC-MS would break the declared parity.
- Fix: align the UC-MS table + glossary (`audit 6`, line 672) to the `rules.mjs` scale; clarify whether `audit` is meant to be a real tier.

### K2 — `AUTH_FLOOR` example calculates wrongly
- UC-MS **line 1047**: "`trustRank ≥ full × tier ≥ fachquelle`" is said to reach `AUTH_FLOOR=4500`. But `full(1000) × fachquelle(3) = 3000 < 4500`.
- `rules.mjs:39` correctly says: 3000 < AUTH_FLOOR; only `full × behoerde = 5000` reaches it.
- Fix: "`tier ≥ fachquelle`" → "`tier ≥ behoerde`".

## 🟡 NEW & important
- **M5** — Recency half-lives (`{eternal:∞, stable:3650, temporal:180, ephemeral:30}`, rules.mjs:28) only in the code, in §B only qualitatively → add a normative table in §B/§5.
- **M2** — `weighted_support` (Σ over clusters) without cap/range note; other UCs have DoS caps. Add a range note.
- **K3** — Decay recall divisor `trunc(reduction/divisor)` can drop to 0 → silent decay standstill; record as invariant/AC (`max(1, …)` or a deliberately allowed stop).
- **M1** — TOC drift: lists "UC-01…UC-11", really ~19 UCs + §G/§H/§I.
- **G1** — AC number collision (`AC-9/10/11/12.x` assigned several times) → UC prefix in the §H slice ACs.

## 🟢 Known-accepted (Retro 0012 — consolidation gap, no new error)
- **M3** — Self-endorsement escalation (`full × gesetz 6 = 6000 ≥ 4500`) + cluster correlation: deferred as residual-risk prose (UC-MS lines 1055/1059) + slice #M.2, but NOT in the §7.2 STRIDE table. Add table + cross-reference to AC-15.15/15.16.
- **M4** — AC-15.13 checks float-free *output*; no AC structurally forbids a float leak from `search`/PPR into a *verdict computation path* (provenance taint). Narrow hardening point.

## 🚀 Breakthrough solution for the deferred slice #M.2
**MeritRank (arXiv 2207.09950) — Sybil tolerance instead of detection.** Deterministically bounds the gain from Sybil/collusion via decay on a weighted random walk (= the existing PPR machine):
- **Connectivity decay** devalues contributions that hang on the pre-trust seed only via a single bridge — exactly the correlation/cluster case (M3), without "accusing" clusters (resolves the "collective punishment" objection from Retro 0012).
- **Transitivity decay** dampens with distance to the seed.
- Warning: **epoch (time) decay does NOT improve Sybil tolerance** → the existing time decay does not protect against Sybil.
- Synergy with **C1 (EigenTrust lens)**: C1 + MeritRank decay = Sybil-tolerant trust lens without a fragile cluster detector; deterministic, fixed-point, seed-anchored, local lens → all 4 invariants preserved.

In addition: **truth-discovery copying/dependence detection** (SmartMTD arXiv 1708.02018; Dong et al.) = statistical basis for dynamic cluster inference from behaviour instead of a manual `cluster_id`. **Decentralized reputation trilemma** = framework for honestly declaring in the Konzept which property is sacrificed (pre-trust seed dependency).

## 🔬 Root cause of K1/K2 (verified in conformance.mjs)
The anti-drift gate runs only `decay` + `infer` as real input→output vectors (`conformance.mjs:20-21`, `requiredOps` default). The **quorum/belief path has NO behaviour vector**. The constants mirror `QUORUM_CONSTANTS` (lines 54-58) mirrors `quorumAuthFloor/quorumMulti/quorumTrustRank`, **but NOT `sourceTier`/`trustTierCap`** — exactly the tier table from K1. Test AC-R7.3 checks only "mirror == spec object" (regression against itself), never the arithmetic.
- **Consequence:** The quorum parity declared as "PHP-mirrorable" is only half covered — the `tier` input (`sourceTier`) to the formula `clusterContribution = trustRank × tier` is neither vectorised nor constant-mirrored. Drift there (K1) is invisible to the gate.
- **Scope note:** Belief softmax (`beliefSharpness`/`recency`) is, per the §B float note, deliberately "not conformance-relevant" (local float lens) — that is OK. The finding concerns ONLY the quorum path declared as integer/bit-exact.
- **Fix:** (a) add `sourceTier`/`trustTierCap` to the constants mirror; (b) add a quorum behaviour vector (`op:'resolve_belief'`/`'quorum'`) that checks `clusterContribution`/`weighted_support`/verdict integer-exactly; (c) extend `requiredOps` by this op.

## Addendum — §G/§H/§I pass (2026-05-29, Konzept grew 1372→1747 lines, actively edited)
Note: The other agent is already integrating proposals (e.g. §I.3 = B1/SOC-PMI + E3 contained with falsification threshold `Recall@5<0,7`). These strands were NOT re-evaluated.
- **Positive:** constants-mirror discipline exists for slices 6.1/6.3 (`LEARN_CONSTANTS`, `DECAY_RECALL_CONSTANTS` in conformance.mjs) — the K1 `sourceTier` gap specifically concerns the older M.1/belief path.
- **Candidate F-1 — `SUGG_CAP=50` not mirrored:** §G.2 (line 730) names `SUGG_CAP=50` as parity-relevant, `LEARN_CONSTANTS` (conformance.mjs:65-69) does not contain it. Same omission class as sourceTier. (Existence in the code unconfirmed — engine.mjs mid-write.) — **✅ DONE:** `SUGG_CAP`+`LIMIT 20` were local magic literals in `learnTrustAdjustments`; lifted into the spec (`suggestionCap=50`, `suggestionEvidenceCap=20`), engine reads from it, mirrored in `LEARN_CONSTANTS` (AC-R7.13). §G.2/AC-20.12 contradiction reconciled (local op; mirror only binding if PHP offers its own `learnTrustAdjustments`).
- **Candidate F-2 — status drift §H:** UC-EP ACs (AC-10.1–10.9) marked as "open (slice #2)", although test/engine-episodic.test.mjs exists + Retro 0006 slice completed. Probably "built in code, open in Konzept". Verify before acting. — **✅ DONE (fully):** deterministic coverage map from the test titles (named by AC id, incl. combined names `AC-X/AC-Y`) against all 11 §H slices. Result: §H from ~138 blank "open" → **131 green** (with test file reference) + **7 open with an explicit reason** (6 real test gaps: AC-10.11, 12.5, 15.8, 15.9, 15.11, 21.16; 1 deferred: AC-15.15 #M.2 endorsement revocation). From now on "open" in §H ALWAYS means "documented gap or deferred", never "forgotten". Surfacing value: 6 real test gaps made visible.
- **G1 confirmed pervasive:** AC number collision UC-TMS/UC-09 (`AC-9.x`), UC-EP/UC-10 (`AC-10.x`).

## ⭐ Meta finding (highest leverage — process)
K1/K2 are an error class that green tests (read only `rules.mjs`) AND adversarial audits (check only behaviour) systematically miss: **numeric constant in prose ≠ code.** Recommendation: extend the existing `konzept-model-api` gate by a **constants-table consistency check** (diff the sourceTier/trustTierCap/quorum*/decay/recency tables in KONZEPT.md against rules.mjs/conformance.mjs). Would have caught K1+K2 at 0 tokens.

## Sources
- Sybil tolerance: https://arxiv.org/abs/2207.09950 (MeritRank) · https://arxiv.org/pdf/1803.06772 (SybilFuse) · https://www.princeton.edu/~pmittal/publications/sybilfuse-cns18.pdf
- Truth discovery / copying: https://arxiv.org/pdf/1708.02018 (SmartMTD) · https://arxiv.org/abs/1505.02463 (Survey)
