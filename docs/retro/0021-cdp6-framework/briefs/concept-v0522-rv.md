# Brief: review-verify of concept v0.5.22, the stage-1 route after live P1 run 1 (stage-1 worker run 74)

Objective (owner, verbatim): "to ESC-1 auto mode is actually default now, and the most i use" and "yes pls go with auto and the preflight." (2026-11-05, ledger 0021); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "go always with your recommendation if they are reviewed" (2026-11-02). §0 item 27: concept edits go into `review-verify`.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0521-v0522.diff` (32 hunks), whether the owner decision (§0 item 34, ledger row 2026-11-05T21:28:33+01:00), the retro or a cited document supports it, and whether it contradicts an unchanged concept line; then findings ranked 🔴 🟡 🟢, each with one closing proposal; then status. At most 1200 words.

Target state: concept v0.5.22 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 ac2732db05cd6227685d3440db357e1c63d34a16706eac30546041b424e321dd); v0.5.21 at `<repo>/.worktrees/sl2-review-inputs/konzept-v0521.md`; the decision row in `<repo>/docs/retro/0021-cdp6-framework.ledger.md` (2026-11-05T21:28:33+01:00); the author brief `<repo>/docs/retro/0021-cdp6-framework/briefs/concept-v0522-author.md` (decisions 1 to 11); the retro `<repo>/docs/retro/0021-cdp6-framework/retro-stage1-live-run-1.md`; the run record `<repo>/docs/retro/0021-cdp6-framework/reports/live-p1-run-1.md`; Claude Code documentation fetched 2026-11-05 in `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/`; the build at `<repo>/.worktrees/sl2/plugins/cdp6-core` (1d04d1a). You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. Each of the author brief's decisions 1 to 11 is carried at the lines the author names, and every place of v0.5.21 that stated the opposite (live run in `default`, `SubagentHandback` as the only route without a mode condition, `~/**/.env*`, `Write(...)` as a required rule form, the hand-written host check as the only host check, `probe --accept` only in SL-8) is changed or marked as historical.
2. Every documentation claim the new text makes (the auto-mode availability of `SubagentHandback`, the hook `ask` prompting in auto mode, the read block, the `Edit(...)` rule form, `--settings` precedence, the classifier) matches the fetched documentation line it cites; name any claim that rests only on inference (the author names `defaultMode` from a `--settings` file and the bubblewrap argument cost per path).
3. SL-2c is specified so that an `impl-uc` brief can be written from it alone: content, ACs with test titles, the moved and kept parts of `probe --accept` and `probe-check.mjs`, the fail-loud mechanism (`observe-stop.mjs`, the guard denies), the preflight checks (a) to (g) with fixtures, the `missingRules` change; no AC is untestable or contradicts another.
4. No new owner decision is made in the text beyond §0 item 34; open points are in §15 (Q-18 to Q-23).
5. The line and run estimates for SL-2c follow the measured ratio of §11.2 and say which reading of Q-17 they use.

Tools: Read, Grep, Glob, Bash for read-only commands (diff, grep, sed -n, cat -n, wc, sha256sum, git -C <path> log). No test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call.

Stop rule: one pass; at most 45 tool calls; a verdict without evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
