---
name: test-gap
description: Read-only finder for untested security-critical classes (Voter / StateProcessor / Authenticator) in a PHP/Symfony repo. Use for "test coverage gap", "which voters/state processors have no test", before a test-coverage sprint.
---

# test-gap (CDP5 T1 gate)

The detection part of the former `test-gap` agent as a program. Finds security-critical classes **without** a test — deterministically. The **scaffolding** (generating test code) deliberately remains agent/human work (it mutates code → needs a review block).

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/test-gap/test-gap.mjs" --repo=<repo-root> [--json]
```

Exit: `0` no 🔴 (every security-critical class has a test) · `1` ≥1 🔴 (untested security-critical class) · `2` usage or input error.

Every security-critical class is printed as a finding: 🔴 (no test) or 🟢 (tested). `--json` returns `{ gaps[{ class, file, sev }], covered[…], scanned }`.

## Detection

- **Security-critical** = the file name ends in `Voter.php`, `StateProcessor.php` or `Authenticator.php`, **or** the content matches exactly one of:
  - `extends …Voter` (any class whose name ends in `Voter`),
  - an `implements` clause that names `Authenticator`, `AuthenticatorInterface`, `StateProcessor` or `StateProcessorInterface` as a whole word (also in a comma-separated list).
  API Platform's generic `ProcessorInterface` is **not** matched — a plain state processor is not a security gate.
- **Test file** = path contains a `tests/` or `Tests/` directory (either separator, case-insensitive) **or** the file name ends in `Test.php`.
- **Tested** = a `<Class>Test.php` exists **or** any test file references the class name as a whole word.
- Files ending in `Test.php` are never reported as gaps themselves.

## Afterwards (main agent)

Write tests for the gaps found (TDD-first, CDP5 §11.7/§27.4) — that is the LLM/human stage, not part of this skill.
