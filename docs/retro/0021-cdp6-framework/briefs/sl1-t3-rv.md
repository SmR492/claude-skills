# Brief: review-verify of SL-1 T3 against its brief (stage-1 worker run 16 of cap 45)

Objective (owner, verbatim): "go with your recommendations" (2026-11-02, SL-1 continues with T3 carrying the T2 corrections; review-verify after each task, plan `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md`).

Output format (final answer, handback only, no file): one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence as file:line; then the corrections T3 needs, each with file and change; then status. At most 1200 words.

Target state: worktree `<repo>/.worktrees/sl1` (base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted T1, T2 and T3 diff in `.claude-plugin/marketplace.json` and `plugins/cdp6-core/`). Author of every claim: the `impl-uc` worker of stage-1 run 15; its report is `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-t3.md`. You wrote no part of it.

Sources: the T3 brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-t3.md`; the concept v0.4.9 in the main checkout `<repo>/docs/cdp6/konzept-cdp6.md` (AC rows via `grep -n '^| AC-xx.y |'`; UC-10 at line 770, UC-09 step 3 at 736, UC-01 at 239-304, UC-11 step 1 at 820, line 250, §1.4 item 2 at 92); the code and tests in the worktree.

Claims to verify:
1. Part A: each of the eight corrections is in the code as the T3 brief states, and its test fails without it (read the assertion against the code path; where the report names a mutation, check that the assertion would catch it).
2. Part B, per AC of the T3 list (AC-02.5, AC-09.2, AC-09.3, AC-10.2, AC-10.3, AC-10.4, AC-10.6, AC-10.10): the named test asserts what the AC row states; a test that passes for a different reason, or would pass with the behaviour absent, is widerlegt.
3. `hooks/hooks.json` matches the T3 brief and UC-10 Route and step 5: matchers, `${CLAUDE_PLUGIN_ROOT}` commands, `"onFailure": "block"` on every guard entry; the `hooks observed` line carries the fields of line 782 (v0.4.9) and a write failure never changes a decision.
4. The ten choices and five open questions of the report: each is consistent with the concept lines it touches; a contradiction is widerlegt with both lines. In particular: choice 1 (exit 2 with stderr for every `guard-phase.mjs` deny, line 755), choice 3 (a line for every shell call), choice 5 (every matched call denied on a missing pointer, lines 777 and 793), choice 6 (run found by project path for another session).
5. The skill `skills/idea/SKILL.md` states no rule that UC-01 does not state, and names no `run.mjs` flag the parser refuses without saying so.
6. No secret reaches stdout, stderr, a log, the journal or an assertion message in the new and changed tests (the report names `lib/hook-key.test.mjs` `deepEqual` on key bytes as a remaining case; confirm or refute, and look for others).
7. Scope: nothing outside `plugins/cdp6-core/` and `.claude-plugin/marketplace.json`; no comment in code; no new dependency; the refactor into `lib/phases.mjs` changes no behaviour of `run.mjs`.

Already checked by the orchestrator (do not repeat): the four gate commands exit 0 (193 of 193 cdp6 tests, 295 of 295 CDP5 tests); `guard-shell.mjs:12` lists only `default`, `acceptEdits`, `auto`; `hook-key.mjs:58` refuses an issue time later than now; `user-settings.mjs` checks the data-directory and plugin-root samples with `ruleAll`; both guard entries of `hooks.json` carry `"onFailure": "block"`. Already known: the concept has no recovery path when the pointer is missing and step 1 denies every matched call (worker open question 2); it goes to the outside reviewer, do not report it again unless the code differs from step 1.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc, git diff, git status, cat -n). Disposable environment: none; no test runs, no writes, no network. Known from earlier runs: the CDP5 shell guard refuses shell `for` loops and variable assignments; use one command per call.

Stop rule: one pass over all claims; at most 80 tool calls; a claim you cannot decide without running code is "nicht entscheidbar" with the reason.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
