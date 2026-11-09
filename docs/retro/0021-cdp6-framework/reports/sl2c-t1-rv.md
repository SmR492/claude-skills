# review-verify of SL-2c T1 and concept v0.5.24 (stage-1 run 79): final answer as handed back (summary; findings and counter-tests verbatim in substance)

Brief: `briefs/sl2c-t1-rv.md`. contract: v2 f91736a60d15; fresh context: yes; conflict of interest: none. Verdict: block (five sub-claims refuted at 🟡/🟢; no 🔴). The T1 build is real and does not let a hand-placed record through.

## Part A
| # | Verdict | Evidence |
|---|---|---|
| 1a items 1-7 built | bestätigt | run-argv `probe` owner form; guard-shell hashes `--accept`, denies when hashes≠1, reason carries rows; probe-check.mjs:64-93; probe-record.mjs:6, 23-24, 53-64; user-settings.mjs:89, 95; guard-shell passes env to the reader |
| 1b tests assert each AC | widerlegt (AC-11.23 label); rest bestätigt | probe-record.test.mjs has no literal label and no RECORD_LABEL import; :95 checks only determinism; a changed label passes the suite |
| 2 no hand-placed record reaches the gate | bestätigt + ergänzt | probe-record.mjs:57-59 needs the key and macOk; label and NUL prepended (:24); hook-token MAC has a nonce first (hook-key.mjs:43); gap: the probe-check.mjs:100-119 CLI signs and writes for any caller with the host key, no owner ask; only the key deny of §5.6 item 9 closes it |
| 3 mutations | bestätigt by reading | label change caught by no test (CT-1) |
| 4 no test weakened | bestätigt (run-argv.test.mjs unklar, tool budget) | removed or replaced assertions in run.test.mjs all justified by the AC change or the move to the real accept path; guard-shell `accepted:false` case became `handPlaced` (stronger) |
| 5 design choices | widerlegt for 1, 5 and the fixture of 6; 2, 3, 4 bestätigt | choice 1: probe-check.mjs:24 refuses the same row and mode twice, :23 limits A-5 verdicts; concept :1640 needs a second A-5 bypass row, a refused launch, A-12 auto under two files (CT-2); choice 5: :833 says each owner command writes a stamped owner record; choice 6: the fixture passes the team-probe gate (run.mjs:250-253) and A3 (run.mjs:415) (CT-3) |
| 6 Edit form | bestätigt | only `'Write'` removed at :89, :95 |
| 7 v0.5.24 hunks | bestätigt | 11 hunks carry run 77's findings |

## Findings
- 🟡-A AC-11.23 label not pinned (CT-1).
- 🟡-B the checker cannot hold the probe session's rows (CT-2): key rows by row, mode and settings sha256; a launch-refused verdict; or amend :1640.
- 🟡-C `probe --accept` writes no owner record (against :833): stamp `accepted.by` or write the owner record when a run is active.
- 🟢-A the team fixture opens A3 and the team-probe gate (CT-3): drop `'A-5'` from its rows.
- 🟢-B the probe-check CLI is a second writer path: remove `main`.
- 🟢-C AC titles and variants differ ("fires: probe row without mode" only as "…row A-5 without mode"; AC-11.13 "written before run.mjs init" and `<version>.md` not exercised).
- 🟢-D rows neither accepted nor team rows dropped silently: name them in `left_for_sl8`.
- 🟢-E the allowlist may not be read-only: `git diff/log/show --output`, `rg --pre` (unverified).

## Counter-tests, executed by the orchestrator in `.worktrees/sl2c-audit` (copy of the T1 tree, diff -r exit 0), 2026-11-06T09:27:06+01:00
- CT-1 `lib/probe-record-label.test.mjs`: green on T1; with `RECORD_LABEL` mutated to `cdp6-core probe-record v9`, `probe-record.test.mjs` 10 pass and CT-1 fails (pass 10, fail 1); label restored.
- CT-2 `checks/probe-check-session.test.mjs`: both red as predicted: `{"ok":false,"error":"row-duplicate","message":"row A-12 auto occurs twice"}` and `{"ok":false,"error":"row-verdict","message":"row A-5 bypassPermissions has a verdict outside prompt, no-prompt"}`.
- CT-3 appended to `scripts/run.test.mjs`: red as predicted (`set-autonomy A3` exits 0 with the signed team fixture: `actual: 0, expected: 0` for notEqual).
The three files are kept in `.worktrees/sl2c-audit/plugins/cdp6-core/` for the fix run.
