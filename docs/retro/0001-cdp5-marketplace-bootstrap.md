# Retro-ADR 0001 — Building the claude-skills marketplace

**Status:** completed · **Date:** 2026-05-22 · **Mode:** CDP5 §29 Mode A (greenfield) + §32 orchestration · **Review:** independent pass (fresh context) + 2 test rounds.

## Context

Following the CDP5 go-live (v5 active, §33 security), the deterministic/trivial agents were to become programmed skills and be available to colleagues as a **project-independent** Claude Code marketplace (`SmR492/claude-skills`, public) — containing no project code/structure. Result: plugin `cdp5-gates` (9 read-only Node skills) + `cdp5-agents` (5 methodology agents), 22/22 tests green, pushed live.

## Decision chronicle

- **E1 — §32.9 gate as selection filter.** Determinism gate applied across all 34 agents: only **decidable** detectors became T1 skills (Node), real judgment stayed agent. Finding: the majority of the existing agents are **project-/framework-coupled** (impl-tenant, infra-portainer, review-access …) and therefore **not** shareable. Only parameterized detectors + generic CDP5 methodology agents are shareable. → "project-independent" is a hard, strongly reducing filter.
- **E2 — Catalog-first instead of mass generation (§1.9).** Before building, scope/placement/runtime/GitHub were clarified several times (AskUserQuestion); the user readjusted the scope twice („erst Katalog finalisieren", „aus den PDFs ableiten"). This prevented discarded artifacts.
- **E3 — Shared scan lib + pilot pattern.** The `roadmap-drift` pilot logic (file walk + `classify`/`locate`) was extracted as `lib/scan.mjs` and reused by several skills — dependency-free (only `node:`).
- **E4 — Review found a real 🔴.** The independent review pass uncovered a bug that the green tests did **not** see: `parsePhp` assigned the properties of the *whole* file to *every* class. Verified (§10.6), fixed with a per-class slice, regression test added. Confirmed again: fresh-context review beats self-review + green tests — even for "simple" code ([[feedback_auditor_over_self_review]], [[feedback_verify_agent]]).
- **E5 — Deterministic constraint check as gate.** The requirement "no project code" was checked via `grep` against forbidden tokens (project names/paths) — and found leftovers (project-adjacent fixtures `Vehicle`/`garage`, a doc example) that the LLM review underrated. A **negative** requirement ("X must NOT occur") is decidable → script gate, not LLM (§32.9, §32.8(1)).
- **E6 — Subagent limit shapes the bootstrap design.** "Every agent preloads skill X" could not be built as a skill invocation (subagents get no skills). Solution: `cdp5-reference` as doctrine + query tool (`cdp5.mjs --section/--keyword`) that the agent uses via **Bash/Read**; the orchestrator passes the path in the brief (§32.8(2)). Just-in-time retrieval instead of a 2000-line doctrine per prompt ([[feedback_deterministic_skills_over_text]], CDP5 §28.6).

## What went well / better

- **Good:** catalog-first + confirm; shared lib; review→improve→review found + fixed the 🔴; the grep constraint check as a cheap, reliable "no project code" gate; cdp5-reference dogfoods §28.6.
- **Better:** run the grep leak check **before** the code review (deterministic first, then judgment) — would have dealt with the fixture findings earlier. `node --test <dir>` behaves differently from explicit files (gotcha) → always pass files.

## Core lesson

A **negative/decidable** requirement (here: "contains no project code") belongs in a deterministic gate (grep/script), not in an LLM review — that is §32.9 applied to the *building* of the skills themselves. And: the independent review stays valuable even for small, "obviously correct" code — the 🔴 `parsePhp` bug was test-green.

## Memory loop (§32.6)

Cited slugs verified present: [[feedback_auditor_over_self_review]], [[feedback_verify_agent]], [[feedback_deterministic_skills_over_text]], [[feedback_clarify_before_assuming_scope]]. Newly created + MEMORY.md pointer: [[project_claude_skills_marketplace]].
