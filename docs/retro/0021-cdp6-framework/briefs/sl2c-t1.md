# Brief SL-2c T1: minimal probe acceptance with the record MAC, and the `Edit(...)` rule form (stage-1 worker run 78)

Objective (owner, verbatim): "yes pls go with auto and the preflight." (2026-11-05, concept §0 item 34; ledger 0021); "do not fake it, do not cut it, do not remove it, acceptance tools (all must pass before you say "done")" (2026-11-04); "Ich möchte das du das Projekt Autonom zu ende bringst, Ohne etwas wegzulassen, zu faken, oder etwas abzukürzen." (2026-11-05). The stage-1 live P1 run moves to auto mode; owner commands are admitted there only with an accepted probe record, which this task makes possible without a hand-placed record.

Output format (final answer, handback only, no file): acknowledgement line; status; per AC below: the test titles, the red run (test run before the code, with the failing reason) and the green run; files changed with line counts; the four gate commands with their real exits and last output lines, all run on the final tree; open questions. State only mutation results you ran. No test may be weakened, removed or skipped. At most 700 words.

Target state:
- Worktree `<repo>/.worktrees/sl2c` (detached at 1d04d1a14b897af3dbee8275b6e48a454331b0c1, the committed SL-1 plus SL-2 build; baseline cdp6-core suite exit 0). Every Bash call starts with `cd <repo>/.worktrees/sl2c && `. Temporary directories only through `plugins/cdp6-core/test-support/temp-dir.mjs`.
- Specification: concept v0.5.24 `<repo>/docs/cdp6/konzept-cdp6.md` (main checkout, committed 092f65d, sha256 98d8f9d9a09084b9669284e054b1dce7fb26761630f390d9dad4ee61ecb3d598; read only): §3.4 item 14 (line 228), §5.2 (the `<data>/probes/` row), §5.6 items 9 and 10 (lines 1316-1317), UC-11 step 1 (the owner `ask` reason, around line 833) and step 1.3, the SL-2c row (line 1681, part (1) and (5)), the probe session paragraph (line 1640), and the ACs below.
- The SL-0 probe record whose Markdown form the accept part reads: `<repo>/.worktrees/sl0-kit/docs/cdp6/probes/2.1.314.md` (rows, start line, per-mode results).

Items (each AC first as a red test, then the code):
1. AC-11.20 (concept line 878): `run.mjs probe --accept <file>` as an owner form of `lib/run-argv.mjs` with its file-hash binding (`--expect-sha256` from the hook, as for `init`); the owner `ask` reason lists the file with its sha256 and each row's parsed per-mode verdict (AC-11.22's second part).
2. AC-11.21 (line 879): `checks/probe-check.mjs --accept` refuses a record whose Claude Code version differs from `claude --version`, a row without its permission mode, version or settings sha256, and the other refusals the AC names; it accepts only the rows A-5, A-12 and A-23 (SL-8 keeps the others).
3. AC-11.22 (line 880): `--accept` refuses an A-23 `auto` row without a `check-handback.mjs` line in `<data>/hooks-fired.jsonl` with that row's `agent_id`, `permission_mode` `auto` and the `cdp6-core` version the record names.
4. AC-11.23 (line 881) and §3.4 item 14: the accepted record `<data>/probes/<version>.json` carries `accepted.mac`, the HMAC-SHA256 under the host key over the label `cdp6-core probe-record v1` and the record's canonical bytes; `lib/probe-record.mjs` verifies it and accepts nothing else (a 64-character sha256 field alone no longer counts); a hook-token MAC over the same bytes does not verify (domain separation; `lib/hook-key.mjs:43` puts the nonce first).
5. AC-11.13 (line 871, from SL-8): a hand-written record, Markdown or JSON, not written by `probe-check.mjs` through `run.mjs probe --accept`, does not gate.
6. AC-09.15 (line 778) and AC-11.17 (line 875) as changed in v0.5.22, and `lib/user-settings.mjs` `missingRules` (§5.6 items 9, 10): the required rule form is `Edit(...)` (and `Read(...)`); a `Write(...)` rule no longer counts as required and its absence is not reported.
7. Keep `guard-shell.mjs`'s owner-mode check (`hooks/guard-shell.mjs:42-47`) reading the record through the verified reader, so that owner commands in `auto` are admitted exactly when an accepted record shows the A-5 `auto` prompt for the running version.

Out of scope: the stop guard, `observe-stop.mjs`, the spawn deny (T2); `scripts/preflight.mjs` (T3); everything SL-8 keeps; any file outside `plugins/cdp6-core/`; the concept; the CDP5 plugins.

Rules: `node:test`; temporary directories only through the `tempDir` helper; no comments in code; no new dependency; every test of an AC is shown red for the right reason before its code; keep every other test green; no hand-placed fixture record may pass the gate in any test except through the code path the AC names.

Gate commands (each from the worktree, on the final tree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs plugins/cdp6-core/hooks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs`
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl2c
base commit: 1d04d1a14b897af3dbee8275b6e48a454331b0c1
baseline: cdp6-core suite exit 0, fail 0, an empty TMPDIR left empty (worktree-setup 2026-11-05)
run grant: impl-uc, confirmed by the owner at the permission prompt

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree; Read of the main-checkout concept, ledger, briefs and reports and of the SL-0 record. No network, no commit. The CDP5 shell guard refuses shell `for` loops, variable assignments, some heredocs and commands naming `generate-contract.mjs`.

Stop rule: when an item is not doable as written, record it as an open question; Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
