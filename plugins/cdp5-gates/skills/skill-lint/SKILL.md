---
name: skill-lint
description: Read-only lint of skill and agent definitions in a skill directory, plugin or marketplace. Checks the Agent Skills specification (name, description, size, references), the repository conventions (English, no thinking phrases, model and effort values) and supply-chain signals before a third-party skill is installed (remote execution, credential reach, instruction override, encoded payloads, install-time scripts, unpinned sources). Use before installing a plugin, after writing a skill or agent, and in CI on this repository.
---

# skill-lint (CDP5 T1 gate, §32.9 and §33.3)

Deterministic detector for three questions about a skill: is it well formed, does it follow our conventions, and does it carry anything a skill has no business carrying. Read-only. The main agent reads every flagged file; a finding is a reason to look, an exit `0` is not a clearance.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/skill-lint/skill-lint.mjs" --path=<skill dir | plugin dir | marketplace root> [--no-scan] [--spec-only] [--json]
```

Exit: `0` no 🔴 · `1` at least one 🔴 · `2` usage error. A path with a `SKILL.md` is one skill; any other directory is walked for `SKILL.md` files and `agents/*.md` files.

## Checks

Specification (agentskills.io):

- 🔴 **S1** no frontmatter. **S2** `name` missing or not 1–64 lowercase letters, digits and single hyphens. **S3** `name` differs from the directory name (skills) or file name (agents). **S4** `description` missing or over 1024 characters.
- 🟡 **S4** description does not say when to use the skill. **S5** body over 500 lines. **S6** referenced file missing. **S7** `compatibility` or `allowed-tools` malformed.
- 🟢 **S6** reference nested deeper than one level. **S8** frontmatter key unknown to the spec and to Claude Code.

Conventions of this repository (off with `--spec-only`):

- 🟡 **C1** thinking phrase in the body. **C2** three or more emphatic markers (the capitalised must, never, always, critical, important). **C3** three or more German prose lines. **C4** agent `model` or `effort` outside the known values.

Supply chain (off with `--no-scan`), over every file of the tree:

- 🔴 **X1** remote or dynamic code execution (a download piped into a shell, `eval`, `Invoke-Expression`, decoded base64 piped into a shell). **X2** reach into credential stores (SSH keys, cloud credential files, netrc, secret-looking environment variables). **X3** text that tells the agent to disregard its earlier rules or to conceal a step from the user. **X7** hook command that downloads or sends over the network.
- 🟡 **X4** network access in code. **X5** encoded payload (long base64, hex runs, `atob`). **X6** unpinned `npx`/`pip`/`gem` execution, install-time scripts in `package.json`. **X7** hook command outside the plugin root. **X8** marketplace plugin source without a commit or tag pin. **X9** binary, oversized or symlinked file.
- A signal in a test or fixture file, in a comment, or inside a regular-expression definition is reported as 🟢: Claude Code never executes the first two, and the third is a detector, not an action. Read them anyway when the skill is foreign.
- Per signal and file, the scan reports the first 🟢 hit once and keeps scanning until it meets a hit that is not downgraded, which it reports at full severity and then stops. A comment that mentions `eval(` therefore never hides a real `eval(payload)` further down the same file.

## Limits

- Pattern-based. Obfuscation that splits a keyword across string concatenation, or code loaded at runtime from an allowed-looking URL, is not seen. The counter-check is reading the flagged files and the hooks.
- `X3` scans markdown, text and JSON; code is out of scope for that check, so a lint whose source contains the attack phrases (like `mcp-config-lint`) is not flagged there, and a pattern definition in code is reported as 🟢 by the other checks.
- `S6` checks only references into the skill's own subdirectories (`references/`, `scripts/`, `assets/`, …); a path whose first segment is not a directory of the skill is treated as pointing elsewhere.
- The German heuristic counts function words outside tables and quotes; a skill that legitimately quotes German doctrine may reach the threshold.
- The check does not run the skill and does not inspect what a skill's scripts download at runtime; `claude plugin eval` and `/skill-doctor` measure behaviour and cost, this lint measures the files.
