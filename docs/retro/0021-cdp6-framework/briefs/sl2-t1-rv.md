# Brief: review-verify of SL-2 T1, run 29 and concept v0.5.1 to v0.5.4 (stage-1 worker run 33 of cap 52)

Objective (owner, verbatim): "go with your recommendations" (2026-11-03, ledger 0021, concept §0 item 27 (1)): the run-29 fixes and the concept edits v0.5.2 to v0.5.4, which had no fresh reader, go into the brief of SL-2's first `review-verify`; every worker result gets its `review-verify` before the orchestrator acts on it (§11.3 item 4).

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; then three parts. Part A, T1: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence for each claim listed under Claims A. Part B, run 29: one verdict per claim under Claims B. Part C, concept diff: per hunk of the diff, whether it says what its source (§0 items 26 and 27, ledger 0021 rows of 2026-11-03, `devils-advocate` run 31, the code it cites) supports, and whether it contradicts an unchanged concept line; name the line. Then the findings that should change the code or the concept before T2, ranked, each with one closing proposal; then status. At most 1800 words.

Target state:
- T1: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted T1 diff under `plugins/cdp6-core/` (`git -C <repo>/.worktrees/sl2 status --short`). Brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-t1.md`; report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t1.md`. You wrote no part of it.
- Run 29: committed in 960146b (`plugins/cdp6-core/` of the worktree above at its base); brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-state-fix.md`, report `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-state-fix.md`.
- Concept: `<repo>/docs/cdp6/konzept-cdp6.md` v0.5.4 (commit 86a7afc); the edits since v0.5.1 are the unified diff `<scratchpad>/concept-v051-v054.diff` (old file `<scratchpad>/konzept-v051.md`). Author of the edits: the orchestrator.
- `<repo>` = the repository root (main checkout); `<scratchpad>` = the orchestrator session's scratchpad directory.

Claims A (T1):
1. Each red run in the report failed for the stated reason before the production code existed, and the tests named for AC-12.6 and AC-12.10 assert what those AC rows say (`grep -n '^| AC-12.6 \|^| AC-12.10 '` in the concept).
2. Every row of the brief's input-class block has a test that asserts the outcome the brief's cell states; name any row whose test asserts something else.
3. `guard-spawn.mjs` denies a non-`cdp6-core:` `subagent_type` only in an active run and gives no decision and writes no record without one; `inject-contract.mjs` injects only into `cdp6-core:` agents.
4. `lib/counters.mjs` is the only module that writes `counters.json` in the T1 diff, under `withLock` of `lib/run-store.mjs`, and `run.mjs init`'s `{ "version": 1 }` file stays readable.
5. Both new hooks write their `hooks observed` line only through `recordFired` of `lib/hooks-observed.mjs`.
6. The contract core holds the agent-facing rules of concept §7.1 (lines 1341-1369) without a rule the concept does not state; the worker's addition to C8c ("run no script of the cdp6-core plugin", citing OR-40) is backed by OR-40 (`grep -n '^| OR-40 '`).
7. The header and hash form (`CDP6-CONTRACT v1 sha256:<12 hex>`, acknowledgement `cdp6-contract: v1 <hash>`) is stable under BOM and CRLF, and `generate-contract.mjs --check` fails on a stale `core.md` (the orchestrator ran it on the final state: exit 0, "core.md is current").
8. The worker's choices 1 to 9 in the report stay inside the brief and the concept lines it cites; name each that does not.

Claims B (run 29, report sl1-state-fix.md): items 1 to 5 of its table: each test exists at the named place in 960146b, asserts what the item says, and the production change it covers is present. The report's own note on item 3 (the nested sample) is decided by the owner (dropped, §0 item 27 (3)); do not re-judge it.

Tools: Read, Grep, Glob, Bash for read-only commands (`git -C <worktree> diff`, `git -C <worktree> status`, `git -C <worktree> show 960146b:<path>`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. Known limits of the CDP5 shell guard: it refuses shell `for` loops, variable assignments and some heredocs; use one command per call.

Stop rule: one pass over parts A, B and C; at most 70 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
