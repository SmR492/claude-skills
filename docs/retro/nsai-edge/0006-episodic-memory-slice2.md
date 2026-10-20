# Retro-ADR 0006 — Episodic memory (NSAI-Edge Slice #2)

**Status:** completed (adversarial safe YES) · branch `nsai-edge-episodic-slice2`, PR open
**Date:** 2026-05-27
**Purpose:** Retrospective of the second §H roadmap refinement: the episodic layer (NS-Mem) — raw experiences + consolidation — and the first integration of web research into the Konzept phase (Konzept = concept document).

## Context
User: continue in the same CDP5 loop after Slice #1 (TMS). Additional requirement during the phase: **include web research in the Konzept phase, evaluate several solutions, but always validate** (web solutions can carry dangers). Goal anchor unchanged: NSAI-Edge as "brain" (raw experience → condensed knowledge with provenance).

## Decision chronicle
- **E1 — Konzept-first UC-EP:** local/peer-private episodic layer (`episodes` + `episode_triples`), consolidation = provenance link + recency refresh, **no** count boost (guardrail/A4). lint 10/10; konzept-reviewer **7.8/10** → 🔴/🟡 incorporated (status independence of the links, orphaned-link handling, atomicity, recency AC, glossary).
- **E2 — Web validation (new requirement):** source comparison (NS-Mem, FadeMem, ACT-R memory, SSGM, memory-poisoning literature). Confirmed: episodic/semantic + provenance/audit + recency + federation isolation. **Deliberately not adopted:** access frequency into the belief (collides with the guardrail → only a belief-neutral GC option, deferred). **Risk anchored:** recall `content` = untrusted data (memory-poisoning injection vector).
- **E3 — Implementation TDD:** additive schema (IF NOT EXISTS, no rebuild migration), `recordEpisode`/`storeTriple+episode_id`/`recallEpisodes`/`episodesForTriple`/`episodicGc`, MCP tools. 102/102.
- **E4 — Adversarial review: safe YES + 1 🟡.** All security/federation/data-loss axes robust (incl. proof: the episode-existence guard is load-bearing — without it an FK violation would roll back the triple write). Correctness bug: `recallEpisodes` escaped `%`/`_`, but the `LIKE` had no `ESCAPE` clause → special-character terms silently empty. Fixed + regression test. 103/103.

## Process lesson (core)
**Web in the Konzept phase = state of the art + risk catalog, but validation against the project guardrails is mandatory.** The research (FadeMem) would have tempted us toward frequency-weighted belief — directly against Stefan's „Aktualität statt Anzahl". The critical separation (frequency may modulate retention/GC, NEVER the belief) resolved the conflict instead of importing it. And the poisoning literature delivered a concrete threat-model note (recall = untrusted data). → [[feedback-websearch-in-concept-phase]].
Second lesson (repetition, confirmed): the **ASCII-only test case** hid the LIKE-escape bug — the adversarial review found it via special-character inputs. [[feedback-green-tests-bypass-security]].

## Substantive lesson
Clean layer separation pays off: because episodes are **local/peer-private** (not in the wire), the whole federation/CRDT/signature axis is untouched by construction (bit-identical wire with/without episode link proven) — and peer poisoning of the episodic layer is ruled out. An FK on `episodes` (CASCADE), but deliberately **none** on `edges` (GC freedom) + defined orphan handling.

## Open
- Slice #2b: LLM extraction from `content` (agent task); access-frequency-aware GC retention (belief-neutral).
- §H roadmap: Slice #3 hybrid retrieval (GraphRAG) — this is where fuzzy/similarity-based episode and triple search comes in.
- PR merge (human).
