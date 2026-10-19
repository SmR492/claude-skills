# Collective Animal Intelligence & Swarm Decision-Making

> **Exploration raw material** (batch 2026-05-29), web-sourced. **No CDP5 binding.** Invariant violations flagged, not filtered. Purpose: raw material for the Konzept (concept document).
>
> **Invariant legend:** (1) zero-dep · (2) offline · (3) determinism · (4) CRDT convergence · (5) local read lenses · (6) "count never counts" · (7) open-world · (8) "never guess".

**Cross-cutting observation up front:** NSAI-Edge today is almost everywhere a **stateless, comparison-based, value-INsensitive** system (max selection, static thresholds, snapshot belief resolution). Biology solves the same problems almost everywhere **value-sensitively and via persistent, decaying accumulators.** That is the red thread below.

---

### [Cross-inhibition / stop-signal belief resolution]
- **Principle (nature):** Honeybee scouts advertise nest sites via waggle dance and at the same time send *inhibitory stop signals* (headbutt + buzz) specifically to advertisers of **competing** options. Better sites → more dances → more inhibition against all others. Demonstrably resolves the deadlock between two equally good sites that pure positive feedback cannot resolve (Seeley/Visscher/Marshall, *Science* 2011).
- **Mechanism:** Dynamical system with two "committed" populations y₁, y₂ and uncommitted x. Recruitment ∝ quality, plus cross term −σ·y_i·y_j. At high σ: **pitchfork bifurcation** → deterministic tipping into winner-take-all, *even* at y₁≈y₂. Crucially (Pais/Marshall 2013): depends on **difference AND mean** of the values — value-sensitive, not just accuracy-sensitive.
- **NSAI-Edge transfer (REPLACES/complements belief resolution):** Today a contested flag when the runner-up ≥ threshold — a purely *comparative* snapshot lens. Cross-inhibition makes it value-sensitive: each competing object accumulates an integer score (source_type·recency·conf·trust), and the score is **actively dampened in proportion to the score of its rivals** (`score_i -= floor(σ·score_i·score_j/SCALE)` over top-tier pairs). Hardens the contested threshold: with two strong opposing sources there is *no* lazy middle ground — a clear winner tips through OR cleanly contested. The mean term yields a *free confidence signal*: both weak → deliberately undecided (anti-"never guess").
- **Trade-offs:** Instead of pairwise inhibition: global normalization (softmax-like) — but violates "count never counts" less cleanly. Cross-inhibition stays max-like (no summing over sources). σ is a new tuning parameter (too small → deadlock, too large → premature).
- **Invariant check:** ✅ determinism (integer iteration, fixed σ); ✅ "count never counts" (inhibition scales with score, not count); ⚠️ CRDT: read-only over signed wire values, never write back.
- **Sources:** [Stop Signals Provide Cross Inhibition (Science 2011)](https://www.science.org/doi/10.1126/science.1210361) · [Value-Sensitive Decision-Making (PLoS ONE 2013)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0073216)

---

### [Stigmergic retrieval — paths strengthen through use]
- **Principle:** Ants coordinate via the *persistent environment*: pheromone attracts; frequently walked paths accumulate more, unused ones evaporate. The shortest path is *emergent* (Dorigo, ACO).
- **Mechanism:** Edge choice P ∝ τ^α·η^β. After each solution: evaporation τ←(1−ρ)·τ, then deposit Δτ ∝ 1/path length on used edges. ρ prevents convergence on suboptima.
- **NSAI-Edge transfer (COMPLEMENTS retrieval routing):** PPR today is *structural* (topology + belief). Add a **usage pheromone layer** per edge: deposit integer pheromone on every retrieval path *used* in a successful answer; evaporate periodically (`τ←τ−floor(τ/HL)`). PPR uses τ as an additional weight. Frequently valuable paths are found faster, "dead" knowledge sinks in the ranking without being deleted (open-world remains). Externalized usage memory; decay-as-evaporation is mathematically identical to the existing conf decay.
- **Trade-offs:** Pheromone feedback is an *echo chamber* source (often walked ≠ true) — separate strictly from belief (pheromone ranks order, NEVER changes confidence).
- **Invariant check:** ✅ determinism; ✅ offline/zero-dep (one integer column per edge); ⚠️ "count never counts": pheromone *counts* uses — permissible only because it steers retrieval *order*, never belief *truth*. This separation is the whole battle.
- **Sources:** [Ant Colony Optimization (Dorigo & Stützle)](https://web2.qatar.cmu.edu/~gdicaro/15382/additional/aco-book.pdf)

---

### [Physarum topology pruning — edges that carry no knowledge die]
- **Principle:** The slime mold *Physarum* forms a tube network that adapts to protoplasm flow: tubes with flow thicken, unused ones wither. Tokyo rail experiment: network with almost identical efficiency/fault tolerance to the actually planned rail network — only a local flow rule (Tero et al., *Science* 2010).
- **Mechanism:** Q_ij = D_ij·(p_i−p_j)/L_ij; adaptation dD/dt = f(|Q|) − r·D (sigmoid reinforcement + linear decay). Tubes with D→0 get pruned.
- **NSAI-Edge transfer (NEW: graph maintenance/compaction):** periodic deterministic **topology compactor**. "Flow" = frequency with which an edge carries current in belief-weighted retrieval paths. Edges below threshold are *not deleted* (open-world!) but moved to "cold storage" (out of the hot PageRank index, reactivatable on demand). Keeps the retrieval graph small/fast without knowledge loss — biologically optimized index tiering for nodes with millions of triples.
- **Trade-offs:** Pure conf-decay pruning also discards structurally important bridge edges (Physarum keeps those for fault tolerance). Needs flow telemetry (synergistic with the pheromone layer).
- **Invariant check:** ✅ determinism (integer dD/dt); ✅ open-world (cold storage instead of delete); ⚠️ CRDT: pruning is a *local* index decision — nodes may have different hot/cold splits as long as the signed stock converges identically.
- **Sources:** [Rules for Biologically Inspired Adaptive Network Design (Science 2010)](https://www.science.org/doi/10.1126/science.1177894)

---

### [Quorum response curve instead of a fixed contested threshold]
- **Principle:** Fish/bird schools follow a *quorum response*: the probability of adoption is a steep **nonlinear** function of the number of neighbors showing a behavior. Amplifies correct majorities, filters noise (Sumpter/Krause/Couzin, *PNAS* 2008). "Many wrongs principle": many noisy estimates average out well — but only via the nonlinear curve.
- **Mechanism:** P(n) = n^k/(T^k + n^k) (Hill function). Below T almost no reaction (noise suppression), just above a steep rise (decision locks in). Higher safety requirement → higher T.
- **NSAI-Edge transfer (REPLACES quorum threshold):** Instead of a *hard* threshold (n sources → confirmed) an **integer Hill response** over the *aggregated evidence strength* (not source count!): the confidence with which a contested fact counts as "resolved" rises sigmoidally with winner score/runner-up score. Close races stay uncertain (flat region), clear ones lock in hard.
- **Invariant check:** ✅ determinism (integer lookup table); ✅ "count never counts" *provided* n is the evidence strength, not the source count — otherwise ❌. This substitution is the crux.
- **Sources:** [Quorum decision-making facilitates information transfer (PNAS)](https://www.pnas.org/doi/10.1073/pnas.0710344105)

---

### [Firefly synchronization as a vector-clock complement]
- **Principle:** Fireflies synchronize without a central clock: each oscillator fires at threshold, each observed flash pulls the neighbors' phase along. Mirollo & Strogatz (1990): arbitrarily many pulse-coupled oscillators are guaranteed to synchronize.
- **Mechanism:** Phase φ rises to 1, then fire+reset. Received pulse: φ ← min(1, φ+ε). Convexity of the response curve guarantees convergence.
- **NSAI-Edge transfer (COMPLEMENTS vector clock):** Vector clocks grow with the peer count. A firefly-like **sync heartbeat** establishes coarse "federation epochs": nodes periodically broadcast an epoch pulse, on receipt they pull their epoch counter along (max rule — CRDT-compatible!). Gives a *deterministic, monotonically growing, coordinator-free* shared decay anchor → reduces re-assertion storms. Does NOT replace the vector clock for causality, but for *decay phase alignment*.
- **Invariant check:** ⚠️ determinism (phase pull depends on receive order → CRDT-safe only via max rule); ✅ offline; ✅ CRDT (epoch = max-merge G-counter).
- **Sources:** [Synchronization of Pulse-Coupled Biological Oscillators (Mirollo & Strogatz, SIAM 1990)](https://www.clear.rice.edu/comp551/papers/MirolloStrogatz-TemporalSynchronization-SIAM1990.pdf)

---

### [CRISPR immune memory — signature-based peer defense]
- **Principle:** Bacteria store short DNA fragments ("spacers") of hostile invaders in a CRISPR array as heritable immune memory; on re-encounter the signature is recognized and the foreign DNA destroyed.
- **Mechanism:** Adaptation (spacer acquisition) → expression (crRNA guides) → interference (sequence match → cut). Memory persists (priming).
- **NSAI-Edge transfer (NEW: adversarial peer immune memory):** Today TOFU fingerprints + quarantine, but no *positive memory of harmful patterns*. **Spacer store**: when a foreign fact is discarded/quarantined as harmful (signature error, replay, refuted content, Sybil suspicion), store a deterministic **signature** (hash over (peer_pubkey, S–P pattern, anomaly type)). Incoming triples are matched against the store → immediate interference (reject) without a renewed expensive check. Federatedly shareable: nodes push spacers → collective immunity against a Sybil swarm (in the spirit of "count never counts": one attack pattern is enough to vaccinate). **See doc 03 for censorship/poisoning risk.**
- **Invariant check:** ✅ determinism (hash match); ✅ offline; ⚠️ open-world: spacers may only block *verifiably* harmful patterns (signature/replay errors), never substantive disagreement — otherwise ❌.
- **Sources:** [Molecular memory of prior infections activates CRISPR/Cas (Nature Comms)](https://www.nature.com/articles/ncomms1937)

---

### [Restriction-modification — "self" methylation as a foreign-DNA filter]
- **Principle:** >80% of bacteria carry restriction-modification systems: a methyltransferase marks *own* DNA ("self"), an endonuclease cuts everything unmarked ("non-self"). Innate, threshold-free foreign filter (complementary to the *adaptive* CRISPR).
- **NSAI-Edge transfer (COMPLEMENTS quarantine entry filter):** Own/fully trusted facts already carry Ed25519 signatures = the "methyl tag". RM suggests a **threshold-free innate entry filter** *before* the expensive belief resolution: route foreign triples by tag status (signature × peer trust tier) into "self/full → direct" vs. "non-self → quarantine pipeline". Two-stage immunity: RM (innate, cheap, tag) + CRISPR spacers (adaptive, learned). NSAI-Edge lacks the second and has the first only implicitly — separate cleanly as two layers.
- **Invariant check:** ✅ determinism (signature check); ✅ trust = local lens; ✅ offline.
- **Sources:** [R-M systems modulate HGT susceptibility (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11736437/)

---

### [Bacterial quorum sensing — action only above federation density]
- **Principle:** Bacteria secrete autoinducers whose concentration rises with cell density; above a threshold concentration gene expression tips collectively. Action pays off only when "enough" join in (Bassler).
- **NSAI-Edge transfer (NEW: federation density gating):** A fact is *promoted* from "provisional/quarantined" to "fully integrated" only when the cumulative, **decay-weighted evidence density** (not source count!) exceeds an autoinducer-like threshold. Subtler than simple quorum: the signal *decays* (decay = autoinducer degradation), so that only *temporally concentrated* corroboration reaches the threshold — old scattered hints do not add up. Resistant to slow Sybil drip attacks.
- **Invariant check:** ⚠️ "count never counts": borderline — requires per-source max cap, otherwise ❌; ✅ determinism (integer accumulator with decay); ✅ offline.
- **Sources:** [Quorum Sensing in Bacteria (Annual Reviews)](https://www.annualreviews.org/content/journals/10.1146/annurev.micro.55.1.165)

---

### [Tandem running — verified teacher-pupil knowledge transfer]
- **Principle:** *Temnothorax* ants teach routes via tandem running with **bidirectional feedback**: the teacher slows down when the pupil lags, the pupil speeds up. The teacher pays time (4× slower), the pupil learns in a verified way and becomes a teacher itself. First demonstrated act of teaching in non-humans (Franks & Richardson, *Nature* 2006).
- **NSAI-Edge transfer (REPLACES naive bulk pull/push):** Federation sync is git-like (bulk pull/push + CRDT merge). Tandem running suggests an **acknowledged, rate-adaptive sync protocol**: the "teacher" pushes triples in tranches and throttles until the "pupil" has *confirmed verification* (signatures checked, spacer filter passed, integrated). On verification backlog the teacher throttles automatically. No quarantine overflow, backpressure built in, the pupil becomes a teacher itself (transitive spread with provenance chain).
- **Invariant check:** ✅ CRDT (merge stays max, order irrelevant — tandem only controls *rate*); ✅ determinism; ✅ offline (asynchronous acknowledgments).
- **Sources:** [Teaching in tandem-running ants (Nature 2006)](https://www.nature.com/articles/439153a)

---

### [Corvid cache protection — adversarial "observed" model without theory of mind]
- **Principle:** Scrub jays cache food; *when observed*, they later re-cache. A computer model reproduces this **without theory of mind** — solely from ONE rule ("cache far away from conspecifics") + stress-induced memory errors (van der Vaart et al., *PLoS ONE* 2012). Protective effect as a by-product of simple heuristics.
- **NSAI-Edge transfer (NEW: provenance-sensitive re-hosting / cheap Sybil protection):** (1) *Warning:* no expensive "peer intention model" is needed — simple local rules deliver the same protection more cheaply. (2) *Feature:* an **"observed-while-asserting" flag** — if a triple first became known via a low-trust/public path, mark it as "exposed" and prioritize independent re-corroboration before it gets belief weight (protection against cache poisoning: the attacker knows what you have seen). Costs only a flag + a local rule.
- **Invariant check:** ✅ determinism (local flag rule); ✅ "never guess" (re-corroboration instead of assumption); ✅ offline.
- **Sources:** [Corvid Re-Caching without 'Theory of Mind' (PLoS ONE 2012)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0032904)

---

### [Uninformed majority dampens fanatical minority (Couzin)]
- **Principle:** Couzin et al.: adding *uninformed* individuals **strengthens the democratic majority** and prevents a small, strongly opinionated minority from hijacking the group. Uninformed = inertia/dilution buffer against fanaticism.
- **NSAI-Edge transfer (COMPLEMENTS anti-echo-chamber/belief) — COUNTERPOINT:** NSAI-Edge's max rule makes it *immune to echo chambers*, but potentially *vulnerable to a single very loud (high-conf, high-trust) fanatic* who outvotes any broad weaker consensus. Couzin suggests an optional **"uninformed-ballast" lens**: low-confidence, widely scattered corroborating signals may — purely as a *tie-breaker* in contested cases — form a counterweight to a single extreme value, *without* becoming a sum.
- **Invariant check:** ❌/⚠️ "count never counts": direct conflict — only tolerable if deterministically capped + restricted to contested tie-breaks. **Deliberately documented as a tension, not as a recommendation.**
- **Sources:** [Uninformed individuals promote democratic consensus (Couzin et al.)](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003762) · [How Is Flocking Like Computing? (Quanta)](https://www.quantamagazine.org/how-is-flocking-like-computing-20240328/)

---

## Top 3 wildest ideas

1. **CRISPR spacer store as a federatedly shareable attack-pattern immune memory.** Nodes vaccinate each other against Sybil/replay/poisoning patterns — collective immunity in which *one* detected attack protects the swarm. "Count never counts", applied to defense instead of truth.
2. **Cross-inhibition makes belief resolution value-sensitive.** Away from static max comparison, toward a dynamic accumulator with active rival damping + pitchfork bifurcation. Delivers winner-take-all *and* deadlock-free, value-sensitive contested detection — proven optimal (Pais/Marshall).
3. **Firefly sync as a coordinator-free decay-epoch clock.** Pulse-coupled oscillators replace per-peer time bookkeeping with an emergent, offline-capable, CRDT-max-compatible shared decay anchor.

## Which animal solves an NSAI-Edge problem more elegantly than the current design?

**The honeybee — for belief/quorum resolution.** NSAI-Edge's contested logic is *comparison-based and value-INsensitive*: it asks "is the second close enough to the first?", but never "are both even good enough to decide?". **Cross-inhibition** solves both in one mechanism: deadlock-free with equally good options *and* sensitive to absolute quality (difference AND mean), proven optimal, fully integer/deterministic and max-compatible — without violating "count never counts".

**Runner-up: the slime mold — for graph/retrieval topology.** PPR optimizes the ranking *on* a static graph; Physarum optimizes *the graph itself* via flow reinforcement + decay pruning and deliberately retains fault-tolerant redundancy — adaptive topology maintenance that NSAI-Edge lacks.

> *Agent's note on the source situation:* Three load-bearing primary sources (cross-inhibition Science 2011, value-sensitive PLoS ONE 2013, Physarum Science 2010) were partly paywalled (403); mechanisms reconstructed from open secondary accounts + PubMed abstracts. For an implementation spec, verify the original equations directly (Pais 2013 §Model; Tero 2010 dD/dt = f(|Q|)−rD).
