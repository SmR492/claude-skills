# Brief: threat model of the stage-1 live P1 run in auto mode and of slice SL-2c (concept v0.5.22; stage-1 worker run 75)

Objective (owner, verbatim): "to ESC-1 auto mode is actually default now, and the most i use" and "yes pls go with auto and the preflight." (2026-11-05, ledger 0021); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Object: the change of the stage-1 live run from `default` to `auto` permission mode and the new stage-1 slice SL-2c (minimal `run.mjs probe --accept` with `probe-check.mjs`, the fail-loud guard with `observe-stop.mjs`, the read-only `scripts/preflight.mjs`, the `Edit(...)` rule form, `permissions.blockReadsOutsideWorkingDirectories`) as concept v0.5.22 states them (`<repo>/docs/cdp6/konzept-cdp6.md`, diff `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0521-v0522.diff`; §0 item 34, §3.4 item 14, §5.6, UC-12, UC-14 step 5, the SL-2c row, §11.3 item 3, §13.1, §15 Q-18 to Q-23). The built stage-1 code is `<repo>/.worktrees/sl2/plugins/cdp6-core` (1d04d1a); Claude Code documentation fetched 2026-11-05 is in `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/` (`permission-modes.md`, `hooks.md`, `sandboxing.md`, `settings-reference.md`, `tools-reference.md`, `permissions.md`). `<repo>` = the repository root (main checkout).

Questions:
1. Data flow and trust boundaries of a live P1 run in auto mode: main session, auto-mode classifier, hooks, `run.mjs` (unsandboxed excluded command), subagents with `SubagentHandback`, the sandbox with the read block, the data directory, the host key, the settings files. What does auto mode let run without a prompt that `default` prompted for, and which CDP6 control still stands in its way (hook `ask`, deny rules, sandbox, guards)?
2. STRIDE over the new entry points: `run.mjs probe --accept` (who can create the record it accepts; can a model-written record reach the gate; the proposal of a host-key MAC, Q-20), the `observe-stop.mjs` marker and the fail-loud deny (can a model clear or forge `finished_at`; can the deny be bypassed through a tool the guard does not match), `preflight.mjs` (can a repository influence what it reports), the read block (what stays readable that holds secrets).
3. The §33.2 runtime-hardening checklist of the doctrine copy `<repo>/plugins/cdp5-gates/skills/cdp5-reference/konzept-design-pattern-v6.md` and the §33.6 threat classes for LLM parts, applied to auto mode: classifier as a control (prompt injection through repository text, tool results or a subagent's handback), `bypassPermissions` refusal (Q-21 `disableBypassPermissionsMode`).
4. Whether any threat makes auto mode for the live run unacceptable without an added control, and which.

Output format (final answer, handback only, no file): after the acknowledgement line, the data-flow sketch in text; a prioritised threat list (🔴 🟡 🟢) with the concept line it concerns, the attack in one sentence and one acceptance criterion per top threat, each written so that it fits the AC table of the concept (AC id proposal, test kind, test title, red/green); the §33.2 checklist result; then status. At most 1200 words.

Tools: Read, Grep, Glob. No writes, no network.

Stop rule: one pass; at most 40 tool calls; a claim without file:line evidence is marked as inferred.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
