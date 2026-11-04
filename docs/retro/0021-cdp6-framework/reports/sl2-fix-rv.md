# review-verify of the SL-2 combined fix and concept v0.5.7 (stage-1 run 42): final answer as handed back

Brief: `briefs/sl2-fix-rv.md`. Returned through workflow wf_5e92fa18-424; paths normalised to `<repo>` and `<scratchpad>`.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes

**Outcome:** the combined fix matches the report on every item except one. Under item 5, a rejected conflicted capture can never be cleared by `run.mjs object` records, which contradicts UC-12 step 5 (concept line 883). The report also says this state has "no way out", but there is one: editing `idea.md` makes the conflicted capture stale, and the gate then drops it.

**Target state:**
- Worktree: `git -C …/.worktrees/sl2 rev-parse HEAD` returns `960146b3f8e5884a4a9f93f1077e793cedd6e14a`, which equals the brief. Status shows only `plugins/cdp6-core/` changes.
- Concept: `sha256sum docs/cdp6/konzept-cdp6.md` returns `869d42f4…ee174`, which equals the brief.
- Concept diff: `<scratchpad>/concept-v056-v057.diff`, 146 lines, read in full.
- Edit log: `<scratchpad>/sl2-fix-test-edits.md`, 1420 lines, read in full.

## Part A: claims

Verdict mapping: bestätigt and bestätigt + ergänzt map to pass; widerlegt maps to block; unklar carries no verdict.

| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1 | Are the 12 items present, and are the duplicates gone from the four files? | bestätigt + ergänzt | The grep for `new Set(['a'/'b'`, `'a-with-conditions'`, `F-P[1-8]`, `:premise-`, `index.jsonl` and `endsWith(':devils-advocate')` hits only `lib/verdict-index.mjs:5-11,21,52,64`, plus the error text at `run.mjs:413`. Items 8 to 12 are in place: `run.mjs:25,547,578,583`, `brief.mjs:8,15`, `check-handback.mjs:61-80`, `capture.mjs:118-142,164,198`, `skills/idea/SKILL.md:35,47`. Additions: (a) a second devils-advocate test survives as `role === 'devils-advocate'` at `verdict-check.mjs:79,94`. (b) Item 6 is enforced for devils-advocate only (`verdict-check.mjs:79-94`), while §5.3 (line 1232) states the rule for counter-roles in general (F-4). (c) Item 5 is incomplete (F-1). |
| 2 | Do the named mutations turn the named tests red, and do the tests assert their item? | bestätigt by reading; the counts are unklar | Item 2: with matching on `split(':').pop()`, the bare and foreign record ids in `decision-check.test.mjs:129-133` would clear the objection. Item 3: with `isStale` false for no targets, four tests rely on stale: `decision-check.test.mjs:220,277` and `verdict-check.test.mjs:375,378`. Item 4: skipping the orphan check breaks `decision-check.test.mjs:161` and the verdict-check orphan test; skipping the sha check breaks `decision-check.test.mjs:142` ("changed"). The verdict-check sha test was added later (call 47), which explains the count of 1. "Exactly one test fails" and the counts 4, 2 and 1 cannot be decided without a run. The item 5 test (`decision-check.test.mjs:188-190`) fixes the gap of F-1 as expected behaviour. |
| 3 | Do counter-tests 2 and 3 fail to isolate their fix, while the backed tests do? | bestätigt + ergänzt | Counter-test 2 writes only `index.jsonl` (`decision-check.test.mjs:297`), so `verdict-check.mjs:178` drops both captures and `/D-2/` matches whatever F3 does. Counter-test 3's index sha equals `sha('verdict: b\n')` (`:304`), so the sha check plays no part; the header-less body is rejected, so the test isolates neither the sha check nor taking the verdict from the file. The backed tests isolate their fixes: `:126` (F3), `:220` (F1), `:142` "lying" (verdict from the file) and "changed" (sha). Addition: the report numbers these "1 and 2" at `sl2-fix.md:7,87`, but its own bullets at `:88-90` name 2 and 3. |
| 4 | Do the choices stay inside the brief and the concept? | item 6 bestätigt + ergänzt; item 7 bestätigt; **item 5 widerlegt**; item 4 bestätigt; item 3 bestätigt + ergänzt; item 2 bestätigt | **Item 6:** follows the second sentence at line 1232. The form line in the same paragraph and the brief ("each objection needs") read wider, and `refuted when:` is never checked. **Item 7:** the §5 table row (diff line 110) defines "the deny-once marker per agent id", and the code matches it (`check-handback.mjs:45-49,120`). **Item 5:** see part C below. **Item 4:** matches the §5 row "counts … as a finding". **Item 3:** follows the brief, but AC-12.3 (line 903) and the error row (line 894) say any capture without a target is stale, while `verdict-check.test.mjs:375,387-388` asserts that a review-verify capture or a capture without a decision is not stale (F-6). **Item 2:** the concept names no error codes; the codes are in `run.mjs:413,424`. |
| 5 | Do the changes beyond the brief stay inside it and the concept? | bestätigt + ergänzt | `devils-advocate.md:59` follows line 1232 ("the role file states it"). The `append` option has no production caller that passes it (`check-handback.mjs:122`). `isDevilsAdvocate` matches TM-6 because `agentName` accepts only `cdp6-core:` (`agent-name.mjs:1-7`). `reasonOf` is exported at `check-handback.mjs:77`. Addition: `lib/capture-fixture.mjs` is not a `*.test.mjs` file, so it ships in `lib/`; the report's "not shipped logic" (`sl2-fix.md:39`) is inaccurate (🟢). |
| 6 | Are the open notes correctly left open? | bestätigt + ergänzt | `SAFE_TASK` is at `check-handback.mjs:16,89`. The `.md`-before-index window: the `.md` is written at `capture.mjs:190` and the index line appended at `:193`; the gate reads without `verdicts.lock` and fails closed with an orphan finding. `psy-grenzwaechter` is still in `core.md:24` C9 and `devils-advocate.md:47`; `grep psy-grenzwaechter konzept-cdp6.md` finds nothing (control: the same grep finds C9 at line 1367). `registry.json` lists only `idea-check` and `decision-check`. Addition: the worker edited `devils-advocate.md:59` but left line 47 of the same file (F-7). |
| 7 | Was any test weakened, removed or skipped, and is each change required? | bestätigt + ergänzt | A grep for `test.skip`, `todo`, `{ skip` or `{ todo` finds only fixture parameters named `skip`, which also shows the search works; no test is skipped. All 44 headers were read. Each edit that removes, replaces or loosens an assertion is listed below with the item that requires it. |

**Edits that remove, replace or loosen an assertion (claim 7):**
- **Call 26:** removes the capture.test test "readIndex of a missing index is empty and of a malformed one throws index-unreadable" (old title in `t3-gate1.txt:209`). `verdict-index.test.mjs` replaces it with wider cases. Required by item 1.
- **Call 28:** narrows the worker's own duplicate scan. `/:premise-/`, `/PASSING/` and `/BLOCKING/` become `/new Set\(\['b'/`, `/premise-\$\{/` and `/premise-\(/`. The new list no longer catches `new Set(['c','b'])`. This follows from item 1, since the consumers now import those names.
- **Calls 30, 32, 35:** change bare ids to scoped ids in "records owner objection", A4, the decision-check records and the verdict-check `all` list. Required by item 2 and AC-11.14. The old text of "records owner objection" is not in the log, so whether it lost an assertion is unklar.
- **Calls 36, 39, 40, 45:** fixtures get `targets:[live]`, a default snapshot and backed `.md` files. One assertion is reversed: a target-less capture now expects status 1 instead of 0 (`verdict-check.test.mjs:375`). Required by item 3, AC-12.3 and item 4.
- **Call 46:** loosens `rejected: the premises section is missing` to `rejected: .*the premises…` (`verdict-check.test.mjs:373`). Required by item 4, because the reasons now come from re-validating the file.
- **Call 57:** replaces "a handback that fails the verdict form is not denied…" (`t3-gate1.txt:78`). Required by item 7.
- **Call 64:** replaces the worker's own call-62 rollback test, which kept the original error code `capture-exists`, with a variant that expects the generic `capture-failed`. This is weaker on which error survives. No concept line requires it, but it still turns red if the rollback error escapes.
- **Call 77:** removes the worker's own `doesNotMatch` on the skill description. UC-01 step 4 keeps the owner's autonomy step, so the description should name it; the removal is correct.
- **Call 78:** limits the `doesNotMatch` to the part of the line before ". The `D-n` status" and widens the pattern. Required by the UC-01 Artefacts wording in v0.5.7.

## Part B: concept hunks of v0.5.6 to v0.5.7

| Hunk | Source | Supported | Contradicts an unchanged line |
|---|---|---|---|
| Version header | synthesis 22:30:30 | yes | no |
| §1.2 `verdict-index.mjs` | run 38 D1 | yes | no |
| UC-01 Artefacts | run 40 (1) | yes | no; `idea-check.mjs:36-41` reads the status from run.json |
| UC-01 steps 3 and 5.2 | run 40 (1)(2), audit F1 and F3 | yes | no |
| UC-10 step 6 fields | run 40 (3) | yes; the code is at `hooks-observed.mjs:30-31` | no |
| AC-11.14 | audit F3 | yes | no |
| UC-12 step 4 | run 40 (5), run 37 choice 1 | yes; code order at `check-handback.mjs:98-104` | no |
| UC-12 step 5 | run 37 U1, run 38 D1 | yes | no text contradiction, but the code cannot meet it (F-1) |
| Error row 894 | audit F1, run 37 | yes | soft: line 893 still names "when the brief named code paths" (F-8) |
| AC-12.3 and AC-12.4 | run 40 🟢, synthesis | yes | AC-12.4 against line 893 (F-8) |
| §5 `S/verdicts/` row | audit F4, run 38 D2, run 37 | yes | no |
| §5 hooks-fired and handback-asked rows | run 40 (3) and 🟢 | yes | no |
| §5.3 capture form | run 40 (4), run 37 choice 4 | yes | no |
| §11.3 item 3 | audit F4, run 40 (6) | yes | no |
| Counting rule | run 40 🟢 | yes | no |
| Changelog 0.5.7 | synthesis | yes | no |

## Part C: item 5 in detail, then the findings

**Why item 5 is widerlegt.** A rejected capture carries no items: the validator returns `objections:[]` and `premises:[]` (`verdict-check.mjs:99`). `run.mjs object` therefore refuses every id of that capture as `unknown-*` (`run.mjs:424`). That contradicts line 883: "on `run.mjs object` records per item, which the gate counts … whatever the conflicted capture's validator result". It also leaves the stop of UC-01 5.2 (line 275) and C13 (line 1372) with no record that can end it. The report says this state has "no way out", but `decision-check.mjs:237-238` drops stale captures before the conflicted loop, so editing `idea.md` clears it. C13 does not list that as a way to clear.

**Findings.** All counter-tests were not executed; expected results are stated. The first three tests go in file `plugins/cdp6-core/checks/decision-check.rv42.test.mjs`, the next two in `plugins/cdp6-core/checks/verdict-check.rv42.test.mjs`; the full code follows the list.

- 🟡 **F-1: object records cannot clear a rejected conflicted capture.**
  - Fix: when a capture is conflicted, keep its parsed objection and premise ids on the index line and in `rereadCaptures` even if it is rejected, so `run.mjs object` and `decision-check` can count records for them.
  - Counter-test "rv42: object records for the items of a rejected conflicted capture clear it". Expected red: status 1, "conflicted capture V-cap-1 lists no objection or premise to record".
- 🟡 **F-2: a stale conflicted capture stops blocking.** C13 says such a capture "clears only by" a clearing capture or object records, and that a fresh instance of the same role does not cure it.
  - Fix: the owner decides which is intended. If C13 governs, run the loop at `decision-check.mjs:238` over `all` instead of `fresh`.
  - Counter-test "rv42: a conflicted capture whose target changed…". Expected red: "editing the target cured the conflict: decision-check OK".
- 🟢 **F-3: no check that an index line's `id` equals its file name without `.md`.** UC-12 step 5 (line 883) requires them to be equal; the F3 scoping rests on `id`.
  - Fix: in `rereadCaptures`, add a finding when `line.id !== line.file.slice(0, -3)`.
  - Counter-test "rv42: an index line whose id is not its file name…". Expected red: status 0.
- 🟢 **F-4: the §5.3 objection rule is enforced for devils-advocate only.** The T3 test `verdict-check.test.mjs:342-349` pins this behaviour.
  - Fix: apply the b/c objection rule to every counter-role, or narrow §5.3 to devils-advocate for stage 1.
  - Counter-test "rv42: a counter-role other than the devils-advocate…". Expected red: validator `valid`.
- 🟢 **F-5: "exactly one `verdict:` line" is not enforced.** `verdict-check.mjs:60-61` flags only lines with different values.
  - Fix: count the `verdict:` lines.
  - Counter-test "rv42: a capture with two verdict lines…". Expected red: validator `valid`.
- 🟢 **F-6: AC-12.3 and line 894 are wider than the code** (`verdict-check.mjs:139`).
  - Fix: change the wording to "a devils-advocate capture of a `D-n` that names no target".
- 🟢 **F-7: `devils-advocate.md:47` still names psy-grenzwaechter as the counter-check.**
  - Fix: remove that clause together with the C9 contract follow-up.
- 🟢 **F-8: line 893 still conditions the premises rule** on "when the brief named code paths", while AC-12.4 says the section is always required.
  - Fix: remove that condition from line 893.
- 🟢 **F-9: the report numbers the counter-tests wrongly** at `sl2-fix.md:7,87`.
  - Fix: change "1 and 2" to "2 and 3".

`plugins/cdp6-core/checks/decision-check.rv42.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initRun } from '../lib/run-store.mjs';
import { backCaptures, captureText } from '../lib/capture-fixture.mjs';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'decision-check.mjs');
const T1 = '2026-01-01T10:00:00.000Z';
const T15 = '2026-01-01T10:30:00.000Z';
const T2 = '2026-01-01T11:00:00.000Z';
const sha = (t) => createHash('sha256').update(t, 'utf8').digest('hex');
const live = { path: 'idea/idea.md', sha256: sha('current\n') };
const old = { path: 'idea/idea.md', sha256: sha('older\n') };

function snapshot() {
  const dir = mkdtempSync(join(tmpdir(), 'cdp6-rv42-snap-'));
  mkdirSync(join(dir, 'idea'));
  writeFileSync(join(dir, 'idea', 'idea.md'), 'current\n');
  return dir;
}

function run(captures, ownerRecords = []) {
  const R = join(mkdtempSync(join(tmpdir(), 'cdp6-rv42-')), 'RUN-20260101-x');
  initRun(R, {
    run_id: 'RUN-20260101-x',
    status: 'active',
    ids: { next: { D: 2 } },
    decisions: { 'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: T1, decider: 'operator' }, { status: 'decided', at: T2, decider: 'owner' }] } },
    owner_records: ownerRecords,
    phases: {},
  });
  backCaptures(R, captures);
  return R;
}

function cap(over = {}) {
  return { id: 'V-cap-1', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', decision: 'D-1', verdict: 'a', objections: [], targets: [live], stamp: T1, ...over };
}

function check(R) {
  const r = spawnSync(process.execPath, [CHECK, '--run-dir', R, '--snapshot', snapshot()], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('rv42: object records for the items of a rejected conflicted capture clear it, as UC-12 step 5 counts them whatever its validator result', () => {
  const text = captureText({ verdict: 'a', conflicted: true, objections: ['F-P1-1'] }).replace('rejected alternative provided: yes', 'rejected alternative provided: no');
  const rec = { kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T2 };
  const r = check(run([cap({ conflicted: true, text }), cap({ id: 'V-cap-2', stamp: T15 })], [rec]));
  assert.equal(r.status, 0, `a rejected conflicted capture cannot be cleared by its object records: ${r.out}`);
});

test('rv42: a conflicted capture whose target changed before the exit still keeps its decision open, since C13 lists no stale path among the ways it clears', () => {
  const conflicted = cap({ conflicted: true, targets: [old], text: captureText({ verdict: 'a', conflicted: true, objections: ['F-P1-1'] }) });
  const r = check(run([conflicted, cap({ id: 'V-cap-2', stamp: T15 })]));
  assert.equal(r.status, 1, `editing the target cured the conflict: ${r.out}`);
  assert.match(r.out, /V-cap-1:F-P1-1 of a conflicted capture/);
});

test('rv42: an index line whose id is not its file name without .md is a finding', () => {
  const R = run([cap()]);
  const index = join(R, 'verdicts', 'index.jsonl');
  const line = JSON.parse(readFileSync(index, 'utf8'));
  writeFileSync(index, `${JSON.stringify({ ...line, id: 'V-cap-9' })}\n`);
  const r = check(R);
  assert.equal(r.status, 1, `an index id that is not the capture file name was counted: ${r.out}`);
});
```

`plugins/cdp6-core/checks/verdict-check.rv42.test.mjs`:
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCapture } from './verdict-check.mjs';
import { captureText } from '../lib/capture-fixture.mjs';

test('rv42: a counter-role other than the devils-advocate with verdict b and no objection fails the capture form of §5.3', () => {
  const r = validateCapture(captureText({ verdict: 'b' }), { agentType: 'cdp6-core:adversarial-auditor', captureId: 'S-1-adversarial-auditor-a1' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
});

test('rv42: a capture with two verdict lines fails the "exactly one verdict: line" rule of §5.3', () => {
  const r = validateCapture(`${captureText({ verdict: 'a' })}verdict: a\n`, { agentType: 'cdp6-core:devils-advocate', captureId: 'D-1-devils-advocate-a1' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
});
```

## Status

- **Overall: pass-with-conditions.** There is no 🔴. Claim 4, item 5, is widerlegt, which blocks that one sub-claim; its fix is F-1.
- **Before the fresh audit:** the owner has to decide F-1 and F-2 together.
- **For the orchestrator:** run the five counter-tests on a disposable copy, as for the audit.

## Returned claims
- Claim 2: whether exactly the test counts the report names would fail under each mutation (4, 2 and 1) needs a run, so it is returned.
- Claim 7: the old text of "records owner objection" is not in the edit log, so whether it lost an assertion is unklar.

## Commands run
1. `ls -la <scratchpad>`
2. `git -C …/sl2 rev-parse HEAD && git -C …/sl2 status --short && sha256sum …/konzept-cdp6.md`
3. `sed -n '270,280p;878,886p;1228,1236p;1368,1376p' konzept-cdp6.md`
4. `cat -n` on verdict-index.mjs, capture.mjs, capture-fixture.mjs, verdict-check.mjs, decision-check.mjs and check-handback.mjs
5. `grep -n` on run.mjs (object, reconciliation, index readers)
6. `sed -n '400,440p;535,590p' run.mjs`
7. The duplicate grep over the six files named in claim 1
8. `grep -rn … -l` on cdp6-core, and `cat -n agent-name.mjs`
9. `wc -l` on the test files and the two scratchpad files
10. `grep -n` on ledger 0021
11. `grep -n` headings of sl2-fix-test-edits.md
12. `grep -n` on t3-gate1.txt and verdict-check.test.mjs
13. `ls checks agents`, `cat registry.json`, `grep -n` on SKILL.md
14. `grep -n` on idea-check.mjs and devils-advocate.md
15. `grep -n psy-grenzwaechter` on the concept, core.md and SKILL.md
16. `sed -n 24p core.md`, plus C9 and §2 greps on the concept
17. `grep -n` on brief.mjs, hooks-observed.mjs and verdict-index.test.mjs
18. One grep with `-c ""` on the counter-test brief, which the guard blocked
19. `grep -n "^test("` on the counter-test brief
20. `grep -n` on verdict-check.test.mjs, then `sed -n 340,352p` on the same file
21. The skip/todo grep with its control
22. Concept greps for autonomy, stale wording, AC-01, and the rows at lines 893, 894, 903 and 904

Read-tool calls: the review brief, the fix brief, the fix report, decision-check.test.mjs, the concept diff (two parts) and the edit log (three parts).
