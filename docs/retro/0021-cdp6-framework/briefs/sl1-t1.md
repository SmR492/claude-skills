# Brief SL-1 T1: run core (stage-1 worker run 11 of cap 45)

Objective (owner, verbatim): "CDP Rework Version 6 -> Ein Multi- und Singleagent Framework … Du hast es erfüllt, wenn alle Arbeiten ohne drift und im Rahmen ihrer Anweisungen abgelaufen, anweisungen nicht übersehen oder missachtet wurden und jede Phase in sich geschlossen Funktioniert und alle Aufgaben und Anforderungen daraus erfüllt sind." Start of SL-1 approved by the owner on 2026-11-02 ("yes").

Output format (final answer, handback only, no file): acknowledgement line; status; per AC one row: AC id, test file and title, the red run (command, exit, the assertion message showing it failed for the stated reason), the green run (command, exit); files created or changed with line counts; the gate commands below with their real exits and last output lines; every point where you had to choose between readings of the concept, with the line you followed; open questions. At most 1200 words.

Target state:
- Repository `<repo>`, worktree `<repo>/.worktrees/sl1`, base commit 27e33269c5e094e290ac38c1b114be6911e1bffa. Work only inside the worktree; first command, on its own: `cd <repo>/.worktrees/sl1`.
- Specification: `docs/cdp6/konzept-cdp6.md` in the worktree (v0.4.8). The concept is the source of truth; the slice table row SL-1 is line 1608, the T1 split is in `docs/retro/0021-cdp6-framework/briefs/sl1-plan.md` of the main checkout.

Scope (T1 of SL-1):
- `plugins/cdp6-core/.claude-plugin/plugin.json` and the `cdp6-core` entry in `.claude-plugin/marketplace.json` (§1.2, line 46).
- `plugins/cdp6-core/lib/data-dir.mjs`, `lib/agent-name.mjs` (copy and extend from `plugins/cdp5-agents/lib/`, §1.3 and CH-3: CDP6 data directory and pointer file, prefix `cdp6-core:`), `lib/run-store.mjs` (lock, journal, single writer of `run.json`, the run lookup of §1.4 item 2 and the notion of an active run).
- `plugins/cdp6-core/scripts/run.mjs` with `init`, `enter`, `exit`, `status`, `approve`, `set-autonomy`, `decision`, `id`, `object` for P1: the version floor (§1.4 item 9), the `--session-id` and `--data-dir` arguments and their binding (UC-09, §1.4 item 2), the path-argument checks (AC-09.12), the probe-record reader (`<data>/probes/<claude-version>.json`; without an accepted record only `default` prompting applies, `A3` is refused, every `--mode team` exits 2).
- `plugins/cdp6-core/checks/registry.json` with the pins of §1.3 line 80 (CH-2), `checks/idea-check.mjs`, `checks/decision-check.mjs` for P1.
- ACs, each with the test file and title the AC row names: AC-01.1, AC-01.3, AC-01.7, AC-01.10, AC-01.11, AC-01.13, AC-02.5 (the `run.mjs` refusal only), AC-03.10, AC-09.1, AC-09.4, AC-09.5, AC-09.7, AC-09.8, AC-09.9, AC-09.11 (the `scripts/run.test.mjs` titles only), AC-09.12, AC-09.14 (the `scripts/run.test.mjs` title only), AC-10.5, AC-11.8, AC-11.14 (the `scripts/run.test.mjs` title only). Find each row with `grep -n '^| AC-xx.y |'`.

Out of scope: `lib/run-argv.mjs`, `lib/hook-key.mjs`, `hooks/guard-shell.mjs`, the `--hook-token` and nonce checks, the `init` settings checks of §5.6 items 9 and 10 (T2); `hooks/guard-phase.mjs`, `hooks/hooks.json`, `bootstrap.mjs`, the skill (T3); everything of SL-2 and later; any file outside `plugins/cdp6-core/` and `.claude-plugin/marketplace.json`; any change to the CDP5 plugins. T2 will add a token check to every `run.mjs` call; keep the argument handling in one place so T2 can add it without touching each subcommand.

Concept sections to read (worktree copy): §1.2 (lines 45-66), §1.3 (68-88), §1.4 items 2, 3, 9 (89-100), §3.1 to §3.3 (130-179), UC-01 (239-304), UC-09 (723-769), UC-10 (770-812) for the `enter` and `exit` rules, UC-11 (813 on) for `approve`, `set-autonomy`, `decision`, `object` as `run.mjs` sees them, §5.1, §5.2, §5.4 (1145-1235), the AC rows named above. CDP5 code (`plugins/cdp5-agents/`) is a source to read, not a specification.

Rules: test-first per AC: write the test, run it, show it red for the reason the AC states, then implement until green; a test that cannot turn red is not done. Tests use `node:test`, temporary directories and stubs (`claude --version`, the data directory), never the real home directory or real Claude Code. No comments in code (shebang and linter directives only). No new dependency. Errors to callers in a structured form without internals.

Gate commands (run from the worktree, report exits):
1. `node --test plugins/cdp6-core/lib/*.test.mjs plugins/cdp6-core/scripts/*.test.mjs plugins/cdp6-core/checks/*.test.mjs`
2. `node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs` (baseline: exit 0)
3. `node plugins/cdp5-gates/skills/skill-lint/skill-lint.mjs --path=plugins/cdp6-core`
4. `node plugins/cdp5-gates/skills/secrets-scan/secrets-scan.mjs --repo=plugins/cdp6-core`

Disposable environment:
disposable environment: <repo>/.worktrees/sl1
base commit: 27e33269c5e094e290ac38c1b114be6911e1bffa
baseline: node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs → exit 0 (4 s)
tree: clean
run grant: impl-uc may run in <repo>/.worktrees/sl1 until 2026-11-02T18:10:19.260Z, 3 uses (T1 to T3), session 7bd2e7bb-33fd-42bb-bdcf-cb804c3a261c

Tools: Read, Grep, Glob, Bash, Write, Edit inside the worktree. No network, no commit.

Stop rule: one pass over the ACs in the order listed. When an AC is not testable as written, contradicts another concept line, or needs an out-of-scope file, stop on that AC, record it as an open question with both line numbers and continue with the next; do not invent a reading. Stop-Retro per contract rule 5 when the worktree or the concept is missing.

The worker contract injected at your start applies; open your final answer with its acknowledgement line.
