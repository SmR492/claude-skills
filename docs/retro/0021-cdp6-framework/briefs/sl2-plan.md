# SL-2 task plan (orchestrator, 2026-11-03)

Source: concept `docs/cdp6/konzept-cdp6.md` v0.5.4, slice table row SL-2 (`grep -n '^| SL-2 '`), §11.3 items 2 to 4, §0 items 26 and 27. Worktree `.worktrees/sl2` on 960146b (SL-1 commit), branch `feat/cdp6-sl2`. The worktree holds concept v0.4.8; every brief names the main-checkout concept as the specification, with its sha256 at the brief's date. Tasks run one after another in that worktree; each builds on the previous diff.

| Task | Content | ACs |
|---|---|---|
| T1 contract and spawn binding | `CDP6-CONTRACT v1` (CDP5 `worker-contract` copied and extended, §1.3 row; CDP5 code is a comparison source), `scripts/generate-contract.mjs`, `hooks/inject-contract.mjs` with the spawn binding, `lib/brief.mjs`, `hooks/guard-spawn.mjs` limited to the namespace deny and the pending-spawn record | AC-12.6, AC-12.10 |
| T2 handback and capture | `hooks/check-handback.mjs` (fail-closed, acknowledgement, `run:`/`task:` line), `lib/capture.mjs` (single writer of `S/verdicts/`), `lib/hooks-observed.mjs` as the only writer of `hooks-fired.jsonl`, extended with agent id and capture sha256 (§0 item 27), the verdict-missing refusal of `run.mjs exit` | AC-01.4, AC-12.9, AC-12.11, AC-12.17, AC-12.25 |
| T3 verdict check and role | `checks/verdict-check.mjs` for the devils-advocate verdict (C13 `conflicted` record, clearing by `run.mjs object` records only; the capture clearing is SL-5), registry pin, agent `cdp6-core:devils-advocate` (O3, O4, C11, C13) | AC-12.1, AC-12.3, AC-12.4, AC-12.12, AC-12.15, AC-12.21 |

Reviews (§11.3 item 4, §0 item 27): `review-verify` after each task against its brief; the first one (after T1) also checks the run-29 diff in 960146b and the concept edits v0.5.2 to v0.5.4 (§0 item 27 (1)). After T3: `review-code` on the new seams (contract binding, capture, `lib/brief.mjs`), `adversarial-auditor` (security-boundary slice) and the outside reviewer, a fresh `konzept-reviewer` instance with conflict of interest none, named in ledger 0021 before T1 starts. Counter-tests the auditor cannot execute under the CDP5 grant check are executed by the orchestrator with the raw output in the report (§0 item 27 (2)).

Run count (§0 item 26 condition 1): planned 3 implementers + 3 `review-verify` + `review-code` + `adversarial-auditor` + outside reviewer = 9; with the SL-1 fix rate the re-forecast (run 30) gives median 13, P90 17. Stage-1 count before SL-2: 31 of cap 52. After the first auditor result the orchestrator reports the running count against 13 and 17 before the next fix spawn. Checkpoint after SL-2: more than 42 cumulative runs → the owner decides before the live P1 run.

Before every spawn (§0 item 26 condition 4): the orchestrator checks the brief against the concept lines it cites (AC rows, the SL-2 row, the §5 file table rows of `S/verdicts/` and `hooks-fired.jsonl`, UC-12 steps) and records the check in the ledger row of the spawn.
