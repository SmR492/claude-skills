# domain-agents

Domain agents and session skills rebuilt from the former CDP5 knowledge-pack roles. Requires `cdp5-agents` for the worker-contract hooks (its `hooks/hooks.json` matches `^(cdp5-agents|domain-agents):`). The dependency is guarded: `hooks/require-contract.mjs` warns at SessionStart when `cdp5-agents` is not installed next to this plugin (or at `CDP5_AGENTS_ROOT`) and stops the three agents with `CONTRACT-MISSING`; each agent file repeats that fallback. The session skills (business-lingo, psy-*) run in the main session without hooks and bind contract rules 3, 7 and 8 by their own text.

Agents receive knowledge-pack entries as absolute file paths in the brief (the orchestrator resolves `${CLAUDE_PLUGIN_ROOT}/skills/<pack>/entries/`); a subagent's cwd is the project, not the plugin. The crisis numbers in `psy-knowledge` were checked against telefonseelsorge.de and 116117.de on 2026-10-19; the check is repeated before each release and recorded in `skills/psy-knowledge/overrides.json`.

| Kind | Name | Replaces |
|---|---|---|
| agent | marketing-strategist | role:marketing-strategist |
| agent | psy-domaenen-rechercheur | role:psy-domaenen-rechercheur |
| agent | psy-grenzwaechter | role:psy-grenzwaechter |
| skill | business-lingo (+ frameworks.md, lenses.md, 89 BL entries) | lingo-translator, biz-analyst, principle-guard |
| skill | psy-diagnostik-navigator | psy-diagnostik-navigator, psy-versorgungs-lotse |
| skill | psy-therapiebegleiter | psy-therapiebegleiter (Module C out) |
| skill | psy-paar-moderator | psy-paar-moderator |
| skill | psy-knowledge (PSY entries, names removed) | PSY pack |
| skill | marketing-knowledge (SU marketing subset) | SU pack subset |
| skill | ux-knowledge (118 UX entries) | UX pack |
| dormant | roles-dormant/ux-designer.md, ux-reviewer.md | built at the third logged UX run |

Knowledge packs are generated from the Orbit export with `scripts/build-packs.mjs`; every entry is marked unverified. Deferred: fundraise-advisor and startup-validator until their SU entries are checked against primary sources; privat-dokumentar until the Orbit workflow.

Tests: `node --test plugins/domain-agents/scripts/*.test.mjs`
