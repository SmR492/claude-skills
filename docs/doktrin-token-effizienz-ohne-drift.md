---
title: Doktrin — Massiv Tokens sparen ohne Drift
date: 2026-05-29
status: Methodik-Notiz (recherche-fundiert)
scope: CDP5 / NSAI-Edge Arbeitsweise
---

# Doktrin: Massiv Tokens sparen ohne Drift

## Kern-Einsicht
„Tokens sparen" und „Drift vermeiden" sind **dasselbe Lenkrad**. Chromas *Context-Rot*-Studie (2025, 18 Frontier-Modelle inkl. Claude 4) belegt: mehr Input-Tokens → schlechterer Output, selbst weit unter dem Fenster-Limit, selbst bei trivialen Aufgaben. Drift ist eine Funktion der Token-Menge. → Wer die **kleinste Menge hoch-signalhafter Tokens** findet, spart Kosten UND verhindert Drift.

## Kanonische Doktrin: Context Engineering (Anthropic, Sept. 2025)
Leitprinzip: *„find the smallest set of high-signal tokens that maximize the likelihood of your desired outcome."* Drei Techniken:
1. **Just-in-Time-Retrieval** — leichte Identifier (Pfade/IDs) halten, Inhalt bei Bedarf holen.
2. **Compaction** — nahe am Limit zusammenfassen + neu starten.
3. **Note-Taking + Checkpoints** — durable Fortschritts-Artefakte, die Compaction überleben.

## Filter „ohne Drift": lossless vs. lossy
| Drift-frei (deterministisch) ✅ | Drift-Risiko (probabilistisch) ⚠️ |
|---|---|
| Just-in-Time-Retrieval (Pointer statt Inhalt) | LLMLingua/-2 (LM verwirft Tokens, bis 20×) — externe Dep + Probabilistik → nur eingehegt |
| Sub-Agent-Isolation (50k intern → 1–2k Summary) | Summarizing-Compaction — verliert Information; Note-Taking als Absicherung |
| Strukturierte Serialisierung (TOON/typed objects) | |
| Instruktions-Re-Anchoring / Out-of-Context-Gate (τ-bench: +85% Genauigkeit zurück) | |

Forschung: „Structured Distillation for Personalized Agent Memory" — 11× Token-Reduktion MIT Retrieval-Erhalt (arXiv 2603.13017).

## Bezug zum eigenen Stack (bereits gebaut — nur benennen/schärfen)
- **NSAI-Edge = Just-in-Time-Retrieval in Reinform** (query-first statt Dateien laden → hoch-signalhafte Tripel statt ganzer Dokumente). Der drift-freie Token-Spar-Substrat.
- **CDP5 §32 (Orchestrator-Delegation) = Sub-Agent-Isolation.**
- **CDP5 §28 (CONTEXT.md/ADRs) = Note-Taking/Checkpoints.**
- **E5/CSL-Core (Deterministic Gate) = Out-of-Context-Instruktions-Verankerung.**

## Fehlende Zutat (Roadmap-Bezug)
„Smallest set of *high-signal* tokens" braucht ein **Relevanz-Signal**. Das liefern die belief/recency-Rangordnung im Graph + Flagschiff **D1/E1 (kalibrierte Relevanz)** → Token-Budgetierung nach *kalibriertem* Belief statt Bauchgefühl. Macht aus der qualitativen Anthropic-Doktrin ein deterministisch messbares Token-Budget.

## Quellen
- https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents
- https://www.trychroma.com/research/context-rot
- https://arxiv.org/html/2510.07777v1 (Drift No More? — Re-Anchoring)
- https://paddo.dev/blog/12-factor-agents/
- https://arxiv.org/pdf/2603.13017 (Structured Distillation, 11× mit Retrieval-Erhalt)
- https://www.microsoft.com/en-us/research/blog/llmlingua-innovating-llm-efficiency-with-prompt-compression/
