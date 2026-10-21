---
name: pii-scan
description: Read-only, dependency-free cleartext PII detector for a repo/test data/traces (email, IBAN with mod-97, phone, credit card with Luhn). Use on "PII scan", "no personal data in repo/test data", privacy check before commit/release, as a CI gate (feeds the Secure gate).
---

# pii-scan (CDP5 T1 gate, §15.6/§15.7/§2.7)

Finds cleartext PII (deterministic, redacted output, `node:` builtins only). Addresses the obligation "no personal production data in repo/test data/traces".

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/pii-scan/pii-scan.mjs" --repo=<root> [--json]
```

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — every PII match that passes the placeholder filter and its checksum | yes → exit `1` |
| 🟡 | defect with workaround | no (not emitted by this skill today) |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing `--repo`, path not a directory).
`--json` prints an array of findings; each carries `sev`, `file`, `line`, `type`, `match` (redacted).

## Detection

- **Email** · **phone** (international, `+CC …`) — regex only.
- **IBAN** — regex plus ISO 13616 **mod-97** check (`iban97()`: first four characters moved to the end, letters → `10..35`, remainder must be `1`). Only IBANs that pass are reported, so random `XX00…` identifiers are not.
- **Credit card** — regex plus **Luhn** check.

Placeholders are tested against the matched value and skipped: `${…}` interpolation, `your_…`/`your-…`, `example.com`/`example.org`/`@example.`, `xxx…`, `changeme`, `<…>`, twelve or more consecutive zeros (all-zero test cards). Findings are **redacted**; `node_modules`/`vendor`/`.git` etc. skipped; files > 1 MB omitted; symlinks not followed; unreadable files skipped silently.

## Limits

- IBAN country-specific lengths are not enforced (only the 15–34 range and the mod-97 remainder).
- Names, addresses, dates of birth and other free-text PII are not detected (no NLP).
- Phone numbers without a `+CC` prefix are not detected.

## Hybrid (important)

The regex part is deterministic; the **semantic** classification (real name vs. random string, context) belongs in a `review-verify` overlay — `pii-scan` is a **hint gate**, not a final truth decision (CDP5 §10.6).
