# Brief SL-2 T1: contract and spawn binding (stage-1 worker run 32 of cap 52)

Objective (owner, verbatim): "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind." Start of SL-2 approved by the owner on 2026-11-03 ("Ok"; ledger 0021).

Output format (final answer, handback only, no file): acknowledgement line; status; per AC one row: AC id, test file and title, the red run (command, exit, the assertion message showing it failed for the stated reason), the green run (command, exit); per row of the input-class block below the test that shows its outcome; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one AC or one input-class row. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a (the SL-1 commit: `plugins/cdp6-core/` with 274 tests). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `.
- Specification: the concept v0.5.4 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, commit 86a7afc, sha256 46d74b2ea3834c5050f2ab6e20c1b8bbed9acf345d8e710be2f82a7a6e7f4963; read only). The worktree copy is v0.4.8 and outdated; do not use it. Line numbers below refer to the main-checkout file. Plan: `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-plan.md`.
- Comparison source, not a specification: the CDP5 files `plugins/cdp5-agents/skills/worker-contract/SKILL.md`, `core.md`, `lib/contract.mjs`, `scripts/generate-contract.mjs`, `hooks/inject-contract.mjs`, `hooks/guard-spawn.mjs` in the worktree (committed state). The concept says "copy and extend as `CDP6-CONTRACT v1` (own header, own hash)" (line 75); rebuild what you take, do not import from `plugins/cdp5-agents/`.

Scope (T1 of SL-2; slice row `grep -n '^| SL-2 '`):
1. Contract `CDP6-CONTRACT v1`: `skills/worker-contract/SKILL.md` with a `contract-version` marker and core blocks, `skills/worker-contract/core.md` generated from it, `lib/contract.mjs`, `scripts/generate-contract.mjs` (with `--check`). The core rules are the agent-facing rules of §7.1 (lines 1341-1369): C1, C2a to C2e, C3, C4, C5, C6a to C6c, C7, C8a to C8e, C9, C10, C11, C12, C13 (C3t and C9t are team rules; include them only as one sentence that they apply to teammates). Header line `CDP6-CONTRACT v1 sha256:<first 12 hex of the core body's sha256>`; acknowledgement line `cdp6-contract: v1 <those 12 hex>`; the second answer line `run: <run-id> task: <task>` (C11). Without the header the agent answers only `CONTRACT-MISSING` (C1). A BOM or CRLF checkout must not change the hash.
2. `hooks/inject-contract.mjs` on `SubagentStart` with the catch-all matcher, filtered in the script (§3.4 item 2, line 203; §1.4 item 4, line 97): injects the contract only when `agent_type` starts with `cdp6-core:`; any other agent type gets no output. When the contract cannot be verified, a `cdp6-core:` agent gets the `CONTRACT-MISSING` instruction (exit 0, so the agent sees it) and a stderr line. In an active run (run lookup of `lib/run-store.mjs`, as `guard-phase.mjs` does) it binds the one unbound pending spawn of that `agent_type` to the input's `agent_id` (UC-12 step 3, line 881).
3. `lib/brief.mjs`: parser of the brief header of §5.3 (line 1209 on): the fields `run`, `phase`, `task`, `role`, `round`, `brief`, `env`, repeated `target: <path>@<sha256>`, `cited`, `writes`, `clears`. It returns the parsed header or a structured error naming the first bad line; it does not run `brief-lint` (SL-3).
4. `hooks/guard-spawn.mjs` on PreToolUse `Agent` (§1.2 hooks row, line 57), limited as the slice row says to the namespace deny and the pending-spawn record (UC-12 step 2, line 880): in an active run a `subagent_type` not starting with `cdp6-core:` is denied, with or without a brief header (AC-12.6, TM-6); an allowed `cdp6-core:` spawn records a pending spawn keyed by the `Agent` call's `tool_use_id` with task, role, `target:` hashes and time from the parsed header (`header: invalid` and no targets when the header does not parse). No run active: no decision, no record. The other denies of step 2, the PostToolUse and `Stop` registrations and the void rule are SL-3.
5. `lib/counters.mjs`: the one writing module of `S/counters.json` (CH-5, line 1713; §5 table, line 1189), started here with only the pending-spawn record (add, bind to an `agent_id`, read) under the lock of `lib/run-store.mjs` (`withLock`); SL-3 adds the counters. `run.mjs init` already writes `{ "version": 1 }` (`scripts/run.mjs:290`); keep that file shape readable.
6. `hooks/hooks.json`: add `inject-contract.mjs` (SubagentStart, catch-all) and `guard-spawn.mjs` (PreToolUse `Agent`, `"onFailure": "block"`); keep the SL-1 entries unchanged. Both new hooks append their `hooks observed` line through `lib/hooks-observed.mjs` (`recordFired`), the only writer of `hooks-fired.jsonl` (§0 item 27); T2 extends that writer, not T1.
7. ACs, each with the test file and title its row names (`grep -n '^| AC-12.6 \|^| AC-12.10 '`): AC-12.6; AC-12.10 for the binding half: the test "binds spawn to agent id" shows the bound pending spawn carrying the `target:` hashes and the `agent_id`; the capture that stores them is T2.

Input-class block (O6, §5.3; trigger: the hooks read hook input and write `counters.json`). Every cell is the outcome to build and test:

| Input | `guard-spawn.mjs` | `inject-contract.mjs` |
|---|---|---|
| hook input missing, unreadable or not JSON | deny (exit 2) with the reason | no output, stderr line, exit 0 |
| `tool_use_id` missing (guard) / `agent_id` missing (inject) | deny with the reason in an active run | contract injected, no binding, stderr line |
| `counters.json` missing, unreadable or malformed in an active run | deny with the reason | contract injected, no binding, stderr line |
| `counters.json` of the SL-1 shape (`{ "version": 1 }`, no pending key) | read as no pending spawns; the record is added | read as no pending spawns |
| brief header missing or malformed, a `target:` line not `<path>@<64 hex>` | allow; pending spawn with `header: invalid`, no targets | binds as usual |
| no unbound pending spawn of the `agent_type` | not applicable | contract injected, no binding |
| more than one unbound pending spawn of the `agent_type` (one item of many) | allow and record (the same-role deny is SL-3) | bind none, stderr line naming the count |
| lock on `counters.json` not acquired in time (concurrent writer) | deny with the reason | contract injected, no binding, stderr line |
| `subagent_type` / `agent_type` empty or without a namespace | deny in an active run | no output |
| no active run, or no data directory | no decision, no record | contract by namespace only, no binding |

Out of scope: `check-handback.mjs`, `lib/capture.mjs`, `verdict-check.mjs`, the role file and the `hooks-observed.mjs` extension (T2, T3); `brief-lint.mjs`, the other denies of UC-12 step 2, counters, void spawns (SL-3); `check-stop.mjs`, `lib/claims.mjs` (SL-2b); any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins or the concept.

Rules: test-first per AC and per input-class row (write the test, show it red for the stated reason, then implement). Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. The token secret is never printed, logged or written outside the key file. No comments in code. No new dependency. Errors to callers in a structured form without internals. Keep every SL-1 test green.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp6-core/scripts/generate-contract.mjs --check`
4. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
5. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a
baseline: cdp6-core tests exit 0 (34 s), CDP5 suite exit 0 (4 s); tree clean (worktree-setup 2026-11-03)
run grant: impl-uc may run in <repo>/.worktrees/sl2 until 2026-11-04T03:55:40Z, 3 uses (T1 to T3), session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept and plan. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments and some heredocs; use one command per call or a node script file inside the worktree.

Stop rule: scope items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
