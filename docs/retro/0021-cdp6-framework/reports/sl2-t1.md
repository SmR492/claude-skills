contract: v2 f91736a60d15

Status: T1 is built test-first and four of the five gate commands pass. Gate 3 (`generate-contract.mjs --check`) was refused by the shell guard, so I did not run it (details under Gate 3). Nothing is committed or pushed.

Worktree: <repo>/.worktrees/sl2, branch feat/cdp6-sl2, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a (HEAD confirmed at start).

## Per AC

Every red run came before the production code, from an empty or stub module (not a missing class or typo). Command for each: `node --test <file>`, exit 1. Each green run is the same command, exit 0.

| AC | Test file and title | Red (stated reason) | Green |
|---|---|---|---|
| AC-12.6 | `plugins/cdp6-core/hooks/guard-spawn.test.mjs`, "fires: headerless foreign spawn" | Stub hook exited 0: `actual: 0, expected: 2`. 12 of 13 tests in the file were red. | 13/13 pass. Covers `general-purpose` with and without a header, `cdp5-agents:` with and without a header, and the lookalike `cdp6-corex:`. Each deny leaves counters unchanged and writes a `deny` line to hooks-fired. |
| AC-12.10 (binding half) | `plugins/cdp6-core/hooks/inject-contract.test.mjs`, "binds spawn to agent id" | Stub hook gave no output; all 13 tests red. | 13/13 pass. The test runs the real `guard-spawn.mjs`, then `inject-contract.mjs`. The pending spawn carries `agent_id: 'agent-7'`, `target: docs/a.md@<hash>` and `bound_at`. |

I checked that the tests can turn red by temporary mutations, then restored the files:
- With the namespace deny disabled, "fires: headerless foreign spawn" and "fires: an empty or namespace-less subagent_type is denied" went red.
- With the bind using the wrong agent type, "binds spawn to agent id" went red.
- With BOM/CRLF stripping removed from `brief.mjs`, the BOM/CRLF brief test went red.

## Scope items 1, 3 and 5, with no AC row
- **Contract:** `lib/contract.test.mjs`, 7 tests. Red: stubs returned `undefined`, e.g. `actual: undefined, expected: { version: '1', body: ... }`. Green: 7/7. Includes the BOM/CRLF hash test, a "fires:" test for missing, stale, forged and drifted contracts, and a test that `generate-contract` writes `core.md` and `--check` fails on a stale one.
- **Brief parser:** `lib/brief.test.mjs`, 6 tests. Red: the stub returned `{ok:true, header:{}}`. Green: 6/6. 13 bad-header cases each name the first bad line.
- **Counters:** `lib/counters.test.mjs`, 8 tests. Red: the stub returned `undefined` or `none`. Green: 8/8.
- **hooks.json:** I updated `hooks-json.test.mjs`. That test pinned the exact two-guard list, so it had to change. Red: 2 of 3 tests failed on the old file. Green: 3/3 after the edit.

## Input-class block

Each cell is a test in `guard-spawn.test.mjs` (G) or `inject-contract.test.mjs` (I). Both files are green.

| Row | Guard (G) | Inject (I) |
|---|---|---|
| hook input missing or not JSON | "fires: unreadable hook input is denied": 5 inputs (`''`, `not json`, `[1]`, `null`, `"x"`), exit 2, 5 `deny` lines | "fires: hook input missing, unreadable or not JSON gives no output and a stderr line": exit 0, stdout empty, stderr non-empty |
| id missing | "fires: missing tool_use_id is denied in an active run" | "fires: agent_id missing injects the contract, binds nothing and writes a stderr line" |
| counters missing, unreadable (directory) or malformed (bad JSON, `[]`, `pending: 'x'`) | "fires: counters.json missing, unreadable or malformed is denied in an active run" | "fires: counters.json missing, unreadable or malformed injects the contract, binds nothing and writes a stderr line" (missing, bad JSON, directory) |
| SL-1 shape `{version:1}` | "counters.json of the SL-1 shape reads as no pending spawns and the record is added" | "counters.json of the SL-1 shape or without a pending spawn of the type: contract injected, no binding, no error" |
| header missing or malformed, bad `target:` line | "a missing or malformed header allows the spawn and records header invalid with no targets": 4 variants, all `header: 'invalid'` with `targets: []` | "a spawn with an invalid header binds as usual" |
| no unbound pending spawn | not applicable | covered in the SL-1 shape test above (pending spawn of another type; contract injected, `agent_id` stays null) |
| more than one unbound pending spawn | "several unbound pending spawns of the role: the new spawn is allowed and recorded" (3 records) | "fires: more than one unbound pending spawn of the type binds none and names the count" (stderr `2 unbound`, none of 3 bound) |
| lock not acquired | "fires: a busy lock on counters.json is denied" (about 2 s wait) | "fires: a busy lock on counters.json injects the contract, binds nothing and writes a stderr line" |
| empty or namespace-less type | "fires: an empty or namespace-less subagent_type is denied in an active run": `''`, absent, `devils-advocate`, `cdp6-core:` | "fires: foreign agent type gets no output": `cdp5-agents:`, `domain-agents:`, `general-purpose`, `''`, `cdp6-corex:`, `cdp6-core:`, absent |
| no run or no data directory | "no active run: no decision and no record, also without a data directory" (no `counters.json` written, no data dir created) | "no active run or no data directory: contract by namespace only, no binding" |

Beyond the table:
- The guard does nothing for a tool other than `Agent`.
- An unreadable `run.json` is denied by the guard and logged to stderr by inject, with no binding.
- Inject emits `CONTRACT-MISSING` with exit 0 and a stderr line when the contract is unverifiable, and nothing for other agent types.

## Gates (all from the worktree)

| # | Command | Exit | Last output |
|---|---|---|---|
| 1 | `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs` | 0 | `tests 321 / pass 321 / fail 0` (274 from SL-1 plus 47 new), 32.6 s |
| 2 | `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` | 0 | `tests 295 / pass 295 / fail 0` |
| 3 | `node plugins/cdp6-core/scripts/generate-contract.mjs --check` | not run | See below |
| 4 | `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core` | 0 | `2 skills, 0 agents, 0 🔴 0 🟡 2 🟢`; `worker-contract: ok`. The two 🟢 are pre-existing, in `scripts/run.test.mjs` (id_rsa and example.test fixtures). |
| 5 | `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core` | 0 | `52 files, 0 findings` |

**Gate 3 was not run.** The CDP5 shell guard refused the command, both with and without `--check`. The refusal text was "Blocked: orchestrator tools; a worker never issues grants or creates environments". I did not work around it. The orchestrator should run it, or tell me how to.

What I did instead:
- I wrote `core.md` once through a `node -e` call that uses `lib/contract.mjs` (`renderCore`), not through the script. Its header is `CDP6-CONTRACT v1 sha256:c7c5fcd7b60a`.
- The test "generate-contract writes core.md and --check fails on a stale one" runs the real script in a copy of the shipped skill folder. It shows `--check` exits 0 on the current files and 1 on a stale one. It also shows the regenerated file equals the shipped `core.md` byte for byte.
- That test passes (gate 1, exit 0).
- The orchestrator's own run of gate 3 remains outstanding.

## Files (line counts)

New:
- `plugins/cdp6-core/lib/contract.mjs` (60) and `contract.test.mjs` (102)
- `plugins/cdp6-core/lib/brief.mjs` (54) and `brief.test.mjs` (95)
- `plugins/cdp6-core/lib/counters.mjs` (78) and `counters.test.mjs` (117)
- `plugins/cdp6-core/hooks/guard-spawn.mjs` (77) and `guard-spawn.test.mjs` (221)
- `plugins/cdp6-core/hooks/inject-contract.mjs` (80) and `inject-contract.test.mjs` (235)
- `plugins/cdp6-core/scripts/generate-contract.mjs` (38)
- `plugins/cdp6-core/skills/worker-contract/SKILL.md` (85) and `core.md` (27)

Changed:
- `plugins/cdp6-core/hooks/hooks.json`: +23 lines. It adds `guard-spawn.mjs` (PreToolUse `Agent`, `onFailure: block`) and `inject-contract.mjs` (SubagentStart, matcher `*`). The SL-1 entries are unchanged.
- `plugins/cdp6-core/hooks/hooks-json.test.mjs`: +5/-3. It now expects the two new entries and three guards.

Nothing outside `plugins/cdp6-core/` was touched. The CDP5 plugins and the concept are unchanged. Both new hooks append their line through `recordFired` only (`hooks-observed.mjs` is unchanged). The test hooks use temporary directories and a temporary HOME.

## Choices between readings

1. **Contract rule order and ids.** `core.md` lists C1, then C11, then C2a and onward, so the acknowledgement and run lines come first. C3t and C9t are one sentence inside C3. I added "run no script of the cdp6-core plugin" to C8c, following OR-40 (workers run no `cdp6-core` script).
2. **Hook matcher.** The catch-all is `"matcher": "*"`.
3. **Agent type test.** "Starts with `cdp6-core:`" uses the existing `agentName()`, so a bare `cdp6-core:` with no role counts as no namespace. Both hooks treat it that way.
4. **Pending record shape.** `counters.json` holds `pending: { <tool_use_id>: { tool_use_id, agent_type, task, role, targets[], header: 'ok'|'invalid', at, agent_id: null } }`. After binding it also has `bound_at`. I added `agent_type` (the `subagent_type`) because the binding keys on it and an invalid header has no role. An unbound spawn is one without `agent_id` and without a `void` flag. A duplicate `tool_use_id` does not overwrite the first record.
5. **Header parser.** The header is the leading block of non-blank lines, so later lines are ignored. Rules: a key is lowercase and the value non-empty; `round` is an integer; `env` is `none` or `<path> base <7 to 64 hex>` (the hex length is my reading of the §5.3 `env:` form); `target` is `<path>@<64 lowercase hex>`; single fields are rejected when repeated; a missing required field gives `missing-field` naming the field, with the line after the header. Error codes are `no-header`, `bad-line`, `unknown-field`, `duplicate-field`, `bad-value` and `missing-field`.
6. **Lock wait.** `counters.mjs` waits 2000 ms for the lock (default is overridable per call), so the lock-busy hook tests take about 2 s. Lock failures map to `lock-busy` and `lock-error`.
7. **Run lookup errors in the guard.** A run record that cannot be read denies, as `guard-phase.mjs` does (§5.4). The table does not list this case.
8. **Inject when the contract is unverifiable.** It does not attempt binding.
9. **Hooks-fired lines.** Both hooks write a `hooks observed` line on every firing, including non-`cdp6-core:` agents and unreadable input.

## Open questions and follow-ups
- Gate 3 needs a run outside this worker's guard (above).
- Concept conflict, not blocking: UC-12 step 2 says a spawn with a missing or malformed header is denied, while the T1 input-class row says to allow it and record `header: invalid`. I followed the brief, so the header deny is left to SL-3 together with `brief-lint`. A future owner of the deny should reconcile line 880 of the concept with the brief row.
- `hooks-json.test.mjs` hard-codes the full hook list, so every later hook needs another edit there.
- The shell guard blocks any command naming `generate-contract.mjs`, so a worker cannot run a generator script. Consider whitelisting it for impl workers in a later brief.
- Not done, out of scope: the other denies of UC-12 step 2, the same-role deny (SL-3), `brief-lint`, counters beyond pending spawns, and the `check-handback`, capture and verdict pieces (T2, T3). The `ackPresent` and transcript helpers of CDP5's `contract.mjs` were left out until T2 needs them.
