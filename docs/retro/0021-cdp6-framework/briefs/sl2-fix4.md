# Brief SL-2 fourth fix after the reviews of the third fix (stage-1 worker run 51 of cap 56)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answers "Raise cap to 56 (Recommended)" and "Id rule (Recommended)" (2026-11-04, concept §0 item 28; ledger 0021). The reviews of the third fix (`review-verify` run 49, block on one point; fresh `adversarial-auditor` run 50, FREIGABE-MIT-AUFLAGEN with F1 and F2 as preconditions for acceptance) feed this fix; the orchestrator executed all twelve of their counter-tests unchanged: eight failed and four passed as predicted (`reports/sl2-fix3-review-counter-tests.txt`).

Output format (final answer, handback only, no file): acknowledgement line; status; per item the test, its red run (command, exit, the failing assertion message quoted verbatim from that run's output) and its green run; the counter-tests listed below, red or green on the starting tree as stated and green at the end; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one item. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert; state only mutation results you ran, quoting the run's failing test titles. No test may be weakened, removed or skipped unless an item below changes what it asserts; name every such change with the item. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (T1 to T3, three fixes, the temp-directory task; last report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix3.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Create temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.10 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 da61f9cbe270b00db79953beac77459719ce28ef5eaccfd5d4a68979b100f55f; read only); its diff against v0.5.9 is `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v059-v0510.diff`.
- The reviews: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix3-rv.md` (🟡-1, 🟡-2, 🟢-3 to 🟢-6) and `sl2-fix3-auditor.md` (F1 to F6, NV-a, NV-b).

Items (each test-first, in this order):
1. Id rule for the capture form (§5.3, line 1233; §0 item 28 (2)): `checks/verdict-check.mjs` removes format characters (Unicode Cf) from the text before every check; an objection is only a well-formed `objection:` line; an objection id `F-P<k>-<n>` anywhere else in the capture rejects it; a premise mark (`-- checked` or `-- unchecked`, any letter case) outside the `premises:` block or inside an objection line rejects it; a second `verdict:` line rejects it. The list of objection-like spellings (`OBJECTION_LIKE`, `OBJECTION_MARKER`) goes; prose without an objection id carries no objection and does not reject. The tests at `checks/verdict-check.test.mjs:391` and `:570` assert the spelling list and change as this item requires; name each changed assertion.
2. Role file (§5.3 line 1233 "the role file states it"; review 🟡-2): `agents/devils-advocate.md` Output states every reject cause of the capture form: an objection id anywhere except on a well-formed objection line, a premise mark outside the `premises:` section or in an objection line, a second verdict line, `fresh context: no` (which invalidates the pass), and that prose carries no objection.
3. `superseded` (`D-n` row, line 155; audit F2): `run.mjs decision D-n superseded` is an owner command (`lib/run-argv.mjs` `ownerForm`), and `checks/decision-check.mjs` fails a superseded `D-n` that has a live devils-advocate capture with verdict (b), (c) or `conflicted` without the owner records UC-01 step 5.2 asks for; the finding's text no longer suggests superseding as a way out.
4. Later pass (UC-01 step 5.2, line 276; audit F3): a later passing capture does not answer away a live (not `stale`) capture with verdict (b) or (c) on the same `D-n` stamped before `decided`: its owner records are still needed; a "not decidable" capture is still answered by a later round.
5. Missing `counters.json` (UC-01 step 3, line 271; review 🟢-6): in an active run, `hooks/guard-phase.mjs` denies `Edit`, `Write` and `NotebookEdit` when `counters.json` is missing, as when it cannot be read; the test at `hooks/guard-phase.test.mjs:287` asserts the opposite for the missing case and changes as this item requires.

Counter-tests (append unchanged; state on the starting tree as given; all green at the end):
- red on the starting tree: review 🟡-1 (`checks/verdict-check.test.mjs`), review 🟡-2 (`checks/devils-advocate-agent.test.mjs`), review 🟢-3 (`checks/verdict-check.test.mjs`), audit F2 both tests (`checks/decision-check.test.mjs`, `lib/run-argv.test.mjs`), audit F3 (`checks/decision-check.test.mjs`).
- green on the starting tree, added as pins: review 🟢-4 (`hooks/guard-phase.test.mjs`, `copyFileSync` merged into the existing `node:fs` import) and 🟢-5 (`lib/run-store.test.mjs`).
- Not unchanged: audit F1 asserts the spelling list (markup before the colon rejects even without an objection id); in its place write a test that the same three lines with an objection id (`F-P1-2`) reject, and without one are prose and pass. Audit F4 asserts the false reject; in its place write a test that a verbatim assignment quote containing "objections:" passes.
- Not added: audit F5 (it pins a write lock the §11.3 item 3 hand step resolves; concept line 1645); audit F6 (the lock-break race goes to the refactor task before SL-3 with the written lock order).
- An import that duplicates one already in the file is merged into the existing import line; say so for each.

Out of scope (recorded follow-ups): audit F5 and F6 as above; audit NV-a and NV-b; the spawn-time target check (SL-3); shell writes and link creation on an open target (SL-4; the hand check); `lib/handback.mjs` (SL-2b); the refactor task before SL-3; run 39 NV1 to NV3; the `SAFE_TASK` copy; registering `verdict-check.mjs`; `guard-shell.test.mjs` needing its temp directory outside a git repository; any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

Rules: `node:test`, temporary directories only through the `tempDir` helper, temporary HOME, no real home, key or Claude Code; no comments in code; no new dependency; structured errors without internals; keep every other test green unless an item changes what it asserts.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`
(`generate-contract.mjs --check` and the empty-TMPDIR leak check are run by the orchestrator.)

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff)
baseline: cdp6-core 482/482 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T10:11:39+01:00)
run grant: one impl-uc use, confirmed by the owner with the cap decision

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree (remove it before your final answer).

Stop rule: items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
