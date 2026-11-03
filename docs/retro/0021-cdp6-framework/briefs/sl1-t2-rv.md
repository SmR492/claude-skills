# Brief: review-verify of SL-1 T2 against its brief (stage-1 worker run 14 of cap 45)

Objective (owner, verbatim): "go with your recommendations" (2026-11-02, SL-1 start with review-verify after each task, plan `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md`).

Output format (final answer, handback only, no file): one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence as file:line; then the corrections T2 needs, each with file and change; then status. At most 1000 words.

Target state: worktree `<repo>/.worktrees/sl1` (base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted T1 and T2 diff in `.claude-plugin/marketplace.json` and `plugins/cdp6-core/`). Author of every claim: the `impl-uc` worker of stage-1 run 13; its report is `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-t2.md`. You wrote no part of it.

Sources: the T2 brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-t2.md`; the T1 review corrections it carries (part A); the concept `docs/cdp6/konzept-cdp6.md` in the worktree (AC rows via `grep -n '^| AC-xx.y |'`, UC-09 step 1.4, UC-11 steps 1 to 1.3, §5.6 items 5, 6, 9, 10, CH-49, CH-50, §0 item 11); the code and tests in the worktree.

Claims to verify:
1. Part A: each of the six corrections is in the code as the brief states and its test fails without it.
2. Part B, per AC of the T2 list (15 ACs): the named test asserts what the AC row states; a test that passes for a different reason, or would pass with the behaviour absent, is widerlegt.
3. The keyed token (UC-11 step 1.3, CH-50): the MAC covers nonce, issue time, session id, data directory, the parsed tokens and the hash values; the nonce is recorded right after the MAC and age checks and before any later check; a refused call spends no nonce before the MAC passes; the secret never reaches stdout, stderr, a log, the journal or a test assertion message.
4. The 12 choices and 8 open questions of the report: each is consistent with the concept lines it touches; a contradiction is widerlegt with both lines.
5. Scope: nothing outside `plugins/cdp6-core/`; no `hooks.json`; `lib/user-settings.mjs` is inside the plugin and serves an in-scope item; no comment in code; no new dependency.

Already known to the orchestrator (do not report again): AC-11.5's test expects `ask` under `bypassPermissions`, which contradicts AC-11.5 and §0 item 11 (refused for the whole run; the orchestrator's T2 brief caused it); a token with an issue time in the future is accepted. Both go into the T3 corrections. Already checked by the orchestrator: the four gate commands exit 0 (159 of 159 cdp6 tests), all 53 AC test titles exist, removing the MAC comparison turns three token tests red.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc, git diff, git status). Disposable environment: none; no test runs, no writes, no network.

Stop rule: one pass over all claims; at most 80 tool calls; a claim you cannot decide without running code is "nicht entscheidbar" with the reason.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
