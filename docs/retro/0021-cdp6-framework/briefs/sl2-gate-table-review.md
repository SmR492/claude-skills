# Brief: outside konzept-reviewer of the SL-2 gate decision table and line grammar (stage-1 worker run 54 of cap 58)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answers "Design table first (Recommended)" and "Both block (Recommended)" (2026-11-04, concept §0 item 29; ledger 0021): no fifth patch round; one gate decision table and one line grammar for the capture form, checked once by an outside `konzept-reviewer` against the findings of runs 39 to 53, then one build run.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>` and `fresh context: yes|no`; part A: per finding listed below, whether the grammar and table of concept v0.5.11 decide it (decided, with the row or rule; not decided; decided against the owner's ruling) with line evidence; part B: completeness of the table: every combination of capture state (live or stale; valid or rejected; conflicted or not; verdict `a`, `a-with-conditions`, `b`, `c`, `not-decidable`, none) × stamp (before or after `decided`) × `D-n` status (`proposed`, `decided`, `superseded`, other) × owner records (none, partial, all) maps to exactly one outcome; name every combination that maps to none or to two; part C: every unchanged concept line the grammar or the table contradicts (UC-01 Exit and steps 3, 5.2; UC-03 step 3.2; UC-12 steps 4 and 5 and their error rows; AC-11.14, AC-12.x; §5.3 header and disposition lines at 1231; C1, C11, C13; the `D-n` row; O4, O14, O15; §11.3 item 3), with both line numbers; part D: gate status, dimension scores and prioritised gaps with one closing proposal each, as your role defines; then status. At most 2000 words.

Target state: concept v0.5.11 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 2b1d87364811a1faa99d37b2a23bbc9c35e8e95539bc73a8849b06716d327ab2); the grammar and the table follow the capture-form paragraph of §5.3 (search "Line grammar of a capture" and "Gate decision table"); the diff against v0.5.10 is `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0510-v0511.diff`; §0 items 28 and 29 at lines 37 and 38. You wrote no part of it and read none of the SL-2 build. `<repo>` = the repository root (main checkout).

Findings to decide (reports under `<repo>/docs/retro/0021-cdp6-framework/reports/`; the ledger rows of `<repo>/docs/retro/0021-cdp6-framework.ledger.md` name each with its executed counter-test):
- run 39 (`sl2-audit-counter-tests.txt`; ledger row "SL-2 adversarial-auditor (run 39)"): F1 target-less capture, F3 objection ids across decisions, F4 index lines trusted.
- runs 42, 43 (`sl2-fix-rv.md`, `sl2-fix-auditor.md`): F-1, F-2, F-3 to F-8; F-A, F-B, F-C, F-D, F-E, NV-1.
- runs 46, 47 (`sl2-fix2-rv.md`, `sl2-fix2-auditor.md`): 🟡-1 to 🟡-3, 🟢-4 to 🟢-7; F-1 to F-3, NV-1 to NV-3.
- runs 49, 50 (`sl2-fix3-rv.md`, `sl2-fix3-auditor.md`): 🟡-1, 🟡-2, 🟢-3 to 🟢-6; F1 to F6, NV-a, NV-b.
- runs 52, 53 (`sl2-fix4-rv.md`, `sl2-fix4-auditor.md`): 🟡-1 to 🟡-3, 🟢-4 to 🟢-6; F1 to F7, NV1.
Findings that a later run closed in code and that the grammar or the table do not touch may be answered "outside the table" with the ledger row that closed them.

Tools: Read, Grep, Glob. No writes, no network, no test runs. Read the concept, the reports and the ledger; do not read `plugins/` (the review is of the concept, not of the code).

Stop rule: one pass; at most 60 tool calls; a statement without a line number is reported as unclear.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
