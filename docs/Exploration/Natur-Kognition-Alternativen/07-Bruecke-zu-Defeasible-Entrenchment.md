# Bridge: Defeasible Entrenchment & Earned Trust Model

> **Exploration/bridge material** (design dialogue Stefan ↔ Claude, 2026-05-29). **No CDP5 binding, no ADR, no decision** — citable **ADR input**. Connects the lie/truth/fiction lens (`06-…`) with the "defeasible entrenchment" direction that another Claude instance formulated in parallel.
>
> **Reading note (working method):** This document records a *dialogue of equal contributions*. Stefan's suggestions **(S)** and Claude's refinements **(C)** are marked; rejected/revised first proposals *remain* (with reasons), because the path of thought is part of the material — fitting the topic itself (thesis → antithesis → synthesis). Stefan currently considers the refined proposals better, but rates them as equal options.
>
> **Invariant legend:** (1) zero-dep · (2) offline · (3) determinism · (4) CRDT convergence · (5) local read lenses over the signed wire value · (6) "count never counts" · (7) open-world · (8) "never guess".

---

## §1 Initial tension (from `06-…` + parallel instance)

NSAI-Edge today squeezes three categorially different things into `source_type`/`trust_level`/`confidence`. **(S)** "Can we distinguish lie/truth/fiction? Do we have to replace the TrustLevel?" **(C)** No-replace, yes-complement: the TrustLevel measures *provenance* correctly; two orthogonal axes are missing. A "better system that distinguishes lie from truth" is impossible in the strong sense (Tarski) — exactly the overreach the project is built against.

## §2 The three orthogonal axes

1. **Provenance authority** (WHO) — `source_tier × origin_trust`. Decidable, social/institutional.
2. **Truth value** (IS it so) — correspondence/coherence/consensus; per **Tarski** internally only *approximable*, never *definable*. Never stored as a field, always derived.
3. **Assertion mode** (HOW put forward) — Kant modality (problematic/assertoric/apodictic) + Searle/Lewis (fiction = commitment-*suspended*, not false). Fiction is *scoped*, not refuted.

Orthogonality: an authoritative source can say fictional things; the llm tier can say true things assertorically; a lie has full commitment + false value + arbitrary provenance.

## §3 Defeasible entrenchment (architecture decision, parallel instance)

**(S)** Core axiom: **"Everything that comes in is initially refutable, because we do not yet know the truth."** = fallibilism / AGM entrenchment / Popper (trusted → tested).
**(C)** **Do not abolish trust, but switch it from *terminal authority* to *defeasible entrenchment*: trust = refutation *threshold*, not verdict.** Abolishing it would break Sybil protection, echo-chamber neutralization, deterministic merge, domain semantics (`gesetz > web`). Three oracle-free paths:
1. **Contestation override:** a large + *independent* + corroborated contradiction tips a top tier to `contested` — **never to `contradicted`** (one cannot assert the other side as *true*, only the authority as *contested*).
2. **Earned instead of assigned trust** (track-record drift) — see §6.
3. **Human override** (exists; endorsement = external oracle).

**Hard limit:** an internally consistent, *uncontradicted* lie from a trusted source is undetectable for *any* closed system without an oracle. Achievable bar: **no lie survives that available independent evidence contradicts.**

## §4 The defeater trigger (when does a contradiction become a defeater?)

**(S)** Everyday rule: accept the unknown at first; two equally foreign contradictions → look it up online at *one credible* source; if a stranger contradicts a *known* source → I suspect the stranger is lying and have them prove it.
**(C)** That is the missing trigger specification = **epistemology of testimony** (Reid: default belief until defeater) + **burden of proof** (Walton). Three answers, depending on the trust relationship:

| Situation | Behavior | Mechanics |
|---|---|---|
| **A.1** Foreign, no counter-knowledge | "accept at first" | low entrenchment, default belief, no reject |
| **A.2** Two *equally* foreign sources contradict each other | "look for a credible source" | `contested` + **escalation one tier level UP** |
| **B** Known X, foreign ¬X | "the stranger is lying, let them prove it" | trusted **holds**; **burden of proof → stranger**; contradiction **not discarded**, but persistent open contestation |

Rules derived from this:
- **Threshold relative to trust distance:** a defeater tips to `contested` only if its *entrenchment-weighted backing, supported by independent roots,* **exceeds** the entrenchment of the established statement. Below that: only logged + challenger burdened.
- **Escalation UP (tier), corroboration in BREADTH (independent roots)** — two axes. Ten strangers who copied from each other = *one* source (hash-DAG independent roots → formal "count never counts").
- **(C) Trap in B, honest pushback:** "the stranger is lying" reproduces exactly the single point of failure — *if the known source lies*, one wipes away the truth-telling stranger. Protection: a dismissed contradiction remains an **open loop (Zeigarnik)** that *accumulates* — every *independent* identical contestation nibbles at the entrenchment of the known source, until enough independent contradictions themselves breach a high threshold → `contested`. "Believe they are lying" = *presumption + persistent contestation + trust deduction*, **not deletion.** (That is exactly why contestation override and earned trust are *the same* accumulating machine.)

## §5 The entry matrix (assessment on entry of a These)

**(S)** "A 6-factor matrix at entry; as long as I have not confirmed it myself, it counts as *not secured* — not true/false, but **with tendencies**."
**(C)** Yes — and "matrix" is apt: **rows = factors · columns = competing objects** → column sum = **tendency distribution**, the "winner" is not *true*, only *strongest tendency, still not secured*. That re-derives the Konzept's (concept document's) own A4/MYCIN position (*confidence = evidence weight, not probability of being true*). Cut more cleanly than "6 of the same kind":

- **Before — mode gate (axis 3):** only *assertoric* theses pass through the matrix; fiction/hypothesis/quotation → scoped into a **world/context** (ATMS/Lewis), *no* truth tendency. (That was missing from the 6-row table.)
- **Tendency factors (5):** ① provenance (`tier × origin_trust`) · ② rebutting consistency (`verify`: does it contradict higher-trusted stock?) · ③ undercutting justification (TMS: does the support still live?) · ④ corroboration (independent roots) · ⑤ recency (decay). *(② and ③ separate = the two defeater types, Pollock rebut/undercut — no duplication.)*
- **Floor, not a factor — open-world:** no basis → `unknown`, *no* tendency (honest not-knowing).
- **Container, not a factor — status `gesichert`/`nicht gesichert`:** flips only through self-confirmation. Until then: tendency only.
- **Representation of the tendency:** belief distribution *or* **possibility/necessity interval `[N, Π]`** (N = evidenced lower bound, Π = not-excluded upper bound, gap = "not secured", position within it = tendency). *Local read lens only* (otherwise Subjective-Logic wire breach). Even "secured" = "until refuted", never "true" (Tarski).

## §6 Trust dynamics — earned, local `origin_trust`

### Two fields, not one
**(S)** "We need a TrustLevel 0–100 per source."
**(C)** Yes to *continuous + earned*, but: **0–1000 integer per mille** (consistent with confidence, determinism/parity), and **two orthogonal fields**, so that the continuous number does not swallow the *hard* tier:

| Field | Role | Property |
|---|---|---|
| `source_tier` (0–6) | **Prior/baseline** — where the refutation threshold starts | hard ordinal class, *not* computable against (carries "gesetz>web regardless of count" + tier cap) |
| `origin_trust` (0–1000) | **Modulator** — drifts with track record | continuous, **local**, **earned**, read lens |

Tier = prior, `origin_trust` = movement around it, defeater trigger = what breaches the threshold. (A single value would dissolve the hard class → enough high-trust web beats a law = count trap.)

### Score as projection of a balance (Beta reputation)
**(S)** "entwickler.de 79, Bild.de 36; if Bild loses the dispute, entwickler drops by 5, Bild rises by 3."
**(C) Pushback:** fixed deltas have two bugs — (a) the magnitude would have to scale with the *surprise* (Elo: `Δ = K·(actual − expected)`); (b) fixed −5/+3 leak points *net* → even honest 50% sources sink to 0. Better: **store the balance `(α successes, β failures)`, *derive* the score** (instead of mutating an account):
```
trustScore = floor( 1000 · α / (α+β) )          # Promille, deterministisch
```
That scales automatically (a young source moves a lot, an established one little), **without deflation, without magic deltas.** The "easy to lose" asymmetry comes as a *capped* knob (failure overweight), not from arbitrary numbers.

### Prior = skeptical start
**(S)** "Start at 30 (good skepticism), 50 = middle, 80 = trustworthy."
**(C)** "30" is not a start score but a **Beta prior** (otherwise a fresh source mathematically starts at 50): **Beta(3,7)** → `3/10 = 300‰`. The actual knob is the prior **strength** `k=α₀+β₀`: "good *movable* skepticism" = **weak** prior (k≈10) → ~25–30 clean corroborations to reach 80 (earned, reachable). Strong prior = permanent prejudice (bad). Bands double as categorical presentation (B5/Rosch): `<300` skeptical · `300–500` unconfirmed · `500–800` plausible · `≥800` trustworthy. The scale is *non-linear* (30→50 cheap, 80→90 expensive) — exactly "must be earned".

### One update rule for all cases (incl. partial truth)
**(S)** "Both partly true/partly lied → both −1; one with more truth → that one +1, the other ±0."
**(C)** "How much truth" is only decidable because the These decomposes into **atomic triples**, each adjudicated binarily → **`s` = corroborated/all triples** of the source. One rule subsumes all cases (win/loss/half/more):
```
α += korrobierte_Tripel ;  β += widerlegte_Tripel      # fraktional, s = c/N
```
Expectation relativity falls out automatically: a 50% performance **lowers** entwickler (reputation 79) but **raises** Bild (reputation 36) — *no* fixed "both −1".
- **Calibration weight (C):** an *overconfidently* asserted, then refuted triple counts **double** on β (presumption hurts, honest uncertainty hardly; Brier/ECE link → D1/E1).
- **Surprise weight (C):** a failure at a high level costs more (established ones sink faster).
- **Oracle gating (C):** updates fire **only** on adjudicated outcomes (higher-tier correspondence / independent corroboration / human); the challenger's gain comes from the *evidence brought*, not from loudness → blocks "fabricate disputes to farm trust" (Sybil).

### Recency instead of tenure (mean reversion)
**(S)** "Length of trustworthiness as a multiplier: newcomers rise harder; established+reliable ones rise by themselves; established ones can sink faster."
**(C) Pushback:** *calendar length* is the wrong variable (gameable = **sleeper attack**; double-counts what Beta can already do). Reframe as **sustained, recent reliability** = **mean reversion of the Beta balance toward the prior** (forgetting): `α ← λ·α + (1−λ)·α₀`, `β ← λ·β + (1−λ)·β₀`. Delivers all three effects evidence-based:

| Stefan's effect | from mean reversion |
|---|---|
| Newcomers have it harder | ascent must *outrun* the reversion (no parking on a short streak) — fair, without newbie penalty |
| Rises if it **stays** established+reliable | sustained hits beat the reversion → stays on top |
| Established ones sink faster | faded old credit no longer protects → the error run dominates |
| *Bonus: anti-sleeper* | a silent source drifts back to 30 (does **not** rise through aging) |

**(C)** Against property 1 as an *extra* throttle: the prior already makes newcomers skeptical; an additional newbie throttle needlessly aggravates the cold-start problem. **Trap of the literal proposal:** "slow-up-young + fast-down-old" as raw multipliers → *nobody stays stably on top* (permanent churn). Mean reversion is self-correcting.
**Costs (honestly):** leaves pure integer counts → fixed-point milli counts; needs a deterministic time anchor (= the *existing* confidence decay, reused); **is adaptivity, NOT Sybil defense** (research: time/epoch decay does not help Sybil tolerance — that is done by MeritRank's connectivity decay, a *different* axis — do not confuse).

### Open trust decisions
- **Global vs. per (source × domain):** CDPR (§7) shows: trust decayed domain-split (narrative held, tech/marketing crashed). Strong argument for domain-specific trust; simpler start global. **Open.**
- **Introduction provenance:** human-added possibly starts at 50 (the act = weak endorsement), anonymous at 30; own knowledge/inference (self) stays anchored (full).
- **Constants** (`λ`, `α₀/β₀`, bands, calibration/surprise weight) = wire constants → constants-consistency gate.

## §6-new (synthesis 2026-06-01): Impulse-ledger trust over the provenance DAG

> **Supersedes** the account-mutation mechanics from §6 (remains as path of thought, doc convention). Also replaces the tag-propagation network (#6 from `08-…`): instead of letting trust oscillate over a complex tag network, we extract the dynamics directedly from the **existing, cycle-free provenance structure** + the adjudication verdicts. **(S)** idea (2026-06-01), **(C)** four invariant corrections (float→integer, primary events only, total order, independent-roots denominator).

**Core axiom:** Trust is **not a stored state** but a deterministic **projection (fold)** over an append-only **ledger of adjudicated impulses**, directed along the TMS DAG. There is no frozen `trust` field; the trust of a node at `T` = cumulative balance of all shift impulses up to `T`.

### Substrate — event store (append-only)
ONLY **primary adjudication events** on the *directly* judged item are stored:
`E = (target_id, adj_class, delta_promille, occurred_at_norm, event_hash)`
- `adj_class ∈ {human_endorse, human_reject, oracle_higher_tier, auto_corroborate}` — anchor class (oracle gating).
- `delta_promille ∈ [−1000,+1000]` — **integer per mille, NO float** (invariants 3/4, same discipline as K1/K2/conformance). Partial truth from the triple decomposition: `delta = trunc(1000·(c−w)/N)` with `c` corroborated, `w` refuted of `N` atomic triples.
- Source/parent contributions are **not** stored — pure read-time projection over the DAG (no double counting, append-only stays pure).

### Projection — the fold (read-only, deterministic)
`trust(node, T)` = fold over all events up to `T` in **deterministic total order** `(occurred_at_norm, event_hash)` (otherwise not every node folds identically → CRDT breach, invariant 4). Three directed contributions per event on K:
1. **Direct (K):** K's balance shifts by `delta`.
2. **Source(K):** `Δ_source = trunc(delta · w_src / 1000)` — the source's Beta balance (§6) as a fold contribution instead of account mutation.
3. **Parents(K)** along `derived_from`/`episode_triples`, with two protective filters:
   - **Distance decay (integer):** `delta_parent = trunc(delta · γ^d)`, `γ` per-mille coefficient, `γ^d` as d-fold truncated multiplication (no float exponential).
   - **Attribution + dilution:** parent deduction ONLY on premise-attributed failure (**undercut**, not rebut — Pollock); divided by `n` = **number of independent roots** (hash-DAG/MeritRank independence, NOT raw child count): `Δ_parent = trunc(delta_parent / n)`. Thus a single faulty leaf does not tip a broadly supported parent hypothesis.

### Oracle gating / "count never counts" (invariant 6)
Only externally anchored `adj_class` (`human_*`, `oracle_higher_tier`) produce significant shifts. `auto_corroborate` (e.g. identically built sentences from 3 books) only stabilizes within a plausibility band and produces **no independent impulse cycles**; correlated children are counted as **one** signal via their common origin hash.

### Tags = cold-start prior (static, no dynamics)
New source without history: tag-composed Beta prior (skeptical, e.g. `Blog` → low). As soon as own adjudicated events exist, **the fold completely dominates the prior.** Tags do not oscillate — they are only the cold-start hint.

### Properties
- **Safe-by-default:** without events every node stays at the prior — the system does not swing, it is merely inert. → *safely buildable early*, learns with a growing adjudication stream (defuses the empirics gate #14).
- **Gating invariant:** the fold runs fully automatically, read-only, locally — no blocking write/sync path; optional materialized snapshots as cache (the ledger remains authoritative because it is immutable).
- **Exception institutional floor:** a computed trust crash NEVER autonomously lowers an institutional tier/floor (law); such a change is **endorsement-mandatory** — the system proposes, does not execute (constraint #4 + defeater type "institutional act", §11-b).

### AC sketches
- AC-T.1 Fold deterministic + totally ordered → same event set ⇒ identical trust on two nodes (CRDT parity).
- AC-T.2 Integer per mille throughout, no float (constants-consistency-gate-capable).
- AC-T.3 Distance decay capped: a leaf reject lowers a parent node broadly supported (n independent children) by at most `trunc(delta·γ^d/n)`.
- AC-T.4 Undercut vs. rebut: a child reject attributable to the rule (not the premise) leaves the parent trust untouched.
- AC-T.5 Oracle gating: `auto_corroborate` alone lifts no node above the plausibility band; correlated origin = one signal.
- AC-T.6 Institutional floor: a negative fold only PROPOSES a tier reduction; without endorsement no execution.
- AC-T.7 Safe-by-default: without events == prior (no drift).

## §7 Validation on examples

### entwickler.de vs. Bild.de (Beta trajectory, illustrative)
| Event | entwickler ✓/✗ · α/β · score | Bild ✓/✗ · α/β · score |
|---|---|---|
| Start (prior 3/7) | — · 3/7 · **30** | — · 3/7 · **30** |
| early | +6✓ → 9/7 · 56 ; +5✓ → 14/7 · 67 | 1✓3✗ → 4/10 · 29 |
| **Dispute** | 4✓ → 18/7 · **72** ↑ | 1✓3✗ → 5/13 · **28** ↓ |
| half true (50%) | (would *drop*, since 50%<reputation) | 2✓2✗ → 7/15 · **32** ↑ (50%>reputation!) |
| overconf. blunder (×2) | 2✓ 2✗→β+4 → 20/11 · **65** ↓ | genuine upset (higher-tier evidence) 3✓1✗ → 10/16 · **38** ↑ |
| Recovery | +7✓ → … → **~79** | back to pattern → **~37** |

Lessons: the same dispute moves them in opposite directions; "half true" lifts the weak and lowers the strong source (expectation-relative); overconfidence costs double; Bild climbs *only* with genuine evidence; the peak is sticky; a few hits do not launder a bad balance.

### CD Projekt Red (real stress test)
| Time | Event | Score |
|---|---|---|
| 2007→2015 | Witcher 1→2→3+DLCs, *sustained* | 30 → **~90** |
| Dec 2020 | **Cyberpunk 2077** — collectively refuted, overconfidently marketed promises at peak trust | **~40** (single-event crash) |
| 2021→2024 | patches → 1.5 → **2.0 + Phantom Liberty** (celebrated), *sustained* | 40 → **~80** (not fully back to 90) |

**Why the model reproduces this:** Cyberpunk is *one burst of triples* × overconfidence(×2) × peak-trust surprise(×2) × recency dominance → the titan falls from a great height. An *unknown* studio (30) would fall only to ~26 for the same error. **Recency forgetting is *necessary* for the recovery** (purely cumulative, the crash β mass would be almost insurmountable — the real 4-year recovery *empirically proves* that trust systems forget). Plateau below the old peak = not-quite-faded scar.
**Where it creaks (honestly):** trust here is *not a scalar* — "CDPR×narrative" held, "CDPR×tech/marketing" crashed → **strongest real argument for domain-specific trust.** Platform-dependent adjudication (PC vs. last gen) → contextual/bitemporal. Social amplification (shitstorm/refunds/Sony delisting) lies *outside* the epistemic ledger — the model maps the *epistemic* curve, not the PR dynamics. Pre-order = *promise* trust (axis-3 modality "about the future", adjudicable only on fulfillment).

## §8 Honesty limits (the guardrail against over-expectation)
- **Tarski:** no internal truth oracle; `is_true` field forbidden; `verify()` is a falsification/consistency machine, not a truth prover.
- A consistent, uncontradicted lie remains undetectable; achievable: no lie survives that *available independent evidence* contradicts.
- Trust *drifts with adjudicated evidence*, is **not a truth sensor**; the rating *accumulates the adjudicator's verdicts*, does not produce truth.
- Single-scalar trust strained (CDPR domain split) → domain-specific open.

## §9 Invariant check (overall model)
| Invariant | Status |
|---|---|
| (1) Zero-dep | ✅ (integer/Beta/decay in JS) |
| (2) Offline | ✅ |
| (3) Determinism | ✅ — fixed point for recency milli counts; constants wire-fixed |
| (4) CRDT | ✅ — `origin_trust`/tendency are *local* read lenses, not in the signed wire |
| (5) Read lenses | ✅ — balance/score/`[N,Π]`/mode derived locally or signed; signed wire fields untouched |
| (6) "Count never counts" | ✅ — corroboration = *independent roots*; trust drift counts adjudicated triples of *one* source, no source voting |
| (7) Open-world | ✅ — `unknown` ≠ false; fiction scoped; contestation → `contested`, never `contradicted` |
| (8) Never guess | ✅ — updates oracle-gated; mode gate keeps fiction out of facts; learning drift = constraint #4 → proposal/endorsement mode |

## §10 Roadmap connection
Substrate for **C1** (EigenTrust), **C3** (MeritRank — Sybil, a *different* axis than recency), **D1** (conformal — thresholds), **E1** (meta-cognition/Brier-ECE = calibration weight), **A1** (defeasible argumentation = `supports`/`rebuts`, grounded extension), **6.1** (trust adjustment). **Next step (concept-first):** CDP5 **ADR** "belief from terminal authority → defeasible entrenchment" + slice concept — **🔴 slice** (belief-core re-foundation: `resolveBelief` precedence tier-primary → entrenchment-weighted, eternal handling, mergeIncoming, verdict model) → full CDP5 + threat model of the refutation path + adversarial-auditor. **This document is the ADR input, not the ADR.**

## §11 Open decisions (collected for the ADR)
- (a) `temporality='eternal'`: drop vs. keep as *max entrenchment / slowest decay* (not "unfalsifiable").
- (b) Defeater types: **separate** evidence defeater vs. institutional-act defeater (advice: separate — otherwise a web majority "refutes" a law in force) or collapse.
- (c) Refutation threshold: integer rule, trust-/corroboration-weighted (independent roots).
- (d) Accepted residual risk: a consistent lie without contradiction is undetectable — declare explicitly.
- (e) **Domain-specific trust** (start global, later per domain?).
- (f) Prior strength `k`, recency `λ`, calibration/surprise weight, band thresholds.
- (g) Introduction-provenance prior (human-added 50 vs. anonymous 30).

## §12 Dialectic note (equal contributions)
- **Stefan's suggestions (S):** lie/truth/fiction question · "replace TrustLevel?" · categorical thinking & "These" · 6-factor entry · "not secured, with tendency" · trust 0–100 per source · −5/+3 dispute · ±1 partial truth · prior 30/50/80 · tenure multiplier · CDPR stress test · axiom "everything initially refutable".
- **Claude's refinements (C):** complement-instead-of-replace · three axes · defeasible entrenchment (with parallel instance) · 0–1000 instead of 0–100 · two fields (`tier × origin_trust`) · Beta balance instead of fixed deltas · fractional+expectation-relative+triple decomposition · calibration/surprise weight · mean reversion instead of tenure · burden of proof/open-loop trigger · Tarski guardrail · domain-specific as a real need.
- Both treated as equal options; Stefan currently considers the refinements the better ones — the first proposals remain here with reasons.
