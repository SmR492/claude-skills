# review-verify of concept v0.5.22 (stage-1 run 74): final answer as handed back (summary, findings verbatim in substance)

Brief: `briefs/concept-v0522-rv.md`. contract: v2 f91736a60d15; fresh context: yes; conflict of interest: none.

Status: block on claim 3b only (a one-line wording fix clears it); everything else passes.

Target state: concept sha256 ac2732db…21dd; v0.5.21 copy 37ec3816…3e98; build HEAD 1d04d1a; diff 32 hunks, equal to a live `git diff --no-index` after the header lines; ledger decision row :310.

## Part A
| # | Verdict | Evidence |
|---|---|---|
| 1 decisions 1-11 carried, opposite lines changed or historical | bestätigt | §0 item 34 :43 = ledger:310; auto :1697; SubagentHandback with mode condition :527, :884, :891; `~/**/.env*` only in AC-14.9 fixture and §14 rows :2081, :2113; `Write(...)` only in §14 rows :2204, :2207, :2220 and old changelog; `probe --accept` "in SL-8" only as v0.4.2 history :1689 |
| 2 doc citations | bestätigt + ergänzt | tools-reference.md:53; hooks.md:743-746, :951-953, :1928, :1961-1966, :2009-2014, :2608, :2614; permissions.md:356-360; permission-modes.md:22, :26, :30, :335, :345-351, :356, :590, :595; settings-reference.md:150, :1040-1047, :1075, :1079-1083, :5556-5562; sandboxing.md:226, :240, :339, :618, :621, :639; settings.md:160, :212, :217. Inference only: `defaultMode` auto from `--settings` (:1922 says so); bubblewrap limit and cost per path (Q-18); `agent_id`/`agent_type` on PreToolUse SubagentHandback (A-23 checks it) |
| 3a SL-2c specified | bestätigt | slice row diff:276; AC-11.20/21, AC-12.33-35, AC-14.9-14.12; `missingRules` change :1317 matches `lib/user-settings.mjs:89`, `:95`; smoke step feasible (`check-handback.mjs:113` returns none without a run, `:149` writes the line) |
| 3b impl-uc brief from the text alone | widerlegt | UC-12 step 7: guard-phase denies "every Edit, Write and NotebookEdit call"; the new UC-12 error row: "every spawn, resume, phase-directory write, gate run and owner command is denied"; AC-12.34 tests only an Edit into `R/idea/` |
| 4 no new owner decision, open points Q-18 to Q-23 | bestätigt | |
| 5 SL-2c estimates | bestätigt | 510-880; ×11319/2650 = 2178-3759; ×3363/2650 = 647-1117; runs 7 × 1.7 ≈ 12 |

## Part B
32 hunks checked; all supported; hunk 11 step 7 against hunk 12 error row (3b). §14 rows and old changelog marked historical; `:836` still holds.

## Findings
- 🟡 F1 (3b): use step 7's wording ("every Edit, Write and NotebookEdit call of the active run") in the error row; add the test title "fires: edit outside phase directory after uncaptured finished agent".
- 🟡 F2: the security case (:1697) says `allowUnsandboxedCommands` false removes the unsandboxed retry (sandboxing.md:240), but in live run 1 an unsandboxed request reached the owner prompt (record :39; ledger:296); no probe row tests the retry in auto. Proposal: an A-12 `auto` case (a `dangerouslyDisableSandbox` request refused with no classifier prompt) in the probe session and §11.4; preflight (e) prints the key's value.
- 🟢 F3: AC-12.34 names about nine cases with three test titles; one title per case.
- 🟢 F4: "acts in every permission mode" (step 7) goes beyond the ledger's "a run in default"; add to Q-19 or Q-23.
- 🟢 F5: §13.1 "session only, no install record" is not at plugins-reference.md:30; "mid-session edit not applied" comes from A-21; cite each part to its source.
- 🟢 F6: the local copy is `plugins-components.md`.
- 🟢 F7: "only in auto mode" cites hooks.md:1928 too, which lacks "only"; cite tools-reference.md:53 alone.

Returned: the F2 premise (what settings-live.json contained) is outside the repository. Orchestrator check 2026-11-05: settings-live.json held `"allowUnsandboxedCommands": false` (keys read at 10:28:47).
