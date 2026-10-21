# Distributed Coordination, Knowledge Dissemination & Human↔Agent Memory UX

> **Exploration raw material** (batch 2026-05-29), web-sourced. **No CDP5 binding.** Strand B (human↔agent UX) is deliberately overweighted — that is where the gaps underexposed in the Konzept (concept document) lie. Purpose: raw material for the Konzept.
>
> **Invariant legend:** (1) zero-dep · (2) offline · (3) determinism · (4) CRDT · (5) local read lenses · (6) "count never counts" · (7) open-world · (8) "never guess".

---

## STRAND A — How knowledge spreads & coordinates in systems

### A1 — Merkle search tree as anti-entropy primitive (instead of naive full-state diff)
**Principle.** A Merkle search tree (MST) is a deterministically balanced, searchable tree whose nodes are addressed by content hash. Two replicas determine in O(log n) round trips *which* triples diverge (same subtree hash ⇒ identical ⇒ skip). Auvolat & Taïani: an MST over CRDT values is itself a state-based CRDT.
**NSAI-Edge transfer (complements pull/push + vector clock).** MST index over the triples (key = canonical S–P–O hash) replaces naive diff with a logarithmic "what are you missing?". The **root hash becomes the 1-word health fingerprint** ("are A and B in the same state? one hash comparison"). Plays together with RFC-8785 canonicalization.
**Invariant check.** ✅ all — explicitly zero-dep, deterministic, CRDT-convergent. Pure gain over naive diff. (Trade-off: tree maintenance costs CPU/memory; overkill for tiny graphs.)
**Sources.** [Merkle Search Trees (Auvolat & Taïani, SRDS 2019)](https://inria.hal.science/hal-02303490)

### A2 — δ-CRDTs: join only delta mutations instead of full state
**Principle.** δ-CRDTs define δ-mutators that return only a small delta fragment (op-based efficiency with state-based robustness).
**NSAI-Edge transfer (complements CRDT merge).** Instead of serializing the whole store on push: only triples new/changed since the last sync as a delta set. Caution: two mutable axes — triple set (well δ-capable) and confidence decay (frequent small changes). Keep decay purely local-deterministic (function of t, not propagated) → avoids a delta flood.
**Invariant check.** ✅ convergence/determinism preserved; ⚠️ only if decay is modeled as propagated state instead of a local read lens (analogy to invariant 5).
**Sources.** [Efficient State-based CRDTs by Delta-Mutation (arXiv:1410.2803)](https://arxiv.org/abs/1410.2803)

### A3 — Equivocation-tolerant / hash-graph-chained CRDTs (BFT without quorum)
**Principle.** Kleppmann: existing CRDTs can be made Byzantine fault tolerant — with **arbitrarily many** Byzantine nodes (Sybil-immune) — by having each operation reference its causal predecessor by hash (hash graph instead of vector clock); equivocation (two contradictory signed ops with the same predecessor) becomes cryptographically detectable.
**NSAI-Edge transfer (complements vector clock + signed triples).** Triples are already signed. Replace/complement the vector clock with a **git-like hash DAG**: each triple references the hash(es) of its predecessors ⇒ (a) tamper-proof causal history, (b) automatic equivocation detection ("node X signed two contradictory versions" → quarantine), (c) MST (A1) becomes the natural anti-entropy layer. Very close to git-like P2P sync.
**Invariant check.** ✅ zero-dep (hash + signature present), determinism, convergence, open-world, **count-never-counts (Sybil-immune!)**; ⚠️ offline: equivocation detection needs the diverging chains to meet *at some point*. (Trade-off: hash DAG heavier than vector clock; history pruning non-trivial — collides with forgetting-by-design B3.)
**Sources.** [Making CRDTs Byzantine Fault Tolerant (Kleppmann, PaPoC 2022)](https://martin.kleppmann.com/2022/04/05/bft-crdt-papoc.html) · [On CRDTs and Equivocation (arXiv:2109.10554)](https://arxiv.org/abs/2109.10554)

### A4 — Epidemic anti-entropy + rumor mongering as two-stage federation dissemination
**Principle.** Demers et al.: **rumor mongering** (SIR epidemic: push new triples aggressively to random peers; interest dies out when only "already known" remains → "removed") spreads fast with little traffic; **anti-entropy** (pairwise full reconciliation, A1/A2) runs rarely and guarantees convergence with probability 1.
**NSAI-Edge transfer (complements pull/push).** An epidemic overlay makes federation *self-organizing*: new high-confidence triples "infect" the network in O(log N) rounds without manual sync; A1 Merkle anti-entropy periodically closes gaps. The SIR "removed" state = natural backoff rule against gossip storms.
**Invariant check.** ⚠️ determinism: the dissemination *path/timing* is probabilistic, the convergence *result* deterministic (CRDT) — FLAG: gossip timing needs seed/logging for reproducibility; ✅ offline, ✅ convergence.
**Sources.** [Gossip and Epidemic Protocols (Montresor)](http://disi.unitn.it/~montreso/ds/papers/montresor17.pdf)

### A5 — Misinfo containment in the federation layer: SIR inoculation & belief-quarantine gossip
**Principle.** False knowledge spreads epidemically just like true knowledge. From epidemiology: **inoculation** (a counter-signal "immunizes" nodes) + selective removal. Here one wants to *slow* dissemination, not accelerate it.
**NSAI-Edge transfer (complements quarantine + verify()).** Make quarantine **federatedly propagable**: when node A detects a refuted fact via verify()/self-critique, it gossips a signed "refutation" triple (monotonic/tombstone-like) that "immunizes" receiving nodes. Because of invariant 6: the refutation convinces not by *quantity* but by *provenance/proof* (reference to the contradicting high-confidence source).
**Invariant check.** ⚠️ invariant 6: containment must not degenerate into majority truth — refutation evidence-borne, not count-borne; ✅ open-world (refutation = new information); ✅ zero-dep. (Risk: censorship via false refutation → keep it signed, justified, itself contestable.)
**Sources.** [Epidemic Algorithms for Replicated Database Maintenance (Demers et al.)](https://swift.sites.cs.wisc.edu/classes/cs739-sp11/blog/2011/02/epidemic_algorithms_for_replic.html)

### A6 — Diversity prediction theorem & bounded confidence as echo-chamber guard
**Principle.** Scott Page's diversity prediction theorem: *collective error = mean individual error − prediction diversity*. Accuracy depends not on *quantity* but on *independence/diversity*. Bounded confidence (Hegselmann-Krause/Deffuant): when only nearby opinions are accepted, diversity collapses → echo chamber, consensus then *worthless*.
**NSAI-Edge transfer (complements multi-source corroboration + MeritRank/EigenTrust).** Multi-source corroboration today counts *confirming sources* — dangerous if they are not independent (two peers that copied from each other = one source). **Provenance diversity metric**: corroboration counts only *independent roots* in the A3 hash DAG (common ancestor ⇒ one source). **This is the precise mathematical form of invariant 6 "count never counts".** Plus **echo-chamber warning signal**: if the provenance diversity of a high-confidence cluster goes toward 0 → downgrade + flag to the human ("high agreement, low independence").
**Invariant check.** ✅ supports invariant 6 *directly* (formal foundation!); ✅ determinism (DAG ancestor analysis); ✅ local read lens.
**Sources.** [Diversity prediction theorem](https://rosettacode.org/wiki/Diversity_prediction_theorem) · [Bounded confidence opinion dynamics: survey (Automatica 2024)](https://www.sciencedirect.com/science/article/pii/S0005109823004661)

### A7 — Stigmergy: the graph as shared environment instead of direct node communication
**Principle.** Heylighen: stigmergy = coordination *through the environment* (traces prompt others to continue the work). Wikis/GitHub/PageRank/folksonomies are human stigmergy.
**NSAI-Edge transfer (framing + feature: stigmergic annotation triples).** Reframe: the federated graph *is* the stigmergic medium for several Claude instances/humans. Feature: **"trace" triples** — low-confidence markers ("this subgraph seems outdated", "corroboration missing here", "this is where I was last active") that prompt other sessions to continue the work (active-learning review becomes stigmergically distributed).
**Invariant check.** ✅ fits CRDT natively (add-only), offline, open-world; ⚠️ trace triples must not pollute belief resolution → own namespace/predicate class, separated from factual knowledge; must expire (decay).
**Sources.** [Stigmergy as a Universal Coordination Mechanism (Heylighen)](https://www.researchgate.net/publication/279058749)

---

## STRAND B — Human↔agent memory interaction & UX (focus)

### B1 — Transactive memory system (TMS): explicit "who-knows-what" Claude↔graph
**Principle.** Wegner (1985): in pairs/teams a shared memory emerges from (a) individual knowledge + (b) **metamemory** — who knows what. "I don't need to know it, I know who/where knows it." Current research: human-AI dyads as a "co-memorising dyad".
**NSAI-Edge transfer (new: metamemory layer / responsibility routing).** Today undifferentiated storage. A TMS layer makes the division of labor explicit: a **domain/responsibility index** ("node X = authority for project Y") + a **routing heuristic** that tells Claude *which subgraph/node* to query instead of globally. Bridge between "query-first" and efficiency: Claude does not need to know everything, only *where* it lies. In federation = MST roots (A1) per domain as "expert addresses".
**Invariant check.** ✅ all (the directory consists of triples itself); ⚠️ open-world: "node X does not know Y" is not a fact → routing must not conclude "Y does not exist" (invariant 8). (TMS failure case: the "who-knows-what" goes stale → the drift monitor should *also* monitor the metamemory.)
**Sources.** [Transactive memory (Wikipedia)](https://en.wikipedia.org/wiki/Transactive_memory) · [Group mind of hybrid human-agent teams (2025)](https://journals.sagepub.com/doi/10.1177/02683962241296883)

### B2 — Google effect / cognitive-offloading calibration: when query-first hurts
**Principle.** Sparrow, Liu & Wegner (2011): whoever expects to be able to retrieve information later remembers *the content worse*, but *the location better* ("digital amnesia"). Offloading lowers load, creates dependence + atrophy. Meta-analysis 2024 confirms.
**NSAI-Edge transfer (policy design for query-first).** Naive "*always* query-first" is exactly the Google effect — Claude offloads everything and adopts every graph hallucination unchecked. **Offloading calibration**: query-first *selectively* on (a) low internal confidence, (b) factual/project-specific claims, (c) drifting knowledge; *not* for stable general knowledge. Mirror image: the graph should signal *how reliable* its retrieval is (B5), so Claude knows how much it may rely on it.
**Invariant check.** ✅ no invariant touched (usage policy); ⚠️ touches invariant 8 positively (less blind adoption = less guessing-by-proxy).
**Sources.** [Google effects on memory: meta-analytical review (Front Public Health 2024)](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2024.1332030/full)

### B3 — Forgetting-by-design: traceable, auditable forgetting in the CRDT
**Principle.** Forgetting must be an intentional, accountable design practice (GDPR, privacy, hygiene). In an add-only CRDT, "real deletion" is hard.
**NSAI-Edge transfer (new: tombstone triples + crypto-shredding + forgetting audit).** (1) **Tombstone as CRDT triple** — deletion is itself signed, convergent knowledge ("triple T revoked on … by …, reason: …"), propagated via A5 gossip; never silently vanish. (2) **Crypto-shredding for PII** — sensitive triples encrypted, forgetting = delete the key (solves A3's "undeletable in the DAG" problem without breaking hashes). (3) **Forgetting audit log** — *why* something was forgotten remains checkable. Relation to the `pii-scan` skill: PII findings → crypto-shredding candidates.
**Invariant check.** ✅ convergence (tombstones = canonical CRDT deletion); ⚠️ crypto-shredding needs a crypto primitive — `node:crypto` built in (no npm), so ✅ but FLAG; ✅ open-world (tombstone = "revoked", not "never existed"). (Tombstones accumulate → GC with stability threshold.)
**Sources.** [Memory Undone (arXiv:2602.21180)](https://arxiv.org/pdf/2602.21180) · [Forget via Key Deletion (arXiv:2603.15033)](https://arxiv.org/pdf/2603.15033)

### B4 — FSRS/spaced repetition as decay model *and* proactive review pattern
**Principle.** FSRS (Anki default since 23.10) models forgetting with **difficulty, stability, retrievability** (DSR), predicts *when* an item will be forgotten in order to review just before. 20–30 % fewer reviews at equal retention vs. SM-2.
**NSAI-Edge transfer (replaces naive decay + proactive review).** The **DSR model is a grounded replacement**: salience = retrievability(stability, t); every corroboration/use raises *stability* (not just additively the confidence) — cleanly explains *why* frequently confirmed knowledge decays more slowly. UX half: the graph proactively suggests "review-due" triples (retrievability below threshold + high importance) → prioritizes active learning *forgetting-curve-optimized* rather than only by uncertainty.
**Invariant check.** ✅ determinism (DSR = closed formula — *if* optimizer parameters are fixed/versioned; the ML optimizer itself reproducibly seeded → ⚠️ FLAG); ✅ zero-dep; ✅ local read lens.
**Sources.** [The fundamental of FSRS (DSR-Modell)](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-fundamental-of-FSRS/8c793cefb3ec361cd6fa6ab8f750e31c3da57e8e)

### B5 — Trust calibration: communicate uncertainty categorically (not as a bare number)
**Principle.** Human-AI trust research: over- AND under-trust are harmful; well-calibrated trust is the goal. **Simple visual/categorical cues prevent over-reliance better than bare numerical confidence** (which even induces overtrust).
**NSAI-Edge transfer (output of verify()/belief; new: categorical confidence lens).** Integer per mille is exactly right internally, but as human output it is precisely the "bare number". A **categorical presentation lens** over the per mille (*vouched / probable / unconfirmed / contested / revoked*). For *contested* or *low-diversity* (A6) triples an explicit **warning flag**, not just a lower number. Human-side implementation of invariant 6: the human sees "contested", not "73 %". **(Coincides with the belief-categories idea from doc 06, strand 3 / categorical perception.)**
**Invariant check.** ✅ purely additive read lens (invariant 5 — no per mille mutated); ✅ determinism (threshold mapping). Pure UX gain without invariant conflict.
**Sources.** [AI Hallucinations: What Designers Need to Know (NN/g)](https://www.nngroup.com/articles/ai-hallucinations/) · [Fostering Appropriate Trust in Human-AI Interaction (ACM)](https://dl.acm.org/doi/10.1145/3696449)

### B6 — Proactive instead of reactive reminding: the graph speaks up unasked
**Principle.** Distributed/extended cognition (Hutchins; Clark & Chalmers) + newer LLM memory architectures: external memory as an active partner that brings in *relevant* knowledge *before* being asked. Purely reactive query-first misses "unknown unknowns".
**NSAI-Edge transfer (new: proactive relevance push + conflict early warning).** On entering a context (file/project) the graph pushes unasked the top-k activated relevant triples — *especially* warnings ("earlier decision X contradicts what you are doing right now", "this fact is review-due", "there is a belief conflict here"). The point at which NSAI-Edge turns from *lexicon* into *colleague with memory*.
**Invariant check.** ✅ determinism (activation scores as a graph function); ⚠️ invariant 8: the push shows only *what exists*, never generates; ✅ offline. FLAG: relevance ranking must not take "count" as a proxy (invariant 6). (Risk of context spam → strict relevance/importance threshold, push only on conflict or high activation.)
**Sources.** [SYNAPSE: LLM Agents with Episodic-Semantic Memory via Spreading Activation (arXiv:2601.02744)](https://arxiv.org/pdf/2601.02744) · [ACT-R-Inspired Remembering/Forgetting in LLM Agents (HAI 2025)](https://dl.acm.org/doi/10.1145/3765766.3765803)

### B7 — Human-AI co-memory: who curates the shared memory? (epistemic risks)
**Principle.** Stages (Rev. Phil. Psych. 2026): *distributed memory* → *AI-curated memory* (the AI *selects/shapes* what is remembered) → *human-AI co-memory*. The leap to *curation* brings risks of distortion, dependence and metamemory loss.
**NSAI-Edge transfer (governance + new: provenance/curation transparency).** NSAI-Edge is *AI-curated* (Claude decides what gets ingested/decayed/quarantined). Risk: the human loses the overview of *what* their memory contains and *who* shaped it. Features: (1) **provenance visible per triple** — "inferred by Claude" vs. "confirmed by the human" vs. "pulled from peer" as a first-class distinction. (2) **Curation diff / memory review** — periodic, human-readable summary "what has changed since last time (new/decayed/revoked)". (3) **human veto/pin** — pin triples as "vouched, do not decay" or reject them.
**Invariant check.** ✅ provenance consists of triples (CRDT-compliant); ✅ open-world; ⚠️ the human "pin/do-not-decay" is a *local* override lens — must not propagate as global truth in the federation (invariant 5). FLAG.
**Sources.** [Remembering with AI: Distributed → AI-Curated → Co-Memory (Rev Phil Psych 2026)](https://link.springer.com/article/10.1007/s13164-026-00815-1)

---

## Top 3 wildest ideas
1. **A3 + A6 together — "truth from the hash DAG, not from the majority".** A git-like causal hash DAG of signed triples makes NSAI-Edge Byzantine-robust *and* Sybil-immune *and* supplies the *mathematical* foundation for invariant 6: corroboration counts only *independent roots* in the DAG. "Count never counts" turns from a resolution into a computable property. Unites vector clock, multi-source corroboration and anti-Sybil in *one* data structure.
2. **B6 — the graph as a proactive colleague with conflict early warning.** Instead of passively waiting for query-first, the graph pushes *contradictions to earlier decisions* unasked on context entry ("you are currently building against ADR-X"). From storage to conscience.
3. **B3 crypto-shredding in the hash DAG.** Forgetting in an undeletable, hash-chained history via key destruction instead of data deletion — the hash history stays intact (convergence!), the *content* becomes irretrievable. Resolves right-to-be-forgotten vs. CRDT add-only vs. tamper-proof history.

## The biggest overlooked UX/coordination gap of NSAI-Edge
**The Konzept treats memory as a database, not as a relationship partner — the metamemory and curation-transparency layer is missing (B1 + B7 + B5).** Cleanly thought through is *what gets stored/synced/verified*, but blank on: **"What happens in the head of the human (and of Claude) when this external memory exists?"** Three coupled gaps: (a) **no "who-knows-what"** (B1) — query-first is globally blind; (b) **curation opaque** (B7) — Claude shapes the human's "memory" without a window/veto; (c) **uncertainty as a number instead of a category** (B5). The punchline: all three are *cheap* (pure read/presentation layers, hardly any invariant conflict) and deliver a disproportionate trust/usability gain. The heavy distributed machinery is of little use if the human cannot trust the memory in a *calibrated* way and does not know *what* is in it and *who* shaped it.
