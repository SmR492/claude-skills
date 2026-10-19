---
name: profile-check
description: Read-only conformance check of a concept + repo against a project-profile.md (YAML frontmatter) declared once. Verifies declared defaults instead of asking for them again — EU AI Act class/security_level in the concept, runtime + test framework in the repo, free-form required tokens. Use on "does the project match the profile", "profile check", as a CI gate after setup changes.
---

# profile-check (CDP5 T1 gate, §1.9/§22)

Implements the doctrine **"set the default once, afterwards only conformance checks"**: a project declares its requirements once in `project-profile.md` (architect decision, e.g. EU AI Act class, security level, runtime, test framework); this skill checks **deterministically** (0 model tokens) whether concept and repo conform to it — instead of asking the questions anew at every step.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/profile-check/profile-check.mjs" \
  --profile=<project-profile.md> [--konzept=<concept.md>] [--repo=<root>] [--json]
```

Specify at least `--konzept` or `--repo`. Exit: `0` conformant · `1` profile drift · `2` usage error.

## Profile fields (YAML frontmatter)

| Field | Effect |
|---|---|
| `eu_ai_act_class` | The concept must declare the class + "AI-Act" (the architect sets the class once). |
| `security_level` | `elevated` → the concept must contain threat modeling (§33.4); `standard` → no check. |
| `runtime` | `node`/`php`/`python` — expected runtime markers (package.json/composer.json/… or matching file extensions) in the repo. |
| `test_framework` | `node:test`/`phpunit`/`jest`/`vitest`/`pytest` — at least one test file with a matching signature. |
| `require_in_concept` | Free-form list of required tokens that must occur in the concept text (project-specific mandatory sections). |

Template: [`project-profile.template.md`](project-profile.template.md) (copy, fill in, place in the target project).

## Limits

Deterministic detector: checks **presence/signature**, not semantics. Whether the declared EU AI Act class is regulatorily *correct* remains an architect decision (§1.9/§23) — the skill only checks that it is declared and consistent.
