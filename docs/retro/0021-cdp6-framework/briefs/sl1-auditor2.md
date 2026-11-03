# Brief: adversarial-auditor of the SL-1 file-input boundary after fix 2 (stage-1 worker run 23 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: after fix run 22 the file-input boundary is audited with executed counter-tests, because the open defect was a security race).

Output format (final answer, handback only, no file): verdict FREIGABE, FREIGABE-MIT-AUFLAGEN or SPERRE; audit protocol; per attack: the assumption attacked, the counter-test (file and title), the command you ran with its exit and the decisive output line, the code path with file:line, severity; then a short check of fix items 2 to 6. At most 1500 words plus test code for every red counter-test.

Target state: disposable worktree `<repo>/.worktrees/sl1-audit` (base 27e33269c5e094e290ac38c1b114be6911e1bffa plus an exact copy of the uncommitted SL-1 state of `.worktrees/sl1`, `diff -r` exit 0, 240 of 240 cdp6 tests green, made by the orchestrator 2026-11-03). You wrote no part of it. Authors: three `impl-uc` T-runs and two fix runs; the last fix brief is `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-fix2.md`, its report `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-fix2.md`.

The boundary: `scripts/run.mjs` runs unsandboxed. The main session (a model) can run sandboxed shell commands in the background that create, rename and swap files, directories, symlinks, hard links and FIFOs inside the project, and it can start `run.mjs init` with `--intake`, `--assignment` and `--import` (each call behind the routine `ask` in SL-1). It must not get `run.mjs` to copy into the run directory the bytes of a file whose path the rules refuse: the host key `~/.config/cdp6-core/hook.key`, the secret patterns, or any file outside the project root (concept v0.4.11 `<repo>/docs/cdp6/konzept-cdp6.md`, UC-09 step 1.4 at the line beginning `   1.4 Path arguments`, UC-11 step 1.3). Code: `plugins/cdp6-core/lib/input-file.mjs`, `scripts/run.mjs` `openChecked`, `checkPath` and their callers in `cmdInit`, `lib/paths.mjs`.

Attack ideas (not a limit): the A-B-A swap of an intermediate directory around `open`, around the descriptor-path lookup and around `stillSame` (note that `realpathSync('/proc/self/fd/N')` reads the link and then walks the result by name); a file deleted or renamed after the open (`/proc` reports a `(deleted)` suffix); a hard link created after the `nlink` check; a key copy split across `--intake` and `--assignment`, or encoded so the byte search misses it, then joined by the run files; a FIFO, a device file, `/proc/self/...` paths, or a symlink as the project root or as `R`; `--import` of a file and of a commit-looking value; an argument that is a directory; a very large file.

Run grant: adversarial-auditor may run in the worktree above until 2026-11-03T09:49:10Z, 1 use, session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c. Inside it you may write test files and run `node --test` and node scripts; use a temporary HOME and temporary directories, never the real home directory or the real host key. Every race test must be deterministic (use the `afterOpen` seam of `openInput`, a fake `claude` on PATH, or a background process with a bounded loop), and must finish within 30 s.

Already known (do not report again): the intermediate-directory residual on platforms without `/proc/self/fd` (concept v0.4.11, decided); a `checker-error` leaves no gate result (follow-up); the deferred refactor items (split of `run.mjs`, lock lib, nonce pruning).

Tools: Read, Grep, Glob, Bash. Disposable environment: the worktree above only; no network; no writes outside it except temporary directories. The CDP5 shell guard refuses shell `for` loops and variable assignments; use node scripts.

Stop rule: at most 80 tool calls; an attack you cannot tie to a file:line or an executed test is not reported as a finding.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
