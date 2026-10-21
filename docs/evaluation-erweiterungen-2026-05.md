---
title: Scientific evaluation — Extensions for NSAI-Edge
date: 2026-05-29
status: Evaluation dossier (no Konzept delta, no code)
scope: nsai-edge
invarianten-regel: Deviation only with a documented surplus of advantages
---

# Scientific evaluation report — Extensions for NSAI-Edge

**Assignment:** Evaluate sensible, *novel* extensions according to the Konzept (concept document) requirements + CDP5; deviations only with a documented surplus of advantages; scientific, with approaches the system has not yet tried.

**Four core invariants (evaluation yardstick):** zero-dependency · offline autonomy · Node↔PHP fixed-point parity · CRDT convergence.

## 1. Method

Basis: complete reading of `KONZEPT.md` v2.4, engine constants/rule spec, code inventory (269 tests / 19 UCs), all 18 retros, 13 web searches + 4 primary-source fetches (as of 2025/2026). Rating per candidate: novelty, Konzept conformance, effort, risk, value (●●● high · ●● medium · ● low).

**Provenance:** Section 3-E + the refinements in it integrate two NotebookLM reports (2026-05-29), which themselves rest on this dossier + external sources. NotebookLM is an AI source → filtered critically: only points confirmed by the determinism/invariants gate (✅) adopted; rejected/not-applicable points recorded with reasons in §6.1.

## 2. Baseline — already built (do not propose again)

Forward chaining + JTMS retraction (slice 5) · tier-authoritative belief softmax (UC-12) · CRDT max-merge, trust-primary precedence (slice 2) · trust-quorum endorsement, cluster max/FoolsGold (M.1) · personalized-PageRank hybrid retrieval (slice 3) · BM25/FTS5 episodes (R3) · bi-temporality (slice 5) · spaced-repetition decay (6.3) · offline reject-rate trust learning (6.1).

### Structural levers
- **H1 — Shared deterministic power iteration:** the PPR machine (fixed summation order over `triple_hash`) also carries EigenTrust (C1).
- **H2 — `user_rejected_at` is an unused, confabulation-free training signal:** cleanly separated from system actions (6.1) → the local, exchangeable calibration data set for D1/D2/D3.
- **H3 — "Magic constants":** `contestedThreshold=150`, `quorumAuthFloor=4500`, `quarantineThreshold=300`, `beliefSharpness=3`, `demote*Threshold` are hand-set → data-driven, guaranteed-calibrated replacement possible.

## 3. Candidates per dimension

### A — Reasoning & inference
- **A1 Defeasible argumentation (grounded extension, ASPIC⁺/Dung-light)** — rebut/undercut as attack graph, grounded extension (unique, polynomial; arXiv 2309.12731). Conformant (local lens). Novelty ●●● value ●● effort ●●●. Medium priority, most likely as an explanation layer over resolveBelief.
- **A2 Abductive backward chaining** — on `unknown`, output minimal missing premises as *hypotheses* (quarantined); deterministic, open-world-safe (arXiv 2510.11462, 2512.07218). Conformant. Novelty ●●● value ●●● effort ●● risk ●. **Strong candidate.**

### B — Retrieval & memory
- **B1 Embedding-free semantics via PMI/SOC-PMI** — sparse PPMI from triple co-occurrence + episode terms; deterministic, zero-dep, local lens like PPR/BM25 (SOC-PMI; arXiv 2007.13273). Closes deferred alias/stemming/slice 3b. Novelty ●●● value ●●● effort ●●. **Top retrieval.**
- **B2 Schema abstraction / rule induction** — frequent-pattern mining → proposed rules; only as a proposal mode (confabulation risk). Novelty ●● value ●● risk ●●●. Lower priority.

### C — Federation & trust
- **C1 EigenTrust lens (transitive trust)** — power iteration over the endorsement graph, seed-anchored at the local pre-trust → stays a local read lens, CRDT untouched; reuses H1 (Stanford EigenTrust; EigenTrust++ 2012). Conformant with all 4. Novelty ●●● value ●●● effort ●●. **Top federation.**
- **C2 Subjective logic / evidence-theoretic fusion** — opinion ⟨belief,disbelief,uncertainty⟩, explicit ignorance mass; changes the belief representation → real deviation (parity/output costs). Advantage does **not currently** outweigh. Defer.

### D — Learning & self-calibration
- **D1 Conformal prediction for `verify()`** — `user_rejected_at` (H2) as calibration set; threshold = ⌈α(ℓ+1)⌉-smallest nonconformity score; set-valued, categorical verdict with coverage guarantee; deterministic, integer-capable (arXiv 2510.24754, 2605.08077). Replaces H3 constants in principle. Conformant with all 4. Novelty ●●● value ●●● effort ●●. **Strongest overall candidate (flagship).**
- **D2 Self-calibrating temporality** — learn the decay class from the observed churn rate. Auflage (condition): `temporality` is a signed wire field → conformant only as a **local `effective_temporality` lens**. Novelty ●●● value ●● effort ●●. Second wave.
- **D3 Calibrated active learning** — rank contested/quarantined by uncertainty × PPR influence; proposes the most information-rich review first (arXiv 2510.03162). Conformant, read-only. Novelty ●● value ●● effort ●. Closes the loop.

### E — Cross-cutting dimensions (from NotebookLM directions)
- **E1 Meta-cognition / self-monitoring (umbrella)** — calibration drift monitor (Brier/ECE on integer per-mille) compares belief against `user_rejected_at` ground truth; triggers re-calibration (D1) / review (D3). mcp-doc-drift-gate = structural variant (Zylos 2026; ASU Neuro-Symbolic Metacognition; Metagent-P ACL 2025). Conformant. Novelty ●●● value ●●● effort ●●. **Narrative centre.**
- **E5 MCP governance / policy enforcement** — declarative Cedar-like policy over MCP tools: egress approval for pull/push/clone, parameter caps (term length, deferred 0015), rate limits/DoS (DX Heroes 2026; NSA CSI MCP; arXiv 2604.05969, 2511.20920). Conformant, zero-dep feasible. Novelty ●●● value ●●● effort ●●. **Security track.**
  - **Refinement (NotebookLM ✅) — Deterministic gate as tool-call interceptor.** Pull security constraints out of the volatile LLM context into a *persistent interceptor layer* (CSL-Core idea) that checks tool calls deterministically against ALLOW/BLOCK/ESCALATE before execution + logs them completely (auditability). `mcp-doc-drift-gate` is the structural variant. **Implementation zero-dep** (own small policy eval), no heavy DSL runtime.
  - **Refinement (NotebookLM ⚠️) — Formal policy verification ONLY at build/CI time.** SMT solvers (e.g. Z3) may prove the policy once *before deploy* for consistency / reachability of every ALLOW path / freedom from conflict (no input triggers ALLOW+BLOCK) — analogous to the conformance gate. **At runtime evaluate only the compiled, deterministic allow/block table.** An SMT solver at runtime would break zero-dep → excluded.
- **E2 Cross-language determinism (phase-2 anchor)** — RFC 8785 JCS as normative reference for Node↔PHP byte identity + MET-like CRDT permutation tests (RFC 8785; CBOR Determinism; MET arXiv 2204.14129). Hardening anchor, no deviation. **NotebookLM ✅ confirmed:** security-relevant events (e.g. a gate event) propagate with strong eventual consistency; commutative/associative/idempotent has been fulfilled since slice 2 (UC-08) — serialisation conformance is the only open point and is anchored exactly here.
- **E3 Vector embeddings (controlled deviation)** — *after* B1, if recall is insufficient: only agent-side outside the core, deterministic cache, deliver only candidates (core verifies), never in wire/signature/belief (hybrid pattern WJAETS 2025; OLIVE 2025). Deviation justified only under these three Auflagen (conditions).
  - **Refinement (NotebookLM ✅) — "So what?" layer / VectorOWL pattern.** The vector search is a pure *candidate generator*; a semantic validator checks every candidate against the existential graph invariants **before** a state change is committed — in NSAI-Edge this validator is simply `verify()`. Deterministic embedding caching prevents repeated probabilistic alias evaluation. That is the clean separation "probabilistics proposes, determinism decides".
- **E4 Two orthogonal decay axes** — explicitly separate the epistemic axis (volatility → rate, = D2) from the retention axis (retrieval → memory strength, FSRS-like; FadeMem arXiv 2601.18642); neither axis lifts the belief/authority path. Sharpens the latent mixing in 6.3.
  - **Refinement (NotebookLM ✅) — Promotion gate episodic→procedural.** Knowledge moves from the volatile (episodic, fast decay) into the permanent (procedural) memory only when it has received a **formal grounding** — i.e. `verify()` returns `supported`. This way the long-term memory prevents belief inflation through mere retrieval frequency; the promotion is coupled to a deterministic verification proof, not to frequency.

## 4. Deviation ledger

| Candidate | Invariant | Deviation? | Surplus of advantages? |
|---|---|---|---|
| A1, A2, B1, C1, D1, D3, E1, E2, E5 | — | No (local lens / read-only / anchor) | conformant |
| B2 Schema induction | "never guess" | Yes, if auto-asserted | only as proposal mode |
| C2 Subjective logic | Parity + output | Yes (new representation) | NO, not currently |
| D2 / E4 retention | Fixed-point signature | Yes, if wire field is mutated | only via local lens |
| E3 Embeddings | zero-dep + determinism | Yes (dep + probabilistics) | only contained (agent-side, cache, candidates only) |

**Lesson:** The most valuable candidates (D1, C1, B1, A2, E1, E5) need **no** Konzept deviation — they extend the load-bearing pattern "trust/belief/temporality = local read lenses over the convergent wire value".

## 5. Prioritised synergy roadmap

1. **E1 Meta-cognition (umbrella) + D1 Conformal** — self-monitoring calibration
2. **C1 EigenTrust lens** — transitive trust, reuses H1
3. **E5 MCP governance** — security track, bundles deferred caps
4. **A2 Abduction + B1 PMI** — reasoning/retrieval substance
5. **D3 Active learning** — data cycle (feeds E1/C1)
6. *(2nd wave)* E2 phase-2 anchor · D2/E4 two decay axes · A1 argumentation explanation
7. *(conditional/deferred)* E3 embeddings (contained, after B1) · C2 subjective logic · B2 auto-schema

Synergy cluster D1+D3+C1+E1 runs on *one* signal (H2) and *one* machine (H1).

## 6. Anti-patterns (deliberately NOT)
- No ML embeddings in the core (B1 is the conformant substitute; E3 only contained).
- No mutation of signed wire fields (`temporality`/`asserted_at`/`asserted_confidence`) — self-calibration only as a local lens.
- No numeric belief/quorum values in the output — conformal verdicts stay categorical.
- No auto-assert of learned rules (B2) — proposal mode only.

### 6.1 Filtered out of NotebookLM — rejected / not applicable
- **❌ SMT solver (Z3) at runtime** — external dependency, would break zero-dep. Permissible only as a build/CI gate (see E5 refinement).
- **❌ PN counter (CRDT) for trust/belief** — an up/down counter is exactly the count inflation the system is designed against (guardrail "count never counts"; echo-chamber neutralisation M.1; Sybil protection). At most for a *non-epistemic* resource metric, never for trust.
- **❌ OAuth proxy via Cloudflare Workers/KV (DCR problem)** — Konzept scope "Not included: cloud hosting"; the MCP server is local (stdio), no OAuth/DCR problem. Only relevant for a hypothetical remote-authenticated MCP server (not planned).
- **❌ "FF layers as key-value memories / residual connection"** — describes transformer internals of an LLM, not the symbolic SQLite engine. Category error, do not carry in the Konzept.
- **⚠️ Unsubstantiated figures** (e.g. "instruction drift 8–12 %") — treat only as a "reported order of magnitude", never cite as fact; otherwise one imports exactly the confabulation the system is built against.

## 7. Recommendation
Flagship **D1 (Conformal)** under the umbrella **E1 (meta-cognition)**. Next step (if desired): CDP5 Konzept delta (UC + AC tables) for D1/C1/A2 — no code without Konzept-first.

## Sources
- Defeasible Reasoning / KG: https://arxiv.org/pdf/2309.12731 · https://arxiv.org/html/2510.11462 · https://www.arxiv.org/pdf/2512.07218
- Conformal / calibration: https://arxiv.org/html/2510.24754 · https://arxiv.org/html/2605.08077 · https://www.arxiv.org/pdf/2510.03162
- EigenTrust: https://nlp.stanford.edu/pubs/eigentrust.pdf · https://faculty.cc.gatech.edu/~lingliu/papers/2012/XinxinFan-EigenTrust++.pdf
- PMI / embedding-free: https://www.researchgate.net/publication/228615350 · https://arxiv.org/pdf/2007.13273
- Subjective Logic / DST: https://arxiv.org/html/2508.08075
- Memory/Decay: https://arxiv.org/pdf/2601.18642 · https://arxiv.org/pdf/2603.14517
- Meta-cognition: https://zylos.ai/research/2026-03-14-metacognition-ai-agent-self-monitoring-adaptive-control/ · https://neurosymbolic.asu.edu/metacognition/ · https://aclanthology.org/2025.findings-acl.1169.pdf
- MCP governance: https://dxheroes.io/insights/mcp-governance-landscape-early-2026 · https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf · https://arxiv.org/pdf/2604.05969 · https://arxiv.org/pdf/2511.20920
- Cross-language determinism: https://www.rfc-editor.org/info/rfc8785/ · https://cborbook.com/part_2/determinism.html · https://arxiv.org/pdf/2204.14129 · https://www.arxiv.org/pdf/2511.22010
- Hybrid neuro-symbolic / embeddings: https://wjaets.com/sites/default/files/fulltext_pdf/WJAETS-2025-0491.pdf · https://journals.sagepub.com/doi/10.1177/15705838251329268
