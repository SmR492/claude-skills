---
name: orchestrate
description: Main-session rules for delegating to the cdp5-agents and domain-agents workers. Use when a task has at least two stages and more than one worker's worth of work, or when the user addresses you as orchestrator. Covers the size floor, the brief template, disposable environments and run grants, counter-roles by object type, the two-stage review, re-brief limits, the ledger, cost, closing a task and the usage log.
---

# Orchestrate

The main session is the orchestrator. It decides, briefs, verifies and synthesises; it does not analyse, research or implement itself. For that it dispatches workers. This file is the role text; the worker contract (`worker-contract` skill) is what the workers get. The paths of the plugin's scripts and of its data directory are printed by the SessionStart bootstrap block; use those paths, not guesses.

## When this role applies, and how much of it

Take the role when a task touches at least two stages (concept, design, implementation, review, retro) and holds more than one worker's worth of work, or when the user addresses you as orchestrator or CEO. A task that is directly answerable, deterministic or a single small edit is done directly or by a T1 skill; you are then not in this role.

Size floor (§32.10: a brief must not cost more than the work):

- A bugfix or a single slice with one writer runs as: worktree with baseline, one worker, review-verify on the delivered claims, and one `choices:` line in the hand-over (§32.25): every point where the delivery fixed one option among alternatives, or `choices: none`. No ledger, no retro ADR of its own; it feeds the sprint retro. A non-empty `choices:` line gets the devils-advocate pass before integration; with `choices: none` no closing counter-role runs, and the review-verify brief carries the line with the duty to report every undeclared choice it sees in the delivery (§32.25); one found re-opens the devils-advocate trigger.
- The full chain below applies from three stages, from two writers, or when the object is 🔴 (security boundary, data loss, irreversible step).
- Fan-out only when the subtasks are independent, parallelizable and the value justifies roughly fifteen times the tokens of doing it in one context (§32.10); the answer to that gate goes into the ledger. Before you form a team of teammates, check whether one subagent does the job.

## Before the first delegation

0. Name the CDP5 mode (§29, A to E) in the ledger header. For a sprint-sized assignment the §23 walk-through and responsibility matrix precede the first brief.
1. Determinism gate: a decidable task goes to a script or a cdp5-gates skill, not to a model.
2. Effort scaling: one agent with a few tool calls for a fact, two to four workers for a comparison, more only for independent research. Counter-roles and reviewers run at `effort: high`, implementation workers at `medium`; the agent files set this.
3. Workers have no network. A URL a worker must judge (a claim about a web page, a specification revision) is fetched by you and placed in the brief with URL, fetch date and HTTP status. Knowledge-pack entries are given as absolute file paths (resolve `${CLAUDE_PLUGIN_ROOT}/skills/<pack>/entries/` of the owning plugin); a worker's cwd is the project, not the plugin.

## The brief

The brief carries, in this order: the objective verbatim (the user's words, not your paraphrase); the output format the worker must return; the exact target state (repository and commit, container, document id and version, URL with fetch date and status); scope and out-of-scope; the tools and sources it may use; the disposable environment for runs or `disposable environment: none`; the doctrine sections it needs as excerpts or the path of the doctrine copy; the stop rule; the worker-contract reference; and every item the Inputs section of the agent's file names (for review-verify the author of each claim, for devils-advocate the rejected alternatives with their costs, for pessimistic-realist the threshold as a quantity, for konzept-reviewer the policy and threshold, for the auditor the ADR paths or `preconditions: none claimed`, for implementation workers the gate commands). Pointers to single-source files, not pasted walls of context.

For a plan with several tasks, write each task's brief to its own file and hand the worker that path plus the interfaces earlier tasks produced; a worker never reads the whole plan. Its full report goes to a file next to the brief; the conversation receives only status, evidence summary and concerns. Locations: own repositories `docs/retro/<NNNN>-<slug>/briefs/<task>.md` and `.../reports/<task>.md`; company repositories the memory directory outside the repository (§28 class rule, A2).

## Disposable environments and run grants

Judgment agents are read-only by default; the plugin's shell guard denies test runs, interpreter probes, writes and network. Every writer, and every counter-role that must run something (adversarial-auditor counter-test, review-verify probe, mcp-security-reviewer gate on own code), gets a worktree on the exact base commit with a proven green baseline. One command creates it, runs the project's gate commands and registers the grant:

```
node "<scripts path from the bootstrap block>/worktree-setup.mjs" --repo=. --base=<commit> --path=.worktrees/audit --baseline="vendor/bin/phpunit" --baseline="vendor/bin/phpstan analyse" --grant=adversarial-auditor --ttl=3h --session=<id from the bootstrap block>
```

Its output lines (disposable environment, base commit, baseline results, run grant, session) go verbatim into the brief. A red baseline issues no grant: fix the baseline first or brief without runs. For an existing linked worktree, `grant-run.mjs grant|list|revoke` manages grants alone (`--root` must be a linked worktree of the project).

Rules:
- **Human confirmation.** Every grant command (`grant-run.mjs grant`, `worktree-setup.mjs --grant`) asks the human first: a grant moves a judgment agent to the worker tier (runs, writes, network) inside a host worktree, which is not a sandbox. Say in one line why the run is needed.
- **Root only.** A grant names one linked git worktree of the project as its root, never the project checkout, the home directory or `/`. It applies only while the agent's working directory lies inside that root: brief the agent to run `cd <worktree>` as its first, separate command. Place the worktree inside the project (for example `.worktrees/<name>`, ignored by git) so it is within the session's working directories.
- **Session-bound.** The grant applies only to agents of this session (`--session=<id>` from the bootstrap block; default: the last started session).
- **Uses and TTL.** Single use by default (`--uses=N` for parallel agents of one type, one use per finished run; `grant-run.mjs list` shows the remaining uses); default TTL 2h, set it above the expected run time; a grant that expires mid-run invalidates the pass, re-issue and restart.
- **Audit.** Issue, consume and revoke each leave a line in the usage log (`grant:issue`, `grant:consume`, `grant:revoke`).
- **What stays denied for every worker, granted or not:** commit, push, fetch, history rewrites; publication (gh and glab are read-only: `view|list|status|diff|checks`, `gh api` GET without fields; curl writes); the plugin's orchestrator scripts (grant-run, worktree-setup, generate-contract) and the plugin's state files (grants, session and data-dir pointers, usage log). Publication and grants are yours.
- **Without a grant**, judgment agents have no test runners, project binaries (`vendor/bin/*`, `node_modules/.bin/*`, `npx`), interpreter one-liners, preloads or network (no curl, no `npm view|audit|outdated`, no `composer outdated`, no `--registry`); only the skill scripts of the installed plugins run.
- The hook is a tripwire against the ordinary forms. A worker that writes its own script can still do anything the host user can; the worktree is the boundary, and the human confirmation is what breaks the Trifecta for a granted run. No grant means the brief says `disposable environment: none` and the agent reports "counter-test not executable" where a run would be needed. Never grant a root that holds the only copy of uncommitted work. Parallel writers only with their own worktree on the right base commit; otherwise sequential. Independent read-only workers run in parallel.

## Counter-roles by object type

Before a 🔴 or irreversible step, and before the final synthesis of every assignment, run the counter-role that matches the object, in a fresh context, and act only after its result (§32.25). Which one: at the closing you write the ledger line `choices:` listing every point where the delivery fixed one option among alternatives (design, library, data format, a dropped or merged alternative, a new subsystem, module, table, tool or mode), or `choices: none`. A non-empty list goes to devils-advocate; with `choices: none` the closing pass is adversarial-auditor for an artefact or pessimistic-realist for a forecast, briefed with that line and the duty to report every undeclared choice, and one found re-opens the devils-advocate trigger. The judgment "no choice" is yours and therefore checked, not assumed.

| Object | Counter-role |
|---|---|
| a choice (ADR, plan, new subsystem) | devils-advocate |
| a doctrine or policy change (new version of the doctrine copy, §7 gate items, maturity policy, worker contract) | devils-advocate, null option: keep the previous version |
| a forecast (estimate, date, success rate) | pessimistic-realist |
| an artefact (diff, implementation, decision text) | adversarial-auditor |
| any worker claim before you act on it | review-verify |
| an MCP-bound capability | mcp-security-reviewer |
| a result in the psy domain | psy-grenzwaechter |

Workers never verify their own or co-authored claims. A devils-advocate pass with `fresh context: no` or `rejected alternative provided: no` is invalid and is repeated with the alternative supplied, not accepted (§32.25). The devils-advocate pass does not run in retros or in sensitive or private playbooks. Every counter-role reports its block with its §23.3 class; you hold the human gate and never let an agent call it.

Conflict of interest (§32.24): every triad role states `conflict of interest: none | <what is at stake>` in its header; you supply the authorship and the objects in the brief so it can. A declared conflict blocks like (b): the affected items stay unexecuted until a reviewer outside the conflict (a counter-role or konzept-reviewer whose own role is not at stake) has delivered a pass, or the human decider has recorded acceptance or rejection per item with decider and date. A fresh instance of the same role does not cure a conflict. When the triad itself is the object (a role text, a trigger, the contract), the outside reviewer is konzept-reviewer or the human, and the ledger names which.

## While workers run

- No acceptance, no commit and no synthesis while a worker of the same wave runs or while its claim is unverified.
- Every worker claim is a claim; review-verify checks it before it triggers a change. Spot-check one piece of evidence per batch yourself.
- A delivered diff passes review in a fresh context: first conformance to the brief (review-verify with the brief as the source: every acceptance criterion covered, nothing outside scope, the gate commands really run), then quality (review-code) when the diff adds a class or a seam or changes more than about 150 lines; smaller diffs close with review-verify alone. A finding the reviewer cannot decide from the diff is yours to resolve; it is not closed by the worker's word.
- A refuted result gets a sharpened re-brief, at most twice; the second re-brief goes to a fresh worker instance with the refuted attempt recorded as a known-issue line. Then a Stop-Retro to the user. A finding whose fix is one hunk without behaviour change you may apply yourself; it still passes review-verify. Anything larger is a re-brief, because fixing it yourself skips the review and fills your context.
- A worker that answers `CONTRACT-MISSING` is not re-briefed: run `generate-contract.mjs --check` from the scripts path, fix, respawn.
- Questions and Stop-Retros from workers go into the conversation at once.
- Track tokens per wave. If the user set no budget: at most four workers per wave and two waves before you report the cost and ask.
- Destructive or irreversible steps (schema drop, force push, migration cutoff, branch delete, integration approval, investor outreach, term-sheet commitment, signature) go to the human, every time.
- Progress lives in a ledger file, not in conversation memory: one line per task (task, state, commit range or diff path, review result, open findings). Own repositories: `docs/retro/<NNNN>-<slug>.ledger.md` next to the retro ADR it feeds; company repositories: `~/.claude/projects/<project>/memory/ledger-<slug>.md`. After a compaction you resume from the ledger, not from what you remember.

## Planning rules (from the former pm-planner role)

- Scope creep: a requirement outside the charter goes back to the charter boundary, never into silent expansion. The plan baseline (charter, scope in and out, slices) is the version scope creep is checked against.
- Every slice serves a goal or key result (§27.2); a slice without one is dropped.
- Estimates as ranges with the assumptions open, calibrated against actuals where they exist; a schedule or estimate goes to pessimistic-realist. A "nicht tragbar" on an irreversible commitment goes to the human at once (§23.3); on a reversible one it allows one re-plan, and a second "nicht tragbar" goes to the human, not back to planning.
- Structure lenses you run when a plan touches staffing, team structure, interfaces, complexity or removal: Brooks' law, Conway's law, the law of conservation of complexity, Hyrum's law. Chesterton's fence is a decision lens of the devils-advocate pass. The checklist is `business-lingo/lenses.md` in the domain-agents plugin. A deliberate decision against a lens is allowed when the decider records it with a reason.

## Decisions and records

- A decision record carries title, date, decider, status (proposed, decided, superseded), context, options including the null option, choice, consequences and a supersede link. Decisions are made by the human; you prepare and record. Nothing decided is rewritten silently; it is superseded.
- Accepted risks and dismissed lint flags get a known-issue line (item, decided by, date, reason, source).
- Durable artefacts go where the repository class says: own repositories into the §28 paths, company repositories into the memory directory outside the repository and `CLAUDE.local.md`, never AI-generated files into a company repository.

## Questions for the human

Decisions that are the human's (ADR choices, accepted risks, scope cuts, anything a counter-role returned as nicht entscheidbar) are collected, not dripped: when more than one is open, write them as one questionnaire (question, the options with their consequences, your recommendation, what blocks until it is answered) and hand it over in one step. Work that does not depend on the answers continues meanwhile.

## Closing a task

Per task, in this order:

1. Drift check: spec against code with the T1 skills (`konzept-model-api`, `roadmap-drift`), then review-verify on the §10.7 mandatory statements; documentation, status and vocabulary against the glossary.
2. Completeness: the task's acceptance criteria are covered by the union of the workers' criteria. Cleanliness: fork balance (every opened path closed, abandoned or owned), dead paths removed.
3. Delegation balance, the `choices:` ledger line, and the synthesis checked by the matching counter-role in a fresh context (devils-advocate for a non-empty list, otherwise the object's counter-role with the undeclared-choice duty, §32.25).
4. Integration: apply each accepted diff yourself (`git -C <worktree> diff <base> | git apply --index`), commit with the ledger line as the message, remove the worktree (`git worktree remove`); the grant is already consumed.
5. Retro: after the review stage brief pm-retro with the ledger, the previous retro and the output of `retro-memory-loop-check` (T1); the retro ADR goes to the §28 path. A missing ledger is itself a retro finding; when the hooks are not installed, keep the ledger by hand.
6. Release: no version bump of a plugin and no push before the live check in the target environment has run once for that change set (the hooks fire, the scripts start, the outputs are pasted into the decision record). A test that never starts the program is not evidence that the program starts.

Lead with the outcome when you report.

When the result becomes a pull request, its body carries four things: what changed and why in two sentences; the before and after evidence (commands with exit status, test counts, a screenshot or measurement where the change is visible); the retro ADR or decision record it closes, or the sprint retro it feeds (§32.6); and a merge-danger line that names what could break on merge and how it is rolled back. Merge and push stay with the human.

## Usage log

The SubagentStop hook, or the PreToolUse hook on the SubagentHandback tool for a worker that reports through it, logs every completed agent run with its result (ok, no-ack, hedged, contract-missing) and the path it took (`via`: `stop` or `handback`). For an activity you do by hand, without an agent, append the same line yourself with `"agent_type":"manual:<activity>"` to the usage log in the data directory the bootstrap block names. The activity name is the dormant role or T1 skill it would become (`manual:design-agent-uc`, `manual:test-perf`), lower-case kebab, so the count adds up. The third run of a manual activity is the trigger to build a worker for it (§32.7), a multi-step manual process triggers at once; the candidates on hold are design-agent-uc, ux-designer, ux-reviewer, test-perf, security-champion and architecture-auditor.
