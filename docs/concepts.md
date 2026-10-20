# Core concepts

Eight terms carry this marketplace. Each has one sentence and one example; the doctrine copy (`plugins/cdp5-gates/skills/cdp5-reference/konzept-design-pattern-v6.md`) has the long form, and `cdp5-reference --section=<§>` fetches a paragraph on demand.

| Term | One sentence | Example |
|---|---|---|
| **T1 skill** | A Node program for a decidable question: same input, same output, no model, exit `0` no 🔴, `1` at least one 🔴, `2` bad input. | `secrets-scan --repo=.` exits 1 on an AWS key in `config.ini`. |
| **Judgment agent** | A subagent with a role text for a question a program cannot decide (review, refutation, forecast), read-only by default. | `review-verify` confirms or refutes each claim with `file:line`. |
| **Counter-role** | A judgment agent that argues against finished work in a fresh context; its verdict maps to pass, pass-with-conditions or block. | `devils-advocate` on an ADR, `adversarial-auditor` on a 🔴 slice. |
| **Worker contract** | Ten rules every agent gets injected at start and acknowledges in its first line; a stop hook checks the line and the honesty of the completion claim. | `contract: v2 bc4e1cbb010e` then the outcome sentence. |
| **Gate** | A rule that can stop a workflow: a 🔴 finding, an open policy item, a missing acknowledgement, a hedged completion claim. | `konzept-lint` reports gate item G8 (glossary) open, the concept is not ready whatever its score. |
| **Run grant** | A human-confirmed permission for one agent type to execute inside one disposable worktree, for a number of uses and a time. | `worktree-setup.mjs --grant=adversarial-auditor --ttl=3h` after the baseline is green. |
| **Worktree** | A linked git checkout on an exact base commit that a worker may change and the orchestrator integrates or discards; the only place a worker writes. | `.worktrees/audit`, removed after the diff is applied. |
| **Orchestrator** | The main session in the role the `orchestrate` skill describes: it briefs, verifies and synthesises, and does not do the workers' work. | One brief per file, two-stage review, ledger, retro. |

The maturity **policy** (`plugins/cdp5-gates/policy/reife-rubrik.policy.md`) is the one rubric for concept documents; the gate items G1–G15 and the seven weighted dimensions live there and nowhere else. **Knowledge packs** are generated Markdown entries (business, UX, marketing, psy) a skill or agent quotes instead of recalling; every entry carries its source and the label unverified, every pack a `MANIFEST.json`.

## Which tool for what

| Situation | Use | Not |
|---|---|---|
| A question a program can decide (secrets, structure, drift, links, numbers) | the T1 skill from cdp5-gates, directly | an agent reading the files |
| One claim, one review, one fact to check | one agent with a brief (`review-verify`, `review-code`, `konzept-reviewer`) | the orchestrate role |
| A bugfix or a single slice with one writer | orchestrate at its size floor: worktree with baseline, one worker, `review-verify` | ledger, closing counter-role, retro ADR |
| Three stages, two writers, or a 🔴 object | the full orchestrate chain | an ad-hoc chain of agents |
| A choice, a forecast, a doctrine change | the matching counter-role in a fresh context before the synthesis | self-review |
| Business, UX or psy vocabulary | the session skill or agent of domain-agents with the pack entry as a path | recall from memory |

## What runs without Orbit

Everything except `orbit-workflow`. The T1 skills, the agents, the hooks and the knowledge packs are files in the plugins; the doctrine copy is bundled. Orbit is the knowledge layer that is wired in later (`docs/cdp5-review/DECISIONS.md` section C); until then durable results go to the project's `docs/retro/` (own repositories) or the memory directory (company repositories), and `CLAUDE.local.md` holds the project profile.

## Model and effort

Model tiers are pinned by doctrine §32.3 and `hooks/agents.test.mjs`: judgment, counter-roles and security on `opus`, implementation workers, retro moderation and marketing on `sonnet`, mechanical work as a T1 skill. A project does not override them in the plugin. For a cheap pre-screen the orchestrator may pass `model` on the Agent call; the agent type and therefore the hooks stay the same. A project that needs other defaults forks the plugin, because a copied agent under `.claude/agents/` loses the `cdp5-agents:` prefix the hooks match.

## Scope

Built for Claude Code: the enforcement (hooks, grants, the data directory) is Claude Code plugin mechanics. The T1 skills are plain Node programs and run anywhere Node 20 runs, with or without an agent in front of them.
