# review-verify of concept v0.5.23 (stage-1 run 77): final answer as handed back (summary, findings verbatim in substance)

Brief: `briefs/concept-v0523-rv.md`. contract: v2 f91736a60d15; fresh context: yes; conflict of interest: none.

Verdict: block on claim 3 only (one new sentence contradicts unchanged probe-session text); every other claim passes.

Target state: concept sha256 b9a818a2…1dff = draft; v0.5.22 copy ac2732db…21dd; build HEAD 1d04d1a14b89; 20 hunks, changed-line hash 65644e93… equal to the saved diff.

## Part A
| # | Verdict | Evidence |
|---|---|---|
| 1 items 1-16 carried | bestätigt | all 38 cited lines hold the named content; :896 and :908 share the scope "of the active run"; the 3b contradiction of run 74 is gone |
| 2 author deviations | bestätigt + ergänzt | `lib/hooks-observed.mjs:9`, `:24` (plugin version); SL-0 record `2.1.314.md:11`; :1325 marks the list as the author's; sandboxing.md:249, :1060 and permissions.md:551 match; gaps: the label string not marked as the author's choice; the nonce-first fact is at `hook-key.mjs:43`, not `:44` |
| 3 no contradiction, no new owner decision | widerlegt (contradiction); bestätigt (decision part) | :1640 unchanged "A-5 in `default`, `acceptEdits`, `auto` and `bypassPermissions`" with a settings file that "differs from the live one only in the `excludedCommands` path"; the new :1705 puts `disableBypassPermissionsMode "disable"` in the live file (settings-reference.md:1166) |
| 4 SL-2c briefable | bestätigt (enumeration error) | all 21 SL-2c ACs Unit, test file with titles, "built in SL-2c", red; none contradict; AC-14.6 belongs to SL-9 (not in row :1681) |

## Part B
20 hunks carry their items; hunk 12 (probe session :1640) contradicts hunk 14 (§11.3 item 3, T6); hunks 12 and 15 misattribute a doc fact (🟡-2).

## Findings
- 🔴 none.
- 🟡-1: the probe session cannot run A-5 in `bypassPermissions` under the live settings file; let the probe file leave out `disableBypassPermissionsMode` for that row (both sha256), or expect "refused at launch".
- 🟡-2: :1640, :1763, :1705 say that with `allowUnsandboxedCommands` false a command the sandbox cannot start is refused (sandboxing.md:240), but the same line needs `failIfUnavailable` as well (:1049-1058); name both keys and have preflight (e) print `failIfUnavailable`.
- 🟡-3: step 7 and :908 say "every shell call that writes" but AC-12.36 tests a closed list; `rm`, `touch`, `mkdir`, `node -e` write and are neither denied nor read-only; choose a closed denylist or a read-only allowlist.
- 🟢-1: ledger 08:21:13 shows `default` and no bubblewrap failure; the first evidence is 08:40:39; cite it and say the session was in `default`.
- 🟢-2: `hook-key.mjs:44` → `:43`.
- 🟢-3: for WebSearch "removes the tool" cite permissions.md:60.
- 🟢-4: claim 4 listed AC-14.6 (claim error, not a concept error).
