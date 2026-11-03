# Brief: adversarial-auditor of SL-1 (stage-1 worker run 18 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: the slice-end reviews of SL-1 run before one combined fix run; §11.3 item 4: `adversarial-auditor` on SL-1 as a security-boundary slice).

Output format (final answer, handback only, no file): verdict FREIGABE, FREIGABE-MIT-AUFLAGEN or SPERRE; audit protocol; per attack: the assumption attacked, the counter-test as complete `node:test` code (file name and title) with the result you expect and why, the code path with file:line, severity. At most 1500 words plus test code.

Target state: worktree `<repo>/.worktrees/sl1`, base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff in `plugins/cdp6-core/` (three `impl-uc` runs; reports in `<repo>/docs/retro/0021-cdp6-framework/reports/`). You wrote no part of it. All 193 tests are green; assume an error exists that the tests and the author's self-review share as a blind spot.

The boundary: the main session (a model) must not run an owner command of `run.mjs` (concept line 820) without the owner's permission prompt, must not forge, replay or reuse a `--hook-token`, must not read the host key, and must not move a run out of phase order. Code: `hooks/guard-shell.mjs`, `lib/run-argv.mjs`, `lib/hook-key.mjs`, the token, nonce and path checks of `scripts/run.mjs`, `hooks/guard-phase.mjs`, `lib/run-store.mjs` lookup, `lib/user-settings.mjs`, `hooks/hooks.json`. Concept v0.4.9 `<repo>/docs/cdp6/konzept-cdp6.md`: §1.4 items 2, 8, 10 (89-100), UC-09 step 1.4 (734), UC-10 (770-797), UC-11 steps 1 to 1.3 (820-823), §5.6 items 5, 9, 10 (1248-1253), CH-49, CH-50, AC-11.19.

Attack ideas (not a limit): a parser differential between `lib/run-argv.mjs` and the shell that runs the command (quoting, `$'…'`, line continuations, `;`, `&&`, `|`, here-strings, `env`/`command`/`exec`/`nohup` wrappers, PowerShell and Monitor forms); a routine form that reaches an owner subcommand; a token minted for one call accepted for another (MAC field boundaries, NUL joins, token count, hash order); nonce race between two parallel calls; a path argument through a symlink, `..`, a nested repository or a linked worktree reaching the host key or another run; a guard that exits 0 on a crash or a malformed input; the `hooks observed` writer letting a failure change a decision; `bypassPermissions` or a missing `permission_mode`.

Already known (do not report again): `run-store.mjs:258` passes an existing target file to `git -C`; `guard-phase.mjs:44` denies without a data directory even when no run exists; test gaps in `run.test.mjs` and `hook-key.test.mjs:25, :40, :42`; the concept has no recovery path for a missing pointer.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, cat -n, wc, git status). Disposable environment: none and no run grant, so you cannot execute: deliver each counter-test as code, mark it "not executed", and state the expected result with the code path that produces it. The next `impl-uc` run executes every counter-test you deliver and shows it red or reports it green. No writes, no network. The CDP5 shell guard refuses shell `for` loops and variable assignments; use one command per call.

Stop rule: at most 70 tool calls; an attack you cannot tie to a file:line is not reported as a finding.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
