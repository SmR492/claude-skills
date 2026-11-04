# Brief SL-2 build of the gate decision table and line grammar (stage-1 worker run 55 of cap 58)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and the answers "Design table first (Recommended)" and "Both block (Recommended)" (2026-11-04, concept §0 item 29; ledger 0021): one build run of the gate decision table and the line grammar after their outside review (run 54), then one `review-verify`.

Output format (final answer, handback only, no file): acknowledgement line; status; per item the test, its red run (command, exit, the failing assertion message quoted verbatim from that run's output) and its green run; the counter-tests listed below, red on the starting tree and green at the end; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one item. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert; state only mutation results you ran, quoting the run's failing test titles. No test may be weakened, removed or skipped unless an item below changes what it asserts; name every such change with the item and the table row or grammar rule that requires it. At most 2000 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (T1 to T3, four fixes, the temp-directory task; last report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix4.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Create temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.12 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 398acae53b38b7ef91bdadfcb8ed2d96799aad4304ee5271609c6405e7564fe4; read only): §5.3 "Line grammar of a capture" (g1 to g6) and "Gate decision table of `decision-check.mjs`" (its head, the capture rows and the `D-n` status rows), AC-12.29 to AC-12.32, UC-01 step 5.2, the `D-n` row. Diffs: `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0510-v0511.diff` and `concept-v0511-v0512.diff`.
- The reviews that led here: `reports/sl2-fix4-rv.md`, `reports/sl2-fix4-auditor.md` (their counter-tests and results: `reports/sl2-fix4-review-counter-tests.txt`) and the outside review `reports/sl2-gate-table-review.md`.

Items (each test-first, in this order):
1. Line grammar (AC-12.29; test title "fires: line grammar g1 to g6 of §5.3", one test or one per rule with that prefix): `checks/verdict-check.mjs` reads every counter-role capture by g1 to g6 after removing Cf characters, NFKC normalisation and mapping Unicode Pd and U+2212 to `-`: the verdict value is one of the five classes; an objection line has exactly the four fields in order and no other objection id and no premise mark; the `premises:` section ends at the first line that does not start with `- `; a disposition line follows the disposition paragraph of §5.3 and an `upheld` disposition rejects; a `> ` quote line carries no objection and no premise; an objection id or a premise mark in prose rejects. Rename the two test titles at `checks/verdict-check.test.mjs:391` and `:571` to what they assert (run 52 🟢-6).
2. Gate decision table, capture rows (AC-12.30; test title "fires: gate decision table capture rows"): `checks/decision-check.mjs` gives each row's outcome: a valid live latest (a) counts; a stale (a) neither counts nor blocks; a not-decidable neither counts nor blocks; a (b) or (c), live or stale, blocks until its records, and counts once cleared only when live and the latest; an `accept` record does not clear a (c); a conflicted capture, valid or rejected, live or stale, blocks until its item records or `:conflict`, then follows its verdict row; a rejected, not conflicted capture with a verdict (b) or (c) by the match rule of the table head blocks until `<capture id>:capture`; other rejected captures and captures after the `decided` stamp neither count nor block.
3. Gate decision table, status rows and `D-n` set (AC-12.31; test title "fires: gate decision table status rows and D-n set"): decided, superseded, proposed, any other status, and an allocated `D-n` below `ids.next.D` without a `run.json` entry give the table's result; an index line whose `.md` does not re-read fails the gate.
4. Record `<capture id>:capture` (AC-12.32; test title "fires: object <capture id>:capture"): `scripts/run.mjs object` and `lib/verdict-index.mjs` accept it only for a rejected, not conflicted devils-advocate capture of the run that has a verdict (b) or (c), refuse it otherwise with its own code, and the gate counts it as clearing that capture's block.
5. Texts (§5.3 "the role file states it"; run 49 🟡-2 recurring, run 53 F7): `agents/devils-advocate.md` Output states the grammar causes (the four-field objection line, no second id or premise mark in it, premise rows only in the section, the `> ` quote form for the verbatim assignment, disposition lines, an id or premise mark in prose rejects); `skills/idea/SKILL.md` names the record forms `run.mjs object <capture id>:F-P1-<n>`, `<capture id>:premise-<n>`, `<capture id>:conflict` and `<capture id>:capture`. The skill must still pass skill-lint.

Counter-tests (append unchanged; red on the starting tree as `reports/sl2-fix4-review-counter-tests.txt` shows; green at the end):
- run 52: 🟡-3 (`checks/decision-check.test.mjs`) and 🟢-4 (`checks/verdict-check.test.mjs`).
- run 53: A1, A2, A6 (`checks/decision-check.test.mjs`), A3, A4, A5 (`checks/verdict-check.test.mjs`), A7 (`checks/idea-skill.test.mjs`).
- Not unchanged: run 52 🟡-2 asserts that an objection line whose `refuted when:` names another objection id is valid, which g2 (no other objection id in the line) does not allow; in its place write a test that both of its lines reject and that the same objection written as its own objection line is valid.
- An import that duplicates one already in the file is merged into the existing import line; say so for each.

Out of scope (recorded follow-ups): the semantics of `resolved`, `withdrawn` and `upheld` dispositions beyond the reject of `upheld` (return cycle and C13 clearing, SL-5); the spawn-time target check (SL-3); shell writes and link creation on an open target (SL-4; the hand check); the stale-lock break race (refactor task before SL-3); `lib/handback.mjs` (SL-2b); run 39 NV1 to NV3; run 50 NV-a, NV-b; the `SAFE_TASK` copy; registering `verdict-check.mjs`; `guard-shell.test.mjs` needing its temp directory outside a git repository; any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

Rules: `node:test`, temporary directories only through the `tempDir` helper, temporary HOME, no real home, key or Claude Code; no comments in code; no new dependency; structured errors without internals; keep every other test green unless an item changes what it asserts.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0), run on the final tree
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`
(`generate-contract.mjs --check` and the empty-TMPDIR leak check are run by the orchestrator.)

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted SL-2 diff)
baseline: cdp6-core 496/496 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T10:35:20+01:00)
run grant: one impl-uc use, to be confirmed by the owner

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree (remove it before your final answer).

Stop rule: items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
