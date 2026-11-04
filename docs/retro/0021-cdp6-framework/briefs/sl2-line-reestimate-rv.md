# Brief: review-verify of concept v0.5.20, the stage-1 line measurement and the stage-2 line re-estimate (stage-1 worker run 70; cap set aside by §0 items 31 and 33)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02), the goal "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" and "Yes start it" (2026-11-04, on the orchestrator's offer to re-estimate the stage-2 line figures because the §11.3 stop row on lines fired; ledger 0021). §0 item 27: concept edits go into `review-verify`.

Output format (final answer, handback only, no file): after the acknowledgement line, the line `conflict of interest: none | <stake>`; part A: one verdict per claim below (bestätigt, widerlegt, unklar, nicht entscheidbar) with file:line or command evidence; part B: per hunk of `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0519-v0520.diff`, whether the measurement supports it and whether it contradicts an unchanged concept line; then the findings that should change the concept, ranked 🔴 🟡 🟢, each with one closing proposal; then status. At most 800 words.

Target state: concept v0.5.20 `<repo>/docs/cdp6/konzept-cdp6.md` (uncommitted, sha256 1887daa49c6f7531014fa33aa5aef7086c83e0b337d63f9bad938275bf53bdeb); diff `reports/concept-v0519-v0520.diff` (4 hunks); the measurement `reports/sl2-line-measure-workflow.json` (two independent measurements, a reconciliation with re-estimate and an adversarial verification; `<repo>` and `~` replace absolute paths); builds `plugins/cdp6-core` at commits 960146b and 1d04d1a (branch `feat/cdp6-sl2`, reachable from `<repo>`); CDP5 sources at 74d17c8. You wrote no part of it. `<repo>` = the repository root (main checkout).

Claims:
1. The figures in the new §11.2 paragraph (files, lines, copied, new or changed, with and without test files, for 960146b, 1d04d1a and SL-2 by difference) match the counting rule of §11.2 applied with the sources named in §1.3; check at least the two tree totals with `git diff --shortstat` cross-checks and four files by `git diff --no-index --numstat` (two with a CDP5 source, two without).
2. Every arithmetic step (ratio 11319 / 2650, each stage-2 bound, the totals, the alternatives 1.27, 5.20, 1.55, the churn lower bound 11958 / 11606) is correct as written.
3. The paragraph and Q-17 state as open what the concept text does not decide (the meaning of "the measured ratio", whether the §11.2 estimates include test files, the divisor), and claim nothing the measurement does not support.
4. No unchanged concept line is contradicted; name any line that now needs a note (for example "Copied lines: about 4433 (round-1 measurement: SL-2 1296 …)" and "Copied lines stay about 4433").

Tools: Read, Grep, Glob, Bash for read-only commands (`git -C <repo> show`, `git diff --shortstat`, `git diff --no-index --numstat` on files you extract with `git show <commit>:<path>` into a folder under /tmp/claude-1000/-mnt-c-Users-riedl-stefan/7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c/scratchpad/rv70/ if the shell guard allows it, grep, sed -n, cat -n, wc, sha256sum). No test runs, no writes in the repository, no network. The CDP5 shell guard refuses shell `for` loops, variable assignments, process substitution, backticks, redirections and some heredocs; use one command per call; where a check is refused, report it as `unklar` with the refused command.

Stop rule: one pass; at most 30 tool calls; a verdict without file:line or command evidence is reported as `unklar`.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
