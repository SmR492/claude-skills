# claude-skills

A Claude Code plugin marketplace for the CDP5 way of working: deterministic T1 skills where a task is decidable, judgment agents with a shared worker contract where it is not, and knowledge packs shipped as supporting files. Everything is project-independent and read-only unless a role says otherwise. New here: `docs/concepts.md` explains the eight terms this README uses (T1 skill, judgment agent, counter-role, worker contract, gate, run grant, worktree, orchestrator) and which tool fits which situation. Everything except `orbit-workflow` runs without Orbit.

## Installation

```
/plugin marketplace add SmR492/claude-skills
/plugin install cdp5-gates@claude-skills
/plugin install cdp5-agents@claude-skills
/plugin install domain-agents@claude-skills
```

`domain-agents` requires `cdp5-agents` (worker-contract hooks).

## Install

Requirements: Claude Code 2.1.269 or later, `git`, and Node.js 20 or later on the host's PATH of the shell Claude Code uses (the hooks and every T1 skill are Node programs; on Windows the Windows PATH counts, a Node inside WSL is not seen). Check with `node --version` in that shell.

```
claude plugin marketplace add SmR492/claude-skills
claude plugin install cdp5-gates@claude-skills
claude plugin install cdp5-agents@claude-skills
claude plugin install domain-agents@claude-skills
claude plugin install orbit-workflow@claude-skills   # optional, needs the Orbit MCP
```

Start a new session afterwards. The SessionStart bootstrap of cdp5-agents prints the script paths, the data directory and the session id; if that block is missing, the hooks did not run. The host check says why:

```
node "$HOME/.claude/plugins/cache/claude-skills/cdp5-agents/<version>/skills/cdp5-doctor/cdp5-doctor.mjs"
```

It prints one line per fact (`ok`, `warn`, `FAIL`): Node version and path, git, the four hook scripts, the worker contract hash, line endings, the data directory, whether a session has started with the hooks, the usage log, and the sibling plugins; exit 1 on any FAIL. After a fresh install the expected result is all `ok` except `bootstrap` and `usage log` on `warn`, which turn `ok` with the first session and the first agent run. On Windows the Windows PATH counts: a Node inside WSL is reported as missing. `/skill-doctor` lists the loaded skills and their context cost; `/doctor prompt-audit` checks the loaded CLAUDE.md files, skills and agents for outdated or contradictory instructions; `claude plugin eval` runs a plugin's eval suite once one exists. The repository is checked out with LF on every platform (`.gitattributes`), so the contract hash and the lints behave the same on Windows, macOS and Linux.

## Plugins

### cdp5-gates: deterministic T1 skills

Node programs, `node:` builtins only, same input same output; the output is the evidence. `konzept-mapper`, `konzept-lint` (gate G1–G15 plus weighted score against the shipped maturity policy), `konzept-const-sync`, `konzept-model-api`, `ac-to-test-scaffold` (placeholders, not red tests), `test-gap`, `roadmap-drift`, `retro-memory-loop-check`, `wiki-lint`, `mcp-config-lint`, `mcp-doc-drift-gate`, `secrets-scan`, `pii-scan`, `profile-check`, `skill-lint` (spec, conventions and supply-chain check of skills and plugins), `cdp5-init`, `cdp5-reference`.

One convention for every detector: exit `0` means no 🔴 finding, `1` at least one 🔴, `2` a usage or input error; every finding is printed with 🔴 🟡 🟢 and carries `sev` in `--json`, so the orchestrator maps it to pass, pass-with-conditions or block. Generators and lookups (`ac-to-test-scaffold`, `cdp5-reference`, `cdp5-init`) never exit 1. `mcp-doc-drift-gate` and `konzept-const-sync` import the target module and therefore execute its top-level code; run them only on code built in the repository, and on a foreign checkout only inside a disposable environment under a run grant. Both name the imported module in every output (`executed_target_module(s)` in `--json`, the header line in text). The `--json` shapes differ per skill (rows for the mapper, dimensions for the lint, findings for the scanners); what they share is the `sev` marker on every finding and the exit code. All scripts start through `pathToFileURL`, so they run on Windows hosts and from paths with spaces. Script names equal the skill name (`<skill>/<skill>.mjs`) with one exception kept on purpose: `cdp5-reference/cdp5.mjs`, the lookup typed by hand in the CLAUDE.md gate line.

The concept maturity policy lives in `plugins/cdp5-gates/policy/reife-rubrik.policy.md`; `reife-rubrik.policy.json` is generated from it (`node plugins/cdp5-gates/scripts/generate-rubric.mjs`, `--check` in CI). Two layers: a binary gate (G1–G11, decided by the lint where deterministic) and seven weighted dimensions; default threshold 8.0; a project may ship its own copy.

### cdp5-agents: agents for the engineering loop

| Agent | Role | Model | Effort |
|---|---|---|---|
| konzept-reviewer | gate and score of a concept against the policy | opus | high |
| review-verify | verifies claims against the source before anyone acts | opus | high |
| adversarial-auditor | refutes finished work with a counter-test (FREIGABE, FREIGABE-MIT-AUFLAGEN, SPERRE) | opus | high |
| devils-advocate | counter-vote on a choice, existence question, null option | opus | high |
| pessimistic-realist | outside view on a forecast, reference class, pre-mortem | opus | high |
| threat-modeler | STRIDE, §33.2 checklist, §33.6 classes, Trifecta block | opus | high |
| mcp-security-reviewer | MCP integration security and maturity | opus | high |
| review-code | architecture and code review, Schema C.1 | opus | high |
| pm-retro | blameless retro with carry-over and Kaizen | sonnet | high |
| impl-debug | reproduce, red before fix, root cause, green after | sonnet | medium |
| impl-uc | one vertical slice, test-first, diff only | sonnet | medium |
| impl-refactor | behaviour-preserving merge or split of classes with evidence; no standalone renaming or dead-code tasks | sonnet | medium |

Model tiers follow doctrine §32.3: judgment, counter-roles and security on `opus`; implementation workers, retro moderation and marketing on `sonnet`; purely mechanical work is a T1 skill, not an agent. `hooks/agents.test.mjs` pins the mapping.

The `orchestrate` skill is the role text of the main session: trigger, brief template, counter-roles by object type, re-brief limit, worktrees, cost, planning rules, usage log. `cdp5-doctor` is the read-only host check described under Install.

Shared mechanics:

- `skills/worker-contract/SKILL.md` is the one contract for every agent (version 2); its core is generated into `core.md` (`node plugins/cdp5-agents/scripts/generate-contract.mjs`) and injected by a `SubagentStart` hook. The agent's first output line acknowledges the contract hash; a `SubagentStop` hook asks once if it is missing or if the answer carries a hedged completion claim, and appends one line per run with its result (ok, no-ack, hedged, contract-missing) to the usage log in the plugin data directory. Every agent file repeats the `CONTRACT-MISSING` fallback so an agent stops even when the injection failed.
- A `PreToolUse` hook on the Bash and PowerShell tools is a tripwire, not a sandbox: judgment agents get an allowlist of read-only programs and git read subcommands (global options such as `-C`/`-c` are parsed, aliases, command substitution, inline interpreter code and redirections are denied); implementation workers get git limited to worktree-local subcommands (no commit, push, fetch, stash or history rewrite, also behind `wsl`, `bash -c` or `docker exec`). The hook fails closed (exit 2) on unreadable input. The boundary that holds is the disposable environment the brief names.
- Run grants: when a counter-role must execute something (adversarial-auditor counter-test, review-verify probe), the orchestrator creates a linked git worktree with `scripts/worktree-setup.mjs` (base commit, green baseline, grant in one step) or registers an existing one with `scripts/grant-run.mjs grant`. Every grant command asks the human to confirm. A grant applies only while the agent's working directory is inside that worktree (never the project checkout, home or `/`), only to agents of the issuing session, for a number of uses and a TTL (default 2h, max 24h); issue, consume and revoke are logged. Subagents can never run the orchestrator scripts or write the plugin's state files. The SessionStart bootstrap prints the script paths, the data directory and the session id and writes the pointers to `~/.cache/cdp5-agents/`, so scripts run from the main session and the hooks share one grants file and one usage log.
- Judgment agents have no network: no `curl`, no `git ls-remote`, no `npm view|audit|outdated`, no `composer outdated`, no `--registry`; a URL a worker must judge is fetched by the orchestrator into the brief. Tool scripts run only from `${CLAUDE_PLUGIN_ROOT}`, `~/.claude/plugins/` or `plugins/<cdp5-gates|cdp5-agents|domain-agents|orbit-workflow>/skills/<skill>/`. Workers' `gh` and `glab` are read-only; publication is the orchestrator's.
- The guard is a tripwire against the ordinary forms, not a sandbox: a worker that writes its own script can still do what the host user can. The worktree is the boundary, and the human confirmation of each grant is what breaks the Lethal Trifecta for a granted run.
- The `orchestrate` skill carries a size floor: a bugfix or single slice runs as worktree, one worker, review-verify; the full chain (ledger, two-stage review, closing counter-role, retro ADR) applies from three stages, two writers or a 🔴 object.
- Agents set `effort` in their frontmatter; no thinking phrases, no doctrine lookup by script. The brief carries the doctrine excerpt or the path of the bundled copy.
- `roles-dormant/` holds role texts without an agent file; they are built at the third logged run.

### domain-agents: domain agents and session skills

Agents `marketing-strategist`, `psy-domaenen-rechercheur`, `psy-grenzwaechter`; session skills `business-lingo` (frameworks and lenses), `psy-diagnostik-navigator`, `psy-therapiebegleiter`, `psy-paar-moderator`; knowledge packs `business-lingo/entries` (89), `ux-knowledge/entries` (118), `psy-knowledge/entries` (12, names removed), `marketing-knowledge/entries` (21). Packs are generated by `plugins/domain-agents/scripts/build-packs.mjs` from the Orbit export and marked unverified; each pack carries a `MANIFEST.json` (source, migration date, review status, redaction, overrides). See `plugins/domain-agents/README.md`.

### orbit-workflow

A `SessionStart` hook that loads the latest Orbit report and open FastNotes of the current project. Orbit is the knowledge layer that is wired in after the agent rebuild; see `docs/cdp5-review/DECISIONS.md`.

## Tests

```bash
node --test plugins/cdp5-gates/skills/*/*.test.mjs plugins/cdp5-gates/lib/*.test.mjs plugins/cdp5-agents/hooks/*.test.mjs plugins/cdp5-agents/skills/*/*.test.mjs plugins/orbit-workflow/hooks/*.test.mjs plugins/domain-agents/scripts/*.test.mjs
```

Run the suite on every platform the plugins are installed on; the Windows host found defects WSL never showed (D-14).

## Evals

`plugins/cdp5-gates/evals/` and `plugins/cdp5-agents/evals/` hold behaviour cases for `claude plugin eval`: one directory per case with `prompt.md` (frontmatter and prompt), `graders/*.md` and, where the case needs files, `case.yaml` with a `scaffold.sh`. The cases test what the unit tests cannot: that Claude reaches for the T1 skill instead of reading by eye (`lookup-doctrine`, `secrets-scan-fires`, `konzept-lint-first`), that a spawned agent receives and acknowledges the contract (`worker-ack`), and that the guard stops a judgment agent's write and the report says so (`guard-tripwire`). Deterministic graders (`tool_used`, `regex`) carry `arm: both` so the baseline arm without the plugin shows the difference; one `llm` grader per case judges the answer.

```bash
claude plugin eval plugins/cdp5-gates --scaffold --allow-tools Bash --trust-plugin                 # three runs with, three without the plugin
claude plugin eval plugins/cdp5-agents --scaffold --allow-tools Bash Agent --trust-plugin
claude plugin eval plugins/cdp5-gates --case lookup-doctrine --runs 1 --ablation none --allow-tools Bash --trust-plugin   # cheapest smoke run
```

Each run is a `claude -p` session in an empty temporary directory with only the plugin under test loaded (its hooks included, no user settings, no other plugins), so `Bash` and `Agent` must be granted on the command line. Results land in `evals/results/` (ignored by git); the summary table and `report.html` are the evidence a release note cites.

## Decisions

`docs/cdp5-review/DECISIONS.md` records the review of all 35 former roles, the decisions A1–A11, the per-role verdicts and the repository changes D-1 to D-15 with their best-practice checks, including what external reviews proposed and what was adopted or declined with the reason. `docs/cdp5-review/_cross-cutting.md` holds the cross-cutting findings.
