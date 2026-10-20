# Retro-ADR 0015 — FTS5+BM25 full-text search in episode recall (NSAI-Edge Slice #R3)

**Status:** completed · autonomous + self-merged (PR #15) · 2 adversarial audit rounds
**Date:** 2026-05-28
**Purpose:** Retrospective of a slice in which the choice of the database extension was **critically evaluated** — Stefan had explicitly shared two Gemini snippets as a basis for discussion with the request „bewerte es aber bitte vorher". That is exactly the memory pattern "external AI drafts are only starting material".

## Context
RAG-2026 pattern: BM25 as the minimum viable baseline for retrieval. Stefan shared two SQLite code snippets (FTS5 MATCH + recursive-CTE graph traversal) with the request to evaluate them BEFORE adoption. Result: only one of the two snippets was adopted — and even that only with substantial adaptation.

## CDP5-checked architecture decisions
- **FTS5 only on `episodes.content`** — real full text (1–8000 characters) benefits from BM25 ranking. `knowledge_nodes.name` (atomic identifiers like `EU-KI-VO`) stays LIKE — whole-token identifiers do not warrant FTS5.
- **Recursive CTE deliberately NOT adopted** — it would reset our deterministic BFS order (#R1), the status conjunction (#M.1) and the UC-BT read lens (#5d). Four slices of hardening would be lost.
- **Vector embeddings deliberately NOT** — determinism break. 2026 benches show: BM25 even beats text-embedding-3-large.
- **Phrase-quote sanitization** — every token after the allowlist filter is wrapped in `"token"`. Structurally protects against textual FTS5 operators (AND/OR/NOT/NEAR).

## Decision chronicle
- **E1** — Stefan shares Gemini snippets, demands evaluation before adoption. Snippet 1 (recursive CTE) discarded with 6 reasons (determinism, status, UC-BT, performance, maintainability, directed vs. undirected). Snippet 2 (FTS5 MATCH+BM25) adopted as a pattern, with mandatory sanitization.
- **E2** — Empirical pre-check: FTS5 available in `node:sqlite`. Hyphenated identifiers need special handling (phrase mode). The trigram tokenizer has a 3-character minimum (does not match `KI`). Unicode61 with tokenchars+`-` keeps whole tokens — but substring match on whole tokens does not work. **Consequence**: FTS5 not for node names, but for episode full text (sweet spot).
- **E3** — Stefan confirms: do not exclude multi-word queries, „normal weitermachen". Slice scope refocused.
- **E4** — Implementation: schema (FTS5 + 3 triggers), sanitization helper, `recallEpisodes` extension, idempotent migration. 12 AC tests + 2 existing tests adjusted.
- **E5** — Adversarial audit round 1: **NO.** Two critical findings:
  - 🔴-1 **Operator injection via textual operators**: the allowlist `\p{L}\p{N}\s` lets `AND`/`OR`/`NOT`/`NEAR` through. Empirically: "Operatoren AND OR" → SQL CRASH. "Sicherheit NOT wichtig" → masks the matching. Stefan's hallucination constraint directly violated.
  - 🔴-2 **Migration bug for pre-R3 DBs**: `COUNT(*) FROM episodes_fts` for `content='episodes'` FTS5 tables reflects the **source table**, not the index. Every existing DB would have had an empty FTS5 index after the R3 update that would never be filled → systematically empty hits. Exactly Stefan's „plumpe Halluzination wenn Wissen fehlt" scenario.
- **E6** — Fix round 1:
  - 🔴-1: every token in phrase quotes (`"token"`) — FTS5 takes phrases literally, no operator interpretation.
  - 🔴-2: migration check on the FTS5 shadow table `episodes_fts_docsize` (real index size).
  - 🟡: KONZEPT (concept document) statement on k1/b pinning softened (FTS5 allows no SQL override), doc note on the SQLite minimum version.
  - Regression tests for both 🔴 + term='' protection.
- **E7** — Adversarial audit round 2: **safe YES.** Phrase quoting structurally effective (quote injection excluded via allowlist). Migration path with shadow count correct. Prefix matching now no longer possible — documented in the KONZEPT as a deliberate scope boundary (added).
- **E8** — Self-merge PR #15.

## Process lesson (core)
**External code from AIs is starting material, not a solution.** Stefan's explicit reflex „bewerte es bitte VORHER" was right. Snippet 1 (recursive CTE) would have been a step backwards — all four previous slice hardenings (determinism, status, UC-BT, BFS order) would have been lost. Snippet 2 (FTS5 MATCH) was standard boilerplate, but **without sanitization** an operator-injection trap. Only by evaluating against the existing guardrails (determinism gate, open world, adversarial-audit lessons) could what actually fits be filtered out. [[feedback-pushback-welcome]] · [[feedback-websearch-in-concept-phase]]

**FTS5 has two operator classes, not one.** Symbol operators (`-`, `+`, `:`, `*`, `^`, `(`, `)`, `"`) are the obvious class. Textual operators (`AND`, `OR`, `NOT`, `NEAR`) are the insidious one — they are pure letters and pass naive allowlists. A randomly capitalized German conjunction at the start of a sentence in a user query could crash the whole search path. Adversarial audit exists exactly for this.

**External-content FTS5 tables have subtle count semantics.** `SELECT COUNT(*) FROM episodes_fts` returns *not* the index size but the **source table size**. Whoever builds migration conditions on it builds on sand. The FTS5 shadow table `episodes_fts_docsize` is the correct path. Stefan audit lesson: verify every new DB construct empirically, do not derive it from docs.

## Substantive lesson
**FTS5 is powerful exactly where there is full text.** Node names are identifiers — FTS5 would store them as whole tokens, the gain is zero. Episodes are full text — FTS5+BM25 works semantically. Clear scope separation gained.

**Phrase-quote sanitization is the clean solution for user input in FTS5.** Instead of recognizing and removing every operator individually (cat and mouse), every token is wrapped in phrase quotes. FTS5 takes phrases literally — all operators become literal tokens. Multi-word search is preserved via implicit AND between phrases. A defensive default that also structurally excludes future FTS5 operators.

**Make deliberate scope boundaries explicit in the KONZEPT.** Prefix matching (`KI*`) is structurally excluded with phrase quoting. Instead of accepting that implicitly, documented explicitly in the KONZEPT: "what is NOT offered". Honestly rules out consumer expectations.

## Open
- **Slice #R3b (deferred):** alias table for synonym nodes (domain dictionary). Stemming for German (word-stem match „Schulungen" finds „Schulung").
- **MCP schema cap for `term` length** (DoS hardening) — non-blocking, same state as pre-R3.
- **Conformance vector for FTS5-BM25** — if the PHP side ever wants to validate its own full-text implementation against ours, we need a canonical test vector.
