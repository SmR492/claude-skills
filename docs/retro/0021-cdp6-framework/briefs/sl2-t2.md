# Brief SL-2 T2: handback and capture (stage-1 worker run 34 of cap 52)

Objective (owner, verbatim): "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind." Start of SL-2 approved by the owner on 2026-11-03 ("Ok"; ledger 0021).

Output format (final answer, handback only, no file): acknowledgement line; status; per AC one row: AC id, test file and title, the red run (command, exit, and the failing assertion message quoted verbatim from the output), the green run (command, exit); per row of the input-class block below the test that shows its outcome; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one AC or one input-class row. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted T1 diff (report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t1.md`; T1 review: `<repo>/docs/retro/0021-cdp6-framework.ledger.md`, row "SL-2 T1 review-verify"). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `.
- Specification: the concept v0.5.5 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 ee92d38cae5c651068610b64b55eddb4885708476095c11125217abe357bdca8; read only; the worktree copy is v0.4.8, do not use it). Line numbers below refer to that file.
- Comparison source, not a specification: `plugins/cdp5-agents/hooks/check-handback.mjs`, `check-ack.mjs`, `lib/handback.mjs` in the worktree. CDP5 lets a handback through when the contract cannot be verified (`check-handback.mjs:54-61`); CDP6 does not (line 76, AC-12.11).

Part A, T1 corrections (first, each test-first; found by `review-verify` run 33 and confirmed by the orchestrator against the code):
1. Contract C2a (`skills/worker-contract/SKILL.md:18`): the concept row C2a (line 1346) reads "every claim carries evidence (file:line, command with output, document id); no hedged completion claims". Add the hedge clause; remove the sentence about a "Not verified:" marker, which no concept line states. Then bring `core.md` up to date the way T1 did (through `renderCore` of `lib/contract.mjs`, since the CDP5 shell guard refuses commands naming `generate-contract.mjs`); the orchestrator runs `--check` afterwards. A test pins that the core holds the hedge clause.
2. `hooks/guard-spawn.mjs` handles the spawn tool under both names, `Agent` and `Task` (concept §1.2 row line 57, v0.5.5; UC-10 Route line 776): the `hooks.json` matcher becomes `Agent|Task` and the tool check accepts both. A `fires:` test shows a foreign `subagent_type` through `Task` denied in an active run.
3. `scripts/generate-contract.mjs --check` compares the normalised texts (`normalizeText` of `lib/contract.mjs`), not raw bytes, so a CRLF or BOM `core.md` with the current body reads current. Test with a CRLF copy.

Scope (T2 of SL-2; plan row T2):
1. `hooks/check-handback.mjs` on PreToolUse `SubagentHandback` (as the CDP5 registration in `plugins/cdp5-agents/hooks/hooks.json`; UC-12 step 4, line 882), only for `cdp6-core:` agent types (`agentName`). It reads `tool_input.message` and `agent_id` and checks, in this order: the contract verifies (else deny, AC-12.11); the first line is `cdp6-contract: v1 <hash>` with the current hash (AC-12.25); the second line is `run: <run-id> task: <task>` (C11) naming the active run and the task of the spawn bound to this `agent_id` (AC-12.9, AC-12.17); a bound spawn exists for the `agent_id` and its header parsed (`header: 'ok'` in the T1 pending record). The first failure denies once with the reason (UC-12 step 4). Hedges, `wrote:` claims and PII are SL-2b (`grep -n '^| SL-2b '`), not here.
2. `lib/capture.mjs`, the one writing module of `S/verdicts/` (§5 table, line 1190; CH-5, line 1713): on an accepted handback it writes `S/verdicts/<task>-<role>-<agent-id>.md` with the message and appends one `index.jsonl` line with the fields of line 1190: sha256 of the message, `agent_type`, `agent_id`, `task`, the bound spawn's `target:` paths and sha256 (AC-12.10, capture half), `decision`, `verdict`, `objections`, `conflicted`, `stamp`, and the validator result. Under one lock per file (`withLock` of `lib/run-store.mjs`). The index line's `decision` is the bound spawn's `task` when it has the form `D-<n>`, else `null` (§5.3 `task:` line 1216, v0.5.5; UC-01 step 3, line 270: `devils-advocate` runs on `D-1`). `verdict` is `null`, `objections` `[]`, `conflicted` `false` and the validator result `not-built` until T3 wires `verdict-check.mjs` in; `decision-check.mjs` reads a `null` verdict as no pass (`checks/decision-check.mjs`), which fails closed. The capture also marks the pending spawn closed in `counters.json` through `lib/counters.mjs` (T1), not by writing that file itself.
3. `lib/hooks-observed.mjs` stays the only writer of `hooks-fired.jsonl` (§0 item 27, the SL-2 row) and gains the fields `agent_id` and `capture_sha256` (null when absent), which the live-run check of §11.3 item 3 reads; `check-handback.mjs` writes its line with them. Existing callers and the `run.mjs enter` reader stay green.
4. `scripts/run.mjs exit idea` refuses without a `captured verdict` of `devils-advocate` for `D-1` (AC-01.4, line 297; UC-01 step 5, line 273). The SL-1 gate may already refuse through `decision-check.mjs`; then the test is shown red by mutation, as the output format says.
5. `hooks/hooks.json`: add `check-handback.mjs` on PreToolUse `SubagentHandback` with `"onFailure": "block"`; update `hooks/hooks-json.test.mjs`.
6. ACs, each with the test file and title its row names (`grep -n '^| AC-01.4 \|^| AC-12.9 \|^| AC-12.10 \|^| AC-12.11 \|^| AC-12.17 \|^| AC-12.25 '`): AC-01.4, AC-12.9, AC-12.11, AC-12.17, AC-12.25, and the capture half of AC-12.10 (extend "binds spawn to agent id" or add a test in `hooks/check-handback.test.mjs` that the capture carries the bound `target:` hashes).

Input-class block (O6, §5.3; trigger: the hook reads hook input and writes records). Every cell is the outcome to build and test:

| Input | `check-handback.mjs` and `lib/capture.mjs` |
|---|---|
| hook input missing, unreadable or not JSON | deny with the reason (exit 2) |
| `tool_name` other than `SubagentHandback`, or an agent type outside `cdp6-core:` | no decision, no line |
| `agent_id` missing | deny with the reason, every time (no second-attempt marker can be kept without it) |
| contract not verifiable (`core.md` missing, corrupt or drifted) | deny with the reason every time (AC-12.11); the STOP-8 halt record is SL-8 |
| first line, second line, run id, task mismatch, no bound spawn, or `header: invalid` | first failure: deny once with the reason; a later handback of the same `agent_id` that still fails: no deny, no capture, a `hooks observed` line with decision `none` and `capture_sha256` null, so the phase exit finds no capture (fails closed) |
| the second-attempt marker unreadable or malformed | treat as a first attempt |
| no active run, or no data directory | acknowledgement check only; no capture, no `counters.json` access |
| `S/verdicts/` missing | created by `lib/capture.mjs` |
| `index.jsonl` malformed (a line not JSON) | capture refused, handback denied with the reason; the file is not rewritten |
| `task` with characters outside `[A-Za-z0-9._-]` (file name) | treated like `header: invalid` |
| a capture file of the same name exists (same task, role, agent id) | capture refused, handback denied with the reason; no overwrite |
| lock on `index.jsonl` or `counters.json` not acquired in time (concurrent writer) | deny with the reason; nothing partial written (the `.md` file is written only after the lock is held) |

Out of scope: `verdict-check.mjs`, its wiring into the capture and the role file (T3); hedges, `wrote:` claims, PII, `check-stop.mjs` (SL-2b); the same-role deny, `brief-lint`, void spawns (SL-3); the STOP-8 halt record (SL-8); any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins or the concept.

Rules: test-first per AC and per input-class row (write the test, show it red for the stated reason, then implement). Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. The token secret is never printed, logged or written outside the key file. No comments in code. No new dependency. Errors to callers in a structured form without internals. Keep every SL-1 and T1 test green.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`
(`generate-contract.mjs --check` is run by the orchestrator; the CDP5 shell guard refuses it for workers.)

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted T1 diff)
baseline: after T1, cdp6-core tests 321/321 and CDP5 suite exit 0 (orchestrator re-run 2026-11-03)
run grant: impl-uc may run in <repo>/.worktrees/sl2 until 2026-11-04T03:55:40Z, 2 uses left (T2, T3), session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, plan, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree.

Stop rule: part A first, then the scope items in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
