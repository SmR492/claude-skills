# Retro-ADR 0003 — NSAI-Edge as neuro-symbolic memory

**Status:** completed (iteration) · PR #1 not merged
**Date:** 2026-05-27
**Purpose:** Retrospective of the loop "NSAI-Edge = my memory": knowledge ingestion (wiki+backup+traces), deep extraction, multi-value predicates, operating model.

## Context
Stefan: NSAI-Edge becomes the **primary knowledge store** instead of wiki/traces — „es ist dein Gedächtnis und soll so funktionieren". Everything discussed/programmed/decided belongs in it; for a project question NSAI must deliver the right answer (or the way to it). Requirement: **Konzept-first** (Konzept = concept document; traceability), then the CDP5 loop.

## Decision chronicle
- **E1 — Migration (1:1 structural):** 195 files (wiki 100 + brain backup `raw/` 45 + traces 50) → graph. Coverage 195/195, 0 missing.
- **E2 — Deep extraction:** Markdown tables (row→column header→cell) + key-value lines (`**Label:** kurz`) → ~8500 domain facts. NSAI now answers entity/config questions (verified: `KnowledgeNode → tabelle nsai_nodes, Felder …`).
- **E3 — Multi-value predicates:** `hat_tag` and others exempted from belief competition (set-valued, no `disputed`). 71/71 tests green.
- **E4 — Project self-knowledge:** ~22 curated nsai-edge facts (source_type `project`) — model B, trust-primary, maturity 9.53, phase 2, storage location.
- **E5 — Konzept brought up to date (v2.4 §F):** operating model + UC-13 ingestion + slug convention + multi-value + recall>precision documented, lint 10/10.

## Process lesson (core)
**Konzept-first was violated:** multi-value + deep extraction came into being BEFORE being anchored in the Konzept — Stefan called for traceability. Corrected by the follow-up §F. Lesson: even for "obvious" extensions, first the Konzept (one line is enough), then code — otherwise the spec drifts and the loop loses its evidentiary character. → [[feedback-knowledge-into-nsai-edge]]

## Substantive lesson
A knowledge graph stores **relations, not prose**. "1:1" here means: every page + all entities/relations/attributes (structure + tables + key-value) are queryable; the explanatory running text is condensed into structure. Table extraction is recall-oriented — noise is downgraded via confidence/decay/belief, not hard-filtered.

## Open
- The multi-value fix only takes effect live after an **MCP server reload** (the running server has the code state from before) — data correct, only the display still shows `disputed` for `hat_tag`.
- Noise reduction of the table extraction (precision) as its own refinement step if needed.
- The PHP federation counterpart remains phase 2.
