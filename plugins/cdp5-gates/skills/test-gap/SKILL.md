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

Exit: `0` no gap · `1` ≥1 untested security-critical class · `2` usage error.

## Detection

- **Security-critical** = file name ends in `Voter.php`/`StateProcessor.php`/`Authenticator.php` **or** content `extends …Voter` / `implements …Authenticator|…StateProcessor`.
- **Tested** = a `<Class>Test.php` exists **or** a test file references the class name.

## Afterwards (main agent)

Write tests for the gaps found (TDD-first, CDP5 §11.7/§27.4) — that is the LLM/human stage, not part of this skill.
