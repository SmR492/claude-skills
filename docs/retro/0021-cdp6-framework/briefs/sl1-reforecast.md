# Brief: stage-1 re-forecast after SL-1 (pessimistic-realist, stage-1 worker run 30 of cap 45)

Objective (owner, verbatim): "go with your recommendations" (2026-11-02, decision on the cap of 45 and the checkpoints after SL-1 and SL-2; concept §0 item 22). Concept §11.3: more than 24 runs after SL-1 → "re-forecast from the measured runs before SL-2 (checkpoint); its P(stage 1 above the cap) above about 0.25 → the owner decides before SL-2".

Output format (final answer, handback only, no file): verdict tragbar, tragbar-mit-Auflage or nicht tragbar; the reference class with each data point and its source line; median and 90th percentile of runs per slice class (security-boundary, other) and the re-brief count per slice; the rebuilt stage-1 model for the rest of stage 1 (SL-2 and the live P1 run with its fix loops) with the remaining runs as median and P90; P(stage 1 above the cap of 45); a pre-mortem of the three likeliest overrun causes for SL-2, each with the earliest observable signal; then the condition you would attach. At most 1200 words.

The forecast under review: stage 1 finishes SL-2, the live P1 run and its fix loops within the cap of 45 worker runs, with 29 runs used now (runs 1 to 29 of ledger 0021, stage-1 start stamp 2026-10-29T08:55:33+01:00).

Sources:
- Concept `<repo>/docs/cdp6/konzept-cdp6.md` (v0.5.2): §11.2 "Forecast from a run model" (line 1579 on), §11.3 "Staged commitment" (line 1633 on, with the counting rule, the checkpoints and the re-forecast rule at line 1668), the slice table row SL-2 (`grep -n '^| SL-2 '`), §0 items 7, 16, 18, 20, 22.
- Ledger `<repo>/docs/retro/0021-cdp6-framework.ledger.md`: every row from the stage-1 start stamp on. Measured so far (the orchestrator's count, verify it against the ledger): SL-0 7 runs; run 10 a concept change review; SL-1 runs 11 to 29 = 19 runs (3 build tasks, 4 fix runs, 3 correction runs after reviews, 9 review or audit runs; the owner's design decision of 2026-11-03 moved the run state out of the project mid-slice). The truemesh S9 data the re-forecast rule names are cited in §11.2 and the ledger rows it references.
- The SL-1 reports and briefs under `<repo>/docs/retro/0021-cdp6-framework/` for the causes of the extra runs.

Questions beyond the output format: is SL-1's overrun a slice-class property (security boundary) that SL-2 shares (SL-2 is also a security-boundary slice under §11.3 item 4), or a one-off (the design change)? Does the stage-1 scope still pass the consumer test of §11.3, or would a scope cut lower the overrun probability more than it costs?

Tools: Read, Grep, Glob, Bash for read-only commands (grep, sed -n, wc). No writes, no network.

Stop rule: one pass; at most 40 tool calls; a number you cannot source to a ledger row or a concept line is marked "unsupported" and kept out of the model.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
