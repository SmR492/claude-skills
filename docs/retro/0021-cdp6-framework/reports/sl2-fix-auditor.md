# fresh adversarial-auditor of SL-2 after the combined fix (stage-1 run 43): final answer as handed back

Brief: `briefs/sl2-fix-auditor.md`. Returned through workflow wf_5e92fa18-424; paths normalised to `<repo>` and `<scratchpad>`.

contract: v2 f91736a60d15

**Verdict: FREIGABE-MIT-AUFLAGEN (pass-with-conditions).** I found no 🔴 defect. I confirmed three 🟡 defects and two 🟢 notes, and one item needs validation. None of the counter-tests below was executed.

Header: fresh context: yes. Conflict of interest: none. Target: worktree `.worktrees/sl2`, HEAD 960146b3f8e5884a4a9f93f1077e793cedd6e14a, uncommitted diff under `plugins/cdp6-core/`.

| Snapshot | Start | End |
|---|---|---|
| `git diff HEAD -- plugins/cdp6-core \| sha256sum` | 0aa3dbf7…02729 | unchanged |
| untracked core files (`agents/*`, the new hooks, `lib/*`, `verdict-check.mjs`), concatenated | 4f933f31…f8aac | unchanged |
| concept | 869d42f4…ee174 | unchanged |

## Confirmed findings

### F-A 🟡 The validator silently drops premise rows and objection lines that are slightly off-form
- **Assumption attacked:** "parses only this form" (concept §5.3, line 1232) means anything outside the form is rejected.
- **What the code does:**
  - Premise rows are read only as one block directly under `premises:` (`checks/verdict-check.mjs:105-109`). A `- … -- unchecked` row after a blank or wrapped line is neither counted nor rejected.
  - Objections are read only from lines that start with exactly `objection: ` (`:69`). A list-marked or capitalised objection line is ignored.
- **Effect:** an `a` that rests on an unchecked premise is counted as a pass, when it should be recorded as `not-decidable` (`:95`). A `b` clears with fewer owner records than it has objections (`decision-check.mjs:28-33`).
- **Expected result:** both tests red. The first gets `verdict: 'a'`, validator `valid`. The second gets `objections: ['F-P1-1']`, validator `valid`.

```js
// checks/verdict-check.test.mjs — no extra import
test('fires: a premise row after a break in the premises section is not dropped', () => {
  const r = validate({ premises: 'premises:\n- the index is append-only -- checked: lib/capture.mjs:109\n\n- no other writer touches verdicts/ -- unchecked', objections: null });
  assert.notEqual(r.verdict, 'a', JSON.stringify(r));
});

test('fires: an objection line with a list mark under verdict b is not dropped', () => {
  const second = '- objection: F-P1-2 | artefact: idea/idea.md | evidence: idea/idea.md:20 | refuted when: shown';
  const r = validate({ objections: `${OBJECTION}\n${second}`, verdict: 'verdict: b' });
  assert.ok(r.validator === 'rejected' || r.objections.includes('F-P1-2'), JSON.stringify(r));
});
```

### F-B 🟡 Editing and restoring `idea.md` while the devils-advocate runs gets past the stale check
- **Assumption attacked:** a fresh target hash means the verdict was given "against the artefact it judged".
- **Why it is real:**
  - Subagents run in the background (concept line 1530), and the devils-advocate reads the file itself (`agents/devils-advocate.md:4`, tools Read).
  - Nothing enforces "idea.md is not edited after that spawn". It is prose only (`skills/idea/SKILL.md:35`). `hooks/guard-phase.mjs:41-55` judges only `run.mjs enter`.
  - The gate compares only the spawn-time hash with the snapshot (`verdict-check.mjs:125-141`).
- **Scenario:** the brief targets content A. The main session writes B, the devils-advocate reads B and answers `a`, the main session restores A, then the owner decides. The capture counts as fresh.
- **Known items checked:** the SL-3 spawn-time check (F2) does not cover this sequence, and the S/ write gap (SL-4) is a different path.
- **Expected result:** exit 0, so the test is red. It pins one possible enforcement point; any fix that denies this sequence is equivalent.

```js
// hooks/guard-phase.test.mjs — extra import: import { createHash } from 'node:crypto';
test('fires: a Write to idea/idea.md while a devils-advocate spawn naming it as target is open is denied', () => {
  const w = world();
  const R = makeRun(w, { states: { idea: 'entered' } });
  const sha = createHash('sha256').update('A\n').digest('hex');
  writeFileSync(join(stateOf(w), 'counters.json'), JSON.stringify({ version: 1, pending: { toolu_9: { tool_use_id: 'toolu_9', agent_type: 'cdp6-core:devils-advocate', task: 'D-1', role: 'devils-advocate', targets: [{ path: 'idea/idea.md', sha256: sha }], header: 'ok', at: new Date().toISOString(), agent_id: 'agent-9' } } }));
  const res = fire(w, { tool: 'Write', input: { file_path: join(R, 'idea', 'idea.md'), content: 'B\n' } });
  assert.equal(res.status, 2, `${res.stdout}${res.stderr}`);
});
```

### F-C 🟡 A conflicted capture with no objections and no premises leaves a decided D-1 with no way out
- **Assumption attacked:** a conflicted capture "stays blocking until the owner's `run.mjs object` records" (concept 1644, AC-12.21), so some owner action can always clear it.
- **Trace:**
  - The capture says `conflict of interest: <stake>`, `premises: none, …`, `verdict: a`. It yields no items (`verdict-check.mjs:99`), so the gate reports "lists no objection or premise to record" (`decision-check.mjs:15`).
  - The owner cannot record anything: `run.mjs object` refuses every id (`run.mjs:424`, `verdict-index.mjs:78`).
  - Making it stale does not help. A new capture comes after the fixed decided stamp, so it fails (`decision-check.mjs:22-24`).
  - D-1 cannot be decided again (`run.mjs:444`), and `idea-check.mjs:35-37` requires it decided.
- **Effect:** the run stays stuck at P1 until `abandon` (SL-8) or a hand edit. The role file invites exactly this shape (`agents/devils-advocate.md:71` with a stake). Test `decision-check.test.mjs:181` encodes the block, but not the missing way out.
- **Expected result:** exit 1 with "lists no objection or premise to record", so the test is red. The assertion follows the concept's per-item rule (no items, so nothing left to record); a capture-level record id would be another valid fix.

```js
// checks/decision-check.test.mjs — no extra import
test('fires: a conflicted capture without objections or premises can still be cleared once its D-n is decided', () => {
  const R = fixture({ captures: [capture({ conflicted: true, text: captureText({ verdict: 'a', conflicted: true }) })] });
  const r = check(R);
  assert.equal(r.status, 0, r.out);
});
```

### F-D 🟢 One deny-once marker for all causes takes away the restate after a form failure
- **Trace:** a failed acknowledgement or `run:` line sets the marker (`check-handback.mjs:106`, `:117`). The next handback's form failure is then skipped (`:120`, `!asked`) and captured as `rejected`.
- **Conflict with the concept:** UC-12 step 4 says a form failure "is denied once with the reasons, so the role can restate".
- **Effect:** fails closed, but costs one more devils-advocate run (an O14 round once SL-3 counts rounds).
- **Expected result:** exit 0 and an index line with `validator: rejected`, so the test is red.

```js
// hooks/check-handback.test.mjs — no extra import
test('fires: a form failure after an acknowledgement failure is still denied once, so the role can restate', () => {
  const w = world();
  denied(fire(w, { message: msg({ ack: 'no ack' }) }));
  const res = fire(w, { message: msg({ body: BODY.replace('premises: none, no existing code or data touched\n', '') }) });
  denied(res, /capture form fails/);
});
```

### F-E 🟢 The gate reads the verdicts without the capture lock, so it can count a capture that is then rolled back
- **Trace:** `rereadCaptures` (`verdict-check.mjs:162`) takes no `verdicts.lock`. Between the index append (`capture.mjs:109`) and a failing `counters.json` write (`counters.mjs:94`), a concurrent `run.mjs exit` sees the file and its index line and passes D-1. The rollback (`capture.mjs:114`) then deletes the capture and the handback is denied.
- **Likelihood:** very low (needs a failing counters write in a window of microseconds).
- **Expected result:** `seen` is `[]`, so the last assertion is red.

```js
// lib/capture.test.mjs — extra imports: import { initRun } from './run-store.mjs'; import { checkDecisions } from '../checks/decision-check.mjs';
test('fires: a gate that reads the index between the append and a failing counters write counts a capture that the rollback then removes', () => {
  const S = mkdtempSync(join(tmpdir(), 'cdp6-capture-gate-'));
  writeFileSync(join(S, 'counters.json'), '{"version":1}\n');
  const target = { path: 'idea/idea.md', sha256: sha('current\n') };
  addPending(S, { tool_use_id: 'toolu_g', agent_type: TYPE, task: 'D-1', role: 'devils-advocate', targets: [target], header: 'ok', at: '2026-11-03T10:00:00.000Z' });
  bindPending(S, TYPE, 'agent-g');
  initRun(S, { run_id: 'RUN-1', status: 'active', ids: { next: { D: 2 } }, decisions: { 'D-1': { status: 'decided', decider: 'owner', stamps: [{ status: 'proposed', at: '2026-01-01T00:00:00.000Z', decider: 'operator' }, { status: 'decided', at: '2099-01-01T00:00:00.000Z', decider: 'owner' }] } }, owner_records: [], phases: {} });
  const snap = mkdtempSync(join(tmpdir(), 'cdp6-capture-snap-'));
  mkdirSync(join(snap, 'idea'));
  writeFileSync(join(snap, 'idea', 'idea.md'), 'current\n');
  mkdirSync(join(S, `counters.json.${process.pid}.tmp`));
  let seen;
  const appendThenGate = (file, data, options) => {
    appendFileSync(file, data, options);
    seen = checkDecisions(S, snap);
  };
  const spawn = JSON.parse(readFileSync(join(S, 'counters.json'), 'utf8')).pending.toolu_g;
  assert.equal(codeOf(() => capture(S, { message: VALID, agentType: TYPE, agentId: 'agent-g', toolUseId: 'toolu_g', spawn, append: appendThenGate })), 'capture-failed');
  assert.equal(existsSync(join(S, 'verdicts', 'D-1-devils-advocate-agent-g.md')), false);
  assert.notDeepEqual(seen, [], 'the gate passed D-1 on a capture that the rollback removed');
});
```

## Needs validation

**NV-1:** does making a capture stale drop a conflicted or (c) block?
- `decision-check.mjs:12-13` drops stale captures before the conflicted check, and test `decision-check.test.mjs:232` encodes that.
- So a no-op edit of `idea.md` plus a fresh devils-advocate run avoids the owner records that C13 and AC-12.21 require ("a second capture of a fresh devils-advocate instance does not clear it").
- The open question is a concept ruling: which wins, the stale rule (O15) or C13. It does not sit on a claimed precondition.
- Expected result: exit 0, so the test is red.

```js
// checks/decision-check.test.mjs — no extra import
test('fires: a conflicted capture is not dropped by an edit of its target followed by a fresh devils-advocate capture', () => {
  const R = fixture({ captures: [capture({ conflicted: true, objections: ['F-P1-1'], targets: [old], stamp: T1 }), capture({ id: 'V-cap-2', targets: [live], stamp: '2026-01-01T10:30:00.000Z' })] });
  const r = check(R);
  assert.equal(r.status, 1, r.out);
  assert.match(r.out, /V-cap-1:F-P1-1 of a conflicted capture/);
});
```

## Rejected candidates
- **Capture id containing `:` or an edge-case task:** the SAFE and TASK patterns (`capture.mjs:11,82`, `brief.mjs:8`, `verdict-index.mjs:10`) rule it out.
- **Record naming an item of another, stale or rejected capture:** ids are matched exactly, scoped by capture id (`verdict-index.mjs:81-83`), and rejected captures carry no items.
- **Target-less capture of another role counted:** `decision-check.mjs:44` keeps only devils-advocate captures.
- **`reconciliation: not built` read as a pass:** it is only written (`run.mjs:547,578,583`) and never read.
- **`run.mjs object` called by a worker:** denied (`guard-shell.mjs:64`); it is an owner command behind an ask.
- **A hook crash that exits 0:** every deny path in `check-handback.mjs:130-150` and `guard-spawn.mjs:57-77` returns 2. A checker that crashes exits 1 and is counted as a failure; any other non-zero exit refuses with `checker-error` (`run.mjs:565-566`).
- **Rollback after a partial append:** it fails closed and is tested (`capture.test.mjs:202`).
- **Two unbound spawns of one role:** nothing is bound (`counters.mjs:72`), so nothing is captured.
- **Case or Unicode variants of a capture file name:** the file name pattern is ASCII only, and a name collision is refused with `capture-exists`.
- **Symlinks, equal-sha replacement, two index lines for one file:** all need S/ writes, which is the known SL-4 gap.
- **Getting a pass by re-running the devils-advocate:** the "latest capture wins" rule is intended (UC-12 step 5), and the round cap (O14) comes in SL-3.

## Auflagen
1. **F-A, precondition for acceptance (issue):** reject a capture with any `-`-row outside the premise block, or any line that looks like an objection (e.g. `^\W*objection\b`, case-insensitive) but is not a well-formed `objection:` line.
2. **F-B, precondition for acceptance (ledger 0021 and the live-run record):** either enforce "no write to an open spawn's target", or add to the §11.3 item 3 hand check: no Write or Edit to `idea.md` between the devils-advocate spawn and its handback, read from the transcript.
3. **F-C, precondition for acceptance (issue plus a concept line):** give the owner a way to clear a conflicted capture that has no items.
4. **F-D and F-E, follow-up (issues):** one marker per cause (or form-specific); take the verdicts lock while the gate reads.
5. **NV-1, follow-up:** an owner or concept ruling.

## Audit protocol
1. **Header and hashes:** see the top.
2. **Path, not only result:** read the hook → capture → gate order (`check-handback.mjs:95-128`, `capture.mjs:80-126`, `run.mjs:532-592`). This gave F-B and F-E.
3. **Author's unchecked list:** no access path to one; I used the brief's attack list instead.
4. **Fail-open, ordering and races:** F-A, F-B, F-E.
5. **Preconditions:** the concept sections the brief names were read in context (UC-01 242-300, UC-12 872-925, §5 row 1190, §5.3 1210-1234, C1/C11/C13, §11.3 1644). No precondition is open.
6. **Counter-tests:** written, not executed (no run grant).
7. **Coverage** below.
8. **Finding states:** as listed.
9. **Verdict:** above.
10. **Escalation:** no 🔴 finding and no open precondition, so nothing goes to the human under §23.3.
11. **Fixed checks:** below.

**Coverage:** checked in full:
- `hooks/guard-spawn.mjs`, `hooks/inject-contract.mjs`, `hooks/check-handback.mjs`, `hooks/hooks.json`
- `lib/brief.mjs`, `lib/counters.mjs`, `lib/capture.mjs`, `lib/verdict-index.mjs`, `lib/contract.mjs`, `lib/agent-name.mjs`, `lib/capture-fixture.mjs`
- `checks/verdict-check.mjs`, `checks/decision-check.mjs`
- `run.mjs` `object` (410-435), `decision` (444-473) and `exit`/`approve` (475-621)
- `skills/idea/SKILL.md`, `agents/devils-advocate.md`
- by grep only: `checks/registry.json`, `guard-shell.mjs:55-90`, `guard-phase.mjs:20-60`

Not checked: `generate-contract.mjs`, `skills/worker-contract/`, `run-store.mjs` beyond `initRun`/`readRun`, and the test files beyond their helpers.

**Personal data:** none in the object or in this report. **Search filters:** grep for `object|exit|verdict|capture|rereadCaptures|checkCaptures|unclearedItems|hasItem|isStale|decision` in `run.mjs`; `decision|decided|D-|proposed|owner` in `idea-check.mjs`; `reconciliation` across `*.mjs`; `pending|counters|idea.md|Write|Edit` in `guard-phase.mjs` (no hits; its own `deny|tool_name|phase` lines served as the positive control); and concept greps for `not edited after|background|later round|O14|S/verdicts/`.

**Hash check at end:** all three values unchanged.
