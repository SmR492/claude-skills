contract: v2 f91736a60d15

Status: Part A and all six T2 scope items are built test-first in <repo>/.worktrees/sl2 (base 960146b plus the T1 diff, uncommitted). The four gate commands exit 0. `generate-contract.mjs --check` was not run (shell guard); the orchestrator runs it.

Gates (final state, after the last edit):
1. cdp6-core suite: `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs` exit 0, tests 373, pass 373, fail 0 (baseline 321).
2. CDP5 suite (the brief's command): exit 0, tests 295, pass 295, fail 0.
3. skill-lint `--path=plugins/cdp6-core`: exit 0; last lines are the 🟢 X4 informational finding on run.test.mjs line 206 (an example.test URL) and "exit 0 is not a clearance".
4. secrets-scan `--repo=plugins/cdp6-core`: exit 0, "56 files, 0 findings".

Part A (red, then green)
- A1 C2a hedge clause. Test: `lib/contract.test.mjs` "fires: the shipped core states C2a with the hedge clause and no unlisted marker". Red: `node --test plugins/cdp6-core/lib/contract.test.mjs` exit 1, "The input did not match the regular expression /no hedged completion claims/" (the old core held the "Not verified:" sentence). Fix: SKILL.md C2a now reads "...or a document id. No hedged completion claims. Exit codes ..."; the "Not verified:" sentence is removed. core.md was regenerated through `renderCore` (a temporary script, deleted). New header hash: `CDP6-CONTRACT v1 sha256:d96579da247d` (old c7c5fcd7b60a). Green: contract and inject-contract tests, 21/21. My first green run failed on a case mismatch in my own regex ("No" vs "no"); I made the regex case-insensitive.
- A2 Task tool name. Test: `hooks/guard-spawn.test.mjs` "fires: a foreign subagent_type through the Task tool name is denied in an active run". Red: assertion "0 !== 2" (the foreign type through `Task` was let through). Fix: `guard-spawn.mjs` accepts `['Agent','Task']`; `hooks.json` matcher is `Agent|Task`. `hooks-json.test.mjs` expectation updated (red "matcher: 'Agent'" vs expected 'Agent|Task', then green). guard-spawn and hooks-json tests 17/17.
- A3 `--check` normalised. Test: `lib/contract.test.mjs` "fires: generate-contract --check reads a CRLF or BOM core.md with the current body as current". Red: "generate-contract: core.md differs from the SKILL.md core". Fix: `generate()` compares `normalizeText(current)` with `normalizeText(rendered)`. The test also asserts a CRLF core.md with a changed body still reads stale (exit 1). Green: 9/9.

T2 scope items
Item 3, `lib/hooks-observed.mjs`. `recordFired(dataDir, hook, input, decision, extra = {})` now adds `agent_id` (from the input) and `capture_sha256` (from `extra`), each null when absent or not a string. Tests: `lib/hooks-observed.test.mjs`, the key-order test updated and a new test added. Red: the key list lacked the two fields and `agent_id` was undefined. Three other tests pinned the exact line shape and were updated to the two new null fields: `hooks/guard-phase.test.mjs:105-106`, `hooks/guard-shell.test.mjs:413-415`, `hooks/bootstrap.test.mjs:144-145`. The `run.mjs enter` reader needed no change (suite green).

Item 2 support, `lib/counters.mjs`. Added `boundSpawn(S, agentId)` and `closePending(S, toolUseId, work, {captureSha256, waitMs})`. The second runs `work` under the counters lock, then marks the spawn `closed_at` plus `capture_sha256`, and leaves the record untouched if `work` throws. Tests in `lib/counters.test.mjs` (5 new). Red: stubs threw "not built". Green: 13/13.

Item 2, `lib/capture.mjs` (`capture`, `readIndex`, `CaptureError`). Tests in `lib/capture.test.mjs`, 11 tests. Red: stub threw "not built", 11/11 failed. Green: 11/11. It writes `S/verdicts/<task>-<role>-<agent-id>.md` and appends one `index.jsonl` line with fields `sha256, agent_type, agent_id, task, file, targets, decision, verdict, objections, conflicted, stamp, validator`. `decision` is the task when it matches `D-<n>`, else null; `verdict` null, `objections` [], `conflicted` false, `validator` 'not-built'. It locks `S/verdicts.lock`, then closes the spawn through `closePending`; the `.md` and the index line are written inside that counters lock. A busy counters lock or a busy verdicts lock leaves no `verdicts/` directory and no changed file. A malformed index, a same-name capture file and a task/role/agent id outside `[A-Za-z0-9._-]` are refused with nothing written.

Item 1, `hooks/check-handback.mjs`. Tests in `hooks/check-handback.test.mjs`, 28 tests, with the real hook scripts as child processes, a temp HOME and temp data dirs. Red: with a stub hook that does nothing, 26 of 28 failed (e.g. "0 !== 2" on every deny case). Two passed on the stub, so I shot them by mutation (below). Green: 28/28.

AC rows (test file and title as each AC row names them)
- AC-12.25: `hooks/check-handback.test.mjs` "fires: missing acknowledgement". Red: 0 !== 2 (stub). Green: first handback denied (exit 2, reason quotes `cdp6-contract: v1 <hash>`), second let through with no capture, hooks line `none` with `capture_sha256` null. A second test covers a wrong hash, a wrong version, the CDP5 form and a trailing token.
- AC-12.9: "fires: missing run line", plus "fires: a malformed second line or a run id other than the active run is denied once". Red as above. Green: deny once, then none and no capture.
- AC-12.17: "fires: task line mismatch" (bound task D-1, line says D-2). Red: 0 !== 2. Green. Mutation: replacing `if (second[2] !== spawn.task) return` with `if (false) return` makes exactly this test fail.
- AC-12.11: "fires: unverifiable contract denies": core.md missing, corrupt (hash mismatch), garbage, version drift, SKILL.md missing; three consecutive denies each, every line `deny`. Also with no active run and with no data directory. Red: 0 !== 2. Green. Mutation: replacing the contract deny with `{ decision: 'none' }` (the CDP5 pass-through) fails "fires: unverifiable contract denies" and the no-run variant.
- AC-12.10, capture half: "the capture carries the target hashes of the spawn bound at SubagentStart". It runs the real `guard-spawn.mjs`, then `inject-contract.mjs`, then `check-handback.mjs`, and checks that the index line's `targets` are the two `docs/a.md@H1` and `docs/b.md@H2` entries. Green with the implementation. I did not run it separately red; the 26 stub failures covered the checks that precede it.
- AC-01.4: `scripts/run.test.mjs` "fires: verdict missing" (D-1 decided, no capture, exit 1, "decision-check FAIL D-1: no devils-advocate capture"). Two more tests: capture of another role, decision D-2, decision null, verdict null with validator 'not-built' (the shape `lib/capture.mjs` writes), verdict 'not-decidable'; and an unreadable index (exit 2, `checker-error`, phase stays `gate-pending`). These were green before any production change, because the SL-1 gate (`checks/decision-check.mjs`) already refuses. Shown red by mutation, each reverted: (a) removing the `findings.push(... no devils-advocate capture before the decided stamp)` line fails "fires: verdict missing" and the other-role/other-decision/null-verdict test; (b) `passing = PASSING.has(...) && ...` changed to `passing = !last.conflicted` fails the not-a-pass test; (c) making `readCaptures` return `{}` instead of throwing fails the unreadable-index test. No change to `run.mjs` was needed. My first attempt at this test (D-1 left `proposed`) was wrong: `idea-check` already refuses an undecided D-1 with "approach choice D-1 is not decided"; I replaced it. The `readyToExit` helper gained `captureOver` and `decide` options.

Input-class block, test per row (all in `hooks/check-handback.test.mjs` unless noted)
- Input missing, unreadable or not JSON: "fires: hook input missing, unreadable or not JSON is denied" (five inputs, exit 2, each with a `deny` line).
- Tool other than SubagentHandback, or agent type outside `cdp6-core:`: "a tool other than SubagentHandback and an agent type outside cdp6-core: get no decision and no line". Passed on the stub. Mutation: replacing the skip condition with `false` fails it.
- `agent_id` missing or empty: "fires: agent_id missing is denied every time" (no marker directory is created).
- Contract not verifiable: "fires: unverifiable contract denies" (deny every time).
- Ack, run line, run id, task mismatch, no bound spawn, `header: invalid`: the tests above plus "fires: no bound spawn for the agent id is denied once, then neither denied nor captured" and "fires: a spawn whose header is invalid ...". First failure denies once; the later handback gets no deny, no capture, a `none` line with `capture_sha256` null. "the first failure of one agent id does not excuse another agent id" and "a later handback of the same agent id that passes is captured" cover the edges.
- Marker unreadable or malformed: "fires: an unreadable or malformed second-attempt marker is treated as a first attempt" (garbage text, `[]`, `{"asked":"yes"}`, empty file, and a directory in the marker's place).
- No active run, or no data directory: "no active run: the acknowledgement check only ..." (no `counters.json`, no `verdicts/`), "no data directory: ...".
- `S/verdicts/` missing: created by capture, in `lib/capture.test.mjs` "capture creates S/verdicts/ when it is missing" and the accepted-handback test.
- Malformed `index.jsonl`: "fires: a malformed index refuses the capture, denies every time and leaves the index as it was" (bytes unchanged, spawn not closed); also in `lib/capture.test.mjs`.
- Task with unsafe characters: "fires: a task with characters outside [A-Za-z0-9._-] is treated like an invalid header" (`../evil`, `a b`, `x/y`; nothing written, no `verdicts/`).
- Same-name capture file: "fires: a capture file of the same name refuses the capture, denies every time and is not overwritten".
- Lock not acquired: "fires: a busy lock on counters.json denies with the reason and writes nothing" and "fires: a busy lock on the verdict index denies ..." (no `.md`, no index line, spawn not closed).
- Extra test: "the deny reason names no path and no internal error text" (passed on the stub; fails under the mutation that appends `dataDir` to the reason).

Item 5. `hooks/hooks.json` has `check-handback.mjs` on PreToolUse matcher `SubagentHandback`, `timeout` 10, `"onFailure": "block"`. `hooks/hooks-json.test.mjs` pins the entry and has a new test "fires: handback check without onFailure block". Red: the expected entry was missing. Green: 4/4.

Files (line counts)
- Created: `hooks/check-handback.mjs` 136, `hooks/check-handback.test.mjs` 388, `lib/capture.mjs` 97, `lib/capture.test.mjs` 170 (all under `plugins/cdp6-core/`).
- Changed: `hooks/guard-spawn.mjs`, `hooks/hooks.json`, `hooks/hooks-json.test.mjs`, `hooks/guard-spawn.test.mjs`, `hooks/guard-phase.test.mjs`, `hooks/guard-shell.test.mjs`, `hooks/bootstrap.test.mjs`, `lib/hooks-observed.mjs` and its test, `lib/counters.mjs` and its test, `lib/contract.test.mjs`, `scripts/generate-contract.mjs`, `scripts/run.test.mjs`, `skills/worker-contract/SKILL.md`, `skills/worker-contract/core.md`. `git diff --stat` for the tracked-modified files: 8 files, +115/-18; the T1 files are untracked, so the new T2 changes to them are not in that figure.
- No file outside `plugins/cdp6-core/`. Temporary scripts (`regen.tmp.mjs`, `mut.tmp.mjs`) are deleted; `git status` shows none.

Choices between readings
1. Second-attempt marker: `<data>/handback-asked/<sha256 of agent_id>.json` (`{"asked":true}`), per agent id; any content that is not a JSON object with `asked === true` counts as a first attempt. The brief names no location.
2. "No data directory" with a failing acknowledgement: no marker can be kept, so it denies every time (same reasoning as the missing `agent_id` row). The row says "acknowledgement check only" and does not say what a failure does here. This can loop a worker that has no data dir; see open question 1.
3. Refusals the table gives no once-rule for (unreadable run record or pointer, `counters.json` missing/malformed/locked, malformed index, same-name file, busy locks) deny every time, no marker.
4. Check order: agent_id, contract, first line, run lookup, second-line format, run id, bound spawn, header and task safety, task equality, capture. The ack is checked before the run lookup, so a bad ack with an unreadable run record is denied once and then passed.
5. The file name's role is `agentName(input.agent_type)`, not the header `role:`. Unsafe role or agent id characters are handled like `header: invalid` (deny once). A header `role:` that differs from the agent type is not checked.
6. Index lines also carry a `file` field (the `.md` name) beyond line 1190; there is no `id` field because no capture-id format exists in the concept for me to follow.
7. The spawn is marked closed in `counters.json` with `closed_at` and `capture_sha256`. The brief names no field names.
8. The brief's "no decision, no line" for foreign tools or agent types is implemented as no `hooks-fired.jsonl` line at all. Input that is not JSON is denied and logged.

Open questions
1. A deny-every-time refusal (items 2 and 3 above) can trap a worker in a loop if the cause is permanent, such as a same-name capture file or a malformed index. The brief's table says deny; the concept (UC-12 step 4) says "first failure denies once". Which is meant for the capture-time refusals? Concept lines 882 and 1190 do not settle it.
2. Capture id: the concept's clearing rule (line 880, `clears: <capture id>`) and `decision-check` fixtures use `id: 'V-1'`, but no line defines how the id is allocated or whether it is the file name. I left it out; T3 or SL-5 needs a ruling.
3. `index.jsonl` `validator` is the string 'not-built' as the brief said; the concept names no value set. T3 will replace it.
4. With `Task` accepted by `guard-spawn`, `guard-phase.mjs` already lists `Task`; `inject-contract` has no tool dependency. I did not touch the other hooks.

Follow-up notes (not changed)
- `lib/capture.mjs` does not hold the counters lock and the verdicts lock in a fixed global order against other future callers (`check-stop.mjs`, `guard-message.mjs`); SL-2b should call `capture()` rather than lock separately.
- The `closePending` write happens after `work()`; if that final counters write failed, an `.md` and an index line would exist with the spawn still open. The phase exit would still find the capture; I did not add rollback.
- `docs` (concept §5 table) lists `agent_type` and `agent_id` captures per line 1190; the `targets` array shape follows `lib/brief.mjs` (`{path, sha256}`).
