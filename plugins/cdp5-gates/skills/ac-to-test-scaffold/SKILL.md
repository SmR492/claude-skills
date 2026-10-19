---
name: ac-to-test-scaffold
description: Read-only test scaffolding from the concept. Generates placeholder test skeletons (incomplete/todo, not red tests) from the acceptance-criteria tables of a concept (one test method per AC, criterion as comment) — tests FROM the spec, not from the code (TDD-first). Use before implementation ("TDD-first", "tests from the concept", "generate test skeletons").
---

# ac-to-test-scaffold (CDP5 T1 gate, §11.7/§27.4)

The **TDD-first bridge**: reads the `## UC-…` + acceptance-criteria tables and prints test skeletons (one method per AC, `markTestIncomplete`/`throw`, criterion as comment). The skeletons are **placeholders (incomplete/todo), not red tests** — the dev replaces each placeholder with a real failing assertion before implementing. This way tests originate **from the concept** instead of backwards from the code (avoids the §11.5 anti-pattern). **Read-only:** prints to stdout; dev/orchestrator creates the files.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/ac-to-test-scaffold/ac-to-test-scaffold.mjs" --konzept=<konzept.md> [--lang=php|js]
```

Exit: `0` skeletons generated · `1` no ACs found (run `konzept-lint` first) · `2` usage error.

## Convention

AC rows `| AC-N | criterion | test type | Class::method | status |` (cf. CDP5 §11.7). Test class/method come from the `Class::method` column; if it is absent, they are derived from the UC/AC id. `--lang=php` (PHPUnit, default) or `js` (node:test). Afterwards: `tdd` loop (red → green per AC); `konzept-mapper` later checks whether the classes really exist.
