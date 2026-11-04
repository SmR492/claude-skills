# Brief: review-verify of SL-2 T2 and concept v0.5.5 (stage-1 worker run 35 of cap 52)

Objective (owner, verbatim): "go with your recommendations" (2026-11-03, ledger 0021, concept §0 item 27): every worker result gets its `review-verify` before the orchestrator acts on it (§11.3 item 4), and concept edits get a fresh reader.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; then three parts. Part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence for each claim under Claims. Part B: per hunk of the concept diff, whether its source supports it and whether it contradicts an unchanged concept line (name the line). Part C: for the worker's open questions 1 and 2 and choices 2 to 5, the concept lines that bear on them and what they settle, without a recommendation where no line settles it. Then the findings that should change the code or the concept before T3, ranked, each with one closing proposal; then status. At most 1800 words.

Target state:
- Worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted T1 and T2 diff under `plugins/cdp6-core/`. Brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-t2.md`; report `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t2.md`. The T1 report and its review are `reports/sl2-t1.md` and the ledger row "SL-2 T1 review-verify (run 33)". You wrote no part of it.
- Concept `<repo>/docs/cdp6/konzept-cdp6.md` v0.5.5 (uncommitted, sha256 ee92d38cae5c651068610b64b55eddb4885708476095c11125217abe357bdca8). The edits since v0.5.4 are the unified diff `<scratchpad>/concept-v054-v055.diff`; their sources are the ledger 0021 rows of 2026-11-03 from "SL-2 T1 review-verify (run 33)" on. Author of the edits: the orchestrator.
- The orchestrator ran on the final state: `generate-contract.mjs --check` exit 0 ("core.md is current"), cdp6-core suite exit 0 with 373 of 373.
- `<repo>` = the repository root (main checkout); `<scratchpad>` = the orchestrator session's scratchpad directory.

Claims:
1. Part A of the report: the contract core's C2a holds the hedge clause of concept row C2a and no "Not verified:" sentence; `guard-spawn.mjs` and `hooks.json` handle `Agent` and `Task`; `generate-contract.mjs --check` compares normalised text; each has the test the report names, and the quoted red message is what that test's assertion prints.
2. Each AC test named in the report asserts what its AC row says (`grep -n '^| AC-01.4 \|^| AC-12.9 \|^| AC-12.10 \|^| AC-12.11 \|^| AC-12.17 \|^| AC-12.25 '`), and the mutations named for AC-12.17, AC-12.11 and AC-01.4 would turn those tests red (read the code and the test; say where the claim cannot be decided without running it).
3. Every row of the brief's input-class block has a test asserting the cell's outcome; name any row whose test asserts something else or whose implementation departs from the cell.
4. `lib/capture.mjs` is the only writer of `S/verdicts/`; `lib/counters.mjs` the only writer of `counters.json`; `lib/hooks-observed.mjs` the only writer of `hooks-fired.jsonl` (grep every write call in `plugins/cdp6-core/` outside tests).
5. A refused capture (busy lock, malformed index, same-name file) leaves no `.md` file, no index line and the pending spawn open, as the report states; and the `.md` file is never written before the lock is held.
6. The deny reasons of `check-handback.mjs` expose no path or internal error text (concept §1.4 and the brief's rule "errors to callers in a structured form without internals").
7. `hooks-observed.mjs` writes `agent_id` and `capture_sha256` on the `check-handback.mjs` line of an accepted capture, which the live-run check of concept §11.3 item 3 reads ("every `S/verdicts/` file has a `hooks-fired.jsonl` line of `check-handback.mjs` with the same agent id and capture sha256").

Tools: Read, Grep, Glob, Bash for read-only commands (`git -C <worktree> diff`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution and some heredocs; use one command per call.

Stop rule: one pass over the claims, the diff and part C; at most 70 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
