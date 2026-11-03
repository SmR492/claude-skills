contract: v2 f91736a60d15

Status: all six items done and every gate is green. Gate 1: 240 tests, 240 pass, exit 0 (baseline 230). Gate 2: 295/295, exit 0. Gate 3 (skill-lint): exit 0, only informational findings. Gate 4 (secrets-scan): exit 0, 0 findings. Nothing committed. Worktree: <repo>/.worktrees/sl1, base 27e33269c5e094e290ac38c1b114be6911e1bffa, plus the uncommitted SL-1 diff.

I showed each test red on its own, in a batch no larger than one item. All test files are under plugins/cdp6-core/.

| id | test file and title | red run (command, exit, failing assertion) | green |
|---|---|---|---|
| 1a | lib/input-file.test.mjs "fires: the checked path is the path of the descriptor, not a second lookup by name" | Run first as a one-test batch, it passed (the seam did not exist yet). I then added only the empty seam call `hooks.afterOpen?.()` to the old code. `node --test lib/input-file.test.mjs` then exited 1 on `handle.real`: actual `.../other/f.txt`, expected `.../real/f.txt`. | pass |
| 1a | same file, "fires: stillSame is not fooled by a name that resolves elsewhere after the open" | exit 1, `false !== true` | pass |
| 1a | same file, "fires: stillSame follows the descriptor and notices a rename of the file" | passes on the old code too; it is a regression guard, not a red test | pass |
| 1a | same file, "reports nlink of the opened file" | exit 1, `undefined !== 1` | pass |
| 1c | scripts/run.test.mjs "fires: intake hard link to host key" (AC-09.12 title) | exit 1, `0 !== 2` | pass; error `file-hard-link` |
| 1d | scripts/run.test.mjs "fires: intake that is a copy of the host key" | exit 1, `0 !== 2` | pass; error `file-holds-key`. It also asserts the key bytes are absent from stdout and stderr, and the assertion messages carry no key bytes. |
| 1b | scripts/run.test.mjs "fires: intake that is a FIFO does not block init" | The new code already passed it. I removed `O_NONBLOCK` as a named mutation and it went red after 8023 ms: `null !== 2` (killed by the 8 s timeout). I restored the line (grep count 1). | pass; exit 2 with an error starting `file-` |
| 2 | scripts/run.test.mjs "fires: checker missing" | exit 1, state actual `entered`, expected `gate-pending` | pass: state `gate-pending`, `gate.result` = `checker-missing`, `gate.passed` = false, journal holds `exit:idea:checker-missing` |
| 2 | scripts/run.test.mjs "exit for a phase without registered checkers is a missing checker" | Existing test; the new code made it fail, and I changed its assertion (see choices). | pass |
| 3 | scripts/run.test.mjs "fires: init refuses the home directory and its ancestors as project root" | It already existed and already asserted `project-root-home` for both the home and the ancestor root. Named mutation: renamed the error to `project-root-x` in run.mjs. It then went red: actual `project-root-x`, expected `project-root-home`. I restored run.mjs. | pass |
| 4 | scripts/run.test.mjs "fires: exit idea through a plugin copy under a path with a space gets the checkers real result" and "fires: the checkers started through a symlink and through a space path report their findings" | exit 1, `0 !== 1` in both (the silent exit 0) | pass |
| 5 | checks/idea-skill.test.mjs "fires: the ban clause states only what UC-01 step 4.1 states, and step 5.2 states the verdict (c) rule" | exit 1, no match for `/refuses it\)/` on the old line 36 | pass |
| 6 | no test; the item is an import removal | `grep -n nextAction scripts/run.mjs` now finds nothing | the module loads and gate 1 is green |

The 1a-1e tests are red for the reason the brief states: the name lookup and the descriptor disagree, and the new behaviours are absent.

Files changed (all inside plugins/cdp6-core/, all uncommitted; the whole plugin directory is untracked, so git shows no per-file line counts):
- lib/input-file.mjs: 71 lines.
- lib/input-file.test.mjs: 66 lines, new.
- scripts/run.mjs: `openChecked` hard-link and key-content checks, the early checker-missing write, `nextAction` import removed.
- scripts/run.test.mjs: new tests for items 1, 2 and 4, new `timeout` option on `call`, new `linkSync` and `copyFileSync` imports.
- checks/idea-check.mjs and checks/decision-check.mjs: the import of `isMainModule` and the entry line changed.
- skills/idea/SKILL.md: lines 36 and 39.
- checks/idea-skill.test.mjs: one new test.
- .claude-plugin/marketplace.json is unchanged by me (the 6-line SL-1 diff from before).

Changes to production code:
- `openInput` opens with `O_RDONLY | O_NOFOLLOW | O_NONBLOCK`.
- On Linux the checked path is `realpathSync('/proc/self/fd/<fd>')`, and `stillSame` compares the same descriptor path to `handle.real`. A deleted or renamed file therefore reads as changed.
- Without `/proc/self/fd`, the name lookup with the device and inode comparison stays (v0.4.11 residual).
- The handle carries `nlink` and caches its content, so the key check and the later read share one read from the descriptor.
- `openChecked` refuses `nlink > 1` as `file-hard-link`.
- `openChecked` refuses content containing the key bytes as `file-holds-key`, with the key read by `readHostKey(ctx.env)`.
- The test seam is `openInput(path, { afterOpen })`. Production passes no hooks.

Choices between readings:
- Item 2, concept lines 271, 283 and 1230: both a missing file and an empty registry for the phase now write `gate-pending` with `gate = {passed:false, result:'checker-missing', checkers:[]}` under the journal label `exit:<phase>:checker-missing`, then exit 2.
  - I changed the assertion of "exit for a phase without registered checkers…" to match. The brief names only `idea-check`, but the phase-without-checker case uses the same error code and I treated it the same way.
  - A re-exit after repair still works, because `gate-pending` is allowed, and `approve` refuses because `gate.passed` is false.
- Item 4: `run.mjs` always spawns checkers by their real path. A symlink is therefore tested by starting the checkers directly through the link. The space-path failure is reproduced through `run.mjs exit idea`.
- Item 5: line 36 now ends "(not built in this release: `run.mjs` refuses it)." and the "once built…" clause is gone too, since it follows "refuses it". Step 5.2 follows concept line 272.

Open questions: none blocking.

Follow-up notes (not changed, out of scope):
1. A `checker-error` leaves the phase `gate-pending` without a gate result. Concept row 283 names `checker-missing` or `checker-error` as the gate result.
2. Other `lib/` or hook entry lines of the form `import.meta.url === file://${argv[1]}` were not searched.
3. The FIFO test takes about 8 s only when it is red; green it is about 60 ms.
4. The concept names the intermediate-directory swap as a residual only where `/proc/self/fd` is missing. That path has no test, because the host is Linux.
