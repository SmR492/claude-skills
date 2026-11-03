# Brief: review-verify of the SL-1 fix run and of concept v0.4.10 (stage-1 worker run 21 of cap 45)

Objective (owner, verbatim): "go always with your recommendation if they are reviewed" (2026-11-02; ledger 0021: one combined fix run after the slice-end reviews, then one review-verify).

Output format (final answer, handback only, no file): one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence as file:line or concept line; then the corrections still needed, each with file and change and severity (🔴 🟡 🟢); then status. At most 1500 words.

Target state:
- Code: worktree `<repo>/.worktrees/sl1` (base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff in `.claude-plugin/marketplace.json` and `plugins/cdp6-core/`). Author of every fix claim: the `impl-uc` worker of stage-1 run 20; its report is `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-fix.md`; its brief is `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-fix.md` (18 items and an appendix with three counter-tests).
- Concept: `<repo>/docs/cdp6/konzept-cdp6.md` v0.4.10 (uncommitted). Author of the v0.4.10 edits: the orchestrator; `git -C <repo> diff 6e1d64d -- docs/cdp6/konzept-cdp6.md` shows v0.4.9 and v0.4.10 together; the 0.4.10 changelog line lists the v0.4.10 part. You wrote no part of either.

Claims to verify:
1. Per item 1 to 18 of the fix brief: the change is in the code as the item states, and its test would fail without it (read the assertion against the code path; where the report names a mutation, check that the assertion catches it). For item 1 in particular: can any order of swaps (last component, an intermediate directory, between open and `realpathSync`, during `claude --version`) still make `run.mjs init` or `--import` read a file whose real path the rules refuse? Trace `lib/input-file.mjs` and `run.mjs` `openChecked` and its callers.
2. The three auditor counter-tests are present as delivered (the report names one rename, `secret` to `keyBytes`) and assert what the appendix states.
3. The worker's choices and open questions: each is consistent with concept v0.4.10; a contradiction is widerlegt with both lines. In particular the A-5 record shape (concept line with "lists the modes in which the labelled prompt appears"), the new journal op `exit:<phase>:settled`, a missing checker leaving the phase `entered` (UC-01 step 5.1 says `gate-pending`), and the worker's added wording on `SKILL.md:36` (a rule UC-01 does not state is widerlegt).
4. Concept v0.4.10 change review: each edit listed in the 0.4.10 changelog line closes the finding it names (sources: ledger 0021 rows of runs 16 to 19 in `<repo>/docs/retro/0021-cdp6-framework.ledger.md`), contradicts no other concept line, and the code of run 20 matches it. New AC rows AC-10.14 and AC-10.15 are in the AC table and in exactly one slice row each.
5. Scope: nothing outside `plugins/cdp6-core/` and `.claude-plugin/marketplace.json`; no comment in code; no new dependency; the out-of-scope items of the fix brief were not built.

Already checked by the orchestrator (do not repeat): the four gate commands exit 0 (230 of 230 cdp6 tests, 295 of 295 CDP5 tests, skill-lint, secrets-scan); `lib/input-file.mjs` opens with `O_NOFOLLOW`, compares device and inode and reads from the descriptor; `openChecked` applies the path rules to the descriptor's real path and `stillSame` re-checks every handle after `claude --version`.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc, cat -n, git diff, git status). Disposable environment: none; no test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops and variable assignments; use one command per call.

Stop rule: one pass over all claims; at most 90 tool calls; a claim you cannot decide without running code is "nicht entscheidbar" with the reason.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
