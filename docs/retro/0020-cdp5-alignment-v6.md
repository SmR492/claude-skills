# Retro 0020 — CDP5 alignment and doctrine v6.0

**Status:** accepted · **Date:** 2026-10-19 · **Purpose:** retro of the alignment run (DECISIONS.md D-13 batches 7 and 8) · **Moderated by:** pm-retro (blind-test run, hooks simulated) · **Written by:** orchestrator

## Assignment (verbatim)

"Bitte in nachgang alle Skills Workflows und Agents mit der CDP 5 abgleichen, zu starre oder zu lasche anweisungen härten und entsprechend aufeinander abstimmen, damit kein drift entsteht und die Agents nicht in ihrer arbeit blockiert werden."

## Carry-over from the previous retro (ROLE-TEST-2026-10-19)

| Item | Status | Evidence |
|---|---|---|
| Bash guard rebuilt as allowlist | done; bypass class recurred once (closed in batch 7) | guard-bash.test.mjs; DECISIONS.md batch 7 "Mechanics" |
| Acknowledgement accepts both forms | done | lib/contract.mjs ackPresent; contract now v2 |
| konzept-lint vague words, struktur itemised | done | konzept-lint.mjs VAGUE, tests |
| impl-refactor scope | done (merge and split) | DECISIONS.md batch 4 (2) |
| Translation decision | done (all English) | DECISIONS.md batch 4 (1) |
| Run grants | done, extended (per project, uses) | lib/grants.mjs, grants.test.mjs |
| domain-agents dependency prose-only | done | domain-agents/hooks/require-contract.mjs |
| Live hook test with installed plugins | **held** — carried six times without owner | ROLE-TEST, DECISIONS.md batches 2–8 |
| Duplicate retro numbers 0001/0002 | **held** — now detected by retro-memory-loop-check (🟡 numbering) | this retro, Kaizen RC3 |

## Context

Four fresh-context reviewers read the engineering agents, the orchestration mechanics, the T1 skills and the domain plugin against the doctrine copy; 213 findings were fixed in one pass (157 → 247 tests), the worker contract went to v2, and the doctrine copy v6.0 replaced v5.1.

## Decision chronicle

- E1 [user] whole repository in English.
- E2 [user] impl-refactor: merge and split only.
- E3 [user] run-grant mechanism.
- E4 [user] both Orbit reports integrated as CDP5 pieces, not copies.
- E5 [user] align everything with CDP5; the doctrine may change with justification.
- E6 [user] replace CDP5 v5.1 by v6.0.
- E7 [orchestrator] 213 findings fixed in one pass by four implementers with disjoint file ownership, each fix with a test where code was involved.
- E8 [orchestrator] not adopted from superpowers: delete-code-before-tests, five fix rounds, `skills-ref` dependency.

## What went well

- Every doctrine change carries a justification and a target paragraph.
- Blocking stops were given defaults instead of being deleted (`preconditions: none claimed`, review against the code's own structure, risky split marked, decidable bounds).
- The security doctrine was turned on the tooling itself: judgment agents lost `curl` and `git ls-remote`.
- The start-guard defect was proven red first and is now covered by a CLI test from a path with a space in every T1 skill.
- Agents repeat the CONTRACT-MISSING fallback because the injected core is absent exactly when it is needed.

## What did not go well (system causes)

- 14 of 16 T1 scripts shipped with a start guard that was a silent no-op on Windows hosts and paths with spaces, across three plugin versions, while the live install test stayed an open line.
- Dangling doctrine anchors had to be repaired by hand for the third time in seven days.
- The run produced no ledger and no usage log (plugins not installed), so the retro rests on prose and its recurrence counts are lower bounds.
- The thirty doctrine changes went through without a devils-advocate pass; the counter-role table had no row for a doctrine change.

## Root causes and recurrence

| ID | Root cause | Severity | Recurrence |
|---|---|---|---|
| RC1 | An entry point never executed in the target environment counts as green | 🔴 | 4 (retro 0001 E4, retro 0002 E1/E5, ROLE-TEST T2, batch 7) — escalated |
| RC2 | Citation integrity of doctrine anchors is decidable but was left to reviewers | 🟡 | 3 (2026-10-12, blind test, batch 7) — escalated |
| RC3 | Retro inputs have no deterministic producer or checker outside the installed hooks | 🟡 | 2 |
| RC4 | A doctrine change was not a "choice" object in the counter-role table | 🟡 | 1 |

## Kaizen

| Root cause | Action | Owner | Criterion | Status |
|---|---|---|---|---|
| RC1 | Release gate: no version bump and no push before the live install test ran on the user's host with the hook outputs recorded | orchestrator; human holds push | DECISIONS.md carries a "live install" row with host, Claude Code version, inject/check-ack/guard/usage-log outputs | rule added to orchestrate (Closing a task, step 6); test itself **open — human decision ESC-1** |
| RC2 | Deterministic anchor check over every agent file and SKILL.md against the doctrine copy and its redirect table | implementer | test red on `§99.9`, green on the repository | **done** — `plugins/cdp5-agents/hooks/anchors.test.mjs` |
| RC3 | Numbering check in retro-memory-loop-check; ledger by hand when hooks are absent | orchestrator | 🟡 `numbering` finding fires on 0001/0002; ledger file exists for this run | **done** — check and test added; ledger `0020-cdp5-alignment-v6.ledger.md`; renumbering **open — human decision** |
| RC4 | Counter-role row "doctrine or policy change → devils-advocate, null option: keep the previous version"; run the pass on v6.0 | orchestrator | row in orchestrate; DECISIONS.md records the pass | row **done**; pass on v6.0 runs in blind-test round 2 |

## Lessons

- L1 — A test that never starts the program is not evidence that the program starts.
- L2 — A decidable citation rule belongs in a gate, not in a review finding.
- L3 — Harden a stop by giving it a default, not by deleting it.
- L4 — Apply the security doctrine to the tooling that enforces it.
- L5 — A retro reconstructed from prose has lower-bound recurrence counts.

no new lesson: none of L1–L5 is promoted to a memory slug yet; the user decides which become durable memory entries.

## Core lesson

Decidable requirements (an entry point starts, an anchor resolves, a number is unique) belong in tests; reviews find the rest.

## Fork balance

| Path | State | Owner |
|---|---|---|
| Live install test with installed plugins | open | orchestrator, gated by human (ESC-1) |
| Push of the local commits | open | human |
| Duplicate retro numbers 0001/0002 (cdp5 vs nsai-edge) | open | human decides: renumber or move nsai-edge retros |
| Devils-advocate pass on v6.0 | open, running in blind-test round 2 | orchestrator |
| Calibration set for the rubric | open | orchestrator |
| Eval suites with `claude plugin eval` | open, depends on live install | orchestrator |
| German Orbit paragraphs as generator source | open | orchestrator (Orbit phase) |
| Not adopted from superpowers | abandoned, reasons recorded | — |
| Crisis numbers C1 | closed (checked 2026-10-19) | — |

## Escalations

- **ESC-1 (RC1, 🔴):** release gate. Options: (a) no version bump and no push until the live install test is recorded; (b) push now with a known-issue line "hooks and T1 entry points unexecuted on the host"; (c) keep it as an open line. Recommendation: (a).
- **ESC-2 (RC2):** citation integrity as a test in the repository's own suite — implemented as `anchors.test.mjs`; closes with this retro.
