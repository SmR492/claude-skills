# review-verify of the SL-2 close run (G1, R1) and concept v0.5.16 to v0.5.18 (stage-1 run 64): final answer as handed back

Brief: `briefs/sl2-fix8-rv.md`. Copied from the handback; paths normalised.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes

All four claims are confirmed (bestätigt). One 🟡 is open in the concept: v0.5.18 §0 item 33 (2) moves the cap review to after the live P1 run, but the unchanged stop-table row at concept:1707 still asks for a review before the next run above 60. Verdict: pass-with-conditions.

Target state (read 2026-11-04): worktree `<repo>/.worktrees/sl2`, `git rev-parse HEAD` = 960146b3f8e5884a4a9f93f1077e793cedd6e14a, as the brief; the SL-2 diff uncommitted, all under `plugins/cdp6-core/`. Concept sha256 666cea1fed661d28b08644245a6b7a1403114e4a4094cc36e4ccde81bd5dde1b, concept:3 "0.5.18". `diff -r sl2-pre-fix8 sl2/plugins/cdp6-core` lists exactly 3 files.

Verdict mapping: bestätigt → pass; widerlegt → block; unklar and nicht entscheidbar → returned.

## Part A
| # | Decidable question | Verdict | Evidence |
|---|---|---|---|
| 1a | Are the 10 lines of the G1 block (`sl2-fix7-rv.md:33-42`) in the test file, verbatim and consecutive? | bestätigt | `sed -n '33,42p' sl2-fix7-rv.md \| grep -n -F -x -f - verdict-check.test.mjs` matches `:883-892` in a row; `diff -r` hunk `881a882,892`, a pure add. |
| 1b | Would the named mutation (`verdict-check.mjs:137`, `dispositionRest(l)` → `l.split(" resolved ")[0]`) turn G1 red? | bestätigt (by reading) | The gate re-validates from disk (`decision-check.mjs:76` → `verdict-check.mjs:231`; `capture-fixture.mjs:32-33` writes `text`). With the mutation the disposition line keeps only "disposition: F-P2-1", the items become F-P1-1 and F-P2-1, F-P1-2 is dropped, the output (`decision-check.mjs:13-14,116`) lacks `D-1-devils-advocate-agent-9:F-P1-2`, red at `:889`. The report's "55 pass, 4 fail" returned. |
| 2 | Does the role file carry the sentence, does a test assert it, nothing else changed? | bestätigt | `agents/devils-advocate.md:52` (inside `## Output` at `:50`); `diff -r` shows only `52c52`, the only difference the added clause "; only the `<item>` of a disposition line may carry an objection id". Test `devils-advocate-agent.test.mjs:128-131`, reading the role file (`:9-10`) from `## Output`. |
| 3 | Was any test removed, skipped or loosened, or any `.mjs` production module changed? | bestätigt (none) | 3 files: the role `.md` and two test files; both test hunks (`126a127,131`, `881a882,892`) adds only; no skip, todo or only. |
| 4 | Do the v0.5.17 and v0.5.18 hunks close K1 and G2, record item 33, contradict no unchanged line? | bestätigt + ergänzt | K1 closed at concept:1256, G2 at concept:934; the titles exist verbatim at `verdict-check.test.mjs:859`, `:868`. Item 33 (concept:42) matches ledger:265 ("G1+R1, then commit (Recommended)", "Keep set aside"). Addition: unchanged concept:1707 conflicts with item 33 (2) (🟡 K3). |

## Part B
v0.5.16 → v0.5.17: @@-1 editorial, no; @@-930 (AC-12.29) G2 following `sl2-fix7-rv.md:45`, no; @@-1252 (row concept:1256) K1 following `sl2-fix7-rv.md:29`, agrees with g4 (concept:1244) and the code (`verdict-check.mjs:137`); the unchanged §0 item 30 (2) at concept:39 still says "and disposition lines", a historical owner record narrowed by item 32 (concept:41), not a live contradiction (🟢 K4); @@-2325 changelog, editorial, decider the standing rule of 2026-11-02, no.
v0.5.17 → v0.5.18: @@-1 editorial, no; @@-39 (§0 item 33) supported by item 33 and ledger:265, run numbers 63 and 64 match `sl2-fix8.md:1` and the brief; part (2) "the owner reviews it after the live P1 run" conflicts with concept:1707 (🟡 K3) and agrees with concept:40, 1685, 1774; @@-2325 changelog matches item 33, same tension with concept:1707.

## Findings
**🟡 K3 (concept):** the stop row at concept:1707 reads "stage-1 worker runs above 60 (§0 item 31 (1); …) | the owner's cap review of §0 item 31 (1) before the next run". Item 33 (2) (concept:42) defers that review until after the live P1 run, while stage 1 is at 64; read literally, the row stops run 65. Whether "Keep set aside" counts as that review is nicht entscheidbar, for the owner. Proposal: in row 1707, add "; §0 item 33 (2): the review follows the live P1 run".

**🟢 R2 (role text):** the new clause says "only the `<item>` of a disposition line may carry an objection id", while later in the same paragraph (`:52`) a `> ` quote line may contain ids and the code skips quote lines (`verdict-check.mjs:81`); read literally the clause contradicts that rule. Proposal: "…; besides a `> ` quote line, only the `<item>` of a disposition line may carry an objection id" (the test at `:130` still matches as a substring). Counter-test for `devils-advocate-agent.test.mjs`, not executed, expected red on the current tree at the second assertion, green after the proposal:
```js
test('rv64 R2: the clause that limits ids to the item of a disposition line also names the quote-line exemption', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  const sentence = output.slice(output.indexOf('Each of these also rejects it:'), output.indexOf('a premise mark (`-- checked`'));
  assert.match(sentence, /only the `<item>` of a disposition line may carry an objection id/i);
  assert.match(sentence, /`> ` quote line/);
});
```

**🟢 K4 (concept):** item 30 (2) at concept:39 has no note that item 32 narrowed it. Proposal: add "(narrowed by item 32)", as item 16 does for its superseded parts.

Still open from run 62, out of scope: K2, and the g4 phrase "the ids in it carry no objection of this capture" (concept:1244).

## Returned
The report's mutation count "55 pass, 4 fail", its "542 pass" and its gate exits: unklar (no run grant). Whether "Keep set aside" satisfies the stop row at concept:1707: nicht entscheidbar, for the owner.

## Status
Pass-with-conditions. No 🔴 and no claim widerlegt. The condition is K3, a one-row concept edit that can be made before the local commit. R2 and K4 are optional.
