---
name: konzept-const-sync
description: Read-only T1 gate against constant drift between concept prose and code spec. Diffs numeric constants in a concept document (tier scales, named thresholds, inline arithmetic) against the single source of truth (`rules.mjs` `DEFAULT_SPEC`) and optionally `conformance.mjs`. Closes the error class "constant in prose ≠ code", which green tests AND adversarial audits systematically miss. Use for "check constants against spec", "const drift", "sourceTier/threshold drift", BEFORE merging concept changes that contain numeric values.
---

# konzept-const-sync (CDP5 T1 gate)

## Why

From the concept error findings of 2026-05 (NSAI-Edge K1/K2): a `sourceTier` scale defined in `rules.mjs` was repeated in the concept text (UC-MS) with **different** numbering (`behoerde=4` instead of `5`, phantom tier `audit=6`), and an AUTH_FLOOR example calculated wrongly (`full × fachquelle = 3000`, but declared as "reaches 4500"). Both would have led a PHP re-implementation written **from the text** into parity drift.

This class is treacherous: **green tests only read `rules.mjs`** (they never see the text), **adversarial audits only check behaviour** (they never see the prose). Only a text↔spec diff catches it — deterministically, in 0 LLM tokens.

## Invocation

```bash
node "${CLAUDE_PLUGIN_ROOT}/skills/konzept-const-sync/konzept-const-sync.mjs" \
  --konzept=<KONZEPT.md> --spec=<rules.mjs> [--conformance=<conformance.mjs>] [--json]
```

Exit: `0` consistent · `1` drift found · `2` usage error.

The spec must provide `export const DEFAULT_SPEC = {...}` (dynamic import). `conformance.mjs` (optional) is additionally mirrored against `rules.mjs` (`QUORUM_CONSTANTS`, `DECAY_RECALL_CONSTANTS`).

## Checks (deterministic, no LLM)

1. **Annotation** `name(N)` — `name` must have exactly this value in the spec. Allowed names: `sourceTier` tiers, `quorumTrustRank` ranks (the quorum domain wins on name collision, e.g. `authoritative(1500)` instead of trustFactor `1000`), named scalars.
2. **Tier declaration** `name = N` / `name: N` — against `sourceTier`. Catches the K1 class (scale enumeration in the text).
3. **Scalar declaration** `KEY = N` — **normative verdict thresholds only** (`AUTH_FLOOR`/`quorumAuthFloor`, `quorumMulti`, `deleteThreshold`, `quarantineThreshold`, `contestedThreshold`, `beliefSharpness`).
4. **Decay ‰** `name … N ‰` (‰-anchored) — against `decayPerPeriod`.
5. **Arithmetic** `a × b = c` (purely numeric AND annotated `name(A) × name(B) = C`) — verifies the product. Catches the K2 class.
6. **Phantom key** — an unknown `name=N` token in a line with ≥2 known tier names (e.g. `audit=6`).

## Deliberate scope limits (false-positive protection)

- **Tunables** (`recallProtectionDays`, `recallDecayDivisor`, `reinforceDelta`, `demote*`, `trustAdjustMinEvidence`) are checked ONLY in annotation form `KEY(N)` — a bare `recallProtectionDays = 0` line in the concept is an **AC scenario** ("=0 disables the feature"), not a default claim.
- **trustFactor** (`authoritative`=1000) is NOT checked in declaration form (collides with `quorumTrustRank.authoritative`=1500); only the annotation form of the quorum domain applies.
- **`recencyHalflifeDays`** (with `∞`) is not checked numerically.
- **Author convention (deliberate, not softened in the gate):** whoever describes a WRONG value as an example (drift demo, "before/after") does NOT write it in `name=N` / `name: N` declaration form — otherwise the gate correctly flags it as drift. Use prose form without `=`/`:` instead: "`behoerde` at 4 instead of 5". The gate stays strict (reliably catches real drift); the discipline lies with the text.
- Meaning/wording correctness remains judgement (`konzept-reviewer`). Findings are hints that the main agent verifies (CDP5 §10.6).

## Why dedicated (not inside `konzept-model-api`)

`konzept-model-api` diffs PHP enums ↔ OpenAPI YAML. `konzept-const-sync` diffs concept prose ↔ JS `DEFAULT_SPEC` — different source domain, different parser. Kept separate, both stay focused.

## Example output

```
konzept-const-sync — 1718 lines, 25 tracked constants, 2 drift findings

  ✗ L1035 [tier-decl] — `behoerde=4` ≠ sourceTier 5
  ✗ L1047 [arithmetic] — 1000 × 3 = 4500 (correct: 3000)

2 drift  ·  exit 1
```
