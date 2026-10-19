---
name: secrets-scan
description: Read-only, dependency-free cleartext secret scanner for a repo (AWS/OpenAI/GitHub/Slack/Google keys, private keys, JWTs, secret assignments, .env leaks). Use on "secrets scan", "check that there are no secrets in the repo", before commit/release, as a CI gate.
---

# secrets-scan (CDP5 T1 gate, §33.5)

Dependency-free (`node:` builtins only), so it runs anywhere Node is available. Read-only detector; redacted output. Complements — does not replace — specialised tools (gitleaks/trufflehog).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/secrets-scan/secrets-scan.mjs" --repo=<root> [--json]
```

Exit: `0` clean · `1` ≥1 finding · `2` usage error.

## Detection

Known key formats (AKIA…, `sk-…`, `ghp_…`, `xox…`, `AIza…`), private key blocks, JWTs and secret assignments (`api_key/secret/token/password = …`). Placeholders (`${…}`, `your_…`, `changeme`, `<…>`) are ignored. Findings are printed **redacted** (no cleartext leak in the report). `node_modules`/`vendor`/`.git` etc. skipped, files > 1 MB skipped.
