# fresh adversarial-auditor of SL-2 after the second fix (stage-1 run 47): final answer as handed back

Brief: `briefs/sl2-fix2-auditor.md`. Returned through workflow wf_370a5751-36f; paths normalised.

contract: v2 f91736a60d15

The verdict is FREIGABE-MIT-AUFLAGEN: I found no path that lets the P1 gate pass a capture it should not count, but there are three 🟡 defects (two leave residual gaps in F-A and F-B) and three open validation items.

**Header**
- fresh context: yes
- conflict of interest: none. I did not see runs 39 or 43 and wrote no part of the object.
- target: worktree `<repo>/.worktrees/sl2`, HEAD 960146b3f8e5884a4a9f93f1077e793cedd6e14a plus the uncommitted SL-2 diff. Concept `<repo>/docs/cdp6/konzept-cdp6.md`.
- snapshot at start:
  - `git diff | sha256sum` = 406460887ceaaecfdfea8fda7ebf8bf437dd917bbf812f656bfe172ecaa0006b
  - sha256 over all untracked files in `plugins/cdp6-core` = a6ed03aafcab1dcc9a2b8d12f4c1678c7e9f8a6a2126b79678d77d3694c33089
  - concept = 57942ee3e5cf3c6fd17491498a165ea31285ce761a0e9f7f26940aaa9a27be96
- environment: none. I ran read-only commands only. Every counter-test below is **not executed**.

**Verdict:** FREIGABE-MIT-AUFLAGEN, which maps to pass-with-conditions.

## Confirmed findings

### F-1 🟡 A dangling-symlink or directory `verdicts.lock` hangs the gate and the capture instead of failing closed within the wait
- **Assumption attacked:** a lock that the main session creates is answered with a bounded, named finding.
- **Code path:**
  - `lib/run-store.mjs:68-74`: `openSync(lock,'wx')` gets EEXIST, then `statSync` throws ENOENT on a dangling symlink, then `continue`. This skips the deadline check at :84 and has no sleep, so the loop spins without end.
  - `lib/run-store.mjs:75-81`: a directory older than `DEFAULT_STALE_MS` (10 s, :36) makes `unlinkSync` throw EISDIR or EPERM, then `continue`, with the same result.
  - The gate path is `checks/verdict-check.mjs:217`, reached through `checks/decision-check.mjs:346`.
  - `scripts/run.mjs:562` calls the checker with `spawnSync` and no timeout, so `run.mjs exit idea` hangs. `check-handback` runs until its hook timeout of 10 s (`hooks/hooks.json`).
- **Why not 🔴:** it never passes the gate. It only hangs, and the owner can remove the lock by hand. It contradicts the suite's own "the gate waited without bound" assertion (`checks/verdict-check.test.mjs`, lock test). The same loop guards `run.lock` and `counters.lock`.
- **Counter-test.** Append to `plugins/cdp6-core/checks/verdict-check.test.mjs`. Extra imports: `symlinkSync`, `utimesSync` from `node:fs`.
```js
test('fires: a dangling-symlink or old-directory verdicts.lock fails the gate closed within its wait instead of hanging', () => {
  const snap = snapshotWith({ 'idea/idea.md': 'current\n' });
  const R1 = decided({ captures: [FRESH] });
  symlinkSync(join(R1, 'no-such-target'), join(R1, 'verdicts.lock'));
  const R2 = decided({ captures: [FRESH] });
  mkdirSync(join(R2, 'verdicts.lock'));
  utimesSync(join(R2, 'verdicts.lock'), new Date(Date.now() - 60000), new Date(Date.now() - 60000));
  for (const R of [R1, R2]) {
    const r = spawnSync(process.execPath, [VERDICT_CHECK, '--run-dir', R, '--snapshot', snap], { encoding: 'utf8', timeout: 5000 });
    assert.equal(r.signal, null, 'verdict-check did not end within 5 s');
    assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
    assert.match(r.stdout, /verdict-check FAIL verdicts\.lock:/);
  }
});
```
- **Expected result:** red. `r.signal === 'SIGTERM'` from the loop at `run-store.mjs:73` and :80.

### F-2 🟡 Remaining F-A gap: some off-form premise rows and objection lines are silently ignored, so the gate passes without them
- **Assumption attacked:** an off-form premise row or objection line rejects the capture (§5.3; UC-12 error row "…outside the capture form… rejected").
- **Code path:**
  - `checks/verdict-check.mjs:52`: `PREMISE_ROW_LIKE` needs a `[-*+•]` mark and an exact tail `-- (checked: …|unchecked)\s*$`.
  - `:119`: the section ends at the first line that does not start with `- `.
  - `:51`: `OBJECTION_LIKE` allows only `[\s\-*+•>#\d.)]` before `objection`.
  - These lines therefore match nothing and are dropped:
    - a numbered row such as `1. b -- unchecked`;
    - a dash row after a break whose tail goes past `unchecked`, e.g. `- b -- unchecked (not verified)`, `- b -- Unchecked`, or `- b\t-- unchecked`;
    - an objection inside a table row (`| objection: …`), a code span, or after U+200B, which is not in JS `\s`.
  - The result: the verdict stays `a` and is not set to `not-decidable` (:104), or objection F-P1-2 never reaches `objections` and so needs no owner record. `decision-check.mjs:330-336` then passes.
- **Asymmetry:** objection lines accept numbered marks (the test in `verdict-check.test.mjs` uses `1. ${line}`), but premise rows do not.
- **Why 🟡:** this is DA-format robustness. The brief that the main session writes can steer the DA's layout, so a model-written input can drop objections, but the same brief could also steer the verdict itself.
- **Counter-test.** Append to `plugins/cdp6-core/checks/verdict-check.test.mjs`. No extra import.
```js
test('fires: an unchecked premise in a numbered row or after a break with a longer tail, and an objection in a table row, code span or after a zero-width space, are not dropped', () => {
  for (const [name, premises] of [
    ['numbered row after the section', 'premises:\n- a -- checked: x.mjs:1\n1. b -- unchecked'],
    ['dash row after a break, text after unchecked', 'premises:\n- a -- checked: x.mjs:1\n\n- b -- unchecked (not verified)'],
    ['dash row after a break, Unchecked', 'premises:\n- a -- checked: x.mjs:1\n\n- b -- Unchecked'],
    ['dash row after a break, tab before --', 'premises:\n- a -- checked: x.mjs:1\n\n- b\t-- unchecked'],
  ]) {
    const r = validate({ premises, objections: null });
    assert.ok(r.validator === 'rejected' || r.verdict === 'not-decidable', `${name}: ${JSON.stringify(r)}`);
  }
  const tail = 'objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  for (const [name, second] of [['table row', `| ${tail} |`], ['code span', `\`${tail}\``], ['zero-width space', `\u200B${tail}`]]) {
    const r = validate({ objections: `${OBJECTION}\n${second}`, verdict: 'verdict: b' });
    assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), `${name}: ${JSON.stringify(r)}`);
  }
});
```
- **Expected result:** red on every case. Each returns `{validator:'valid', verdict:'a'}`, or `objections:['F-P1-1']` for the objection cases.

### F-3 🟡 Remaining F-B gap: the guard-phase target deny compares path strings, not files
- **Assumption attacked:** `Edit`, `Write` and `NotebookEdit` on the file of an open DA target are denied (UC-01 step 3).
- **Code path:** `hooks/guard-phase.mjs:35-37` and :55 compare `resolve` and JS `realpathSync` strings.
  - A hard link outside R (`ln R/idea/idea.md /tmp/a`) has a different string and is not a symlink, so the guard passes it.
  - On a case-insensitive file system (macOS default, Windows, case-insensitive drvfs folders), `R/IDEA/IDEA.MD` is passed too: JS `realpathSync` does not change letter case.
- **Why the hand check misses it:** the §11.3 item 3 hand check (concept 1644) only looks for a Bash command that *writes* the target, and `ln` writes nothing to it. The concept already treats hard links as a bypass class and requires device and inode identity elsewhere (UC-09 step 1.4, line 737).
- **End-to-end status:** see NV-1.
- **Counter-test.** Append to `plugins/cdp6-core/hooks/guard-phase.test.mjs`. Extra import: `linkSync` from `node:fs`.
```js
test('fires: a Write to the open target through a hard link or another letter case is denied', (t) => {
  const w = world();
  const R = withSpawns(w, { toolu_a: { task: 'D-3' } });
  mkdirSync(join(R, 'idea'), { recursive: true });
  writeFileSync(join(R, 'idea', 'idea.md'), 'A\n');
  const alias = join(w.base, 'alias.md');
  linkSync(join(R, 'idea', 'idea.md'), alias);
  denied(fire(w, { tool: 'Write', input: { file_path: alias, content: 'B\n' } }), /D-3/);
  if (existsSync(join(R, 'IDEA', 'IDEA.MD'))) denied(fire(w, { tool: 'Edit', input: { file_path: join(R, 'IDEA', 'IDEA.MD'), old_string: 'A', new_string: 'B' } }), /D-3/);
  else t.diagnostic('case branch not reached: file system is case-sensitive');
});
```
- **Expected result:** red on the hard-link case on any OS (status 0, because `openTargetTask` returns null). The case branch is red only on a case-insensitive file system.

## Needs validation (no severity)
- **NV-1:** whether Claude Code's `Write` and `Edit` (version ≥ 2.1.295) write in place, which keeps the inode and modifies the target through a hard link, or write a temp file and rename it. This decides whether F-3 lets the DA judge V2 while the capture is bound to H(V1), restored after the capture.
- **NV-2:** whether the UC-01 Exit row ("every `D-n` … has a captured verdict … before its decided stamp") lets a `D-n` stay `proposed` at exit. `decision-check.mjs:351` skips such a decision, and `idea-check.mjs:35` checks D-1 only.
- **NV-3:** what the owner `reject` of a premise of a conflicted capture that has items is meant to do. `decision-check.mjs:305` stops only a no-item capture from counting, so a conflicted `a` whose premises were all rejected still counts as a pass. The code matches 5.2 as written; whether that is the intended meaning is the open question.

## Rejected candidates
- **`:conflict` record on a capture that is not conflicted or has items:** refused by `verdict-index.mjs:346` through `run.mjs:424`.
- **`:conflict` record on a stale capture or one of another decision:** it is scoped by capture id, and a stale capture is excluded at `decision-check.mjs:318`.
- **Conflicted rejected capture with shaped items:** it only adds findings (:313-316), and `mine` excludes it (:322).
- **A main-session `verdicts.lock` (regular file):** gives a named lock-busy finding (`verdict-check.mjs:215-221`). A stale one is broken and the read goes ahead normally.
- **Second `verdict:` line in a code block:** rejected (:73-74).
- **Unicode-space or tab before `objection`:** caught by JS `\s` (:51).
- **CR line ends:** normalised (:15).
- **A stale capture counted at the gate:** the `live` filter (:318) and `isStale` with no targets (:149).
- **Symlinks inside or outside R:** resolved by `real()` (`guard-phase.mjs:27`).
- **Unbound or failed-close spawn:** still denied (:52 checks only `closed_at` and `void`).
- **Two spawns on one target:** both checked.
- **Target outside R:** stale at the gate.
- **MultiEdit:** does not exist in 2.1.314 (concept 1693).
- **Second deny for the same cause:** only when the marker write fails (`check-handback.mjs:39-46`), which keeps denying, so it fails closed.
- **Capture without a deny:** the form deny is per cause (:124).
- **SendMessage resume taking a new pending spawn** (`counters.mjs:126`): `boundSpawn` returns the older closed entry, so it ends in capture-exists, which fails closed.

## Auflagen
1. **F-2:** reject the listed off-form lines, or record them as items. Class: precondition for acceptance (F-A was a precondition). Record: SL-2 review record and ledger 0021.
2. **F-3:** compare by device and inode (stat of the written path against the target), or widen the §11.3 item 3 hand check to link creation and alias writes. Resolve NV-1 first. Class: precondition for acceptance (F-B residual). Record: ledger 0021.
3. **F-1:** after a stat or unlink failure, check the deadline in `withLock`. Class: follow-up issue.

## Audit protocol
- **Header:** done above.
- **Result vs path:** ordering traced from spawn to bind to handback to capture to gate (files below). The capture happens before close, inside both locks, with rollback (`capture.mjs:250-283`).
- **Author's not-checked list:** not supplied; I used the brief's attack list instead.
- **Fail-open search:** every lock-busy, unreadable, malformed and missing branch traced. All fail closed, except the unbounded loop in F-1.
- **Preconditions:** concept UC-01 3 and 5.2, UC-12 2-5 with its error rows, §5.3 and 1644 read in context. No literal violation, so no SPERRE. F-2 and F-3 are residuals.
- **Counter-tests:** three delivered, not executed.
- **Severity:** by impact. No pass of the gate was shown.
- **Fixed checks:** see below.

## Coverage
Checked:
- `hooks/guard-phase.mjs`, `guard-spawn.mjs`, `inject-contract.mjs`, `check-handback.mjs`, `hooks.json`
- `lib/brief.mjs`, `counters.mjs`, `capture.mjs`, `verdict-index.mjs`, `contract.mjs`
- `lib/run-store.mjs` (`withLock`, `findRun`, `loadActive` only)
- `checks/verdict-check.mjs`, `decision-check.mjs`, `idea-check.mjs` (the D-1 part), `registry.json`
- `scripts/run.mjs` `object`, `decision`, `exit` (lines 405-592)
- `agents/devils-advocate.md`
- concept lines 262-282, 872-912, 1188-1240, 1640-1648, the 737 excerpt and the 1693 excerpt

Not checked:
- `skills/idea/SKILL.md` beyond its diff
- concept §7.1 C1, C11 and C13 (1344-1372) as separate text; reached only through UC-12 step 5
- test files beyond their helpers
- `lib/run-argv.mjs` and `guard-shell.mjs` (the owner `ask` on `object`)

## Personal data and search filters
- **Personal data:** none in the object or in these results.
- **Search filters:**
  - `grep -n` on run.mjs for object, decision, exit and conflict
  - `grep -rn "void"` over the plugin's non-test `.mjs` files, with a positive control (the hit at `guard-phase.mjs:52`)
  - `grep` in the concept for MultiEdit and for hard link, case-insensitive and inode
  - `grep -n "^test("` in the two test files

## Hash check at end
Unchanged: 406460887ceaaecfdfea8fda7ebf8bf437dd917bbf812f656bfe172ecaa0006b, a6ed03aafcab1dcc9a2b8d12f4c1678c7e9f8a6a2126b79678d77d3694c33089, 57942ee3e5cf3c6fd17491498a165ea31285ce761a0e9f7f26940aaa9a27be96, HEAD 960146b3f8e5884a4a9f93f1077e793cedd6e14a.
