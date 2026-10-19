# Konzept — Input robustness contract for T1 skills

**Version:** 1.1
**As of:** 2026-05-26
**Scope:** A uniform contract under which **every** `cdp5-gates` T1 skill acknowledges faulty input (missing/wrong argument, path type error, malformed structured content) **deterministically with exit code 2 + a readable message** — instead of aborting with an uncaught exception and a stack trace. **Not included:** changes to the skills' domain logic, new detectors, handling of *valid* input (stays unchanged), write/mutation operations (skills stay read-only), unification of the return form of `scanRepo` (separate follow-up item).

## Determinism

All UCs are purely deterministic (Node program, no model call) → tolerance threshold / validation strategy / fallback **n/a**. Same (faulty) input → same exit code + same message. **Vendor risk n/a:** pure Node.js (only `node:` builtins), no external service, no model. Evidence per UC: `node:test` test on exit code/return value.

## 1. Roles

| Role | Description |
|---|---|
| `Orchestrator` | calls skills with arguments; relies on the exit codes (0/1/2) as the CI gate signal |
| `T1-Skill` | deterministic read-only Node program; **must** fulfil the input contract |
| `Operator` | Human; reads the error message and corrects the call |

## 2. Use case overview (§2.2)

UC-01 missing/empty mandatory argument · UC-02 path argument of the wrong type (file ↔ directory) · UC-03 malformed structured input · UC-04 shared guard + contract coverage.

## 3. Use Cases

### UC-01: Missing or empty mandatory argument
**Actor:** `Operator`/`Orchestrator` · **Step type:** Deterministic

**Behaviour**
1. The skill is called without a mandatory argument (e.g. `secrets-scan` without `--repo`).
2. The skill checks the mandatory arguments **before** any file/processing operation.
3. If missing: one `Usage:` line to **stderr**, then `process.exit(2)`.

**Error cases**
| Case | Behaviour |
|---|---|
| Several mandatory args missing | one `Usage:` line (all args named), Exit 2 |
| Mandatory arg without a value (`--repo=`) | treated as missing → Exit 2 |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | A mandatory arg is missing → exit code exactly `2` + `Usage:` line on stderr | Integration | green |
| AC-2 | No stack trace / no uncaught throw on stdout/stderr | Integration | green |

### UC-02: Path argument of the wrong type (file ↔ directory)
**Actor:** `Operator`/`Orchestrator` · **Step type:** Deterministic

**Behaviour**
1. A path argument is passed (e.g. `retro-memory-loop-check --retro=datei.md`, expects a **directory**).
2. The skill checks existence **and** type of the path **before** processing (via `lstatSync`/`statSync`, not only implicitly on `readdir`/`read`).
3. On a type mismatch: message "erwartet \<Verzeichnis|Datei\>, ist \<Datei|Verzeichnis\>: \<pfad\>" (expected directory|file, is file|directory: path), Exit 2.

**Error cases**
| Case | Behaviour |
|---|---|
| Path does not exist | Exit 2, message "nicht gefunden: \<pfad\>" (not found: path) |
| File instead of directory (ENOTDIR class) | Exit 2, **no** `scandir` crash |
| Directory instead of file (EISDIR class) | Exit 2, **no** `read` crash |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | File where a directory is expected → Exit `2` + type hint, **no** ENOTDIR crash | Integration | green |
| AC-2 | Non-existent path → Exit `2` with "nicht gefunden" (not found) | Integration | green |

### UC-03: Malformed structured input (JSON / YAML frontmatter)
**Actor:** `Operator`/`Orchestrator` · **Step type:** Deterministic

**Behaviour**
1. A skill reads a structured input (e.g. `konzept-lint --rubric=…json`, `mcp-config-lint --config=…json`, `profile-check` frontmatter).
2. Parsing is inside `try/catch`.
3. On a parse error: message with file + cause (`e.message`), Exit 2. On a missing optional field: defined default (no crash).

**Error cases**
| Case | Behaviour |
|---|---|
| Empty / partially written JSON file | Exit 2 + parse message |
| Valid JSON, but mandatory key missing | documented default **or** Exit 2 (defined per skill), no crash |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Malformed JSON → Exit `2` + parse message, **no** `SyntaxError` stack trace | Integration | green |
| AC-2 | Valid file → unchanged behaviour (regression, no score/report drift) | Integration | green |

### UC-04: Shared guard + contract coverage
**Actor:** `T1-Skill` (implementer) · **Step type:** Deterministic

**Behaviour**
1. `lib/args.mjs` (new) provides **pure** validators: `pathTypeError(pfad, 'file'|'dir')` → `null | Meldung`; `usage(msg)` (writes stderr, exit 2).
2. Every `main()` calls the validators and maps an error to `console.error(msg); process.exit(2)`.
3. Every skill with a path argument gets a contract test (bad input → Exit 2 or `pathTypeError` ≠ null).

**Error cases**
| Case | Behaviour |
|---|---|
| Guard helper itself throws an exception | Bug → unit test catches it; `pathTypeError` must never throw |
| Skill bypasses the guard (legacy code) | The skill's contract test turns red |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | `pathTypeError` is pure (returns `Meldung\|null`, **never** calls `process.exit`, never throws) | Unit | green |
| AC-2 | Every skill with a path argument has a "bad input → Exit 2" test | CI | green |

## 4. Entities / artefacts

| Artefact | Type | Location |
|---|---|---|
| `lib/args.mjs` | **new** — pure input guards (`pathTypeError`, `usage`) | `plugins/cdp5-gates/lib/` |
| `lib/args.test.mjs` | **new** — unit tests of the guards | `plugins/cdp5-gates/lib/` |
| retro-memory-loop-check | to be adapted (UC-02, ENOTDIR) | `…/skills/retro-memory-loop-check/` |
| konzept-lint | already partly hardened (UC-03 try/catch); add UC-02 for `--konzept` | `…/skills/konzept-lint/` |
| profile-check, mcp-config-lint, konzept-mapper, roadmap-drift, test-gap, wiki-lint, secrets-scan, pii-scan, ac-to-test-scaffold, konzept-model-api, cdp5-reference | path arg guards via `lib/args` (UC-01/02/03) | `…/skills/*/` |

## 5. Glossary

| Term | Definition |
|---|---|
| Exit code contract | `0` = pass/clean · `1` = finding/drift · `2` = usage/input error |
| Input contract | Guarantee of a T1 skill to acknowledge every faulty input as Exit 2 + message, never as an uncaught exception |
| Path type error | Path exists but has the wrong type (file instead of directory = ENOTDIR class; the reverse = EISDIR) |
| pure validator | Function without side effects: returns message/`null`, calls no `process.exit`, does not throw |

## 6. Changelog

**v1.0 (2026-05-26):** Initial Konzept (concept document). Trigger: two uncaught-exception findings of the same class in one session — `konzept-lint --rubric` `SyntaxError` (fixed) and `retro-memory-loop-check` ENOTDIR on file-instead-of-directory. Unified into the input robustness contract (Exit 2 instead of crash) across all 13 T1 skills, with shared `lib/args.mjs` + contract tests. Reference: CDP5 §32.9 (T1 determinism incl. error path), §10.7 (evidence per AC). `konzept-reviewer` score = **9.7/10** (konzept-lint part 10/10).

**v1.1 (2026-05-26, implemented):** Implemented after score approval. New: `lib/args.mjs` (`pathTypeError` pure + `usage`/`guardPaths`) + `lib/args.test.mjs` (7 unit tests). `guardPaths` pulled into all 13 path-taking skills (file↔directory type check before processing). UC-03 fix: `mcp-config-lint` malformed config → Exit 2 (instead of 1). Symlink protection added to the `retro-memory-loop-check` walk. AC status red→green. **59/59 tests green**; the original ENOTDIR case now returns "erwartet Verzeichnis, ist keine" (expected directory, is none) + Exit 2.
