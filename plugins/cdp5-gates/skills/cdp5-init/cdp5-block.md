<!-- Block managed by `cdp5-init`. Do not edit by hand — `cdp5-init` updates it. -->
## CDP5 + claude-skills marketplace

Non-trivial tasks are orchestrated according to **CDP5** (concept → design → implementation → testing → review), not executed ad hoc.

**cdp5-reference gate (mandatory pre-step):** Before every task, load the required CDP5 doctrine excerpt **just-in-time** instead of assuming it —
`node "${CLAUDE_PLUGIN_ROOT}/skills/cdp5-reference/cdp5.mjs" --section=<§> | --keyword=<term> | --list`. When something is unclear or a decision is open, enter a dialogue with the user (clarify first).

**Decidable + repeated → deterministic T1 skill (no LLM guesswork). Judgment work → judgment agent. Writing/merging/pushing → only with human confirmation.**

### Trigger map (statement → tool)

| Statement / need | Tool (`cdp5-gates` skill / `cdp5-agents` agent) |
|---|---|
| "is the spec structurally complete", maturity partial score | `konzept-lint` |
| Generate tests from concept ACs (TDD-first) | `ac-to-test-scaffold` |
| Concept ↔ code mapping / drift | `konzept-mapper`, `konzept-model-api`, `roadmap-drift` |
| Plaintext secrets / PII in the repo | `secrets-scan`, `pii-scan` |
| MCP config risks | `mcp-config-lint` |
| MCP tool description vs. input/output fields (consumer sycophancy protection) | `mcp-doc-drift-gate` |
| Numeric constants in concept prose vs. code spec (parity drift) | `konzept-const-sync` |
| Wiki health (broken links/orphans) | `wiki-lint` |
| Untested security-critical classes | `test-gap` |
| Check the retro→memory loop | `retro-memory-loop-check` |
| Check project defaults against the profile | `profile-check` |
| Wire/update CLAUDE.md to the marketplace | `cdp5-init` |
| Concept maturity/gap review (judgment) | `konzept-reviewer` |
| Verify claims against code/source | `review-verify` |
| Adversarial review of a 🔴 slice | `adversarial-auditor` |
| Threat modeling / MCP security | `threat-modeler`, `mcp-security-reviewer` |
| Retrieve or write back project/domain knowledge (knowledge doctrine, separate from CDP5) | Orbit MCP (`search` → `read`, finish with `insert`/`update`) |

### Tools

- **`cdp5-gates`** (deterministic, read-only T1 skills): konzept-lint · ac-to-test-scaffold · konzept-mapper · konzept-model-api · konzept-const-sync · roadmap-drift · secrets-scan · pii-scan · mcp-config-lint · mcp-doc-drift-gate · wiki-lint · test-gap · retro-memory-loop-check · profile-check · cdp5-init · cdp5-reference.
- **`cdp5-agents`** (judgment, read-only): konzept-reviewer · review-verify · adversarial-auditor · threat-modeler · mcp-security-reviewer.

