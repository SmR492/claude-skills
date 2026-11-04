# SL-2 fourth fix (impl-uc, stage-1 run 51): final answer as handed back

Brief: `briefs/sl2-fix4.md`. Worktree `<repo>/.worktrees/sl2`. Copied from the handback; paths normalised. All paths below are under `plugins/cdp6-core/`.

contract: v2 f91736a60d15

Status: all five items are done and all four gate commands exit 0. Nothing is committed. All changes are under plugins/cdp6-core/. skills/worker-contract/ was not touched; it shows `??` because it was untracked before this run. No shell command named generate-contract.mjs.

Method note: red runs are `node --test <file>` filtered to failing titles plus the first assertion message; full output not kept.

**Item 1 (id rule, verdict-check.mjs)**
- Red, batch of item 1, `node --test plugins/cdp6-core/checks/verdict-check.test.mjs`: exit 1, 6 failing, 34 passing: rv 🟡-1 ` -- unchecked: {"validator":"valid",...}`; rv 🟢-3 `{"validator":"valid","reasons":[],"verdict":"a","objections":[],"premises":["D-1-...:premise-1"]...}`; the F1 replacement ``A further `objection`: F-P1-2 ...: {"validator":"valid",...}``; the F4 replacement `{"validator":"rejected","reasons":["line 10 contains an objection marker but is not an \"objection: ...`; the two changed old tests failed on the old reason texts (example: `plural line with an id: line 10 contains an objection marker but is not an "objection: F-P<k>-<n> | ..." line at the start of the line`).
- Green: the file 40 pass, 0 fail; checks/ 105/105 before the later items.
- Code: Cf characters removed first; an objection id `F-P[1-8]-\d+` on any line that is not a well-formed `objection:` line rejects, with a message naming the line and id; a premise mark outside the premises block rejects, including inside an objection line; `OBJECTION_LIKE` and `OBJECTION_MARKER` gone; new export `OBJECTION_ID_ANYWHERE` in `lib/verdict-index.mjs`, because `lib/verdict-index.test.mjs:85` forbids an id pattern copy elsewhere (that test turned red once and is green again, unchanged).
- Changed assertions in `checks/verdict-check.test.mjs`: test "a line that starts like an objection ...": needle `/starts like an objection/` became `/objection id F-P1-1 outside/`; `'Objection to the premise: it does not hold'` left the reject list and a new assertion says it is valid prose; the final `fine` regex became `/objection id|outside the premises/`. Test "an objection marker anywhere in a line ...": the four prose-spelling rejects became four rejects that carry `F-P1-2`, plus a bare-id sentence; a new loop asserts the four prose spellings without an id are `valid`.
- Appended: rv 🟡-1 and 🟢-3 unchanged; F1 replacement (three lines with `F-P1-2` reject, the same lines without an id are valid and keep objections `['F-P1-1']`); F4 replacement (the verbatim assignment quote containing "objections:" passes).

**Item 2 (role file, agents/devils-advocate.md)**
- Red, `node --test plugins/cdp6-core/checks/devils-advocate-agent.test.mjs`: exit 1, 2 failing, 7 passing: rv 🟡-2 (unchanged) `the objection-marker rule is not stated`; own second test `the second verdict rule is not stated`.
- Green: 9 pass. The Output paragraph states all five causes: an objection id anywhere except a well-formed `objection:` line, a premise mark outside `premises:` or inside an objection line, a second `verdict:` line, `fresh context: no` invalidating the pass, and that other prose carries no objection.

**Item 3 (superseded)**
- Red, `node --test plugins/cdp6-core/checks/decision-check.test.mjs plugins/cdp6-core/lib/run-argv.test.mjs`: exit 1, 4 failing, 41 passing: audit F2 gate test `decision-check OK`; own superseded test (live b or conflicted capture needs owner records; recorded, stale or passing captures do not) `decision-check OK`; own proposed-finding text test `The input was expected to not match the regular expression /superseded/`; audit F2 `ownerForm` test `Expected values to be strictly equal` (false !== true).
- Green: both files pass (199 including `run.test.mjs` and `guard-shell.test.mjs`).
- Code: `ownerForm` returns true for `superseded`; `decision-check.mjs` gained `conflictFindings`, `blockFindings` and `settleSuperseded`; the still-proposed finding now reads "the exit needs it decided".

**Item 4 (later pass)**
- Red, `node --test plugins/cdp6-core/checks/decision-check.test.mjs`: exit 1, 2 failing: audit F3 (unchanged) `decision-check OK`; own test `The input did not match the regular expression /F-P1-1/`.
- Green: 33 pass. In `settle`, every live non-rejected b or c capture before `decided` other than the latest now needs its records. The own test covers a later not-decidable capture, a later pass, records given, a stale block, and a not-decidable earlier capture answered by a later round.

**Item 5 (missing counters.json)**
- Red, `node --test plugins/cdp6-core/hooks/guard-phase.test.mjs`: exit 1, 1 failing, 19 passing: the changed test "a missing or malformed counters.json denies the write tools", `AssertionError: Expected values to be strictly equal`.
- The hook denies on a missing file ("counters.json of the active run is missing or not readable"); Write, Edit and NotebookEdit deny, Read stays silent.
- Changed assertion: the test at `:287` lost "a missing counters.json do not block the target" from its title and its missing-file `silent` became `denied` for the three tools.
- Fixture change, not an assertion change: "silent for a tool call that touches no phase rule ..." and "records hooks observed" ran an Edit with no `counters.json`; each now writes `{version:1,pending:{}}` first.
- Green: 49 pass across `guard-phase.test.mjs` and `run-store.test.mjs`.

**Pins (green on the starting tree)**
- 🟢-4 (`hooks/guard-phase.test.mjs`, `copyFileSync` merged into the `node:fs` import on line 3). Mutation `` return `${st.dev}`; `` in `guard-phase.mjs`; failing title "fires: while the open target exists, a write to another existing file or to a copy of the target passes".
- 🟢-5 (`lib/run-store.test.mjs`, no new import). Mutation `if (true) throw new StoreError('lock-busy'...` in `run-store.mjs`; failing titles "fires: concurrent writers", "fires: duplicate id under concurrency", "fires: withLock keeps waiting on a held, readable lock until its deadline and only then reports lock-busy".
- Both files restored from backup; full gate-1 run green afterwards.

**Counter-tests not added or not unchanged:** audit F5 and F6 not added; audit F1 and F4 replaced (item 1); rv 🟡-1, 🟡-2, 🟢-3, 🟢-4, 🟢-5, audit F2 (both) and F3 appended unchanged.

**Gates (final tree)**
1. cdp6-core suite: exit 0, `tests 496`, `pass 496`, `fail 0`, `skipped 0`.
2. CDP5 suite: exit 0, 295/295 (run before the one-line `verdict-index.mjs` export, which is outside the CDP5 plugins).
3. skill-lint: exit 0 (re-run on the final tree; informational X4 for `scripts/run.test.mjs`).
4. secrets-scan: exit 0, `67 files, 0 findings, 0 unreadable (skipped)`.

**Files changed, final line counts:** `checks/verdict-check.mjs` 256, `checks/verdict-check.test.mjs` 660, `checks/decision-check.mjs` 108, `checks/decision-check.test.mjs` 440, `checks/devils-advocate-agent.test.mjs` 95, `agents/devils-advocate.md` 74, `lib/run-argv.mjs` 183, `lib/run-argv.test.mjs` 157, `lib/verdict-index.mjs` 104, `lib/run-store.test.mjs` 385, `hooks/guard-phase.mjs` 130, `hooks/guard-phase.test.mjs` 339.

**Choices between readings**
- Item 1: an objection id inside the tail of a well-formed objection line (for example in `refuted when:`) is allowed; the line itself is the objection.
- Item 1: a premise row that mentions an id inside the premises block rejects the capture, because that line is not an objection line.
- Item 3: for a superseded D-n the gate examines all live, non-stale captures on that D-n, with no time bound (there is no `decided` stamp); rejected captures count only through the conflicted rule, as in `settle`.
- Item 3: a snapshot is required for a superseded D-n whose captures carry targets (`snapshot-missing`), as for decided ones.
- Item 5: the deny message is shared for the missing and unreadable cases.

**Open questions and follow-up notes:** none open. Not changed and outside the brief: the concept's P3 gate row (about line 381) still does not state the proposed-D-n rule (rv 🟢-6). Other out-of-scope items left as listed.
