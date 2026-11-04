# Brief SL-2 second fix after the fix reviews (stage-1 worker run 44 of cap 52)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02) and the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04; ledger 0021). The fix reviews (`review-verify` run 42 pass-with-conditions, fresh `adversarial-auditor` run 43 FREIGABE-MIT-AUFLAGEN with auflagen F-A, F-B, F-C as preconditions for acceptance) feed this fix; the orchestrator executed all 12 of their counter-tests unchanged and every one failed with the message its reviewer predicted.

Output format (final answer, handback only, no file): acknowledgement line; status; per item below the test, its red run (command, exit, the failing assertion message quoted verbatim from that run's output) and its green run; the counter-tests listed under "Counter-tests", red on the starting tree and green at the end; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one item. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert. No test may be weakened, removed or skipped unless an item below changes what it asserts; name every such change with the item. At most 2000 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted T1 to T3 diff and the first fix (report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `.
- Specification: the concept v0.5.8 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 57942ee3e5cf3c6fd17491498a165ea31285ce761a0e9f7f26940aaa9a27be96; read only). Its diff against v0.5.7 is `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v057-v058.diff`.
- The reviews: `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix-rv.md` (findings F-1 to F-9) and `sl2-fix-auditor.md` (F-A to F-E, NV-1), with the raw output of their executed counter-tests in `sl2-fix-review-counter-tests.txt` in the same directory.

Items (each test-first, in this order):
1. Conflicted captures (UC-01 step 5.2 line 275, UC-12 step 5 line 883, §5.3 line 1232, C13 line 1372; review F-1, F-2, auditor F-C, NV-1):
   a. the items (objection ids and scoped premise ids) of a `conflicted` capture are read from its file and kept on the result even when its validator result is `rejected`, so `run.mjs object` and `decision-check.mjs` count records for them;
   b. a `stale` conflicted capture stamped before the `decided` stamp still blocks its decision;
   c. a conflicted capture that lists no objection and no premise is cleared by `run.mjs object <capture id>:conflict accept|reject --why "<why>"`: `accept` lets it count with its verdict, `reject` keeps it from counting. `run.mjs object` accepts `<capture id>:conflict` only for a capture on an index line of the run that is conflicted and lists no item, and refuses it otherwise with its own error code; the gate's finding for such a capture names the `:conflict` record.
2. Capture form (§5.3 line 1232, error row line 893; auditor F-A, review F-4, F-5):
   a. the form holds for every counter-role (`devils-advocate`, `pessimistic-realist`, `adversarial-auditor`, `threat-modeler`): verdict line and classes, the `b`/`c` objection rule with `artefact:` and `evidence:`, the `premises:` section and the not-decidable rule; `rejected alternative provided:` stays devils-advocate only; the review roles keep only the `conflict of interest:` line (C13);
   b. a line that starts like an objection (`objection` in any letter case, after any list mark or leading whitespace) but is not a well-formed `objection:` line rejects the capture; a premise row (`- … -- checked: …` or `- … -- unchecked`) outside the `premises:` block rejects it; a second `verdict:` line rejects it, also with the same value.
3. Stale rule (error row line 894, AC-12.3 line 903; review F-6): any capture that names no target is `stale`, whatever its role and whether it has a `decision`; update the tests of the first fix that assert otherwise, naming each.
4. Gate re-read (§5 table line 1190; review F-3, auditor F-E): an index line whose `id` is not its file name without `.md` is a finding; `rereadCaptures` reads `verdicts/` while holding `verdicts.lock` through the same lock module `lib/capture.mjs` uses, and a busy or uncreatable lock makes the gate fail closed with a named finding, never wait without bound.
5. Deny once on a failing capture form (UC-12 step 4 line 882, §5 table line 1203; auditor F-D): the marker keeps the capture-form deny apart from every other cause, so a form failure after an earlier deny of the same agent id for another cause is still denied once with the reasons; a second form failure is captured with `validator: rejected`.
6. Open spawn's target (UC-01 step 3 line 270, §11.3 item 3 line 1644; auditor F-B): `hooks/guard-phase.mjs` denies `Edit`, `Write` and `NotebookEdit` (`file_path`, `notebook_path`) on a path that equals, after resolving against the run directory `R`, the `target:` path of a `cdp6-core:devils-advocate` spawn in `S/counters.json` `pending` that has no `closed_at`; the deny reason names the spawn's task; other paths and closed spawns pass as before.
7. Rollback test (first fix item 9; review claim 7, call 64): the rollback test asserts the code of the error that caused the rollback, as the worker's first version did, not only the generic `capture-failed`, and still shows that a rollback error does not replace it.
8. Role file (review F-7): `agents/devils-advocate.md` line 47 no longer names `psy-grenzwaechter`, which is not a CDP6 role (§2); keep the rest of the sentence. Do not touch `skills/worker-contract/`: the orchestrator removed `psy-grenzwaechter` from contract rule C9 and regenerated `core.md` before this run (header `CDP6-CONTRACT v1 sha256:c88130959164`, ledger 0021 row of 2026-11-04T01:58:29+01:00).

Counter-tests (append unchanged; red on the starting tree, as the orchestrator's run in `sl2-fix-review-counter-tests.txt` shows; green at the end):
- review-verify run 42: the two new files `checks/decision-check.rv42.test.mjs` and `checks/verdict-check.rv42.test.mjs` exactly as in `reports/sl2-fix-rv.md`.
- adversarial-auditor run 43: F-A (two tests, `checks/verdict-check.test.mjs`), F-B (`hooks/guard-phase.test.mjs`, with its extra import), F-D (`hooks/check-handback.test.mjs`), F-E (`lib/capture.test.mjs`, with its extra imports) and NV-1 (`checks/decision-check.test.mjs`), exactly as in `reports/sl2-fix-auditor.md`.
- Not unchanged: the auditor's F-C test asserts that a conflicted capture without items passes with no owner record, which item 1c (concept line 275) does not allow; write in its place a test that the same capture fails the gate without a record, with the finding naming `<capture id>:conflict`, passes after `run.mjs object <capture id>:conflict accept`, and does not count after `reject`.
- An import that duplicates one already in the file is merged into the existing import line; say so for each.

Out of scope (recorded follow-ups): the spawn-time target check (run 39 F2; SL-3 with `brief-lint.mjs`); a shell write to an open spawn's target (SL-4 `guard-shell.mjs`; the §11.3 item 3 hand check covers it); `lib/handback.mjs` (SL-2b); the refactor task before SL-3; run 39 NV1 to NV3; the `SAFE_TASK` copy in `check-handback.mjs`; registering `verdict-check.mjs`; any file outside `plugins/cdp6-core/`; `skills/worker-contract/`; any change to the CDP5 plugins or the concept.

Rules: `node:test`, temporary directories and HOME, no real home, key or Claude Code; no comments in code; no new dependency; structured errors without internals; keep every other test green unless an item changes what it asserts.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`
(`generate-contract.mjs --check` is run by the orchestrator.)

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted T1 to T3 diff and the first fix)
baseline: after the first fix and the C9 contract change, cdp6-core tests 445/445 exit 0 (orchestrator re-run 2026-11-04T01:58:29+01:00) and CDP5 suite 295/295 exit 0 (2026-11-04T01:28:21+01:00)
run grant: to be issued after the owner's decision (the grant of the first fix is used up)

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports and of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v057-v058.diff`. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree.

Stop rule: items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
