# Brief: change review of concept v0.5.0 (konzept-reviewer, stage-1 worker run 26 of cap 45)

Objective (owner, verbatim): "go with your recommendation -> Option 1" (2026-11-03, ledger 0021; concept §0 item 25): the authoritative run state moves out of the project into the `state directory` `S` = `<data>/runs/<run-id>/`; `run.mjs` and the hooks write nothing into the project and read project files only through the descriptor reader; the readable artefacts stay in the `run directory` `R`.

Output format (final answer, handback only, no file): first line `conflict of interest: none | <stake>`; gate status for the change; per question below a verdict with concept line evidence; prioritised gaps, each with one closing proposal (concept text, named precisely); then status. At most 1200 words.

Target state: `<repo>/docs/cdp6/konzept-cdp6.md` v0.5.0 (uncommitted; author of the v0.5.0 edits: the orchestrator). The v0.4.12 text before the change is `<scratchpad>/konzept-v0412.md`; compare the two files. The 0.5.0 changelog line lists the change. The reason is in ledger 0021 (`<repo>/docs/retro/0021-cdp6-framework.ledger.md`, the rows of 2026-11-03): an executed counter-test showed that the unsandboxed `run.mjs` writes run files outside the project when the checked run root is swapped for a symlink after the check. You wrote no part of it.

Questions:
1. Completeness: does any concept line still put a file that `run.mjs` or a hook writes into `R` or the project (phase cards, UC steps, error rows, ACs, the CH table, §5.6, §8, §11, the glossary), or still assume the state lives in the project (for example `guard-files.mjs` denies, the reconciliation of §3.4 item 11, `trajectory.mjs`, capture, the live-check rows, the STOP rows, `cdp6-doctor`, release checks)? Name each line with its proposed text.
2. Consistency: do the edits contradict each other or an unchanged line (CH-4 and its rejected alternatives, §0 item 25, the class rule at the `run directory` definition, §1.4 item 2 lookup and missing-pointer scan, UC-09 steps 1 and 1.4, §5.2, §5.6 items 5 and 10, AC-09.15, AC-14.6, §11.3 item 3)?
3. Readable artefacts: the executor now writes `R` and copies of `S/ledger.md` and `S/verdicts/*.md` there that "decide nothing". Do the gates that read `R` artefacts (`idea-check.mjs` and later checkers, artefact hashes at phase exit, `guard-phase.mjs` step 4) still have a defined, tamper-evident input, and is the hash record of each read artefact stated?
4. Doctrine fit: does the change keep what CH-4 protected (artefacts visible in reviews and PRs, the company rule, D-19 C2), and is the cost (state lost with the plugin data) stated where the owner would look for it?
5. The project-root rule (§1.4 item 2, v0.5.0: the top level must contain `cwd`, else `cwd` itself): does it keep the linked-worktree mapping and the nested-repository case of AC-10.10 intact?

Tools: Read, Grep, Glob. No writes, no network.

Stop rule: one pass over the five questions; at most 60 tool calls; a gap without a concept line is not reported.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
