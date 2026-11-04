# Brief SL-2 third fix after the final reviews (stage-1 worker run 48 of cap 52)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02) and the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04; ledger 0021). The final reviews (`review-verify` run 46, block until three 🟡 are fixed and one 🟢 is ruled; fresh `adversarial-auditor` run 47, FREIGABE-MIT-AUFLAGEN with F-2 and F-3 as preconditions for acceptance) feed this fix; the orchestrator executed all ten of their counter-tests unchanged: seven failed as predicted, three passed as predicted (`reports/sl2-final-review-counter-tests.txt`).

Output format (final answer, handback only, no file): acknowledgement line; status; per item the test, its red run (command, exit, the failing assertion message quoted verbatim from that run's output) and its green run; the counter-tests listed below, red or green on the starting tree as stated and green at the end; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one item. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert; state only mutation results you ran, quoting the run's failing test titles. No test may be weakened, removed or skipped unless an item below changes what it asserts; name every such change with the item. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted SL-2 diff (T1 to T3, two fixes, the temp-directory task; reports `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix2.md`, `sl2-tmp.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `. Create temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.9 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 4d8367ae8aec6f9b6b7f7f70153c1690841f31af6bc41bb04b83bd68a502d105; read only); its diff against v0.5.8 is `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v058-v059.diff`.
- The reviews: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix2-rv.md` (🟡-1 to 🟡-3, 🟢-4 to 🟢-7, tests T1 to T7) and `sl2-fix2-auditor.md` (F-1 to F-3, NV-1 to NV-3).

Items (each test-first, in this order):
1. `:conflict reject` after the decision (UC-01 step 5.2, line 275; review 🟡-1): `run.mjs object <capture id>:conflict reject` is refused with its own error code once the capture's `D-n` is decided; `accept` stays possible. Review test T1 asserts another design (a later pass counts) and is not added; in its place write a test that the reject is refused after `decided`, accepted before it, and that `accept` after `decided` lets the gate pass.
2. Capture form (§5.3, line 1232; review 🟡-2, 🟡-3, audit F-2): a line that contains `objection` or `objections` followed by `:` anywhere, in any letter case (also in a table row, a code span or after an invisible character such as U+200B), and is not a well-formed `objection:` line rejects the capture; a line outside the `premises:` block that contains `-- checked` or `-- unchecked` in any letter case, with any mark, separator or tail, rejects it; `fresh context: no` (or a missing `fresh context:` line) invalidates the pass of every counter-role (`devils-advocate`, `pessimistic-realist`, `adversarial-auditor`, `threat-modeler`). Change the control test at `checks/verdict-check.test.mjs:408` ("objections: see the lines above" passing) and the assertion at `:369` (`fresh context: no` valid for the other counter-roles) as this item requires, naming each.
3. Target deny by file identity (UC-01 step 3, line 270; audit F-3, review 🟢-4): `hooks/guard-phase.mjs` denies `Edit`, `Write` and `NotebookEdit` when the written path, if it exists, has the device and inode of an open devils-advocate spawn's target (so a hard link or another letter case is denied), besides the existing path comparison; an unreadable or malformed `counters.json` keeps denying these three tools (fail closed, as v0.5.9 states; review test T4 is not added).
4. Lock wait (§5 table line 1190; audit F-1): `withLock` in `lib/run-store.mjs` checks its deadline also after a failed `stat` or `unlink` of the lock path and sleeps between tries, so a dangling-link or directory lock ends the wait at its deadline with the lock-busy error for every caller (`verdicts.lock`, `run.lock`, `counters.lock`); the gate then fails closed with its named finding.
5. Proposed `D-n` at the P1 exit (UC-01 Exit, line 252; audit NV-2): a `D-n` still `proposed` when `run.mjs exit idea` runs fails the gate with a finding naming it; a `superseded` one does not.
6. Conflicted capture with items (UC-01 step 5.2, line 275; audit NV-3): a test pins that records on all items of a conflicted capture clear only its conflict block and the capture then counts by its verdict: verdict `a` passes; verdict `b` still needs its objection records as for any capture.

Counter-tests (append unchanged; state of each on the starting tree as given; all green at the end):
- red on the starting tree: review T2 and T3 (`checks/verdict-check.test.mjs`), audit F-1 (`checks/verdict-check.test.mjs`, extra imports `symlinkSync`, `utimesSync` from `node:fs`), audit F-2 (`checks/verdict-check.test.mjs`), audit F-3 (`hooks/guard-phase.test.mjs`, extra import `linkSync` from `node:fs`).
- green on the starting tree, added to pin what they check: review T5 (`hooks/guard-phase.test.mjs`; it uses `symlinkSync`, import it if the file lacks it), T6 (new file `lib/temp-dir-helper.test.mjs`) and T7 (`checks/verdict-check.test.mjs`).
- Not added: T1 (item 1 replaces it), T4 (item 3 keeps fail-closed).
- An import that duplicates one already in the file is merged into the existing import line; say so for each.

Out of scope (recorded follow-ups): the spawn-time target check (SL-3 with `brief-lint.mjs`); shell writes and link creation on an open target (SL-4; the §11.3 item 3 hand check); `lib/handback.mjs` (SL-2b); the refactor task before SL-3; run 39 NV1 to NV3; the `SAFE_TASK` copy; registering `verdict-check.mjs`; `guard-shell.test.mjs` needing its temp directory outside a git repository (run 45 finding); any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; the CDP5 plugins; the concept.

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
baseline: cdp6-core 469/469 exit 0, CDP5 suite 295/295 exit 0, an empty TMPDIR left empty (orchestrator re-run 2026-11-04T09:44:42+01:00)
run grant: to be issued after the owner's decision (both uses of the last grant are spent)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree (remove it before your final answer).

Stop rule: items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
