contract: v2 f91736a60d15

Status: all four items done test-first. Gate 1 is 250/250, exit 0 (baseline 240). Gate 2 is 295/295, exit 0. skill-lint and secrets-scan exit 0. No commit. Worktree <repo>/.worktrees/sl1, base 27e3326.

Each row is red on its own, in a batch of no more than one item. Red and green commands were `node --test <file>` (or `--test-name-pattern` for the run.test.mjs ones).

| id | test (file, title) | red | green |
|---|---|---|---|
| 1 | lib/input-file.test.mjs: auditor's counter-test "fires: a decoy named "(deleted)" does not pass for an unlinked hard link" (imports linkSync, unlinkSync added; assertions unchanged), plus "fires: stillSame refuses a descriptor whose link count is not 1" | Both fail: actual true, expected false. | 6/6 pass, exit 0. |
| 2 | scripts/run.test.mjs: "fires: intake above 1 MiB is refused before it is read", "fires: assignment above 1 MiB ...", "an intake of exactly 1 MiB is accepted" | The two fires tests fail: status actual 0, expected 2. The exact-1-MiB test passes before and after, as a boundary guard. | 3/3 pass. |
| 3 | scripts/run.test.mjs: "fires: own run root that is a symlink to a directory outside the project" and "fires: company run root that is a symlink to a directory outside the memory tree" | Both fail: status actual 0, expected 2. | run.test.mjs 90/90. Both tests also assert the outside directory stays empty. |
| 4 | lib/run-store.test.mjs: "project root: a linked worktree maps to its main checkout" (keeper), "fires: a repository whose commondir names another repository keeps its own top level", "fires: a worktree-looking .git file that the common directory does not name back keeps its own top level" | The commondir test returned the victim repo's top level (actual /tmp/cdp6-rs-repo-sJJz7k, expected /tmp/cdp6-rs-repo-lMsYFS). The fake-worktree test returned the victim (actual /tmp/cdp6-rs-repo-0iSWp8, expected /tmp/cdp6-rs-fake-KeBSqi/w1). | 21/21 pass. The AC-10.6 worktree test in the same file ("run lookup: by cwd prefix, a linked worktree maps ...") stays green. |

Changes:
- Item 1, lib/input-file.mjs: `same` now requires `!real.endsWith(' (deleted)')` and `sameIdentity(fd, real)`. `stillSame` in kernel mode requires an unchanged path, no ` (deleted)` suffix, `fstat(fd).nlink === 1` and matching identity.
- Item 2, lib/input-file.mjs and scripts/run.mjs: the handle carries `size` from `fstat`. `openChecked` takes a `maxBytes` argument, passed as 1 MiB for `--intake` and `--assignment` only. It checks the size before the key read and refuses with `file-too-large`.
- Item 3, scripts/run.mjs: `run-root-outside` is raised when `realOrResolved(runsBase)` is not within the allowed root. For `own` the allowed root is the real project root. For `company` it is the real home plus the literal `.claude/projects/<project>/memory/cdp6/runs`.
- Item 4, lib/run-store.mjs: `projectRootOf` now uses `git rev-parse --show-toplevel`. It maps to the main checkout only when `<top>/.git` is a file, its `gitdir:` is `<common>/worktrees/<name>` with common ending in `.git`, and `<admin>/gitdir` names that `.git` file back. A non-git directory still returns `resolve(cwd)`.

Files changed (final line counts; the whole plugin dir is untracked, so there is no per-file diffstat):
- plugins/cdp6-core/lib/input-file.mjs, 75 lines
- plugins/cdp6-core/lib/input-file.test.mjs, 96
- plugins/cdp6-core/lib/run-store.mjs, 374
- plugins/cdp6-core/lib/run-store.test.mjs, 302
- plugins/cdp6-core/scripts/run.mjs, 642
- plugins/cdp6-core/scripts/run.test.mjs, 1398

Gate commands:
1. The cdp6 `node --test` command: exit 0, tests 250, pass 250, fail 0.
2. The CDP5 `node --test` command: exit 0, tests 295, pass 295, fail 0.
3. skill-lint: exit 0. The last lines are the 🟢 informational X4 note on run.test.mjs line 185 (`https://example.test`) and "exit 0 is not a clearance".
4. secrets-scan: exit 0, "39 files, 0 findings, 0 unreadable (skipped)".

Choices between readings:
- Item 3, class `company`: I followed the brief literally, so the run root must be lexically `~/.claude/projects/<project>/memory/cdp6/runs` under the real home. A `.claude` directory that is itself a symlink elsewhere (dotfile setups) is still resolved, because the real home is the base. A symlink at `projects`, `memory`, `cdp6` or `runs` pointing outside is refused.
- Item 3, class `own` with `--root` outside the project: now refused as `run-root-outside`. The `company-run-in-repo` check runs first, so the existing company-in-repo test keeps its error code.
- Item 2: `--import` files are not size-limited, because the brief names only `--intake` and `--assignment`.
- Mutation controls: the first run of each new test was red for the stated reason. A separate mutation of the production code was not run.
- Test-running hook: the Bash guard blocked heredocs containing `git` tokens in run-store.test.mjs, so I added those tests with the Edit tool.

Open questions: none.

Follow-up notes (not changed):
- projectRootOf now returns the `--show-toplevel` of a sub-repository or submodule `cwd` instead of `resolve(cwd)`. I did not test that case separately.
- The out-of-scope `statSync`/`readFileSync` gap in hooks/guard-shell.mjs is untouched.
