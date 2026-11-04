# review-verify of the SL-2 fix of run 60 C2 and concept v0.5.14 to v0.5.16 (stage-1 run 62): final answer as handed back

Brief: `briefs/sl2-fix7-rv.md`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes

All five claims hold. The fix of run 60 C2 is built, its tests are in place and no test was weakened. One 🟡 remains in the concept: gate table row 1255 was not changed and still contradicts the new g4 rule. Verdict: pass-with-conditions.

Target state (read 2026-11-04T18:06:46+01:00): worktree `<repo>/.worktrees/sl2`, `git rev-parse HEAD` = 960146b3f8e5884a4a9f93f1077e793cedd6e14a, as the brief; SL-2 diff uncommitted. Concept sha256 23e67b23717aba8a37047cc884a7849c93b729176071530d1603633d30f49c0d, as the brief. `diff -r sl2-pre-fix7 sl2/plugins/cdp6-core` shows the fix as three files.

Verdict mapping: bestätigt and bestätigt + ergänzt → pass; widerlegt → block; unklar and nicht entscheidbar → returned.

## Part A
| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1 | Is the item built? Does a test assert it, and §0 item 32, g4 and AC-12.29? | bestätigt + ergänzt | Built: `verdict-index.mjs:13-15` (`dispositionRest` removes the item token); `verdict-check.mjs:100-103` adds "carries the objection id … after the item"; `verdict-check.mjs:136-137` scans the line after the item in `fileObjectionIds`; for all four counter-roles (`:9`, `:67`/`:73`). Path to the gate: the index takes the ids from `capture.mjs:71,87`, the gate re-validates from disk (`decision-check.mjs:2,76` → `verdict-check.mjs:231`). Tests: `verdict-check.test.mjs:859-866`, `:868-881` assert the validator result. Gap 1: no test shows the gate asking for a record of the id after the item (🟢 G1). Gap 2: AC-12.29 (concept:933) names "fires: line grammar g1 to g6 of §5.3", and none of the tests with that title (`:672-768`) asserts the new clause (🟢 G2). |
| 2 | Is the C2 counter-test verbatim? Are the earlier tests on well-formed dispositions unchanged? | bestätigt | `sed -n '48,55p' sl2-fix6-rv.md \| grep -n -F -x -f - verdict-check.test.mjs` matches all 8 lines at `:859-866` in a row. The only test hunk is `857a858,881`, an add, so `:716-740`, `:800-805` and `:812-831` are unchanged. |
| 3 | Would each mutation turn the named tests red? | bestätigt by reading; "fail 2" unklar | Drop `:100-103`: rv60 `r` valid, `:862` red; rv61 `cited` valid, `:873` red. Revert to `.filter(!DISPOSITION.test)`: rv60 `c.objections` `['F-P1-1']`, `:865` red; rv61 `['F-P1-1']`, `:880` red. By reading: if `dispositionRest` keeps the item, `:726` red; if the full line is scanned, `:827` red (F-P1-6). |
| 4 | Does any hunk remove, replace or loosen an assertion? | bestätigt (none) | Hunks `7c7` (import), `99a100,103` (add), `132c136,137` (production filter, stricter), `857a858,881` (test add), `12a13,16` (add). No skip, todo or only. |
| 5 | Does an id reach a passing gate without an objection line or a record only in the cases the §5.3 table states? Is any capture the role file asks for rejected? | bestätigt + ergänzt | `> ` quote lines skipped at `:81`, `:136`; the `<item>` removed by `dispositionRest`; rejected, not conflicted, without (b) or (c): `decision-check.mjs:34` (concept:1257); captures after the decision: `decision-check.mjs:56` (concept:1258); every other line (a header, a premise row, a `verdict:` line, an `objection:` line without its space) goes through the else branch `:105-106`, and the capture is rejected. Role file: its form with an artefact id or a file:line stays valid (`agents/devils-advocate.md:52`; tests `:719-722`, `:802`, unchanged). Addition: an item token in item form is exempt even when never returned, and its capture-id part is not checked, so `F-P1-2:conflict` passes; this follows from the `<item>` exemption, and the check of what was returned comes in SL-5. |

## Part B
v0.5.14 to v0.5.15 (source: `sl2-fix6-rv.md:42` C1, `:58` C3): @@-1 version, editorial, no; @@-22 item 16, C1 (concept:25), no; @@-931 AC-12.31, C3 second proposal, no (titles exist at `decision-check.test.mjs:711`, `:731`); @@-1684 checkpoint, C1 (:1687), no; @@-1702 stop row, C1 proposal followed, no (runs 61 and 62 are above 60; whether §0 item 32 counts as the cap review this row asks for is nicht entscheidbar, a question for the owner); @@-1769 CH-29, C1, 🟢 (the row keeps "above 48 … after SL-2" while :1688 says this threshold no longer bounds stage 1; not a contradiction); @@-2324 changelog, editorial, no.
v0.5.15 to v0.5.16 (source: §0 item 32 at concept:41, `sl2-fix6-rv.md:44`): @@-1 version, no; @@-38 item 32, the owner's answer (item 30 (2) at :39 is historical and left; gate table row 1255 now contradicts it, 🟡 K1); @@-929 AC-12.29, item 32, no apart from G2; @@-1239 g4, item 32, yes: concept:1255 still names the items as ids "except in `> ` quote lines and disposition lines" (🟡 K1); in the same g4 line "the ids in it carry no objection of this capture" pulls against the new clause (🟢); the disposition paragraph at :1239 lets a disposition cite "an owner record in `run.json`" without a form, and if cited by its item id `<capture id>:F-Pk-n` item 32 rejects it (🟢 K2, SL-5); @@-2324 changelog, no.

## Findings
**🟡 K1 (concept):** gate table row concept:1255 contradicts g4 (concept:1243) and §0 item 32; the code follows g4 (`verdict-check.mjs:137`). Proposal: in :1255 replace "and disposition lines" with "and the `<item>` of a well-formed disposition line (§0 item 32)".

**🟢 G1 (code, test):** no test shows the gate asking for the record of an id after the item. Proposal: add the counter-test below to `plugins/cdp6-core/checks/verdict-check.test.mjs` (no extra import; the file's helpers). Not executed. Expected: green on the final tree; red on `sl2-pre-fix7` at the first assertion.
```js
test('rv62 G1: a rejected conflicted capture with an objection id after the item of a disposition line does not leave the gate on the record of its objection line alone', () => {
  const id = 'D-1-devils-advocate-agent-9';
  const body = text({ conflict: 'conflict of interest: author of D-2', objections: `${OBJECTION}\ndisposition: F-P2-1 resolved X-3 - explored in X-3, but F-P1-2 stays open`, verdict: 'verdict: b' });
  const cap = { ...FRESH, id, stamp: T1, verdict: null, validator: 'rejected', conflicted: true, objections: ['F-P1-1', 'F-P1-2'], text: body };
  const one = gate(decided({ captures: [cap, FRESH], records: [`${id}:F-P1-1`] }));
  assert.equal(one.status, 1, one.out);
  assert.ok(one.out.includes(`${id}:F-P1-2`), one.out);
  const both = gate(decided({ captures: [cap, FRESH], records: [`${id}:F-P1-1`, `${id}:F-P1-2`] }));
  assert.equal(both.status, 0, both.out);
});
```

**🟢 G2 (concept):** the AC-12.29 test title does not carry the new clause. Proposal: add the titles "rv60 C2: …" and "rv61 C2: …" to AC-12.29, as v0.5.15 did for AC-12.31.

**🟢 K2 (concept, SL-5):** the disposition paragraph lets a disposition cite an owner record but gives no citation form. Proposal: before SL-5, fix a citation form for an owner record that carries no `F-Pk-n`.

**🟢 R1 (role text):** `agents/devils-advocate.md:52` says an id "anywhere except on a well-formed `objection:` line" rejects, which also covers the exempt `<item>`. Proposal: add "only the `<item>` of a disposition line may carry an objection id".

## Status
Pass-with-conditions. No 🔴 and no claim widerlegt. The condition is K1, a concept edit. The orchestrator runs G1 in a disposable copy. Returned: claim 3's count "fail 2" (only a run decides); whether §0 item 32 serves as the cap review of the stop row (concept:1705), nicht entscheidbar, for the owner.
