contract: v2 f91736a60d15

Status: done. All six part A corrections and all part B items are built in `<repo>/.worktrees/sl2` (branch `feat/cdp6-sl2`, base 960146b, plus the uncommitted T1/T2 diff). The four gates exit 0. Nothing is committed, and nothing outside `plugins/cdp6-core/` changed (`git status` check). Where a test was green before the production change, I showed it red by a stated mutation (the table below) and reverted it. After the mutation runs I re-ran every gate on the final tree.

Gates (each from the worktree):
1. cdp6-core `node --test lib/*.test.mjs scripts/*.test.mjs checks/*.test.mjs hooks/*.test.mjs`: exit 0, tests 417, pass 417, fail 0 (baseline 373).
2. CDP5 and others suite (command from the brief): exit 0, tests 295, pass 295, fail 0.
3. `skill-lint --path=plugins/cdp6-core`: exit 0, "2 skills, 1 agents, 0 🔴 0 🟡 2 🟢" (the two 🟢 are existing test-file notes). The agent line reads "agent agents/devils-advocate.md (devils-advocate): ok".
4. `secrets-scan --repo=plugins/cdp6-core`: exit 0, "60 files, 0 findings, 0 unreadable".

## Part A

Test titles are in the files named. Red means the first run of the new or changed test failed for the stated reason. Each red run is `node --test <file>`, exit 1.

1. `init` creates `counters.json` through the lib.
   - Tests: `lib/counters.test.mjs` "initCounters creates counters.json with mode 0600 that readCounters reads, and refuses to replace an existing one". `scripts/run.test.mjs` "init leaves a counters.json that lib/counters.mjs reads, and run.mjs does not write that file itself".
   - Red (after an empty `initCounters` scaffold): `Error: ENOENT: no such file or directory, stat '/tmp/cdp6-counters-…/counters.json'`. For run.test: `AssertionError … run.mjs names counters.json`.
   - Green: counters 14/14, run.test 105/105. `run.mjs:291` now calls `initCounters(S)`. Error codes `counters-exists` and `counters-unwritable`.
2. Refusal at capture time denies once per agent id.
   - Tests, all in `hooks/check-handback.test.mjs`: "fires: an unreadable run record is denied once, then neither denied nor captured", "fires: counters.json missing or malformed is denied once…", "fires: a malformed index refuses the capture, denies once…", "fires: a capture file of the same name refuses the capture, denies once…", "fires: a busy lock on counters.json denies once…", "fires: a busy lock on the verdict index denies once…", "no data directory: no decision for a failed acknowledgement, an unverifiable contract still denies". Each asserts the second call is allowed and the hooks observed lines read `deny/null` then `none/null`.
   - Red: 7 failed, for example `check-handback.mjs: counters.json cannot be used (counters-missing)  2 !== 0`.
   - Green: 28/28 at that point. A missing `agent_id` and an unverifiable contract still deny every time.
3. Idempotent retry.
   - Tests: "a retry of a captured handback with the same message gets no decision and no second capture" (red: `check-handback.mjs: a capture of this task, role and agent id already exists`). "fires: a handback whose spawn is closed with another message sha256 is denied once…" was green first; mutation row `A3-idempotent` shows it red.
   - `boundSpawn` already returns closed spawns, so no lib change was needed.
4. Orphan file.
   - Tests in `lib/capture.test.mjs`: "fires: an index append that fails removes the capture file and leaves the index and the spawn as they were" (read-only index) and "fires: a counters write that fails after the index append removes the capture file and the index line" (a directory squats on the counters tmp name).
   - Red: the snapshot differed, `+ 'D-2-devils-advocate-agent-8.md'` left in `verdicts`.
   - Fix: `capture()` removes the `.md`, restores or removes the index line, removes a directory it created, and throws `CaptureError('capture-failed')`.
   - Added hook test "fires: a capture write that fails leaves no capture file, denies once and keeps the spawn open". Red: reason did not match `/could not be captured/`.
5. Index line gains `id`.
   - Test: the key-list assertion in the first `lib/capture.test.mjs` test, changed to include `id` and to check `id === file minus .md`.
   - Red: `Expected values to be strictly deep-equal` on the key list.
6. Predicate and `none` line.
   - `hooks/hooks-json.test.mjs` "fires: handback check without onFailure block" now uses the predicate `checksWithoutBlock`. It was green first. Mutation: `onFailure` "block" changed to "continue" in `hooks.json`, giving a red `fires: handback check without onFailure block`; reverted.
   - `hooks/check-handback.test.mjs` run-id rows now also assert the observed lines `[['deny', null], ['none', null]]` and an empty index. They were green first. Mutation: the run-id check disabled, giving a red `fires: a malformed second line or a run id other than the active run is denied once`; reverted.

## Part B

New AC and input-class tests were run after each addition; the first-run reds, with the failing assertion quoted from that run, are in the table. Reds I did not capture verbatim at the time are re-shown by the mutation runs below. I list each mutation as: change, then the failing test and the message.

| Row | Test (file, title) | Red run (`node --test <file>`, exit 1) |
|---|---|---|
| AC-12.1 | `checks/verdict-check.test.mjs` "fires: untraceable block" | stub returned `{}`: `AssertionError … b  + actual - expected  + undefined  - 'rejected'` |
| AC-12.4 | "fires: missing premises" | first run failed (`pass 2 / fail 1`); mutation `if (false) reasons.push` on the premises check gives `Expected values to be strictly equal:` |
| AC-12.12 | "fires: missing conflict line", "fires: pass without fresh context" | first run failed on both; mutations give `AssertionError … null` (conflict line) and `Expected values to be strictly equal:` (fresh, rejected alternative) |
| AC-12.15 | "fires: unmapped verdict" | `AssertionError [ERR_ASSERTION]: scale  + actual - expected` |
| AC-12.3 | "fires: stale target" (unit); `checks/decision-check.test.mjs` "fires: stale target is dropped before the latest capture is picked" | unit: `false !== true`; decision: `AssertionError … decision-check OK  0 !== 1`; later the `--snapshot` argument was not passed through yet |
| AC-12.21 (1) | "fires: declared stake counted as pass" | `Expected values to be strictly equal:` |
| AC-12.21 (2) | "fires: fresh same-role instance clears" | `AssertionError … decision-check OK  0 !== 1` |
| AC-12.21 (3) | "clears on object records per item" | green after (2); mutation `AC-12.21c` (premises ignored) gives `AssertionError … D-1-devils-advocate-agent-7:premise-1: decision-check OK` |

Input-class rows, with the test that shows each outcome:
- Empty text or no header lines: `verdict-check.test.mjs` "input class: an empty capture or one without any header line is rejected with reasons and verdict null". Red: reasons lacked "empty".
- Header twice with different values: "…a header line twice with different values is rejected, twice with the same value is read once". Red: `AssertionError … fresh context`. A repeat with the same value is read once.
- Verdict line missing or class outside the five: "…a verdict line missing or a class outside the five is rejected, each of the five is read". Red: `AssertionError … verdict: maybe`.
- Objection id not `F-P<k>-<n>`, or the same id twice: "…an objection id not of the form F-P<k>-<n>, or the same id twice, is rejected". Red: `AssertionError … F-P1`.
- Premise row neither `checked` with evidence nor `unchecked`: "…a premises section whose line is neither checked …". Red: `Expected values to be strictly deep-equal` on the premise ids.
- Unchecked premise with verdict `a` or `a-with-conditions`: "…recorded as not-decidable". Red: `AssertionError … a`. `decision-check.mjs` counts `not-decidable` as no pass ("fires: not decidable is no pass").
- `index.jsonl` line not JSON: `verdict-check.test.mjs` "input class: an index line that is not JSON, a snapshot that is missing and a missing argument exit 2" (red: `verdict-check OK`). The decision-check path is the existing `scripts/run.test.mjs` "fires: verdict missing when the verdict index is not readable" (exit 2 `checker-error`, phase stays `gate-pending`); mutation `row-index-notjson-decision` turns it red with `decision-check FAIL D-1: no devils-advocate capture…`.
- Snapshot missing or unreadable: `decision-check.test.mjs` "fires: a snapshot directory that is missing or unreadable exits 2…". Red: `1 !== 2`.
- `run.mjs object` premise id naming no index line, or a capture id with characters outside `[A-Za-z0-9._-]`: `scripts/run.test.mjs` "fires: a premise id that names no index line, or a capture id with characters outside the set, is refused and nothing is recorded". Refusals are `unknown-premise`, `bad-objection-id` and `index-unreadable`, and nothing is recorded. The first AC test's red was `{"error":"bad-objection-id",…} 2 !== 0`.
- Second `object` for the same id: refused with `objection-recorded`, shown in "object records a premise id that names a premise on an index line of the run, once".

Further tests:
- `lib/capture.test.mjs`: wiring of `verdict`, `objections`, `premises`, `conflicted`, `validator` and `reasons` onto the index line. Rejected captures are still captured, with verdict null and the spawn closed. A conflicted capture keeps its verdict and items. A role outside the triad set is `not-checked`.
- `hooks/check-handback.test.mjs`: "a handback that fails the verdict form is not denied: it is captured with validator rejected…".
- `scripts/run.test.mjs`: the real `exit idea` path for stale targets, with the stale case failing the gate and the current hash passing.
- `hooks/guard-shell.test.mjs` "fires: objection on a premise id from agent" and `lib/run-argv.test.mjs` `ownerForm`: mutation of `ownerForm` to drop `object` gives red.
- `checks/devils-advocate-agent.test.mjs` (6 tests). Red run: with the CDP5 role copied into the path, 5 of 6 fail. For example "no doctrine section number appears" fails with `The expression evaluated to a falsy value`. Without any file it fails with ENOENT.

Mutation table (each applied, test run, reverted; all exit 1):
- AC-12.1 (`if (false)` on the untraceable check): `fires: untraceable block => … b`
- AC-12.4: `fires: missing premises`
- AC-12.12a (conflict line check removed): `fires: missing conflict line => … null`
- AC-12.12b, AC-12.12c: `fires: pass without fresh context`
- AC-12.15 (mapping check removed): `fires: unmapped verdict => … scale`
- AC-12.3 (`isStale` returns false): `fires: stale target`
- AC-12.3-decision (stale not dropped): `…stale target is dropped… => decision-check OK`
- AC-12.21a (`conflicted = false`): `fires: declared stake counted as pass`
- AC-12.21b (only the latest capture is checked for conflict): `fires: fresh same-role instance clears => decision-check OK` and `clears on object records per item => F-P1-1: decision-check OK`
- AC-12.21c (premises ignored): see the AC table
- row-unchecked, row-dup-header, row-verdict-class, row-objection-id, row-objection-dup, row-premise-row, row-empty: each red in its own input-class test
- row-index-notjson, row-snapshot (CLI) and row-snapshot-decision: red
- row-rejected-decision (rejected captures counted): red
- A3-idempotent: red
- wiring-reasons, wiring-premises: red in `lib/capture.test.mjs`
- object-index (index lookup disabled): red in `scripts/run.test.mjs`

The mutation driver was `<scratchpad>/mutate.mjs`, outside the worktree.

## Files (new or changed in this task; line counts as of now)

- `plugins/cdp6-core/checks/verdict-check.mjs` new, 204. It holds `validateCapture`, `isStale`, `checkCaptures`, `readCaptures`, `requireSnapshot`, and the CLI `--run-dir S [--snapshot dir]`.
- `checks/verdict-check.test.mjs` new, 362.
- `checks/devils-advocate-agent.test.mjs` new, 75.
- `agents/devils-advocate.md` new, 74.
- `checks/decision-check.mjs` 86 and `checks/decision-check.test.mjs` 187, both changed.
- `lib/capture.mjs` 120 and `lib/counters.mjs` 106 (plus their tests), changed.
- `hooks/check-handback.mjs` 138, changed.
- `scripts/run.mjs` 670, changed.
- Tests changed: `lib/capture.test.mjs`, `lib/counters.test.mjs`, `lib/run-argv.test.mjs`, `hooks/check-handback.test.mjs`, `hooks/hooks-json.test.mjs`, `hooks/guard-shell.test.mjs`, `scripts/run.test.mjs`.

## Choices between readings (line followed)

1. No absolute `CLAUDE_PLUGIN_DATA` (line 882, line 795): a failed acknowledgement now gives no decision. This changes the T2 test "no data directory…denied every time" on purpose. An unverifiable contract and a missing `agent_id` still deny.
2. Idempotent retry (line 882): the observed line records `none` with `capture_sha256` equal to the existing capture's sha256 (the capture exists), not null.
3. Roles: the full validation (verdict, objections, premises) applies to `devils-advocate` only (SL-2 scope). Header checks (conflict line; severity scale and mapping for the counter-roles `devils-advocate`, `pessimistic-realist`, `adversarial-auditor`, `psy-grenzwaechter`, `threat-modeler`) apply to the triad set plus `konzept-reviewer`, `review-verify` and `review-code`. Their verdict is null. Every other `cdp6-core:` role is recorded `validator: 'not-checked'`, a third value beside the brief's `valid` and `rejected`, so that `impl-uc` handbacks are not recorded as "rejected".
4. Machine form (my definition): header lines at line start; `severity scale:` and `verdict mapping:` as two lines, the mapping naming all five classes with a target of `pass`, `pass-with-conditions`, `block` or `no pass`; `objection: F-P<k>-<n> | artefact: <id> | evidence: … | refuted when: …`, with `k` in 1..8 as `run.mjs object` accepts; one `verdict:` line; premise rows `- <text> -- checked: <file:line | command: …>` or `- <text> -- unchecked`; and exactly `premises: none, no existing code or data touched` (anything shorter is rejected). Only `artefact:` is enforced for block objections; `evidence:` and `refuted when:` are not.
5. Role text: O4's premises sentence sits in step 4 (merged with the attack step), so O4 "step 4" and the concept's "step 8" both stay true. With a declared stake the role still gives its verdict (line 883 and AC-12.21 need a verdict line), which differs from the CDP5 text "give no verdict".
6. `decision-check.mjs` takes `--snapshot` optionally, but exits 2 `snapshot-missing` when a considered capture has targets and no snapshot was given (fail closed). It exits 2 `snapshot-unreadable` for a bad snapshot. Rejected captures are dropped like stale ones, with their own finding if none remain.
7. A conflicted capture with no objection or premise to record gets a finding (nothing for the owner to record, so only the SL-5 clearing capture can clear it).
8. `verdict-check.mjs` is not registered in `checks/registry.json` (the brief did not ask). As a checker it reports rejected and stale captures.

## Open questions and follow-ups

- Whether `verdict-check` should be a registered gate checker. Today it is only a module and a CLI.
- If you want `not-checked` replaced by `valid` for non-triad roles, it is a one-line change in `validateCapture`.
- Process note: early in part A I wrote two scratch backups under `/tmp` instead of the scratchpad; both were deleted. I used the scratchpad afterwards.
- Out of scope and untouched: C13 clearing by capture and the `clears:` check (SL-5), AC-12.5, hedges, `wrote:`, PII, `check-stop.mjs` (SL-2b), other role files.
