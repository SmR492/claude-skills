# Konzept — cdp5-init (hybrid skill: connect CLAUDE.md to the marketplace)

**Version:** 1.1
**As of:** 2026-05-26
**Scope:** A skill `cdp5-init` that connects a **consumer's CLAUDE.md** to the `claude-skills` marketplace: a project-independent **marker block** (`<!-- cdp5:start -->…<!-- cdp5:end -->`) with a reference to **CDP5**, the **`cdp5-reference` gate** ("load the doctrine excerpt before every task"), the **trigger map** (user statement → skill/agent) and the list of `cdp5-gates` skills + `cdp5-agents`. A repeated run = **update** (the block is replaced idempotently). **Not included:** writing outside the marker block, project-specific content in the block, changes to the skills/agents themselves, `settings.json`/hook setup (that is done by `tooling/install.sh` in the respective repo).

## Determinism profile (hybrid, §32.9)

| Part | Kind | Evidence |
|---|---|---|
| Merge/diff core (`cdp5-init.mjs`: insert/replace block between markers, compute diff) | **deterministic (T1)** | `node:test` (idempotence, marker preservation) |
| Confirmation loop + AI adjustment on rejection | **interactive/probabilistic** | diff counter-check + user confirmation (see probabilistic statement) |

## Probabilistik-Statement (probabilistic statement) (§2.6, UC-03 only)

| UC | Tolerance threshold | Validation strategy | Fallback | EU AI Act class |
|---|---|---|---|---|
| UC-01/02/04 (merge/diff/write) | n/a (deterministic) | Output = evidence (diff/exit code) | — | minimal |
| UC-03 AI block adjustment | ~85 % (proposal) | **Kontext** (context) = current CLAUDE.md + change request; **Ausgabe** (output) = adjusted block; **Validierung** (validation) = renewed deterministic diff + user confirmation; **Fallback** = operator edits manually; **Cutoff** n/a (no external knowledge retrieval) | Operator hand edit | minimal |

**Vendor risk:** merge core is pure Node.js (vendor-independent); the AI adjustment branch uses Claude Code (method transferable to another agent runner).

## 1. Roles

| Role | Description |
|---|---|
| `Operator` | Human; confirms the diff (yes/no), formulates change requests, carries the responsibility for writing |
| `Orchestrator` | Main agent: runs `cdp5-init.mjs`, shows the diff, asks the yes/no question, takes over the AI adjustment on "no" |
| `cdp5-init.mjs` | deterministic T1 core (diff/merge/write), read-only except with `--write` |

## 2. Use case overview (§2.2)

UC-01 diff preview (read-only) · UC-02 confirm + apply · UC-03 reject → AI adjustment · UC-04 idempotence/update contract.

## 3. Use Cases

### UC-01: Diff preview (read-only, default)
**Actor:** `Orchestrator`/`Operator` · **Step type:** Deterministic

**Behaviour**
1. `cdp5-init.mjs --target=<CLAUDE.md>` (without `--write`) reads the target file (if it does not exist → empty starting text).
2. Computes the target state: marker block present → replace; not present → append at the end.
3. Prints a **unified diff** (current → target) to stdout, **writes nothing**. Exit 0.

**Error cases**
| Case | Behaviour |
|---|---|
| `--target` missing | Exit 2 + usage |
| `--target` is a directory instead of a file | Exit 2 (`guardPaths`, input robustness contract) |
| Block source (`cdp5-block.md`) not readable | Exit 2 + hint |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Without `--write` the target file is **not** changed (read-only) | Integration | green |
| AC-2 | Diff shows append (no marker) or replace (marker present) correctly | Unit | green |

### UC-02: Confirm + apply
**Actor:** `Operator` (confirmation) · **Step type:** Interactive → deterministic

**Behaviour**
1. Orchestrator shows the UC-01 diff and asks **one** yes/no question.
2. On **yes**: `cdp5-init.mjs --target=<CLAUDE.md> --write` → idempotent marker merge, file written. Exit 0.
3. Confirmation of the application (path + replaced/appended).

**Error cases**
| Case | Behaviour |
|---|---|
| Target file not writable | Exit 2 + message, no partial write |
| Write aborts | File unchanged (atomic: first assemble completely, then write) |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | `--write` writes the block only between the markers; content outside stays **byte-identical** | Integration | green |
| AC-2 | Writing happens only after `--write` (i.e. after the operator's "yes") | Integration | green |

### UC-03: Reject → AI-assisted adjustment
**Actor:** `Operator` + `Orchestrator` · **Step type:** Interactive/probabilistic

**Behaviour**
1. On **no** the Orchestrator asks **what** is to be adjusted.
2. The Orchestrator adjusts the block content AI-assisted (e.g. only the trigger map, a different order) and passes it as `--block=<angepasst.md>`.
3. Renewed UC-01 diff (deterministic counter-check) → back to UC-02 (yes/no). Loop until "yes" or abort.

**Error cases**
| Case | Behaviour |
|---|---|
| Repeated rejection / no consensus | Abort; operator edits the CLAUDE.md manually (fallback) |
| AI adjustment violates the marker format | deterministic merge rejects it (markers must be preserved) |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | `--block=<datei>` replaces the default block content in the merge (AI output can be fed in) | Unit | green |
| AC-2 | After an adjustment a diff is shown + confirmed again (no write without a renewed "yes") | Integration | green |

### UC-04: Idempotence/update contract
**Actor:** `cdp5-init.mjs` · **Step type:** Deterministic

**Behaviour**
1. Second `--write` run with the same block → file is **unchanged** (block replaces itself, no duplicate).
2. On a block update (new skills/agents) → only the marker block changes, the rest of the CLAUDE.md stays untouched.

**Error cases**
| Case | Behaviour |
|---|---|
| Several marker pairs in the file | first pair is replaced, further ones reported (warning), no silent multiple write |
| Only start or only end marker present (broken) | Exit 2 + hint "Marker-Paar inkonsistent" (marker pair inconsistent), no write |

**Acceptance criteria**
| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Second identical `--write` run → 0 byte diff (idempotent) | Integration | green |
| AC-2 | Inconsistent marker pair → Exit 2, no write | Integration | green |

## 4. Entities / artefacts

| Artefact | Type | Location |
|---|---|---|
| `cdp5-init.mjs` | T1 core: `mergeBlock(md, block)`, `computeDiff(a, b)`, CLI `--target/--diff/--write/--block` | `…/skills/cdp5-init/` |
| `cdp5-init.test.mjs` | Tests (idempotence, marker preservation, read-only default, inconsistent markers) | `…/skills/cdp5-init/` |
| `SKILL.md` | interactive orchestration (diff → yes/no → AI adjustment loop) | `…/skills/cdp5-init/` |
| `cdp5-block.md` | **Source of truth** of the marker block (CDP5 reference, cdp5-reference gate, trigger map, skills/agents list) | `…/skills/cdp5-init/` |
| `lib/args.mjs` (`guardPaths`) | reused for `--target`/`--block` path guards | `…/lib/` |

## 5. Glossary

| Term | Definition |
|---|---|
| Marker block | Area between `<!-- cdp5:start -->` and `<!-- cdp5:end -->`; the only place `cdp5-init` writes |
| idempotent merge | a repeated run with the same block does not change the file (block replaces itself) |
| Hybrid skill | deterministic core (T1) + interactive/probabilistic orchestration (SKILL.md), §32.9 |
| cdp5-reference gate | Directive in the block: "vor jeder Aufgabe Doktrin-Ausschnitt via `cdp5-reference` laden" (load the doctrine excerpt via `cdp5-reference` before every task) (§28.6 JIT) |

## 6. Changelog

**v1.0 (2026-05-26):** Initial Konzept (concept document). Closes the gap "a fresh marketplace install does not wire up any CLAUDE.md": a hybrid skill `cdp5-init` merges a project-independent marker block (CDP5 reference + cdp5-reference gate + trigger map + skills/agents) idempotently into the target CLAUDE.md. Flow: read-only diff → operator confirmation (yes/no) → on "yes" `--write`, on "no" AI adjustment + renewed diff. First writing `cdp5-gates` skill — hence writing only between markers, only with `--write`, only after confirmation. Reference: CDP5 §32.9 (hybrid), §1.6/§23 (human responsibility when writing), input robustness contract (`guardPaths`). `konzept-reviewer` score = **9.5/10** (konzept-lint part 10/10).

**v1.1 (2026-05-26, implemented):** Implemented after score approval (14th cdp5-gates skill). `cdp5-init.mjs` (deterministic core: `mergeBlock`/`computeDiff`/`findBlock` + CLI `--target`/`--diff`/`--write`/`--block`) + `cdp5-block.md` (source-of-truth block) + interactive `SKILL.md`. Reviewer polish dim 6 incorporated: deterministic **block invariant** (`blockInvariantError` — CDP5 reference + cdp5-reference gate must be preserved, otherwise reject Exit 2; covers the AI adjustment branch) + test that the default block contains the gate. 11 tests; dogfood: diff→write→idempotent, existing content preserved. AC red→green. Marketplace/README/§7 count (13→14) updated.
