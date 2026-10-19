---
title: Doctrine — Save tokens massively without drift
date: 2026-05-29
status: Methodology note (research-based)
scope: CDP5 / NSAI-Edge way of working
---

# Doctrine: Save tokens massively without drift

## Core insight
"Saving tokens" and "avoiding drift" are **the same steering wheel**. Chroma's *Context Rot* study (2025, 18 frontier models incl. Claude 4) shows: more input tokens → worse output, even far below the window limit, even on trivial tasks. Drift is a function of the token volume. → Whoever finds the **smallest set of high-signal tokens** saves cost AND prevents drift.

## Canonical doctrine: Context Engineering (Anthropic, Sept. 2025)
Guiding principle: *"find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome."* Three techniques:
1. **Just-in-time retrieval** — keep lightweight identifiers (paths/IDs), fetch content on demand.
2. **Compaction** — summarise near the limit + restart.
3. **Note-taking + checkpoints** — durable progress artefacts that survive compaction.

## Filter "without drift": lossless vs. lossy
| Drift-free (deterministic) ✅ | Drift risk (probabilistic) ⚠️ |
|---|---|
| Just-in-time retrieval (pointer instead of content) | LLMLingua/-2 (LM discards tokens, up to 20×) — external dep + probabilistics → only contained |
| Sub-agent isolation (50k internal → 1–2k summary) | Summarising compaction — loses information; note-taking as safeguard |
| Structured serialisation (TOON/typed objects) | |
| Instruction re-anchoring / out-of-context gate (τ-bench: +85% accuracy recovered) | |

Research: "Structured Distillation for Personalized Agent Memory" — 11× token reduction WITH retrieval preserved (arXiv 2603.13017).

## Relation to the own stack (already built — only name/sharpen)
- **NSAI-Edge = just-in-time retrieval in its purest form** (query-first instead of loading files → high-signal triples instead of whole documents). The drift-free token-saving substrate.
- **CDP5 §32 (orchestrator delegation) = sub-agent isolation.**
- **CDP5 §28 (CONTEXT.md/ADRs) = note-taking/checkpoints.**
- **E5/CSL-Core (deterministic gate) = out-of-context instruction anchoring.**

## Missing ingredient (roadmap relation)
"Smallest set of *high-signal* tokens" needs a **relevance signal**. That is provided by the belief/recency ranking in the graph + flagship **D1/E1 (calibrated relevance)** → token budgeting by *calibrated* belief instead of gut feeling. Turns the qualitative Anthropic doctrine into a deterministically measurable token budget.

## Sources
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.trychroma.com/research/context-rot
- https://arxiv.org/html/2510.07777v1 (Drift No More? — Re-Anchoring)
- https://paddo.dev/blog/12-factor-agents/
- https://arxiv.org/pdf/2603.13017 (Structured Distillation, 11× with retrieval preserved)
- https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/
