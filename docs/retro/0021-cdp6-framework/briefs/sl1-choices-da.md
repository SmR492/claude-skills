# Brief: devils-advocate on the `choices:` of the SL-1 closing (stage-1 worker run 31 of cap 52)

Objective (owner, verbatim): "a" (2026-11-03; concept §0 item 26, condition: "the missing §32.25 `devils-advocate` pass on SL-1's choices runs first, as a counted run").

Output format (final answer, handback only, no file): per choice below a three-valued verdict (as your role file maps it) with the reconstructed rejected alternative and the null option, the falsifiable objections against the reasoning chain (each with what would refute it), and the §27.1.1 existence question where a choice added an element; then the objections that should change a choice before SL-2 starts, ranked; then status. At most 1500 words.

Object: the SL-1 closing of ledger 0021 (`<repo>/docs/retro/0021-cdp6-framework.ledger.md`, rows from 2026-11-02 "owner on the SL-1 start" to 2026-11-03 "owner on the SL-1 checkpoint"). The code is committed as `960146b` on branch `feat/cdp6-sl1` (worktree `<repo>/.worktrees/sl1`, `plugins/cdp6-core/`); the concept is `<repo>/docs/cdp6/konzept-cdp6.md` v0.5.3. Owner decisions (§0 items 22 to 26, among them the state directory and the cap) are not under review; choices made by the orchestrator or adopted from a worker are.

`choices:` (decider in brackets; source):
1. `session_id` on the `hooks observed` line and the decision fields of a capture index line (orchestrator; v0.4.9, ledger row of 2026-11-02 "orchestrator on the two interface choices"; v0.5.1 key names `verdict`, `objections`, `decision`).
2. Owner commands prompt in `default`, and in another mode only with an accepted probe record whose A-5 row has `modes.<mode>.prompt === true` (worker shape, adopted; `lib/probe-record.mjs`, §5.2 probe row).
3. `guard-phase.mjs` denies by exit 2 with stderr; `guard-shell.mjs` by JSON `permissionDecision` (worker reading of AC-09.2, adopted).
4. One file reader `lib/input-file.mjs`: descriptor path from `/proc/self/fd` on Linux with a device and inode check, ` (deleted)` refused, hard links refused, host-key content refused, read bounded by the checked size, 1 MiB for intake and assignment; name lookup as a residual elsewhere (orchestrator, v0.4.10 to v0.4.12).
5. The snapshot at phase exit in `S/snapshots/<phase>/cycle-<c>/`, checkers judge only the snapshot and `S` (orchestrator, v0.5.1 from review G5).
6. Project root: the linked-worktree mapping only with the git back-link, otherwise the top level of `cwd` only when it contains `cwd` (orchestrator, v0.4.12 and v0.5.0).
7. A hook without `CLAUDE_PLUGIN_DATA` gives no decision (worker question, ruled by the orchestrator, v0.5.2 UC-10 error row).
8. The recovery path from a lost pointer: stage-1 hand step outside Claude Code, SL-8 exception for `repair` and `resume` (orchestrator from the outside review, v0.4.10, AC-10.14).
9. Deferrals: the refactor of `run.mjs` and three structure items to a task before SL-3; outside-review gap 8 to SL-5; the company `R` against the transcript deny before the first company-class run; the `x/y/z.txt` sample pin as a follow-up (orchestrator).
10. Process: counter-tests of judgment agents executed by the orchestrator in a disposable worktree, because the CDP5 grant check reads the hook input `cwd`; verification of run 29 by the orchestrator's own mutations instead of a review run (orchestrator).

Sources: the ledger rows above; the briefs and reports under `<repo>/docs/retro/0021-cdp6-framework/`; the concept sections each choice names; the code in `<repo>/.worktrees/sl1/plugins/cdp6-core/`.

Tools: Read, Grep, Glob. No writes, no network.

Stop rule: one pass over the ten choices; at most 60 tool calls; an objection without a source line is not reported.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
