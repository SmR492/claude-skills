# Brief: outside review of SL-2 (konzept-reviewer, stage-1 worker run 40 of cap 52)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02) and "du hast mein ok für die Nacht" (2026-11-03; ledger 0021). §11.3 item 4: `review-verify` on every task, `review-code` for a new seam, `adversarial-auditor` on SL-2 as a security-boundary slice, and the SL-2 outside reviewer named in ledger 0021 at the SL-2 start; the slice-end reviews run before one combined fix run. The SL-2 outside reviewer is a fresh `konzept-reviewer` instance with conflict of interest none (ledger 0021, SL-2 start).

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; gate status for the SL-2 scope; per question below a verdict with concept line and code file:line evidence; prioritised gaps, each with one closing proposal (concept text change or code change, named precisely); then status. At most 1500 words.

Target state: worktree `<repo>/.worktrees/sl2`, base 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted SL-2 diff under `plugins/cdp6-core/` (T1, T2, T3 by three `impl-uc` runs; plan `<repo>/docs/retro/0021-cdp6-framework/briefs/sl2-plan.md`; briefs `sl2-t1.md`, `sl2-t2.md`, `sl2-t3.md`; reports `<repo>/docs/retro/0021-cdp6-framework/reports/sl2-t1.md`, `sl2-t2.md`, `sl2-t3.md`; the T1 and T2 reviews are the ledger rows "SL-2 T1 review-verify (run 33)" and "SL-2 T2 review-verify (run 35)" of `<repo>/docs/retro/0021-cdp6-framework.ledger.md`). Concept v0.5.6 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 4db4936a3ed357c9efafb5529bb754e49adbf34c34ed873ec35622df9b10090c). You wrote no part of it. The orchestrator ran on the final state: cdp6-core suite 417 of 417 exit 0, `generate-contract.mjs --check` exit 0. `<repo>` = the repository root (main checkout); `<scratchpad>` = the orchestrator session's scratchpad directory.

Questions:
1. SL-2 completeness: does the build close the SL-2 row (`grep -n '^| SL-2 '`) and its AC list, read against §11.3 items 2 to 4 and the stage-1 live run of item 3? Name any AC of the row without its test, and any built behaviour the row does not cover.
2. Concept edits v0.5.4 to v0.5.6 (§0 item 27; UC-12 steps 2, 4, 5; §5.3 `task:` and `target:`; §5 table rows of `S/verdicts/` and `hooks-fired.jsonl`; §1.2; CH-29; the SL-5 and SL-8 rows; `observe-permission.mjs` in UC-10 and AC-10.12): are they consistent with each other and with the unchanged lines, and do they say what the code does?
3. The devils-advocate role text `agents/devils-advocate.md` and the machine form that `checks/verdict-check.mjs` parses: does the role keep what concept line 129, O3, O4 and C13 require, and is the machine form a concept-level interface that the concept should state (it is defined only in the role file and the checker today)?
4. The T3 open points: `verdict-check.mjs` is a module and a CLI but not registered as a P1 gate checker; the validator value `not-checked` for roles outside the triad; `decision-check.mjs --snapshot` optional with a fail-closed rule. Does each follow the concept, or does the concept need a line?
5. The live P1 run (§11.3 item 3) depends on SL-1 and SL-2 only: is anything the live run needs from SL-2 missing, for example the `hooks-fired.jsonl` line of `check-handback.mjs` with agent id and capture sha256 for every `S/verdicts/*.md` file?

Tools: Read, Grep, Glob. No writes, no network.

Stop rule: one pass over the five questions; at most 60 tool calls; a gap without a concept line or file:line is not reported.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
