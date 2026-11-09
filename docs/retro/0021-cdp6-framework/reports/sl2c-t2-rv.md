# review-verify of SL-2c T2 with the T1 fixes, and concept v0.5.25 (stage-1 run 81): final answer as handed back (summary; findings and counter-tests verbatim in substance)

Brief: `briefs/sl2c-t2-rv.md`. contract: v2 f91736a60d15; fresh context: yes; conflict of interest: none. Verdict: block (two claims refuted at 🟡; a suspected 🔴 decided by CT-A).

## Part A
| # | Verdict | Evidence |
|---|---|---|
| 1 A1-A7 | confirmed for A1, A2, A3, A5, A6, A7; refuted for A4 | CT-1, CT-2 identical to the audit copies; A4: `test-support/probe-fixture.mjs:57-58` strips `'A-5'` from every `signedRecord` call, so CT-3 asserts the fixture; no test checks the team fixture at `run.test.mjs:240` against A3 |
| 2 B1-B5 | confirmed, gap added | every AC title exists; MODES loops cover five modes; `counters.mjs:61-64` inside the lock; gap: step 7 says observe-stop finds the run by the `agent_id` binding, `observe-stop.mjs:14` uses session/cwd |
| 3 allowlist | unclear (tool), CT-A decides | `segments` treats `$` before quotes and `{ , }` as word characters (`shell-allowlist.mjs:30, 36-38, 46`); `flagsSafe` checks only words starting with `--` (:56) |
| 4 no test weakened | refuted for one hunk | removed CLI tests justified by A5, coverage kept at :149, :179; review-verify type changes keep assertions; weakening: `probe-fixture.mjs:57-58` A-5 strip empties CT-3 |
| 5 mutations | confirmed by reading | |
| 6a `refused` alias | 🟢 defect | concept :1640 names only `launch-refused`; `probe-check.mjs:10, 26, 59` accept `refused`; CT-2 :35 uses it |
| 6b CT-3 | confirmed | |
| 6c unreadable counters | refuted for Agent/Task (guard-spawn denies), confirmed for SendMessage, gap for shell | `stop-guard.mjs:84`; guard-shell.test asserts `rm f` passes with malformed counters |
| 6d git config | not decidable without a probe | |
| 6e `date -s` | confirmed | |
| 7 v0.5.25 hunks | confirmed | drift: lines 228, 879, 880, 1139, 1502, 1640, 1763 say `probe-check.mjs --accept`, a CLI A5 removed |

## Findings
- 🔴-1 (conditional on CT-A): bash expansion (`$'…'`, `$"…"`, `{a,b}`) hides `--output`, `--ext-diff`, `--textconv` from `flagsSafe`; with 🟡-1 the deny reason prints the counters path, so `git diff {--output=<path>,--stat}` could overwrite it (depends on the sandbox's write rules). Closing: return null on unquoted `{`/`}` and `$` before a quote; a step-7 sentence.
- 🟡-1: an unreadable `counters.json` lifts the stop for shell and SendMessage (guard-phase:102 fails closed for write tools); concept: an unreadable counters.json of an active run counts as a stop; `activeStop` returns a reason.
- 🟡-2: CT-3 vacuous through the fixture; revert `probe-fixture.mjs:57-58`; CT-3 drops `'A-5'` from its own rows, mirroring :240.
- 🟢-1 the `refused` alias: CT-2 :35 to `launch-refused`, drop `LAUNCH_ALIAS`.
- 🟢-2 `date -s`: allow `date` only with `-u`, `-R`, `-I*`, `--iso-8601*`, `--utc`, `+FORMAT`.
- 🟢-3 repository git config: drop `git` from the stop allowlist.
- 🟢-4 concept wording `probe-check.mjs --accept`.
- 🟢-5 observe-stop lookup: name (a)/(c) in the concept or look up by `agent_id`.
- 🟢-6 PowerShell: any backslash denies during the stop.

## Counter-tests, executed by the orchestrator in `.worktrees/sl2c-audit2` (copy of the T2 tree, diff -r exit 0), 2026-11-06T13:11:34+01:00
- CT-A `lib/shell-allowlist-expansion.test.mjs`: pass 0, fail 2. The positive control held (`git diff --output=<file>` wrote); "git diff $'--output=<…>/ansi-c.out' passes the allowlist and wrote <…>/ansi-c.out"; second test: `git diff $'--output=f'` read-only = true. 🔴-1 confirmed.
- `lib/probe-fixture-rows.test.mjs`: fail 1 (`probePassed(rec, 'A-5')` false): the fixture drops a row it is given.
- `lib/stop-guard-unreadable.test.mjs`: fail 1 (`activeStop` null on a malformed counters.json).
The files are kept in `.worktrees/sl2c-audit2/plugins/cdp6-core/lib/`.
