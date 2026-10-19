# Retro-ADR 0012 — Trust-quorum endorsement (NSAI-Edge Slice #M.1)

**Status:** completed · autonomous + self-merged (PR #12) · three adversarial audit rounds
**Date:** 2026-05-28
**Purpose:** Retrospective of the first slice under Stefan's clarification „weg von plumpen Halluzinationen, hin zu menschenähnlichem Gedächtnis mit Stärken aber ohne Schwächen". Multi-source consensus reinforcement as a deterministic trust quorum.

## Context
Stefan's question at the start: „Wenn man etwas mehrfach hört, sollte das nicht die Glaubwürdigkeit erhöhen?" → triggered the realization that the current NSAI-Edge model deduplicates `triple_hash` origin-independently and knew **no** consensus reinforcement. Subjective Logic (Jøsang) as frame, but Stefan's constraint „kategorische Verdikte, keine Wahrscheinlichkeit" → trust quorum instead of probabilistic fusion.

## CDP5-checked architecture decisions
- **Subjective Logic frame adopted, probabilistic output discarded.** A categorical verdict (`supported`/`contradicted`/`unknown`) remains the only API end product — internal aggregation in per-mille×tier scale, but never exposed as a float probability.
- **Schema additive** (new table `triple_endorsements`, optional `peers.cluster_id`) — `knowledge_edges` stays single-row per hash for `_edgeToWire` consumers that do not know the concept. Wire contract/PHP parity intact.
- **Cluster-independence filter manual in #M.1** — dynamic inference deferred to #M.2, because an automatic cluster detector would bring more risk (guilt by association) here than benefit.
- **Echo protection structural** via max-per-cluster (not sum) — formally clean, deterministic, auditable.

## Decision chronicle
- **E1** — Web research RAG-2026 + Subjective Logic frontier + Sybil defense (FoolsGold/FedSybil) + wisdom of crowds. Insight: our existing architecture is *closer* to the RAG-2026 winner patterns than I thought (HippoRAG 2 = our PPR, signed + deterministic).
- **E2** — Konzept-first UC-MS (Konzept = concept document) with research anchors, AC table (12 ACs), value range cited from §B, aggregate formula formal, residual-risk notes (cluster, federation race).
- **E3** — konzept-reviewer 8.4 → three 🔴 (aggregate formula sharpness, cluster residual risk, federation race path) all closed on the documentation side + three additional ACs (15.13–15.16). Glossary extended.
- **E4** — Implementation TDD: schema, `_quorumFor`, `endorseTriple`, `endorsementsFor`, `_clusterIdOf`, `verify` quorum path, MCP tools.
- **E5** — Adversarial audit round 1: **NO.** Three hard 🔴:
  - 🔴-1 Status conjunction: `_quorumFor` did not check `local_status` → a retracted edge kept reporting `supported`. **A real hallucination source.**
  - 🔴-2 Double supported: the verify quorum short-circuit ignored resolveBelief competition → several objects simultaneously `supported` for single-value predicates = confabulation.
  - 🔴-3 as_of drift: `_quorumFor` ignored UC-BT — historical queries saw future endorsements.
- **E6** — Fix round 1: `_quorumFor(hash, {as_of})` with a double visibility clause (active + UC-BT). verify quorum path with resolveBelief conflict check. Plus 🟡-1 (conformance.mjs mirror), 🟡-2 (empty cluster string). 5 regression tests.
- **E7** — Adversarial audit round 2: **NO.** New 🔴 multiValue path: `hat_tag rot` + quorum endorsement → `hat_tag blau` was wrongly `contradicted`/`contested`. The standard spec has 8 multiValue predicates → would have been triggered in production.
- **E8** — Fix round 2: multiValue guard in both verify quorum branches. Plus 🟡-B (`|| true` dead branch removed), 🟡-C (`_tick()` out of endorse — no VC in the schema, was a side-effect bug). 🟡-A (self-endorsement residual risk) as a note in KONZEPT.md.
- **E9** — Adversarial audit round 3: **safe YES.** Three small 🟡 doc/hardening notes (no block). Empirically verified: multiValue fix clean, _tick removal without side effects on VC paths, status conjunction stays sharp for retracted/quarantined/superseded.
- **E10** — Self-merge PR #12.

## Process lesson (core)
**Three audit rounds were necessary — and EVERY round found something the previous one had overlooked.**

- Round 1: 3×🔴 — status, double truth, as_of lens. Classic case of "new path without interaction check".
- Round 2: 1×🔴 — multiValue path. I had honored multiValue in resolveBelief but **forgot** it in the new quorum path. Sycophancy lesson: a confirming reviewer would never have found the multiValue gap, because the 13 AC-15 tests were green — but they only tested single-value constellations.
- Round 3: safe YES.

**Lesson:** when a new read path overlays existing semantics (status, valid time, multiValue), ALL three must be explicitly played through as ACs+tests. It is not enough that "the system already knows `hat_tag` is set-valued" — the new path does not know it by itself.

**Stefan's clarification was more valuable than any reviewer:** „weg von plumpen Halluzinationen" set the exact threshold at which findings became 🔴 instead of 🟡. The dangerous behavior (retracted edge reports supported, multiValue reports contradicted) is CONCRETELY Stefan's defined hallucination — not a theoretical drift, but a breach of the declared constraint.

## Substantive lesson
**Trust quorum with max-per-cluster is the right pattern for "consensus without echo".** Three confirmations from the same source = 1 cluster = 1 contribution. Three from different clusters = 3 contributions. Sybil neutralized via `trustRank(untrusted)=0`.

**Open world is defended:** neither the triple without endorsements (`unknown`) nor the triple with retracted status (`unknown`) nor an `as_of` query before the endorsement (`unknown`) leaks a probabilistic statement. The verdict stays categorical.

**multiValue is a special case that must be explicitly codified.** Open world means for set-valued predicates: absence of a specific tag is `unknown`, not `contradicted`. Sibling tags are not a conflict.

## Open
- **Slice #M.2 (deferred):** dynamic cluster inference (endpoint suffix, key issuer, behavioral similarity). Until then `peers.cluster_id` stays manual.
- **Trust decay:** bad behavior erodes trust_level over time (Slice #M+).
- **Endorsement revocation:** explicit withdrawal of an endorsement as its own wire type (Slice #M+).
- 🟡 notes from round 3 (clarification docs in the KONZEPT, optional hardening test for _tick stability) — backlog.
