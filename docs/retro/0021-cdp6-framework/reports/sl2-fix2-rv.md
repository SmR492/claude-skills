# review-verify of the SL-2 second fix, C9 change, temp-directory task and concept v0.5.8 (stage-1 run 46): final answer as handed back

Brief: `briefs/sl2-fix2-rv.md`. Returned through workflow wf_370a5751-36f; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes (I wrote no part of the second fix, the temp-directory task, the C9 change or concept v0.5.8)
Target: `git -C <repo>/.worktrees/sl2 rev-parse HEAD` = 960146b3f8e5884a4a9f93f1077e793cedd6e14a, the brief's base, with the uncommitted SL-2 diff under `plugins/cdp6-core/`. Concept sha256 = 57942ee3e5cf3c6fd17491498a165ea31285ce761a0e9f7f26940aaa9a27be96, as the brief names. Read 2026-11-04T09:45:05+01:00.

Outcome: most of the second fix checks out against the source, but four claims fail in one point each (claims 1, 3, 5 and 7) and two sub-claims can only be settled by a run. The worst finding is a concept-level dead end: an owner `reject` on `<capture id>:conflict` after D-1 is decided can never be followed by a pass that counts.

## Part A: claims

| # | Claim | Decidable question | Verdict | Evidence |
|---|---|---|---|---|
| 1 | Items 1 and 3 to 8 built with their tests | Does each item's code and test match the brief and the concept line? | bestätigt | Item 1: `lib/verdict-index.mjs` (`parseItem`, `hasItem` conflict branch), `scripts/run.mjs:424` (`unknown-${item.kind}`), `checks/decision-check.mjs:16-23`, `verdict-check.mjs` `keep = !rejected \|\| conflicted`; tests in `run.test.mjs` (two new) and `decision-check.test.mjs:317`. Item 3: `verdict-check.mjs` `isStale` returns true when there are no targets. Item 4: `verdict-check.mjs:172` (wait), `rereadCaptures` uses `withLock` from `run-store.mjs`, the same module `capture.mjs:7,89` uses. Item 5: marker `{form,other}` in `check-handback.mjs`. Item 6: `guard-phase.mjs:39-59,85-87`. Item 7: new test in `capture.test.mjs`. Item 8: `agents/devils-advocate.md:47` plus a test in `devils-advocate-agent.test.mjs`. |
| 1 | Item 2 | Is every line that "starts like an objection (`objection` in any letter case …)" rejected? | widerlegt (one point) | `verdict-check.mjs:51` `/^[\s\-*+•>#\d.)]*objection\b/i`. Because of `\b`, `objections: F-P1-2 \| artefact: … \| evidence: …` is neither parsed nor rejected. The worker's own test pins this: `verdict-check.test.mjs:408` (`objections: see the lines above` must pass). |
| 2 | The 11 counter-tests are verbatim; F-C was replaced as briefed | Do the auditor and rv42 test lines all appear in the tree? | bestätigt + ergänzt | rv42: `sed -n 95,165p sl2-fix-rv.md \| diff - sl2-pre-tmp/…/decision-check.rv42.test.mjs` exit 0, and the same for verdict-check (170-183), exit 0. F-A, F-B, F-D and NV-1: `grep -Fxvf` against the current tree shows no missing content line. F-E is verbatim in `sl2-pre-tmp`. In the current tree, F-E and the rv42 file differ only by the run-45 change `mkdtempSync(join(tmpdir(),X))` → `tempDir(X)`; the `grep -Fxvf` run lists exactly those two lines as missing. No import was merged; the report says so correctly: `createHash`, `initRun` and `checkDecisions` were new import lines. Test count: 445 + 24 new = 469. The F-C replacement (`decision-check.test.mjs:317-334`) asserts: fails without a record, finding names `V-cap-1:conflict`; passes after accept; does not count after reject. It uses fixture records. The real `run.mjs object …:conflict accept` path is covered end to end by the new exit-idea test in `run.test.mjs`. |
| 3 | Each named mutation turns its test red | By reading code and test | widerlegt for item 4's "wait raised to 3000 ms"; the rest is consistent; the counts are unklar | The timed call passes `{ waitMs: 50 }` (`verdict-check.test.mjs:524-525`), so changing `GATE_WAIT_MS` (`verdict-check.mjs:172`) cannot fail the "bounded wait" assertion. The CLI call at the end of that test has no time check. The other mutations hit their tests by reading: `closed_at`, `notebook_path`, cwd versus R, id check, lock, `isStale`, the 2b checks, rollback rethrow. The exact counts (3, 5, 2) need a run. |
| 4 | No test weakened to reach green | Which hunks of `diff -r sl2-pre-fix2 sl2` remove or loosen an assertion? | bestätigt | Every removed assertion line (from `diff -ru … \| grep -E '^-'`) is tied to an item. Item 1c: two regexes in `decision-check.test.mjs:187,190` (they now also require the `:conflict` record). Item 2a: the old "roles other than the devils-advocate" test, which took pessimistic-realist as header-only, was split into a review-roles test and a counter-roles test. Item 2b: `twice(verdict,a,a)` now expects `rejected`. Item 3: `isStale` for `[]` and `{}` false → true; the renamed test; checker status 0 → 1. Item 5: the `other` body in `check-handback.test.mjs` became form-valid; the expected values are unchanged and the change is needed because per-cause markers would give two denies. Item 7 adds a stronger test and keeps the generic one. Run 45 changed no assertion (claim 8). |
| 5 | Choices stay in the brief and concept | Is each declared choice covered? | widerlegt for the `\b` choice; bestätigt for the rest | `unknown-conflict`: the brief asks for "its own error code". A void spawn counts as closed: concept line 878 "a void spawn counts as no spawn". Premise ids: brief item 1a. Lock 1000 ms: "never wait without bound". The `\b` narrows brief item 2b and concept line 1232 (see claim 1). The fresh-context check is DA-only and the test pins `fresh context: no` as `valid` for the other three counter-roles (`verdict-check.test.mjs:369`). The brief is silent on this, but contract C9 (`core.md:24`) says "`no` invalidates the pass". |
| 6 | C9 change, core.md regenerated, nothing else changed | Diff against the tree before the C9 change | bestätigt | `diff -ru sl1-audit/plugins/cdp6-core/skills/worker-contract sl2/…/worker-contract` shows only the C9 line in SKILL.md and core.md, plus the header `d96579da247d` → `c88130959164`. `diff -rq sl1-audit/plugins/cdp6-core sl2-pre-fix2` differs only in those two files. `diff -rq sl2-pre-fix2 sl2` lists nothing under `skills/`. The header equals `hashOf(body)`: `tail -n +3 core.md \| head -c -1 \| sha256sum` = `c88130959164…` (`lib/contract.mjs:19,36`). That the script did the regeneration rests on ledger row 218. |
| 7a | Item 6 cannot deny a path that is not a target | Does any non-target path get denied? | widerlegt | `guard-phase.mjs:49,86`: a malformed or unreadable `counters.json` denies every Edit, Write and NotebookEdit in the active run, whatever the path. The worker raised this as an open question. |
| 7b | Spellings that resolve to the target cannot pass | Are relative segments, a trailing slash and `notebook_path` caught? | relative segments, cwd-relative paths and `notebook_path`: bestätigt; trailing slash: unklar (no probe grant) | The guard compares `resolve()` and `realpathSync()` spellings on both sides (`guard-phase.mjs:27-37,42,53`). Tests cover `idea/../idea/idea.md`, a cwd-relative path and NotebookEdit. Nothing tests a trailing slash. Counter-test T5 below settles it. |
| 8 | Run 45: no assertion or production change; every `mkdtempSync` goes through the helper; cleanup also on failure; not run as a test or shipped as production | Diff, grep, and read the helper | bestätigt, except cleanup on a failed test: unklar (no run grant) | `diff -rq sl2-pre-tmp sl2` lists only `*.test.mjs` files plus `test-support/`. The `-` lines rewritten mechanically and the `+` lines give the same md5 (`ae49ecb8…`, 40 sites). The only other change is the `defaultSnapshot` setup in `decision-check.test.mjs:33`. `grep -rn "mkdtemp\|tmpdir()"` finds only `test-support/temp-dir.mjs`; that hit is the positive control. No non-test module imports the helper, and the gate globs do not cover `test-support/`. Cleanup on failure depends on node:test running `afterEach` after a failing test, which needs a run (counter-test T6). |

## Part B: concept v0.5.7 → v0.5.8 hunks

The sources are ledger rows 211 (run 42), 212 (run 43) and 213 (synthesis 01:54:26).

| Hunk | Supported by its source | Contradicts an unchanged line |
|---|---|---|
| 1. Version and as-of | yes, row 213 | no |
| 2. UC-01 step 3 (line 270) and step 5.2 (line 275) | yes, rulings (4) and (3) | **Step 5.2 does, in effect.** "reject keeps it from counting, so the D-n needs another pass" cannot be reached once D-1 is decided: line 252 (UC-01 Exit) requires a capture stamped before `decided`; `run.mjs:444` allows only decided → superseded; `idea-check.mjs:35-37` requires D-1 decided. See 🟡-1. |
| 3. UC-12 steps 4 and 5 (lines 882-883) | yes, rulings (1), (2), (3), (5) | no. "Also when stale" is reconciled with O15 (line 1507) and line 894 by the C13 hunk. |
| 4. Error row (line 893) | yes, rulings (7) and (8) | no. This also confirms the orchestrator note on report line 115: line 893 was changed. |
| 5. §5 table (line 1190) | yes, ruling (6) | no |
| 6. §5 table (line 1203) | yes, ruling (5) | no |
| 7. §5.3 (line 1232) | yes, rulings (7) and (3) | No direct contradiction. The SL-2 row (line 1622) still says "verdict-check.mjs for the devils-advocate verdict", and the stage-1 consumer test applies (only devils-advocate can be spawned, AC-12.6). The form for the other counter-roles has no stage-1 consumer (🟢). |
| 8. C13 (line 1372) | yes, rulings (1) and (3) | no. AC-12.21 (line 921) has no case for the `:conflict` record; this is a traceability gap only (🟢). |
| 9. §11.3 item 3 (line 1644) | yes, ruling (4) | no |
| 10. Changelog 0.5.8 | yes | no |

## Findings

### 🟡-1: an owner `reject` on `:conflict` after `decided` leaves P1 with no exit in stage 1
`decision-check.mjs:27-31` counts only captures stamped before `decided`. After a reject, a new devils-advocate pass is stamped after `decided`, and D-1 cannot be decided again. The run stays at P1 until `abandon` (SL-8) or a hand edit. The worker's test `decision-check.test.mjs:326` encodes this dead end.

**Closing proposal:** an owner ruling on concept line 275 against line 252. Recommended: a `:conflict reject` recorded after `decided` lets one later devils-advocate pass count for that D-n.

**T1** (`checks/decision-check.test.mjs`, no extra import). Not executed. Expected red now with "decided at 2026-01-01T11:00:00.000Z before its devils-advocate capture at 2026-01-01T12:30:00.000Z". Run it only after the ruling.
```js
test('fires: after the owner rejects a conflicted capture without items once D-1 is decided, another devils-advocate pass can still let D-1 pass', () => {
  const rec = { kind: 'object', id: 'V-cap-1:conflict', verdict: 'reject', why: 'x', decider: 'owner', at: T3 };
  const conflicted = capture({ conflicted: true, text: captureText({ verdict: 'a', conflicted: true }) });
  const again = capture({ id: 'V-cap-2', stamp: '2026-01-01T12:30:00.000Z' });
  const r = check(fixture({ captures: [conflicted, again], ownerRecords: [rec] }));
  assert.equal(r.status, 0, r.out);
});
```

### 🟡-2: an `objections:` line is dropped under verdict (b)
This is the same effect as auditor F-A, through the `\b` in `verdict-check.mjs:51`.

**Closing proposal:** drop `\b`, as brief item 2b and concept line 1232 say literally, and change the control line at `verdict-check.test.mjs:408`.

**T2** (`checks/verdict-check.test.mjs`, no extra import). Not executed. Expected red now: `validator: valid` with `objections: ["F-P1-1"]`.
```js
test('fires: a plural objections line with an objection id under verdict b is not dropped', () => {
  const second = 'objections: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const r = validate({ objections: `${OBJECTION}\n${second}`, verdict: 'verdict: b' });
  assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), JSON.stringify(r));
});
```

### 🟡-3: `fresh context: no` is valid for the pessimistic-realist, adversarial-auditor and threat-modeler
This is against C9 (`core.md:24`) and the §5.3 hunk ("holds for every counter-role"). There is no stage-1 exposure, because only devils-advocate can be spawned.

**Closing proposal:** apply the fresh-context check to every counter-role and change the assertion at `verdict-check.test.mjs:369`.

**T3** (`checks/verdict-check.test.mjs`, no extra import). Not executed. Expected red now: `valid`.
```js
test('fires: a capture with fresh context no is rejected for every counter-role (C9)', () => {
  for (const type of ['cdp6-core:pessimistic-realist', 'cdp6-core:adversarial-auditor', 'cdp6-core:threat-modeler']) {
    const r = validateCapture(text({ rejected: null, fresh: 'fresh context: no' }), { agentType: type, captureId: 'S-1-x-agent-2' });
    assert.equal(r.validator, 'rejected', type);
  }
});
```

### 🟢-4: a malformed `counters.json` denies every Edit, Write and NotebookEdit (claim 7a)
Brief item 6 says "other paths … pass as before".

**Closing proposal:** an owner ruling. If fail-closed stays, record it at concept line 270 and drop T4.

**T4** (`hooks/guard-phase.test.mjs`, no extra import). Not executed. Expected red now: exit 2 with "counters.json of the active run is not readable".
```js
test('fires: a malformed counters.json does not deny a Write outside every spawn target', () => {
  const w = world();
  const R = withSpawns(w, { toolu_x: {} });
  writeFileSync(join(stateOf(w), 'counters.json'), '{ "pending": ');
  silent(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'other.md'), content: 'b' } }));
});
```

### 🟢-5: spellings not covered by any test (claim 7b)
A trailing slash, `/./`, `//` and a symlinked parent directory are untested.

**Closing proposal:** add T5.

**T5** (`hooks/guard-phase.test.mjs`, no extra import). Not executed. Expected green; red if any spelling slips past the guard.
```js
test('fires: a trailing slash, dot and doubled separators and a symlinked directory still hit the open spawn target', () => {
  const w = world();
  const R = withSpawns(w, { toolu_t: { task: 'D-5' } });
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'A\n');
  symlinkSync(join(R, 'idea'), join(w.base, 'link'));
  denied(fire(w, { tool: 'Write', input: { file_path: `${join(R, 'idea', 'idea.md')}/`, content: 'b' } }), /D-5/);
  denied(fire(w, { tool: 'Edit', input: { file_path: `${R}/./idea//idea.md`, old_string: 'a', new_string: 'b' } }), /D-5/);
  denied(fire(w, { tool: 'NotebookEdit', input: { notebook_path: join(w.base, 'link', 'idea.md'), new_source: 'b' } }), /D-5/);
});
```

### 🟢-6: helper cleanup after a failing test (claim 8)
**Closing proposal:** run T6.

**T6**, new file `lib/temp-dir-helper.test.mjs`. Not executed. Expected green (exit 1 for the probe, `tmp` empty); red if `afterEach` does not run after a failure.
```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tempDir } from '../test-support/temp-dir.mjs';

const HELPER = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'test-support', 'temp-dir.mjs')).href;

test('the temp-dir helper removes the directories of a failing test, a passing test and the module level', () => {
  const box = tempDir('cdp6-helper-box-');
  const tmp = join(box, 'tmp');
  mkdirSync(tmp);
  const probe = join(box, 'probe.test.mjs');
  writeFileSync(probe, [
    "import test from 'node:test';",
    `import { tempDir } from ${JSON.stringify(HELPER)};`,
    "tempDir('module-');",
    "test('red on purpose', () => { tempDir('failing-'); throw new Error('red on purpose'); });",
    "test('green', () => { tempDir('passing-'); });",
    '',
  ].join('\n'));
  const r = spawnSync(process.execPath, ['--test', probe], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: box, TMPDIR: tmp } });
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
  assert.match(`${r.stdout}${r.stderr}`, /red on purpose/);
  assert.deepEqual(readdirSync(tmp), []);
});
```

### 🟢-7: the lock test does not pin the default bound (claim 3)
**Closing proposal:** add T7.

**T7** (`checks/verdict-check.test.mjs`, no extra import). Not executed. Expected green now (about 1 s); red with `GATE_WAIT_MS = 3000`.
```js
test('fires: the gate default wait for verdicts.lock is bounded', () => {
  const R = decided({ captures: [FRESH] });
  const lock = join(R, 'verdicts.lock');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  const started = Date.now();
  const busy = rereadCaptures(R);
  const waited = Date.now() - started;
  rmSync(lock);
  assert.ok(waited < 1500, `the gate waited ${waited} ms`);
  assert.deepEqual(busy.captures, []);
  assert.match(busy.findings[0], /verdicts\.lock: the capture lock is held by another writer/);
});
```

### Follow-up notes, no test
- `OBJECTION_LIKE` also rejects lines starting with `#` or `>`, which are not list marks. This fails closed.
- Two spellings were not checked without a probe and may still get past the item-6 guard. On a case-insensitive file system (`/mnt/c` drvfs), a different letter case of the path may pass. When the target does not exist yet, a symlinked parent directory may pass. The §11.3 item 3 hand check is the backstop.
- An old-format marker `{asked:true}` now reads as "not asked" for both causes.

## Status
Mapping (contract rule 4): bestätigt and bestätigt + ergänzt → pass; widerlegt → block. Claims 2, 4 and 6 pass. Claims 1 (item 2b), 3 (item-4 mutation), 5 (`\b`) and 7a are each widerlegt in one point, so the handback maps to **block** until 🟡-1 to 🟡-3 are ruled or fixed and 🟢-4 is ruled. Claim 7b (trailing slash) and claim 8 (cleanup on failure) are unklar because there is no run grant; they go back to the orchestrator with T5 and T6 and carry no verdict.

## Commands run (all read-only)
- `git rev-parse HEAD`, `git status --short`, `sha256sum` on the concept, `date -Is`
- `diff -rq` / `diff -u` / `diff -ru` between `sl2-pre-fix2`, `sl2-pre-tmp`, `sl1-audit/plugins/cdp6-core` and `sl2/plugins/cdp6-core`
- `diff -ru … | grep | sed | md5sum` for the run-45 substitution check
- `sed -n` and `diff -` / `grep -Fxvf` against `sl2-fix-rv.md` and `sl2-fix-auditor.md`
- `grep -n` / `grep -rn` / `grep -c` over the code, tests, concept and ledger
- `sed -n` and `cat` on the modules
- `tail | head -c | sha256sum` on `core.md`
- `wc -l`, `ls`, `file`, `node --version` (v24.19.0)

Two commands were refused by the guard (one for backticks, one for a redirection) and were re-run in a permitted form.
