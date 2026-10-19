---
name: mcp-config-lint
description: Read-only risk lint of an MCP server configuration (.mcp.json / mcpServers). Flags injection patterns in configuration strings (not in the descriptions delivered by tools/list), unpinned packages and images (rug-pull/supply chain), cleartext secrets in env and headers, unvetted third-party and remote servers. Use on "check MCP config", "mcp.json security", before wiring in third-party MCP servers.
---

# mcp-config-lint (CDP5 T1 gate, §33.3)

Heuristic detector for the attack vectors described in the MCP booklet. Read-only; the main agent assesses the findings and decides (vetting, pinning, moving secrets out).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/mcp-config-lint/mcp-config-lint.mjs" --config=<.mcp.json> [--json]
```

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — injection signal, cleartext credential | yes → exit `1` |
| 🟡 | defect with workaround — unpinned, third-party, long literal | no |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing `--config`, path not a file, malformed JSON).
`--json` prints `{ servers, findings[], hasCritical }`; every finding carries `sev` (`🔴`/`🟡`), `server`, `issue`.

## Checks

- 🔴 **Injection signal** in the serialised server block (ignore previous, `.ssh`/`id_rsa`, base64/curl, `.env` …) → suspected tool poisoning.
- 🔴 **Cleartext secret** in `env.*` or `headers.*` when the key looks like a credential (`/(KEY|TOKEN|SECRET|PASS|AUTH|CREDENTIAL)/i`) and the value is a long literal (`[A-Za-z0-9_-]{20,}`) — or when a header value contains `Bearer <16+ chars>`. Values containing `${…}` are treated as references and skipped.
- 🟡 **Long literal** in `env.*`/`headers.*` under a key that does not look like a credential (e.g. `PROJECT_NAME=claude-skills-marketplace-config`) — review, may be harmless.
- 🟡 **Unpinned package/image** (rug-pull/supply chain): `npx @scope/pkg` or `npx pkg` without `@version`; `uvx pkg` without `==version`/`@version`; `docker run … image` without `:tag` or `@sha256:` digest.
- 🟡 **Third-party server**: `npx` package outside the `modelcontextprotocol` org; any server with a `url` (remote) → vet the trust source.

Heuristic — findings are hints that the main agent verifies (CDP5 §10.6).

## Limits

- The injection check runs over the **entire serialised server block** — every string in it (`command`, `args`, `env`, `url`, `cwd`, `headers`, `description`, …). It does **not** inspect the tool descriptions delivered at runtime by `tools/list`; tool-description injection in a live server is therefore outside its reach.
- `--env-file .env` arguments trigger the `.env` injection pattern and produce a **false positive**.
- Still not detected: `@latest` and other dist-tags (count as "pinned" because a version suffix is present), `npx --package=<pkg> <bin>` forms (the package is taken from the first non-flag argument), `uvx --from pkg bin` forms, the trust source of `uvx`/`docker` packages (only `npx` and `url` servers are flagged as third-party), secrets in a settings-style top-level `env` outside the server blocks, secrets passed inline as `args` (`--token abc…`), and header values whose credential sits behind a non-`Bearer` scheme under a key that does not look like a credential. These are checked **by hand** by the `mcp-security-reviewer` agent.
- A lint exit `0` is **not a clearance** — it only means none of the implemented 🔴 heuristics fired; 🟡 findings may still be present.
