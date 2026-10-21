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

Exit: `0` skeletons generated (code on stdout, a one-line summary on stderr) · `2` usage or input error — including "no AC tables found" (message: run `konzept-lint` first). This skill is a generator, not a gate: it emits no 🔴/🟡/🟢 findings and never exits `1`; a concept without ACs is an input state, which is why it shares exit `2` with the usage errors.

## Convention

- A **UC** is a `## UC-…` or `### UC-…` section (shared parser `parseUCs` in `lib/scan.mjs`, identical to `konzept-mapper`).
- AC rows `| AC-N | criterion | test type | Class::method | status |` inside a UC (cf. CDP5 §11.7). Test class/method come from the column containing `Class::method` (or a `…Test` class name); if absent, the class is derived from the UC title and the method from the AC id. Duplicate method names within a class are suffixed `_2`, `_3`, ….
- `--lang=php` (PHPUnit, default: one `final class … extends TestCase` per test class, `markTestIncomplete` per AC) or `js` (one `node:test` entry per AC that throws). Afterwards: `tdd` loop (red → green per AC); `konzept-mapper` later checks whether the classes really exist.
