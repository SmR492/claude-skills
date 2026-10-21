# Retro-ADR 0010 — `as_of` in hybrid retrieval (NSAI-Edge Slice #5b)

**Status:** completed (adversarial YES-with-reservation → three 🟡 handled differentially) · implemented autonomously + self-merged (gmail/SmR492, PR #10)
**Date:** 2026-05-28 (continuation of the autonomous night session)
**Purpose:** Slice #5b — `search({as_of:T})` closes the last read-lens gap; retrospective of the small sub-slice kept to narrow scope and of the differentiated adversarial handling (fix along, de-tautologize, deferred).

## Context
§H.2 item 5 (Slice #5) had brought `as_of` to `query`/`verify`/`resolveBelief`, but `search` was left out. So a historical `search` returned currently valid edges and future episodes — hybrid answer inconsistent between the axes. Slice #5b closes the gap.

The lead-in was the real end-to-end test against EU AI Act compliance (`/tmp/demo-kivo.mjs`): episode + authority-weighted facts ("gesetz" beats "llm" 1000:0), verify supported/contradicted/unknown (open world), PPR multi-hop, bi-temporal as-of, supersedeTemporally draft→final, provenance. All paths as expected — confirms the stack's maturity.

## CDP5-checked architecture decisions (upfront)
- **Narrow scope:** same `_validClause` clause as `query`/`verify`/`resolveBelief`, no own read logic. Lens consistency structural (same SQL), not asserted.
- **Determinism gate untouched:** PPR remains a local float lens; `as_of` is read-only, not in the wire, not in the signature, not in `exportSince`.

## Decision chronicle
- **E1 — Demo first** (`node /tmp/demo-kivo.mjs`): confirms that the stack delivers the expected verdicts/beliefs/paths on a real compliance scenario. One subtlety: after `reject`, `verify` keeps showing the rumor as `contradicted` (instead of `unknown`) — consistent with the dominance logic, but questionable for explainability (noted in the backlog, not 5b scope).
- **E2 — Patch instead of slice:** no own Konzept lead-in (Konzept = concept document), but a UC-HR extension (step 2, AC-11.11–11.14). Lint stayed 10/10.
- **E3 — Implementation TDD:** `search(as_of=null)` + `_validIso` pre-check + `_validClause` chaining; `recallEpisodes(until=…)`; MCP schema + call. 145/145 green (before 🟡 fixes).
- **E4 — Adversarial audit (YES-with-reservation), handled differentially:**
  - **🟡-A** (recallEpisodes ignores `as_of` → read-lens break between the edge and episode axes): **fixed along in 5b** — `recallEpisodes` gets `until`, `search` passes `as_of` through as until. AC-11.14/11.14b added.
  - **🟡-B** (AC-11.13 tested object-related → tautologically evidenced): **de-tautologized** to the per-edge contract. KONZEPT text clarified: `search ⊆ query` is NOT the contract (topology reaches differ, LIKE+k-hop vs. exact+1-hop). The real contract: identical validity clause.
  - **🟡-C** (UTC-Z only on the read side, not the data side — pre-existing defect): **deferred as Slice #5d**, with repro case + fix plan entered in KONZEPT.md. No scope creep in 5b.
- **E5 — Konzept hygiene:** error-case block in sync with AC-11.12 (🟡-1), test evidence added at AC-11.12/11.13 (🟡-3).
- **E6 — Self-merge** (PR #10) after the full gate.

## Process lesson (core)
**Adversarial findings are not a list "to fix" — they are a list with three answers: (a) fix now, (b) clarify in the Konzept, (c) document cleanly as deferred.** Slice #5b shows all three: 🟡-A was a real consequence of the #5b design, so the fix belongs in #5b. 🟡-B was a test-weakness finding (tautology) — de-tautologize and formulate the contract correctly. 🟡-C was a pre-existing defect that #5b merely makes visible — it belongs in the plan as its own slice, not as a burden on 5b. This differentiation protects reviewer + auditor from "findings inflation" and keeps the narrow scope really narrow.

**Read the test as a contract, not as an indicator.** AC-11.13 was green — but the auditor showed that the green test proves nothing (tautology over a specific object). Lesson once again: a green test without a precise contract statement gives false security. [[feedback-green-tests-bypass-security]]

**Not every finding is new.** The ⚡ effect test was: the auditor also found the pre-existing UTC-Z data-side hole — a bug that Slice #5b does not create but makes more visible. Not a 5b stopper, but a good impulse for #5d.

## Substantive lesson
Read-lens consistency is a **structural** property, not an asserted one: same SQL clause on all read paths (resolveBelief, query, verify, search). Where topology differs (LIKE vs. exact, k-hop vs. 1-hop), there still cannot be a validity inconsistency — the contract is "the same filter clause", not "the same subgraph".

The episode axis needs its own lens (`occurred_at`, not `valid_*`) — deliberately separated so that episode GC and bi-temporal visibility do not interfere with each other.

## Open
- **Slice #5d** (deferred, documented): UTC-Z on the data side (`storeTriple`/`mergeIncoming` `asserted_at`) + one-time migration of the existing column. Own risk assessment, live-DB-copy test, then own PR.
- Federated validity (wire v2) remains deferred — deliberately.
- `reject`-vs-`verify` subtlety (a rejected triple shows `contradicted` as long as dominance holds) — UX polish for UC-V, no correctness gap, backlog.
