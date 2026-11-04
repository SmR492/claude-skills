# review-verify of concept v0.5.20, stage-1 line measurement and stage-2 line re-estimate (stage-1 run 70): final answer as handed back

Brief: `briefs/sl2-line-reestimate-rv.md`. Summary of the handback; findings verbatim in substance.

contract: v2 f91736a60d15
conflict of interest: none
fresh context: yes

Status: pass-with-conditions (fix F1 and F2). All four claims bestätigt.

Method deviation: the shell guard refused `mkdir` and `git archive -o`; per-file checks ran as blob-to-blob `git diff --numstat <commit>:<path> <commit>:<path>` and against the empty tree 4b825dc.

## Part A
| # | Verdict | Evidence |
|---|---|---|
| 1 | bestätigt | shortstat 960146b^..960146b 39/6014; 960146b^..1d04d1a 67/11606; 960146b..1d04d1a 51/5735/143; non-test 35/3650 and 22/2194, so 3363 and 2109; guard-bash→guard-shell 80/661 (29 copied), check-handback 136/54 (21), devils-advocate.md 42/24 (32); run.mjs 672/0, verdict-check.mjs 285/0. Limit: 3 of 12 copied pairs re-measured |
| 2 | bestätigt | awk: 4.2713, 34597.7, 55740.7, 30326.4, 48906.6, 1.2691, 5.2041, 1.5462, 1.0303, 10279.4, 16561.2; all 20 bounds round as written; 5944 not re-measured |
| 3 | bestätigt | concept:1670 "The concept does not define that ratio"; Q-17 at concept:2192 lists the meaning, test files and divisor |
| 4 | bestätigt + ergänzt | no hard contradiction; notes needed at concept:1648, :1672, :1707 and the As-of tail |

## Part B
H1 supported (As-of tail "no owner question open in §15" now reads against Q-17, F3); H2 supported, sits above the unchanged :1672 (F2); H3 supported; H4 supported.

## Findings
- 🟡 F1: "Both counts are above 3200" follows the raw shortstat cross-checks 11606 and 5735, not the counting-rule figures. Proposal: "11319 and 3363 are both above 3200".
- 🟡 F2: :1648 and :1672 keep "about 4433" next to the measured 202. Proposal: note the stage-1 measurement at :1648; ":1672 Copied lines are planned at about 4433 (not confirmed by stage 1, see above)".
- 🟢 F3: As-of "no owner question open in §15" → "at that time".
- 🟢 F4: :1707 3200 is 1.2 × 2650 = 3180 rounded.
- 🟢 F5: Q-17 (c) without stage-2 ranges; the workflow JSON has 42154–67914 and 12524–20178.

Returned: 5944 churn sum not re-measured; 9 of 12 copied pairs not re-measured individually.
