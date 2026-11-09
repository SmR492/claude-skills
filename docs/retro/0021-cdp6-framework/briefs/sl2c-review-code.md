# Brief: review-code of the new seams of SL-2c (stage-1 worker run 85)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04). The SL-2c row of the concept names `review-code` for the new hook registration and the new script (CH-34).

Object: the new seams in `<repo>/.worktrees/sl2c-final/` (frozen copy of the SL-2c tree; the tree before the slice is `<repo>/.worktrees/sl2c-pre-build/`): the `SubagentStop` registration in `hooks/hooks.json` with `hooks/observe-stop.mjs`, `lib/stop-guard.mjs`, `lib/shell-allowlist.mjs`, the counters functions `markFinished`, `uncapturedFinished`, `addPending(..., {exclusiveRole})`, `lib/probe-record.mjs` with `checks/probe-check.mjs` and `run.mjs probe --accept`, and `scripts/preflight.mjs` with `lib/preflight-*.mjs`; concept v0.5.26 `<repo>/docs/cdp6/konzept-cdp6.md` (§1.2, §3.4, UC-12, UC-14 step 5, the SL-2c row) and the decision history in `<repo>/docs/retro/0021-cdp6-framework.ledger.md` (rows from 2026-11-05T21:28 on). `<repo>` = the repository root.

Questions: does each new module have one reason to change and a seam that matches the concept's file list (§1.2) and single-writer rules (`counters.json` only through `lib/counters.mjs`, records only through `probe-check.mjs` called by `run.mjs probe --accept`, `hooks-fired.jsonl` only through `lib/hooks-observed.mjs`); duplicated logic between the preflight's settings reader and `lib/user-settings.mjs` or between the stop guard and the guards; shallow modules that only forward; error handling that fails open where the concept says fail closed; anything the next slices (SL-2b `check-stop.mjs`, SL-3, SL-4 `guard-files.mjs`, SL-8 probe acceptance of the other rows, SL-9 doctor) will have to undo.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; deepening candidates in Schema C.1 (module, problem with file:line, proposal, cost, benefit) and anti-pattern findings ranked 🔴 🟡 🟢 with evidence; then status. At most 1000 words.

Tools: Read, Grep, Glob, Bash for read-only commands. No test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs.

Stop rule: one pass; at most 40 tool calls.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
