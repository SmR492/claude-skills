# Outside konzept-reviewer of the SL-2 gate decision table and line grammar (stage-1 run 54): final answer as handed back

Brief: `briefs/sl2-gate-table-review.md`. Copied from the handback; paths normalised to `<repo>`.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes (no part in v0.5.11 or the SL-2 build; no part of `plugins/` read)

**Outcome: block.** The grammar and the table settle most findings from runs 39 to 53. Gate item G10 stays open, for four reasons: the table has overlapping rows and missing rows; the g4 disposition form contradicts §5.3:1232 and AC-12.28; seven unchanged lines still say a rejected or stale capture "is not counted" or is fixed by a re-run; no AC covers the new rules.

Policy: `reife-rubrik.policy.md`, policy-version 3, plugin default threshold 8.0 (the brief named no policy). The repo pointer `docs/reife-rubrik.policy.md:5` sends the reader into `plugins/`; because the brief forbids `plugins/`, the installed copy in the cdp5-gates 0.8.8 plugin cache was read. Round: one outside pass, as the brief and §0 item 29 (1), line 38, require. Line numbers are v0.5.11. The brief's "1231" is line 1232.

## Part A: findings
Key: D decided; P partly decided; N not decided; O outside the table.
- Run 39 (ledger:200): F1 D (row 1242 counts only a live capture; 896, AC-12.3 905). F3 D (1234, 1238, 277). F4 P (1238 requires the `.md` to re-read, 1192 calls a mismatch a finding; whether that finding fails the gate is not a row; gap 9).
- Run 42: F-1 D (1246, 885). F-2 D (1246; C13 1396). F-3 D (1238, 1192). F-4 D (1234). F-5 D (g1 1236). F-6 O (ledger:213 (8)). F-7 O (ledger:213, :218). F-8 D (1234).
- Run 43: F-A D (g2, g3, g6). F-B O (272, 1668; ledger:213 (4)). F-C D (1246). F-D O (884; ledger:213 (5)). F-E O (1192; ledger:213 (6)). NV-1 D (1246).
- Run 46: 🟡-1 D (1246, 277). 🟡-2 D (g6, line 37). 🟡-3 P (1234 decides it, but the table's "valid" is not tied to the header values; gap 12). 🟢-4, 🟢-5 O (272; ledger:227 (4)). 🟢-6, 🟢-7 O (ledger:225, :230).
- Run 47: F-1 O (1192; ledger:227 (6)). F-2 D. F-3 O (272, 1668; ledger:227 (4), (5)). NV-1 O (moot for Edit and Write by 272's device and inode rule; no ledger row names it). NV-2 D (1255, 254). NV-3 D (277, 1246).
- Run 49: 🟡-1 D (g2, g6). 🟡-2 O (ledger:237; the new g4, g5 and NFKC causes need role-file text again). 🟢-3 D (1236). 🟢-4, 🟢-5 O (ledger:237). 🟢-6 D (272, 923, 254 with 1255).
- Run 50: F1 D (g6, line 37). F2 D (155, 1254). F3 D (1244, 1245, 1253). F4 D (g5, g6). F5 O but not covered (the hand step at 1668 voids an unbound pending spawn, F5 is a bound one; ledger:234 says covered, 1668 does not support that; gap 11). F6 O (ledger:234). NV-a O (1668 permission_mode hand check). NV-b N (reviewer clearing captures have validator `not-checked`, 1192; left to SL-5).
- Run 52: 🟡-1 D by g4 and g5, but g4 contradicts 1232 (gap 4). 🟡-2 D (g2). 🟡-3 D (1246, 1254, 155). 🟢-4 D (1236). 🟢-5 P (line 25 still ends "and is 52 since item 26" while changelog 2319 claims item 16 corrected; gap 10). 🟢-6 O (code test titles, open for run 55).
- Run 53: F1 D (1244, 1245, line 38). F2 D (1247; gap 3). F3 D (g2). F4 D (g4; gap 4). F5 D (g5). F6 D (1256). F7 O (skill text, open, no ledger closure). NV1 N (gap 7).
Decided against the owner's ruling: none directly. If 1247's match rule is read as "exact line", a rejected (b) written `verdict: b (…)` falls into row 1248 and no longer blocks, against §0 item 29 (2) (gap 3).

## Part B: completeness
Two rows: (1) valid conflicted `not-decidable` matches 1243 and 1246; (2) valid conflicted `b` matches 1244 and 1246; (3) valid conflicted `c` matches 1245 and 1246 (rows 1243 to 1245 do not exclude conflicted).
No row: (4) valid, stale, not conflicted `a`/`a-with-conditions`; (5) conflicted `a` after clearing ("as in the rows above" but 1242 requires not conflicted); (6) rejected conflicted after clearing ("by its verdict" undefined for a rejected capture); (7) validator `not-checked` (1192) and a verdict value outside the five classes (g1 fixes only keys); (8) an index line whose `.md` does not re-read (outcome not stated); (9) a (c) with an `accept` record (whether a record can be replaced).
No conflict among the status rows 1253 to 1256 or with row 1249; the 1240 header "before the decision" against row 1249 "after" is wording only.

## Part C: unchanged lines that contradict
UC-01 Exit 254 vs 1254 and 1242 (a superseded D-n passes with none; 254 does not require live or valid); UC-01 step 3, 272 vs 1244, 1245 (a re-run is not enough for (b) and (c)); step 5.2, 277 vs 1247 (no contradiction, but `<capture id>:capture` unnamed); UC-03 3.2, 398 vs 1244, 1245 ("Only after (a) or (a) with conditions"); UC-12 step 4, 884 vs 1247 ("which the gate does not count"); UC-12 step 5, 885 vs 1244 ("accepts only (a) and (a) with conditions"; no grammar for a rejected file); error row 894 vs 1247 ("the orchestrator re-runs the role"); error row 895 vs g5, g6; AC-12.28 (930) and the disposition form at 1232 vs g4 (1232's `<item>` is a returned `F-Pk-n` without capture id, rejected as prose under g4; "an `upheld` disposition counts as `block`" while g4 records nothing); AC-11.14 (867) and AC-12.x: coverage gap only (gap 6); §5.3 header 1219-1227 consistent; C1 1372, C11 1394 consistent; C13 1396 vs 1238, 1246 (the clearing-capture route left out, also in 277, 885); `D-n` row 155 consistent; O4 1520 consistent; O14 1530 no contradiction; O15 1531 vs 1244-1246 ("stale captures do not count"); §11.3 item 3, 1668 vs 1247 (`:capture` not named for a rejected (c); the void hand step covers unbound spawns only; gap 11).

## Part D: gate, dimensions, gaps
Gate: lint JSON not supplied; ledger:242 records konzept-lint exit 0. G1-G4, G5a, G6-G9, G12-G15 pass per ledger:242 with spot checks; G5b judgment pending; G10 open (Part B 1-9; gaps 1-5, 7, 8); G11 pass for the reviewed region.
Dimensions: sachbearbeiter 0.20 × 5; struktur 0.20 × 10; uc_schritte 0.15 × 10; ac 0.15 × 10; fehlerfaelle 0.10 × 10; nachweis 0.10 × 5; glossar 0.10 × 10. Total 8.5.
Gaps: 1 🟡 overlapping rows 1243-1245 vs 1246 and the post-clearing outcome; proposal: "not conflicted" on 1243-1245, and 1246 after clearing follows 1242-1245 without that condition, a rejected one 1247 or 1248. 2 🟡 combinations with no row; proposal: a row for a valid stale (a), and a verdict outside the five classes rejects. 3 🟡 the match rule of 1247 (exact line, prefix, case). 4 🟡 g4 vs 1232 and AC-12.28 (930), AC-03.15 (435): which form holds, do returned items get a capture id, what does `upheld` do. 5 🟡 unchanged lines 254, 272, 398, 884, 885, 894, 895, 1531; proposal: "does not count as a pass; blocks per the §5.3 gate decision table". 6 🟡 no AC for the new rules; proposal: AC rows with test names per table row and g-rule. 7 🟡 the `D-n` set (run.json, idea.md rows, ids.next.D). 8 🟡 1246 leaves out the C13 clearing capture; proposal: "or, from SL-5, a clearing capture per C13". 9 🟡 the `premises:` section boundary in g3 and whether an `.md`/index mismatch fails the gate. 10 🟢 line 25 "and is 52 since item 26"; proposal: "and is 58 since item 29". 11 🟢 the 1668 hand step voids unbound spawns only; proposal: extend to a bound spawn without capture. 12 🟢 "valid" does not include the header values; proposal: state it in the table head.

## Status
Total 8.5 reaches the 8.0 default; G10 open, so **block** (not ready). Open author questions: gaps 3, 4, 7, 9. Deviation: the policy from the installed plugin cache. Follow-up outside scope: run 49 🟡-2 recurs, because the role file must state the g4, g5 and NFKC causes when run 55 builds them.
