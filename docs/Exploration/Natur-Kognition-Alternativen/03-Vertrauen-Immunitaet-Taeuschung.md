# Biological Trust, Defense & Deception Systems

> **Exploration raw material** (batch 2026-05-29), web-sourced. **No CDP5 binding.** Invariant violations flagged. Angle: self/non-self discrimination, reputation, cheater detection, adversarial deception → provenance/peer trust/quarantine/Sybil defense.
>
> **Invariant legend:** (1) zero-dep · (2) offline · (3) determinism · (4) CRDT · (5) local read lenses · (6) "count never counts" · (7) open-world · (8) "never guess".

---

### [1] Danger-theory quarantine — quarantine on DAMAGE, not on foreignness
**Principle.** Matzinger's danger theory (1994) breaks with the self/non-self dogma: the immune system does not react to "foreign" but to DANGER — to alarm signals (DAMPs) from damaged/stressed tissue. Harmless foreign matter (food, fetus, commensals) is tolerated; dangerous self (tumor) is attacked. The trigger is damage, not origin.
**Mechanism.** Dendritic cell algorithm (Greensmith/Aickelin): three signal classes — **PAMP** (certainly anomalous), **danger** (probability rises with value), **safe** (certainly normal) — integrated with weights; only correlation with an antigen triggers the alarm. Low false-positive rates.
**NSAI-Edge transfer (complements quarantine).** Today *foreign/uncertain* knowledge lands wholesale in quarantine (pure self/non-self logic, high over-quarantine risk). Add a **danger score** instead of binary "foreign→quarantine": quarantine/downgrade only on a deterministic *damage signal* — (a) contradiction with authoritative stock, (b) constraint violation (type/cardinality breach), (c) signature/provenance defect, (d) tier-floor violation. Foreign-but-harmless (new origin, consistent) → lighter quarantine / limited entry. Three signal classes analogous to DCA: PAMP=signature breach, danger=graph inconsistency, safe=constraint consistency + known origin.
**Invariant check.** ✅ determinism (graph constraints, signatures, no LLM); ⚠️ "never guess": the danger score may only *additionally quarantine*, never auto-promote; ✅ open-world ("no danger signal" ≠ "true", only "no reason to reject").
**Sources.** [The danger theory: 20 years later (Front Immunol)](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2012.00287/full) · [The danger theory revisited (Nat Rev Immunol 2024)](https://www.nature.com/articles/s41577-024-01102-9) · [Dendritic Cell Algorithm](https://arxiv.org/pdf/1006.5008)

---

### [2] Negative-selection detectors — learn "self", alarm on everything else
**Principle.** In the thymus, T cells that bind self are eliminated (negative selection). What remains are detectors that *by definition* only recognize non-self. The system does not learn "all enemies" but "everything that is own".
**Mechanism.** Negative selection algorithm (Forrest): (1) self set from normal patterns; (2) generate random detectors; (3) discard every one that matches self; (4) the rest monitor — match = anomaly.
**NSAI-Edge transfer (new: self profile + anomaly detector).** The node deterministically constructs a **"self profile"** from its authoritative/full stock: typical predicate vocabularies, origin distribution, tier patterns, schemata. Incoming foreign facts are matched against it: fits structurally → low anomaly; deviates strongly (unknown predicate, atypical tier/origin combination) → high anomaly → stricter quarantine. The *deterministic* answer to "own reliable vs. foreign risky knowledge" without external training data. (Instead of random detector sampling: direct distance score against a compact self profile.)
**Invariant check.** ✅ zero-dep/offline/determinism (local aggregation); ⚠️ the self profile is explicitly *local* — never write the anomaly assessment back into the replicated value.
**Sources.** [AIS for Self-Nonself Discrimination (Springer)](https://link.springer.com/chapter/10.1007/978-3-540-78297-1_11) · [Negative selection in anomaly detection — survey](https://www.sciencedirect.com/science/article/abs/pii/S1574013723000242)

---

### [3] CRISPR spacer blocklist — signature-based memory of recognized malicious origins/patterns
**Principle.** On phage attack, bacteria store a "spacer" (DNA snippet) in the CRISPR array — searchable, heritable memory; on re-contact it guides Cas nucleases to the match.
**NSAI-Edge transfer (new: spacer array / defector signatures).** When a fact from *legitimate* quarantine is **reject**ed as malicious, extract a deterministic **signature** — not the fact, but a "spacer": hash over (origin pubkey + predicate schema + violation class). Incoming facts first against the array → exact match = immediate block (fast secondary response, #4) without renewed full check. Heritability = spacer arrays are themselves signed, p2p-propagating facts.
**Trade-offs / sharp edge.** Shared blocklists are a poisoning vector (malicious peer pushes spacers against legitimate origins → censorship). Countermeasure analogous to model B: a *foreign* spacer never blocks hard, it only raises the danger score (#1); only *locally self-generated* spacers block authoritatively. Alternative: only *pattern* spacers (schema-violation fingerprints), origin-neutral.
**Invariant check.** ✅ determinism/zero-dep (hash match); ⚠️ trust laundering: shared spacers must not undermine "trust at the origin"; ❌ potentially against "count never counts" if "many peers have blocked" counts as a reason — forbid explicitly.
**Sources.** [Generation of memory by CRISPR-Cas (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4104294/)

---

### [4] Immunological memory — fast secondary response to recurring foreign facts
**Principle.** First contact → slow primary response; then long-lived memory cells; second contact → fast, strong secondary response. The latency asymmetry is the core.
**NSAI-Edge transfer (complements quarantine pipeline).** The expensive first check of a foreign fact (web-of-trust verify, constraint check, danger scoring) is cached as a **memory entry**: (origin, predicate schema) → decision + justification. Recurring structurally identical facts from the same origin → **fast path** without full check. Positive cache (familiar origin → faster full entry) + negative cache (#3 spacers).
**Trade-offs.** Risk: a cached positive entry becomes a weak spot if an origin "flips" after earning trust (sleeper). Countermeasure: cache TTL + re-validation on tier escalation; every *new* tier level forces a fresh primary response. **See #11 (original antigenic sin)** as a failure mode.
**Invariant check.** ✅ determinism (memoization of the deterministic check); ⚠️ CRDT (cache is local, never change the wire value); ⚠️ "never guess": fast path only on *identical* (origin, schema) hit, no similarity heuristic.
**Sources.** [Immunological memory (NCBI Bookshelf)](https://www.ncbi.nlm.nih.gov/books/NBK27158/)

---

### [5] Clonal selection & affinity maturation — generate hypothesis candidates, amplify accurate ones
**Principle.** B cells that bind well are selected for proliferation + somatically hypermutated; higher-affinity mutants are preferentially selected (affinity maturation). Darwinian selection in miniature.
**Mechanism (CLONALG).** Candidate population; fitness = affinity; clone the best (∝ fitness); hypermutation inverse to fitness; reselection; diversity through new random candidates.
**NSAI-Edge transfer (complements self-critique / hypothesis generation — FLAG STRONGLY).** From a contradictory/gappy graph region the node generates **reconciliation hypotheses** ("which of two conflicting facts is more consistent with the authoritative core?"). Affinity = deterministic consistency score against the graph. High-affinity → marked as *candidates* (not fact!), low-affinity discarded. The only proposal that would give NSAI-Edge *creativity*.
**Invariant check.** ❌/⚠️ "determinism & never guess": genuine stochastic hypermutation breaks both → must be defused into *deterministic, exhaustive candidate enumeration* of permitted reconciliation operations; candidates in a *separate, never replicated, never counting* layer (proposal mode); ⚠️ "count never counts": affinity amplification must not degenerate into "most frequent candidate wins". ✅ zero-dep feasible. **Raw material, no implementation mandate.**
**Sources.** [Learning and Optimization Using the Clonal Selection Principle (de Castro & Von Zuben)](https://www.cs.unm.edu/~forrest/classes/immuno-class/readings/DeCastro.pdf)

---

### [6] Regulatory T cells — anti-autoimmunity brake against over-quarantine
**Principle.** Tregs (FoxP3⁺) prevent autoimmunity by suppressing self-reactive cells. They are the *brake*: without them the immune system attacks self. Health = balance of attack/tolerance.
**NSAI-Edge transfer (new: quarantine governor / autoimmunity guard).** Direct answer to the over-quarantine concern. A deterministic **Treg governor** monitors the reject/quarantine rate: if the share of quarantined facts from a *known, previously reliable* origin rises above a threshold, that is an autoimmunity signal (the node attacks "self" — e.g. after a faulty own constraint update). Reaction: damping (more conservative quarantine) + operator alert "possible self-poisoning of the filter". Prevents the spiral in which an overly sharp self profile (#2) excludes legitimate peers.
**Trade-offs.** An attacker could *deliberately trigger* the brake to paralyze the defense (DoS on the filter). Countermeasure: damping only for *established* origins, never for new/unknown ones; the authoritative tier is never lowered by the governor.
**Invariant check.** ✅ determinism (rate threshold + switching logic); ⚠️ the governor only changes local filter hardness, never wire value/origin trust; ✅ open-world (brake = more tolerance).
**Sources.** [Regulatory T cells in homeostasis and disease (Nature STTT 2025)](https://www.nature.com/articles/s41392-025-02326-4)

---

### [7] Cuticular hydrocarbon fingerprints — TOFU anchoring with template habituation
**Principle.** Ants/bees recognize nestmates by a colony-specific profile of cuticular hydrocarbons (CHCs) = chemical "fingerprint". They learn the template and *update it via habituation*; novel combinations trigger aggression. The template is distributed, homogenized through mouth-to-mouth feeding.
**NSAI-Edge transfer (complements TOFU).** TOFU is there (first identity anchored), but static. CHC adds: (a) **multi-factor fingerprint instead of pubkey only** — origin profile from (pubkey + typical predicate vocabulary + tier distribution + signature algorithm); sudden discontinuity in the *behavioral* profile with the same pubkey = alarm (compromised key). (b) **Habituation drift** — the anchored profile may adapt slowly, deterministically (sliding window), so that a peer legitimately extending its topic does not trigger reverify every time — a *jump* does.
**Trade-offs.** Drift rate capped, drift never across tier boundaries (limited→full via drift forbidden) — otherwise "gradual drift attack" (slow template poisoning as with adaptive spam filters).
**Invariant check.** ✅ determinism; ⚠️ behavioral profile as a local read lens over the pubkey-anchored origin (signature untouched); ✅ zero-dep.
**Sources.** [Learning Distinct Chemical Labels of Nestmates (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6123487/)

---

### [8] Vampire-bat reciprocity — defector tracking for peer-trust adjustment
**Principle.** Vampire bats share blood and track who gives back — "help received" predicts future donations 8.5× better than kinship. Cheaters are excluded over time. Trust is built gradually via cheap acts (allogrooming) before expensive ones (blood donation) follow.
**NSAI-Edge transfer (complements peer-trust adjustment).** Sharpens the evaluated adjustment-proposal mode: per peer a deterministic **reciprocity balance** — how often did it deliver facts later confirmed as *reliable* (via authoritative confirmation/constraint consistency) vs. reject-worthy ones. Balance below threshold → adjustment proposal "downgrade". Gradual escalation = a new peer starts limited (only "light" facts first), upgrade only after history.
**Trade-offs.** A dyadic balance is NOT Sybil-resistant (many identities bypass individual balances) → complement *under* MeritRank, not a replacement.
**Invariant check.** ✅ determinism + offline (exactly "offline learning of peer reliability"); ⚠️ "count never counts": weight by *independent* confirmation, not quantity; ✅ proposal mode preserves "never guess".
**Sources.** [Reciprocal help predicts donations more than relatedness (Proc R Soc B)](https://royalsocietypublishing.org/doi/abs/10.1098/rspb.2012.2573)

---

### [9] Indirect reciprocity / image scoring — propagated origin reputation without trust laundering
**Principle.** Nowak & Sigmund (1998): cooperation even without repeated direct encounters — via *reputation* (image score rises on helping, falls on refusing). Scales without pairwise history — but "moral hazard": whoever relies on image scoring alone is manipulable.
**NSAI-Edge transfer (complements provenance model B).** An **origin reputation fact** ("origin X has been confirmed in N independent authoritative corroborations") itself becomes a signed, p2p-propagable fact. A new node can read the *reputation* of X from the network instead of starting at zero (cold-start help). Compatible with model B only if the reputation attaches to the *origin*, never to the relay.
**Invariant check.** ⚠️/❌ "count never counts": image scoring is counting at its core — rescue: the score is based on the number of *independent* (different authoritative) origins, not on self-repetition; reputation is only *proposal/bias*, never a trust override (never breaks the tier cap). **Flag.**
**Sources.** [Evolution of indirect reciprocity by image scoring (Nature)](https://www.nature.com/articles/31225)

---

### [10] Brood parasitism & egg recognition — discrimination-based Sybil/spoofing defense
**Principle.** The cuckoo lays its egg in a foreign nest (provenance spoofing). Hosts counter with egg recognition & egg-color polymorphism (high variance between clutches, low within — makes mimicry harder). Coevolutionary arms race.
**Mechanism.** Compare every egg against an internal template + **discrimination threshold** (itself evolvable: too sharp → ejection of own eggs = autoimmunity; too lax → the parasite gets through).
**NSAI-Edge transfer (complements Sybil defense).** A fact that claims to come from a *trusted* origin is checked against that origin's behavioral/schema template (#7) — "cuckoo egg" (forged provenance / compromised key with atypical content) ejected by threshold. **Egg-color polymorphism → origin diversity bonus**: treat facts from a *narrow, monomorphic* origin cluster (Sybil signature: artificially uniform) more suspiciously than those from diverse, independent origins. Complementary to MeritRank.
**Invariant check.** ✅ determinism (template distance + threshold, couple to danger score #1); ✅ "trust at the origin"; ⚠️ open-world: ejection on spoofing suspicion = "uncertain/quarantine", not "is false".
**Sources.** [Coevolution underpins speciation in brood-parasitic cuckoos (Science)](https://www.science.org/doi/10.1126/science.adj3210)

---

### [11] Original antigenic sin — failure-mode warning for caching/memory (anti-pattern)
**Principle.** Flip side of immune memory (#4): with a *similar but not identical* variant the system reflexively reacts with the *old* memory and suppresses the better naive response — "trapped" by first contact.
**NSAI-Edge transfer (anti-pattern for #3/#4/#7).** Not a feature — a **failure-mode specification**: if a cached negative entry (#3) or a habituation template (#7) is too rigid, the node reflexively treats a *legitimately evolved* origin by the old verdict and suppresses the correct re-evaluation. Protection: (a) cache/spacer TTL + re-validation; (b) on *similarity-but-not-identity* always a fresh primary check instead of fast path; (c) governor (#6) monitors "old verdict suppresses new evidence".
**Invariant check.** ✅ strengthens "never guess" (forbids reflexive extrapolation of old knowledge). ✅ determinism. Purely a negative constraint on other features.
**Sources.** [Original Antigenic Sin: the Downside of Immunological Memory (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8546681/)

---

### [12] Quorum quenching & aggressive mimicry — adversarial signal-jamming threat models
**Principle.** (a) **Quorum quenching**: bacteria disrupt competitors' communication (signal degradation/blockade = jamming). (b) **Aggressive mimicry** (Photuris "femme fatale" fireflies): imitates the mating signal of foreign species, lures males — and eats them. Trust signal as a bait trap.
**NSAI-Edge transfer (new: threat models for self-critique/quorum).** A **quorum-quenching attacker** floods the network with contradictions, specifically to *prevent* corroboration (no consensus → no promote) — an availability attack on the trust mechanism. Countermeasure: quorum counts *independent authoritative* confirmations (not absence of contradiction); an origin that delivers only contradictions without own corroboration is downgraded via the reciprocity balance (#8). **Aggressive mimicry** = a Sybil that exactly imitates the schema/vocabulary of a trusted origin — countermeasure #7/#10 (behavioral discontinuity); the *origin signature (Ed25519) cannot be forged* — **model B is the fundamental defense here.**
**Invariant check.** ✅ strengthens "count never counts" + "trust at the origin" (mimicry fails at the signature); ✅ determinism; ⚠️ quorum must not tip into "silence→reject" (open-world).
**Sources.** [Interference in Bacterial Quorum Sensing (Front Pharmacol)](https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2018.00203/full) · [Aggressive Mimicry in Photuris Fireflies (Science)](https://www.science.org/doi/10.1126/science.187.4175.452)

---

### [Bonus] Apoptosis vs. necrosis — clean discarding of corrupt data without collateral damage
**Principle.** Apoptosis = programmed, inflammation-free cell death (clean packaging, phagocytes clear up). Necrosis = uncontrolled (membrane bursts, contents leak, inflammation/collateral).
**NSAI-Edge transfer (complements reject/quarantine disposal).** **Apoptotic reject**: a malicious fact is removed *cleanly* — CRDT tombstone + CRISPR spacer (#3) generated in an orderly way, no "inflammation" (no cascade of follow-on rejects of neighboring legitimate facts). **Necrotic reject** (anti-pattern): hard deletion that breaks CRDT convergence or kills everything from the origin wholesale. Specification: every discard via ordered tombstones, never destructive.
**Invariant check.** ✅ CRDT (tombstone convergence-preserving; hard deletion = breach); ✅ determinism. At its core a *CRDT invariant protection* specification for all reject paths.
**Sources.** [Programmed cell death and inflammation (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4455968/)

---

## Top 3 wildest ideas
1. **Clonal selection / affinity maturation as a generative self-critique engine (#5).** The only proposal that would give NSAI-Edge genuine *hypothesis generation* — head-on against "determinism" + "never guess" + "no LLM". Conceivable only in the strictly separated proposal layer with deterministic operator enumeration. Flag maximally.
2. **CRISPR spacer array as a p2p-heritable defector immune memory (#3).** Shared, signed blocklisting that *inherits* across the network. Powerful, but a sharp censorship/poisoning vector that can tear apart "trust at the origin".
3. **Treg governor as an autoimmunity guard over one's own defense (#6).** A meta control loop that monitors and brakes the *own filter system*. The node distrusts not only peers but also its own paranoia. Fits the meta-cognition line.

## Which biological defense mechanism does NSAI-Edge lack completely?
**The DANGER/damage axis (Matzinger, #1) — and the negative feedback control loop (#6).** NSAI-Edge today thinks binarily along the *self/non-self* axis: foreign → quarantine, unknown origin → reject (the immunological dogma of the 1950s). The second, orthogonal axis is missing: *dangerous vs. harmless*. No notion of a "damage signal" → it cannot distinguish "foreign and harmless" (legitimate new peer) from "foreign and dangerous" (constraint-breaking spoof) → structurally predisposed to **over-quarantine / autoimmunity**, without a brake. Missing together: (a) a **deterministic danger signal** that *triggers* quarantine (instead of mere foreignness), and (b) a **regulatory antagonist** (Treg governor) that *dampens* the overreaction. Biologically: NSAI-Edge has killer T cells (reject) and a TOFU thymus (#7), but **neither danger sensing nor regulatory T cells** — the recipe for autoimmunity. The most fruitful extension corridor (#1 + #6 as a pair).
