# Brief: review-verify of the SL-1 state-directory build and of concept v0.5.1 (stage-1 worker run 28 of cap 45)

Objective (owner, verbatim): "go with your recommendation -> Option 1" (2026-11-03; concept §0 item 25).

Output format (final answer, handback only, no file): one verdict per claim (bestätigt, widerlegt, unklar, nicht entscheidbar) with evidence as file:line or concept line; then the corrections still needed, each with file or concept line, change and severity (🔴 🟡 🟢); then status. At most 1500 words.

Target state:
- Code: worktree `<repo>/.worktrees/sl1` (base 27e33269c5e094e290ac38c1b114be6911e1bffa, uncommitted SL-1 diff in `plugins/cdp6-core/` and `.claude-plugin/marketplace.json`). Author of every build claim: the `impl-uc` worker of run 27; brief `<repo>/docs/retro/0021-cdp6-framework/briefs/sl1-state.md`, report `<repo>/docs/retro/0021-cdp6-framework/reports/sl1-state.md`.
- Concept: `<repo>/docs/cdp6/konzept-cdp6.md` v0.5.1 (author of the v0.5.0 and v0.5.1 edits: the orchestrator). The v0.5.0 text is `<scratchpad>/konzept-v050.md`, the v0.4.12 text `…/scratchpad/konzept-v0412.md` in the same directory. The v0.5.0 change review (run 26) and its gaps G1 to G14 are summarised in the ledger row "v0.5.0 change review" of `<repo>/docs/retro/0021-cdp6-framework.ledger.md`. You wrote no part of either.

Claims to verify:
1. Items 1 to 10 of the build brief are in the code as stated and their tests would fail without them. In particular: no code path of `scripts/run.mjs`, `lib/run-store.mjs` or a hook writes into the project or `R` (trace every write call); every read of a project or `R` file by `run.mjs`, a hook or a checker goes through `lib/input-file.mjs`; the checkers judge only the snapshot and `S`; the gate result records path and sha256 per snapshot artefact.
2. The tests the worker changed because they followed the old layout (report section "Tests changed …") still assert what their AC row states; a removed or weakened assertion that an AC row still requires is widerlegt with the row.
3. The worker's choices and open questions against v0.5.1: `run.mjs enter` creates no phase directory; `approve` re-reads `R` through the reader and refuses drift; the snapshot is taken before `gate-pending`; open question 1 (no data directory → `guard-phase.mjs` gives no decision; concept §1.4 item 2 limits main-session decisions to sessions with an active run); open question 3 (no store left for "run roots of the project's earlier runs", UC-09 step 1.4).
4. Concept v0.5.1: each of G1 to G14 is closed by the text the 0.5.1 changelog line names, contradicts no other line, and matches the code where SL-1 builds it (G3, G4, G5, G7, G9, G10, G13 parts). Name any line that still has `run.mjs` or a hook writing into the project or `R`.
5. Scope: nothing outside `plugins/cdp6-core/` and `.claude-plugin/marketplace.json`; no comment in code; no new dependency; out-of-scope items not built.

Already checked by the orchestrator (do not repeat): the four gate commands exit 0 (272 of 272 cdp6 tests, 295 of 295 CDP5 tests, skill-lint, secrets-scan); the write calls in `run.mjs` and `run-store.mjs` (`initRun(S, …)`, `writeSnapshot` under `S/snapshots/`, the `S/idea/*`, ledger and counters writes); the audit counter-tests of run 25 executed against the new code in `.worktrees/sl1-audit` on 2026-11-03: A (run-root swap, 25 s) green, B (company under a symlinked `~/.claude`) green, C (`core.worktree`) green, D now refused with `file-grew` instead of returning bytes.

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc, cat -n, git diff, git status, `diff` of the concept files). Disposable environment: none; no test runs, no writes, no network. The CDP5 shell guard refuses shell `for` loops and variable assignments; use one command per call.

Stop rule: one pass over all claims; at most 90 tool calls; a claim you cannot decide without running code is "nicht entscheidbar" with the reason.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
