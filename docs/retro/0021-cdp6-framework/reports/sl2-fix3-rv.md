# review-verify of the SL-2 third fix and concept v0.5.9 (stage-1 run 49): final answer as handed back

Brief: `briefs/sl2-fix3-rv.md`. Returned through workflow wf_3b026c2f-718; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none

fresh context: yes. I wrote no part of the third fix, its report or concept v0.5.9.

Target state: `git -C <repo>/.worktrees/sl2 rev-parse HEAD` returns 960146b3f8e5884a4a9f93f1077e793cedd6e14a, which is the brief's base. Concept sha256 is 4d8367ae8aec6f9b6b7f7f70153c1690841f31af6bc41bb04b83bd68a502d105, as the brief names. `git status --short` shows changes only under `plugins/cdp6-core/`. Read at 2026-11-04T10:20:41+01:00.

The third fix mostly checks out against the source, but item 2 fails in one point. A well-formed `objection:` line that carries `-- unchecked` is not rejected. Separately, the devils-advocate role file does not state the new reject rules.

## Part A: claims

| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1, item 1 | Is `:conflict reject` refused after `decided`, accepted before it, and does `accept` after `decided` pass the gate? | bestätigt | `scripts/run.mjs:425,429-431`: the check runs in `verify`, which is called before the update and again inside `updateRun` (:432-435). Test `scripts/run.test.mjs:1769-1788` asserts the refusal code `conflict-reject-after-decision`, no record after the refusal, a reject accepted before `decided`, and `exit idea` status 0 after `accept`. This matches brief item 1 and concept line 275. |
| 1, item 2 | Does every line outside the premises block that contains `-- checked`/`-- unchecked` reject? Does every off-form objection marker reject? Does a missing or `no` fresh-context line reject for all four roles? | **widerlegt (one point)** | The marker and fresh-context parts are built: `checks/verdict-check.mjs:52,88-89` (marker), `:53,90` (premise mark), `:102` (fresh context for every counter-role). The gap: in the `if (o) … else if` chain at `:78-92`, a line that matches the well-formed `^objection: ` pattern never reaches the `PREMISE_MARK` test. So `objection: F-P1-1 | … | refuted when: x -- unchecked` stays valid under verdict `a`. Brief item 2 and concept line 1232 say "a line outside the `premises:` block that contains `-- checked` or `-- unchecked` … rejects". See 🟡-1. |
| 1, item 3 | Is the deny by device and inode built, besides the path comparison, and does an unreadable `counters.json` still deny? | bestätigt | `hooks/guard-phase.mjs:35-42,51-54,66-67`. Fail-closed is unchanged at `:58-60,98`. The fail-closed test `guard-phase.test.mjs:287-300` stays. F-3 is at `:303-313` and T5 at `:315-323`. The letter-case branch has not run on this file system (the report says so). |
| 1, item 4 | After a failed `stat` or `unlink`, does the loop check the deadline and sleep? Do all callers use this loop? | bestätigt | `lib/run-store.mjs:69-85`. Every lock goes through `withLock`: `grep -rn withLock` shows `counters.mjs:50`, `capture.mjs:89`, `verdict-check.mjs:220`, `run-store.mjs:155,164,222` and `hook-key.mjs:66`. Tests: F-1 (verdict-check CLI with `verdicts.lock`) and `run-store.test.mjs:351-375`. That test calls `withLock` directly with the names `run.lock` and `counters.lock`, not through `updateRun` or `counters.mjs`. |
| 1, item 5 | Does a `proposed` D-n fail the gate with its id, and does a `superseded` one pass? | bestätigt | `checks/decision-check.mjs:54-57`. Tests: `decision-check.test.mjs:71-76` and `run.test.mjs:1790-1800`. `checks/registry.json:24-36` wires decision-check only to `idea`. |
| 1, item 6 | Do item records clear only the conflict block, so that `a` passes and `b` still needs its records? | bestätigt + ergänzt | Test at `decision-check.test.mjs:339-358`. The `b` assertion accepts either finding through a regex alternation (`:350`), so it cannot tell the two blocks apart. The report says so. The added `c` case does separate them (`:353-357`). |
| 2 | Are the eight counter-tests in the tree verbatim, are the imports merged, and are T1 and T4 absent? | bestätigt | T6: `sed -n 130,157p sl2-fix2-rv.md \| diff - lib/temp-dir-helper.test.mjs` gives exit 0. T2, T3 and T7 against `verdict-check.test.mjs`: `grep -c -Fxvf` reports 0 missing lines. F-1 and F-2 against the same file: 0. F-3 against `guard-phase.test.mjs`: 0. T5: no missing line. Positive control: the same command lists the T4 lines as missing. `grep` for the T1 and T4 titles finds nothing. Imports are merged at `verdict-check.test.mjs:4` (`symlinkSync`, `utimesSync`) and `guard-phase.test.mjs:3` (`linkSync`). |
| 3 | Can each named mutation turn its test red? | bestätigt by reading; the "only this test" and "two older tests" counts are unklar (only a run decides) | Item 1: with `false`, `refused.status` is 0, so it goes red. Item 3: with `real()`→`resolve()` and the identity check removed, the hard-link alias in F-3 and the symlinked-directory NotebookEdit in T5 both pass, so both go red. T7: `GATE_WAIT_MS=3000` makes the default wait ≥3000 ms, more than the 1500 ms bound, so red. Item 5: `proposed` gives status 0, red in both tests. Item 6: excluding conflicted captures from `fresh` fails `passA`; skipping the blocking branch passes `acceptedC`. Both go red. T6: `perTest.clear()` leaves `failing-*` in `tmp`, so red. |
| 4 | Was any assertion removed, replaced or loosened? | bestätigt | Every `<` line of the `diff -r` was checked. `decision-check.test.mjs:71-72` changes from proposed→0 to proposed→1 plus a superseded case (item 5). `verdict-check.test.mjs:369` changes `valid`→`rejected` (item 2). `:408` drops `objections: see the lines above` (item 2; the new test pins that line as rejected). The rest are import lines. `grep` for `skip`/`todo`/`only` markers finds only fixture parameters, the same in both trees (positive control). Note: the old control's regex at `:409` does not cover the new reason "contains an objection marker". The new test's `fine` check (`every(/unchecked premise/)`) does. |
| 5 | Do the worker's choices stay inside the brief and the cited concept lines? | bestätigt | Item 1 refuses only while the status is `decided`. A D-n that goes decided→superseded is skipped by `decision-check.mjs:58`, so a later reject has no gate effect. The marker reading follows line 1232 "anywhere". The extra `c` case adds assertions only. One choice is not declared: the `proposed` finding applies wherever decision-check runs, not only at P1 (see 🟢-6). |
| 6a | Can item 3 deny a write to a file that is not an open target? | bestätigt by reading | The key includes `dev` (`guard-phase.mjs:38`, bigint). A path that does not exist gives `null` (`:39-41`). `null` is filtered out (`:54`), and `files.has(null)` is false (`:67`), so a path that does not exist is judged by its path only. Residual: uniqueness of (dev, ino) on drvfs or native Windows is a platform premise this checkout cannot decide. No test has an existing non-target file while the target exists: `withSpawns` creates no `idea.md`, so `:272-285` never computes an identity (🟢-4). |
| 6b | Can item 4 end a wait early on a lock that is held and readable? | bestätigt by reading | On a held, readable lock, `stat` succeeds and the lock is not stale. The only `lock-busy` throw is at `run-store.mjs:84`, after `Date.now() >= deadline`. A held lock older than `staleMs` is still broken (`:75-79`); that is unchanged and takes the lock rather than ending the wait. |

Mapping (contract rule 4): bestätigt and bestätigt + ergänzt → pass; widerlegt → block.

## Part B: concept v0.5.8 → v0.5.9, 8 hunks

Sources: ledger rows 225 (run 46), 226 (run 47) and 227 (synthesis at 09:57:32).

| Hunk | Supported by its source | Contradicts an unchanged line |
|---|---|---|
| 1. Version and as-of | yes, row 227 | no |
| 2. UC-01 Exit (252) | yes, row 226 NV-2 and row 227 (3) | No. Note: the P3 gate row (about line 381, unchanged) also lists decision-check and does not state the rule (🟢-6). |
| 3. UC-01 step 3 (270) and step 5.2 (275) | yes, rows 225 (🟡-1, 🟢-4), 226 (F-3, NV-3) and 227 (1), (2), (4) | Step 5.2: none. "abandon remain" fits line 1644, which says `abandon` comes with SL-8. Step 3: "fails closed … when `counters.json` … cannot be read" leaves the missing-file case open. `guard-phase.mjs:60` and the unchanged test `:287` let target writes pass when `counters.json` is missing, although `run.mjs:293` creates it (🟢-6). |
| 4. AC-12.21 (921) | Indirectly. The row 227 text does not name it; the run-46 report that row 225 cites does (`sl2-fix2-rv.md:40`). | No. Its test column names only `verdict-check.test.mjs` titles; the refusal is tested in `run.test.mjs:1769` (🟢-6). |
| 5. §5 table (1190) | yes, row 226 F-1 and row 227 (6) | no |
| 6. §5.3 (1232) | yes, rows 225 (🟡-2, 🟡-3), 226 F-2 and 227 (7) | No concept line conflicts. The unchanged clause "the role file states it" is no longer true of `agents/devils-advocate.md` (🟡-2). |
| 7. §11.3 item 3 (1644) | yes, row 226 (Auflage 2) and row 227 (5) | no |
| 8. Changelog 0.5.9 | yes, row 227 (decider stated) | no |

## Findings

### 🟡-1: a premise mark in a well-formed objection line slips through (claim 1, item 2)
**Closing proposal:** at `verdict-check.mjs:78-92`, test `PREMISE_MARK` (outside the block) on every line, the objection line included, not only in the `else` chain.

`checks/verdict-check.test.mjs`, no extra import. **Not executed.** Expected red now with `validator: 'valid'`.
```js
test('fires: a premise mark in the tail of a well-formed objection line outside the premises block rejects the capture', () => {
  for (const tail of [' -- unchecked', ' -- CHECKED: x.mjs:1']) {
    const r = validate({ objections: `${OBJECTION}${tail}` });
    assert.equal(r.validator, 'rejected', `${tail}: ${JSON.stringify(r)}`);
    assert.ok(r.reasons.some((x) => /premise row outside/.test(x)), `${tail}: ${r.reasons.join('; ')}`);
  }
});
```

### 🟡-2: the role file does not state the new reject causes
Concept line 1232 says "the role file states it". The reject list at `agents/devils-advocate.md:52` names none of the three new causes. `grep -i` for "anywhere", "outside the `premises`" and "fresh context: no" finds nothing in the file. Section 6 is headed "Objections"; if the role writes it as a natural heading `Objections:`, the capture is now rejected. The handback is denied once, and a second failure costs a new spawn.

**Closing proposal:** add the three causes to the Output paragraph. Suggested wording: no `objection`/`objections` followed by `:` anywhere except on an objection line; no `-- checked`/`-- unchecked` outside the `premises:` section; `fresh context: no` invalidates the pass.

`checks/devils-advocate-agent.test.mjs`, no extra import. **Not executed.** Expected red now at the first assertion.
```js
test('fires: the role file states every capture-form reject cause of concept §5.3 v0.5.9', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /anywhere/i, 'the objection-marker rule is not stated');
  assert.match(output, /outside the `premises:`/i, 'the premise-mark rule is not stated');
  assert.match(output, /fresh context: no/, 'fresh context no is not stated as invalidating the pass');
});
```

### 🟢-3: an invisible character inside a mark is not caught
This goes beyond the literal text of line 1232. `PREMISE_MARK` has no `\p{Cf}`, and no rule catches a format character inside the word `objection`.

**Closing proposal:** an owner ruling. If accepted, remove `\p{Cf}` from each line before the form tests and state that at line 1232.

`checks/verdict-check.test.mjs`, no extra import. **Not executed.** Expected red now: `{validator:'valid', verdict:'a'}`, then `objections:['F-P1-1']`.
```js
test('fires: an invisible character inside a premise mark or inside the objection word does not let the line slip past the capture form', () => {
  const premise = validate({ premises: 'premises:\n- a -- checked: x.mjs:1\n\n- b --\u200Bunchecked', objections: null });
  assert.ok(premise.validator === 'rejected' || premise.verdict === 'not-decidable', JSON.stringify(premise));
  const tail = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const word = validate({ objections: `${OBJECTION}\n${tail.replace('objection', 'obj\u00ADection')}`, verdict: 'verdict: b' });
  assert.ok(word.validator === 'rejected' || word.objections.includes('F-P1-2'), JSON.stringify(word));
});
```

### 🟢-4: no test shows the identity check leaves other existing files alone (claim 6a)
**Closing proposal:** add this pin.

`hooks/guard-phase.test.mjs`, extra import `copyFileSync` from `node:fs` (merge it into line 3). **Not executed.** Expected green. It should turn red under the mutation `` return `${st.dev}`; `` at `guard-phase.mjs:38``.
```js
test('fires: while the open target exists, a write to another existing file or to a copy of the target passes', () => {
  const w = world();
  const R = withSpawns(w, { toolu_a: { task: 'D-3' } });
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'A\n');
  writeFileSync(join(R, 'idea', 'other.md'), 'A\n');
  copyFileSync(join(R, 'idea', 'idea.md'), join(w.base, 'copy.md'));
  silent(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'other.md'), content: 'B\n' } }));
  silent(fire(w, { tool: 'Edit', input: { file_path: join(w.base, 'copy.md'), old_string: 'A', new_string: 'B' } }));
  denied(fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'idea.md'), content: 'B\n' } }), /D-3/);
});
```

### 🟢-5: no test bounds the wait on a held lock from below (claim 6b)
**Closing proposal:** add this pin.

`lib/run-store.test.mjs`, no extra import. **Not executed.** Expected green. It should turn red if `lock-busy` is thrown before the deadline (for example `if (true)` at `run-store.mjs:84`).
```js
test('fires: withLock keeps waiting on a held, readable lock until its deadline and only then reports lock-busy', () => {
  const lock = join(tempDir('cdp6-held-'), 'counters.lock');
  writeFileSync(lock, JSON.stringify({ pid: process.pid, at: Date.now() }));
  const started = Date.now();
  assert.throws(() => withLock(lock, () => 'ran', { waitMs: 300 }), (e) => e.code === 'lock-busy');
  const waited = Date.now() - started;
  assert.ok(waited >= 300, `withLock gave up after ${waited} ms`);
  assert.ok(existsSync(lock), 'the held lock was removed');
});
```

### 🟢-6: concept wording (owner ruling, no test)
- Line 270: state whether a missing `counters.json` passes (the code does) or denies.
- Line 921: add `scripts/run.test.mjs` "fires: object <capture id>:conflict reject is refused …" to the test column of AC-12.21.
- Line 252 against the P3 gate row (about line 381): either scope decision-check's `proposed` finding to P1, or state the rule for P3 before decision-check is registered there.

## Status
**Block.** Claim 1 is widerlegt in one point (item 2, 🟡-1). Claims 2, 4, 5 and 6 pass. Claim 3 passes by reading; its exact red counts are unklar until a run.

The worker did not cause 🟡-2: the fix brief did not name the role file. It still needs a fix or an owner ruling before SL-2 closes. The five counter-tests above are not executed; the orchestrator runs them.

## Returned claims
- The red counts for claim 3 ("only this test", "two older tests") are unklar (Werkzeug: no run grant). They go back to the orchestrator.
- Uniqueness of (dev, ino) on drvfs or native Windows is nicht entscheidbar here; it needs a platform probe.

## Commands run (all read-only)
- `git rev-parse HEAD` and `git status --short` on the sl2 worktree; `sha256sum` on the concept; `date -Is`
- `diff -r sl2-pre-fix3 sl2/plugins/cdp6-core`
- `sed -n … | diff -` and `sed -n … | grep -c -Fxvf` / `grep -Fxvf` against `sl2-fix2-rv.md` and `sl2-fix2-auditor.md`
- `grep -n` / `grep -rn` / `grep -rnE` over the code, tests, role file, concept and ledger
- `cat -n` and `sed -n` on the changed modules, tests, registry and concept
- `wc -l` on the changed files (they match the report's counts)
- `ls -la` on the retro directory

No command was refused.
