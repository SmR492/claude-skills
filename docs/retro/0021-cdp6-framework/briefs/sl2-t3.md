# Brief SL-2 T3: T2 corrections, verdict check and the devils-advocate role (stage-1 worker run 36 of cap 52)

Objective (owner, verbatim): "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind." Start of SL-2 approved by the owner on 2026-11-03 ("Ok"; ledger 0021).

Output format (final answer, handback only, no file): acknowledgement line; status; part A: per correction the test, its red run and green run; part B: per AC one row with test file and title, the red run (command, exit, and the failing assertion message quoted verbatim from that run's output), the green run (command, exit); per row of the input-class block the test that shows its outcome; files created or changed with line counts; the gate commands with their real exits and last output lines; every choice between readings of the concept with the line followed; open questions. Show each test red on its own or in a batch no larger than one AC, one correction or one input-class row; never one stub batch for a whole file. A test that is green before any production change is shown red by a stated mutation of the production code, which you then revert. At most 2000 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, branch `feat/cdp6-sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, holding the uncommitted T1 and T2 diff (reports `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t1.md`, `sl2-t2.md`; reviews: the ledger rows "SL-2 T1 review-verify (run 33)" and "SL-2 T2 review-verify (run 35)" in `<repo>/docs/retro/0021-cdp6-framework.ledger.md`). Every Bash call starts with `cd <repo>/.worktrees/sl2 && `.
- Specification: the concept v0.5.6 at `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, uncommitted, sha256 4db4936a3ed357c9efafb5529bb754e49adbf34c34ed873ec35622df9b10090c; read only; the worktree copy is v0.4.8, do not use it). Line numbers below refer to that file.
- Comparison source, not a specification: `plugins/cdp5-agents/agents/devils-advocate.md` in the worktree. Concept line 129 names the changes for the CDP6 role text.

Part A, T2 corrections (first, each test-first; found by `review-verify` run 35 and confirmed by the orchestrator against the code):
1. `scripts/run.mjs:290` writes `S/counters.json` itself. `run.mjs init` creates it through a function of `lib/counters.mjs` instead (concept §1.2 `lib/` row, line 60; CH-5, line 1713). A test shows `init` still leaves a `counters.json` that `lib/counters.mjs` reads.
2. Refusal rule at capture time (UC-12 step 4, line 882, v0.5.6): a busy lock, an unreadable run record or `counters.json`, a malformed `index.jsonl` and a capture file of the same name deny once per agent id, through the same second-attempt marker as the content checks; a later handback of that agent id that still fails is neither denied nor captured and leaves a `hooks observed` line with decision `none` and `capture_sha256` null. Only an unverifiable contract and a missing `agent_id` deny every time. Without an absolute `CLAUDE_PLUGIN_DATA` the hook gives no decision (line 882 and the UC-10 error row, line 795).
3. Idempotent retry (line 882): a handback whose bound spawn is already closed with a `capture_sha256` equal to the sha256 of this message gets no decision and no second capture; `lib/counters.mjs` gives `check-handback.mjs` the closed spawn for that check. A closed spawn with a different sha256 falls under item 2.
4. Orphan file (`lib/capture.mjs:81` on): when a step after the `.md` write fails inside the capture, the `.md` file is removed before the error leaves the capture, so no file without its index line and closed spawn remains. Test by forcing the index append or the counters write to fail.
5. The index line gains `id`, the `capture id`: the file name without `.md` (UC-12 step 5, line 883; §5 table, line 1190).
6. `hooks/hooks-json.test.mjs` "fires: handback check without onFailure block": its second half deletes the field and then asserts it is undefined; check it through a predicate over the parsed file, as `guardsWithoutBlock` does. `hooks/check-handback.test.mjs` run-id rows (around lines 166-172): also assert the later `none` line with `capture_sha256` null.

Part B, T3 of SL-2 (slice row `grep -n '^| SL-2 '`; plan row T3):
1. Agent `cdp6-core:devils-advocate` at `agents/devils-advocate.md`: rebuilt from the CDP5 role with the changes of line 129: O3 (line 1492: its object is a choice "proposed, before any vote or decision on it and before it is executed"), O4 (line 1493: the premise list, verbatim), the pass invalid with `fresh context: no` or `rejected alternative provided: no`, its step 8 reading "until the owner records acceptance or reasoned rejection per objection with `run.mjs object`", the `conflict of interest:` line (C13, line 1369), the second answer line `run: <run-id> task: <task>` (C11). Tools `Read, Grep, Glob`. It names `CDP6-CONTRACT v1` where the CDP5 role names `WORKER-CONTRACT`. Doctrine section numbers only where the CDP6 concept states them; no CDP5 doctrine numbers. Its Output section fixes one machine-readable form that `verdict-check.mjs` parses: the header lines `fresh context:`, `rejected alternative provided:`, `conflict of interest:`; the severity scale and the verdict mapping line (C4); a `premises:` section, always present (O4 prescribes `premises: none, no existing code or data touched` when nothing is touched); objections with ids `F-P<k>-<n>`, each citing an artefact id and a file:line or a command; one verdict line naming one of `a`, `a-with-conditions`, `b`, `c`, `not-decidable` (the classes of line 1190). It must pass the skill-lint gate.
2. `checks/verdict-check.mjs` (UC-12 step 5, line 883; O15, O16) as a module used by `lib/capture.mjs` at capture time and as a checker: it parses that form and rejects a `block` (`b`, `c`) objection that cites no artefact id (AC-12.1); a devils-advocate capture without the `premises:` section (AC-12.4); a capture without the `conflict of interest:` line, or a devils-advocate capture with `rejected alternative provided: no` or `fresh context: no` (AC-12.12); a counter-role capture without the severity scale and the verdict mapping line (AC-12.15). A capture whose `conflict of interest:` line names a stake is recorded `conflicted`, whatever its verdict (C13, AC-12.21).
3. Wiring: `lib/capture.mjs` runs the validation and writes its result on the index line: `verdict`, `objections` (ids), `premises` (ids `<capture id>:premise-<n>`), `conflicted`, and `validator` `valid` or `rejected` with the reasons; a rejected capture keeps `verdict` null, so `decision-check.mjs` does not count it. The handback is still captured (the capture is the record; UC-12 error row: "the orchestrator re-runs the role").
4. Stale targets (AC-12.3; §5.3 `target:` line 1221, v0.5.6): at the phase exit a capture whose `target:` sha256 differs from the snapshot copy of that path, or whose target is missing from the snapshot, is `stale` and not counted. `checks/decision-check.mjs` takes `--snapshot` (as `idea-check.mjs` does) and drops stale captures before it picks the latest one before the `decided` stamp; the staleness test lives in `checks/verdict-check.test.mjs` "fires: stale target" as the AC row names.
5. Clearing by object records (AC-12.21; C13; UC-12 step 5, line 883, "or on `run.mjs object` records per item"; the capture clearing is SL-5): a `conflicted` devils-advocate capture of a decided `D-n` keeps the decision open, also when a later capture of a fresh devils-advocate instance passes, until every objection and every premise of the conflicted capture has a `run.mjs object` record. `scripts/run.mjs object` accepts, besides `F-P<k>-<n>`, a premise id `<capture id>:premise-<n>` that names a premise on an index line of the run; any other form is refused as now. `lib/run-argv.mjs` and `guard-shell.mjs` keep `object` an owner form.
6. ACs, each with the test file and titles its row names (`grep -n '^| AC-12.1 \|^| AC-12.3 \|^| AC-12.4 \|^| AC-12.12 \|^| AC-12.15 \|^| AC-12.21 '`): AC-12.1, AC-12.3, AC-12.4, AC-12.12, AC-12.15, AC-12.21 (three titles).

Input-class block (O6, §5.3; trigger: the checker reads captures and the index, `run.mjs object` validates input). Every cell is the outcome to build and test:

| Input | Outcome |
|---|---|
| capture text empty, or without any of the header lines | `validator: rejected`, reasons named, `verdict` null |
| a header line twice with different values | rejected |
| verdict line missing, or a class outside the five | rejected |
| objection id not of the form `F-P<k>-<n>`, or the same id twice | rejected |
| `premises:` present but a premise line neither `checked` with a file:line or command nor `unchecked` | rejected |
| an `unchecked` premise with verdict `a` or `a-with-conditions` | recorded with verdict `not-decidable` (O4, line 1493: an `unchecked` premise the verdict rests on makes it "not decidable without <evidence>"), which `decision-check.mjs` counts as no pass |
| `index.jsonl` line not JSON at the checker | exit 2, `checker-error`, phase stays `gate-pending` (as `decision-check.mjs` does now) |
| snapshot directory missing or unreadable | exit 2, `checker-error` |
| `run.mjs object` premise id naming no index line, or a capture id with characters outside `[A-Za-z0-9._-]` | refused, nothing recorded |
| a second `run.mjs object` for the same id | refused as now (`objection-recorded`) |

Out of scope: the C13 clearing by a later capture and the `clears:` check (SL-5); AC-12.5 self review (needs `tool-log.jsonl`, SL-4); hedges, `wrote:` claims, PII, `check-stop.mjs` (SL-2b); other roles; any file outside `plugins/cdp6-core/`; any change to the CDP5 plugins or the concept.

Rules: test-first per correction, per AC and per input-class row (write the test, show it red for the stated reason, then implement). Tests use `node:test`, temporary directories, a temporary HOME and stub hook inputs; never the real home directory, the real host key or real Claude Code. The token secret is never printed, logged or written outside the key file. No comments in code. No new dependency. Errors to callers in a structured form without internals. Keep every SL-1, T1 and T2 test green unless part A changes what it asserts.

Gate commands (each from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`
(`generate-contract.mjs --check` is run by the orchestrator; the CDP5 shell guard refuses it for workers.)

Disposable environment:
disposable environment: <repo>/.worktrees/sl2
base commit: 960146b3f8e5884a4a9f93f1077e793cedd6e14a (plus the uncommitted T1 and T2 diff)
baseline: after T2, cdp6-core tests 373/373 and CDP5 suite exit 0 (orchestrator re-run 2026-11-03)
run grant: impl-uc may run in <repo>/.worktrees/sl2 until 2026-11-04T03:55:40Z, 1 use left (T3), session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, plan, briefs and reports. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`; use one command per call or a node script file inside the worktree.

Stop rule: part A first, then part B in the order listed. When an item is not testable as written, contradicts another concept line, or needs an out-of-scope file, record it as an open question with both line numbers and continue; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
