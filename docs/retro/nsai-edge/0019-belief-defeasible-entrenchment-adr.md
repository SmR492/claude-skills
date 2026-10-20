# Retro-ADR 0019 — Belief: terminal authority → defeasible entrenchment

**Status:** DRAFT (concept-first, for the review gate) — 🔴 belief-core re-foundation
**Date:** 2026-06-01
**Sources (ADR input, verified firsthand):** `docs/Exploration/Natur-Kognition-Alternativen/06,07,08`. **Authoritative decision source:** `08` → section **„RESOLUTION 2026-06-01 (O1–O6)"** (supersedes the earlier #6–#14 deferrals). §6-new mechanics: `07`.
**Purpose:** Switch the belief core from *terminal authority* (top tier wins absolutely, irrefutably) to *defeasible entrenchment* (trust = refutation threshold, not verdict). Binding decision + mechanics + fixed parameters (O1–O6) + AC + threat model + implementation slicing.

> **Review flags (deliberately open, for review gate T2 — NO silent decisions):**
> **[F-λmin]** `λ_min > 0` (recency never exactly 0) — recommendation.
> **[F-Demut]** Earned history caps at ≤800; band ≥801 only via endorsement/institution.
> **[F-Local]** Impulse ledger **local** (read lens, NOT in the wire) — from 07 §9 Inv. 4; trust federation = wire v2, own slice.
> **[F-eternal]** ✅ **confirmed by the user** (AskUserQuestion decision "Institutional Floor"): `eternal` = institutional floor (instead of removing it). Operational since S2a (`proposedDemotion`); S4 builds the institutional contestation (`proposedContested`) consistently on top of it.
> **[F-contest]** ✅ **decided 2026-06-02 (model H):** Contestation lives in a **separate, append-only ledger `contestation_events`** (own axis, NEVER writes to `trust_events` → structurally never lowers trust). Folded at read time to `contested` (never `contradicted`; the winner holds), burden-of-proof threshold scales with `trustOf(Gewinner)`. The user rejected the unified single-table variant (inverts sandbox isolation fail-closed→fail-open, untypes CHECK conformance to JSON). S1a ledger discipline mirrored (typed columns, CHECK enum, append-only trigger).
>
> *O2–O6, by contrast, were explicitly decided by the user (08 resolution 2026-06-01) and are binding here.*

---

## 1. Context & problem
NSAI-Edge treats authority (`sourceTier`) as a **terminal verdict**: the top tier (`gesetz`) wins absolutely in `resolveBelief`, count-independently, **irrefutably** → **single point of epistemic failure** (if the top level lies, the system lies with it). Core axiom (user): **„Alles was reinkommt, ist erstmal widerlegbar, weil wir die Wahrheit noch nicht kennen"** (fallibilism/AGM/Popper). *Abolishing* trust was rejected (would break Sybil protection, echo neutralization, deterministic merge, domain semantics).

## 2. Glossary
| Term | Meaning |
|---|---|
| defeasible | refutable/revisable; opposite of *strict/terminal* |
| Entrenchment (AGM) | resistance of a belief against retraction = retraction priority; here: **refutation threshold** |
| Rebut vs. undercut (Pollock) | rebut = contradicts the *object*; undercut = attacks the *inference link/premise* |
| Fold | deterministic read projection: `trust = Σ` of all impulse events in total order |
| Impulse / event | adjudicated event `(target, adj_class, delta_promille, occurred_at_norm, event_hash)` |
| `trust_ext(P)` | trust of premise P from **independent roots WITHOUT** the currently failing path |
| `contested` vs `contradicted` | disputed authority (read verdict) vs. proven-false (requires a truth claim by the other side — avoid) |
| Oracle gating | only externally anchored adjudication (human/higher tier) produces a significant shift |
| Floor (institutional) | minimum entrenchment, lowerable only via **endorsement act**, not via evidence |

## 3. Decision (core)
1. **Trust = refutation threshold, not verdict.** `sourceTier` from *terminal* to *defeasible*: high authority = high threshold, never infinite.
2. **All incoming knowledge is refutable.** No `is_true` field; truth internally only *approximable* (Tarski).
3. **Three orthogonal axes** (07 §2): provenance authority (WHO) · truth value (derived, never stored) · assertion mode (fiction scoped, Slice S5).
4. **Trust dynamics = impulse ledger over the provenance DAG** (§4).

## 4. Mechanics — impulse-ledger trust (integer-hardened)
**Axiom:** Trust is **not a stored state** but a deterministic **projection (fold)** over an append-only **ledger of adjudicated impulses** along the acyclic TMS DAG.

### 4.1 Event store (append-only, LOCAL [F-Local])
Only **primary** adjudication events on the directly judged item:

| Field | Type | Value range |
|---|---|---|
| `target_id` | TEXT | triple_hash / source_id / rule_id |
| `adj_class` | TEXT | `human_endorse`·`human_reject`·`oracle_higher_tier`·`auto_corroborate` |
| `delta_promille` | INT | −1000…+1000; `= trunc(1000·(c−w)/N)` (N>0; **N=0 → event invalid, rejected**) |
| `occurred_at_norm` | TEXT | ISO-UTC-Z (total-order key 1) |
| `event_hash` | TEXT | tie-break (total-order key 2) |

Source/parent contributions are **not** stored — pure read-time projection.

### 4.2 Fold (read-only, deterministic, sequential)
`trust(node, T)` = sequential fold over all events up to `T` in **total order** `(occurred_at_norm, event_hash)`. **Recency uses the fold state at the start of the period** (before the event) — thereby deterministic despite trust-dependent λ. Contributions per event on K:
1. **Direct (K):** balance of K by `delta`.
2. **Source(K):** `Δ_source = trunc(delta · w_src / 1000)`.
3. **Parents(K)** (`derived_from`/`episode_triples`) — **only from Slice S2/S4, NOT S1** (see §8):
   - Distance decay (integer): `delta_parent = trunc(delta · γ^d)` (γ per mille, `γ^d` = d-fold truncated multiplication).
   - **Undercut attribution + dilution (O2):** ONE formula, both factors explicit:
     `blame(P) = trunc( delta_parent · (1000 − trust_ext(P)) / 1000 / n )`
     with `trust_ext(P)` = fold over P's independent roots **without the K path** (otherwise circularity; path identification via `derived_from` edges), `n` = **number of sibling premises (independent children, consistent with AC-T.7) of the node currently being decomposed** — the blame is diluted over the premises jointly supporting the conclusion (**n=0 → no parent impulse**). Only on premise-attributed failure; rule failure goes to the **rule node** (own fold).
   - **Event model (S2b delivered, Stefan decision): 5th `adj_class = derived_blame`** (CHECK migration + rebuild). `propagateRejectBlame(K, {delta<0, attribution})`: **rebut** propagates transitively up the `derived_from` chain (γ per hop, `seen` set against double blame, `maxDepth` bound), **undercut** burdens only `rule_id` (n=1). Implementation: `trust_ext(P) = trustOf(P)` — the "K path" is guaranteed via the **DAG invariant** (`infer` skips cyclic justifications) NOT to be among P's roots, hence circularity-free without explicit path subtraction. `derived_blame` folds in `trustOf` as a **dampened negative authority impulse** (β-side, NO `anchored`, NO auto cap/clamp) → provenance stays cleanly separated (derived ≠ human-direct ≠ auto). Constant `trustBlameGamma=500`.

### 4.3 Recency / decay (O4, [F-λmin]) — period model **B (epoch), binding 2026-06-01**
`λ_eff(trust) = max( λ_min , trunc(λ_base · (1000 − trust) / 1000) )`, `λ_min > 0`. High trust → slower fade (anchoring "what is true remains", #4); `λ_min>0` guarantees that **even a trust=1000 source drifts back in finite time under complete silence** (anti-sleeper, resolves the collision with 07 §6).

**Period-model decision (S1b blocker, now fixed):** **epoch counter, NOT wall clock.** A "period" = one `decay_pass()` call (existing confidence decay reused, §4.3 anchor). Every `trust_event` carries the global epoch at insert; `trustOf` computes `verstrichene Epochen = current_epoch − event_epoch` — **purely from the store, no `_now()` dependency**. Rationale: only this way does `trustOf` stay integer-exact **conformance-/replay-capable** (the Node↔PHP gate compares byte-exactly; wall clock would tear open the same K1/K2 blind spot). **Hybrid:** time-like aging arises by running `decay_pass()` on schedule (cron) — the determinism property of `trustOf` is unaffected by that. **Migration note (🟡, audit):** `migrateTrustEventsEpoch` backfills existing events to epoch 0 → they are folded in a single replay epoch (recency semantics "all equally old" for pre-S1b records). Without consequence, since the S1a substrate is fresh and hardly any old events exist; determinism/bounds remain.

**Fold algorithm (stateless read projection, single truth = milli-`(α,β)`):** `trustOf(id, asOf=current_epoch)` replays epochs `[min_event_epoch … asOf]`; per epoch in this order:
1. **`trust_start = trunc(1000·α/(α+β))`** (fold state at the start of the period — source for λ).
2. **Decay / mean reversion:** `α ← α₀ + trunc((α−α₀)·(1000−λ_eff)/1000)`, analogously `β` (excess over the prior shrinks; λ from `trust_start`).
3. **Vouch-strength decay:** separate scalar `vouch∈[0,1000]` fades with its own `λ_v=max(λ_min,trunc(λ_base·(1000−vouch)/1000))` (NOT tied to the auto-driven total trust → not circular).
4. **Fold of the epoch in TWO axes** (adversarially hardened — a blanket bypass would let a co-located `human_reject` *raise* the auto mass instead of lowering it):
   - **4a Authority axis:** direct `human_*`/`oracle_higher_tier` **free** (both directions, no clamp); a positive direct act raises `vouch ← min(1000, vouch+delta)` (∝ strength → a trivial `delta=1` barely raises). Then `tAuth` (baseline after authority).
   - **4b Count axis:** direct `auto_corroborate` (w=1000) + **all** source events (w_src, auto-dedup via `seenDedup`).
5. **Raised, decaying ceiling** (decision [F-vouch-persist], see below): `effCap = baseCap + trunc((vouchCap−baseCap)·vouch/1000)`; `capCeil = max(tAuth, effCap)` — **authority is the floor and is NEVER capped** (human/oracle may exceed the auto ceiling). `raw = trunc(1000·α/(α+β))`; if `raw>capCeil` → re-mix at constant mass onto `capCeil`. Then **per-period clamp** (rate, T.13) around `tAuth ± clamp` — **ONLY without a fresh vouch** (a fresh vouch counts the accumulated auto evidence immediately up to the raised ceiling).
6. **Mass bound of the count axis:** `setMass(massMax)` scales `(α,β)` ratio-preservingly to `≤ massMax`. Without this bound, an auto surge builds up un-normalized beta mass → mean reversion becomes sluggish (sleeper) AND future human acts drown.

**Decision [F-vouch-persist] (Stefan, 2026-06-01): "raised, decaying ceiling"** — a positive vouch raises the auto ceiling (`baseCap=600 → vouchCap=800`) proportionally to the **separate, decaying vouch strength**; the ceiling falls back to 600 with the vouch. **Structurally sleeper-free** (mass bound). Closes the 3 adversarial findings: 🔴-1 (co-located reject lowers, two axes) · 🔴-2 (a faded anchor does not raise a later surge, vouch decay) · 🔴-3 (peak drifts back, mass bound + ceiling decay) — **and** the inherited S1a sharpness (a trivial `delta=1` anchor now barely raises, since `vouch+=delta`). Simulation/test evidence: peak 800 → 756(e10) → 339(e40) → 300(e100); `delta=1`+2000 auto = 599; reject+co-located auto lowers (422<450); T.10b 50auto+endorse = 800 (>600); T.4b/T.10a/d/e + determinism preserved. **Stop precondition for S2:** `recordAdjudication` has no ingest caller yet (human/oracle is Stefan-gated); before S2/ingest wires up the path, it must be enforced that `human_*`/`oracle_higher_tier` are not remotely injectable.

Final: auto cap (`≤ trustAutoCorroborateCap` if `!anchored`), clamping to `[0,1000]`. **Within an epoch the fold is commutative** (additive `(α,β)` accumulation, per-event `trunc`) → order-independent; **across epochs** strictly epoch-ordered → fully deterministic. Reference simulation confirms: safe default 300; 1000-event surge/epoch → +150 capped; entrenched-then-silent 878→4‰/epoch (slow fade) → 669 after 25 epochs (anti-sleeper); integer/[0,1000]. **Constants** (`trustLambdaBase`,`trustLambdaMin`,`trustPerPeriodClamp`) — single source = `rules.mjs DEFAULT_SPEC`, documented in KONZEPT (concept document) §I.7-DE. **No** `LEARN_CONSTANTS` mirror (trust ledger is local, [F-Local] — PHP computes no trust). Inclusion in the `konzept-const-sync` allowlist is a **follow-up step** (then also covers the untracked S1a constants `trustPrior*`/`trustSourceWeight`/`trustAutoCorroborateCap`) → own gate-enhancement diff.

### 4.4 Oracle gating / "count never counts" (Inv. 6)
Only `human_*`/`oracle_higher_tier` produce significant shifts. `auto_corroborate` **banded**: **UNvouched** auto raises an item asymptotically **up to exactly 600‰ (upper bound 'plausible'), never into the 'solid' band (≥601)**; correlated items via a shared provenance/content hash = **one** signal. The `/n` dilution (§4.2) is the formal "count never counts" mechanism.
**S1b amendment (decision [F-vouch-persist], §4.3):** Inv. 6 applies absolutely to **unvouched** auto (≤600). A **positive human/oracle vouch** raises the auto ceiling proportionally to the **vouch STRENGTH** (`effCap = baseCap + (vouchCap−baseCap)·vouch/1000`, max. 800) — so "count never counts, **anchor strength does**". The raise is **strictly strength-driven, NOT frequency-driven** (`vouch = max(decayed, delta)`, not `+= delta`) → a cheap permanent trickle cannot accumulate the ceiling beyond its single-act strength (adversarially hardened); and it **fades with the vouch** (no sleeper). Consequence: vouched auto can temporarily enter the solid band (601–800) proportionally to active, sustained human attention — **never into 'verified' (≥801) via auto** (only the pure authority axis `tAuth` reaches that). Only takes full effect with the S2 precondition (human/oracle not remotely injectable).

### 4.5 Tags = cold-start prior (static)
Tag-composed beta prior for new sources; as soon as own adjudicated events exist, **the fold dominates the prior completely.** Tags do not oscillate.

### 4.6 Entrenchment-weighted precedence (S2a, model C — Stefan decision 2026-06-01)
`resolveBelief` so far ranked hard-lexicographically `trustRank(Peer) → tier(sourceTier) → weight`. **S2a modulates the effective authority level with the entrenchment** (`trustOf` of the triple) instead of fixing it hard — "tier-primary → entrenchment-**weighted**":
- `bandShift(triple) = clamp( trunc((trustOf(triple_hash) − prior) / STEP) , −K , +K )` (default `K=2`, `STEP=200`, `prior=300`).
- `effTierEntrenched(e) = clamp( effTier(e) + bandShift(e) , 0 , 6 )`. This value replaces `tier` in the candidate (precedence, tier grouping, tiebreak, query output). **`trustOf` (merged) + `_effTier` (quorum/conformance) remain untouched.**
- **`trustRank(Peer)` remains the primary gate** (federation/Sybil resistance): entrenchment modulates ONLY the tier axis, not the peer trust. An auto-pumped item (cap 600 → bandShift ≤ +1..+2) can NOT overtake a law (sim-proven).
- **eternal = institutional floor [F-eternal]:** for `temporality='eternal'` a NEGATIVE `bandShift` is clamped to 0 — a negative fold does **NOT lower the level** but is only reported as a **proposal** (`proposedDemotion`) in the result; execution only with human endorsement (AC-T.12). A positive shift also applies to eternal.
- **Safe-by-default / no regression:** after a wipe `trustOf`=prior(300) → `bandShift=0` → exactly today's tier behavior. Determinism remains (trustOf is deterministic). Constants `trustEntrenchmentBandK`,`trustEntrenchmentBandStep` in `rules.mjs`.
- Simulation evidence (all models compared): C is Sybil-safe + eternal-durable; defeasible above all within/between neighboring tiers + same-tier tiebreak; large tier gaps remain authority-dominated except under extreme refutation. **S2b** (parent attribution `trust_ext`/`blame`, T.7–T.9) is its own, additive follow-up slice.

### 4.7 Domain-scoped trust (S3a, O3 — Stefan decision 2026-06-01)
`trustOf(id, {domain})` projects the entrenchment onto a **topic** (source×topic): fold over events with `domain=Thema` **OR** `domain IS NULL`. **`domain` semantics:** topic tag; non-topic-specific impulses (`derived_blame`, generic adjudication) carry `domain=null` and count **globally in ALL topic scopes** (S2b's `derived_blame` corrected to `null`). **Thin-cell fallback (hard threshold):** < `trustDomainMinEvidence` topic-specific events on the node → fall back to the **global** `trustOf` (the thin cell is not reliable). **`domain=null` (default) = exactly the previous behavior → no regression.** **Scope S3a = substrate:** only the `trustOf` capability + recording-with-domain; the **topic determination in the belief path** (predicate→topic / tag) is **S3b** (deferred) — `resolveBelief` remains untouched (takes at most an optional explicit `domain`). Constant `trustDomainMinEvidence=5`. Determinism + S1b fold (recency/ceiling/mass) unaffected (only event filtering).

### 4.8 Mode axis / fiction (S5a — Stefan decision 2026-06-01: separate sandbox store)
Third orthogonal axis: **assertion mode** `asserted` vs `suspended` (fiction/hypothesis/example/quotation — commitment-suspended). **Fiction is NOT false but mode-shifted** (Searle/Frege; Tarski guardrail §B). **Storage = PHYSICALLY separate `sandbox_edges` store** (NOT a same-table filter): the fact read paths (`resolveBelief`/`query`/`verify`) read exclusively `knowledge_edges` → **never** see the sandbox (isolation by default — no filter that a path can forget; strongest Tarski guarantee "fiction never accidentally becomes fact"). **World scope** (`world`, Lewis operator "in world f, A holds") via `recallWorld(world)` — **explicit opt-in**; `includeFacts=true` temporarily performs the UnionRead sandbox(world)+fact graph. **Promotion** (`promoteFiction(world, hash)`, Stefan model): mature fiction is **deleted + written as a fresh ingestion** into `knowledge_edges` → collects its first impulses anew in the trust ledger (no flag mutation). **S5a = substrate** (`storeFiction`/`recallWorld`/`promoteFiction`); the deterministic **ingest heuristic** (llm/web + linguistic triggers → suspended+sandbox) is **S5b** (deferred). Fact path byte-exactly untouched (own table).

## 5. Fixed parameters (O1–O6 — 08 resolution 2026-06-01, binding)
| # | Decision |
|---|---|
| O1 | safe-inert; `auto_corroborate` counts banded |
| O2 | undercut B+C (independent support protects; rules = own trust nodes) |
| O3 | projection (source×topic), global fallback prior for a thin cell |
| O4 | k≈10/Beta(3,7)→300‰; 5 bands 0–200/201–400/401–600/601–800/801–1000; γ≈500‰; w_src≈300–500‰; calib./surprise ×1.5–2; λ see §4.3; per-period delta clamp default ±150‰/period (constants gate) |
| O5 | UNvouched auto_corroborate cap exactly 600‰; hash dedup. **S1b:** vouch raises the ceiling strength-proportionally up to 800 (decaying, §4.4 amendment) |
| O6 | Floor: `statute/law`,`official-gazette/authority`,`academic-peer-reviewed`. Empirical: `press/news`,`blog/web`,`llm-extraction`,`sensor/telemetry` |

## 6. Defeater triggers & contestation [F-contest]
| Situation | Behavior | Mechanism |
|---|---|---|
| Foreign, no counter-knowledge | accept | low entrenchment, no reject |
| Two equally foreign ones contradict each other | look for a credible source | `contested` + escalation one tier level up |
| Known X, foreign ¬X | burden of proof → the foreign one | trusted holds; contradiction **not discarded**, persistent open contestation, **accumulates** |

Contestation flips the top tier to **`contested`** (read verdict), **never `contradicted`**. Defeater types separated (O6): empirical = evidence defeater (auto); institutional = act defeater (endorsement-required, [F-eternal]).

**Model H (S4 delivered 2026-06-02):** separate append-only ledger `contestation_events` (typed: `contest_type ∈ {empirical, institutional}` CHECK, `weight_promille` 0–1000 CHECK, append-only trigger). `contest(target_id, {contester_id, contest_type, weight, reason, dedup_hash})` **always appends a distinct row** (monotone seq, NEVER `INSERT OR IGNORE`) → no row can ever be displaced → **suppression structurally impossible** (audit R4 🔴-2). **`contestationOf(id,{type,asOf})` = strength-per-origin with TRUST-PEER GATE (Stefan decision, audit R1–R4): ONLY contestations of registered, TRUSTED peers count (`_originTrust ≠ untrusted`; self=full) — per peer only its STRONGEST contestation (MAX), not frequency/sum** (exactly the `trustOf` vouch discipline "anchor strength, not count"). **Anonymous/untrusted origin contributes 0** (the row remains as an audit trail). Thus identity is bound to the authenticated peer registry, NOT to a freely choosable string → no string trick (Unicode zero-width/pseudonym/whitespace) produces an origin (closes R1–R4 at the root instead of via fragile normalization). Forging many trusted identities requires `peerAdd`+`peerTrust` (gated acts = trust boundary). Distinct trusted contesters accumulate without bound (defeasibility remains). `peerRevoke` lowers retroactively (read lens). **Fully weighted peer-trust aggregation (instead of binary trusted/untrusted) = S4c, deferred.** `resolveBelief` enriches at read time (`_augmentContestation`): `contested = accEff ≥ thr` with **`thr = trustContestBase(300) + trunc(trustOf·trustContestSlope(1000)/1000)`** (burden of proof scales with anchoring); winner unchanged; above threshold → `contestation.escalation.neededTier = effTier+1`. **eternal floor:** against `eternal` only **empirical** load counts automatically; **institutional** load above threshold is only reported as `contestation.proposedContested` (endorsement-required, AC-T.12 parity). **Trust invariant structural:** the ledger physically cannot write `trust_events` → a contestation never lowers trust. **Safe-by-default:** without contestation events `resolveBelief` remains byte-identical (no `contestation` field). **Deferred S4b:** auto-detection of §6 row 2 (two equally foreign → contested) in the belief path without an explicit `contest` act; as-of historical contestation (epoch lens).

## 7. Acceptance criteria
| AC | Criterion | Slice |
|---|---|---|
| AC-T.1 | Fold deterministic + totally ordered → same event set ⇒ identical trust (two runs/nodes) | S1 |
| AC-T.2 | Integer per mille throughout, no float; constants-consistency-gate-capable | S1 |
| AC-T.3 | Direct+source contribution: `Δ_source = trunc(delta·w_src/1000)`, exactly recomputable | S1 |
| AC-T.4 | Safe-by-default: without events == prior (no drift) | S1 |
| AC-T.5 | Degeneration: `N=0` event rejected (`INVALID_PARAMETER_FORMAT`); `adj_class` outside the 4 enums rejected (`INVALID_PARAMETER_FORMAT`); `n=0` → no parent impulse (no division by 0) | S1/S2 |
| AC-T.6 | append-only: no UPDATE/DELETE on events; fold is a pure read projection (no wire, no vector_clock) | S1 |
| AC-T.7 | Distance decay capped: a leaf reject lowers a broadly (n independent children) supported parent by at most `trunc(delta·γ^d·(1000−trust_ext)/1000/n)` | S2 |
| AC-T.8 | Undercut vs. rebut: a child reject attributable to the rule leaves the parent premise untouched; the rule node sinks | S2 |
| AC-T.9 | `trust_ext(P)` excludes the K path (circularity-free) — P supported ONLY via K takes the full hit; P supported otherwise is spared | S2 |
| AC-T.10 | Oracle gating: `auto_corroborate` alone never raises above 600‰; correlated origin = one signal | S1 |
| AC-T.11 | `λ_eff=max(λ_min,…)`: a trust=1000 source without new events drifts back measurably in finite time (anti-sleeper) | S1 |
| AC-T.12 | Institutional floor: a negative fold only PROPOSES a tier demotion; without endorsement no execution | S2 |
| AC-T.13 | Dampener: an ingestion surge (N events/period) moves the score by at most the per-period clamp (default ±150‰/period, constants gate) | S1 |
| AC-T.14 | 🔴 slice (S2/S4) is not mergeable without an adversarial-auditor run documented in the PR (verdict line) | S2/S4 |
| AC-T.15 | Contestation structurally trust-neutral: `contest()` produces NO `trust_events` event; `trustOf(target)` byte-identical before/after (own ledger) | S4 |
| AC-T.16 | Winner holds: a contestation above threshold sets `contested=true`, NEVER changes `winner` (never `contradicted`) | S4 |
| AC-T.17 | Burden of proof scales: `thr=trustContestBase+trunc(trustOf·trustContestSlope/1000)`; higher anchoring ⇒ higher threshold ⇒ the same load does not flip it | S4 |
| AC-T.18 | eternal floor: institutional load above threshold ⇒ only `proposedContested` (endorsement-required); empirical load counts automatically | S4 |
| AC-T.19 | append-only enforced (UPDATE/DELETE trigger); `dedup_hash` collapses identical contestation; safe-by-default (without events `resolveBelief` byte-identical) | S4 |
| AC-T.20 | Trust-peer gate + strength-per-origin: only registered trusted peers (`_originTrust≠untrusted`) count, each only with its STRONGEST contestation (MAX). Anonymous/untrusted/arbitrary string variants (Unicode/whitespace/pseudonym) contribute 0 → no frequency/identity inflation; distinct trusted contesters accumulate | S4 |
| AC-T.21 | Suppression-free structurally: storage always distinct (no `INSERT OR IGNORE`) → no row displaceable; `weight=0` never displaces a strong contestation (MAX fold) | S4 |
| AC-T.22 | `peerRevoke`/`peerTrust` withdrawal lowers the contestation standing retroactively (read-time trust projection, no stored verdict) | S4 |

## 8. Implementation slicing (CDP5 — narrow, additive first)
| Slice | Content | AC | Risk | Breaks existing? |
|---|---|---|---|---|
| **S1a Substrate** (✅ delivered + 4th audit safe YES) | Event store (local, append-only trigger-hardened) + fold projector **direct+source+band+hash dedup** (integer per mille, totally ordered, safe-by-default). **Class-separated event_hash:** `auto_corroborate` content-deterministic + `INSERT OR IGNORE` (idempotent dedup intended); `human/oracle` with monotone seq + plain `INSERT` (distinct acts NEVER collapse — audit-3 data loss closed). **NO recency/dampener** (→ S1b), **NO parent attribution/`trust_ext`** (→ S2). `resolveBelief` untouched. Cap-uncap ONLY via a positive external anchor DIRECTLY on the node (item-related). | T.1–T.6,T.10 | 🟢 | no (additive) |
| **S1b Recency/Dampener** | `λ_eff` recency/mean reversion + per-period delta clamp. **Period model decided 2026-06-01: B (epoch counter) + cron hybrid** (§4.3) — epoch stamp per event, `trustOf` wall-clock-free/conformance-capable. Algorithm + reference simulation in §4.3. **[F-tiebreak]** (S3a audit clarified): with the same `dedup_hash` + **diverging** delta (= **violation** of the §4.4 "one signal" contract "same content hash ⇒ same delta"), the `seenDedup` winner depends on the total-order tiebreak; since the auto `event_hash` contains the `ts`, the result for near-simultaneous events is **wall-clock-dependent and flips** (e.g. 481↔448) — NOT merely "low-consequence". **Reachable only on contract breach** (contract-conforming data is fully deterministic, S3a audit 15× stable); **pre-existing (S1a/S1b), not introduced/widened by S2/S3.** **Fix (deferred, own S1 hardening slice):** choose the dedup winner content-deterministically (e.g. "strongest \|delta\| wins") OR make the auto `event_hash` ts-free — then deterministic even under contract breach. | T.11,T.13 | 🟡 | no (additive) |
| **S2a Entrenchment precedence** (✅ delivered, audit safe YES) | Model C (§4.6): `resolveBelief` modulates the effective tier level with `trustOf` (bandShift ±K, K=2); `eternal`=floor (negative shift→`proposedDemotion`, no execution without endorsement, AC-T.12); peer trust remains the primary gate; safe-by-default (prior→shift 0, no regression). | T.12 | 🔴 | no (additive, prior-neutral) |
| **S2b Parent attribution** (✅ delivered) | `propagateRejectBlame` over `derived_from` (rebut: transitively γ^d/n/trust_ext-dampened; undercut: rule node) → `derived_blame` events (5th adj_class). Circularity-free via DAG invariant. Additive on S2a (`trustOf` folds derived_blame as a neg. authority impulse). | T.7–T.9 | 🔴 | no (additive) |
| **S3a Domain** (✅ delivered) | `trustOf(id,{domain})`: (source×topic) projection (domain=topic ∨ null) + hard-threshold fallback to global for a thin cell; domain=null=global/no regression. Substrate (resolveBelief untouched). **S3b** (topic determination in the belief path) deferred. | — | 🟢 | no (additive) |
| **S4 Defeater/Contestation** (✅ delivered 2026-06-02, model H; 5 audit rounds) | separate append-only `contestation_events` ledger (structurally never lowers trust); `contest`/`contestationOf` (**trust-peer-gated strength-per-origin fold: only trusted peers, per-peer MAX; anonymous/untrusted=0; always-distinct insert → inflation- + suppression-proof at the identity root, audit R1–R4**); `resolveBelief` read-time `contested` verdict with anchoring-scaled threshold (`_augmentContestation`); winner holds (never `contradicted`); eternal floor → `proposedContested`; escalation +1 tier; safe-by-default. **S4b** (auto §6 row 2, as-of contestation), **S4c** (fully weighted peer-trust aggregation instead of binary) deferred. | T.15–T.22 | 🔴 | no (additive, safe-by-default) |
| **S5a Mode axis/Fiction** (✅ delivered) | Separate `sandbox_edges` store (isolation by default); `storeFiction`/`recallWorld` (world opt-in)/`promoteFiction` (delete+fresh ingestion). Fact paths read only knowledge_edges → fiction invisible. **S5b** (ingest heuristic) deferred. | — | 🟢 | no (additive) |

**Scope clarification (reviewer 🟡-4):** The parent propagation (§4.2 contribution 3) + `trust_ext` belong to **S2/S4, not S1**. S1 is a pure substrate fold (direct+source), thus immediately + safely buildable without circularity risk.
**Stop boundary:** **S2 is NOT carried through autonomously** — needs its own migration/wire decision for the 12k existing edges + renewed Stefan confirmation. **This run delivers S1.**

## 9. Threat model of the impulse path
| Threat | Countermeasure |
|---|---|
| Fabricated child adjudications push down parent/source | parent impulse only premise-attributed + `/n`-diluted; `trust_ext` without the fabricated path (§4.2) — **S2** |
| Sybil/echo via auto_corroborate | band cap 600 + hash dedup = one signal (§4.4) — **S1** |
| Trust farming via dispute fabrication | oracle gating; gain from evidence, not volume |
| Floor erosion of institutional sources | hard floor (O6), lowering only via endorsement act |
| Jump trust via ingestion surge | per-period delta clamp (O4) + mean reversion |
| Silent compromise of high trust (λ→0) | `λ_min>0` [F-λmin] + calibration×2/surprise on an adjudicated lie |

Adversarial-auditor obligation per 🔴 slice (S2/S4).

## 10. Residual-risk guardrail (Tarski)
**A consistent, uncontradicted lie by a trusted source is undetectable without an oracle.** Achievable: **no lie survives that available independent evidence contradicts.** Trust *drifts with adjudicated evidence*, it is **not a truth sensor**. → into KONZEPT §B as "what the system does NOT deliver" (Slice T3).

## 11. Invariants check
| Invariant | Status |
|---|---|
| (1) Zero-dep | ✅ integer/beta/decay/fold in JS |
| (2) Offline | ✅ |
| (3) Determinism | ✅ integer per mille, fixed-point milli counts, total order — no float (AC-T.1/T.2) |
| (4) CRDT | ✅ **trivial** — ledger local (read lens, no wire federation in S1–S5); convergence only relevant with wire v2 (out of scope) [F-Local] |
| (5) Read lenses | ✅ trust/tendency/`contested` projected locally; signed wire fields untouched |
| (6) Count never counts | ✅ in **S1** via auto_corroborate band + hash dedup (§4.4); **S1b amendment:** unvouched auto ≤600 absolute, vouch raises **strength**- (not frequency-)proportionally up to 800, decaying; from **S2** additionally `/n` dilution (§4.2) |
| (7) Open world | ✅ `unknown`≠false; fiction scoped (S5); contestation→`contested`, never `contradicted` |
| (8) Never guess | ✅ updates oracle-gated; learning drift = constraint #4 (institutional tier change endorsement-required) |

## 12. Roadmap connection
Substrate for **C1** (EigenTrust), **C3** (MeritRank — independence/`n` + distance decay), **D1** (conformal — thresholds/calibration), **E1** (meta-cognition — Brier/ECE), **A1** (defeasible argumentation), **6.1** (trust adjustment as fold contribution). §I roadmap entry in Slice T3.
