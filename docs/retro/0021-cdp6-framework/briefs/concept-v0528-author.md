# Brief: concept v0.5.28, folding in review-verify run 87 (author run; stage-1 worker run 88)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, §0 item 34); "go always with your recommendation if they are reviewed" (2026-11-02); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04).

Input: concept v0.5.27 `<repo>/docs/cdp6/konzept-cdp6.md` (sha256 c028a14f61a1fd4d68dd2069a86a339817d22c437420eb78cfb4a4be375ed8c9); the review `<repo>/docs/retro/0021-cdp6-framework/reports/concept-v0527-rv.md` (🟡-1 to 🟡-5, 🟢-1 to 🟢-3, Part B); the frozen build `<repo>/.worktrees/sl2c-final/` (its `lib/shell-allowlist.mjs:25-36` tracks both quote kinds); docs `<repo>/.worktrees/sl2-review-inputs/docs-2026-11-05/` and `docs-2026-11-06/`.

Task: write v0.5.28 as a complete edited copy at `<repo>/.worktrees/sl2-review-inputs/konzept-v0528-draft.md`; do not edit the repository file. Carry each finding at every place it applies so that no unchanged line contradicts it; decider of each: the owner by the standing rule of 2026-11-02 on the reviewed findings (changelog entry):

1. 🟡-1: UC-12 step 7 defines the lexer of the stop allowlist: unquoted text, single-quoted text (literal), double-quoted text (literal, and holding no `$`, backtick or backslash, else the call is denied); a `'` inside `"…"` is literal; the command, flag and operand test applies to each word after quote removal, so a quoted flag counts as a flag; AC-12.36 adds the denied cases `cat "'" $(touch p) "'"`, `ls '-S'` and `grep ''--filt=x y f`, one test title each (the orchestrator confirmed on 2026-11-06 that bash runs the substitution of the first case).
2. 🟡-2: from SL-2c, `observe-stop.mjs` records a finished capture-bound agent of an active run that has no bound spawn as a stop in `counters.json` (through `lib/counters.mjs`), so the stop guard fires; AC-12.33 gets that fire case; Q-25 keeps only the same-message double-spawn residual; the record review of §11.3 item 3 also flags the `no-spawn` outcome (🟢-3).
3. 🟡-3: UC-12 step 3 and the TM2-5 clause say "from SL-3" where they depend on the resolver; until then the binding refuses when two unbound spawns of a role are pending (state the refusal and its test), consistent with step 2's bound-only exclusive rule.
4. 🟡-4: check (j) fails on `disableAllHooks` true in every scope, managed included, and on `allowManagedHooksOnly` true in managed settings (unless managed settings force-enable `cdp6-core`); fix the §13.1 row and AC-14.18 with the doc lines (settings-reference.md:3565, :3609).
5. 🟡-5: one definition of the counted paths, used by both the A-12 record columns and check (a) (all paths the profile entries expand to, glob and non-glob, plus `.git` entries, or another single definition you justify), with an AC-11.24 case holding non-glob entries and `.git` entries.
6. 🟢-1: `date` takes exactly one token from its list, no combination; the combined-short-flag rule applies to the other commands only.
7. 🟢-2: the SL-2c row's reading (b) upper bound 2030; the 2.65 ratio labelled reading (a).
8. Version 0.5.28, As-of clause, changelog entry.

Rules, checks and output as in `<repo>/docs/retro/0021-cdp6-framework/briefs/concept-v0522-author.md` (English, unchanged sentences byte-identical, citations, konzept-lint exit and last lines, hunk count against v0.5.27, per item the draft lines that carry it). At most 600 words. Write only the draft file and files under `<scratchpad>/v0528/`.
