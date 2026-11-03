# Brief: review-verify of SL-1 T1 against its brief (stage-1 worker run 12 of cap 45)

Objective (owner, verbatim): "go with your recommendations" (2026-11-02, SL-1 start with review-verify after each task, plan `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md`).

Output format (final answer, handback only, no file): one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence as file:line; then the list of corrections T1 needs, each with the file and the change; then status. At most 1000 words.

Target state: worktree `<repo>/.worktrees/sl1` (base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted diff: `.claude-plugin/marketplace.json` and `plugins/cdp6-core/`). Author of every claim: the `impl-uc` worker of stage-1 run 11; its report is `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-t1.md`. You wrote no part of it.

Sources: the T1 brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-t1.md` (scope, ACs, rules); the concept `docs/cdp6/konzept-cdp6.md` in the worktree (AC rows: `grep -n '^| AC-xx.y |'`; sections named in the T1 brief); the code and tests in the worktree.

Claims to verify:
1. Per AC of the T1 list (20 ACs): the named test asserts what the AC row states, not only a matching title; a test that passes for a different reason than the row names, or that would pass with the behaviour absent, is widerlegt.
2. The 12 "choices between readings" of the report: each is consistent with the concept lines it touches; a choice that contradicts a concept line, or fixes something a later slice's AC already fixes differently, is widerlegt with both lines.
3. Scope: nothing outside `plugins/cdp6-core/` and `.claude-plugin/marketplace.json` changed; no out-of-scope file of the T1 brief was built; no comment in code; no new dependency.
4. The defect report on `readRun` (settle up to 300 ms): state what the code does on a reader that never settles and whether a caller can act on a stale read; report, do not fix.

Already checked by the orchestrator (do not repeat): the four gate commands exit 0 (83 of 83 cdp6 tests), every AC test title exists, a version-floor mutation turns its test red.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc, git diff, git status). Disposable environment: none; no test runs, no writes, no network.

Stop rule: one pass over all claims; at most 70 tool calls; a claim you cannot decide without running code is "nicht entscheidbar" with the reason.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
