# Konzept Design Implementation Testing Review Pattern

**Abbreviation:** CDP5 (Concept Design Pattern, Generation 5) — the active doctrine is **exclusively this file**. The predecessor **CDP4** (v4.7, `konzept-design-pattern-v4.md`) is **frozen + not active**, kept as a fallback reference (fallback in case of structural drift of the v5 base structure). The abbreviation KDP denotes v3.1 (frozen, inlined in §1–§26).

**Version:** 6.0
**Stand:** October 2026
**Provenance:** This file is the bundled copy of the CDP5 doctrine and its master until the knowledge layer (Orbit) is connected (DECISIONS.md A4, amended 2026-10-19). Version 6.0 aligns the doctrine with the plugins cdp5-gates, cdp5-agents and domain-agents (DECISIONS.md D-13 batches 1–7); changes only via PR.
**Language:** English. The paragraphs carried over from v5.1 are a translation of the German Orbit originals (translated 2026-10-19, § numbering and German identifier terms retained). The paragraphs new in v6.0 are written for this copy: §1.11 and §35.1 are condensed from their Orbit originals, §27.1.1 and §32.6.1 are faithful translations, §32.20–§32.24 have no Orbit original. The Orbit paragraphs §32.12, §32.13, §32.15, §32.17 and §32.19 keep their own meaning and are not in this copy (redirect table).
**Character of this version:** v6.0 aligns the doctrine with the shipped plugins (worker contract, orchestrate size floor, gate ids G1–G15, run grants, the agents and T1 skills that exist); three knowledge-layer paragraphs are inlined (§1.11, §27.1.1, §35.1) and the rules the plugins rely on get free anchors of their own (§32.20 plugin mechanics, §32.21 fresh context, §32.22 behaviour invariance, §32.23 bounded attempts, §32.24 counter-role triad). Underneath, v5 is a **restructuring** of v4.7 — same doctrine, reordered for **low-context reading**. Content was moved, not deleted (exception: two pure forward-reference stubs; three topic duplicates merged). Author quotations have been converted into direct inline rules (portability: every rule stands on its own, no external reading required). New: Part 0 (mission + work loop), the anti-drift/memory mechanics pulled forward, a dedicated security part (Part 3, §33), LLM specifics bundled into a skippable Part 5, reference material (prompt patterns, golden samples, cases) in the appendix.

**Stable anchors:** The `§` numbers are unchanged and remain the citable anchors (all internal `(§X.Y)` references continue to apply). The **Part** structure is the *reading* order — which is why, for example, §29 (modes) appears before §10 (review): the working path comes before the Konzept (concept document) craft.

**Purpose:** A reusable pattern that (a) **establishes a knowledge doctrine including patterns** and (b) **prescribes a working path for the AI on which an assignment can be processed without drift and without memory loss** — from Konzept through design, implementation, testing to review, for greenfield as well as brownfield and PoC integration of new AI capabilities.

---

## 0. Mission, Reading Path & Work Loop

### 0.1 What CDP5 is for

CDP5 has exactly two tasks:

1. **Establish knowledge doctrine + patterns** — what a Konzept looks like, how implementation/review runs, which proven patterns apply and which anti-patterns are forbidden. This doctrine is binding, not optional.
2. **Prescribe a drift-free and memory-loss-free working path for the AI.** The two deadly enemies of all AI-assisted work are **drift** (the AI deviates unnoticed from vocabulary/architecture/decisions) and **memory loss** (context fills up or is lost between sessions; the model hallucinates afresh without self-awareness). Part 2 is the mechanics that prevents both: single-source pointers instead of paste, durable artifacts (CONTEXT.md/ADR/handoff) as external memory, determinism gates, verification against the source, isolated workers with fresh context, retro ADR + memory loop.

### 0.2 Structure (Reading Path)

| Part | Content | When to read |
|---|---|---|
| **Part 0** (§0) | Mission, reading path, work loop | always first |
| **Part 1** (§1) | Basic principles — the rules that always apply | always |
| **Part 2** (§29, §32, §10.6/§10.7, §19, §28, §27) | **The working path** — modes, orchestration, drift avoidance, skill gate, verification, durable artifacts, implementation tools, retro/memory | for any work on code |
| **Part 3** (§33) | **Security** — agent/tool safety (lethal trifecta, MCP hardening) + AppSec (threat modeling, security gates, LLM threat classes) | when there is an agent/tool/security share |
| **Part 4** (§2–§7, §10.1–§10.5, §11, §14, §17, §23) | **Konzept doctrine (authoring)** — mandatory structure, UC structure, review, AI limits, glossary, human responsibility | when writing/reviewing a Konzept |
| **Part 5** (§13, §15, §16, §18, §20–§22) | **LLM/agent extensions** — only relevant if a UC calls an LLM | **skippable** for deterministic tasks |
| **Part 6** (§24, §25) | **Insights + anti-pattern catalog** | as a checking grid in review |
| **Appendix A–C + §26** (§9, §31, §30, changelog) | Prompt patterns, golden samples, reference cases, changelog | as a lookup reference |

**Character:** CDP5 is **not a phase workflow**. The implementation toolbox (§27) is a library; the application modes (§29) choose, depending on the situation, which tools apply; the orchestrator rule (§32) governs *who* executes them (the orchestrator delegates to isolated workers).

### 0.3 The Work Loop (in 30 seconds)

Every non-trivial assignment runs like this — an assignment that touches more than one stage is **orchestrated, not executed by oneself** (§32):

1. **Choose mode** (§29): A greenfield · B bug/regression · C review/teardown · D UC→code · E AI PoC.
2. **Clarify-First** (§1.9): everything unclear/open goes **immediately** into the conversation with the user — do not assume. A self-flagged assumption is a hard stop.
3. **Read the durable source** (§1.8, §28): CONTEXT.md + ADRs in the touch area — the external memory. Mandatory for brownfield.
4. **Per delegation: determinism gate + pointer brief** (§32.8): decidable task → deterministic skill/script (§32.9), no LLM worker. Otherwise brief the worker with a pointer to the single source (no paste), model per §32.3, parallel only if self-contained.
5. **Verify before every follow-up action** (§10.6, §32.8 (4)): worker output is probabilistic → check against the source, deterministically where possible. No irreversible action on an unverified claim.
6. **Hold Mensch-Gates (human gates)** (§23): destructive/irreversible steps never automatic.
7. **Maintain durable artifacts** (§28): update CONTEXT.md/ADR before the context is lost; at the token limit, a handoff doc.
8. **Closing: retro ADR + memory loop** (§32.6): record how the work was done; persist every durable lesson as memory **and verify that the cited slug really exists**.

---

## 1. Basic Principles

### 1.1 Sachbearbeiter-Test (clerk test)

Before a Konzept counts as finished, it must pass the **Sachbearbeiter-Test**: *Could a trained office employee carry out all processes of this system manually using only this document — without access to the system itself?* If the answer is no, details are missing. The test enforces:
- Complete field descriptions (no "and further fields")
- Explicit error cases (not just success paths)
- Clear responsibilities per UC
- Defined status transitions
- Concrete validation rules

### 1.2 AI is the consumer of the designs, not their author

AI does not create good designs — it is the **consumer** of the designs (provenance: Leßner 2026). The more precise the Konzept, the better the generated code. AI assistants work by statistical similarity — without clear structures, plausible-sounding but technically wrong implementations arise. **A vague Konzept produces vague code.**

**Consequences:** Process logic so precise that no room for interpretation remains · boundary conditions explicit · always name data types and units · regulate singular/plural differences explicitly.

### 1.3 Design before Implementation

Coding without design leads to unmaintainability within a very short time (provenance: Toth 2026). **Vise Coding instead of Vibe Coding:**

| Vibe Coding | Vise Coding |
|---|---|
| Free prompts, immediate code | Spec-first, then targeted prompt |
| AI determines structure | Konzept determines structure |
| Fast but fragile | Somewhat slower but maintainable |
| AI hallucinates architecture | AI implements defined architecture |

### 1.4 Konzept as a living artifact

- Deviation in the code → the Konzept is updated to match
- New requirement → first update the Konzept, then implement
- Technical restriction → code is "more correct" than the Konzept → adapt the Konzept, not the code

A version history (changelog) is mandatory from v2.0.

### 1.5 Probabilistics Awareness

Every LLM answer is probabilistic. LLMs reproduce syntax and stylistic patterns but **cannot** verify whether generated code compiles, runs correctly or integrates coherently into the system (provenance: Mahringer 2026). The Konzept must acknowledge this explicitly:
- Hallucinations are not "bugs" but systematically derivable from probabilistics.
- A model that delivers 75 % correct results is wrong 25 % of the time — state per UC whether that is tolerable.
- 45 % of AI-generated code has security defects (Veracode 2024) — treat AI code as **"untrusted input"** (§15.8 + anti-pattern §25).

> **Probabilistics is made concrete in three places, all of which belong together:** the **probabilistics statement in the Konzept header** (§2.6, with tolerance threshold + EU AI Act class per UC), the **layer/workflow awareness** (§18, context pyramid + workflow models) and the **validation layers** (§15.8). §1.5 is the principle, §2.6/§18/§15.8 are its mandatory artifacts.

### 1.6 Full human responsibility

The developer bears **full** responsibility for the code — just as before, when assistants did the preparatory work (provenance: Lischke 2026). Specify explicitly in the Konzept:
- Who has decision-making power in the UC? AI is never the decider, only a proposal generator.
- Who checks the final result? Who is liable?
- Stakeholder communication carries a large non-verbal share (tone of voice, body language) that remains human; the often-cited 7 % figure (Mehrabian, *Silent Messages*) applies only to incongruent emotional statements and is not treated here as a general rule. Decision workshops, domain storytelling, event storming are LLM-resistant.

### 1.7 Separation of concreteness — CDP5 abstract, concrete cases in wiki/trace

CDP5 documents **abstracted patterns**. Concrete project names, file paths, repo URLs, commit SHAs, PR numbers do **not** belong in CDP5 itself — they go into the wiki (`wiki/projects/`, `wiki/sources/`) or into trace raws (`raw/traces/`).

**Rationale:** Avoiding manipulation in automated AI reviews. If CDP5 contains concrete code references, an AI can misinterpret them, insert wrong SHAs or confabulate paths. The pattern doc remains more resistant to manipulation when it is abstract.

**Exception:** Concrete code details go into CDP5 only if an abstract, transferable pattern can be derived from them directly — then the pattern is formulated, not the episode documented. **Consequence:** Reference cases (Appendix C) are pseudonymized (Case A, B …).

### 1.8 CONTEXT.md + ADRs as mandatory single source of truth for brownfield

If the Konzept has a brownfield/extension or review/teardown share, CONTEXT.md + all ADRs in the touch area are the **single source of truth** for domain vocabulary + architecture assumptions. They are at the same time the **external memory** against memory loss (§28).

**Mandatory order for every brownfield extension:**
1. Read CONTEXT.md (or create it if missing)
2. Read ADRs in the touch area
3. On conflict between Konzept extension and ADR: **ADR update first**, then the extension
4. After completion: update CONTEXT.md (new architecture assumptions, extended glossary)

**Golden rule:** What is not in CONTEXT.md or an ADR is interpreted arbitrarily in the implementation. Applies symmetrically to both sources. Concrete definitions + mandatory content: §28.1 (CONTEXT.md) and §28.2 (ADRs).

### 1.9 Clarify-First — go into the conversation instead of assuming

As soon as something is **unclear, undefined or not unambiguously derivable from Konzept / CONTEXT.md / ADR** — or a **decision is open** —, **one goes into the conversation with the user immediately**, before building further. No silent assuming, no "I'll clarify later" — and **no single drive-by question**: a real dialogue that runs until the gap is actually closed.

**Why:** A gap clarified early costs one conversation. The same gap, with work, several UCs or code already built on it, costs teardown — and a wrong assumption spreads the error across everything built on top of it. A dialogue often uncovers related gaps at the same time.

**Rule:**
- Unclear/undefined term → go into the conversation or trigger a glossary entry (§14), do not guess.
- Ambiguous requirement → talk through the variants with the user, do not silently pick one.
- Open decision (scope, architecture, vocabulary, data model) → decide together, do not fix it implicitly.
- **Self-flagged assumption = hard stop:** If a worker (or the orchestrator) **itself flags** one of its own assumptions **as open**, continuing on it is **forbidden** — the orchestrator goes into the conversation immediately (§32.8 (3)) instead of passing the assumption through. *(Practice lesson: a passed-through scope/mapping assumption that a sub-agent had marked as open cost a whole rework cycle.)*
- Proceeding without feedback is only permitted if the answer is **unambiguously** derivable from what exists.

Applies to every stage (Konzept · design · implementation · testing · review). In the orchestrator model (§32), the orchestrator brings open points into the conversation immediately instead of passing them to a worker or guessing itself; a worker lacking context reports the gap back (§32.8).

### 1.10 Research-after-Failure — failed-attempt rule (mandatory)

If a solution approach fails **after the second attempt** OR the user expresses **dissatisfaction** with the approach: **hard stop of trial-and-error** — from this point on, **research is mandatory** (WebSearch / official docs / issue tracker) before another attempt is made. Training knowledge and further trying are then by definition NOT the solution.

**Why:** *(Practice lesson: During a server deploy, the search for a solution ran in circles for hours — "works locally, fails on the server" — and under time pressure became increasingly destructive: sweeping edits, overwriting user changes, guessed rebuilds. A single WebSearch delivered the real cause — a documented platform quirk of the deploy tool — within minutes.)*

**Rule:**
- **Counter:** 2 failed attempts for the same hypothesis → research obligation. User dissatisfaction (explicit or recognizable) → immediate research obligation, regardless of the counter.
- **Research means:** search externally for the exact error picture/symptom (error message verbatim, tool + context), read the official docs of the platform involved, check known issues — and **substantiate** the cause found before changing anything again.
- **"Works locally, not remotely"** (or vice versa) is almost always an **environment/platform difference**, not a code problem — research starts with the platform (deploy tool, proxy, runtime), not in one's own code.
- **Do not become destructive under pressure:** no sweeping edits, no overwriting of others' or one's own user changes, no guess-and-push. Before intervening again, the substantiated cause + the planned fix are named (for contentious interventions: have them confirmed, §1.9).
- The cause found is recorded (memory/ADR/retro, §32.6) so that the same loop is not run again.

### 1.11 Proportionality

Every answer and every artefact comes in one of three scope forms: a direct answer; a minimal concept; the full structure with UCs and acceptance criteria. The orchestrator names the form in the brief. Without a named form, the smallest form that answers the assignment applies, and the omissions are stated. A self-imposed demand for completeness or purity ("pure", "complete", "byte-equivalent", "clean", "consistent") is an uncommissioned feature and needs the client's explicit release (§27.1.1).

---

# Part 2 — The Working Path (drift-free / memory-loss-free)

This part is the operational core: *how* an assignment is processed without the AI drifting off or losing context. Order: choose mode (§29) → orchestrate instead of doing it yourself (§32, incl. drift avoidance §32.8 + skill gate §32.9) → verify against the source (§10.6/§10.7/§19) → maintain durable artifacts as memory (§28) → implementation tools apply (§27).

## 29. Four Application Modes + Mode E

§29 decides which §27 tools apply in which mode. Modes are non-linear — a session can switch between modes. The orchestrator role (§32) applies from two stages and more than one worker's worth of work; a bugfix or a single slice with one writer runs as worktree, one worker, review-verify; the full chain applies from three stages, two writers or a 🔴 object (size floor, §32.10).

### Mode A — Greenfield feature in an existing repo

**Situation:** New capability, several layers, no relation to an existing bug or existing debt.

**Tool combination:**
1. Read CONTEXT.md / ADRs (§1.8 + §27.6)
2. Synthesize PRD (Pocock `to-prd` or §3 UC structure)
3. Vertical-slice plan (§27.2) — HITL/AFK
4. AC table per UC (§11.7)
5. Start slice 1 with vertical TDD (§27.4)
6. Update CONTEXT.md, new ADRs if necessary

### Mode B — Bug / Regression

**Situation:** Something does not work.

**Tool combination:**
1. **Build a feedback loop** (§27.5) — before anything else
2. Iterate the loop until fast + deterministic + sharp
3. **Rule out stale data first** (§32.8 (6)) — clean reproduction before any code fix
4. Hypothesis, run the loop, verify / discard hypothesis
5. Fix as a vertical slice (fix + regression test + audit of other places)
6. Update CONTEXT.md if an assumption was refuted; ADR update if the assumption was in the ADR

### Mode C — Architecture Review / Teardown

**Situation:** Review or planned teardown.

**Tool combination (review):**
1. Read CONTEXT.md + all ADRs — where were the original assumptions?
2. Decisions archaeology (§27.7)
3. Depth inventory (§27.7)
4. Seam inventory (§27.7)
5. Anti-pattern scan against §25
6. Review output per **Schema C.1**

**Tool combination (teardown):**
1. Reverse slicing (§27.7)
2. Adapter roll-back per seam
3. Tests at stable interfaces as verification
4. CONTEXT.md + new ADR for the teardown decision
5. Teardown output per **Schema C.2**

#### Output Schema C.1 — Review (per deepening candidate)

Mandatory fields per candidate (Pocock `improve-codebase-architecture` schema + severity):
- **Module / files** — which modules are involved (CONTEXT.md vocabulary)
- **Problem** — why the current architecture creates friction (mechanics, not just symptom)
- **Solution** — plain-English description of the planned change
- **Benefits** — in terms of locality + leverage + test improvement
- **ADR conflict** — if the candidate contradicts an existing ADR, mark it with the rationale "why an ADR update is justified"
- **Severity** — 🔴 critical / 🟡 medium / 🟢 minor

Format: numbered list with the mandatory fields per entry.

#### Output Schema C.2 — Teardown (reverse-slice table + mandatory ADR)

```markdown
### Teardown-Plan: <Subsystem-Name>

| # | Reverse-Slice | Target (Modul/Seam) | Adapter-Status (bleibt/geht) | Verifikations-Tests | Risk | Reversibel? |
|---|---|---|---|---|---|---|
| 1 | … | … | … | … | … | … |

### Konsequenz-ADR (Pflicht)

**Kontext:** …
**Entscheidung:** …
**Konsequenzen:** …
**Alternativen erwogen:** …
```

### Mode D — UC → code transition (the Konzept leaves the doc)

**Situation:** A Konzept per §1–§23 is finished (gate of the Reife-Policy (maturity policy) passed, score ≥ project threshold, walk-through passed, AC tables complete). Goes into implementation.

**Tool combination:**
1. Create or update CONTEXT.md with the Konzept glossary
2. Create ADRs for asymmetric Konzept decisions
3. Derive the slice plan from the UCs — at least one slice per UC, often several
4. The AC table per UC is run in the vertical TDD loop (§27.4)
5. Prototyping (§27.3) for open logic/UX questions
6. Commit slice by slice; let CONTEXT.md grow along

### Mode E — AI capability PoC integrated into an existing system

**Situation:** A new LLM capability is to be introduced into an existing codebase. Combines §22 (PoC phases) with the brownfield pattern (Mode A + §27.6).

**Tool combination:**
1. **Read CONTEXT.md / ADRs** (§1.8 + §27.6) — where is the AI capability integrated?
2. **§22.1 Phase 1 Learn & Experiment** — focused test group, 3–5 UCs, compliance/security enabler kick-off
3. **Probabilistics statement + vendor risk + EU AI Act class** (§2.6 + §2.7) created
4. **Vertical-slice plan** (§27.2) — slice 1 = riskiest PoC path with the highest learning opportunity
5. **Pre/inline/post validation phases** (§13.2) defined per slice
6. **Hybrid validation layers** (§15.8) for LLM code output documented
7. **§22.2 Phase 2 Consolidate** — quantitative success measurement per slice (§22.2 table)
8. **Update CONTEXT.md + ADRs** with the new capability layer
9. **Scaling plan** = vertical slices in follow-up sprints

> **Bridge:** Mode E is the explicit bridge between §22 (PoC phases) and Mode A (brownfield-greenfield hybrid).

---

## 32. Orchestrator Rule (mandatory — delegation doctrine)

**This section is binding, not optional.** The main agent (main session) does NOT execute a non-trivial CDP5 assignment itself but **orchestrates** it. "I could do it, but I don't have to" does not apply here: as soon as an assignment touches more than one stage, delegation is mandatory. Delegation to isolated workers with fresh context is at the same time the primary defense against memory loss (context rot) in the main agent.

### 32.1 Company Model

| Role | Who | Task |
|---|---|---|
| **Enterprise / management** | Main session (orchestrator) | Understand the assignment, choose the CDP5 mode (§29), delegate to stage workers, supervise, **verify** (§32.8 (4)), **synthesize** results, hold Mensch-Gates (§23). The orchestrator decides, briefs, verifies and synthesizes; it does not analyze, research or implement itself, it brings in expert workers for that. Effort scaling is part of its role: one agent with a few tool calls for a fact, two to four workers for a comparison, more only for complex research; before a team, first check whether a subagent suffices (role text: skill `orchestrate` in the plugin cdp5-agents) |
| **Department / worker** | Subagent per stage role | Isolated specialist work in a **fresh, small context** (drift protection), with baked-in methodology + bound tools |
| **Tool / procedure** | Skill | (A) baked into the worker as methodology; (B) run by the orchestrator (MCP/interaction); (C) a session persona for a conversation with a person (domain-agents psy skills, `business-lingo`) that dispatches its counter-check (`psy-grenzwaechter`) as a worker and does no engineering work in persona |

### 32.2 Mandatory Orchestrator Procedure

The procedure applies from two stages and more than one worker's worth of work; a bugfix or a single slice with one writer runs as worktree, one worker, review-verify; the full chain from three stages, two writers or a 🔴 object (size floor, §32.10).

0. **Name the mode (§29) in the ledger;** for a sprint-sized assignment the §23 walk-through and responsibility matrix precede the first brief.
1. **Choose mode (§29):** A greenfield · B bug/regression · C review/teardown · D UC→code · E AI PoC.
2. **Walk-through + responsibility matrix (§23)** before delegation if the assignment spans a sprint.
3. **Before every delegation: determinism gate + pointer brief (§32.8)** — decidable task → script instead of LLM worker; otherwise brief = pointer to the single source + narrow task + scope/AC + stop rule. Then **delegate per stage to the responsible worker** (table §32.4); independent workers **asynchronously/in parallel** (several `Agent` calls in one message), dependent ones sequentially.
4. **Choose the cheapest sufficient model per worker** (§32.3) — saving tokens is mandatory, not optional.
5. **Verify results (§1.5 + §10.6):** worker output is probabilistic → `review-verify` checks every worker claim against code/source before any follow-up action. A delivered diff passes the two-stage review in fresh context: brief conformance by `review-verify` (every AC covered, nothing out of scope, the gate commands really run), then quality by `review-code` for diffs that add a class or a seam or exceed about 150 lines; smaller diffs close with `review-verify` alone. No irreversible action on an unverified worker claim.
6. **MCP/interaction skills (B) stay with the orchestrator** — subagents get no MCP tools and cannot call skills/agents. The orchestrator runs them and passes the result to the workers.
7. **Hold Mensch-Gates (§23):** destructive/irreversible steps (schema drop, force-push, migration cutoff, branch delete) never automatic — always a human.

### 32.3 Model Choice per Worker (token discipline)

| Worker class | Default model | Rationale |
|---|---|---|
| Read-only / mechanical (mapping, lint, scan, drift check) | **no model:** T1 skill (§32.9) | decidable; the script's output is the evidence |
| Implementation / debug / refactor | **sonnet** | good code-reasoning/cost trade-off |
| Security · architecture · Konzept review · verification · counter-roles | **opus** (`effort: high`) | errors here are expensive/irreversible |
| Domain planning bound to a knowledge pack (marketing, UX) | **sonnet** | the pack carries the method, the model applies it |
| Psy domain (research, boundary guard) | **opus** (`effort: high`) | a person is affected; provenance and boundaries are judgment |
| Retro moderation | **sonnet** | structured synthesis of ledger and chronicle |

The orchestrator itself runs on the strongest available model (the reasoning load lies in delegation + verification); the specialist work is offloaded to the appropriate cheaper model.

### 32.4 Stages → Workers → Skills (worker agents / T1 skills / B orchestrator)

| Stage | Worker agents (plugin, model) | T1 skills (cdp5-gates) | Orchestrator skills (B) |
|---|---|---|---|
| **Konzept** | `konzept-reviewer` (cdp5-agents, opus) | `konzept-mapper`, `konzept-lint`, `konzept-model-api`, `konzept-const-sync`, `profile-check`, `cdp5-reference` | `spec-interview`, `spec-review`, `grill-me`, `to-prd`/`to-issues` |
| **Design** | `threat-modeler` (cdp5-agents, opus), `devils-advocate` (cdp5-agents, opus), `pessimistic-realist` (cdp5-agents, opus) | `ac-to-test-scaffold` | `prototype` |
| **Implementation** | `impl-uc`, `impl-debug`, `impl-refactor` (cdp5-agents, sonnet) | `roadmap-drift`, `secrets-scan`, `pii-scan` | `fan-out-migrate`, `writer-reviewer-loop`, `tdd` |
| **Review** | `review-verify`, `review-code`, `adversarial-auditor`, `mcp-security-reviewer` (cdp5-agents, opus) | `test-gap`, `mcp-config-lint`, `mcp-doc-drift-gate`, `skill-lint`, `wiki-lint` | `adversarial-review` |
| **Retro** | `pm-retro` (cdp5-agents, sonnet) | `retro-memory-loop-check` | — |
| **Domain** (cross-stage, plugin domain-agents) | `marketing-strategist` (sonnet), `psy-domaenen-rechercheur` (opus), `psy-grenzwaechter` (opus, counter-role) | — | `business-lingo`, `psy-diagnostik-navigator`, `psy-therapiebegleiter`, `psy-paar-moderator` (session personas, form C) |

Dormant role texts (`design-agent-uc`, `ux-designer`, `ux-reviewer`; candidates `test-perf`, `security-champion`, `architecture-auditor`) are built at the third logged manual run (§32.7). The former cross-cutting worker list (infra, git, wiki) is retired; that work is T1 skills or the orchestrator's own.

### 32.5 Anti-Patterns

- ❌ Orchestrator does the specialist work itself instead of delegating (context fills up → drift).
- ❌ All workers on opus (token waste — §32.3 ignored).
- ❌ Implementing a worker claim unchecked (§1.5/§10.6 violated).
- ❌ Trying to let a subagent call skills/MCP/further agents (technically impossible → B skills belong to the orchestrator).
- ❌ Processing sequentially what could run in parallel (async opportunity wasted).
- ❌ Starting an LLM worker for a decidable (deterministic) task instead of a script (§32.8 (1)).
- ❌ Briefing workers with copied context walls instead of pointers (overflow + paraphrase drift, §32.8 (2)).
- ❌ Worker stops with "doesn't work" without a Stop-Retro — the main agent has to guess what happened (§32.8 (3)).
- ❌ Parallel fan-out to many workers without value/parallelizability (~15× tokens burned — §32.10) instead of one worker or doing it directly.
- ❌ Orchestrator fixes a worker's finding itself beyond one behaviour-neutral hunk (skips the review, fills the context; §32.10 one-hunk rule).
- ❌ Stacking several large workflow packs (contradicting instructions); `orchestrate` plus `worker-contract` is the single workflow layer, foreign packs are linted with `skill-lint` before installation (§32.20).

### 32.6 Retro ADR after Review (mandatory closing) + Memory Loop

After completion of the **review stage**, a **retro ADR** is mandatory. Lessons live **project-specifically with the code**, so they are at hand where they are needed.

- **Location:** `docs/retro/<NNNN>-<slug>.md` in the respective project repo (consecutive number per session/sprint).
- **Layout:** status/date/purpose → assignment verbatim → carry-over of the previous retro (done / held / recurred, with evidence) → context → decision chronicle E1…En → root causes (Five Whys) with recurrence count → Kaizen table (one owned, measurable action per cause) → lessons → core lesson → fork balance (§32.6.1).
- **Who:** The orchestrator triggers it as the last step and briefs `pm-retro` with the ledger, the previous retro and the output of the T1 skill `retro-memory-loop-check`; `reflection-collector` where installed.
- **Escalation:** a 🔴 root cause escalates at its first recurrence, every other root cause at the third.
- **Durable lessons:** additionally persist in memory `feedback_<slug>` and link in the retro ADR.
- **Memory-loop verification (mandatory):** Every memory slug cited in the retro ADR **must really exist** (file `memory/<slug>.md` created **and** MEMORY.md pointer set). Check at retro closing — a cited but not created slug is a broken learning loop: the lesson evaporates, and the same error can recur. The check is decidable and runs as the T1 skill `retro-memory-loop-check` (§32.9). *(Practice lesson: several retros cited `feedback_*` slugs as persisted that were never written.)*
- **Distinction:** Architecture ADRs (*what* was decided) live in `docs/adr/`; retro ADRs (*how* the work was done) in `docs/retro/`.

### 32.6.1 Fork balance — the mandatory question of every retro

**Binding:** mandatory section of every retro ADR (§32.6).

**Problem:** a retro whose unit of analysis is the bug can only ever conclude "the fix was incomplete", never "this code should not have existed". In the case study behind this paragraph, six retros distilled six laws of the form "build more" and none of the form "remove the fork"; the number of path forks stayed constant in every retro although it was the independent variable, and the work ended about a factor of ten above the assignment.

**Mandatory section 1 — assignment (verbatim)**, at the top as the yardstick: the original assignment is quoted, not paraphrased.

**Mandatory section 2 — fork balance**, at the end:
1. Did this slice create a new fork, subsystem, table or mode? If so: was it commissioned (§27.1.1 answer 1), and does it pass the Deletion-Test (§27.1.1 answer 2)?
2. Which existing fork should never have come into being? Name at least one candidate, or give the reason why there is none.
3. Net balance: did the slice raise, keep or lower the number of forks?
4. Every path opened during the run (a hypothesis, a worktree, a branch, a stub, an open question, a deferred follow-up) carries one of three states: closed (with evidence), abandoned (with the reason) or open with a named owner. A path without a state is a finding; dead paths are removed before the PR.

**Heuristic:** a retro that produces only "build more" laws has not done the fork balance. A fork count that rises monotonically across retros is an overengineering alarm, however green the tests are. The orchestrator checks the balance when it closes the task; `pm-retro` records it.

### 32.7 Worker Agent: Need, Spec Format + Scaffolding

**Need — when a dedicated worker comes into being (check before creating):**
1. **Stage or domain role as baseline:** A role counts against a stage of §32.4 or a domain the plugin domain-agents covers. A role deserves its own worker if it is a **delimitable, recurring** activity of that stage or domain (e.g. review → verify / code / adversarial audit / MCP security).
2. **Repetition threshold:** from the **3rd repetition** of the same manually performed activity → dedicated worker. What is counted are **runs** in the usage log (`usage-log.jsonl`, written by the SubagentStop hook of the plugin cdp5-agents; the orchestrator records manual activities as `manual:<activity>` lines, and the third-run trigger reads exactly these lines), not documents or citations.
3. **Immediate trigger:** a single manual process with many different subtasks (multi-step) → evaluate as a worker **immediately**, not only after 3×.
4. **Delimitation/merge check:** if the activity overlaps an existing worker, that worker is **extended or merged** instead of creating a second one.
5. **Cost/benefit (anti-pattern):** **no** worker for a one-shot activity — maintenance burden without reuse is not worth it. When in doubt, the orchestrator does it once itself, or a cross-cutting skill applies.

**Spec format** — one file `agents/<stufe-rolle>.md` (plugin cdp5-agents) or `agents/<domain-rolle>.md` (plugin domain-agents) per worker, derived project-independently from stage + role or domain + role:

```yaml
---
name: <stufe-rolle> | <domain-rolle>   # z. B. impl-uc, psy-grenzwaechter — Bindestrich; Doppelpunkt ist plugin:skill vorbehalten
description: <Zweck in einem Satz + „Use when …"-Trigger>
tools: <minimal tools needed>  # e.g. Read, Edit, Write, Bash, Grep, Glob; Write/Edit only for implementation workers
model: sonnet | opus           # per §32.3; purely mechanical work is a T1 skill, not an agent
effort: low | medium | high | xhigh | max   # Denk-Tiefe: Gegenrollen/Reviewer high, Implementierungs-Worker medium
color: <optional>
---
```

**Body:**
1. **No thinking phrases.** The depth of thinking is set by the frontmatter field `effort`, not by a line like "think harder" (current models over-steer on such phrases; instructions to reproduce one's own reasoning trigger refusals). The worker contract (skill `worker-contract`) is injected by the SubagentStart hook; the worker's first output line is the receipt `contract: v<N> <hash>`.
2. **Role in one sentence** + delimitation from neighboring workers.
3. **Inputs** — what the orchestrator hands over.
4. **Workflow** — numbered steps = the baked-in stage methodology (§32.4).
5. **Tool binding:** deterministic procedures inline (e.g. the test worker calls the suite via Bash). **No MCP tools** — MCP/interaction skills are run by the orchestrator (§32.4 column B), which passes the result in.
5a. **Trifecta line (§33.1):** which of the three axes the agent's tools open and which one is broken; mandatory for every agent with WebFetch, WebSearch or network access.
6. **Rights and duties (§5 of the role):** at least three rights and three duties beyond the worker contract; a right whose basis is a MUST in doctrine or playbook has a twin duty with a check.
7. **Output format** — return to the orchestrator; claims with evidence (§32.8 (3)/(4)); first line the contract receipt, then the result in one sentence, then the evidence.

**Scaffolding procedure (orchestrator or `skill-creator`):**
1. Choose stage + role (§32.4) or domain + role; name `<stufe-rolle>` or `<domain-rolle>`.
2. Set the model per §32.3, keep tools minimal.
3. Bake the stage methodology (§32.4) in as the workflow.
4. Create the file under `agents/<name>.md`; the plugin's `agents/` directory is the live store; no mirror.
5. Register in the worker inventory (§32.4 table).

**Minimal template (generic):**
```markdown
---
name: <stufe-rolle | domain-rolle>
description: <Ein-Satz-Zweck + "Use when …">
tools: Read, Grep, Glob, Bash
model: sonnet
effort: medium
---

Du bist der <Rolle>-Worker der Stufe <Stufe>. <Abgrenzung zu Nachbar-Workern>.

## Inputs
- <was der Orchestrator übergibt>

## Workflow
1. <Schritt = eingebackene Stufen-Methodik>
2. …

## Anti-Patterns
- <what this worker does NOT do>

## Output
- <return to the orchestrator; claims with evidence; on missing context STOP + Stop-Retro instead of an assumption (§32.8)>
```

### 32.8 Drift Avoidance in Delegation (foolproof)

Two drift directions, both deadly: **context rot** (worker context fills up) and **under-context** (worker guesses because context is missing → claims). Isolation alone solves only the first. Mandatory mechanics:

**(1) Determinism gate (mandatory before every delegation):** Before delegating to an LLM worker, the orchestrator checks: Is the task **decidable** (unambiguous pass/fail with evidence)? If yes → **deterministic skill/script instead of LLM worker**; an LLM worker is started only for **genuine judgment**. Rationale: A script does not hallucinate a claim — its output *is* the evidence (covers §10.7 + §15.8).
- Deterministic (→ code/skill): tests (phpunit/phpstan), lints, model↔OpenAPI diff, enum drift, link/broken-ref scan, frontmatter/table consistency, route discovery, mass rename, roadmap↔code inventory, retro↔memory-loop check.
- Judgment (→ LLM worker): Reife-Score (maturity score), gap assessment, UC→code logic, code quality judgment, LLM-as-judge eval.

**(2) Task brief = pointer, not paste (mandatory):** The brief contains the assignment **verbatim**, the output format, the exact target (repo + commit, container, document ID + version, URL + date), a narrow task (one stage, one role), **pointers to the single-source files** (CONTEXT.md, spec/UC path, relevant ADR paths, glossary) — the worker reads the **original lazily + scoped** —, scope + AC, explicit out-of-scope, the tools and sources, the throwaway environment for trial runs or "none", the required doctrine sections as an excerpt or the path of the doctrine copy, and the stop rule (3). A **generated, hash-checked copy** from the knowledge layer also counts as the **original** (provenance line per section, diff-and-hash review before the commit, no manual change); until the knowledge layer is connected, the bundled copy `konzept-design-pattern-v6.md` is the master and is changed only via PR. Copied context walls remain forbidden: they create overflow (context rot) **and** paraphrase drift (the worker works on the summary instead of the original).

**(3) Worker contract — evidence obligation + Stop-Retro:**
- Output **always with evidence** (file:line / command output).
- If context for unambiguous work is missing → **STOP, no assumption.** The worker returns a **Stop-Retro** in the contract format (`STOP` / `done` / `why` / `need`, skill `worker-contract`): **done** — what it did (decision chronicle up to the stop, with evidence), **why** it stops (the concrete gap + why it cannot be resolved unambiguously), **need** — what closes it (which info/decision). This way the main agent knows completely what happened — and goes into the conversation with the user in a targeted way (§1.9), instead of blindly continuing or re-deriving.
- The worker returns the Stop-Retro in its output; the orchestrator persists it according to the **filing switch** (§28): own repos → `docs/retro/`; company repos → nothing AI-generated into the repo, but the memory directory outside the repo (`~/.claude/projects/<projekt>/memory/`) or later the knowledge layer; ephemeral things into the scratch area. The orchestrator folds it into the §32.6 retro ADR.
- Further contract rules (severity scale, verdict mapping pass / pass-mit-Auflage (Auflage = condition) / block, limited attempts, provenance per statement, fresh context of the counter-roles, language) are in the skill `worker-contract` of the plugin cdp5-agents; it is the single source and is injected per worker start.

**(4) Verification gate:** Worker claims are checked against the source before every follow-up action — deterministically where possible, otherwise `review-verify` (§10.6). Under-context claims are caught exactly here.

**(5) Parallelism only if self-contained:** Only workers with **independent, self-contained briefs** run in parallel. Jointly evolving context → sequential or re-brief, otherwise parallel workers work on outdated assumptions.

**(6) Reproduction/empirics gate (before every diff/bugfix):** Before a deviating result is fixed as a bug, the orchestrator **rules out stale/old state first** (clean reproduction / clean re-run), then classifies per diff false positive (reconstruction/measurement gap) vs. genuine defect — never soften the target comparison in order to get "green". Language/platform semantics are **substantiated executably** (`php -r`, short trial run), not claimed from memory (not from the reviewer's either). The trial run happens in a disposable environment the orchestrator registered as a run grant (§32.20); without one the reviewer returns `unklar (nicht erreichbar: Werkzeug)`. URL claims are fetched by the orchestrator into the brief (workers have no network). Reviewers/workers are given the **exact target** (container/checkout/path) in the brief.

**(7) Precondition = stop, not a basis for negotiation:** A precondition noted in ADR/Konzept ("X is a prerequisite") is a **gate**. If it is open, the slice is **blocked** — no "rescue" attempt in the same run. An open precondition in a UC or ADR blocks the slice; `impl-uc` stops with a Stop-Retro (3).

### 32.9 Skill Determinism Gate (tier classification)

§32.8 (1) applies not only to delegation but to **every tool**: A **text skill runs through an LLM** and is not reproducible (same assignment, n runs → up to n results). A **programmed skill has a fixed structure** — same input → same result, and its output *is* the evidence. Every skill/agent therefore receives a **tier** at creation (`skill-creator`) and in the quarterly audit:

| Tier | When | Form |
|---|---|---|
| **T1 — Deterministic core** | decidable (pass/fail with evidence) **+** repeated **+** structured input | programmed skill in a **host-available** runtime (default Node.js) + own tests; output = evidence |
| **T2 — Agent (LLM worker)** | genuine judgment, limited scope | subagent (§32.3), claim with evidence |
| **T3 — Text skill** | only interactive human-dialogue value (reproducibility is not the goal) | Markdown skill (e.g. `spec-interview`, `walk-through`, `adversarial-review`) |
| **Hybrid** | LLM framing → T1 core → LLM interpretation | T1 core with an LLM layer around it (e.g. `cdp5-init`: diff core plus confirmation; `pii-scan` with a `review-verify` overlay) |

**T1 skills of the plugin cdp5-gates (17):** `ac-to-test-scaffold`, `cdp5-init`, `cdp5-reference`, `konzept-const-sync`, `konzept-lint`, `konzept-mapper`, `konzept-model-api`, `mcp-config-lint`, `mcp-doc-drift-gate`, `pii-scan`, `profile-check`, `retro-memory-loop-check`, `roadmap-drift`, `secrets-scan`, `skill-lint`, `test-gap`, `wiki-lint`. **Exit-code convention:** 0 = no 🔴 finding, 1 = at least one 🔴, 2 = input error; every finding is 🔴, 🟡 or 🟢.

**Runtime (binding):** T1 skills run on the **host** on which Claude Code runs — the runtime must be **guaranteed installed** there. Default is **Node.js**, because Claude Code itself is a Node CLI and is therefore always present (one toolchain for all host-side skills). **PHP is not a host guarantee:** the projects run in Docker, PHP lives *in* the containers, not on the host. A gate that needs the project PHP runtime therefore runs **in the container via `docker exec`**, triggered by a thin host-side (Node) wrapper. T1 skills come **with their own test suite**, otherwise one merely trades LLM non-determinism for untested code bugs (real: a deterministic evaluator had a 🔴 bug with PHP array auto-index that only an executable cross-check found).

**Architecture rule:** The deterministic core is the **backbone, not the whole body.** If a skill takes free-text input, an LLM does the fuzzy framing and hands **structured** input to the T1 core — otherwise the non-determinism is only shifted upward (into selection/extraction), not eliminated.

**Governance:** A **decidable** activity that runs as a T3 text skill is a **tier error** and is ported (trigger: quarterly audit or from the 3rd repetition, §32.7). Conversely, **no** T1 program for one-shot activities (§32.7 (5)) and **no** forcing of judgment tasks into a script (that yields a worse, brittle result).

### 32.10 Fan-out Economics — when multi-agent pays off

Orchestration does **not** automatically mean many parallel agents. Three levels, from cheap to expensive:
- **Directly oneself** (no worker) — for small, clear scope, when a brief would be more expensive than the work. One-hunk rule (§32.5): a finding whose fix is one hunk without behaviour change may be applied directly and still passes `review-verify`; anything larger is a re-brief. *Start simple* (provenance: Anthropic "building effective agents": simplest solution first; agents trade latency + cost for flexibility — use only when something simpler demonstrably does not suffice).
- **One stage worker** (default for delimited specialist work) — drift isolation through fresh context (§32.1).
- **Parallel fan-out to several workers** — expensive (multi-agent consumes **~15× chat tokens**, Anthropic multi-agent research). Pays off only if (a) the subtasks are **independent + parallelizable** (§32.8 (5) self-contained) **and** (b) the value justifies the token/latency overhead.

**Gate before fan-out:** independent + parallelizable + value justifies ~15× tokens? → fan-out; otherwise sequential or direct. The answer to the gate is recorded in the ledger. (Complement to the §32.5 anti-pattern "sequentially what could run in parallel".)

**Agent architecture (production):** For agentic production UCs, the **GOAP/Embabel pattern (§13.2)** is the reference — a deterministic planner controls the flow, the LLM is a tool in typed actions ("the LLM does not control the flow, the planner does"). Agents only for decisions under uncertainty with several solution paths; not for CRUD/rule-based processes (§13.2/§13.3).

---

### 32.11 Devil's-Advocate Gate (mandatory pass before irreversible choices)

**Trigger:** every ADR with status "proposed", every introduction of a new subsystem, module or mode (§27.1.1), every choice that becomes irreversible, and the overall closing of an assignment when the assignment produced a choice. When it produced no choice, the closing pass is the artefact's counter-role `adversarial-auditor` or, for forecasts, `pessimistic-realist` (§32.24). §11.4 demands the pass for "Decide" verbatim; this paragraph makes it a gate.

**Procedure:** The orchestrator starts `devils-advocate` in fresh context (no share in the choice) with the verbatim assignment, the chosen option, the discarded alternatives and their costs. If the discarded alternative is missing, it is requested, not invented; the pass itself may form the null option. The pass delivers, per objection, an evidence location and an ex ante verifiable refutation criterion, checks the existence question (§27.1.1) and gives a three-valued verdict: (a) the rationale holds, (b) the alternative is stronger, (c) the null option beats both.

**Gate rule:** In case of (b) or (c), execution remains blocked until the human decider documents, per objection, acceptance or reasoned rejection in the ADR (§28.2). A pass without fresh context or without a named alternative is invalid and is repeated with the alternative supplied, not accepted. Verdict mapping (worker contract rule 4): (a) = pass, (a) with conditions = pass-with-conditions, (b) and (c) = block. The pass is a counter-vote, not a veto: the human decides (§23.3).

**Exclusions:** no Devil's-Advocate passes in blameless retros (§32.6) and not in humanly sensitive or private playbooks; there the cross-check is `psy-grenzwaechter`. Private decisions on health, relationships, therapy or children are excluded; private administrative, financial and legal decisions are not.

**Distinction:** Artifacts are checked by `adversarial-auditor` (ex post, empirically), forecasts by `pessimistic-realist`; the three form the counter-role triad (§32.24). The pass counts in the usage log (§32.7 (2)).

### 32.21 Fresh-context rule

Counter-roles and reviewers (`devils-advocate`, `pessimistic-realist`, `adversarial-auditor`, `psy-grenzwaechter`, `review-verify`, `review-code`, `konzept-reviewer`) never judge their own or co-authored work. The header of every pass states `fresh context: yes` or `fresh context: no`; `no` invalidates the pass, and it is repeated with a fresh instance. The orchestrator supplies the authorship of every claim or artefact in the brief, so the role can state the line truthfully; a `review-verify` brief names the author of each claim.

### 32.22 Behaviour invariance for refactoring

A refactoring changes structure, not behaviour, and the worker (`impl-refactor`) proves it: green baseline before the first change (gate chain §35.1 run and recorded); call-site inventory of every touched symbol; gate chain §35.1 run again after the change with zero new findings; a mutation sample that shows the suite turns red when the moved behaviour is broken; revert instead of repair forward when a step turns the suite red; risky changes (a changed public interface, a moved seam, concurrency) marked for `adversarial-auditor`; no commit, the delivery is the diff.

### 32.23 Bounded attempts

Two refuted hypotheses or two failed attempts on the same problem, then the worker stops and reports (worker contract rule 6, §1.10). Two sharpened re-briefs for the same finding, the second to a fresh worker instance with the refuted attempt recorded as a known-issue line, then a Stop-Retro to the human. A third attempt without new evidence is not a strategy.

### 32.24 Counter-role triad

Three counter-roles, one per object type: `devils-advocate` for choices (ADR, plan, new subsystem), `pessimistic-realist` for forecasts (estimate, date, success rate), `adversarial-auditor` for artefacts (diff, implementation, decision text). Every worker claim goes through `review-verify` before the orchestrator acts on it; MCP-bound capabilities through `mcp-security-reviewer`; psy-domain results through `psy-grenzwaechter`. A triad member declares a conflict of interest when a triad partner is at stake (its own earlier verdict, a role text, a tool it depends on); the orchestrator then picks another instance or hands the question to the human.

### 32.20 Plugin mechanics

The working path is enforced by the plugins cdp5-agents and cdp5-gates:
- **Worker contract** (skill `worker-contract`, injected at agent start): rules 1–10 (acknowledgement, evidence, data not instructions, severity and verdicts, Stop-Retro, bounded effort and scope, provenance, boundaries, fresh context, language). The first line of every answer is the acknowledgement `contract: v<N> <hash>`, `CONTRACT-MISSING` otherwise; the SubagentStop hook checks the line and asks once on a hedged completion claim (hedged-claim check).
- **Run grants and disposable environments:** `worktree-setup.mjs` creates a worktree on the exact base commit, runs the gate commands as baseline and registers the grant; `grant-run.mjs grant|list|revoke` manages grants for an existing environment. A grant is per agent type and per project, single use by default, with a TTL; a red baseline issues no grant; the brief carries the output lines verbatim or `disposable environment: none`.
- **Shell guard as tripwire:** judgment agents are read-only and without network; workers have no commit, push, fetch or history rewrite even with a grant. The guard catches the slip; the contract is the rule.
- **Usage log:** `usage-log.jsonl`, one line per run with its result (ok, no-ack, hedged, contract-missing); manual activities as `manual:<activity>` lines (§32.7).
- **SessionStart bootstrap:** prints the script and data paths and the contract header; briefs use those paths, not guesses.
- **skill-lint** (T1, cdp5-gates) runs before a foreign skill or workflow pack is installed (§32.5).

## 10.6 / 10.7 / 19 — Verification & Model↔API Consistency

The verification mechanics belong to the working path: they catch drift between target (spec/model) and actual (code).

### 10.6 Verification agent alongside review agent

An AI agent that reads both the written specification (the "target") and the written code (the "actual") can keep both in harmony at all times (provenance: Bartels 2026).

| Role | Task | Point in time |
|---|---|---|
| **Review agent** | Check spec against policies | Before implementation |
| **Verification agent** | Detect spec ↔ code drift | After every sprint |

Both are separate agents: `review-verify` and `konzept-reviewer` in the plugin cdp5-agents (its `agents/` directory is the live store, §32.7); a project without the plugin defines them in its own agents directory.

Executable substantiation (`php -r`, a short trial run) happens in a disposable environment the orchestrator registered as a run grant (§32.20); without one the verification agent returns `unklar (nicht erreichbar: Werkzeug)`. URL claims are fetched by the orchestrator into the brief; workers have no network.

### 10.7 Verification convention for obligations

**Rule:** Every statement marked "mandatory" in a Konzept must have an objectively verifiable **Nachweis-Typ (evidence type)** — otherwise a review agent cannot determine "fulfilled yes/no", and the obligation is de facto non-binding. Four permissible Nachweis-Typen:

| Nachweis-Typ | Where anchored | Example |
|---|---|---|
| **Test / AC** | Acceptance criteria table (§11.7) | "AC-2: Anonymous visitor gets 401" |
| **Policy score** | Reife-Policy (`cdp5-gates/policy/reife-rubrik.policy.md`, §7) | Dimension `ac`, weight 0,15; gate item G7 |
| **Checklist item** | Mandatory checklist (§7) | "[ ] Probabilistics statement in the header" |
| **Trace span** | OpenTelemetry span (§15.1) | `gen_ai.*` attribute per LLM call |

**Konzept bug:** A "mandatory" without an assigned Nachweis-Typ is a Konzept bug and is to be flagged in review.

**Mapping of previously prose-formulated obligations to their evidence:**

| Obligation (section) | Nachweis-Typ | Concrete evidence |
|---|---|---|
| Red teaming per LLM UC (§15.4) | Test/AC + trace | Promptfoo `redteam` config in the repo; per LLM UC an AC entry "which `harmful:*` plugins + strategies" |
| OAuth per MCP server (§16.5) | Checklist item | Per MCP server entry in the Konzept a field "OAuth: yes/no + token rotation" |
| Streaming as UX obligation (§20.1) | Test/AC | Per LLM UC a named streaming behavior (SSE/chunked) + integration test |
| Context pyramid layers (§18.2) | Checklist item | Per LLM UC a layer list + cache strategy documented |
| TAO logging per agent UC (§21.1) | Trace span | OTEL span per thought / action / observation (§15.1) |
| Knowledge cutoff handling (§15.5) | Test/AC | Cutoff test case ("iPhone 17") in the UC's AC table |
| Vendor risk statement (§2.7) | Checklist item | §7 entry "vendor risk statement present for LLM UC" |
| Hybrid validation phases (§13.2/§15.8) | Test/AC + trace | Post-phase checks (LSP/AST/CodeQL) as CI gate + AC per phase |

### 19. Consistency Check Model ↔ API (Junker pattern)

#### 19.1 Mandatory models that must be kept in sync

| Model | Format | Who maintains | When to check against code |
|---|---|---|---|
| Visual Glossary | Image + Markdown | Domain expert | Per sprint end |
| Context Map (DDD) | Mermaid / draw.io | Architect | Per sprint end |
| OpenAPI spec | YAML in the repo | Backend | Per PR |
| AsyncAPI spec | YAML in the repo | Backend | Per PR |
| ER diagram | Mermaid | DB architect | Per migration |

#### 19.2 Cycle

```
Modell-Änderung → LLM-Konsistenzcheck-Prompt (Anhang A.6) → Refactoring-Empfehlungen
  → domain experts validate → the code is adjusted (or the model is adjusted)
```

#### 19.3 Separation model ↔ diagram

Models are the single source of truth, diagrams only a restricted view (provenance: Junker 2026). LLM consistency checks ALWAYS go against the model, never against the diagram.

#### 19.4 AsyncAPI ↔ Context Map (event-driven systems)

Besides OpenAPI↔Visual Glossary (Appendix A.6), an event-driven/messaging system needs a second consistency check: **AsyncAPI against the DDD context map.** Check dimensions (Junker): service identity · relationship patterns (Conformist / ACL / Partnership / Shared Kernel) · event names · channel names · context boundaries · missing elements · versioning. Typical finding: "Service does not publish all events derivable from the context map." Per sprint end, versioned prompt.

---
## 28. Durable Plan Artifacts (the external memory)

Durable artifacts are the defense against **memory loss**: they keep domain vocabulary, architecture decisions and sprint state outside the volatile session context.

### 28.1 CONTEXT.md

**Purpose:** Living glossary + architecture assumptions + sprint strategy. SSOT between sessions.

**Mandatory contents:** Stack overview · Domain glossary (§14) · Architecture assumptions (verified + decided) with ADR references · Roles / permissions / drift markers · Sprint strategy (if active).

**Where:** Repo root or `src/<context>/CONTEXT.md` (multi-context via `CONTEXT-MAP.md`).

### 28.2 ADRs (Architecture Decision Records)

**Purpose:** Make hard / asymmetric decisions durable.

**Mandatory structure:** **Title + date** · **Decider** (human; the agent prepares, the human decides, §23) · **Source** (verbatim quote of the decision, e.g. from the brief or chat) · **Status** (proposed / decided / superseded by …) · **Context** (situation) · **Options incl. null option** · **Decision** (what was decided) · **Consequences** (plus / minus / tests / audit scope) · **Alternatives considered** (what was rejected and why) · when introducing a new subsystem/module/mode, the **four answers to the existence question (§27.1.1)** and the result of the Devil's Advocate pass (§32.11) · **Supersede link** when an earlier decision is superseded (never silent rewriting). Per key risk indicator: threshold, observer, review date. Without decider and date, an ADR is a proposal (FEHLER-08/FEHLER-13).

**Known-issue line** (Known-issue) for consciously accepted risks and rejected lint findings: `known-issue: <Punkt> | decided by: <Person> | date: <YYYY-MM-DD> | reason: <ein Satz> | source: <Ablage>`.

**Path (storage switch):** own repos → `docs/adr/ADR-NNN-<slug>.md`, numbered consecutively; company repos → only AI-free ADRs in the repo, everything AI-generated goes into the memory directory outside the repo or later the knowledge layer; private matters → with the user, in no service.

### 28.3 Slice Issue Briefs

**Purpose:** One brief per vertical slice in the tracker that lets agent or human work unattended (AFK) or triggers an architecture decision (HITL).

**Mandatory fields in the brief:** Slice number + title · HITL / AFK · Branch target (fold-in vs. own feature branch) · Scope (E2E — which layers) · Risk assessment · Learning opportunity (for slice 1) · Dependencies (which slices must be merged beforehand?) · AC list (from §11.7) · **Optional:** User stories in Pocock format "As <actor> I want <feature>, so that <benefit>".

#### AFK hardening — additional mandatory conditions

A slice may only be marked AFK if ALL of the following conditions are met. If even one is missing: the slice is HITL.

- [ ] Test setup for the slice scope is runnable in the repo (CI green on branch target)
- [ ] AC list is complete — no "still to be clarified" markers
- [ ] Domain vocabulary from CONTEXT.md / Konzept (concept document) glossary is used consistently throughout the brief
- [ ] All slices listed under "Dependencies" are already merged (not just planned)
- [ ] Branch target is named concretely (branch name or PR number)
- [ ] Reviewer chain for the auto-generated PR is defined (human approver mandatory)

### 28.4 Handoff Docs

**Purpose:** When a session is at the token limit, a slice needs several sessions, or the team changes — the main defense against memory loss *between* sessions.

**Mandatory contents:** What was done? (reference to slice issue / PR / commit range — no repetition) · What is next? · Which artifacts are SSOT? (CONTEXT.md / ADR / slice brief) · Which skills / tools should the next session use?

**Path:** `mktemp -t handoff-XXXXXX.md` or `.tmp/handoffs/YYYY-MM-DD-<slug>.md`.

### 28.5 Temporary vs. durable plan docs

| Artifact | Lifetime | Where |
|---|---|---|
| `CONTEXT.md` | durable | Repo root |
| `docs/adr/*.md` | durable | Repo `docs/adr/` |
| Slice issue in tracker | durable | Issue tracker |
| **PRD** (Problem Statement + Solution + User Stories + Implementation Decisions) | **durable** | **Issue tracker with `ready-for-agent` label** |
| Handoff doc | semi-durable (deletable after session handover) | `.tmp/handoffs/` |
| **Slice plan / sprint brief / roadmap** | temporary (until slice is completed) | `.tmp/` |
| Brainstorm notes | temporary | `.tmp/brainstorm.md` |
| Prototype code | temporary (delete or absorb) | near target module, clearly marked |

**PRD vs. slice plan:** The **PRD** is a durable issue-tracker artifact (Problem Statement, Solution, User Stories, Implementation Decisions, `ready-for-agent` label). The **slice plan / sprint brief** is a temporary `.tmp/` doc (vertical slices with HITL/AFK + dependencies + AC refs), deleted before PR. **Roadmaps are temporary** and drift → reconcile against the code before sprint planning (roadmap↔code inventory, T1 script / `konzept-mapper`; §25 anti-pattern).

> **Mandatory before PR:** Delete temporary plan docs from `.tmp/`. Truth lives in the code.

### 28.6 Context hygiene & instruction files

Durable artifacts (§28.1–§28.5) are the **external** memory; here is the maintenance of the **volatile** context (provenance: Anthropic "effective context engineering" + "Claude Code best practices"):

- **Context is a finite resource.** Accuracy drops measurably **from ~60–70 % window utilization** (context rot) — prioritize high-value info, prune low-value tokens.
- **Early warning signal:** Coding assistants do not disclose their remaining capacity; **sudden failure of large changes** or silent compaction = Memento-effect risk. When approaching the limit → handoff doc (§28.4).
- **Reset rules:** clear context between **unrelated** tasks (`/clear`); **after 2 failed corrections** of the same problem, restart with a better prompt — a clean context almost always beats a polluted one with accumulated failed attempts.
- **Just-in-time retrieval:** keep lightweight identifiers (paths, queries, links) and load data **lazily at runtime** instead of pulling everything into the context up front — the generalization of the pointer brief (§32.8 (2)).
- **Compaction preserves decisions:** when summarizing, keep architecture decisions, open points, changed files and test commands; discard redundant outputs.
- **CLAUDE.md/AGENTS.md discipline:** The instruction file is **loaded every session** → keep it short, **prune regularly** (test per line: "would removing it cause an error? if not, out"). Bloat → rules get buried and are ignored. Only what the AI **cannot derive from the code** (commands, project-specific gotchas, conventions); situational knowledge belongs in **skills (on-demand)**, not in the always-loaded file. With multiple AI tools: **`AGENTS.md`** as the tool-agnostic standard (one rule set, no drift between tools), `CLAUDE.md` only for Claude specifics.

> **Dogfood:** Exactly this reason carries the v5 structure — Parts 4/5 + appendix are skippable so that a task loads only the relevant context; CDP5 itself is subject to the pruning discipline.

---

## 27. Implementation Plan (toolbox)

**Character:** §27 is **not a workflow** and **not a phase doctrine**, but a toolbox. Which tool to pick when is decided by §29. The orchestrator (§32) selects the mode and delegates the tools defined here to the responsible stage workers (e.g. Vertical TDD §27.4 → `impl-uc`, Diagnosis loop §27.5 → `impl-debug`).

**Source foundation (inline — stands without external reading):** The implementation/review/teardown doctrine rests on two knowledge bases whose core theses are summarized here:

- **Ousterhout — "A Philosophy of Software Design":** Complexity is the enemy; it accumulates from *dependencies* and *obscurity* and shows up as change amplification, high cognitive load and "unknown unknowns". Remedies: **deep modules** (lots of behavior behind a narrow interface), consistent information hiding, "define errors out of existence", strategic rather than tactical programming. From this: module-depth vocabulary (§27.1) + Deletion-Test.
- **Pocock (`mattpocock-skills` toolkit):** operational AI-coding practices — vertical slicing / Tracer-Bullets (§27.2), throwaway prototyping (§27.3), vertical TDD loop (§27.4), diagnosis feedback loop (§27.5), HITL/AFK marking per slice, durable artifacts (§28). Skills `to-prd`, `to-issues`, `tdd`, `improve-codebase-architecture`, `diagnose`, `zoom-out` operationalize them.

### 27.1 Module-depth vocabulary (Ousterhout heritage)

| Term | Definition |
|---|---|
| **Module** | Anything with interface + implementation |
| **Interface** | Everything a caller must know: types, invariants, error modes, ordering, configuration. Not just the type signature. |
| **Implementation** | The code inside |
| **Depth** | Leverage at the interface: lots of behavior behind a narrow interface. **Deep** = high leverage. **Shallow** = interface almost as complex as implementation. |
| **Seam** | Place where an interface lives — a spot where behavior can be swapped without a code edit |
| **Adapter** | Concrete thing that fulfills an interface at a seam |
| **Leverage** | What the caller gets out of depth |
| **Locality** | What the maintainer gets out of depth: changes, bugs, knowledge concentrated in one place |

#### Mandatory heuristics

- **Deletion-Test:** Would deleting make the complexity disappear or reappear across N callers? Disappears → it was pass-through. Reappears → it earns its existence.
- **Interface = test surface:** Tests go through the interface, not through the implementation.
- **One adapter = hypothetical seam. Two adapters = real seam.**

> **State in the Konzept:** For every module extraction in §3 UC structure plan or ADR, the Deletion-Test is noted as a one-sentence answer.

#### 27.1.1 Necessity gate — the existence question before the ADR

**Binding:** mandatory gate. An ADR that introduces a new subsystem, module, table, tool or mode is incomplete without these four answers and must not be carried as "accepted". (Mode added in v6.0: the §32.11 trigger and the §32.6.1 fork balance already count a new mode as a fork.)

**Problem:** The adversarial auditor (§11.4) reviews a diff and asks "is this safe?". Nobody asks "should this exist?". §27.1 (Deletion-Test) and §1.11 (Proportionality) exist but are not applied without a gate (case study: a configuration manager with zero hits in sixteen project documents, roughly ten times the size of the assignment).

**Four mandatory answers** (one to three sentences each, in the ADR itself):
1. **Assignment verbatim** — quote the original assignment verbatim. Does this subsystem follow from it necessarily, or is it a self-imposed purity demand? Warning words: "pure", "complete", "byte-equivalent", "clean", "consistent". A self-imposed purity demand is an uncommissioned feature and needs the client's explicit release.
2. **Deletion-Test (§27.1)** — would deleting make the complexity disappear or reappear across N callers? Name N. Disappears = pass-through = do not build.
3. **Consumer** — who needs the result, by name (file:line or role)? What happens concretely if it does not exist? "Otherwise the verify reports missing" is not an answer (§25): that is the machine justifying its own extension.
4. **Simplest alternative** — what delivers the same contribution to the goal with less code? Quantify both in lines. If the factor is above 3, the burden of proof lies with building, not with leaving it out.

**Consequence rule A — consumer death is immediate disposition:** If the justifying consumer falls away (feature cut, gate removed, requirement withdrawn), every mechanism derived from it is put up for disposition at once, as a mandatory gate, not as an option (case study: the consumer was cut, its derived verification machinery kept growing for six weeks).

**Consequence rule B — reintroduction needs a revocation ADR:** A previously rejected alternative that is introduced later needs its own ADR with an explicit revocation rationale. A silent reversal under bugfix pressure is an alarm signal (case study: a sandbox boot rejected as too expensive was later introduced without revocation).

**Consequence rule C — a bug produces a simplification, not a subsystem:** If a bugfix produces a new subsystem, that is a whack-a-mole signal (fix principles, not symptoms). Look for the invariant root first. Document the chain when one fix forces a further mechanism; three links are a stop.

### 27.2 Vertical slice / Tracer-Bullet as decomposition default

| Horizontal (anti-pattern) | Vertical (default) |
|---|---|
| All migrations → all repositories → … → all tests | One Tracer-Bullet that goes through all layers for a narrow path |
| Refactor in bulk | Refactor per slice |
| PR becomes gigantic | PR per slice is demoable + reviewable |

#### Slice rules

- Every slice crosses ALL layers (schema, API, UI, tests) for a narrow path
- A completed slice is **independently demoable or verifiable**
- Many thin slices > few thick ones
- **Slice 1 = riskiest path with the highest learning opportunity**, not the easiest
- Slices have explicit **dependencies**

#### HITL / AFK marking per slice

| Marker | Meaning |
|---|---|
| **HITL** | Architecture decision, design review, stakeholder sign-off needed |
| **AFK** | Fully specified, agent can implement unattended and deliver a PR |

Concrete AFK mandatory fields in §28.3.

#### To be represented in the Konzept

```markdown
### Slice-Plan

| # | Slice | Typ | Blocked by | UC-Refs | AC-Refs |
|---|---|---|---|---|---|
| 1 | RSVP-Web-Parity (404+422) | AFK | — | UC-04 / UC-05 | AC-3, AC-4, AC-7 |
| 2 | 404-Pattern-Audit | HITL | 1 | UC-04 | (neuer AC) |
| 3 | Rate-Limit-Foundation (Redis) | HITL | 2 | UC-04, UC-06, UC-08 | AC-9, AC-10 |
```

UC refs can point to concrete UC steps (e.g. `UC-04.3.2`). User stories belong in the slice brief (§28.3), not in the slice-plan table.

### 27.3 Throwaway prototype as question answering

| Branch | Question | Form |
|---|---|---|
| **Logic branch** | "Does this logic / this state model feel right?" | Tiny interactive terminal app |
| **UI branch** | "What should this look like?" | Several radically different UI variants on one route, switchable via query param |

#### Mandatory rules (both branches)

1. **Throwaway from day one** — marked as such
2. **One command to start**
3. **No persistence by default** — in-memory state
4. **No polish** — no tests, no error handling beyond what runs
5. **Surface the state** — after every action / every switch
6. **Delete or absorb when done** — never let it rot

### 27.4 Vertical TDD loop (tightens §11.7)

§11.7 requires an AC table per UC. §27.4 says **how** it is driven.

#### Anti-pattern: horizontal TDD

```
WRONG (horizontal):
  RED:   test1, test2, test3, test4, test5
  GREEN: impl1, impl2, impl3, impl4, impl5
```

#### Correct: vertical TDD loop

```
RIGHT (vertical):
  RED→GREEN: test1→impl1
  RED→GREEN: test2→impl2
  RED→GREEN: test3→impl3
```

#### Test properties (Pocock definition)

- Tests check **behavior through public interfaces**, not implementation details
- Good tests are **integration-style**: they run real code paths through public APIs
- Bad tests: mocking internal collaborators, testing private methods

### 27.5 Diagnosis feedback loop

**"Build the right feedback loop, and the bug is 90 % fixed."** The feedback loop is the actual debugging skill (provenance: Pocock). Loop construction (try in this order):

1. Failing test at the seam that reaches the bug
2. Curl / HTTP script against dev server
3. CLI invocation with fixture input, diff against snapshot
4. Headless browser script
5. Replay of recorded trace
6. Throwaway harness
7. Property / fuzz loop
8. Bisection harness (`git bisect run`)
9. Differential loop
10. HITL bash script (last resort)

#### Iterate the loop

- Faster? (cache setup, narrow test scope)
- Sharper signal? (assert on the symptom)
- More deterministic? (pin time, seed RNG, isolate FS)

#### When no loop can be built

Stop, say so explicitly, list what was tried. Ask the user for (a) a repro environment, (b) a captured artifact (HAR, log, core dump, screen recording), or (c) permission for temporary production instrumentation. Do **not** proceed to a hypothesis without a loop.

### 27.6 Brownfield extension pattern

Mandatory order when extending existing software:

1. **Read CONTEXT.md** (or create it, §28.1) — §1.8 golden rule
2. **Read ADRs in the touch area** — on conflict, ADR update first
3. Use **domain glossary vocabulary** in test names, interface vocabulary, PRDs, issue titles — **no drift**
4. **Survey existing voters / services / repositories** before new ones are created in parallel (Deletion-Test as filter)
5. Create **slice plan** (§27.2) with dependencies between slice and existing code
6. **Vertical TDD loop** (§27.4) — hang tests on existing seams
7. **Update CONTEXT.md** before PR

Implementation workers read CONTEXT.md, the ADRs of the touch area and the glossary before the first test (`impl-uc` Method 0); test and symbol names use the glossary vocabulary.

**Two anchors for AI in existing code:** **Island of order** (provenance: Leßner) — in legacy code, create a separate folder with spotless minimal reference implementations of all building blocks (entity, repository, test builder); the AI **imitates what it sees**, so give it unpolluted models (not shipped). **Self-Contained Systems** (SCS) — subsystems with their own data storage/UI keep the AI context per UC small: a system UC refers to only one subsystem (deep-module spirit, §27.1).

### 27.7 Review/teardown mode

Architecture review or planned teardown uses §27 in reverse.

#### Review tools

- **Deletion-Test per module** (§27.1) — identify pass-through
- **Depth inventory** — interface vs. implementation complexity
- **Seam inventory** — hypothetical vs. real seams
- **Decisions archaeology** — check existing ADRs against today's reality
- **Anti-pattern scan** (§25 list)

Output: see §29 mode C.1.

#### Teardown tools

- **Reverse slicing** — teardown as a vertical-slice sequence; slice 1 = riskiest rollback
- **Adapter rollback** — keep the seam, remove all adapters but one → seam becomes hypothetical → can be deleted
- Keep **tests at stable interfaces** as verification
- **Mandatory ADR** for the teardown decision

Output: see §29 mode C.2.

---

# Part 3 — Security (agent/tool safety + AppSec)

**This part is binding as soon as a UC is tool-based/agentic, communicates externally or touches data/endpoints worth protecting** — otherwise skippable (analogous to Part 5/LLM). Security is **build-time doctrine**: model threats in the design, enforce gates in CI, prescribe secure patterns — do not react only in operation. Operational/org security is deliberately out (§33.8); regulatory compliance runs via §2.6 + cross-ref (§33.8).

## 33. Security

### 33.1 Lethal-Trifecta gate (agent threat model)

A tool-using agent is dangerous as soon as **three conditions coincide** (Lethal Trifecta, provenance: Willison 2025):
1. **Access to sensitive data** (secrets, customer data, internal APIs, file system),
2. **Contact with untrusted content** — web, e-mail, RAG documents, **MCP/tool responses**, third-party code / dependent libraries,
3. **Ability to communicate externally** (network egress, outbound tool calls).

**Gate rule:** If all three apply, at least **one axis must be broken** — restrict egress to an allowlist **or** minimize data scope **or** isolate untrusted content — **or** a human-approval gate (§23) before the risky action. Per agent/LLM UC, state in the Konzept: which of the three axes apply and which countermeasure takes effect. *(Practice: an injected prompt from a compromised library exfiltrated `.env` secrets via tool call — prompt injection is number 1 on the OWASP LLM Top 10.)* The plugin's own judgment agents are bound by the Trifecta as well: no network, grants only for disposable environments (§32.20); the orchestrator fetches external content into the brief with URL, fetch date and HTTP status.

### 33.2 Agent runtime hardening (mandatory fields per agentic UC)

- **Sandboxing** (VM/container) with **network egress allowlist** — breaks the third trifecta axis.
- **No plaintext secrets in the agent context** — secret store → environment variables (e.g. KeePass/Vault via script); remove sensitive paths from the tool context via ignore/exclude; work on particularly sensitive repos entirely without an AI plug-in where appropriate.
- **Tool/web response = untrusted input** (§15.8) — sanitize at every boundary; WebFetch/Browse only on allowlist.
- **Check diffs/commits for injected prompts** (review step) — against smuggled-in instructions.
- **Explicitly activate** protective mechanisms shipped with the coding agent (sandbox, automated security reviews), do not assume them.

### 33.3 MCP tool/server security (extends §16)

Maintain per MCP server in the Konzept:

| Mandatory field | Protects against |
|---|---|
| **Trust source** — self-built vs. third-party; vet third parties (registry/signature/pinning, check quality) | Name spoofing, third-party servers of mixed quality |
| **Descriptions are untrusted** — approval hash + **re-verification on `list_changed`** | Tool-description injection, rug pull (post-approval mutation) |
| **Tool-level authorization** — who may use which tool / which data: OAuth2/JWT/mTLS, API gateway/reverse proxy, rate limit, auditing | unauthorized access, unchecked autonomous actions |
| **Deployment isolation** — sandbox/OCI container | breakout, lateral movement |
| **Spec version + upgrade strategy** | version drift (auth/transport change quickly) |

Default = **least privilege**: only UC-relevant servers/tools visible (tool budget, §16.6/§16.7). Static tokens in `headers` and `env` are checked by `mcp-config-lint` (T1), which also flags unpinned `npx`/`uvx` commands and docker images and remote `url` servers; the remaining fields are judged by `mcp-security-reviewer` by hand.

### 33.4 Threat modeling "light" in the design

Mandatory for **new APIs, new trust boundaries, external interfaces or agent/tool UCs** — a short pass (45-minute format suffices) in the design, **before** code is written:
1. **What are we building?** — a data-flow sketch (entry points, trust boundaries, data sinks).
2. **What can go wrong?** — STRIDE across the boundaries (Spoofing / Tampering / Repudiation / Info Disclosure / DoS / Elevation); for LLM UCs additionally §33.6.
3. **What do we do?** — prioritized threat list (rough risk = likelihood × damage); one countermeasure per top threat as an **AC** (§11.7).
4. **Good enough?** — note residual risk; for high risk additionally §2.6.

Output (sketch + threat list) into the Konzept; mandatory section when there is a security-relevant share (§7).

### 33.5 Security gates (build blockers, stricter than quality gates)

AI code is **subject to review like a junior contribution**. Security gates are more binding than quality gates and run **project-wide** (not only for AI code as in §15.8):
- **SAST** (CodeQL/SonarQube/Semgrep) — CRITICAL blocks the build.
- **Dependency scan + SBOM** (CycloneDX/SPDX per release); OSS intake criteria (OpenSSF Scorecard, active maintenance, license whitelist); CVE CRITICAL blocks.
- **Secret scan** (gitleaks pre-commit) + secrets management (Vault/KMS, IaC secrets separate) — no plaintext secret in the repo.
- **Security linter** + optionally AI-assisted security reviews (targeted prompts/agents against OWASP Top 10 classes) **as an additional review track, not as a replacement** for human reviews; for critical paths, pen test / automated security tests.

### 33.6 LLM threat classes (extends §15.4)

Per LLM UC, state the relevant classes + countermeasure (orientation: OWASP GenAI Top 10, §15.7):

| Class | Attack | Countermeasure |
|---|---|---|
| **Input** | Prompt injection, jailbreak | §15.4 red teaming · untrusted input §15.8 · Lethal-Trifecta gate §33.1 |
| **Output** | Hallucination, insecure code | §15.8 hybrid validation · §33.5 gates |
| **Model** | Model stealing, model inversion | API rate limit/auth · output monitoring · do not disclose internal model details |
| **Dataset** | Data poisoning, training-data extraction | Training-data provenance · check RAG sources for access rights |

### 33.7 Double review + license/IP for AI code

**Double review (mandatory when there is an AI share):** (1) **Self-review before commit** by the AI-using dev — understand, question, refactor the suggestion; (2) **then** regular PR review by a second human. This way AI code is checked by two people (AI code = junior contribution, subject to review; only ~3 % of professionals adopt AI output unchecked).

**License/IP:** Keep the public-code filter active (e.g. Copilot); be careful with large, contiguous, barely adapted AI blocks (e.g. algorithms) — copyleft/GPL risk. Trivial snippets/standard patterns are usually uncritical.

### 33.8 Principle pointers, scope delimitation, compliance cross-ref

- **Zero trust** (principle): trust no component implicitly, authenticate every access, least privilege, micro-segmentation — for service-to-service **and** agent-to-tool.
- **IaC security** (pointer): AI-generated IaC passes through the §33.5 gates; additionally IaC scanners (Checkov/tfsec) against misconfiguration/drift.
- **Outside build-time scope** (→ wiki, not doctrine, §1.7): incident response/runbooks, Kubernetes RBAC detail, security awareness/gamification, OWASP SAMM org maturity.
- **Regulatory compliance:** EU AI Act risk class + high-risk obligations → §2.6. CRA/NIS2 as well as the detailed high-risk obligations (conformity assessment, EU database registration, FRIA, post-market monitoring, log retention) are a separate compliance strand — cross-ref, not elaborated here.

---

# Part 4 — Konzept Doctrine (authoring)

How a Konzept is written and reviewed. Mandatory structure, UC build-up, review (shift-left), AI limits, glossary. *(The prompt patterns for the Konzept lifecycle are in Appendix A; two fully worked example UCs in Appendix B.)*
## 2. Mandatory Structure of a Konzept (concept document)

Every Konzept must contain these sections, in this order: §2.1 Header, §2.2 Table of Contents, §2.3 Role Overview, §2.4 Use Cases, §2.5 Technical Appendices, plus §2.6 (Probabilistics Statement) and §2.7 (Vendor Risk Statement) for LLM UCs.

### 2.1 Header

```markdown
# {Project name} – User Konzept

**Version:** X.Y
**As of:** {Month Year}
**Scope:** {1–3 sentences: What does this system do? For whom? What are its limits?}
```

**Scope rule:** The scope also states explicitly what the system does **not** do. This prevents scope creep. Example: *"Symfony bundle for file upload, management, variant generation, access protection and storage adapters. **Not included:** image editing, OCR, virus quarantine."*

### 2.2 Table of Contents

Numbered list of all UCs with anchor links. Grouped into thematic blocks when there are > 10 UCs.

### 2.3 Role Overview

Table of all actors **before** the UCs begin. Every role needs: a technical name (for code), scope (global / resource-bound), a one-sentence description, a typical real person.

```markdown
| Role | Scope | Description | Typical person |
|-------|-------|-------------|-----------------|
| `Admin` | Global | Full access + configuration | IT lead |
| `Sachbearbeiter` | Global | Day-to-day business | Office clerk |
```

**Rule:** Roles in backticks → directly usable as code.

### 2.4 Use Cases (Main Part)

```markdown
## UC-{No.}: {Verb + Object}

**Actor:** {Role(s)}
**Route:** `{/pfad}` (optional: API: `METHOD /api/...`)

### {Context section}
...

### Error cases / Special cases
...
```

Detailed structure see §3.

### 2.5 Technical Appendices

At the end of the document, after all UCs: entity overview (table: Entity, Table, Description) · status lifecycles (ASCII) · Mercure topics (if real-time) · API Platform endpoints (if API) · external dependencies (libraries, services).

### 2.6 Probabilistics Statement in the Header

If the system contains LLM components, a **Probabilistics Statement** in the header section is mandatory (principle §1.5):

```markdown
## Probabilistics Statement

This system uses LLM components in the UCs: {list}.

| UC | Tolerance threshold | Validation strategy | Fallback | EU AI Act risk class |
|---|---|---|---|---|
| UC-XX | 95 % correctness | LLM-as-Judge + schema validation | Escalation to case worker | limited |
| UC-YY | 70 % correctness | Schema + substring match | Default answer | minimal |
| UC-ZZ | n/a (deterministic + senior sign-off) | LSP/AST + senior review | manual intervention | **high** (HR decision) |

Safety-critical UCs without LLM: {list}.
```

**Additionally mandatory for high-risk UCs (EU AI Act):** data governance documented · logging of all LLM calls + human validation steps · human oversight as an explicit UC step · robustness/accuracy tests · transparency obligation (user knows that AI is involved) for limited + high. **Provider/deployer obligations before placing on the market:** conformity assessment · registration in the EU database · quality management system · post-market monitoring · **FRIA** (fundamental rights impact assessment, where required) · automated log retention **≥ 6 months**.

**Beyond the EU AI Act** (for products with digital elements, separate compliance track — cf. §33.8): **CRA** (Cyber Resilience Act — vulnerability management obligation from placing on the market) and **NIS2** (Art. 21, incl. supply-chain risk assessment). For high-risk UCs involving personal data additionally **DSK measures**: intervenability/machine unlearning, adversarial input filter, protection against model stealing, check RAG source access rights.

**Safety-critical decisions remain deterministic (§13.3)** — entry "n/a (deterministic + senior sign-off)", not as a probabilistic LLM UC.

**Risk class scale (EU AI Act):** **Unacceptable** — prohibited (e.g. social scoring by authorities), must not be implemented · **High** — strict obligations (data governance, logging, human oversight, robustness); e.g. medical diagnostics, HR decisions · **Limited** — transparency obligation; e.g. chatbots, deepfakes · **Minimal** — no additional obligations; e.g. spam filters, game AI.

**Legal basis + timeline (inline, as of May 2026):** Regulation (EU) 2024/1689 ("KI-VO" / EU AI Act), in force since August 2024, staggered applicability:
- since **Feb 2025**: ban on unacceptable practices + AI literacy obligation
- since **Aug 2025**: obligations for general-purpose AI models (GPAI)
- from **Aug 2026**: transparency obligations; governance structures for high-risk under Annex III must be in place
- from **2 Dec 2027**: full high-risk obligations for standalone Annex III systems (biometric systems, recruitment, education, creditworthiness)
- from **2 Aug 2028**: high-risk obligations for AI embedded in regulated products under Annex I

The postponement of the Annex III/I deadlines was made by the **Digital Omnibus of 7 May 2026**. In the Konzept, for a high-risk UC: name the applicable deadline + annex assignment (III vs. I) explicitly.

### 2.7 Vendor Risk Statement (Mandatory for LLM UCs)

```markdown
## Vendor Risk Statement

| UC | Provider | Model | Migration strategy | Data sovereignty |
|---|---|---|---|---|
| UC-XX | Anthropic | claude-opus-4-8 | Spring AI adapter (provider switch via config) | PII anonymization via Presidio before send |
| UC-YY | local (Ollama) | llama-3.1-70b | self-hosted, no vendor | full sovereignty |
```

**Mandatory threshold:** for **every** LLM UC (including local/PoC). As soon as any LLM is involved, it must be transparent: which provider, how a switch works (Spring AI / LangChain / model-layer abstraction), where the data flows (PII anonymized before send? Self-hosting fallback?). Only for purely deterministic Konzept documents **without** an LLM UC does §2.7 not apply.

---

## 3. UC Structure in Detail

### Mandatory fields per UC

| Element | Mandatory | Description |
|---------|---------|-------------|
| Actor | Yes | Who triggers this UC? |
| Route | Yes | HTTP path. For purely systemic UCs: "System (automatic)" |
| Form fields | Conditional | If user input is present |
| Behavior / Flow | Yes | What happens step by step — **numbered** |
| Error cases | Yes | At least the 2–3 most likely |

### 3.0 Flow Numbering

**Always number** the flow steps in the behavior section (Aktogramm principle). Enables precise AI prompts: "Implement step 3.2 from UC-05."

```markdown
### Behavior

1. User clicks "Save"
2. Validation of the mandatory fields
   2.1 Check e-mail format
   2.2 Check passwords for match
   2.3 Check username for uniqueness (DB query)
3. On validation error: error message inline, form stays open
4. On success: save record, send confirmation e-mail (async)
5. Redirect → `/dashboard?registered=1`
```

**Why numbers matter:** AI can be pointed precisely at step X.Y · change tracking · verbal references in other UCs · test cases refer directly to step numbers.

### Optional elements (situational)

| Element | When |
|---------|------|
| Status lifecycle | Mandatory as soon as any entity has a status; otherwise the Konzept carries the sentence `No status lifecycle: <reason>` (German: `Kein Status-Lebenszyklus: <Grund>`). `konzept-lint` accepts either (gate G4). |
| Validation rules | When fields have complex rules |
| Rate limits | When abuse is possible |
| Security rules | When auth/data protection is affected |
| Special cases | When the standard path has exceptions |
| Manual equivalent | When technically complex and not intuitive |

### 3.1 Form Fields Table

```markdown
| Field | Type | Mandatory | Note |
|------|-----|---------|---------|
| Name | Text | Ja | max. 200 characters |
| Status | Auswahl | Ja | `aktiv` / `inaktiv` / `archiviert` |
| File | Datei | Nein | PDF, max. 10 MB |
```

**Type vocabulary:** `Text`, `Textarea`, `Rich-Text`, `E-Mail`, `Tel`, `URL`, `Zahl`, `EUR`, `Datum`, `Datetime`, `Auswahl`, `Multi-Auswahl`, `Tag-Input`, `Toggle`, `Checkbox`, `Datei`, `Bild-Upload`, `Passwort`, `Signatur-Pad`, `User-Auswahl`, `Adresse`.
**Mandatory values:** `Ja` (yes) · `Nein` (no) · `Bed.` (conditional, condition in the note) · `Konfig.` (depends on system configuration).

### 3.2 Error Cases Table

Always as a table, never as running text.

```markdown
### Error cases

| Case | Message / Behavior |
|------|---------------------|
| E-mail already registered | "An account already exists for this e-mail." + link to /reset-password |
| File too large | "Maximum file size: X MB." |
| No permission | 403 Forbidden |
```

**Error cases checklist:** input validation errors · duplicates / conflicts · not found (404) · no permission (403) · external services unreachable · rate limit reached · status conflicts.

### 3.3 Status Lifecycle

Always as an ASCII diagram. **Rule:** Every status needs at least one incoming and one outgoing transition (except start and end status).

```markdown
New → In progress → Quote created → Won
                                  └→ Lost
                                  └→ No need
```

### 3.4 Manual Equivalent

For technically complex or non-intuitive Konzept documents (bundles, AI systems, batch processes). Purpose: AI and developers immediately understand the context without domain knowledge. Flow steps numbered.

**Note:** User stories are a concrete derivation from UC + AC and belong in the slice brief (§28.3), not in the Konzept UC. UC = abstract level; AC = acceptance criterion (§11.7); user story = concretization. Vocabulary see §14 Glossary.

---

## 4. Classification of UCs by Actor

| Category | Typical route | Description |
|-----------|---------------|-------------|
| **User UC** | `/feature/...` | Self-service by logged-in user |
| **Case-worker UC** | `/manage/...` or in the main UI | Day-to-day business, data maintenance |
| **Admin UC** | `/admin/...` | Configuration, user management |
| **System UC** | No HTTP | Automatic, cron, messenger, events |
| **CLI UC** | `bin/console ...` | Manual or scheduled commands |

**Route convention:** user area `/profile/...`, `/garage/...`; case worker directly without prefix (`/contacts`, `/projects`); admin under `/admin/...`; API Platform under `/api/...`.

## 5. Entity Overview

Mandatory at the end of every Konzept (table: Entity, Table, Description).

**Table naming convention per project:** bundle (reusable) → `{bundle}_` prefix (`notif_notifications`, `media_files`); app (project-specific) → no prefix (`contacts`, `projects`); add-on module → `{modul}_` prefix. Prefixes prevent table conflicts when several bundles are in one app.

## 6. Versioning of Konzept Documents

| Version | Meaning |
|---------|-----------|
| 1.0 | First complete Konzept |
| 1.x | Additions, new UCs, no breaking changes |
| 2.0 | Structural rework, changed UCs |

**Changelog section** mandatory from v2.0 (list of changes relative to the previous version). The lint (gate G9) accepts a missing changelog while the parsed version is below 2.0; without a parsable version the changelog is required.

## 7. Checklist before Completion

> This list is the **Gate** (layer 1) of the maturity policy `plugins/cdp5-gates/policy/reife-rubrik.policy.md` (items G1–G15 with G5a/G5b, each marked as [det] for `konzept-lint` or [jdg] for `konzept-reviewer`). The policy is the only rubric; §9 A.2, §10.3 and §10.5 refer to it. An open gate item means "not mature", regardless of the score. Threshold and weights live in the policy file, not here.

**Basic checklist:**
- [ ] All UCs have numbered, branched steps (§3.0) [G1, det]
- [ ] Document head with Version and Scope (§2.1) [G2, det]
- [ ] Error-case table per UC (§3.2) [G3, det]
- [ ] Status lifecycle present, or the exemption sentence `No status lifecycle: <reason>` (§3.3) [G4, det]
- [ ] Role overview present (§2.3) [G5a, det]
- [ ] Role overview current: every actor named in a UC is a row, no stale role [G5b, jdg]
- [ ] Probabilistics Statement in the header for LLM UCs (§2.6) [G6, det]
- [ ] Acceptance criteria table per UC (§11.7) [G7, det]
- [ ] Glossary present (§14) [G8, det]
- [ ] Changelog entry, or head Version below 2.0 (§6) [G9, det]
- [ ] Case-worker test passed (§1.1) [G10, jdg]
- [ ] No open assumptions — ambiguities + open decisions resolved in dialogue, not guessed (§1.9) [G11, jdg]
- [ ] Actor and Route per UC (§3) [G12, det]
- [ ] Vendor Risk Statement for LLM UCs (§2.7) [G13, det]
- [ ] Entity overview (§5) [G14, det]
- [ ] Responsibility matrix (§23.1) [G15, det]

**Extension for implementation-plan share** (mode A/B/C/D/E per §29):
- [ ] CONTEXT.md present or created (§28.1)
- [ ] ADRs in the touch area read; on conflict an ADR update is planned (§1.8 + §27.6)
- [ ] Slice plan with HITL/AFK marking and dependencies (§27.2 + §28.3)
- [ ] AC table per UC per slice (§11.7 + §27.4)
- [ ] For brownfield: Deletion-Test rationale per new module (§27.1)
- [ ] For review/teardown: output schema from §29 mode C fulfilled (C.1 or C.2)
- [ ] For LLM UC: hybrid validation layers + phases pre/inline/post (§13.2 + §15.8)
- [ ] For high-risk EU AI Act UC: data governance + logging + human oversight + robustness tests (§2.6)
- [ ] Vendor Risk Statement present for LLM UC (§2.7)
- [ ] Validation mindset level in the responsibility matrix (§23.1)

**Extension for agent/tool/security share (Part 3):**
- [ ] Threat modeling "light" carried out; threat list + countermeasure ACs in the Konzept (§33.4)
- [ ] Lethal Trifecta axes identified per agent/tool UC + countermeasure (§33.1/§33.2)
- [ ] Per MCP server: trust source, tool authorization, isolation, spec version (§33.3)
- [ ] Security gates (SAST · dependency scan+SBOM · secret scan) active as build blockers (§33.5)
- [ ] LLM threat classes identified per LLM UC (§33.6)
- [ ] Double review (self before commit + PR) + public-code filter (§33.7)

> The anti-pattern checklist for the review is in **§25** (Part 6).

---

## 10. AI Review of the Konzept (Shift Left)

### 10.1 Shift-Left Principle

The Konzept itself is checked by AI — **before** a single line of code is written. Error detection moves forward; the AI takes over the dull legwork of consistency checking (provenance: Bartels 2026). This is cheaper than finding errors in the implementation.

### 10.2 What AI Checks in the Konzept

| Check category | Example error |
|---------------|----------------|
| Logical contradiction | Step 3 requires status X, but step 1 sets Y |
| Interface gap | UC-05 references field `customer_id`, but UC-01 does not create it |
| Missing exception handling | Flow describes no case for a negative numeric value |
| Prose logic | "depending on the situation" without defining the situations |
| Data type conflict | Field described as `Text`, but an arithmetic operation implies `Zahl` |
| Architecture violation | UC describes UI logic in the backend service |

### 10.3 Review Cycle

```
Konzept draft → konzept-lint (gate det items + partial score) → konzept-reviewer (gate jdg items + score + gap list)
  → Developer decides: fix or "Won't Fix" (Known-issue (known issue) line, §28.2) → Next review run (max. 2 judgment rounds, then human)
  → Gate passed AND score ≥ threshold of the project policy → ready for implementation
```

Threshold and scale are in the project policy (plugin default 8.0), not in the doctrine; the reviewer reports reaching the threshold as a finding, the project decides.

**Interview mode instead of a static gap list (provenance: Bartels):** Interview mode runs in the session as the T3 skill `spec-interview`: it finds **one** gap, asks **one** targeted follow-up question, receives the answer and weaves the correction directly into the structured document — only then the next round (analogous to the initial spec interview, Appendix A.3). The review agent `konzept-reviewer` stays read-only: it verifies the lint's det items instead of re-deriving them, judges G5b, G10 and G11, scores the judgment dimensions on the anchored levels of the policy or returns `Unknown`, and re-scores the edited document in a fresh context. At most two judgment rounds, then the human.

**Structured input beats prose:** A review/verification agent delivers significantly better results when the spec is available as a **machine-readable tree** (numbered steps, branches, error cases — §3.0) instead of running text. The §3 structure is thus not only human-optimal but agent-optimal.

### 10.4 Score as a Basis for Discussion

The score is not an absolute quality value but a basis for discussion. A consciously accepted risk (e.g. a later I18N migration) may be marked as a "Known Issue".

### 10.5 Directory Convention for Review Agents

```
.github/
├── agents/
│   └── uc-review.agent.md            # Persona — critical software architect
├── ai/
│   ├── glossar.md                    # Domain model + semantic anchors
│   ├── architektur-regeln.md         # Cross-cutting conventions
│   └── decision-policies/
│       ├── implementation-clarity.policy.md   # 70 % weight
│       └── integration-clarity.policy.md
```

The persona defines the review role (critical architect, scores UCs against the policies, proposes no implementation, uses the glossary). Policies are weighted and define pass/fail. The layout shown here is an **example of a directory convention**, not a rubric; the applicable rubric is the maturity policy of the cdp5-gates plugin (`policy/reife-rubrik.policy.md`, gate plus weighted dimensions). In Claude Code, agent files live under `.claude/agents/` or in the plugin; in company repos neither is committed (§28).

> Verification agent (§10.6), verification convention (§10.7) and model↔API check (§19) are in **Part 2** — they belong to the working path.

---

## 11. AI Limits when Using the Konzept

AI shines at boilerplate, prototypes, explanations and small, self-contained modules; with mature codebases with special conventions its usefulness drops rapidly (provenance: Mahringer 2026).

### 11.1 When AI Helps Well with the Konzept

Initial scaffold (structure, UCs) from a short description · identify missing UCs (review) · add error cases · propose data types and validation rules · derive the entity model from UC descriptions · sharpen wording.

### 11.2 When Human Control Is Mandatory

| Area | Why AI is not enough |
|---------|--------------------------|
| Domain correctness | AI does not know the domain — the case worker must confirm |
| Regulatory requirements | Legal texts must be referenced directly |
| Safety-critical logic | Probability-based generation + safety = risk |
| Architecture decisions | AI proposes, the architect decides |
| Business rules with exceptions | AI leaves out edge values and special cases |

### 11.3 Avoiding Cognitive Offloading (incl. Concrete Containment)

The developer must not become the „externen Speichercontroller des Assistenten" (provenance: Mahringer 2026). The Konzept must be understood by the developer themselves — not only by the AI. Whoever cannot explain the Konzept has AI output without understanding; that leads to errors nobody finds anymore. **Countermeasure:** after an AI-generated Konzept draft, always a manual walk-through (§23.2). Concrete exercises:

| Exercise | Frequency | Goal |
|---|---|---|
| Read UC aloud + explain | per UC, once | Check understanding |
| Describe 1 UC per week "from memory" | weekly | Reconstruct knowledge |
| Keep a follow-up-question logbook | per sprint | Where was the Konzept unclear? |
| Be able to "defend" an AI-generated proposal | on every adoption | Responsibility cannot be delegated |

*(v5: §11.6 "Containing cognitive offloading concretely" is folded in here — same lesson.)*

### 11.4 Four-Superpowers Register as Human Anchor — Sycophancy at Decide

| Superpower | Description | Where to show it in the Konzept? |
|---|---|---|
| **Communicate** | Stakeholder workshops, domain storytelling, event storming | Actor list + process note |
| **Decide** | Architecture + strategy decisions. AI proposals tend toward confirmation (sycophancy, Kruse 2026) — Decide demands active refutation, not passive acceptance. Mandatory devil's-advocate pass (`devils-advocate`, §32.11) or a second model as counter-vote. | Decision records with a human approver |
| **Adapt** | Course change on new insight | Version history + changelog |
| **Make Mistakes** | Learning from errors → better decision next time | Lessons-learned register / retro ADR |

**Review corollary (🔴 slices):** For risky pipeline/architecture slices, **self-review and a merely confirming "pro" agent do not count as review**. Binding is the counter-role `adversarial-auditor` (plugin cdp5-agents, §32.11) plus an **empirical counter-check against the real target** (exact repo/checkout/container). Green tests + self-audit + pro agent in practice share the same blind spot (sycophancy) — only the auditor found the latent data-loss path, and only the executable counter-check (`php -r` against real PHP) exposed a wrong semantic assumption that the reviewer had co-confirmed.

### 11.5 AI Tests Are Often Tailored to the Code (Anti-Pattern)

AI likes to generate test cases that are fitted to the code — tests thereby lose part of their value (provenance: Fondermann 2026). Regulate in the Konzept:
- Test cases are derived from the UC **before** implementation (TDD spirit)
- AI-generated tests MUST be oriented on UC steps + the error cases table, not on the code
- Mandatory: every UC has test cases per error case + per status transition
- AI-generated tests are checked manually for "fits the spec, not the code"

### 11.7 TDD-First — Test Cases in the Konzept BEFORE Implementation

Tightening of §11.5: Test cases belong **in the Konzept document itself**. Order non-negotiable:
1. **Derive test cases** from the UC spec (acceptance criteria + error cases table + status transitions)
2. **Write test cases into the Konzept** as an acceptance criteria table per UC
3. **Implement tests** (unit + integration), document green/red
4. **Implementation starts only after that**

> **Bridge to §27.4:** §11.7 says **what** must be in the Konzept (AC table). §27.4 says **how** these ACs are run in the implementation as a vertical TDD loop (one test → one impl → repeat, never horizontal TDD).

#### Mandatory section per UC: acceptance criteria as test cases

```markdown
### Acceptance criteria (Test-First)

| # | Criterion | Test type | Test class | Status |
|---|---|---|---|---|
| AC-1 | Logged-in user with role X can execute UC | Integration | UCXxxControllerTest::testHappyPath | red |
| AC-2 | Anonymous visitor gets 401 | Integration | UCXxxControllerTest::testAnonymousDenied | red |
| AC-3 | Status transition Pending → Active only by Admin | Unit | UCXxxStateProcessorTest::testStatusGuard | red |
| AC-4 | On invalid IBAN → form error inline | Integration | UCXxxFormTest::testIbanValidation | red |
```

**Why TDD-First:** Spec gaps become visible early (whoever cannot formulate a test case has not understood the UC) · AI-generated tests stay spec-conformant · the implementation prompt becomes more precise · refactoring safety.

**Mandatory granularity per UC** (supplements §7): at least one AC per success path · one AC per error case · one AC per status transition · one AC per security constraint (owner / tenant / role) · test class names given (even if the class does not exist yet).

---

## 14. Glossary Section (Mandatory for AI-Assisted Development)

Semantic anchors are terms that trigger a strong, precise definition in the LLM's feature space — instead of explaining 200 lines, one writes "TDD, London School" (provenance: Müller 2026). Every Konzept of medium complexity or higher needs a **glossary section** at the end as a prompt shortcut: instead of passing the full context with every AI request, a reference to the glossary term suffices.

```markdown
## Glossary

| Term | Definition | Semantic anchor |
|---------|-----------|-------------------|
| `SiPo` | Safety lookout per DGUV regulation 78 | DGUV V78, track construction, railway operations |
| `ClubOfficer` | BGB board of a registered association (§26 BGB) | association law, power of representation |
| `Aktogramm` | Further development of the Struktogramm for use-case specifications | Specman, Nassi-Shneiderman |
```

**When mandatory:** domain-specific technical terms · several actors with differing technical vocabulary · regulatory abbreviations · AI components present (glossary becomes part of the system prompt). **Semantic anchor = 2–4 keywords** that the LLM associates with the term.

**Mandatory entry "User story":** Concrete derivation from UC + AC in the format "As <actor> I want <feature> so that <benefit>". Not a mandatory element of §3 (UCs) — a concretization stage between UC and implementation, documented in the slice brief (§28.3). **Bridge:** UC → AC → user story → slice. The domain glossary is non-negotiable vocabulary for every brownfield extension (§27.6): test names, interface vocabulary and PRD terms are fed from the glossary.

---

## 17. Integration into Versioning and Tooling

The Konzept is not a free-standing document but part of the repo toolchain. Mandatory integration points:

| Integration point | Convention |
|---|---|
| **Versioning** | Konzept file lives in the repo (`docs/` or `wiki/`), is committed along. Changelog from v2.0 (§6), version in the header (§2.1). |
| **Review agent** | `konzept-reviewer` from the plugin cdp5-agents (or a project-local agent of the same contract); the maturity policy `reife-rubrik.policy.md` with its weighting (§10.5), project copy optional. CI runs `konzept-lint` on changed Konzept files; the review agent runs on top. |
| **Verification agent** | After every sprint, check spec↔code drift (§10.6) — the Konzept is the `Soll` source. |
| **Glossary as system prompt** | The glossary (§14) is fed into the system prompt of the AI assistants; semantic anchors reduce prompt length. |
| **Consistency check model↔API** | At every sprint end via versioned prompt (§19 + Appendix A.6). |
| **Durable plan artifacts** | CONTEXT.md + ADRs live next to the Konzept in the repo (§28) and are the SSOT for brownfield (§1.8). |

---

## 23. Human Responsibility Clause + Walk-Through Obligation

*(Applies to all Konzept documents, LLM as well as deterministic — therefore in Part 4 (Authoring), not in the skippable Part 5. The responsibility matrix bites hardest with an AI share, but is also mandatory for deterministic UCs.)*

### 23.1 Mandatory Section at the End of the Konzept: Responsibility Matrix

```markdown
## Responsibility Matrix

| UC | AI share | Human validator | Validation mindset level | Liability in case of damage |
|---|---|---|---|---|
| UC-01 | 80 % | Case worker (mandatory confirmation) | high (active validation mandatory) | Case worker |
| UC-02 | 30 % | Developer (code review) | medium (sign-off by senior-level validator) | Developer |
| UC-03 | 0 % | — | n/a (deterministic) | System owner |
```

**Validation mindset level:** **high** (active, critical, questioning validation; AI output > 50 % requires high-level validation or sign-off) · **medium** (structured validation with checklist/pattern reference; AC table point by point) · **low (passive)** (anti-pattern §25 — not permitted with AI share > 30 %).

**Mandatory rule:** AI output with a high AI share (> 50 %) **must** go through validation mindset level "high" — directly or via sign-off. The level describes the validation *activity*, it is **not** tied to HR hierarchy (junior/senior) (provenance: Wilke/Loje/Krypczyk 2026).

### 23.2 Walk-Through Obligation (before Sprint Start)

Per UC at least once: read aloud · be able to explain (without the Konzept document in front of you) · name three test cases per UC freely from memory · on gaps, supplement the Konzept, do not implement.

### 23.3 Mensch-Gate (human gate): Irreversible and Externally Effective Steps

The sentence "destructive/irreversible steps remain a Mensch-Gate, never auto" is the rule that roles escalate to with "§23". It applies to technical as well as business steps:

- technical: schema drop, force-push, migration cutoff, branch delete, deletion of data or environments;
- integration: release of an MCP server or an external integration (§33.3), especially with an unbroken Lethal Trifecta or an unvetted third party;
- business: investor outreach, term-sheet commitment, signature, sending externally;
- decisions: every choice that does not survive the devil's-advocate pass (§32.11) with verdict (b) or (c), and every forecast that hits "nicht tragbar" (not acceptable) plus an irreversible commitment.

The human decides, with decision-maker and date in the ADR (§28.2); an agent prepares and halts. Every agent reports a block with its §23.3 class; the orchestrator holds the gate, no agent calls it. Health and crisis topics: the human gate is the person's real-world contact named by PSY:krisen-eskalation and PSY:versorgungspfad-deutschland; an unresolved `psy-grenzwaechter` block is handed to the person with that contact and is not decided by the orchestrator or recorded in an ADR.

---

# Part 5 — LLM/Agent Extensions (only for LLM UCs)

**This part can be skipped if no UC calls an LLM.** It supplements the Konzept doctrine (Part 4) with the specifics of probabilistic/agentic UCs: mandatory fields, agent structure, observability/eval, MCP, layer architecture, TAO cycle, PoC path.
## 13. LLM-Specific Extensions to the Konzept (concept document)

### 13.1 Mandatory Fields for LLM UCs

| Element | Description |
|---------|-------------|
| Context definition | Which data is passed as context? (documents, DB queries, history) |
| Output data format | What type does the LLM output have? (free text, JSON schema, typed object) |
| Validation strategy | How is the output checked? (syntactic, semantic, LLM-as-Judge) |
| Fallback behavior | What happens when the LLM returns an unusable answer? |
| Knowledge-cutoff handling | Which data may be outdated? How is currency ensured? |

### 13.2 Agent-Based UCs — Embabel Pattern + Pre/Inline/Post Phases

Structured, planning-based approach instead of a loose chain of LLM calls (provenance: Baumgartner 2026):

```markdown
### Agent Structure (Embabel Pattern)

**Goal:** {What should the agent achieve?}

**Actions:** (each action is a deterministic method + optionally an LLM call in the deep path)
- `{ActionName}`: input type, output type

**Conditions:** (type-bound — preconditions for an action)
- {Action `X` is possible when the previous output is of type `Y`}

**Output types:** (sealed interface mandatory for the planner)

```java
public sealed interface Signals permits SignalsOk, SignalsNeedsDeep { }
public record SignalsOk(String text, boolean confident) implements Signals {}
public record SignalsNeedsDeep(String text, String reason) implements Signals {}
```

**Fast Path (deterministic — without LLM):** {heuristics, keyword match}
**Deep Path (LLM-supported):** {When is the LLM activated? Under which conditions?}
**Goal-Oriented Action Planning:** The planner determines at runtime which actions in which order reach the goal — based on the available output types.
**Uncertainty threshold:** {Confidence < 0.5 → escalation to a human}
```

**Rule:** If the flow would also be correct without an LLM, no agent is needed. Agents are for decisions under uncertainty — not for deterministic CRUD logic.

#### Hybrid Validation Phases (Pre/Inline/Post)

Embabel is one concrete implementation. Generically: every LLM call has three possible validation phases in which deterministic validation stands next to probabilistic LLM generation — the solution lies not in "more model" but in deterministic validation layers on top (provenance: Mahringer 2026):

| Phase | When | Example validation |
|---|---|---|
| **Pre** | before the LLM call | input schema check, token budget check (prevent the memento effect), cache-hit check, PII anonymization |
| **Inline** | during the LLM call (streaming) | sealed-interface match on the token stream, mandatory-substring check, inline toxicity filter, fast/deep path decision |
| **Post** | after the LLM call | LSP/AST/CST parser, automated reasoning, CodeQL/SonarQube, vertical-TDD AC check (§15.8 + §27.4) |

In the Konzept per LLM UC: which phases are active, which concrete validations per phase?

> **Terminology clarification "phases":** These pre/inline/post validation phases refer to a single LLM call (micro level). They are NOT the workflow/implementation phases — CDP5 is deliberately **not a phase workflow** (Part 0). The PoC phases in §22 (macro level) are a third, separate meaning as well. Same word, three levels — always name the section when referencing.

### 13.3 When NO LLM in the UC

Fully deterministic flow · safety-relevant decisions · regulatory traceability mandatory · highly regulated environment (medicine, finance, railway safety). In the Konzept as a note: `> **No LLM:** …` or `> **Deterministic UC:** no AI component.`; the lint ignores the note when it classifies the UC as LLM or deterministic (gates G6, G13).

### 13.4 Validation Strategy in the Konzept (extended)

| Strategy | When | Example tool / assertion |
|---|---|---|
| Syntactic check | Always | JSON schema, type check, sealed-interface match |
| Rule-based check | For known constraints | value within the allowed range |
| LLM-as-Judge | For semantic correctness | Promptfoo `llm-rubric`, `g-eval`, `factuality` |
| Substring match | When the answer must contain a mandatory section | Promptfoo `icontains` |
| Relevance | For RAG output | Promptfoo `relevance` |
| Human-in-the-Loop | Safety-critical | case worker confirms before execution |
| Red Teaming | Before production | Promptfoo `harmful:hate`, `jailbreak` strategy |

---

## 15. Observability Requirements in the Konzept

In AI systems, evaluation and monitoring do not come last; they drive the build from day 1 (provenance: Köster 2026). The classic "three pillars" model (metrics / traces / logs) is extended for AI systems by a **fourth pillar**: **Evals (LLM-as-a-Judge)** — part of the development loop, not of operations afterwards.

### 15.1 OpenTelemetry GenAI Conventions

Mandatory when OTel is used in the project. The GenAI Semantic Conventions are **versioned** and attribute names have been renamed between releases (e.g. `gen_ai.system` has been superseded in newer releases); the Konzept names the convention version used and takes the attribute names from exactly that release. The list below is an example as of v5.0. Disabled sampling stores every prompt; cost and data-protection consequences are governed by §15.6.

Mandatory attributes per LLM span (example):

```json
{
  "gen_ai.request.model": "claude-opus-4-8",
  "gen_ai.system": "anthropic",
  "gen_ai.request.temperature": "0.8",
  "gen_ai.response.id": "...",
  "gen_ai.response.finish_reasons": ["stop"],
  "gen_ai.operation.name": "chat",
  "gen_ai.usage.input_tokens": "6938",
  "gen_ai.usage.output_tokens": "440",
  "gen_ai.usage.total_tokens": "6958",
  "gen_ai.response.model": "claude-opus-4-8"
}
```

**DISABLE sampling** for LLM spans — every interaction counts for eval and drift detection.

### 15.2 Tracing Stack (recommended)

| Component | Example tool | Purpose |
|---|---|---|
| OTEL collector | OpenTelemetry Collector | span collection |
| Trace backend | **Langfuse** (OSS, OTEL receiver) | LLM trace store |
| Eval tool | **Promptfoo** | test + LLM-as-Judge + red teaming |
| Spring AI / LangChain | depending on the stack | automatic trace integration |

### 15.3 LLM-as-a-Judge: Fourth Eval Pillar

```yaml
tests:
  - vars:
      prompt: 'Wieviel Milch sollte ein 9 Tage altes Säugling pro Mahlzeit trinken …?'
    assert:
      - type: icontains
        value: 'Kapitel 33.4 Tagestrinkmenge'
      - type: llm-rubric
        value: |
          ensure that the output provides a specific amount of milk in milliliters
          and the number of meals per day
      - type: factuality
        value: 8-12 meals per day
```

### 15.4 Red Teaming as a Mandatory Eval Layer

```yaml
redteam:
  numTests: 10
  plugins:
    - harmful:hate
  strategies:
    - jailbreak
language: de
```

State in the Konzept per LLM UC: which `harmful:*` plugins are relevant, which strategies (`jailbreak`, etc.) are tested. The Promptfoo eval suite (red teaming + LLM-as-Judge, §15.3) runs as a **CI gate** (GitHub Action) — keep it lean, but as a hard quality barrier per PR/sprint.

### 15.5 Knowledge-Cutoff Tests

Mandatory test: ask about a product that was released **after** the knowledge cutoff (e.g. "iPhone 17"). If the model answers confidently → it is hallucinating. State in the Konzept how the model communicates knowledge-cutoff limits to the user.

### 15.6 PII / GDPR in the Trace

Anonymize before span export: **DataFog** (OSS) or **Microsoft Presidio** as pre-processor. Document in the Konzept: which fields are redacted? Who has access to raw traces?

### 15.7 Test Data Strategy

For LLM UCs, describe how test data is generated: **personas** (description, typical requests, expectations) · **seed queries** (typical request, edge case, abuse attempt — they create entropy in the test set) · **validation** (correctness via LLM-as-Judge + fact-checking; safety via red teaming against the OWASP GenAI Top 10; consistency: same request 5× → compare the answers).

### 15.8 AI Code as Untrusted Input + Hybrid Validation Layers

LLM answers are to be treated as **"untrusted input"** and checked with static analysis tools; the solution lies not in "more model" but in deterministic validation layers on top (provenance: Mahringer/Köster 2026):

| # | Layer | Tools | Checks |
|---|---|---|---|
| 1 | **Structural validation** | Language Server Protocol (LSP), AST/CST parser | syntax, types, symbol resolution |
| 2 | **Logical validation** | automated reasoning solver (e.g. Z3, Prolog-based) | architecture rules as axioms |
| 3 | **Security validation** | CodeQL, SonarQube, Semgrep | OWASP Top 10, CVE patterns, secrets scan |
| 4 | **Test validation** | vertical TDD loop (§27.4) | behavior against the UC's AC table |

**Mandatory minimum:** layers 1 + 3. **Mandatory with > 3 cooperating modules:** layer 2 as well. **Mandatory for every non-trivial UC:** layer 4 (TDD-first, §11.7).

---

## 16. MCP Integration in the Konzept

### 16.1 MCP Architecture

| Component | Task |
|---|---|
| **MCP host** | AI application, manages the clients |
| **MCP client** | 1:1 connection to the server (inside the host) |
| **MCP server** | provides tools / resources / prompts |
| **Transport** | stdio (local) or HTTP (remote) |

### 16.2 Three Server Capabilities

**Tools** (executable actions, e.g. "search_repo") · **Resources** (structured data access, e.g. `resource://logs`) · **Prompts** (prepared templates).

### 16.3 Three Client Capabilities

| Capability | Description | Relevant in the Konzept when |
|---|---|---|
| **Sampling** | server delegates LLM requests back to the client | the server should be able to use AI itself |
| **Elicitation** | server asks follow-up questions | the UC needs interactive clarification |
| **Roots** | server queries accessible directories | file-system server configuration |

### 16.4 Lifecycle + JSON-RPC 2.0

Initialization as a handshake: `initialize` → `notifications/initialized` → `tools/list` → `tools/call`. Client and server negotiate protocol version and capabilities (e.g. `protocolVersion: "2025-06-18"`, client `capabilities: { elicitation: {} }` → server answers with `tools/resources/prompts`). Only after `notifications/initialized` are `tools/list` / `tools/call` permitted. In the Konzept: fix the protocol version, document the negotiated capabilities.

### 16.5 OAuth Recommendation

For HTTP transports the MCP specification defines an **optional** OAuth-based authorization flow (with audience validation and without token passthrough as a MUST when it is used); STDIO servers do not use it and take credentials from the environment. In the Konzept for every MCP server: is OAuth active? Who has access? How are tokens rotated? Admin or read-only token? Static tokens in `headers` are checked by `mcp-config-lint`.

### 16.6 Warning: Too Many Tools = Worse Answers

At most 3–5 relevant tools per UC. **Context rot** (too large a context → loss of efficiency) is real.

### 16.7 Multi-MCP-Server Setup

For LLM UCs with several MCP servers in parallel (e.g. Figma + Drive + Calendar + custom server), additional mandatory fields in the UC:

| Mandatory field | Description |
|---|---|
| Tool name conflict resolution | mandatory prefix convention (e.g. `figma__search` vs. `drive__search`) |
| Auth aggregation | per server: OAuth scope + token store + rotation strategy |
| Tool budget | at most X tools visible to the LLM session (context rot, §16.6) |
| Lifecycle order | parallel init vs. sequential — which servers must be available before the first tool call runs? |

**Heuristic:** With > 3 MCP servers in the UC, a **UC-specific server selection table** is mandatory.

### 16.8 MCP Server/Tool Design (when building your own)

When building your own MCP servers/tools (instead of only consuming others'), design rules apply. Security for this → §33.3; a deterministically decidable tool is to be built as a T1 program → §32.9.

**Server maturity (levels 0–3) — do not stay at level 0:**

| Level | Character |
|---|---|
| 0 | raw 1:1 API mirroring — fast but error-prone; **avoid** |
| 1 | hints/descriptions in the tools |
| 2 | domain model + workflow understanding in context — **target level** |
| 3 | self-improving hypermedia discovery |

**Tool design rules (provenance: Anthropic "writing tools for agents"):**
- **Few, high-impact tools** instead of mirroring every API endpoint; **consolidate** (`schedule_event` = find availability + book, instead of `list_users` + `create_event`).
- **Namespacing** by service + resource (`asana_search`, `jira_search`) — the agent chooses more reliably.
- **Meaningful responses** — semantic identifiers (names, types) instead of technical ones (UUIDs, MIME).
- **Token efficiency** — pagination/filter/truncation with sensible defaults; when truncating, a hint on how to search more precisely.
- **Actionable error messages** — concrete + corrective, no opaque code.
- **Descriptions as for a new team member** — formats/terms explicit; unambiguous parameter names (`user_id`, not `user`); **poka-yoke** (e.g. enforce absolute paths).
- **Eval-driven iteration** — measure tool performance, analyze transcripts with the agent, iterate.

**Elicitation (MCP spec from 2025-06-18):** A server may pose structured follow-up questions to client/user (`elicitation/create`; types text/number/bool/enum) with UI presentation + decline option. **Preferred over sampling** (server has the client call the LLM), because elicitation keeps the control/trust boundary with the human/client. Document per server whether elicitation/sampling is used.

---

## 18. Probabilistics in the Konzept (across UCs)

### 18.1 Mandatory Section in the Konzept Header

See §2.6 (probabilistics statement with EU AI Act column) — this is the mandatory artifact for principle §1.5.

### 18.2 Layer Awareness (Context Pyramid)

Document in the Konzept which layer of the LLM context pyramid is used:
1. **Local tabs** — what does the developer currently have open?
2. **Indexed project context** — workspace index
3. **Embeddings-based retrieval** — RAG / vector DB
4. **Pre-trained LLM knowledge** — the model itself

Per UC: which layers are needed? Which cache strategy applies?

### 18.3 Three Workflow Models

| Model | Description | When useful |
|---|---|---|
| **Conversation session** | chat with continuous context | iterative exploration |
| **Complete bundle** | everything up front in one prompt | boilerplate / small UCs |
| **Vibe-coding workflow** | load files on demand | larger refactorings |

---

## 20. Layered Architecture for AI Apps

Four layers mandatory, represented in the Konzept as entity + service overview (provenance: Springer 2026):

| Layer | Task | Example |
|---|---|---|
| **Interface Layer** | gateway to the world — REST / GraphQL / UI / SSE streaming | Symfony controller + Mercure |
| **Orchestration Layer** | business logic, context engineering, pre-processing, tool/plugin integration | Symfony service / Spring service |
| **Model Layer** | LLM API abstraction (Anthropic / OpenAI / Ollama) | LangChain / Spring AI |
| **Data Layer** | vector DB + relational DB + caching | Milvus / pgvector + Redis |

### 20.1 Mandatory UX: Streaming

Token-by-token output is a UX requirement. In the Konzept, assign a streaming behavior to every LLM UC (chunked HTTP, SSE, WebSocket).

### 20.2 Stateless LLM, Stateful App

Document in the Konzept where the conversation state lives: session cookie, DB table, cache. **Never rely on the LLM** — it is stateless.

### 20.3 RAG Convention

| Component | Example | Mandatory note |
|---|---|---|
| Embedding model | `nomic-embed-text` (768 dimensions; example, model and dimension are project variables) | — |
| Vector DB | Milvus / pgvector | — |
| Chunking | semantic (not character-based) | — |
| Retriever K | keep small (2–5) | — |
| **Prompt caching** | provider-specific (Anthropic / OpenAI prompt caching) | **Mandatory from > 1k tokens of context** — without caching, the constant re-feeding is unaffordable |
| **Cache invalidation** | mandatory documentation per UC: on which file/data changes is the cache invalidated? | without an invalidation strategy, cached stale context becomes a memento-effect risk |

In the Konzept per RAG UC: name chunking strategy + embedding model + retriever K + caching strategy + invalidation triggers explicitly.

**Retrieval beats model:** RAG quality lies primarily in **retrieval** — chunking strategy, metadata and preprocessing are the main levers, not the model (provenance: Magnussen/Springer). **Grounding mandatory:** enforce a source/citation requirement in the system prompt („kein Statement ohne Quelle", Glaser) and check the output grounding against the sources (§15.3 factuality).

---

## 21. TAO Cycle + ISAQB Core Activities for Agent UCs

### 21.1 TAO Cycle (Thought-Action-Observation)

Mandatory loop for agent UCs:

```
┌──────────┐   ┌──────────┐   ┌──────────────┐
│ Thought  │ → │  Action  │ → │ Observation  │
│ (LLM)    │   │ (Tool)   │   │ (Tool/State) │
└──────────┘   └──────────┘   └──────────────┘
       ↑                              │
       └──────────────────────────────┘  Re-Plan
```

In the Konzept, assign TAO logging to every agent UC (§15 observability).

### 21.2 ISAQB Core Activities as a Review Grid

| Activity | AI-capable? | Condition |
|---|---|---|
| Clarifying requirements | Yes, with reviews | domain expert checks |
| Designing structures | Partially | LLM proposes, architect decides |
| Designing cross-cutting concepts | Partially | glossary + ADRs needed |
| Evaluation | Limited | AI as sparring partner, not as evaluator |
| Communication | No | Mehrabian rule — see §1.6 |
| Monitoring the implementation | Yes | verification agent (§10.6) |

### 21.3 Moravec's Paradox

What is easy for humans (perception, context) is hard for AI — and vice versa. In the Konzept: do NOT hand tasks that are "easy for humans" to the AI; tasks that are "laborious for humans" (boilerplate, data conversion, pattern matching) are AI candidates.

---

## 22. Quantified PoC Path with Phases

> **Bridge to §29 Mode E:** §22 describes a *PoC phase plan* for introducing a new AI tool. §29 Mode E combines §22 phases with the brownfield pattern for "AI capability in an existing system".

### 22.1 Two-Phase Approach

**Phase 1 — Learn & Experiment (2 weeks):** one focused test group with multipliers · 3–5 concrete use cases · compliance/security enabler kick-off AT THE START (data protection, vendor lock-in) · tool selection still open.

**Phase 2 — Consolidate Promising Results (3–4 weeks):** quantitative success measurement · configurable agents with a knowledge base from Confluence/wiki · enabling the multipliers · scaling plan.

### 22.2 Mandatory Metrics per Use Case

| Metric | Example |
|---|---|
| Task | "refinement meeting for epic XY" |
| Time without AI | 15 min |
| Time with AI | 5 min (-67 %) |
| Prompt used | versioned in the repo |
| Answer quality | "fitting"/"very good"/"insufficient" |
| Quality score | 1–10 |
| Cost / tokens | $X / N tokens |

### 22.3 Expected Figures (Feasibility)

75 % hit rate on quality (fitting / very good) · 50–75 % time savings · 65 % refinement reduction.

### 22.4 Risks (as Known Issues in the Konzept)

Single-user tests instead of diverse test groups → bias · scaling too early without well-grounded multipliers · involving compliance/security AFTERWARDS instead of at kick-off · missing standards/guidelines → agents hallucinate fitting answers.

### 22.5 Real-User Rollout Strategies

Transition from synthetic to real users in four stages (provenance: Köster), combinable depending on risk:

| Strategy | Character |
|---|---|
| **Shadow traffic** | real requests sent to the AI in parallel, answer not delivered — comparison against the actual |
| **Friendly user / internal test group** | limited, well-disposed user group |
| **Lab test** | real users under lab conditions, with recording |
| **A/B test** | controlled split against baseline |

Per LLM UC, document the chosen stage + success/exit criteria (supplements §22.2).

---

# Part 6 — Lessons & Anti-Pattern Catalog

The pattern catalog: proven lessons (§24) and the anti-pattern review grid (§25). These two sections are the consolidated home of the patterns; they are walked through as a checklist in Konzept review as well as code review.

## 24. Proven Lessons

| Lesson | Origin | Application |
|---|---|---|
| Bundles always need an admin UC for bundle configuration | notification bundle, media bundle | UC with route `/admin/{bundle}/config` |
| Mark add-on modules explicitly | DB track construction module | own section with license note |
| Blockers early as a note in the Konzept | order cockpit | `> **Blocker:** ...` directly at the UC |
| Manual equivalents for non-intuitive systems | NSAI bundle | for batch processes, AI concepts |
| Describe offline behavior explicitly | mobile UC order cockpit | always an offline section for mobile UCs |
| Variant comparison for alternative implementations | WebMailer A/B | table criterion / variant A/B / recommendation |
| Case-worker perspective for queue concepts | NSAI quarantine | "What is on the pile?" |
| Regulatory references directly in the UC | DB module (DGUV V78) | note column / footnote |
| Step numbering in the flow | Leßner/Bartels 2026 | "Implement step X.Y" as prompt |
| Konzept score as a basis for discussion | Bartels 2026 | originally "8/10 is implementation-ready"; since v5.1 gate plus score per project policy (§7) |
| Keep subsystems small | Leßner/Toth 2026 | self-contained UCs |
| AI checks the specification against the code | Bartels 2026 | verification agent after every sprint (§10.6) |
| Semantic anchors in the glossary | Müller 2026 | 2–4 keywords as LLM triggers |
| Type LLM outputs | Baumgartner 2026 | sealed interfaces / records |
| Agents only for decisions under uncertainty | Baumgartner 2026 | deterministic logic stays deterministic |
| Describe the test data strategy in the LLM UC | Heinicke 2026 | personas + seed queries + validation |
| Address the knowledge cutoff in the Konzept | Heinicke 2026 | context strategy for time-critical data |
| Too many MCP tools degrade quality | Heinicke 2026 | max. 3–5 tools per UC |
| Probabilistics statement mandatory | Mahringer/Wolff 2026 | UC table with tolerance + validation (§2.6) |
| AI code as untrusted input | Mahringer 2026 | CodeQL/SonarQube before merge (§15.8) |
| Disable sampling for LLM spans | Köster 2026 | complete tracing |
| OpenTelemetry GenAI conventions as standard | Köster 2026 | `gen_ai.*` attributes |
| LLM-as-Judge as 4th eval pillar | Köster 2026 | Promptfoo / `llm-rubric` |
| Red teaming per LLM UC | Köster 2026 | Promptfoo `harmful:*` + `jailbreak` |
| PII anonymization in the trace | Köster 2026 | DataFog / Microsoft Presidio |
| Consistency check model↔API via LLM prompt | Junker 2026 | per sprint end, versioned prompt (§19) |
| Four-layer architecture for AI apps | Springer 2026 | Interface / Orchestration / Model / Data |
| Streaming as a UX requirement | Springer 2026 | token-by-token output per LLM UC |
| TAO cycle for agent UCs | Röwekamp 2026 | Thought / Action / Observation as a loop |
| ISAQB core activities mapping | Röwekamp 2026 | AI-capable vs. not AI-capable per activity |
| Respect the Mehrabian rule | Wolff 2026 | stakeholder workshops stay human |
| Four architect superpowers as human anchor | Röwekamp 2026 | Communicate / Decide / Adapt / Make Mistakes |
| Responsibility matrix per Konzept | Lischke 2026 | UC × human validator × liability (§23.1) |
| Walk-through mandatory | Mahringer 2026 | read each UC aloud before sprint start |
| Two-phase PoC | Posselt/Birke/Schluff 2026 | learn+experiment → consolidate |
| Verification agent + review agent as two roles | Bartels 2026 | `.github/agents/` layout |
| Module depth as architecture metric | Ousterhout/Pocock | deep = much behavior behind a narrow interface |
| Deletion-Test as refactor filter | Pocock 2026 | "Would deleting make the complexity disappear or spread it around?" |
| Vertical slice / Tracer-Bullet as decomposition default | Pocock/Thorstensen | every slice crosses ALL layers |
| Slice 1 = riskiest path with the highest learning opportunity | Pocock/Thorstensen | order follows "most instructive first" |
| Vertical TDD instead of horizontal TDD | Pocock 2026 | one test → one impl → repeat |
| Feedback loop as the actual debugging skill | Pocock 2026 | "Build the right feedback loop, and the bug is 90 % fixed." |
| CONTEXT.md as non-negotiable SSOT | Pocock + brownfield | mandatory before every extension: read, update on drift |
| ADRs for asymmetric decisions | Pocock + brownfield | `docs/adr/ADR-NNN-<slug>.md` |
| Hybrid validation layers for LLM code | Mahringer 2026 | LSP/AST + reasoning + CodeQL — deterministic layers on top |
| Memento effect + context caching as RAG prerequisite | Mahringer 2026 | monitor the token budget, caching mandatory from > 1k tokens |
| Validation mindset level as differentiation axis | Wilke/Loje/Krypczyk 2026 | AI share > 50 % demands high-level validation |
| EU AI Act risk class per UC | regulation 2026/27 | mandatory column in the probabilistics statement (§2.6) |
| Vendor risk statement alongside probabilistics | Mischok 2026 | provider + model + migration + sovereignty per LLM UC |
| Concreteness separation: CDP5 abstract vs. wiki/trace concrete | manipulation avoidance | concrete paths/SHAs do not belong in CDP5 (§1.7) |
| **Orchestration instead of self-execution** | delegation doctrine (§32) | non-trivial task → delegate to isolated `stufe-rolle` workers, drift protection through fresh context |
| **Determinism gate / programmed T1 skill instead of text skill** | skill determinism (§32.9) | decidable + repeated → Node.js program with tests; a text skill is not reproducible |
| **Clarify-first / self-flagged assumption = hard stop** | anti-drift (§1.9) | on ambiguity/open decision, go to the conversation immediately, do not pass it through |
| **Rule out stale data first** | reproduction gate (§32.8 (6)) | clean reproduction before every diff fix; prove semantics executably |
| **Precondition = stop, no rescue in the same run** | anti-drift (§32.8 (7)) | an ADR/Konzept precondition is a gate, not a basis for negotiation |
| **Auditor beats self-/pro-review for 🔴 slices** | review corollary (§11.4) | adversarial auditor + empirical counter-check; self/pro share the same blind spot |
| **Durable artifacts as external memory** | memory defense (§28) | CONTEXT.md/ADR/handoff keep vocabulary + decisions outside the volatile context |
| **Verify the retro→memory loop** | learning loop (§32.6) | every memory slug cited in the retro must really exist + have a MEMORY.md pointer |
| **Konzept splitting: master index + sub-files from ~400 lines** | growing Konzepte | master (basic principles + topic table) + sub-decision files per topic; minimal, precise cross-refs |
| **Plan fidelity / minimal deviation** | multi-repo lessons | implement the plan literally; report improvement suggestions back instead of local cleverness |
| **Persist findings as durable issues** | issue-as-SSOT | every review/test/bug finding as an issue (not lost in chat/commit message); auto-close via `Closes #X` |

---

## 25. Anti-Patterns

| Anti-pattern | Problem | Solution |
|---|---|---|
| "Further fields as needed" | Incomplete | all fields explicit |
| Error cases in running text | hard to skim | table |
| "Standard behavior" without definition | ambiguous | default values explicit |
| UCs without route | not testable | mandatory: route or "System (automatic)" |
| Status without transitions | unclear | lifecycle diagram |
| Roles without scope | unclear | global vs. resource-bound |
| Bundle without config section | not integrable | admin UC for bundle config |
| UCs only for the success case | error cases forgotten | error-case checklist |
| Flow without step numbers | no targeted AI prompt | numbered steps |
| Data types not specified | AI guesses | type + unit + value range |
| Prose logic instead of flow structure | AI interprets | branches explicit as steps |
| Konzept created once | outdated | living artifact + versioning |
| AI-generated tests that fit the code | tests lose their value *(Fondermann)* | derive test cases from the UC spec, not from the code |
| Cognitive offloading to AI | learning loss *(Mahringer)* | walk-through mandatory (§23.2) |
| AI as architecture decision-maker | hallucinations + Mehrabian gap *(Wolff)* | AI only as sparring partner, not decision-maker |
| LLM without probabilistics statement in the Konzept | wrong expectations | §1.5 + §2.6 |
| Classic observability tools for LLMs | do not capture `gen_ai.*` | OpenTelemetry GenAI + Langfuse |
| AI code straight into production without CodeQL/SonarQube | 45 % security defects *(Veracode)* | AI code as untrusted input |
| Delegating responsibility to the LLM | not liable *(Lischke)* | §23.1 responsibility matrix |
| Replacing stakeholder workshops with AI | 93 % of communication nonverbal *(Wolff)* | event storming / domain storytelling stays human |
| Agents in deterministic flows | complexity inflation *(Baumgartner)* | workflow without LLM = workflow without agent |
| Magic string keys for agent output | source of probabilistics *(Baumgartner)* | sealed interfaces / typed records |
| Direct LLM call without layers | not maintainable *(Springer)* | four-layer architecture §20 |
| Synchronous LLM answer without streaming | poor UX *(Springer)* | token-by-token output |
| Interpreting implementation details as inconsistency | wrong refactoring recommendation *(Junker)* | prompt rule: "Implementation details are NOT inconsistencies" |
| Involving compliance/security AFTERWARDS | PoC dead end *(Posselt)* | enabler kick-off at PoC start |
| Enabling sampling for LLM spans | drift detection blind | §15.1 — DISABLE sampling |
| Generating tests from the code after the implementation | redundant green tests without spec reference | §11.7 — TDD-first |
| Acceptance criteria as prose | not a test case but a wish | §11.7 — AC table |
| Test classes without UC mapping | maintenance debt | §11.7 — test class name stated |
| Horizontal TDD (all tests up front) | tests test *imagined* behavior *(Pocock)* | §27.4 — vertical TDD |
| Shallow modules extracted only for testability | bugs hide in the way they are called *(Pocock)* | §27.1 Deletion-Test |
| Bulk PRD without Tracer-Bullet decomposition | describes the end state instead of verifiable intermediate steps | §27.2 vertical slicing |
| Bug hypothesis without feedback loop | hours of code reading without a pass/fail signal | §27.5 feedback-loop-first |
| Implementation starts without reading CONTEXT.md | domain glossary gets re-interpreted → drift | §1.8 + §27.6 |
| Renegotiating ADR decisions on every slice | durable decision violated | §28.2 ADRs are durable |
| Prototype code migrates into production | throwaway code without tests in the main path | §27.3 — clearly marked + delete-or-absorb |
| "It works" as architecture justification | confirmation without mechanics | §27 — per decision, *which problem property* is matched |
| ADRs in the touch area not read before extension | drift from existing decisions | §1.8 + §27.6 |
| Ignoring the memento effect from context blow-up | model forgets the initial context *(Mahringer)* | monitor the token budget; handoff (§28.4) when approaching the limit |
| RAG without prompt caching | token costs explode *(Mahringer)* | §20.3 prompt caching mandatory from > 1k tokens |
| Merging LLM code without structural validation | LSP/AST would catch type/symbol errors *(Mahringer)* | §15.8 validation layer 1+ mandatory |
| Passive adoption of AI output without active validation | cognitive offloading aggravated *(Wilke)* | §23.1 mindset level "high" when AI share > 50 % |
| Adopting sycophancy-confirmed AI proposals | LLM confirms instead of contradicting *(Kruse)* | devil's-advocate pass; second model; §11.4 review corollary |
| Treating AI as a deterministic search engine | plausibility mistaken for truth *(Kansy)* | AI output is a proposal, not a fact; tie it to source/validation |
| High-risk UC without EU AI Act classification | regulatory non-compliance | §2.6 risk class column mandatory |
| AFK slice without readiness check | agent runs into the void | §28.3 AFK hardening, 6-point checklist |
| Making assumptions instead of going to the conversation | the error spreads across everything built on top | §1.9 clarify-first |
| Roadmap/plan drift: skeletons unrecorded | double build; or hallucinated symbols in the plan | §28.5 roadmap = temporary → code↔plan inventory (T1 script / `konzept-mapper`) |
| Safety gate on optional state → fail-open | protected (destructive) action runs ungated on `null` | safety gate **fail-closed**: `null` → abort, "check waived" forbidden |
| Ignoring partial-success markers | partially failed run is swallowed as success | always check the partial marker, not just the top-level flag |
| Decidable activity as text skill | not reproducible (LLM run) | §32.9 — port to a T1 program |
| Briefing workers with copied walls of context | overflow + paraphrase drift | §32.8 (2) — pointer brief instead of paste |
| **Lethal trifecta fulfilled without countermeasure** | sensitive data + untrusted content + egress → data exfiltration via prompt injection | §33.1 — break one axis or Human-Gate |
| **Third-party MCP server integrated unvetted** | name spoofing / tool-description injection / rug pull | §33.3 — trust source, approval hash, isolation |
| **Large AI code block adopted without public-code filter** | copyleft/license violation | §33.7 — public-code filter, avoid large 1:1 blocks |
| **Own MCP server as raw 1:1 API mirror (level 0)** | error-prone, agent picks the wrong tool | §16.8 — consolidated, domain-aware tools (level 2) |
| **Overloaded CLAUDE.md/instruction file** | loaded every session → rules drown in bloat, get ignored | §28.6 — keep short, prune, situational knowledge in skills |
| **Accumulating context across unrelated tasks (kitchen sink)** | context rot, accuracy drops above 60–70 % utilization | §28.6 — `/clear` between tasks; restart after 2 corrections |

---

## 35. Behaviour invariance gates

### 35.1 Gate chain

The gate chain is the deterministic proof that a change left the behaviour of the untouched paths alone. It runs before and after a refactoring (§32.22), per slice in the implementation and before every PR; the commands are the project's own and are named in the brief:
1. Zero new static-analysis errors at the project level.
2. Zero formatter diffs.
3. Zero test failures in the full suite.
4. Coverage on touched lines at or above the project threshold.
5. UI flows covered by the end-to-end suite where the change touches a route or a template.

Plus a mutation sample: at least one deliberate break of the moved or changed behaviour shows that the suite turns red; a suite that cannot turn red proves nothing (worker contract rule 2). Exit status and counts are read on the final state and quoted in the report; an exemption is a known-issue line (§28.2), not an omission.

---

## Self-Application — CDP5 as a Review Grid Against Other Konzepte

During `konzept-review`, other Konzepte are measured against CDP5 — in particular check:
- §1–§14: Konzept structure complete; gate of the maturity policy passed and score ≥ project threshold (§7, §10.3/§10.4)
- §1.7 concreteness separation: no concrete code/repo/SHA details in the Konzept doc
- §1.8 CONTEXT.md/ADR requirement: mandatory with a brownfield share
- §7 extended checklist: additional mandatory items with an implementation-plan share
- §2.6 + §2.7: mandatory statements for LLM UCs (probabilistics + vendor + EU AI Act)
- §10.7: every "mandatory" item has an objectively verifiable Nachweis-Typ (evidence type)
- Part 2 (§27–§29, §32): binding for Konzepte with a brownfield/review/teardown or PoC share

---

# Appendix

Reference material — skippable when reading the doctrine, consult when doing concrete work.

## Appendix A — AI Prompting Patterns for New Konzepte (formerly §9)

Five prompt patterns for the lifecycle of a Konzept.

### A.1 Initial Prompt (Konzept from Scratch)

```
Create an end-user Konzept for {project name}.

Scope: {1–3 sentences of description}
Stack: Symfony, FrankenPHP, Twig, Symfony Turbo, MercureHub, API Platform
Actors: {comma-separated roles}
Specifics: {regulation, external systems, offline requirements, etc.}

Requirements for the Konzept:
- Case-worker test: all processes can be executed manually based on the document
- Use cases for all actors (user, case worker, admin, system)
- Form fields as complete tables (field, type, mandatory, note) — with data type and value range
- Flow steps numbered (1, 1.1, 1.2, 2, ...) for later targeted implementation reference
- Error cases as tables — incl. limit values and special cases
- Status lifecycles as ASCII diagrams
- Entity overview at the end
- Mercure topics when real-time is needed; API Platform endpoints when an API is needed
```

### A.2 Review Prompt (Improve an Existing Konzept)

```
Analyze this Konzept as a strict requirements engineer with the policy:
"A Konzept is implementation-ready when an AI agent can generate correct,
maintainable code from it without follow-up questions."

Identify: 1) UCs with room for interpretation (prose instead of flow structure)
2) Missing step numbering 3) Unspecified data types/units/value ranges
4) Missing error cases (limit values/exceptions) 5) Missing UCs for admin/case worker
6) Status without transitions 7) Missing technical appendices

Rate according to the project's maturity policy (gate items and weighted dimensions),
name the policy file and report whether the threshold is reached as a finding.
Ask follow-up questions on ambiguities instead of making assumptions.
```

> The sentence "implementation-ready when an AI agent can generate correct, maintainable code from it without follow-up questions" is the purpose statement of the maturity policy; the prompt no longer assigns a score of its own (one rubric, §7).

### A.3 Interview Prompt (gap-filling, iterative)

```
You are a requirements engineer. I describe a use case.
You identify one gap per answer and ask about it specifically.
Never formulate an assumption — always ask.

Start with: UC-{no.}: {title}
```

### A.4 Implementation Prompt (targeted from the Konzept)

```
Implement step {X.Y} from UC-{no.} ({title}).

Context: stack Symfony 7, API Platform, Doctrine ORM; entity {EntityName}; dependencies {…}
Requirements: follow the flow description exactly; do not deviate, ask on
ambiguity; generate no code for other steps.
```

### A.5 Extension Prompt (new version)

```
Extend the existing Konzept {project name} v{X.Y} by the following gaps: {list}.
Keep all existing UCs unchanged. Add a changelog section.
Raise the version to {X.Y+1 or X+1.0}.
```

### A.6 Consistency Check Prompt Between Model and API (§19)

AI as referee between domain model, OpenAPI and AsyncAPI:

```
# Visual Glossary and OpenAPI Alignment Analysis

## Your Task
You are comparing two artifacts that should represent the same business domain:
1. An OpenAPI specification - the current technical implementation
2. A Visual Glossary (provided as an image) - a conceptual domain model using natural language

Your goal is to identify inconsistencies between the two and suggest which artifact should
be updated to achieve alignment.

## Understanding Visual Glossary
A Visual Glossary is NOT a UML class diagram and NOT a technical specification. It is a
conceptual domain modeling artifact that shows domain concepts and their relationships
(natural-language verbs), focuses on what exists in the domain, is readable by domain
experts, and may show concepts without direct API representation.

Critical: Implementation details are NOT inconsistencies.
```

Performed periodically (e.g. per sprint end). The LLM identifies, for example: "Service does not publish all events derivable from the context map (CatalogEntryUpdated, CatalogEntryDeleted are missing)."

---

## Appendix B — Golden-Sample UCs (formerly §31)

Two fully written-out reference UCs demonstrating all mandatory sections. **Sample A** deterministic (CRUD, basis Part 4). **Sample B** LLM UC (additionally §2.6/§2.7/§13/§15/§23.1). Generic vehicle/club context; code identifiers in English.

### B.1 Sample A — CRUD UC (deterministic)

```markdown
## UC-S1: Add Vehicle to Garage

**Actor:** `Member` (logged in, owner of the garage)
**Route:** `GET|POST /garage/vehicles/new`  ·  API: `POST /api/vehicles`

> **No LLM:** This UC is deterministic — no AI component (§13.3).

### Form Fields
| Field | Type | Mandatory | Note |
|------|-----|---------|---------|
| make | Selection | Yes | manufacturer master data, not free text |
| model | Text | Yes | max. 80 characters |
| firstRegistration | Date | Yes | not in the future |
| vin | Text | Cond. | 17 characters, checksum; mandatory when visibility ≠ private |
| visibility | Selection | Yes | `private` / `shared` / `public` (default `private`) |

### Behavior
1. Member opens `/garage/vehicles/new`
2. Validation of the mandatory fields
   2.1 `firstRegistration` ≤ today
   2.2 `vin` checksum, if set
   2.3 `visibility ≠ private` ⇒ `vin` mandatory
3. On validation error: error message inline, form stays open
4. On success: save vehicle with `owner = currentUser`, `visibility = private` (or as chosen)
5. Redirect → `/garage?added=1`

### Error Cases
| Case | Message / Behavior |
|------|---------------------|
| VIN checksum invalid | "The vehicle identification number is invalid (17 characters)." inline |
| firstRegistration in the future | "First registration must not be in the future." inline |
| visibility=public without VIN | "Public vehicles require a VIN." inline |
| Not logged in | 302 → login |

### Status Lifecycle (visibility)
private → shared → public
   ↑__________________│   (owner can downgrade at any time)

### Acceptance Criteria (Test-First)
| # | Criterion | Test type | Test class | Status |
|---|---|---|---|---|
| AC-1 | Member can create a vehicle with mandatory fields | Integration | VehicleControllerTest::testCreateHappyPath | red |
| AC-2 | Anonymous visitor → 302 login | Integration | VehicleControllerTest::testAnonymousDenied | red |
| AC-3 | Member sees/edits ONLY own vehicles (owner constraint) | Integration | VehicleVoterTest::testOwnerOnly | red |
| AC-4 | visibility=public without VIN → form error | Integration | VehicleFormTest::testPublicRequiresVin | red |
| AC-5 | Status transition public→private at any time by the owner | Unit | VehicleStateTest::testDowngrade | red |

### Manual Equivalent
A case worker enters the vehicle on an index card, checks the VIN check digit by hand and files the card in the member's compartment; "publicly visible" = card additionally posted on the notice board.
```

### B.2 Sample B — LLM UC

```markdown
## UC-S2: Automatically Categorize Defect Descriptions

**Actor:** `Member` (owner) · Validator: `Workshop-Manager`
**Route:** `POST /garage/vehicles/{id}/defects/classify`  ·  API: `POST /api/vehicles/{id}/defect-classification`

### LLM Mandatory Fields (§13.1)
| Element | Value |
|---|---|
| Context definition | free-text defect description (max. 2,000 characters) + `make`/`model` of the vehicle |
| Output data format | sealed `ClassificationResult` permits `Confident` / `NeedsReview` (JSON schema) |
| Validation strategy | schema match (pre/inline) + LLM-as-Judge against the category catalog (post) |
| Fallback behavior | Confidence < 0.6 ⇒ `NeedsReview` → escalation to the Workshop-Manager |
| Knowledge-cutoff handling | category catalog is passed as context (not taken from model knowledge) |

### Behavior
1. Member submits the defect description (free text, max. 2,000 characters) for vehicle `{id}`
2. Fast path: keyword match against the category catalog (`parseDefectText`)
   2.1 Unambiguous category ⇒ `Confident`, continue with step 3
   2.2 No or several candidates ⇒ deep path `classifyDeep` (LLM) with description + `make`/`model` + catalog as context; Confidence < 0.6 ⇒ `NeedsReview`
3. `Confident` ⇒ category saved on the defect · `NeedsReview` ⇒ task for the Workshop-Manager, Member sees "under review"

### Error Cases
| Case | Message / Behavior |
|------|---------------------|
| Description empty or > 2,000 characters | "Describe the defect in 1–2,000 characters." inline, no LLM call |
| LLM provider unreachable or timeout | `NeedsReview` without category, escalation to the Workshop-Manager, trace span with `error.type` |

### Probabilistics Statement (excerpt §2.6)
| UC | Tolerance threshold | Validation strategy | Fallback | EU AI Act class |
|---|---|---|---|---|
| UC-S2 | 85 % correctness | schema + LLM-as-Judge | NeedsReview → human | minimal |

### Vendor Risk Statement (§2.7)
| UC | Provider | Model | Migration strategy | Data sovereignty |
|---|---|---|---|---|
| UC-S2 | Anthropic | claude-haiku-4-5 | Spring AI adapter (provider via config) | no PII in the defect text; plain text |

### Agent Structure (§13.2)
**Goal:** assign a defect text to a category.
**Actions:** `parseDefectText` (det.), `classifyDeep` (LLM, deep path).
**Conditions:** `classifyDeep` only when the keyword match (fast path) yields no unambiguous category.
**Output types:** sealed `ClassificationResult permits Confident, NeedsReview`.
**Pre/Inline/Post:** Pre = input schema + token budget · Inline = sealed-interface match on the stream · Post = LLM-as-Judge against the category catalog.
**Uncertainty threshold:** Confidence < 0.6 → NeedsReview.

### Observability (§15)
Trace per call: `gen_ai.request.model`, `gen_ai.usage.*`, latency, category + confidence; sampling disabled.

### Acceptance Criteria (Test-First)
| # | Criterion | Test type | Test class | Status |
|---|---|---|---|---|
| AC-1 | Unambiguous defect text → `Confident` with the correct category | Integration | DefectClassifierTest::testConfident | red |
| AC-2 | Ambiguous text → `NeedsReview`, escalation triggered | Integration | DefectClassifierTest::testEscalation | red |
| AC-3 | Only the owner may classify (security constraint) | Integration | DefectClassifierVoterTest::testOwnerOnly | red |
| AC-4 | Knowledge cutoff: invented model → no hallucination, NeedsReview | Eval | DefectClassifierEvalTest::testCutoff | red |
| AC-5 | Red teaming: prompt injection in the defect text is neutralized | Eval (Promptfoo `jailbreak`) | promptfoo/defect-redteam.yaml | red |

### Responsibility Matrix (§23.1)
| UC | AI share | Human validator | Validation mindset | Liability |
|---|---|---|---|---|
| UC-S2 | 70 % (proposal) | Workshop-Manager (on NeedsReview) | high (AI share > 50 %) | Workshop-Manager |

### Manual Equivalent
The workshop foreman reads the defect description, assigns it to a category from experience and, in case of doubt, presents the case to a second colleague.
```

---

## Appendix C — Reference Cases (pseudonymized, formerly §30)

One **abstracted** entry per case. No concrete paths, repo URLs, commit SHAs or PR numbers in CDP5 itself (§1.7). Concrete pin information lives in private trace raws or wiki project pages.

| Case | Stack / character | Sections fulfilled |
|---|---|---|
| Case A | brownfield Symfony 7 + API Platform + FrankenPHP, security sprint with 6-slice plan, fold-in + develop mix | §1.8, §27.2–§27.6, §28.1/§28.2/§28.5, §29 Mode A + B (mix) |

Future cases with the same mandatory schema: pseudonym · stack + character · which sections are concretely fulfilled. Concrete pin information is **not** referenced in CDP5.

---

## 26. Changelog

| Date | Version | Change | Reason |
|---|---|---|---|
| 2026-10 | **v6.0** | Alignment with the plugins cdp5-gates, cdp5-agents and domain-agents (DECISIONS.md D-13 batches 1–7). New: §1.11 proportionality (condensed from Orbit); §27.1.1 necessity gate (existence question, four answers, rules A–C, translated, mode added); §32.6.1 fork balance (translated, with the deletion question and the net balance); §32.20 plugin mechanics; §32.21 fresh-context rule; §32.22 behaviour invariance for refactoring; §32.23 bounded attempts; §32.24 counter-role triad (free anchors, no Orbit original; the Orbit §32.12 fan-out error correlation, §32.13 deterministic tool cores, §32.15 multi-agent orchestration and §32.17 role graph keep their numbers and stay in the knowledge layer); §35 behaviour invariance gates with the §35.1 gate chain. Changed: §3 status lifecycle mandatory when any entity has a status, exemption sentence otherwise (G4); §6 changelog accepted missing below v2.0 (G9); §7 checklist carries gate ids G1–G15 with G5a/G5b and det/jdg per the policy; §10.3 interview mode as the T3 skill `spec-interview`, `konzept-reviewer` read-only, verifies det items, judges G5b/G10/G11, anchored levels or Unknown, re-score in fresh context, two rounds; §10.6 and §32.8 (6) executable substantiation only in a disposable environment with a run grant, URL claims fetched by the orchestrator; §11.4 counter-roles `adversarial-auditor` and `devils-advocate`; §13.3 two note forms, lint ignores the note; §23.3 psy escalation via PSY:krisen-eskalation and PSY:versorgungspfad-deutschland, block classes reported by every agent, gate held by the orchestrator; §27.6 impl-uc Method 0; §29/§32.2 size floor (two stages and more than one worker's worth; bugfix or single slice as worktree, one worker, review-verify; full chain from three stages, two writers or a 🔴 object); §32.1 skill form C session persona; §32.2 step 0 mode in the ledger and the two-stage review; §32.3 model table (no model for T1 work, sonnet for implementation, domain planning and retro, opus high for judgment, counter-roles and psy); §32.4 regenerated from the shipped agents, cross-cutting worker list retired, dormant roles footnote; §32.5 two anti-patterns (orchestrator fixes beyond one hunk, stacked workflow packs); §32.6 retro layout with carry-over, Five Whys, Kaizen table and fork balance, `pm-retro` briefed with ledger and `retro-memory-loop-check`, escalation at first (🔴) or third recurrence; §32.7 naming stufe-rolle or domain-rolle, Trifecta line 5a, plugin `agents/` as live store without mirror, need test counts stages and domains, third-run trigger from the usage log, thinking-phrase template line removed; §32.8 (3) Stop-Retro in contract format, (7) impl-uc stops; §32.9 all 17 T1 skills named, hybrid examples `cdp5-init` and `pii-scan`, exit-code convention; §32.10 fan-out gate answered in the ledger, one-hunk rule; §32.11 closing pass by object type, verdict mapping, invalid pass repeated with the alternative supplied; §33.1 judgment agents bound by the Trifecta; §33.3 `mcp-config-lint` checks. Redirect table reduced to §32.19 and §35.2. | The plugins are the single source for roles, skills and gates; the copy must describe them correctly so that briefs can cite it |
| 2026-10 | **v5.1** | Repo copy as interim master (knowledge layer Orbit downstream; §32.8 (2): a generated, hash-verified copy counts as the original). §32.1 orchestrator decides/briefs/verifies/synthesizes, no specialist work, effort scaling. §32.7: `effort` frontmatter instead of thinking phrases, worker contract + receipt, usage log as counting rule, rights/duties per role. §32.8 (2) mandatory brief fields, (3) filing switch and reference to the worker contract. **§32.11 devil's-advocate gate new.** §28.2 mandatory ADR fields (decision-maker, date, source, status, null option, supersede, Known-issue line) and filing switch. **§23.3 Mensch-Gate (human gate) list** (technical, integration, business, decisions). One maturity rubric: §7 is the gate of the policy `cdp5-gates/policy/reife-rubrik.policy.md`; §9 A.2, §10.3, §10.5, §10.7, §29 D, §B and the provenance table refer to it, no number left in the doctrine (plugin default 8.0). Corrections: §1.6 Mehrabian figure removed, §16.5 MCP authorization optional (HTTP) with audience/passthrough, §20.3 nomic-embed-text 768 dimensions. Roles: 35 checked, see `docs/cdp5-review/DECISIONS.md`; the source for roles and playbooks is the repo (plugins cdp5-agents, domain-agents), Orbit is generated from it. | Review of all roles, playbooks and paragraphs 2026-10-12/13 and decisions 2026-10-19; Orbit server decommissioning (nsai-edge removed, Orbit MCP as a later knowledge layer) |
| 2026-05 | **v5.0** | **Restructuring** for low-context reading: Part 0 (mission + work loop) new; anti-drift/memory mechanics (§29/§32/§28/§27/§10.6/§19) moved forward as **Part 2**; LLM specifics (§13/§15/§16/§18/§20–§22) bundled in the skippable **Part 4**; prompt patterns (§9)/golden samples (§31)/cases (§30) in the **Appendix**. Author quotes → inline rules (portability). Stubs §8/§12 removed; §11.3+§11.6 merged; probabilistics (§1.5/§2.6/§18) cross-linked. § anchors unchanged (all `(§X.Y)` references remain valid). New: §32.6 memory-loop verification; §24 +Konzept splitting/plan fidelity/findings-as-issues + the work-path patterns as catalog entries; **§33 Security (new Part 3): lethal-trifecta gate, agent-runtime hardening, MCP tool/server security, threat-modeling-light, security gates, LLM threat classes, double review/license; §25 +3 anti-patterns, §7 security check block; subsequent parts authoring/LLM/lessons → Parts 4/5/6. **Gap-review additions (industry + 4 magazine issues + Anthropic docs):** §16.8 MCP tool design · §32.10 fan-out economics · §28.6 context hygiene/CLAUDE.md pruning · §19.4 AsyncAPI↔context map · §22.5 real-user rollouts · §2.6 EU AI Act high-risk obligations+CRA/NIS2 · §27.6/§20.3/§15.4 extensions** | Mission sharpened: CDP5 establishes knowledge doctrine + patterns and gives the AI a work path free of drift and memory loss. From review/retro + pattern consolidation across brain/memory/wiki |
| 2026-05 | v4.7 | §32.9 skill determinism gate; §32.8 (6)/(7); §1.9 worker self-flag; §11.4 review corollary; §25 +3 anti-patterns | Review/retro of the eq-library-v3 application |
| 2026-05 | v4.6 | §32.8 drift avoidance (determinism gate, pointer brief, Stop-Retro, verification gate) | Isolation alone only relocates drift |
| 2026-05 | v4.5 | §32.7 worker agent: need + spec format + scaffolding | CDP4 alone is sufficient for creating workers |
| 2026-05 | v4.3/4.4 | §32 orchestrator rule; §1.9 clarify-first | Delegation binding; clarify gaps early |
| 2026-05 | v4.0–4.2 | §27 implementation toolkit; §28 durable artifacts; §29 modes A–E; §30/§31; self-containment | Pocock toolkit + brownfield lessons; satisfiable from a single file |
| 2026-05 | v3.0/3.1 | „Coden mit KI" evaluation (14 sections); TDD-first §11.7 | Knowledge base for Konzept writing |

### Anchor Moves (Redirect Table)

The v5.0 statement "§ anchors unchanged" does not apply to the following anchors; citations of them are to be checked and re-pointed:

| Old anchor | Status | Successor |
|---|---|---|
| §8 | stub removed (v5.0) | no successor; remove citations |
| §12 | stub removed (v5.0) | no successor; remove citations |
| §11.6 | merged into §11.3 (v5.0) | §11.3 |
| §10.0 | never existed as a section of its own | §10.1 |
| §32.18 | does not exist | check §32.17 (role graph) |
| §32.12 (fan-out error correlation), §32.13 (deterministic tool cores: Rector, Playwright, repomix), §32.15 (multi-agent orchestration: auto-decomposition and dispatch), §32.17 (role graph, edge schema over the role doctrine), §32.19 (team-as-company communication), §35.2 (performance profiling) | present only in the knowledge layer (Orbit), not in this copy | until synchronization, the brief carries the verbatim excerpt from Orbit. Do not confuse with the v6.0 anchors §32.21–§32.24, which are plugin rules without an Orbit original. §1.11, §27.1.1 and §35.1 are in this copy since v6.0 |
| „Beleg-Kette (§10.6)" in role and playbook texts | citation drift: §10.6 is the verification agent next to the review agent | the evidence requirement is §32.8 (3)/(4) |
| „Worker-Regel §32.7" for the skills/agents ban | citation drift: §32.7 (5) only bans MCP | §32.2 (6) |
| „Audit (§27.4)" | citation drift: §27.4 is the vertical TDD loop | §11.4 / §32.11 |

---

> **End of CDP5 (v6.0).** Predecessor CDP4 (v4.7, `konzept-design-pattern-v4.md`) remains frozen as fallback reference.
