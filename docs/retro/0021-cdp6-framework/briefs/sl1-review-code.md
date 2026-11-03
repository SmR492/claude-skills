# Brief: review-code of SL-1 (stage-1 worker run 17 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: the slice-end reviews of SL-1 run before one combined fix run; plan `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md`, reviews per §11.3 item 4: `review-code` for the new seams).

Output format (final answer, handback only, no file): Schema C.1 deepening candidates and anti-pattern findings, each with file:line evidence, severity (🔴 🟡 🟢) and one concrete change; then status. At most 1200 words.

Target state: worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff: `.claude-plugin/marketplace.json` and `plugins/cdp6-core/` (T1, T2, T3 by three `impl-uc` runs; reports in `<repo>/docs/retro/0021-cdp6-framework/reports/`). You wrote no part of it.

Sources: the concept v0.4.9 `<repo>/docs/cdp6/konzept-cdp6.md`: §1.2 file table (lines 45-66), §1.4 item 2 (92), the SL-1 row (1608), §12.1 existence rows (from line 1749; `guard-phase.mjs` at 1758), CH-43, CH-46, CH-49, CH-50 (`grep -n '^| CH-4[369] \|^| CH-50 '`). CDP5 code (`plugins/cdp5-agents/`) is a comparison source, not a specification.

Seams to review: `lib/run-argv.mjs` as the one parser shared by `guard-shell.mjs`, `guard-phase.mjs` and `run.mjs`; `lib/run-store.mjs` (lock, journal, single writer, run lookup); `lib/hook-key.mjs` and its callers; `lib/hooks-observed.mjs`; `lib/phases.mjs` (moved out of `run.mjs` in T3); `lib/user-settings.mjs`; the size and cohesion of `scripts/run.mjs` (642 lines) against the later slices that extend it (SL-2 to SL-8 in the slice table). Ask per seam: is it a deep module with a small interface; does a later slice have to reopen it; is logic duplicated between the hooks and `run.mjs`; is an error path silently swallowed.

Already known (do not report again): `run-store.mjs:258` passes an existing target file to `git -C`; `guard-phase.mjs:44` denies without a data directory even when no run exists; the skill text adds rules (SKILL.md:36, 51, 61, 62); test gaps in `run.test.mjs` (narrow-rule fixture, 600 ms sleep) and `hook-key.test.mjs:25, :40, :42`; `guard-shell.test.mjs:168` binds no run; the concept has no recovery path for a missing pointer. These go into the fix run.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc, git status, cat -n). Disposable environment: none; no test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops and variable assignments; use one command per call.

Stop rule: one pass over the seams; at most 60 tool calls; a finding you cannot back with a file:line is not reported.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
