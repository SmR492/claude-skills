contract: v2 f91736a60d15

**Status:** all ten items are implemented test-first in `<repo>/.worktrees/sl1` (base 27e3326, nothing committed). Gate 1 passes 272/272 (exit 0) and gate 2 passes 295/295 (exit 0). Gates 3 and 4 exit 0. There is no coverage command in the brief's gates, so I ran none.

**How the red runs were made.** The worktree's diff is uncommitted and untracked, so no baseline exists in git. For red runs on old code I copied the read-only `sl1-audit/plugins/cdp6-core` tree into the scratchpad (`.../scratchpad/base/cdp6-core`), put the new test files into it and ran them there. Where the old-code red was only a helper `TypeError` (the old pointer has no `run_id`), I also proved the test can fail by mutating the new code and restoring it. Mutations are marked "mutation" below. I did items 2 and 3 before item 1, because `init` and every later subcommand need the pointer and the lookup.

**Per item (commands: `node --test <file> --test-name-pattern=…` from the worktree)**

| id | test file: title | red | green |
|---|---|---|---|
| 2 | `lib/run-store.test.mjs`: "pointer: active-runs.json maps the session id and the project root to the run id, S follows from the run id and R from run.json" | exit 1. `AssertionError: undefined !== 'RUN-20260101-p'` (the old pointer holds no `run_id`) | 26/26 in the file |
| 3 | `lib/run-store.test.mjs`: five scan tests, e.g. "fires: missing pointer scan reads the state directories for an active run of the project", "…skips an entry without run.json and denies an unreadable run.json". `hooks/guard-phase.test.mjs`: "fires: nested repo cwd with pointer missing" (new, AC-10.6) | lib file: 5 failed, e.g. expected `['pointer-missing', <S>, <R>]`, got `undefined`; the old scan read the project run roots. Guard test, mutation (removed the prefix rule of the scan): 4 failed, including the nested-repo test | lib 26/26; guard-phase 15/15 |
| 4 | `lib/run-store.test.mjs`: "fires: core.worktree of a nested repository does not move the project root outside the working directory" (AUDIT-C), "project root: a top level that contains the working directory is accepted" | exit 1. Got `<tmp>/outside`, expected `<tmp>/proj/sub` | green |
| 5 | `lib/input-file.test.mjs`: "fires: the read is bounded by the size checked at open and refuses a file that grew" (AUDIT-D), "readProjectFile returns…" and a shrink case. `lib/run-store.test.mjs`: ".git file that is a symbolic link is not read". `hooks/guard-shell.test.mjs`: "fires: an --import that is a symbolic link is not hashed through the link" | input-file: `Missing expected exception`, and `readProjectFile` returned `undefined` from an empty scaffold I added so the first run was not an import error. run-store: got `<repo>`, expected `<wt>`. guard-shell: a hash was listed for the link | green |
| 1 | `scripts/run.test.mjs`: "init creates the state directory with run.json, journal, ledger, counters and the copies, records R and prints it, and creates nothing in the project"; "after init, enter, exit and approve the project tree holds no file written by run.mjs"; "every later subcommand reads and writes only the state directory: the lock and the journal lie in S"; "init records the R of a --root in run.json and keeps no run-roots.json" | First test on old code: `deepStrictEqual` of the project tree. Old init wrote `docs/cdp6/runs/RUN-…/{run.json,ledger.md,counters.json,idea/*,…}`. The other three on old code failed with `run-root-outside`, a settings refusal or the helper `TypeError`; I did not get a clean assertion red for them | 99/99 in the file |
| 6 | `scripts/run.test.mjs`: "exit idea reads the artefact once through the reader into the snapshot and records its path and sha256 in the gate result"; "fires: the checkers run on the snapshot and on S, never on R"; "fires: a checker that rewrites idea.md in R after the read cannot change what the recorded hash names"; "fires: an artefact that is a symbolic link or has two hard links is refused at exit and the phase stays entered"; "exit idea gates a missing idea.md through the checker and records no artefact". `checks/idea-check.test.mjs`: 8 tests moved to `--snapshot`, plus "reads idea.md from the snapshot and never from a file beside run.json" | idea-check: 6 failed (`idea/idea.md is missing`). Run tests, mutation (checkers get `R`, hashes re-read after the checkers): the argv test and the rewrite test failed on the argv and on the sha256. Mutation (snapshot written empty, every refusal swallowed): the snapshot test and the symlink test failed | green |
| 7 | `scripts/run.test.mjs`: "fires: state directory editable by Edit tool" (rules on `hook-nonces.jsonl`, `active-runs.json`, `probes/**`, `grants.json` but not `runs/`), "the init check asks for no deny rule on the run files of the project or of the memory directory"; the other four AC-09.15 titles kept | Old code: `init` exit 2, "the user settings lack: Edit deny rule on run.json; … counters.json; … verdicts/", and the narrow rule set was accepted | green |
| 8 | `scripts/run.test.mjs`: "a run root swapped between a symlink to an outside directory and nothing while init runs leaves the outside directory empty" (stops at 50 attempts or 25 s) | Old code: `outside` held `RUN-20261103-intake` after 6 tries | green in about 2.7 s for 50 tries |
| 9 | `scripts/run.test.mjs`: "init --class company succeeds under a symlinked ~/.claude" | Old code: exit 2 `run-root-outside` | green |
| 10 | `hooks/bootstrap.test.mjs`: "prints run status after compact" now asserts the ledger path in `S` and no `R`. `hooks/guard-phase.test.mjs` fixtures moved to `S`. `checks/idea-skill.test.mjs`: three new tests | bootstrap printed `…/docs/cdp6/runs/…/ledger.md`. Skill: `Create \`R\` at the path` line missing, `S/idea/intake.md` missing, `S is the state directory` missing | green |

**Tests changed because their assertion followed the old layout**
- `scripts/run.test.mjs`
  - Helpers: `stateDir(w)` is the new `S`, `runDir(w)` reads `run_dir` from `S/run.json`, `walk()` is new. In the existing tests `R` was renamed to `S` where it meant the run record.
  - `readyToExit` writes `idea.md` into `R` and the verdict index into `S/verdicts`; the test creates `R` itself.
  - "fires: company repo path" and "fires: unnamed record place" assert `R` through `runDir`.
  - "fires: guard not observed" now asserts `enter` creates no `R`.
  - "exit idea at A1…": the artefact list is only `idea/idea.md`; `idea/assignment.md` is no longer an artefact.
  - Two checker tests pass `--snapshot`.
  - "A3 init refuses…" counts `<data>/runs`.
  - The two run-root symlink tests were renamed "…receives no file from init". They now expect exit 0 and an empty outside directory instead of `run-root-outside`.
  - The run-roots test was rewritten (see item 1). The settings fixture lost its run-file rules; "fires: run files editable by Edit tool" and "fires: journal writable by Write tool" were removed.
- `lib/run-store.test.mjs`: lookup tests use `runId`, `S`, `R`. The `listRunRoots`/`recordRunRoot` test and the company/recorded-root scan test were replaced by the state-directory scan tests.
- `hooks/guard-phase.test.mjs`
  - Edit targets are `R/idea/idea.md` instead of `R/run.json`, because `S` is not under the project or `R`.
  - "fires: unknown data directory with an active run in the default run roots" and "unknown data directory without an active run gives no decision" were merged into "an unknown data directory gives no decision because no state directory can be read" (open question 1).
- `hooks/guard-shell.test.mjs`: the `bind` helper writes the new pointer and an `S`.
- `hooks/bootstrap.test.mjs`: the fixture and the ledger assertion.
- `checks/idea-check.test.mjs`: fixtures split into `S` and a snapshot directory.
- AUDIT-D: I assert `assert.throws(code 'file-grew')` where the audit asserts `length <= size`. A refusing reader cannot return a value, so the audit assertion would fail by exception.

**Files** (line counts from `git diff --no-index --stat ../sl1-audit/plugins/cdp6-core plugins/cdp6-core`: 19 files, +781/−499, which includes removing the AUDIT tests that only the audit tree has)
- Changed:
  - `lib/run-store.mjs` (+157/−…, net about 160 changed)
    - `stateDirOf`, `bindSession` with `runId`.
    - `findRun` returns `{S, R, run}`; the scan is `scanStates`; `projectRootOf` checks that the top level contains `cwd`.
    - `listRunRoots`, `recordRunRoot` and `run-roots.json` are removed.
  - `lib/input-file.mjs`: bounded `readInput`, `InputError`, `readProjectFile`.
  - `lib/user-settings.mjs`: run-file rules removed; the `runs/RUN-x/run.json` sample added to the data-directory samples.
  - `lib/phases.mjs`: `statusText(S, …)`.
  - `scripts/run.mjs`: everything from the items above.
  - `hooks/guard-phase.mjs`, `hooks/bootstrap.mjs`, `hooks/guard-shell.mjs`: new lookup signature; the `--import` hash uses the reader.
  - `checks/idea-check.mjs`: needs `--snapshot`; `checks/decision-check.mjs`: usage text only.
  - `skills/idea/SKILL.md`: 13 lines changed.
- Created: none. Removed: none (only the functions and files named above).
- Test files: the nine named in the table.
- Not touched: `.claude-plugin/marketplace.json` still shows its earlier uncommitted change, which is not mine. Nothing outside `plugins/cdp6-core/`.

**Gate commands (from the worktree)**
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`. Exit 0. Last lines: `ℹ tests 272 / ℹ pass 272 / ℹ fail 0 / ℹ duration_ms 29692`.
2. CDP5 command from the brief. Exit 0. Last lines: `ℹ tests 295 / ℹ pass 295 / ℹ fail 0`.
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`. Exit 0. It printed only the informational lines for `scripts/run.test.mjs` (id_rsa, example.test URL) and "A finding is a reason to read the file; exit 0 is not a clearance."
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`. Exit 0: `39 files, 0 findings, 0 unreadable`.

**Choices between readings, with the concept line followed**
- **Artefact list for the idea phase:** only `idea/idea.md`, per UC-01's artefacts row (`S/idea/*` are in `S`, not artefacts of `R`). Missing file: no artefact, and `idea-check` reports `idea/idea.md is missing`.
- **Fields in `run.json`:** `run_dir` (R) and `root` (project root). The pointer holds only run ids. `init` prints `{run_id, S, R, status}`; the brief said it prints `R`, and `S` is added.
- **`run.mjs enter` no longer creates phase directories** in `R` (§0 item 25, UC-09 1.4: `run.mjs` writes nothing into the project).
- **Snapshot:** one directory per cycle `S/snapshots/idea/cycle-<c>/`, removed and rewritten on each `exit`. It is taken before the `gate-pending` update, so a refused artefact (symlink, hard link, path rule, over 16 MiB) leaves the phase `entered`. Checkers are called with `--run-dir S --snapshot <dir>`. The gate record holds `artefacts` also on a failed gate (§5.2 "input path and sha256 per artefact of the snapshot").
- **`approve` still refuses drift:** it re-reads the artefacts of `R` through the reader and compares the hashes with the gate record. UC-09 1.4 does not mention `approve`, so I kept today's refusal and only changed the read path.
- **Path rules for artefacts at exit:** roots `[run.root, R]`, and for class `company` also `realOrResolved(R)`.
- **Pointer lookup (c):** a project entry whose project root does not match is loaded to compare `run_dir`. A missing `run.json` there is skipped, as in the scan; an unreadable one returns an error.

**Open questions**
1. 🟡 With `CLAUDE_PLUGIN_DATA` unset or relative, `guard-phase.mjs` now gives no decision. It used to deny when the project's run roots held an active `run.json`; with the state in `<data>` the hook can find nothing without the data directory. UC-10 and §1.4 item 2 do not say what the hook does then. Deny in every project, or accept the silence?
2. 🟡 In the pointer lookup, an unreadable `run.json` of another project's entry denies (fail closed, as in the scan). §1.4 item 2 (c) names no such case.
3. 🟢 An `--import` from a previous run's `R` under a `--root` outside the project root is now refused by the path rule. The concept's "run roots of the project's earlier runs" (UC-09 1.4) has no store left now that `run-roots.json` is gone.
4. 🟢 A lookup by target path matches `R` and the project root, not `S`. Editing `S/run.json` is covered by the `<data>/**` deny rules (AC-09.15) and by SL-4 `guard-files`, not by this lookup.
5. 🟢 Follow-up for later slices: `gate.artefacts` and `phases.<p>.artefacts` hold `{path, sha256}` without the snapshot path; add it when a consumer needs it.

Scratch files are in the scratchpad only (`.../scratchpad/base` copy and patch scripts); no throwaway prototype is in the worktree.
