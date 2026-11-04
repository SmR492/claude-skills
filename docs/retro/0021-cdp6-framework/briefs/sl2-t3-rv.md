# Brief: review-verify of SL-2 T3 and concept v0.5.6 (stage-1 worker run 37 of cap 52)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02) and "du hast mein ok für die Nacht" (2026-11-03; ledger 0021). §11.3 item 4: `review-verify` on every task, `review-code` for a new seam, `adversarial-auditor` on SL-2 as a security-boundary slice, and the SL-2 outside reviewer named in ledger 0021 at the SL-2 start; the slice-end reviews run before one combined fix run.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence; part B: per hunk of `<scratchpad>/concept-v055-v056.diff`, whether its source (ledger 0021 rows of 2026-11-03 from "SL-2 T2 review-verify (run 35)" on) supports it and whether it contradicts an unchanged concept line; then the findings that should change code or concept, ranked, each with one closing proposal; then status. At most 1800 words.

Target state: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted SL-2 diff under `plugins/cdp6-core/` (T1, T2, T3 by three `impl-uc` runs; plan `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-plan.md`; briefs `sl2-t1.md`, `sl2-t2.md`, `sl2-t3.md`; reports `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t1.md`, `sl2-t2.md`, `sl2-t3.md`; the T1 and T2 reviews are the ledger rows "SL-2 T1 review-verify (run 33)" and "SL-2 T2 review-verify (run 35)" of `<repo>/docs/retro/0021-cdp6-framework.ledger.md`). Concept v0.5.6 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 4db4936a3ed357c9efafb5529bb754e49adbf34c34ed873ec35622df9b10090c). You wrote no part of it. The orchestrator ran on the final state: cdp6-core suite 417 of 417 exit 0, `generate-contract.mjs --check` exit 0. `<repo>` = the repository root (main checkout); `<scratchpad>` = the orchestrator session's scratchpad directory.

Claims (report sl2-t3.md):
1. Part A items 1 to 6 are built as the T3 brief states them, each with the test the report names; `scripts/run.mjs` no longer writes `counters.json` itself.
2. Each AC test of part B asserts what its AC row says (`grep -n '^| AC-12.1 \|^| AC-12.3 \|^| AC-12.4 \|^| AC-12.12 \|^| AC-12.15 \|^| AC-12.21 '`), and each mutation in the report would turn the named test red (read code and test; say where a claim cannot be decided without a run).
3. Every row of the T3 input-class block has a test asserting the cell's outcome.
4. The role file `agents/devils-advocate.md` carries the changes of concept line 129 (O3, O4 verbatim, the invalid pass, step 8 with `run.mjs object`, the conflict line, the second answer line), names `CDP6-CONTRACT v1`, and its Output form is the one `checks/verdict-check.mjs` parses.
5. The worker's choices 1 to 8 stay inside the brief and the concept lines it cites; name each that does not (choice 3 adds the validator value `not-checked`; choice 6 makes `--snapshot` optional with a fail-closed rule; choice 8 leaves `verdict-check.mjs` unregistered).
6. `lib/capture.mjs` leaves no `.md` file without its index line and closed spawn after a failure inside the capture (part A item 4).

Tools: Read, Grep, Glob, Bash for read-only commands (`git -C <worktree> diff`, `git -C <worktree> status`, grep, sed -n, cat -n, wc). No test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution and some heredocs; use one command per call.

Stop rule: one pass; at most 70 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.


