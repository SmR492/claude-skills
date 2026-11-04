# Brief SL-2 combined fix after the slice-end reviews (stage-1 worker run 41 of cap 52)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021). The SL-2 slice-end reviews (`review-verify` run 37, `review-code` run 38, `adversarial-auditor` run 39 SPERRE, outside `konzept-reviewer` run 40) feed one combined fix run; the auditor's condition is a fix of F1, F3 and F4 followed by a fresh audit.

Output format (final answer, handback only, no file): acknowledgement line; status; per item below the test, its red run (command, exit, the failing assertion message quoted verbatim from that run's output) and its green run; the three `decision-check` counter-tests of the audit, added unchanged, red on the starting tree and green at the end (the two `guard-spawn` ones belong to the F2 follow-up); files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one item; never one stub batch for a whole file. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert. At most 2000 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted T1, T2 and T3 diff (reports `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t1.md`, `sl2-t2.md`, `sl2-t3.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `.
- Specification: the concept v0.5.7 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 869d42f4a5d6b791fdef9690ec68cd75358c4f42f2cbc824140616ca344ee174; read only). The v0.5.7 edits fold in these reviews; their diff against v0.5.6 is `<scratchpad>/concept-v056-v057.diff`.
- The reviews: the ledger rows "SL-2 T3 review-verify (run 37)", "SL-2 review-code (run 38)", "SL-2 adversarial-auditor (run 39)" and "SL-2 outside review (konzept-reviewer run 40)" of `<repo>/docs/retro/0021-cdp6-framework.ledger.md`. The audit's counter-tests, as the orchestrator executed them, with their raw output: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-audit-counter-tests.txt`; their code is in brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-fix-counter-tests.md`.

Items (each test-first, in this order):
1. `lib/verdict-index.mjs` (concept §1.2 `lib/` row, v0.5.7): the one reader of `S/verdicts/index.jsonl` (the strict reader now in `lib/capture.mjs`), the item id formats (`F-P<k>-<n>`, `<capture id>:F-P<k>-<n>`, `<capture id>:premise-<n>`), the verdict classes, and one function that says which items of a capture are not cleared by the run's `run.mjs object` records. `lib/capture.mjs`, `checks/verdict-check.mjs`, `checks/decision-check.mjs` and `scripts/run.mjs object` use it; the duplicates (`PASSING`/`BLOCKING` twice, two devils-advocate tests, three id patterns, two index readers) go.
2. F3, objection records scoped by the capture id (UC-01 step 5.2, AC-11.14, §5.3 capture form): `run.mjs object` accepts `<capture id>:F-P<k>-<n>` and `<capture id>:premise-<n>`, each naming an item on an index line of the run, and refuses a bare `F-P<k>-<n>`; the gate matches records by the scoped id. Update the AC-11.14 tests to the scoped form.
3. F1, a devils-advocate capture with a `decision` and no `target:` is `stale` (error row "Verdict's target hash differs …", AC-12.3, v0.5.7).
4. F4, the gate re-reads the `.md` files (§5 table row `S/verdicts/`, v0.5.7): for each counted capture the `.md` sha256 must equal the index line's, the verdict fields come from `verdict-check.mjs` on that file, and an index line without its `.md` or a `.md` without its index line is a finding.
5. A `conflicted` capture keeps its decision open whatever its validator result (C13; UC-12 step 5 "whatever the conflicted capture's validator result"; run 37 U1).
6. Capture form (§5.3, v0.5.7): a `b` or `c` verdict needs at least one objection, and each objection needs `artefact:` and `evidence:` (file:line or command); `TRIAD_ROLES` drops `psy-grenzwaechter`, which is not a CDP6 role (§2).
7. Deny once on a failing capture form (UC-12 step 4, v0.5.7): a counter-role handback whose capture form fails `verdict-check.mjs` is denied once with the reasons through the existing marker; the second failing handback is captured with `validator: rejected`.
8. `scripts/run.mjs exit` writes `reconciliation: not built` into the gate result in stage 1 (§11.3 item 3; run 40 gap 7).
9. `lib/capture.mjs` rollback: restore the index from the content read before the write whenever the `.md` was written, also after a partial append, and keep a rollback error from replacing the original error.
10. Deny reasons in `hooks/check-handback.mjs` name their cause: `spawn-closed`, `spawn-unknown` and `lock-error` get their own reasons.
11. `lib/brief.mjs` checks the `task:` value against `[A-Za-z0-9._-]+`, so `guard-spawn.mjs` records `header: invalid` at spawn instead of a refusal at handback.
12. Skill `cdp6-core:idea` (`skills/idea/SKILL.md`): `idea.md` holds no `D-n` status and no autonomy level or budgets; the devils-advocate brief carries `task: D-1` and `target: idea/idea.md@<sha256>`; `idea.md` is not edited after that spawn (UC-01 Artefacts and step 3, v0.5.7). It must pass the skill-lint gate.

Out of scope (recorded follow-ups): the spawn-time target check (audit F2; SL-3 with `brief-lint.mjs`); `lib/handback.mjs` for `check-stop.mjs` (review-code D3; SL-2b); the shared hook start-up helper and reason table, the contract header builder and the written lock order (refactor task before SL-3); audit NV1 to NV3; any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins or the concept.

Rules: as in the T3 brief (`node:test`, temporary directories and HOME, no real home, key or Claude Code; no comments in code; no new dependency; structured errors without internals; keep every other test green unless an item changes what it asserts).

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`
(`generate-contract.mjs --check` is run by the orchestrator.)

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted T1 to T3 diff)
baseline: after T3, cdp6-core tests 417/417 and CDP5 suite exit 0 (orchestrator re-run 2026-11-03)
run grant: to be issued after the owner's decision (the grant of the SL-2 start is used up)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree.

Stop rule: items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
