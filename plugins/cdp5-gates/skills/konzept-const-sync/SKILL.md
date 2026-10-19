---
name: konzept-const-sync
description: T1 gate against constant drift between concept prose and code spec. Diffs numeric constants in a concept document (enumeration scales, named thresholds, inline arithmetic) against the single source of truth (`rules.mjs` `DEFAULT_SPEC`) and optionally `conformance.mjs`. Tracked keys are configurable via `--keys`; the default set is the NSAI-Edge one. Closes the error class "constant in prose ≠ code", which green tests AND adversarial audits systematically miss. Use for "check constants against spec", "const drift", "sourceTier/threshold drift", BEFORE merging concept changes that contain numeric values.
---

# konzept-const-sync (CDP5 T1 gate)

## Why

From the concept error findings of 2026-05 (NSAI-Edge K1/K2): a `sourceTier` scale defined in `rules.mjs` was repeated in the concept text (UC-MS) with **different** numbering (`behoerde=4` instead of `5`, phantom tier `audit=6`), and an AUTH_FLOOR example calculated wrongly (`full × fachquelle = 3000`, but declared as "reaches 4500"). Both would have led a PHP re-implementation written **from the text** into parity drift.

This class is treacherous: **green tests only read `rules.mjs`** (they never see the text), **adversarial audits only check behaviour** (they never see the prose). Only a text↔spec diff catches it — deterministically, in 0 LLM tokens.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-const-sync/konzept-const-sync.mjs" \
  --konzept=<KONZEPT.md> --spec=<rules.mjs> [--conformance=<conformance.mjs>] [--keys=<keys.json>] [--json]
```

**Executes the module's top-level code via `import()`; run only on code built in this repository (§33.1).** This applies to `--spec` and `--conformance`: whatever those modules do at import time happens on the host.

The spec must provide `export const DEFAULT_SPEC = {...}`. `conformance.mjs` (optional) is mirrored against the spec: every exported object is compared key by key against the tracked scalar keys (e.g. `QUORUM_CONSTANTS.quorumAuthFloor`, `DECAY_RECALL_CONSTANTS.recallDecayDivisor`).

## Severity and exit codes

| Marker | Meaning | Gates? |
|---|---|---|
| 🔴 | blocks — every drift finding (annotation, declaration, arithmetic, phantom, mirror) | yes → exit `1` |
| 🟡 | defect with workaround | no (not emitted by this skill today) |
| 🟢 | polish | no (not emitted by this skill today) |

Exit: `0` no 🔴 · `1` ≥1 🔴 · `2` usage or input error (missing `--konzept`/`--spec`, path not a file, import failure, no `DEFAULT_SPEC`, invalid `--keys` file).
`--json` prints `{ konzept, lines_scanned, tracked_constants, keys_source, findings, conformance_checked, exit, findings[] }`; every finding carries `sev`, `line` (0 = mirror), `kind`, `detail`.

## Tracked keys (`--keys`)

The plugin is project-independent; the key set is data. `--keys=<file>` takes a JSON **array**; each entry is a spec key name or an object:

```json
[
  "quorumAuthFloor",                                   // scalar (number): annotation + declaration
  { "name": "AUTH_FLOOR", "spec": "quorumAuthFloor" }, // alias used in the concept text
  { "name": "reinforceDelta", "mode": "annotation" },  // tunable: annotation form only
  { "name": "sourceTier", "mode": "map" },             // object: every key → annotation + declaration
  { "name": "quorumTrustRank", "mode": "map-annotation" },
  { "name": "decayPerPeriod", "mode": "permille" }     // object: every key → `name … N ‰`
]
```

- Without `mode`, a numeric spec value is `scalar`, an object value is `map`.
- Later entries win on name collision (default list: `quorumTrustRank.authoritative=1500` beats a tier of the same name).
- A name absent from the spec is skipped silently (the same key file can serve several spec versions).
- **Without `--keys` the default is the NSAI-Edge set** (`DEFAULT_KEYS` in the script): `sourceTier` (map), `quorumTrustRank` (map-annotation), `decayPerPeriod` (permille), normative scalars `quorumAuthFloor`/`AUTH_FLOOR`, `quorumMulti`, `deleteThreshold`, `quarantineThreshold`, `contestedThreshold`, `beliefSharpness`, and the tunables `reinforceDelta`, `recallProtectionDays`, `recallDecayDivisor`, `demoteLimitedThreshold`, `demoteUntrustedThreshold`, `trustAdjustMinEvidence` (annotation only). `keys_source` in the JSON output tells which set was used.

## Checks (deterministic, no LLM)

1. **Annotation** `name(N)` — `name` must have exactly this value in the spec. Allowed names: keys of `map`/`map-annotation` entries and all scalar/annotation entries.
2. **Map-key declaration** `name = N` / `name: N` — keys of `map` entries (`tier-decl`). Catches the K1 class (scale enumeration in the text).
3. **Scalar declaration** `KEY = N` — `scalar` entries only (`scalar-decl`); `annotation` entries are deliberately excluded (see limits).
4. **Permille** `name … N ‰` (‰-anchored) — keys of `permille` entries (`decay-decl`).
5. **Arithmetic** `a × b = c` (purely numeric AND annotated `name(A) × name(B) = C`) — verifies the product. Catches the K2 class.
6. **Phantom key** — an unknown `name=N` token in a line with ≥2 known map keys (e.g. `audit=6`).
7. **Mirror** (with `--conformance`) — exported objects of `conformance.mjs` vs. the tracked scalar values of the spec.

## Deliberate scope limits (false-positive protection)

- **Tunables** (`annotation` mode) are checked ONLY in annotation form `KEY(N)` — a bare `recallProtectionDays = 0` line in the concept is an **AC scenario** ("=0 disables the feature"), not a default claim.
- **`map-annotation`** keys (`quorumTrustRank`, `authoritative`=1500) are NOT checked in declaration form (collides with the trustFactor scale, `authoritative`=1000); only the annotation form applies.
- Non-numeric spec values (e.g. `recencyHalflifeDays` with `∞`) are not checked.
- **Author convention (deliberate, not softened in the gate):** whoever describes a WRONG value as an example (drift demo, "before/after") does NOT write it in `name=N` / `name: N` declaration form — otherwise the gate correctly flags it as drift. Use prose form without `=`/`:` instead: "`behoerde` at 4 instead of 5". The gate stays strict (reliably catches real drift); the discipline lies with the text.
- Meaning/wording correctness remains judgement (`konzept-reviewer`). Findings are hints that the main agent verifies (CDP5 §10.6).

## Why dedicated (not inside `konzept-model-api`)

`konzept-model-api` diffs PHP enums ↔ OpenAPI YAML. `konzept-const-sync` diffs concept prose ↔ JS `DEFAULT_SPEC` — different source domain, different parser. Kept separate, both stay focused.

## Example output

```
konzept-const-sync — 1718 lines, 25 tracked constants, 2 drift findings

  🔴 L1035 [tier-decl] — `behoerde=4` ≠ sourceTier 5
  🔴 L1047 [arithmetic] — 1000 × 3 = 4500 (correct: 3000)

2 drift  ·  exit 1
```
