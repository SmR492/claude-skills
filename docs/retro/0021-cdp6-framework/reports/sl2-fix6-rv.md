# review-verify of the SL-2 fix of the run-58 findings and concept v0.5.13 to v0.5.14 (stage-1 run 60): final answer as handed back

Brief: `briefs/sl2-fix6-rv.md`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes (no part in fix 6, its report or concept v0.5.14)

Outcome: there is no 🔴. The code for items 1 to 3 does what the fix brief asks, and the counter-tests are in the tree verbatim. Two claims are refuted as worded: claim 1 (item 3 has no test) and claim 5 (its universal wording fails on two table rows the concept sanctions). Part B finds one 🟡 contradiction in the concept: the cap is still 58 in four unchanged lines. One 🟡 for an owner ruling: objection ids inside a well-formed disposition line.

Target state: `git -C <repo>/.worktrees/sl2 rev-parse HEAD` returned 960146b3f8e5884a4a9f93f1077e793cedd6e14a, matching the brief. `sha256sum <repo>/docs/cdp6/konzept-cdp6.md` returned 534b5f8aaad7a4d77ee0dd2f6f659abd471a3a1d9c31fc06b05d060b9ce24d21, matching. The whole `diff -r` output read: 4 files, hunks 81c81, 87c87, 712c712, 717a718,733, 132c132, 136c136 and 850a851,857. `git status --short` shows changes only under `plugins/cdp6-core/`. No tests run, no files written.

Verdict mapping: bestätigt and bestätigt + ergänzt → pass; widerlegt → block on that claim as worded; unklar and nicht entscheidbar returned without a verdict. Every claim was authored by the orchestrator's brief, which rests on the impl-uc worker report of run 59.

## Part A: claims
| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1a | Is item 1 built, and does a test assert it and g4? | bestätigt | `verdict-check.mjs:132` reads `!DISPOSITION.test(l)`; `DISPOSITION` at `verdict-index.mjs:11` has no `g` flag, so `.test` keeps no state. R1a at `verdict-check.test.mjs:852`, R1b at `decision-check.test.mjs:721`. g4 at concept:1242. |
| 1b | Is item 2 built, and does a test assert it and AC-12.31? | bestätigt + ergänzt | `decision-check.mjs:81` is `run.ids?.next?.D ?? 1`. Tests: `decision-check.test.mjs:712` (present non-integers fail), `:718` (null passes), `:731` (missing passes). Gap: AC-12.31 (concept:934) names "fires: gate decision table status rows and D-n set", and none of the tests with that title (`:587`, `:610`, `:628`) asserts the missing or null clause (🟢 C3). |
| 1c | Is item 3 built, and does a test assert it? | built: bestätigt; test: widerlegt | `verdict-check.mjs:136` reads `const NO_PREMISES = 'none…'`; no test, as the report says ("whitespace only, no test of its own", `reports/sl2-fix6.md:20`); fix brief line 12 asks for "each test-first". |
| 2 | Are R1a, R1b and R3 in the tree verbatim? | bestätigt | The `diff -r` add hunks (851-857, 721-734) compared line by line with `sl2-fix5-rv.md:41-46`, `:51-58`, `:69-72`: identical. |
| 3 | Would reverting `?? 1` turn the named tests red? | bestätigt by reading; the count "two" unklar | Without `?? 1`, null and missing reach `:87`, status 1: `:718` and `:732` red. Every other `runWith`/`fixture` call in the file sets `nextD`/`D` (`:39`, `:605`, `:612-624`, `:707`, `:713`, `:717`), as do `decision-check.rv42.test.mjs:32` and `idea-check.test.mjs:31`; the `run.test.mjs` paths not traced. |
| 4 | Did any hunk remove, replace or loosen an assertion, and does its item require it? | bestätigt | Only `712c712` removes an assertion (`[null, 'null']` no longer has to fail), required by item 2, with `:718` asserting null passes. `87c87` drops `?? 'missing'` from the finding text; no test asserted it (`grep -rn "positive integer"` over both trees: only `:711`, `:715`). Every other test hunk a pure add; no skip, todo or only. |
| 5a | Does an id on a malformed `disposition:` line of a rejected conflicted capture need a record? Is any capture the role file asks for rejected? Is a run with no `ids.next.D` judged as `run.mjs` judges it? | bestätigt | `:132` keeps the line, `:126-127` makes the id an item, `decision-check.mjs:13-15` requires a scoped record. The acceptance logic (`verdict-check.mjs:59-125`) is unchanged; the role file's form (`agents/devils-advocate.md:52`) passes `DISPOSITION` after dash normalisation. `run.mjs:461` uses `r.ids?.next?.D ?? 1`, the same reading as `decision-check.mjs:81`. |
| 5b | Universal wording: does no objection id of any capture reach a passing gate without an objection line or a record? | widerlegt by reading (fact); concept-sanctioned (evaluation) | First path: a rejected, not conflicted capture with verdict `a` and a prose id gets `keep` false, so `objections: []` (`verdict-check.mjs:125-127`); it blocks only when `rejectedBlock` is set (`decision-check.mjs:34`); concept:1256 says this row neither counts nor blocks. Second path: captures stamped after the decision are filtered (`decision-check.mjs:56`, concept:1257). |

## What is actually the case
1c: item 3 built without a test; a whitespace-only change has no behaviour a test could assert. 5b: the claim's exceptions leave out concept rows 1256 and 1257; refuted by reading only; D5 below not run, its expected status 0 from reading `decision-check.mjs:34,56-70` and `verdict-check.mjs:101-102,125-127`.

## Part B: concept diff v0.5.13 to v0.5.14
| Hunk | Supported by | Contradicts an unchanged line |
|---|---|---|
| @@-1 version and as-of | §0 item 31 (editorial) | no |
| @@-37 §0 item 31 | the owner answers; R1 (`sl2-fix5-rv.md:37`), R3 (`:65`) | yes: concept:25 says the cap "is 58 since item 29"; concept:1705 stop row "above the cap of 58 (§0 item 29) \| hard stop", which item 31 (1) keeps in force with "the stop indicators of §11.3"; concept:1772 (CH-29) "cap 58 worker runs"; concept:1687 "48 = 58 − (2 + 8) now … stays within the cap" (🟡 C1) |
| @@-930 AC-12.31 | item 31 (2); R4 second half (`:75`) | no; the test-title gap (🟢 C3) |
| @@-1238 g4 parenthetical | R1 (`:37`); item 31 lead-in | not directly; "its ids are items" holds only for a rejected conflicted capture, not for concept:1255 and :1256 (🟢); AC-12.29 (concept:932) exempts ids "in a disposition item", g4 all "ids in it" (feeds C2) |
| @@-1241 table head | item 31 (2); R3 | no; agrees with `run.mjs:461`, `run-store.mjs:183` |
| @@-1679 §11.3 budget | item 31 (1) | yes: concept:1687 and :1705 as above; R4 of run 58 still partly open |
| @@-2323 changelog 0.5.14 | editorial | no |

## Findings
**🟡 C1 (concept): the cap is still 58 in four unchanged lines** (concept:25, :1687, :1705, :1772); :1705 would hard-stop runs 59 and 60. Proposal: carry item 31 (1) into all four, e.g. :1705 "stage-1 worker runs above 60 → the owner's cap review of §0 item 31 (1)".

**🟡 C2 (code, owner ruling first): an objection id in the why or cited part of a well-formed disposition line neither rejects the capture nor becomes an item** (`DISPOSITION`'s tail `- \S.*` at `verdict-index.mjs:11`, with `verdict-check.mjs:96-99` and `:132`). A valid verdict-`a` capture with such an id counts as the pass, so no record is asked for: the R1 class one slot further. A premise mark in the same place already rejects (`verdict-check.test.mjs:738`). Proposal: an objection id after the `<item>` of a disposition line rejects the capture and counts as an item, in line with AC-12.29's "disposition item".

C2 counter-test (only if adopted), `plugins/cdp6-core/checks/verdict-check.test.mjs`, no extra import, not executed, expected red now (`validator` valid):
```js
test('rv60 C2: an objection id after the item of a well-formed disposition line rejects the capture and is an item of a rejected conflicted capture', () => {
  const line = 'disposition: F-P2-1 resolved X-3 - explored in X-3, but F-P1-2 stays open';
  const r = validate({ objections: line });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
  const c = validate({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\n${line}`, verdict: 'verdict: b' });
  assert.equal(c.validator, 'rejected', JSON.stringify(c));
  assert.ok(c.objections.includes('F-P1-2'), JSON.stringify(c.objections));
});
```

**🟢 C3:** AC-12.31's named test title does not carry the missing and null clause. Proposal: add the assertions from `:718` and `:732` to a test titled "fires: gate decision table status rows and D-n set (…)", or add those titles to AC-12.31.

**🟢 1c:** accept item 3 without a test and say so in the ledger.

D5 demonstration for 5b (evidence, not a change), `plugins/cdp6-core/checks/decision-check.test.mjs`, no extra import, not executed, expected status 0 by reading:
```js
test('rv60 claim 5: an objection id in the prose of a rejected, not conflicted capture without a verdict b or c leaves the gate without an owner record, as concept table row 1256 states', () => {
  const text = `${captureText({ task: 'D-1', verdict: 'a', objections: [] })}F-P1-2 is the larger defect and stays open\n`;
  const rejected = capture({ verdict: null, validator: 'rejected', text });
  const pass = capture({ id: 'V-cap-2', stamp: '2026-01-01T10:30:00.000Z' });
  const r = check(fixture({ captures: [rejected, pass] }));
  assert.equal(r.status, 0, r.out);
});
```

## Returned claims
Claim 3: only a run shows that exactly two tests turn red under the mutation. C2 and the 5b rows are policy questions for the owner (nicht entscheidbar). The expected results of C2 and D5 come from reading, not from a run.

## Status
Pass-with-conditions for the fix of R1, R2 and R3: no 🔴; items 1 and 2 built and tested. Claims 1 (item 3) and 5 (universal wording) widerlegt as worded, mapping to block on those claims; neither rests on a code defect. Conditions: C1 is a concept edit; C2 needs an owner ruling before any code change; C2 and D5 for the orchestrator to execute in a disposable copy.
