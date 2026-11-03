# SL-1 task plan (orchestrator, 2026-11-02)

Source: concept `docs/cdp6/konzept-cdp6.md` v0.4.8 at 27e3326, slice table row SL-1 (line 1608), §11.3 items 2 to 4. Worktree `.worktrees/sl1` on 27e3326, baseline green. Tasks run one after another in that worktree; each builds on the previous diff.

| Task | Content | ACs |
|---|---|---|
| T1 run core | `plugin.json`, marketplace entry, `lib/data-dir.mjs`, `lib/agent-name.mjs`, `lib/run-store.mjs`, `scripts/run.mjs` (P1 subcommands, version floor, `--session-id` and `--data-dir` binding, path-argument checks, probe-record reader), `checks/registry.json` with pins, `checks/idea-check.mjs`, `checks/decision-check.mjs` | AC-01.1, AC-01.3, AC-01.7, AC-01.10, AC-01.11, AC-01.13, AC-02.5 (`run.mjs` part), AC-03.10, AC-09.1, AC-09.4, AC-09.5, AC-09.7, AC-09.8, AC-09.9, AC-09.11 (`run.test.mjs` titles), AC-09.12, AC-09.14 (`run.test.mjs` title), AC-10.5, AC-11.8, AC-11.14 (`run.test.mjs` title) |
| T2 owner gate | `lib/run-argv.mjs`, `lib/hook-key.mjs`, `hooks/guard-shell.mjs`, the token and nonce checks in `run.mjs`, the `init` checks of §5.6 items 9 and 10, the host-key path rule, key creation in `bootstrap.mjs` | AC-01.5, AC-01.12, AC-09.11 (`guard-shell.test.mjs` titles), AC-09.13, AC-09.14 (`guard-shell.test.mjs` title), AC-09.15, AC-10.10 (`guard-shell.test.mjs` title), AC-11.5, AC-11.9, AC-11.10, AC-11.14 (`guard-shell.test.mjs` title), AC-11.15, AC-11.17, AC-11.18, AC-11.19 |
| T3 phase guard | `hooks/guard-phase.mjs`, `hooks/hooks.json`, `bootstrap.mjs` run status, skill `cdp6-core:idea` | AC-02.5 (`guard-phase.mjs` part), AC-09.2, AC-09.3, AC-10.2, AC-10.3, AC-10.4, AC-10.6, AC-10.10 (`guard-phase.test.mjs` title) |

Reviews (§11.3 item 4): `review-verify` after each task against its brief; after T3 `review-code` on the slice (new seams), `adversarial-auditor` (security-boundary slice) and the outside reviewer named in ledger 0021 before T1 starts. Planned worker runs: 3 + 3 + 3 = 9 (model: 9 plus 1 outside reviewer); stage-1 count before SL-1: 10; checkpoint after SL-1: above 24.
