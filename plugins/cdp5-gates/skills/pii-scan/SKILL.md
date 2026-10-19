---
name: pii-scan
description: Read-only, dependency-free cleartext PII detector for a repo/test data/traces (email, IBAN, phone, credit card with Luhn). Use on "PII scan", "no personal data in repo/test data", privacy check before commit/release, as a CI gate (feeds the Secure gate).
---

# pii-scan (CDP5 T1 gate, §15.6/§15.7/§2.7)

Finds cleartext PII (deterministic, redacted output, `node:` builtins only). Addresses the obligation "no personal production data in repo/test data/traces".

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/pii-scan/pii-scan.mjs" --repo=<root> [--json]
```

Exit: `0` clean · `1` ≥1 finding · `2` usage error.

## Detection

Email · IBAN · phone (intl.) · credit card (with **Luhn** check against false positives). Placeholders (`${…}`, `your_…`, `example.com`, `<…>`, `changeme`) are ignored; findings are **redacted**; `node_modules`/`vendor` etc. skipped, files > 1 MB omitted.

## Hybrid (important)

The regex part is deterministic; the **semantic** classification (real name vs. random string, context) belongs in a `review-verify` overlay — `pii-scan` is a **hint gate**, not a final truth decision (CDP5 §10.6).
