# Nature, Cognition & Alternatives — Synthesis & Feature Catalog

> **Exploration batch 2026-05-29** for NSAI-Edge. **No CDP5 binding** — deliberately broad, web-sourced raw material *for* the Konzept (concept document), **not** the Konzept itself. Model: `docs/Exploration/NotebookLM`. Produced via 6 parallel research agents (interdisciplinary) that knew the tool and the already evaluated §I candidates and were meant to work *beyond* them. Invariant violations are **flagged, not filtered**.
>
> Trigger: "explore new features like a human / like other animals / with alternative solutions" + three deep dives requested by Stefan (lie/truth/fiction, "replace TrustLevel?", categorical thinking & the "These").

## The six lenses
| # | File | Lens | Strongest contribution |
|---|---|---|---|
| 01 | [Human Memory](01-Menschliches-Gedaechtnis.md) | neuro/cognition | two orthogonal axes (storage/retrieval), sleep phase, RIF, reconsolidation, metamemory |
| 02 | [Swarm & Animal Intelligence](02-Schwarm-und-Tierintelligenz.md) | collective intelligence | bee cross-inhibition (value-sensitive belief), stigmergy retrieval, Physarum pruning, CRISPR |
| 03 | [Trust, Immunity, Deception](03-Vertrauen-Immunitaet-Taeuschung.md) | evolution/immunology | danger-theory quarantine, Treg governor (over-quarantine brake), defector tracking |
| 04 | [Alternative Thinking Architectures](04-Alternative-Denk-Architekturen.md) | KR/theoretical neuro | **VSA/HDC** (the only candidate that passes ALL invariants), predictive coding, t-norms |
| 05 | [Distributed Coordination & Human-Agent UX](05-Verteilte-Koordination-und-Mensch-Agent-UX.md) | distributed systems + HAI | hash DAG (Sybil-immune + formal "count never counts"), **human↔agent UX gap** |
| 06 | [Lie/Truth/Fiction & Epistemic Mode](06-Luege-Wahrheit-Fiktion-und-epistemischer-Modus.md) | epistemology/logic | **three orthogonal axes** (provenance/truth/mode), These, Kant, Tarski |

---

## Convergent cross-cutting themes (hit *independently* by several lenses — the strongest signal)

1. **Two orthogonal memory axes.** Storage vs. retrieval strength (Bjork), ACT-R base-level activation, FSRS-DSR — three lenses (01/04/05) independently arrive at: `confidence` (signed, ~truth claim, only rises) vs. a local `activation`/retrievability lens (decays). **Confirms and grounds the already evaluated §I candidate E4** with three convergent theories.
2. **Three orthogonal *knowledge* axes.** Provenance authority (TrustLevel — correct) · truth value (never internally decidable, only approximable) · assertion mode (asserted/assumed/necessary/fictional). Lens 06, supported by 01 (source monitoring, verbatim/gist). **The central new result** — see doc 06.
3. **"Count never counts" gets a *formal* foundation.** Bee cross-inhibition (max-like, 02), hash-DAG independent roots + diversity prediction theorem (05), image-scoring caveat (03), VSA similarity ≠ confidence (04) — four ways to turn the invariant from a resolution into a *computable* property (independent roots instead of source count).
4. **Surprise / prediction error as the update gate.** Reconsolidation PE gating (01) + predictive-coding precision (04) converge: belief changes in proportion to precision × surprise — small deviation → reinforce, large → revision; anti-flapping built in.
5. **Offline consolidation ("sleep phase").** Sharp-wave replay (01) as the batch carrier for episode→semantics promotion, RIF cleanup and re-inference — decouples expensive operations from the online path (determinism-friendly).
6. **Immune architecture in two layers + brake.** Restriction-modification (innate, cheap) + CRISPR spacers (adaptive, learned) as entry/memory defense (02/03), danger theory instead of self/non-self, Treg governor against over-quarantine (03).
7. **Retrieval as an adaptive, usage-driven system.** Stigmergy pheromone layer (02) + Physarum topology pruning (02) + ACT-R spreading-activation buffer (01/04) — retrieval paths strengthen through use, dead knowledge sinks (without deletion).
8. **The human↔agent UX layer is missing entirely.** Transactive memory, curation transparency, categorical confidence presentation, proactive reminding (05) + belief categories from categorical perception (06). Cheap (read/presentation layer), high trust gain.

---

## Feature catalog (natural model/theory → NSAI-Edge lever)

Column "Inv." = rough invariant compatibility (✅ safe / ⚠️ with conditions / 🔴 breaks a hard invariant, raw material only). "Roadmap" = relation to existing §H/§I candidates.

| Model | NSAI-Edge lever | Inv. | Roadmap relation |
|---|---|---|---|
| ACT-R / Bjork / FSRS | `activation` axis next to `confidence` (storage/retrieval) | ✅ | **E4** (two decay axes) — grounded |
| Kant modality + Searle/Lewis | `assertion_mode` {problematic/assertoric/apodictic} + `suspended` | ✅ | **new** |
| de Kleer ATMS + Lewis | `world`/`context` scopes (fiction/hypothesis isolated) | ✅ | **new** |
| Tarski + theories of truth | multi-signal `verify()` {korrespondenz, kohaerenz, konsens} | ✅ | extends UC-V |
| Frankfurt "On Bullshit" | `truth_orientation` flag (llm = truth-indifferent, no promotion to fact without corroboration) | ✅ | extends source_type |
| "These" / Toulmin / Dung | `epistemic_status` + `supports`/`rebuts` edges | ✅ | **A1** (defeasible) — supplies the UC need |
| Aristotle A/E/I/O | `quantity`/`polarity` (falsifiability, closed-world islands) | ✅ | extends UC-V |
| Rosch / categorical perception | belief categories as a projection of confidence (vouched/…/doubtful) | ✅ | UX, cf. B5 |
| VSA / hyperdimensional computing | holographic triple vectors (SHA seed, integer), cleanup retrieval, analogy via unbinding | ✅ | **replaces the E3 need**, complements B1 |
| Sparse distributed memory | content-addressable, typo-robust recall | ✅ | complements B1/retrieval |
| Bee cross-inhibition | value-sensitive belief resolution (rival damping, pitchfork) | ⚠️ | replaces/extends UC-12 |
| Quorum Hill response | sigmoid quorum threshold (evidence strength, not count) | ⚠️ | extends UC-MS |
| Stigmergy pheromone | usage layer on edges (retrieval ranking, evaporates) | ⚠️ | extends UC-HR (PPR) |
| Physarum | topology pruning → cold-storage tiering (no delete) | ⚠️ | **new** (scaling) |
| Reconsolidation / predictive coding | PE-/precision-gated belief update | ⚠️ | extends UC-12/TMS |
| Sharp-wave replay | idle "sleep phase": batch consolidation + re-inference | ⚠️ | bundles UC-EP + inference |
| Retrieval-induced forgetting | active suppression of outvoted competitors (activation) | ⚠️ | extends decay/UC-12 |
| Matzinger danger theory | danger score instead of foreign→quarantine | ⚠️ | extends UC-05 |
| Regulatory T cells | Treg governor (over-quarantine brake, meta control loop) | ⚠️ | fits **E1** meta-cognition |
| CRISPR spacers + RM | two-stage immune defense (innate + adaptive pattern memory) | ⚠️🔴 | extends UC-05/UC-09 (censorship risk!) |
| Vampire-bat reciprocity | dyadic reciprocity balance for trust adjustment | ⚠️ | extends **6.1** (trust adjust) |
| Hash DAG (Kleppmann) + diversity theorem | causal hash DAG: Sybil-immune + "independent roots" = formal "count never counts" | ⚠️ | extends UC-08/UC-MS, cf. C3 |
| Merkle search tree | O(log n) anti-entropy + 1-hash health fingerprint | ✅ | extends UC-06/07, cf. E2 |
| Transactive memory (Wegner) | "who-knows-what" responsibility index + routing | ✅ | **new** (UX/federation) |
| Forgetting-by-design | tombstone triples + crypto-shredding + forgetting audit | ⚠️ | **new** (privacy/GDPR) |
| Proactive reminding (extended mind) | conflict early warning on context entry | ⚠️ | **new** (UX) |
| Clonal selection | generative reconciliation hypotheses (self-critique) | 🔴 | extends UC-SC (flag strongly) |
| REM "dreaming" | hypothesis sandbox from distant edges | 🔴 | **new** (sandbox only) |

---

## Prioritization heuristic (for the later Konzept, not binding)

- **Invariant-safe quick wins (✅, hardly any Konzept risk):** `assertion_mode` + `world` scopes (doc 06, levers 1+2) · belief-category projection (B5/Rosch) · multi-signal `verify()` · VSA retrieval layer (doc 04 — the "rare direct hit") · Merkle-search-tree anti-entropy · transactive-memory routing. These extend the load-bearing pattern without breaking an invariant.
- **Medium (⚠️, need slice design + possibly adversarial-auditor):** cross-inhibition/Hill quorum (belief path → 🔴 auditor) · danger score + Treg governor · stigmergy/Physarum retrieval · sleep phase · hash DAG (architecture intervention).
- **Deliberately raw material / high risk (🔴):** generative hypotheses (clonal selection, "dreaming") — only in a never-replicated sandbox with endorsement gate · federated shared CRISPR blocklists (censorship/trust-laundering vector) · any "uninformed-ballast" softening of "count never counts".

## What deliberately stays raw material
Several ideas break a hard invariant (flagged with 🔴/❌ in the documents): generative hypothesis guessing (vs. "never guess"), vote/density accumulation (vs. "count never counts"), float paths in the federated wire (vs. determinism), new belief representations in the wire (vs. parity, cf. rejected C2 Subjective Logic). They stand here as **food for thought**, not as recommendations — the Stefan barrier layer (§I.6) and the three-axes principle filter them in the Konzept.

## Connection to the Konzept
This batch is **raw material** (like the NotebookLM reports): only what the Stefan barrier (§I.6) confirms is to be adopted; record what is rejected with reasons (§I.5 pattern, "pushback welcome"). The concrete next step would be — concept-first — a **CDP5 slice concept (UC + AC tables)** for the invariant-safe quick wins, above all the **three-axes model from doc 06** (`assertion_mode` + worlds + multi-signal `verify`), which is what first frames most of the follow-on ideas cleanly.
