---
name: mcp-config-lint
description: Read-only risk lint of an MCP server configuration (.mcp.json / mcpServers). Flags injection patterns in configuration strings (not in the descriptions delivered by tools/list), unpinned packages (rug-pull/supply chain), cleartext secrets in env, unvetted third-party servers. Use on "check MCP config", "mcp.json security", before wiring in third-party MCP servers.
---

# mcp-config-lint (CDP5 T1 gate, §33.3)

Heuristic detector for the attack vectors described in the MCP booklet. Read-only; the main agent assesses the findings and decides (vetting, pinning, moving secrets out).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/mcp-config-lint/mcp-config-lint.mjs" --config=<.mcp.json> [--json]
```

Exit: `0` no 🔴 · `1` ≥1 🔴 (injection signal / cleartext secret) · `2` usage error.

## Checks

- 🔴 **Injection signal** in the server configuration strings (ignore previous, `.ssh`/`id_rsa`, base64/curl, `.env` …) → suspected tool poisoning.
- 🔴 **Cleartext secret** in `env.*` (long token instead of `${ENV_VAR}`).
- 🟡 **Unpinned package** (`npx @scope/pkg` without `@version`) → rug-pull/supply chain.
- 🟡 **Third-party server** (no `modelcontextprotocol` package) → vet the trust source.

Heuristic — findings are hints that the main agent verifies (CDP5 §10.6).

## Limits

- The lint scans **configuration strings only** (the serialised server block: command, args, env, description fields present in the config). It does **not** inspect the tool descriptions delivered at runtime by `tools/list`; tool-description injection in a live server is therefore outside its reach.
- `--env-file .env` arguments trigger the `.env` injection pattern and produce a **false positive**.
- Not yet detected: `@latest` and other dist-tags (count as "pinned" because an `@` follows the scope), unscoped packages without a version (the package heuristic only looks at `@scope/pkg`), and secrets in `headers` or in a settings-style top-level `env`. These are therefore checked **by hand** by the `mcp-security-reviewer` agent.
- A lint exit `0` is **not a clearance** — it only means none of the implemented heuristics fired.
