# Retro-ADR 0001 — NSAI-Edge: Konzept (concept document) → Engine → MCP → pre-merge review

**Status:** completed (pre-merge, PR #1 NOT merged)
**Date:** 2026-05-26
**Purpose:** Retrospective on building `nsai-edge` and the question of whether the goal "database-based knowledge base for Claude Code" was reached.

## Context

Goal (Stefan): supply Claude Code with knowledge efficiently + in a structured way without reading long files — persistent, decentralized (git-like P2P), as a peer of the PHP `NeuroSymbolicAiBundle`. Deliberate decisions: full parity locally, two mirrored engines, P2P/federated, MCP server.

## Decision chronicle

- **E1 — Gemini Konzept drafts discarded.** Two external drafts (v1.0/v1.2) had a skill-vs-MCP mismatch, one-way sync, an invented bundle interface. Verification against the real bundle code exposed the inventions (`ai:graph:ingest-json`, `fp_app_container` never existed).
- **E2 — Own Konzept iterated to maturity.** v2.0 (8.05) → v2.1 (8.55) → v2.2 (9.30/10) via deterministic lint + judgment reviewer. Core fixes: fixed-point instead of float (drift), clone UC, hash canonicalization, CRDT merge trust-independent.
- **E3 — NSAI bundle Konzept brought up to date** (3.5 → 9.2/10), shared wire contract v1 mirrored byte-identically.
- **E4 — Engine implemented TDD-first.** 41 tests green, no external deps (node:sqlite + Ed25519). CLI + MCP stdio transport. Integrated live in Claude Code, filled with verified PDF knowledge and queried (AI competence/Art. 4 AI Act: miss → ingest → hit, no hallucinating).
- **E5 — Marketplace plugin** (manifest + `.mcp.json` with `${CLAUDE_PLUGIN_ROOT}` + marketplace.json entry).
- **E6 — Adversarial pre-merge review → NO.** Three 🔴 (origin impersonation, trust laundering via relay, re-sign destroys provenance) + 🟡 (clock reset, missing transactions/busy_timeout, missing input validation in mergeIncoming). Merge blocked.

## Goal verdict

- **Database-based knowledge base (single node, local): REACHED + proven live.** Persistent (SQLite, `~/.claude/nsai-edge/`), queryable, honest (miss instead of hallucination), with confidence + provenance + inference + decay. The core benefit for Claude Code works.
- **Federation / P2P security: NOT production-ready.** The three 🔴 concern exactly the distributed trust chain. Until the fix, only local/single-node operation is trustworthy.

## What went well

- Verification against the real source (bundle code, PDF) instead of assumptions — caught external inventions + delivered real knowledge.
- The CDP5 gate chain (lint → judgment reviewer → adversarial-auditor) kept quality measurably high and caught severe bugs before the merge.
- TDD-first + the fixed-point decision eliminated whole error classes early.

## What must be better

- **Green tests gave false security:** the federation tests bypassed the signature path (fake signature `'ed25519:x'` in `mergeIncoming` calls). Security properties must be tested end-to-end over the real verify path, not over the merge algebra alone. See memory [[feedback-green-tests-bypass-security]].
- Architecture gap (origin = first asserter vs. last hop) was cleanly specified in the Konzept, but the implementation deviated — Konzept↔code drift on a security invariant.

## Core lesson

A passed test run only proves what is tested. If tests shortcut the security-critical path (here: signature/provenance), "all green" is a fallacy. Adversarial review before every merge of a distributed/security-relevant slice is mandatory, not optional. → [[feedback-green-tests-bypass-security]]
