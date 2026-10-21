# Alternative "Thinking"/Representation Architectures (cognitive + technical)

> **Exploration raw material** (batch 2026-05-29), web-sourced. **No CDP5 binding.** Determinism/zero-dep verdicts are deliberately sharp, because this is where most invariant conflicts lurk. Purpose: raw material for the Konzept (concept document).
>
> **Invariant legend:** (1) zero-dep · (2) offline · (3) determinism · (4) CRDT · (5) local read lenses · (6) "count never counts" · (7) open-world · (8) "never guess".

---

## 1. Predictive coding / free energy / active inference — confidence = precision
**Principle.** The brain minimizes variational free energy (upper bound on surprise). Belief updates are weighted by *precision* (inverse variance, Π = Σ⁻¹): a prediction error drives the belief more strongly the more precise/reliable the observation. **Confidence IS precision.**
**Mechanism.** Gradient descent on F: weighted error ξ = Π·ε with ε = (observation − prediction); update μ̇ ∝ Π·ε (belief movement = precision × surprise).
**NSAI-Edge transfer (complements + unifies).** Today decay, reinforcement, belief resolution are three separate heuristics. Predictive coding offers ONE principle: model every triple as (value, precision). Incoming evidence = prediction error against the graph belief; the confidence update is determined by the *relative precision* of prior (graph) vs. likelihood (source) = precision-weighted averaging. Bonus: verify(claim) naturally becomes "how large is the claim's prediction error against the graph" = surprise as a falsification score.
**Determinism/zero-dep verdict: PARTIAL.** The *precision-weighted averaging* is trivially integer-deterministic: `new = (w_prior·c_prior + w_evi·c_evi) / (w_prior + w_evi)` (integer per mille, defined rounding). NO for the full active-inference machinery (continuous generative models, Laplace approximation, float gradient flow). Recommendation: adapt only the *precision-as-weight* idea.
**Invariant check.** (3) ✅ (integer averaging) / (1) ✅ averaging, ❌ full AI / (6) ❌ precision addition = vote counting through the back door → MUST be coupled to authority/trust, not to source count / (5) ✅ precision as a local read lens.
**Sources.** Friston, *Predictive coding under the free-energy principle*, Phil Trans R Soc B 2009 ([FIL PDF](https://www.fil.ion.ucl.ac.uk/~karl/Predictive%20coding%20under%20the%20free-energy%20principle.pdf)); *Free Energy, Precision and Learning* ([PMC4235126](https://pmc.ncbi.nlm.nih.gov/articles/PMC4235126/)).

---

## 2. ACT-R base-level activation — cognitively grounded decay (Anderson & Schooler)
**Principle.** Item availability mirrors the statistical structure of the environment: what was used recently/frequently is more likely to be needed again. Retrieval probability follows a *power law* in recency & frequency — rationally optimal.
**Mechanism.** `B_i = ln(Σⱼ tⱼ^(−d))`, d=0,5. Full activation with spreading: `A_i = B_i + Σⱼ Wⱼ·S_ji`, with `S_ji = S − ln(fan_j)` (fan effect). Optimized form: `B_i ≈ ln(n/(1−d)) − d·ln(L)`; Petrov hybrid: exact sum over the k most recent accesses + closed-form decay for the rest.
**NSAI-Edge transfer (replaces decay + complements retrieval).** Replace the time-based decay with the ACT-R power law (cognitively grounded, monotonic; the optimized form needs only (n, L, t_last) per triple — memory-light). Spreading activation = belief-weighted neighborhood propagation (≈ existing PPR), but ACT-R supplies the *fan damping* (S − ln(fan)): a node with many edges distributes less activation per edge — an elegant, principled anti-hub heuristic.
**Determinism/zero-dep verdict: YES (with fixed-point ln).** ln/power via fixed-point log over integer math (LUT/CORDIC), byte-identical. Since NSAI-Edge already runs a softmax-/exp-containing belief resolution deterministically, the infrastructure for deterministic transcendental functions probably already exists. `tⱼ^(−0,5)=1/√tⱼ` integer-approximable (Newton, fixed number of rounds).
**Invariant check.** (3) ✅ / (1) ✅ / (6) ✅ frequency is the recency statistic of THE SAME triple, no source voting / (4) ⚠️ k + d MUST be wire constants (otherwise federation divergence → the constants-consistency gate kicks in).
**Sources.** Anderson & Schooler 1991; Petrov, *Computationally Efficient Approximation of Base-Level Learning* ([ICCM06 PDF](http://alexpetrov.com/pub/iccm06/PetrovICCM06.pdf)); [Springer CBB 2018](https://link.springer.com/article/10.1007/s42113-018-0015-3).

---

## 3. Drift diffusion / evidence accumulation to bound (Ratcliff)
**Principle.** Decision = accumulation of noisy evidence up to a threshold. Threshold distance controls the speed-accuracy trade-off.
**Mechanism.** dx = v·dt + s·dW (Wiener noise); bounds 0/a; decision = first passage. The within-trial process is *stochastic*.
**NSAI-Edge transfer (complements belief/quorum resolution).** Instead of a softmax snapshot: accumulate evidence over time — each confirming triple = one increment toward "decided", contradicting ones toward the opposite bound. Only when |evidence| crosses threshold a does a claim count as *decided*; otherwise *contested*. Gives NSAI-Edge a natural "maturity" semantics (young/controversial vs. established) and a principled quorum threshold.
**Determinism/zero-dep verdict: PARTIAL — core is stochastic.** The Wiener diffusion (dW) is randomness = determinism breach. BUT the noise is NOT needed: the deterministic skeleton — "accumulate integer evidence increments up to threshold a" — is a pure integer accumulator. Adopt the *bound-crossing logic*, not the diffusion process.
**Invariant check.** (3) ✅ (without dW) / ❌ (genuine DDM) / (6) ⚠️ increments must be trust-weighted + saturated (otherwise source counting) / (5) ⚠️ accumulator state persists → breaks "pure read lens over pure wire value", would have to be federated.
**Sources.** Ratcliff & McKoon, *Diffusion Decision Model* ([PMC4928591](https://pmc.ncbi.nlm.nih.gov/articles/PMC4928591/)).

---

## 4. Conceptual spaces (Gärdenfors) — geometric similarity WITHOUT ML embeddings
**Principle.** Concepts = *convex regions* in quality dimensions; similarity = distance; categorization = Voronoi tessellation around prototypes. Geometry of meaning without learned vectors.
**NSAI-Edge transfer (complements — embedding replacement for numeric domains).** For *quantitative* predicates (temperature, price, date, age): check similarity/consistency geometrically-deterministically instead of only lexically ("38 °C" close to the "fever" region). verify() gets a *graded* consistency check for numeric slots; contradiction = "value outside the convex region". The embedding benefit for the subspace where dimensions are *interpretable and schema-given* — without ML.
**Determinism/zero-dep verdict: YES (for given dimensions).** Points/boxes/convexity/distance = integer geometry (Manhattan/Chebyshev exact). The hard part: where do the dimensions come from? → declare them from the *schema*. Automatic dimension learning (MDS) would be float/iterative → NO.
**Invariant check.** (3) ✅ / (1) ✅ / (7) ✅ / (8) ✅ (distance is exact) / ⚠️ only declared dimensions.
**Sources.** Gärdenfors, *Conceptual Spaces: The Geometry of Thought* (MIT 2000); [Wikipedia](https://en.wikipedia.org/wiki/Conceptual_space).

---

## 5. Vector symbolic architectures / hyperdimensional computing (Kanerva MAP, Plate HRR) — THE strong candidate
**Principle.** Symbols as high-dimensional (~10,000-dim) random vectors; in such high dimensions random vectors are quasi-orthogonal (tolerance ~30 % bit corruption). Three algebraic operations create compositional structure.
**Mechanism.** **Binding** ⊗ (role-filler): MAP = element-wise multiplication of bipolar ±1 vectors (*self-inverse*); BSC = XOR (also self-inverse); HRR = circular convolution (real-valued). **Bundling** ⊕ (superposition/set): element-wise addition + thresholding (majority for binary). **Permutation** ρ: cyclic shift. Similarity = Hamming (binary) / dot (bipolar). Cleanup via item-memory codebook.
**NSAI-Edge transfer (new — deterministic, ML-free "embedding" layer).** **The most important candidate.** Encode every triple holographically: `T = (S⊗rolleS) ⊕ (P⊗rolleP) ⊕ (O⊗rolleO)`. Atomic vectors *deterministically seeded from the term string* (SHA-256(term) → bit expansion → bipolar). Result: (a) content-addressable, typo-robust retrieval (partial query → cleanup); (b) compositional analogy/substitution via unbinding (`T⊗rolleO⁻¹ ≈ O` → "what is the object?"); (c) a *similarity* layer as embedding replacement — WITHOUT the deferred ML embeddings, WITHOUT a determinism breach.
**Determinism/zero-dep verdict: YES — the rare direct hit.** Atomic vectors via SHA-256 seed (`node:crypto` is already in the core!) → byte-identical. Binding (XOR/±1 multiply), bundling (integer add + sign), permutation (shift), Hamming (popcount) — all integer, no float (binary BSC/MAP, NOT real-valued HRR). 10,000 bits = 1.25 KB/vector. Federation: same term from same seed → identical vector → CRDT-convergent. Cleanup thresholds must be wire constants.
**Invariant check.** (3) ✅ / (1) ✅ / (2) ✅ / (4) ✅ / (6) ✅ similarity ≠ confidence / (7) ✅. **Cleanest invariant score of all eight.** (Risk: bundling capacity limited → crosstalk; capacity governor needed; similarity never into the signed confidence value.)
**Sources.** Kanerva, *Hyperdimensional Computing: An Introduction*, Cogn Comput 2009 ([Springer](https://link.springer.com/article/10.1007/s12559-009-9009-8)); Kleyko et al., *Survey on HDC/VSA Part I* ([ACM CSUR 2022](https://dl.acm.org/doi/10.1145/3538531)); [hd-computing.com](https://www.hd-computing.com/).

---

## 6. Sparse distributed memory (Kanerva) & modern Hopfield networks — content-addressable recall
**Principle.** Storage by *content* instead of address, completion from partial cues. SDM: sparse "hard" addresses, write/read in a Hamming sphere around the query. Modern Hopfield: single-shot associative memory, exponential capacity.
**Mechanism (universal Hopfield).** Retrieval = `z = P·sep(sim(M,q))`. SDM: Hamming + threshold + majority counter. Modern: softmax separation. Classic: dot + identity.
**NSAI-Edge transfer (complements retrieval — robust recall).** Complementary to #5: VSA supplies the vectors, SDM/Hopfield the storage/completion mechanism. A noisy/incomplete query (typo, missing object) is pulled onto the nearest stored triple (cleanup) → more robust lexical seeding without stemming heuristics.
**Determinism/zero-dep verdict: YES (SDM/classic) / PARTIAL (modern).** SDM: Hamming (popcount) + integer counter + threshold = fully integer-deterministic. Classic Hopfield with integer weights + fixed update order likewise. Modern (softmax over float dot) → only via the existing fixed-point softmax. **Recommendation: SDM variant**, fits binary VSA.
**Invariant check.** (3) ✅ (SDM/classic, fixed order) / ⚠️ (modern) / (1) ✅ / (8) ✅ cleanup = exact argmin / (4) ⚠️ radius wire-fixed.
**Sources.** Kanerva, *Sparse Distributed Memory* (MIT 1988); *Universal Hopfield Networks* ([PMC7614148](https://pmc.ncbi.nlm.nih.gov/articles/PMC7614148/)); Ramsauer et al., *Hopfield Networks is All You Need* (2020).

---

## 7. Possibility theory / fuzzy / MLN / PSL — alternative uncertainty calculi
**Principle.** Algebras other than the softmax belief: *possibility theory* separates possibility (Π) from necessity (N) — natural for open-world/ignorance. Fuzzy: truth ∈ [0,1] with t-norms. MLN/PSL: weighted first-order formulas → distribution over possible worlds.
**Mechanism.** Łukasiewicz t-norm: T(a,b)=max(0, a+b−1); possibility: N(A)=1−Π(¬A), open-world-capable (Π(A)+Π(¬A) ≥ 1, ignorance allowed). MLN P(world) ∝ exp(Σ wᵢ·nᵢ).
**NSAI-Edge transfer (complements — inference confluence).** In forward chaining, confidences must be *combined*. The **Łukasiewicz t-norm** is ideal: `max(0, a+b−1000)` on per mille — exactly integer, more conservative than multiplication (no artificial certainty). The possibility/necessity pair fits open-world + "never guess": necessity = evidenced lower bound, possibility = not-excluded upper bound → extends confidence from a point to an *interval* [N, Π] (more honest ignorance). **Relation to doc 06: possibility/necessity is a natural representation for "asserted but unevidenced" vs. "evidenced".**
**Determinism/zero-dep verdict: YES (fuzzy/possibility) / NO (full MLN/PSL inference: MCMC/convex optimization, stochastic-float).** Adopt only the *t-norm combination* + possibly *interval confidence*, not the learner.
**Invariant check.** (3) ✅ (t-norm/possibility) / ❌ (MLN-MCMC) / (1) ✅ / (7) ✅ (possibility is built for this) / (5) ⚠️ interval [N,Π] only as a read lens over THE ONE signed value — otherwise the same wire breach as Subjective Logic (already rejected!).
**Sources.** *On the Semantic Relationship between PSL and Markov Logic* ([arXiv:1606.08896](https://arxiv.org/pdf/1606.08896)); *Encoding MLNs in Possibilistic Logic* ([arXiv:1506.01432](https://arxiv.org/pdf/1506.01432)).

---

## 8. Bayesian knowledge tracing / Beta-Dirichlet reputation / Kalman — confidence tracking over time
**Principle.** Track a latent "mastery"/trust probability over noisy observations with Bayes updates (BKT), Beta/Dirichlet counting (reputation) or Kalman filter.
**Mechanism (BKT).** Four parameters P(L₀), P(T), P(G uess), P(S lip). Posterior after correct: `P(L|c)=P(L)(1−S) / [P(L)(1−S)+(1−P(L))G]`. Learning transition `P(L')=P(L|obs)+(1−P(L|obs))·P(T)`. Beta reputation: belief from (α=successes+1, β=failures+1); expectation α/(α+β) ∈ [0,1]. Kalman gain `K=P⁻/(P⁻+R)` (weights measurement against prior by variance — closely related to #1 precision).
**NSAI-Edge transfer (complements — source trust tracking & reinforcement).** BKT is a direct model for the *trust of a signing source*: every confirmed/falsified statement = an "observation" with built-in guess/slip (a correct one could be luck, a wrong one a slip). Beta reputation = the simplest near-integer variant for the trust lens NSAI-Edge already has. Kalman = principled confidence tracking of individual triples (decay = variance grows; reinforcement = measurement with small R).
**Determinism/zero-dep verdict: PARTIAL → YES with fixed point.** All BKT formulas are fractions → integer per mille with fixed rounding. Beta reputation is NATURALLY integer (α, β are counts). Kalman: gain integer-approximable, variance propagation needs a careful fixed-point spec.
**Invariant check.** (3) ✅ / (1) ✅ / (6) ⚠️ counting legitimate only for the trust of ONE source over ITS history, NOT for source voting / (5) ✅ trust is already a local lens / (4) ⚠️ parameters wire-fixed.
**Sources.** [Bayesian Knowledge Tracing (Wikipedia)](https://en.wikipedia.org/wiki/Bayesian_Knowledge_Tracing); Jøsang, Beta Reputation; *Improving Trust Estimation with Beta Reputation* ([arXiv:2411.01866](https://arxiv.org/pdf/2411.01866)).

---

## Top 3 wildest ideas
1. **Holographic triple encoding (VSA/MAP, #5) with SHA-256-seeded bipolar vectors + SDM cleanup (#6).** A *deterministic, zero-dep, integer-only* "embedding" layer — exactly what vector embeddings were deferred for — CRDT-convergent, because the same term from the same seed produces the same vector across nodes. The rare case that passes *all* hard invariants.
2. **Evidence accumulation to bound as maturity semantics (#3, deterministic skeleton without noise).** Claims have an integer evidence level that accumulates trust-weighted up to a threshold — "contested → decided" becomes an explainable state transition instead of a snapshot softmax.
3. **Possibility/necessity interval confidence [N, Π] (#7).** Instead of a point per mille an integer interval: necessity = evidenced lower bound, possibility = not-excluded upper bound — makes open-world + "never guess" visible *in the confidence type itself* (read lens only, otherwise wire breach).

## Which ONE alternative architecture would change the most — and is it worth it?
**Vector symbolic architectures / hyperdimensional computing (#5).** It would change the most because it places a *completely new representation layer* next to the triple (holographic vector signature, similarity/cleanup stage, analogy via unbinding) — capabilities the lexical+PPR+BM25 stack structurally does not have. **And it is worth it, unusually clearly YES**, because VSA is the only one of the eight that passes *all* hard invariants simultaneously (determinism via integer+SHA seed over the existing `node:crypto`, zero-dep, offline, CRDT convergence, "count never counts"). The deferred vector embeddings were rejected precisely because of determinism/zero-dep — VSA resolves both blockers. Main risk: bundling capacity limits (crosstalk) + the obligation to fix all thresholds/dimensions as wire constants.

> *Agent's note:* Several original PDFs (Friston FIL 2009, Kanerva Redwood 2022, ACT-R CMU) were scanned/binary; formulas verified via parseable secondary sources (cross-checked multiple times).
