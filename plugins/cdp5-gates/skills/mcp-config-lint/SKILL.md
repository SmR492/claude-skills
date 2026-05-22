---
name: mcp-config-lint
description: Read-only Risiko-Lint einer MCP-Server-Konfiguration (.mcp.json / mcpServers). Flaggt Tool-Description-Injection (Tool-Poisoning), ungepinnte Pakete (Rug-Pull/Supply-Chain), Cleartext-Secrets in env, ungevettete Drittanbieter-Server. Use bei „MCP-Config prüfen", „mcp.json security", vor dem Einbinden fremder MCP-Server.
---

# mcp-config-lint (CDP5 T1-Gate, §33.3)

Heuristischer Detektor für die im MCP-Heft beschriebenen Angriffsvektoren. Read-only; der Main-Agent bewertet die Befunde + entscheidet (Vetting, Pinning, Secret-Auslagerung).

## Aufruf

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/mcp-config-lint/mcp-config-lint.mjs" --config=<.mcp.json> [--json]
```

Exit: `0` keine 🔴 · `1` ≥1 🔴 (Injection-Signal / Cleartext-Secret) · `2` Nutzungsfehler.

## Checks

- 🔴 **Injection-Signal** in Server-/Tool-Beschreibung (ignore previous, `.ssh`/`id_rsa`, base64/curl, `.env` …) → Tool-Poisoning-Verdacht.
- 🔴 **Cleartext-Secret** in `env.*` (langer Token statt `${ENV_VAR}`).
- 🟡 **Ungepinntes Paket** (`npx @scope/pkg` ohne `@version`) → Rug-Pull/Supply-Chain.
- 🟡 **Drittanbieter-Server** (kein `modelcontextprotocol`-Paket) → Trust-Source vetten.

Heuristisch — Befunde sind Hinweise, die der Main-Agent verifiziert (CDP5 §10.6).
