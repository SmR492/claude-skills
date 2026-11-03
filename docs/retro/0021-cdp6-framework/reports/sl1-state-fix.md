contract: v2 f91736a60d15

Status: all five items closed in the worktree `<repo>/.worktrees/sl1` (base 27e3326 plus the uncommitted SL-1 diff). cdp6 tests are 274 of 274 green (up from 272) and the CDP5 suite is 295 of 295 green. No commit, no push. I deleted the temporary `.orig` copies, which the mutation helper (kept in the scratchpad, outside the worktree) had made, and `find` shows none left.

| Id | Test (file: title) | Red | Green |
|---|---|---|---|
| 1 | `hooks/guard-phase.test.mjs`: "fires: pointer missing with active run", "fires: worktree cwd", "fires: nested repo cwd with pointer missing". Each now also asserts that an Edit of `S/run.json` is denied with /pointer/ (cwd in the project, in the linked worktree, in the nested repo). | Mutation: in `decide` of `hooks/guard-phase.mjs`, return `none` when the target starts with the data directory. Three assertion failures, `actual: 0, expected: 2`. Mutation reverted. | `guard-phase.test.mjs` 15 of 15 pass. |
| 2 | `scripts/run.test.mjs`: "fires: exit refuses a run record whose cycle is not a positive integer and touches no snapshot directory". Cycles `../../x`, 0, -1, 1.5 and '1'. A sentinel file in `S/snapshots/x` must survive, and the error must be `state-corrupt`. | With no check in the code: exit 0, expected 2 (`{"phase":"idea","state":"exited"}`). | The check at the top of `writeSnapshot` in `scripts/run.mjs` requires the phase to be in `PHASES` and the cycle to be a positive integer, before `rmSync` and `mkdirSync`. `run.test.mjs` 101 of 101 pass. |
| 3 | `scripts/run.test.mjs`: "fires: deny rules that cover only the four earlier samples of the data directory". The rules cover exactly hook-nonces.jsonl, active-runs.json, probes/** and runs/**, and `init` must exit 2 with the data-directory message. | With the old samples in `lib/user-settings.mjs`: `init` exits 0, expected 2. | The samples gain `hooks-fired.jsonl`, `grants.json` and `x/y/z.txt`. |
| 4 | `scripts/run.test.mjs`: "init records the R of a --root…", "after init, enter, exit and approve the project tree holds no file written by run.mjs", "every later subcommand reads and writes only the state directory: the lock and the journal lie in S". | Mutations: M1 `run_dir` ignores `--root` (actual `docs/cdp6/runs/…`, expected `docs/records/…`). M2 `init` writes `run-roots.json` (`actual true, expected false`). M3 `init` writes a stray file into the project (the walk shows `stray.txt`). M4 `exit` and M5 `approve` each write a stray project file (the deepEqual of written files fails). M6 lock path outside `S` (`actual 0, expected 2`). M7 journal path outside `S`: fails with `ENOENT … run.journal.jsonl` in `S`, which is a read error, not an assertion. | No test changed. Every mutation turned a test red. |
| 5 | `lib/input-file.test.mjs`: "fires: the read is bounded by the size checked at open and refuses a file that grew". It spies on `fs.readSync` through `mock.method` and `syncBuiltinESMExports`. It asserts that bytes taken are at most size + 1, that no single read asks for more than size + 1, that at least one read happened, and that the file-grew throw still occurs. | Mutation: `limit = 4 MiB + 1` in `readInput`. The failure message is "the reader took 4194304 bytes from a descriptor checked at 1". Reverted. | `input-file.test.mjs` 9 of 9 pass. |

Files changed, all under `plugins/cdp6-core/`:
- `scripts/run.mjs` (657 lines, +1)
- `lib/user-settings.mjs` (100 lines, one line extended)
- `scripts/run.test.mjs` (1597 lines, +2 tests)
- `hooks/guard-phase.test.mjs` (251 lines, +3 asserts)
- `lib/input-file.test.mjs` (155 lines, +13 lines)

All of `plugins/cdp6-core/` shows as untracked in git, so the diff is against the earlier SL-1 state.

Gates, run from the worktree on the final state:
1. cdp6 tests: exit 0, `ℹ tests 274`, `ℹ pass 274`.
2. CDP5 suite: exit 0, `ℹ tests 295`, `ℹ pass 295`, `ℹ fail 0`.
3. skill-lint: exit 0, last line "A finding is a reason to read the file; exit 0 is not a clearance."
4. secrets-scan: exit 0, "no cleartext secrets found."

Open questions and notes (nothing blocking):
- **Item 3, coverage:** the new test pins the nested sample `x/y/z.txt` only, since rules limited to the four old files plus runs/** fail on it alone. The `hooks-fired.jsonl` and `grants.json` samples are in the code but have no test of their own. The existing "state directory editable by Edit tool" test uses a rule set that includes grants.json but not `runs/**`.
- **Item 4, M7:** the test turns red only through `ENOENT` when it reads the journal in `S`. I did not change the test, because the failure is for the right reason. A prior `existsSync(join(S, 'run.journal.jsonl'))` assertion would make it a clean assertion red.
- **Item 1, scan mutation:** the mutation is in `decide`, not in the scan itself. A `cwd` inside the project already makes the scan deny through the project root, so the target-path part of the scan is covered only by the existing "edit of a file in R from a cwd outside the project" test.
- **Item 5, spy:** `/proc/self/io` is absent on this WSL2 kernel, so I used the `fs.readSync` spy. It relies on `fs` being the default export, so a namespace import throws.
