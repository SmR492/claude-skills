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

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — every secret match that passes the placeholder filter | yes → exit `1` |
| 🟡 | defect with workaround | no (not emitted by this skill today) |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing `--repo`, path not a directory).
`--json` prints `{ findings[], scanned, unreadable[], hasSecrets }`; every finding carries `sev`, `file`, `line`, `type`, `match` (redacted). Unreadable files (permissions, I/O error) never abort the scan — they are skipped, listed in `unreadable` and counted in the summary line, so a permission problem is not misread as "secrets found".

## Detection

Known key formats (AKIA…, `sk-…`, `ghp_…`/`github_pat_…`, `xox…`, `AIza…`), private key blocks, JWTs and secret assignments (`api_key/secret/token/password/passwd/access_key = <12+ chars>`).

**Placeholder filter** (applies to the value of a secret assignment only; the known key formats are always reported). A value is skipped when it starts with one of:

- a word form **followed by a separator** `_` or `-`: `your_`, `example-`, `changeme_`, `placeholder-`, `dummy_`, `test_`, `sample-` …
- `xxx…` (three or more `x`), `${` (interpolation), `<` (angle-bracket template)

The separator is required so that a real credential that merely starts with `test…`, `sample…` or `dummy…` (e.g. `test8f3kd9s0a1b2c3d4e5`) is still reported.

Findings are printed **redacted** (no cleartext leak in the report). `node_modules`/`vendor`/`.git` etc. skipped, files ≥ 1 MB skipped, symlinks not followed. Overlong lines are truncated to 4000 characters before matching (ReDoS protection).

## Limits

- Only the listed extensions and `.env*` files are scanned (binary blobs, archives, images are not).
- Generic high-entropy strings without a recognisable prefix or an assignment keyword are not detected.
- Secrets split across lines or built by concatenation are not detected.
