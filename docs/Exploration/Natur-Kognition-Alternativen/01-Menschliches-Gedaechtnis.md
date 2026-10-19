# Human Memory & the Brain as a Blueprint

> **Exploration raw material** (batch 2026-05-29), generated via research agent (web-sourced). **No CDP5 binding** — deliberately broad/creative. Invariant violations are *flagged, not filtered*. Model: `docs/Exploration/NotebookLM`. Purpose: raw material for the Konzept (concept document), **not itself the Konzept**.
>
> **Invariant legend:** (1) zero-dep · (2) offline · (3) determinism · (4) CRDT convergence · (5) trust/belief/temporality = local read lenses over the signed wire value · (6) "count never counts" · (7) open-world · (8) "never guess".

---

## 1. ACT-R base-level activation as a second, cognitively grounded decay axis

**Principle** (cognition) — Anderson & Schooler's rational analysis shows: human memory keeps available exactly the information that is statistically most likely to be needed next. The "base-level activation" of a memory chunk tracks the log odds that this chunk is needed NOW — and this quantity empirically follows exactly a power law of usage recency and frequency. This is not a biological weakness but an environment-optimal prediction.

**Mechanism/algorithm** — `B_i = ln( Σ_{j=1}^{n} t_j^{-d} )`, where `t_j` = time since the j-th access, `d` = decay rate (ACT-R default 0.5). Each retrieval adds a term that then decays independently → power law of practice + power law of forgetting in one formula. Important: power law (`t^-d`), not the current exponential half-life decay.

**NSAI-Edge transfer** — Complements (does not replace) the temporality-based confidence decay with a separate, locally computed `activation` column per triple: sum over access timestamps (= the planned access-based decay/spaced repetition, but mathematically grounded). Confidence remains the signed truth *claim*; activation becomes the "how quickly reachable" lens for retrieval ranking. This gives NSAI-Edge the desired two axes — cognitively exactly right: confidence ≈ Bjork's storage strength, activation ≈ retrieval strength (idea 2).

**Alternatives & trade-offs** — Power law is more expensive than exponential (sum over n accesses). "Optimized learning" approximation `B_i ≈ ln(n/(1-d)) − d·ln(t_now − t_creation)` needs only n + creation time → O(1). Caution (Petrov 2018): the standard approximation can be non-monotonic in d → for determinism use the full sum with capped history (e.g. last 20 accesses).

**Invariant check** — (1) ✅; (2) ✅; (3) ⚠️ `ln`/`pow` are float — harmless in the LOCAL retrieval path, NEVER in the federated/signed path (integer per mille there); (5) ✅ activation local, mutates no signed field; (6) ✅ recency/frequency of ONE'S OWN access ≠ source count.

**Sources** — Anderson & Schooler (1991), *Reflections of the Environment in Memory*; Anderson 2021 (http://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2021/07/ACTR2021anderson.pdf); van Rijn et al., *A Comparison of Approximations for Base-Level Activation in ACT-R*, Comput Brain Behav 2018 (https://link.springer.com/article/10.1007/s42113-018-0015-3).

---

## 2. Storage strength vs. retrieval strength — two orthogonal axes (Bjork)

**Principle** — Bjork's "New Theory of Disuse": two independent measures per entry: **storage strength** (how deeply learned — rises monotonically, NEVER falls) and **retrieval strength** (how quickly retrievable right now — decays). A memory can be deeply stored but temporarily inaccessible. The twist: successful retrieval at LOW retrieval strength yields the largest gain in storage strength ("desirable difficulties").

**Mechanism** — Two scalars. SS only additive (monotonic). RS decays exponentially/power-law, raised by retrieval — retrieval boost on SS inversely proportional to current RS: `ΔSS ∝ (1 − RS)`. High SS dampens RS decay.

**NSAI-Edge transfer** — Provides the clean SEMANTICS for the two decay axes: `confidence` (signed, ~SS, may only rise via reinforce/CRDT-max — matches "SS never drops"!) and `activation` (~RS, local, decays). Concretely new: for a query whose top hit has LOW activation but HIGH confidence → AMPLIFY the reinforce() boost (desirable-difficulty bonus). Turns the planned spaced repetition into a theoretically correct model. Bonus: explains why "disputed/outvoted" facts should remain auditable — low RS, but SS remains → "labile, not deleted".

**Invariant check** — (3) ✅; (5) ✅ activation as read lens, confidence/SS stays signed; (4) ✅ CRDT-max on confidence consistent with "SS never drops"; (6) ✅.

**Sources** — Bjork & Bjork (1992), *A new theory of disuse* (https://www.researchgate.net/publication/281322665); The Learning Scientists, *Retrieval vs. Storage Strength* (https://www.learningscientists.org/blog/2016/5/10-1).

---

## 3. Offline "sleep phase": sharp-wave-ripple replay & batch re-inference

**Principle** (neuro) — In slow-wave sleep the hippocampus reactivates recent sequences in compressed bursts (sharp-wave ripples, SWR); these coordinate with the neocortex and gradually transfer content into stable cortical long-term storage (systems consolidation). 2024/25: closed-loop amplification of large SWRs increases reactivation + memory performance; only a SUBSET of large SWRs carries the consolidation.

**Mechanism** — Idle-triggered batch job: (a) selective replay — prefer episodes with high salience value (frequently referenced / high activation / high surprise); (b) forward-chaining re-run over all rules; (c) promotion: stabilized episodes → semantic triples (idea 5). Selectivity = "large SWR": only top-k by salience score, not everything.

**NSAI-Edge transfer** — New idle batch mode (no online path): bundles episodic memory + consolidation + inference into a deterministic, off-peak "sleep phase". Concretely: forward chaining today runs at query/assert time → an additional consolidation pass amortizes inference cost and extracts gist offline (determinism-friendly, temporally decoupled). Selective replay prioritizes via activation score (idea 1).

**Alternatives & trade-offs** — Eager (everything immediately) is easier to keep consistent but expensive & can prematurely lock in wrong inferences. Lazy sleep phase allows "maturing overnight" — reads must tolerate the "not yet fully derived" state (open-world helps).

**Invariant check** — (2) ✅ local batch; (3) ✅ deterministic with totally ordered replay order (e.g. by (timestamp, hash)); (8) ⚠️ promotion must NOT auto-assert → sleep produces at most QUARANTINE candidates; (4) ✅ derived triples locally/deterministically reproducible.

**Sources** — Buzsáki, *Hippocampal SWR* (https://pmc.ncbi.nlm.nih.gov/articles/PMC4641767/); *Large sharp-wave ripples promote reactivation*, Neuron 2025 (https://www.cell.com/neuron/abstract/S0896-6273(25)00756-1); *Replay and Ripples in Humans*, Annu Rev Neurosci 2024 (https://www.annualreviews.org/doi/pdf/10.1146/annurev-neuro-112723-024516).

---

## 4. Sleep-dependent abstraction / insight: three transformation types episode→semantics

**Principle** — Sleep extracts the "gist" from episodes and reduces details; this produces schemata, rules, insight. Walker & Stickgold ("overnight alchemy"): three outputs — **unitized** (new cortical connection), **assimilated** (attachment to existing networks), **abstracted/schema** (commonalities across traces). 2025: gist abstraction partly also sleep-independent over time → the driver is offline reprocessing, not necessarily sleep.

**Mechanism** — In the sleep phase (idea 3): detect recurring SPO patterns. (a) Unitize: frequent co-occurrence pair → direct edge. (b) Assimilate: attach new triple to hub when PPR proximity is high. (c) Abstract: when k subjects share the same (predicate, object) → candidate rule `∀x: type(x,T) ⇒ p(x,O)`. Threshold deterministic (support ≥ k, no sampling).

**NSAI-Edge transfer** — Complements the planned episode→semantics promotion with three clearly separated operators instead of one undifferentiated "consolidate". (c) in particular is powerful: proposes NEW symbolic rules from data (data-driven rule mining) that feed the deterministic forward chaining. The lever from "memory" to "learning".

**Alternatives & trade-offs** — Rule mining is classic (ILP, AMIE for KGs), fits zero-dep (support/confidence counting). BUT collides directly with the DRM false memory (idea 9) — overgeneralization creates plausible false triples.

**Invariant check** — (8) ❌→⚠️ auto rule derivation literally violates "never guess" → mitigation: mined rules/triples with source_type=`inference`, lowest tier, in QUARANTINE, need endorsement; (6) ⚠️ support counting smells of "count counts" → support only triggers candidate GENERATION, never belief WEIGHTING; (3) ✅ deterministic with fixed thresholds. **Still highly interesting** — the only feature here that creates genuinely new structures.

**Sources** — Walker & Stickgold, *Overnight alchemy*, Nat Rev Neurosci 2010 (https://walkerlab.berkeley.edu/reprints/WalkerStickgold_NRN_2010.pdf); *Sleep Supports Slow Abstraction of Gist* (https://www.semanticscholar.org/paper/14ea40070fc86748fe5fa63aa3f6a1bd028f4ca5); *Long-Term Visual Gist Abstraction Independent of Sleep*, 2025 (https://pmc.ncbi.nlm.nih.gov/articles/PMC12856105/).

---

## 5. Reconsolidation & prediction-error-gated belief update (instead of hard overwrite)

**Principle** (neuro) — Nader: a retrieved memory becomes briefly labile and must be stored anew (reconsolidated). Crucially: labilization is triggered by **prediction error** — only when reality deviates from the memory does the update window open. Memory strength/age limit whether the window opens.

**Mechanism** — On re-assert of a competing object: PE = distance(new object, current belief). No PE → no update (only CRDT-max reinforcement). PE > threshold → "labilization window": the new object may challenge, BUT gradually (confidence convergence) instead of hard overwrite. Boundary: very old/high-confidence beliefs need larger PE (metaplasticity).

**NSAI-Edge transfer** — Refines belief resolution + TMS: today "highest tier × recency × confidence wins, rest disputed". PE gating: small deviations reinforced, large ones trigger revision; the strength of the existing belief is a hurdle against premature flipping (anti-flapping with changing sources). Cognitive justification for NSAI-Edge not overwriting hard but marking "disputed".

**Invariant check** — (5) ✅ PE gating on the local belief lens; (3) ✅ integer distance + integer threshold; (4) ⚠️ update must stay commutative → PE relative to the CRDT-converged state, not to arrival order; (8) ✅.

**Sources** — *Updating memories — prediction errors in reconsolidation* (https://www.sciencedirect.com/science/article/abs/pii/S0166432814006688); *An update on memory reconsolidation updating*, PMC 2017 (https://pmc.ncbi.nlm.nih.gov/articles/PMC5605913/).

---

## 6. Source-monitoring framework as confabulation defense (Johnson)

**Principle** — Memories carry NO built-in source label (Johnson, Hashtroudi & Lindsay). The source is RECONSTRUCTED at retrieval from accompanying features — threshold/pattern matching. Reality monitoring = special case: perceived or self-thought/imagined? Vivid imagination can cross the "real" threshold → source confusion = false memory.

**Mechanism** — Each belief carries explicit source attributes; at retrieval the source is NOT guessed but decided from signed attributes. Reality-monitoring criterion: source_type ∈ {self-generated, llm, inference} gets a harder threshold than externally perceived ones (signed by a foreign origin) before they count as "fact".

**NSAI-Edge transfer** — Cognitive validation for provenance model B + the `llm`/`inference` tier: NSAI-Edge does the right thing by tying trust to the origin (not the relay) — mechanized source attribution, which humans do error-prone. Addition: an explicit `reality_monitoring` flag that strictly separates self-generated/LLM inference from perceived external facts — protection against the AI counterpart of confabulation (LLM output stored back as "fact"). Feeds the self-critique pass. **(Directly relevant to the lie/truth/fiction question — see doc 06.)**

**Invariant check** — (5) ✅ source attributes are signed wire values; (8) ✅ strengthens "never guess"; (6) ✅; (3) ✅.

**Sources** — Johnson, Hashtroudi & Lindsay (1993), *Source Monitoring* (https://pubmed.ncbi.nlm.nih.gov/8346328/); *Monitoring what is real*, PMC 2017 (https://pmc.ncbi.nlm.nih.gov/articles/PMC5312673/).

---

## 7. Metamemory: feeling-of-knowing / judgment-of-learning as query self-assessment

**Principle** — Humans estimate their knowledge via heuristics WITHOUT directly retrieving the content: feeling-of-knowing (FOK), judgment-of-learning (JOL), tip-of-the-tongue (TOT). Based on cue familiarity/retrieval fluency, not on the target itself — usually surprisingly well calibrated.

**Mechanism** — For every query a deterministic meta signal NEXT TO the hit: (a) FOK = weighted seed match × graph connectivity of the cue (even without a high-confidence target — "material nearby"); (b) JOL ≈ aggregated activation/confidence; (c) TOT analog = "strong cue match, but top object just below threshold" → "ask again / endorse me".

**NSAI-Edge transfer** — query()/verify() get a metamemory header: not just the result but a calibrated self-assessment. Hook for the agent: low FOK → "graph has little, fetch external source"; TOT → "almost there, endorsement missing". Connects to the evaluated meta-cognition/calibration (Brier/ECE) as its INPUT side.

**Invariant check** — (3) ✅; (7) ✅ distinguishes "nothing stored" from "stored, low"; (8) ✅ quantifies uncertainty, does not guess.

**Sources** — Koriat, *Sources of information in metamemory* (https://link.springer.com/article/10.3758/BF03213977); *TOT and FOK Enhance Metacognitive Sensitivity*, J Cognition 2024 (https://pmc.ncbi.nlm.nih.gov/articles/PMC12047626/).

---

## 8. Retrieval-induced forgetting: competition-driven suppression instead of time decay

**Principle** — Retrieving a memory actively SUPPRESSES competing similar ones (RIF) — via prefrontal inhibitory control. Competition-dependent (only competitors suffer), cue-independent, adaptive: clears interference, makes the wanted item faster to retrieve. Forgetting as a feature.

**Mechanism** — When reinforcing a "winner" belief in a competition cluster (same S+P): additionally lower the local activation/RS of the LOSING objects (active suppression), not just passive time decay. Cue-independent = suppression attaches to the competitor. Competition-dependent = only in a genuine disputed cluster.

**NSAI-Edge transfer** — Complements decay + belief resolution: today "outvoted stays auditable (disputed)" lies passively. RIF gives an ACTIVE mechanism to dampen disputed competitors in the ranking as soon as the winner is reinforced → fewer noise hits. Only the READ lens (activation) drops; the signed value stays auditable (Bjork SS remains).

**Invariant check** — (6) ✅✅ inhibition-based, NOT count-based; (5) ✅ only activation drops; (7) ⚠️ must not delete disputed (auditability) → only dampen, cap, never to 0.

**Sources** — *Retrieval induces adaptive forgetting via cortical pattern suppression*, Nat Neurosci (https://www.nature.com/articles/nn.3973); *A retrieval-specific mechanism of adaptive forgetting*, Nat Commun 2018 (https://www.nature.com/articles/s41467-018-07128-7).

---

## 9. Fuzzy-trace theory: verbatim + gist as TWO parallel traces — and the DRM warning

**Principle** — Brainerd & Reyna: for every event TWO traces — **verbatim** (item-specific, details) and **gist** (extracted meaning). True memories rely on verbatim; gist produces FALSE memories in the DRM paradigm (semantically related lures are accepted). The flip side of every abstraction.

**Mechanism** — Episodes (verbatim, complete signed triples with provenance) STRICTLY separated from derived gist triples (idea 4). On verify(claim): first against verbatim — if a verbatim record exists, it wins. Gist hit without verbatim support → "gist-only / potential confabulation". Mechanically a DRM detector.

**NSAI-Edge transfer** — Refines the episode/semantics separation into a safety architecture: gist triples are useful for ranking but must never fake a verbatim record in verify(). Direct protection against the main risk of idea 4. Feeds self-critique: "Am I asserting something that only stems from gist?" **(Central to lie/truth/fiction — doc 06.)**

**Invariant check** — (8) ✅ strengthens "never guess"; (5) ✅ both traces signed, different source_type; (3) ✅; (7) ✅ no verbatim record ≠ false, only "unsupported".

**Sources** — Brainerd & Reyna, *Fuzzy-Trace Theory and False Memory* (https://www.semanticscholar.org/paper/577b69191df294839629b00e6d88ea25dc93b07a); *False recall in DRM: gist and associative strength*, PMC (https://pmc.ncbi.nlm.nih.gov/articles/PMC3226830/).

---

## 10. Testing effect: retrieval as the strongest consolidation trigger (not restudying)

**Principle** — Active RETRIEVAL strengthens memory more than looking again (testing effect). Mechanism: effortful elaborative retrieval — it is precisely the strenuous, non-trivial retrieval that produces the most robust long-term storage.

**Mechanism** — Two reinforce channels: (a) re-assert/re-read of the same source = weak reinforcement; (b) successful query/verify that uses a triple as an answer = strong reinforcement (retrieval practice), with Bjork bonus inverse to activation. Effort proxy: retrievals over several PPR hops/inference give more boost than direct hits.

**NSAI-Edge transfer** — Refines the access-based reinforce(): not every touch is equal. Successfully ANSWERED queries (retrieval) reinforce much more strongly than mere re-assert. Hardens the graph exactly along the knowledge paths actually used.

**Invariant check** — (3) ✅ hop count/retrieval success deterministic; (5) ✅ reinforce locally additive; (6) ✅ one retrieval event, no source count. (Caution: keep the effort proxy manipulation-resistant → reinforcement gaming.)

**Sources** — *Mechanisms behind the testing effect*, Front Psychol 2015 (https://www.frontiersin.org/articles/10.3389/fpsyg.2015.01054/full).

---

## 11. Zeigarnik effect: prospective memory for open loops / unverified beliefs

**Principle** — Unfinished/interrupted tasks remain more accessible than completed ones (Zeigarnik): an open goal keeps elevated activation until it is done. Prospective memory = remembering to do SOMETHING in the future.

**Mechanism** — Mark triples with open status (quarantined, disputed, gist-only, low confidence, "endorsement pending") as OPEN LOOPS with artificially elevated, NON-decaying activation — until resolved. Prospective trigger: if an open loop appears in the next matching context, query() proactively returns "unresolved — please verify".

**NSAI-Edge transfer** — "Open-loop" feature beyond quarantine/TMS: instead of uncertain facts passively fading away, they stay SALIENT until the agent resolves them — a built-in "to-verify" drive. Fights the silting-up of quarantined items. With metamemory (idea 7): TOT + open loop = strongest "ask back" signal.

**Invariant check** — (5) ✅ activation lens; (7) ✅✅ congenial to open-world (open loop = explicitly "not yet decided"); (8) ✅ enforces endorsement-before-promotion; (3) ✅.

**Sources** — Zeigarnik (1927), *Über das Behalten erledigter und unerledigter Handlungen*; Koriat (idea 7).

---

## 12. Spreading activation along signed edges as a deterministic PPR boost

**Principle** — In a semantic network, activation spreads from an activated concept to associated ones (Collins & Loftus; ACT-R: activation = base level + spreading from current buffer contents). Recently used nodes "pre-warm" neighbors → faster, context-sensitive retrievals.

**Mechanism** — Extend the belief-weighted PPR with a short-lived "buffer": the last N queried nodes as additional PPR seeds with decaying weight (= current session context). Spreading strength = edge belief × source activation. Deterministic: fixed iteration count, integer per mille, total tie order.

**NSAI-Edge transfer** — Refines the existing PPR retrieval with CONTEXT sensitivity: NSAI-Edge is effectively already a spreading-activation system (PPR is the generalization). Addition: session-local buffer that feeds the last queries as context seeds (like ACT-R's goal buffer). Makes follow-up queries more coherent, without embeddings.

**Invariant check** — (3) ✅ fixed iterations + integer weights + tie order, NO embeddings; (5) ✅ buffer is a read lens; (4) ✅ read-only; (6) ✅ belief-weighted. (Risk: too strong a buffer weight → "tunnel vision"/confirmation bias → cap.)

**Sources** — Taatgen, Lebiere & Anderson, *Modeling Paradigms in ACT-R* (https://www.ai.rug.nl/~niels/publications/taatgenLebiereAnderson.pdf); Collins & Loftus (1975), *A spreading-activation theory*.

---

## Top 3 wildest / most unconventional ideas (including invariant-breaking ones)

**W1 — "Dreaming": controlled confabulation as a hypothesis generator.** In REM sleep the brain recombines distant contents into novel associations — substrate for insight. A "dream phase" that DELIBERATELY draws unusual edges between weakly connected nodes (low belief, high distance) as HYPOTHESES. Breaks (8) head-on — **still interesting**, because it finds exactly the unexpected connections forward chaining never draws. Mitigation: dreams in a separate "hypotheses" sandbox with belief 0, never in the fact graph, verify externally.

**W2 — Affective tagging / "emotional salience" (amygdala hub).** Emotionally charged memories are preferentially consolidated, forgotten more slowly. A "stakes"/"surprise" tag (triples that corrected an expensive agent error / arrived with high PE) → slower decay + replay priority. **Potentially breaks (6)** if "importance" is confused with "often asserted" → salience from consequence/surprise of ONE'S OWN system, not from source count. Provides triage: what is preserved/replicated overnight.

**W3 — Method of loci / spatial memory as a graph topology layer.** Humans memorize huge amounts by attaching facts to a familiar SPACE (memory palace); the hippocampus uses place/grid cells for memory AND navigation. NSAI-Edge creates a stable "spatial" embedding (deterministic layout / community clusters as "rooms") to which retrieval anchors as a navigation path. **Tension with (3)** → only deterministic procedures (seed-fixed spectral clustering, integer hash buckets). Embedding-free organizing metaphor for massive graphs.

---

## What humans do that NSAI-Edge does not attempt AT ALL yet

1. **Active, competition-driven suppression (RIF).** NSAI-Edge forgets only passively via time decay. Humans ACTIVELY suppress competitors when retrieving the winner (idea 8). Completely unused.
2. **Prediction error as the gate to changeability (reconsolidation).** NSAI-Edge treats every re-assertion the same (CRDT-max). Humans make a memory labile ONLY on surprising deviation — PE gating (idea 5). No surprise/PE concept present.
3. **Strict verbatim-vs-gist architecture with DRM awareness.** Episode→semantics is planned, but NOT the protection that gist never fakes a missing original record (idea 9). NSAI-Edge could separate them CLEANLY and structurally exclude confabulation — which is precisely what humans are NOT good at.
4. **Metamemory as an output signal (FOK/TOT).** NSAI-Edge outputs confidence, but no "material nearby but no hit" / "almost certain, endorsement missing" (ideas 7/11). No FOK/TOT channel.
5. **Salience-driven selective consolidation.** The brain replicates only a SUBSET in sleep (large SWRs) — it triages. NSAI-Edge has no sleep phase and no triage heuristic for WHICH episodes get promoted to semantics (ideas 3/4 + W2).

---

### Cross-connection (for the synthesis)
**Ideas 1+2 (two axes: confidence=storage / activation=retrieval)** = foundation; **idea 3 (sleep phase)** = batch carrier for **4 (abstraction), 5 (PE update), 8 (RIF)**; **6+9 (source monitoring + verbatim/gist)** = confabulation defense layer that makes idea 4 safe (and core for doc 06); **7+11 (metamemory + open loops)** = introspective output layer; **10+12** refine reinforce/PPR without breaking invariants. Invariant-safe + immediate: 1, 2, 7, 8, 10, 12. Risky (quarantine/endorsement gate needed): 4, W1.
