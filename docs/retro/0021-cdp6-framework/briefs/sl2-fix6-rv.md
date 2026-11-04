# Brief: review-verify of the SL-2 fix of the run-58 findings and concept v0.5.13 to v0.5.14 (stage-1 worker run 60; cap set aside by §0 item 31)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and "Raise Cap to 60 or ignore Cap for this Project and review cap afterwards", "Missing means 1 (Recommended)" (2026-11-04, concept §0 item 31; ledger 0021). §11.3 item 4: every worker result gets its `review-verify`; §0 item 27: concept edits go into it.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim below (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0513-v0514.diff`, whether `reports/sl2-fix5-rv.md` or §0 item 31 supports it and whether it contradicts an unchanged concept line; then the findings that should change code or concept, ranked 🔴 🟡 🟢, each with one closing proposal and, for a code claim, a counter-test as complete `node:test` code (file name and title, any extra import named; temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`) marked "not executed" with the result you expect; then status. At most 1200 words plus test code.

Target state: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted SL-2 diff under `plugins/cdp6-core/`. The tree before the fix is `<repo>/.worktrees/sl2-pre-fix6/` (copied 2026-11-04T16:03:10+01:00, `diff -r` exit 0 at that time), so `diff -r <repo>/.worktrees/sl2-pre-fix6 <repo>/.worktrees/sl2/plugins/cdp6-core` is exactly the fix. Fix brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-fix6.md`, its report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-fix6.md`. Concept v0.5.14 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 534b5f8aaad7a4d77ee0dd2f6f659abd471a3a1d9c31fc06b05d060b9ce24d21). You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. Items 1 to 3 of the fix brief are built as stated, each with a test that asserts its item and concept line.
2. The counter-tests R1a, R1b and R3 of run 58 are in the tree verbatim.
3. Each mutation the report names would turn the named test red (say where only a run decides).
4. No test was weakened, removed or skipped: name every hunk of the `diff -r` above that removes, replaces or loosens an assertion and whether the item it cites requires it (item 2 changes the null case of the test at `checks/decision-check.test.mjs:711` of the pre-fix tree).
5. After the fix no objection id of a devils-advocate capture of a `D-n`, valid or rejected, conflicted or not, live or stale, reaches a passing gate without a well-formed objection line or an owner record, except ids in `> ` quote lines and lines in the disposition form; no capture the role file asks for is rejected; and a run whose `run.json` carries no `ids.next.D` is judged as `run.mjs` judges it.

Tools: Read, Grep, Glob, Bash for read-only commands (`diff -r`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The orchestrator executes every counter-test you deliver in a disposable copy. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 50 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
