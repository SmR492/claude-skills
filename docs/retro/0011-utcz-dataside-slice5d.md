# Retro-ADR 0011 — UTC-Z on the data side (NSAI-Edge Slice #5d)

**Status:** completed (adversarial NO→fix→YES-with-reservation→YES) · autonomous + self-merged (PR #11)
**Date:** 2026-05-28
**Purpose:** Retrospective of the UTC-Z data-side slice and the two adversarial audit rounds — the second audit found three more 🔴 paths that I had overlooked in the first build-out.

## Context
Slice #5 (UC-BT) had normalized UTC-Z only on the **read side** (`_validClause(as_of)` via `_normIso`). The **data side** (`storeTriple`/`mergeIncoming`/`clone` etc.) stored `asserted_at`/`occurred_at` verbatim — offset notations such as `+02:00` stayed in, and the lexicographic SQLite comparison shifted the visibility of a fact stored with `+02:00` into the future by the offset difference. The auditor had uncovered this in Slice #5b as 🟡-C and deferred it as "own follow-up slice" — redeemed today.

## CDP5-checked architecture decision
**`asserted_at` is part of the `signingString` → no in-place mutation possible**, otherwise origin signatures would be invalidated (we cannot re-sign, the origin private key is missing). Solution: **derived columns** `asserted_at_norm` + `occurred_at_norm` (additive, filled idempotently). `_edgeToWire` ignores `_norm` → wire/signature untouched.

`valid_from`/`valid_to`, by contrast, are LOCAL (not in the wire) → in-place normalization permissible (defense in depth added in the migration).

## Decision chronicle
- **E1** — Konzept-first (Konzept = concept document): UC-5d into KONZEPT.md with design constraint, AC-5d.1–8, error cases. Lint 10/10.
- **E2** — Implementation: schema extension, migration helper, all write paths (storeTriple/mergeIncoming/clone/infer/recordEpisode) also write `_norm`; read paths (`_validClause`/`_withinWeight`/recallEpisodes since-until) switched to COALESCE. 155/155 tests.
- **E3** — Live-DB-copy verification: 12193 edges, migration ran through in 74 ms, 100 % _norm-filled, second run 3 ms no-op. The current live DB has NO offset records (the defect was potential, no historical damage).
- **E4** — Adversarial audit round 1: **NO**, three overlooked 🔴 paths:
  - 🔴-1 `episodicGc` `DELETE FROM episodes WHERE occurred_at < ?` → real data loss for offset episodes.
  - 🔴-2 `recallEpisodes` `ORDER BY occurred_at DESC` → wrong limit order.
  - 🔴-3 `episodesForTriple` `ORDER BY e.occurred_at DESC` → provenance sorting.
- **E5** — Fix: three one-line `COALESCE(_norm, original)` adjustments + three regression tests (158/158 green).
- **E6** — Adversarial audit round 2: **YES-with-reservation**. Three 🔴 cleanly fixed + empirically verified. New 🟡: the migration did not normalize `valid_from`/`valid_to` (asymmetric to the `_norm` columns). Not reachable in the current engine path, but a defense-in-depth gap. **Fixed along in the same slice** (4 lines, same UTC-Z class), AC added. 159/159.
- **E7** — Re-verification on the live-DB copy: 0 residual offset values in valid_from/valid_to (clean).
- **E8** — Self-merge PR #11.

## Process lesson (core)
**The first adversarial audit rarely finds EVERYTHING.** Slice #5b produced an auditor with 3 findings — Slice #5d produced two auditor rounds with a total of four findings (3×🔴 + 1×🟡) that I had overlooked in the first build-out. In particular, the `ORDER BY`/`DELETE` paths were only discovered **during the systematic path sweep** — I had adjusted WHERE filters without carrying the SORT/DELETE paths of the same column along. **Lesson:** for a column semantics change (raw → normalized), ALL occurrences of the column MUST be grepped and decided individually — not just the obvious read clauses.

**Re-audit after a fix is not optional, it is mandatory.** The first fix proposal might have been "fix the three places" — but the re-audit found the fourth (migration asymmetry). That is exactly the anti-sycophancy pattern we demand: a confirming second reviewer would say "green" because three findings are cleanly fixed; an adversarial one finds the remaining asymmetry. [[feedback-green-tests-bypass-security]]

**Live-DB-copy verification carries mandatory weight.** A migration on 12k+ real edges behaves differently than on in-memory fixtures (idempotency, performance, residual values). Verification on the copy is cheap (74 ms) but delivers hard evidence.

## Substantive lesson
**The wire contract forbids in-place mutation of signed fields.** `asserted_at` is part of the `signingString` — a subsequent UTC-Z normalization would make the origin signature unverifiable. Derived columns are the clean pattern: original intact for the signature, `_norm` for local read lenses. `_edgeToWire` must explicitly exclude `_norm` columns — otherwise it would be a wire leak.

**`valid_from`/`valid_to` must be treated differently.** These columns are LOCAL (not in the wire/signature), so in-place normalization in the migration is permissible and simpler than a second `_norm` column.

**Lexicographic SQL comparison needs UTC-Z consistency at ALL comparison sites.** A WHERE clause with `_norm` and an ORDER BY without is an inconsistency that leads to drift at the threshold (see 🔴-2/-3).

## Open
- 🟡 Performance index on `_norm` columns (auditor recommendation, no correctness bug). Uncritical at current DB sizes — backlog.
- Adopt the re-audit pattern as a skill in the workflow (always a second round after a fix).
