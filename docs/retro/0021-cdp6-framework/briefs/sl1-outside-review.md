# Brief: outside review of SL-1 (konzept-reviewer, stage-1 worker run 19 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02). Ledger 0021, owner decision of 2026-11-02 on the SL-1 start: the SL-1 outside reviewer (§11.3 item 2) is a fresh `konzept-reviewer` instance with conflict of interest none, which also gives the keyed-token design its independent security check.

Output format (final answer, handback only, no file): first line `conflict of interest: none | <stake>`; gate status for the SL-1 scope; per question below a verdict with concept line and code file:line evidence; prioritised gaps, each with one closing proposal (concept text change or code change, named precisely); then status. At most 1500 words.

Target state: concept v0.4.9 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted edits since v0.4.8 at 6e1d64d: UC-10 step 6 at line 782, the §5.2 row of `R/verdicts/index.jsonl`, the 0.4.9 changelog line); the SL-1 build in the worktree `<repo>/.worktrees/sl1/plugins/cdp6-core/` (uncommitted, three `impl-uc` runs; reports in `<repo>/docs/retro/0021-cdp6-framework/reports/`). You wrote no part of either.

Questions:
1. v0.4.9: are the two interface additions consistent with every line that reads or writes those records (AC-10.3, AC-10.5, AC-14.3, `decision-check.mjs` rules, §5.2), and is anything else needed in the concept for them?
2. Keyed token (UC-11 step 1.3 at line 823, CH-50, AC-11.18, AC-11.19, §5.6 item 9): is the design sound as written, and does `lib/hook-key.mjs` with its callers in `hooks/guard-shell.mjs` and `scripts/run.mjs` implement it (MAC fields, issue-time window, nonce record right after the MAC and age checks, no-print rule)?
3. Recovery gap: line 777 (UC-10 step 1) denies every matched tool call when the pointer `active-runs.json` is missing while a `run.json` is active, Bash included; line 92 limits main-session decisions to sessions with an active run; `run.mjs resume` and `repair` are not built in SL-1, and through the shell they would be denied in that state anyway. Is this a concept gap? Propose the smallest concept change that gives the owner a way out without opening a bypass for the model.
4. SL-1 completeness: does the build close the SL-1 row (line 1608) and its AC list, read against §11.3 items 2 to 4? Name any AC of the row without its test, and any built behaviour the row does not cover.
5. The open questions of the T3 report (deny form by exit 2 per line 755; step 7 deferred; `agent_id` binding without a store in SL-1; `ban` and `abandon` named by the skill but not built): does each reading follow the concept, or does the concept need a line?

Already known (do not report again): `run-store.mjs:258` passes an existing target file to `git -C`; `guard-phase.mjs:44` denies without a data directory even when no run exists; the skill text adds rules (SKILL.md:36, 51, 61, 62); test gaps in `run.test.mjs` and `hook-key.test.mjs`. They go into the fix run.

Tools: Read, Grep, Glob. No writes, no network.

Stop rule: one pass over the five questions; at most 60 tool calls; a gap without a concept line or file:line is not reported.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
