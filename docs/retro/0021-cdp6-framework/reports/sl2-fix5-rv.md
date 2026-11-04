# review-verify of the SL-2 fix of the build-review findings and concept v0.5.12 to v0.5.13 (stage-1 run 58): final answer as handed back

Brief: `briefs/sl2-fix5-rv.md`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes (no part of the fix, its report or concept v0.5.13)

Outcome: block. The fix does what items 1 to 4 ask, but claim 5 is refuted. `verdict-check.mjs:132` skips every line that starts with `disposition:`, including lines that are not in the g4 form. So in a rejected conflicted capture, an objection id on such a line still gets through the gate with no owner record (🔴 R1).

Target state: `git -C <repo>/.worktrees/sl2 rev-parse HEAD` returned 960146b3f8e5884a4a9f93f1077e793cedd6e14a, matching the brief. `sha256sum konzept-cdp6.md` returned f23e54f878e71fc43c6ced947f7516f48194ef356ce1774611535adb8b42349e, matching the brief. The whole `diff -r <repo>/.worktrees/sl2-pre-fix5 <repo>/.worktrees/sl2/plugins/cdp6-core` output read. `git status` shows changes only under `plugins/cdp6-core/`. No tests run, no files written.

Verdict mapping: bestätigt and bestätigt + ergänzt → pass; widerlegt → block; unklar and nicht entscheidbar returned without a verdict.

## Part A: claims (author of every claim: the impl-uc worker of run 57)
| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1 | Is each item built, and does a test assert it? | bestätigt + ergänzt | Item 1: `verdict-check.mjs:126,130-134` (`fileObjectionIds`); `capture.mjs:87,71` puts the result on the index line; `check-handback.mjs:123` calls `capture`; `run.mjs:424` checks `hasItem` against the index (`verdict-index.mjs:125`); the gate is `decision-check.mjs:11-16,32-34`; no `:capture` for a conflicted capture: `verdict-index.mjs:110`, `decision-check.mjs:34`, pinned by `run.test.mjs:1816`. Tests: `verdict-check.test.mjs:811`, `capture.test.mjs:336`, CT-1 at `decision-check.test.mjs:685`. Item 2: `devils-advocate.md:52` (separator), `:61` (Output step 8), `:33`; tests at `devils-advocate-agent.test.mjs:110,115,121`. Item 3: `verdict-index.mjs:134-135`, CT-2 at `decision-check.test.mjs:699`. Item 4: `decision-check.mjs:82-88`, tests at `:706`, `:711`. Gap: no test runs `run.mjs object` on an id in prose; the chain is covered in pieces (validator, index line, `hasItem`), as the worker's report says. |
| 2 | Are CT-1, CT-2, CT-3, CT-4, CT-5, CT-6a and CT-6b in the tree verbatim? | bestätigt | The `diff -r` add hunks compared line by line with `sl2-build-table-rv.md:50-62, 69-72, 77-81, 88-92, 99-104, 111-114, 119-124`: identical. Locations: `decision-check.test.mjs:685,699,706`, `devils-advocate-agent.test.mjs:110,115`, `verdict-check.test.mjs:839,845`. |
| 3 | Would each named mutation turn the named test red? | bestätigt (by reading) | CT-6b: with `fourFields` returning true the piped line's fields still parse (`fieldsOf`, `:18-25`; `wc -l` has no key) and the evidence matches `EVIDENCE`, so the capture becomes valid and the test goes red; the worker's note that `>= 4` stays green is right (`parts[3]` is `wc -l`). CT-4: removing `:91-93` leaves nothing rejecting, red. Quote and disposition exclusions removed: F-P1-5 or F-P1-6 enters the `deepEqual` at `verdict-check.test.mjs:827`, red. Finding without its value: the `includes` at `decision-check.test.mjs:714`, red. Output step 8 reverted: `devils-advocate-agent.test.mjs:124`, red. Last record wins: `given` becomes `reject`, CT-2 status 0, red. Only a run decides "two tests failed" for CT-4 and whether `readRun` keeps duplicate records. |
| 4 | Was any test weakened, removed or skipped? | bestätigt | Every test-file hunk is a pure add (`683a684,718`, `108a109,126`, `810a811,850`, `335a336,345`); no `c` or `d` hunks in test files; no skip, todo or only. The role-text changes are required by item 2 (`devils-advocate.md:61` dropping "per objection" is F3). The pin at `devils-advocate-agent.test.mjs:47` still matches `:33`. |
| 5 | Does any objection id reach a passing gate without an objection line or a record, except ids in `> ` quote lines and disposition lines? Is any capture the role file asks for rejected? | widerlegt (first half); bestätigt (second half) | Fact: `fileObjectionIds` filters out `l.startsWith('disposition:')` (`verdict-check.mjs:132`), including lines `DISPOSITION` rejects (`:97-98`, `verdict-index.mjs:11`); so `disposition: F-P1-2 is the larger defect` rejects the capture and F-P1-2 never becomes an item. g4 (concept:1241) defines a disposition line as "in the form of the disposition paragraph"; any other line is g6 prose, and §0 item 30 (2) (concept:39) makes ids in prose items. Trace: items [F-P1-1]; a record on it clears `conflictFindings`; `:34` adds nothing for a conflicted capture; a later valid pass passes `settle`. Other cases: valid captures allow ids only on objection, quote or disposition lines (`:96-103`); a rejected, not conflicted capture blocks through `:capture` (`decision-check.mjs:34`), without a (b) or (c) verdict it does not block (concept:1255). Role file: `devils-advocate.md:52,61,63-73` asks for nothing the validator rejects. |
| 6 | Does "a missing or null `ids.next.D` fails" agree with `run.mjs`? Does a run with no `D-n` now fail a gate it should pass? | fact bestätigt, agreement widerlegt, harm none at present | Fact: `run.mjs:313` writes `ids: { next: {}, provisional: {} }`; `run.mjs:461` and `run-store.mjs:183` treat a missing value, and null, as 1 (`?? 1`). Agreement: `decision-check.mjs:82-87` fails both. Reachability now: `decision-check` is registered only for `idea` (`registry.json:24-35`); `idea-check.mjs:35-37` needs D-1 decided, which needs `next.D ≥ 2` (`run.mjs:461`); so no run currently reaches a passing idea gate with no `D-n`. Later: concept:255 runs `decision-check.mjs` at every phase exit that runs it; a run with an imported idea phase and no `D-n` would then fail. The table head (concept:1243) never defines a missing value, so the worker's reading is a choice the concept does not settle (🟢 R3). |

## Part B: concept diff v0.5.12 to v0.5.13
| Hunk | Supported by | Contradicts an unchanged line |
|---|---|---|
| @@-1 version and as-of | §0 item 30 (editorial) | no |
| @@-36 new §0 item 30 | the owner answers quoted in the brief; `sl2-build-table-rv.md:133` asked for this ruling | not directly; §11.3 still reads as if the live P1 run fits in the cap (concept:1682 "it stays 58 whatever the figure", the checkpoint guarantee at :1686), while item 30 (1) says the P1 run needs a new cap decision (🟢 R4) |
| @@-274 UC-01 step 5.2, "not conflicted" | `rv.md:35`; item 30 (2) | no; now agrees with AC-12.32 (concept:934) |
| @@-1233 disposition paragraph, `upheld` tied to SL-5 and g4 | `rv.md:40,127` | no; agrees with g4 (concept:1241) |
| @@-1241 table head, malformed `ids.next.D` | `rv.md:107` (F5) | no; AC-12.31 (concept:933) does not list the rule; the head is silent on a missing value |
| @@-1249 row "`conflicted`, rejected" | item 30 (2); `rv.md:46` | no; agrees with UC-12 step 5 (concept:886) and AC-12.32; "disposition lines" is the term the code reads more widely than g4 (R1) |
| @@-2322 changelog 0.5.13 | editorial | no |

## Findings
**🔴 R1 (code): an objection id on a `disposition:` line not in the g4 form passes the gate without a record when the capture is rejected and conflicted** (the effect of run 56 F1 through a narrower path). Proposal: in `fileObjectionIds`, exclude only lines that match `DISPOSITION` (imported at `verdict-check.mjs:7`): `!DISPOSITION.test(l)` in place of `!l.startsWith('disposition:')`.

R1a, `plugins/cdp6-core/checks/verdict-check.test.mjs`, no extra import, not executed, expected red now (`objections` is `['F-P1-1']`):
```js
test('rv58 R1: a rejected conflicted capture returns an objection id that stands on a line starting with disposition: outside the disposition form', () => {
  const r = validate({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\ndisposition: F-P1-2 is the larger defect and stays open`, verdict: 'verdict: b' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  assert.ok(r.reasons.some((x) => /is a disposition line not of the form/.test(x)), r.reasons.join('; '));
  assert.deepEqual(r.objections, ['F-P1-1', 'F-P1-2']);
});
```

R1b, `plugins/cdp6-core/checks/decision-check.test.mjs`, no extra import, not executed, expected red now (status 0, "decision-check OK"):
```js
test('rv58 R1: a rejected conflicted capture does not leave the gate on the record of its first objection while a second objection id stands on a disposition: line outside the disposition form', () => {
  const base = captureText({ task: 'D-1', verdict: 'b', objections: ['F-P1-1'], conflicted: true });
  const text = `${base}disposition: F-P1-2 is the larger defect and stays open\n`;
  const rejected = capture({ verdict: null, validator: 'rejected', objections: ['F-P1-1'], conflicted: true, text });
  const pass = capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z' });
  const r = check(fixture({ captures: [rejected, pass], ownerRecords: [{ kind: 'object', id: 'V-cap-1:F-P1-1', verdict: 'accept', why: 'x', decider: 'owner', at: T3 }] }));
  assert.equal(r.status, 1, `F-P1-2 left the gate without an owner record: ${r.out}`);
  assert.match(r.out, /V-cap-1:F-P1-2 of a conflicted capture has no run\.mjs object record/);
});
```
The test at `verdict-check.test.mjs:811` already pins that a well-formed disposition (F-P1-6) stays excluded.

**🟢 R2 (code polish):** `verdict-check.mjs:136` reads `const NO_PREMISES ='none…'`, a whitespace change no item asked for. Proposal: restore `= '`.

**🟢 R3 (code or concept, owner ruling):** a missing or null `ids.next.D` fails the gate while `run.mjs:461` and `run-store.mjs:183` read it as 1; no harm now, a false failure once a later phase exit runs `decision-check.mjs`. Proposal: read missing and null as 1 in `decision-check.mjs:81`, or state in concept:1243 that `ids.next.D` must be present; if code follows `run.mjs`, the `null` case in `decision-check.test.mjs:711` changes what it asserts and must be named.

R3 (only if the owner picks "missing = 1"), `plugins/cdp6-core/checks/decision-check.test.mjs`, no extra import, not executed, expected red now (status 1, "ids.next.D is not a positive integer: missing"):
```js
test('rv58 R3: a run that has allocated no D-n, with ids.next holding no D as run.mjs init writes it, passes the D-n set', () => {
  const r = check(runWith({ decisions: {}, nextD: undefined, captures: [] }));
  assert.equal(r.status, 0, r.out);
});
```

**🟢 R4 (concept):** §11.3 (concept:1682, :1686) still presents cap 58 as covering the live P1 run, against §0 item 30 (1). Proposal: one sentence in §11.3 that the P1 run needs a new cap decision under item 30 (1); also add the malformed `ids.next.D` rule to AC-12.31 (concept:933).

## Returned claims
The run-only parts of claim 3 (the CT-4 mutation counts, whether `readRun` keeps duplicate records) are unklar (no test runs allowed). Not checked, outside the claims: look-alike ids in lower case (`f-p1-2`) are neither normalised nor counted; the role file (`devils-advocate.md:52`) names only format characters, NFKC and dash variants. No verdict.

## Status
Block on 🔴 R1. R1a and R1b are for the orchestrator to execute in a disposable copy. R3 needs an owner ruling first.
