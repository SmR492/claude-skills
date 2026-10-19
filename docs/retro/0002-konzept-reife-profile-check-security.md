# Retro-ADR 0002 — Konzept (concept document) maturation (→10/10), profile-check & security pass

**Status:** completed · **Date:** 2026-05-26 · **Mode:** CDP5 §29 Mode A/B + §32 orchestration · **Review:** 3× `konzept-reviewer` re-score (fresh context) + `review-code` security pass + §10.6 verification.

## Context

Continuation of [[project_claude_skills_marketplace]] (Retro-ADR 0001). Task arc of this session: (1) drive the product Konzept `docs/konzept.md` from v1.2 to implementation readiness (goal ≥ 9.0), (2) three new T1 skills (`konzept-lint`, `ac-to-test-scaffold`, `pii-scan`) + `profile-check`, (3) harden the `konzept-reviewer` brief for reproducible scoring, (4) security check with common methods + retro. Final state: Konzept **10.0/10**, `cdp5-gates` **13 T1 skills + lib**, **51 tests green**, 1 🔴 + 2 🟡 security findings fixed.

## Decision chronicle

- **E1 — Dogfooding was the dominant source of value.** Every `konzept-reviewer` re-score uncovered a **real drift in our own artifacts** that green tests did not see: (a) `konzept-lint`/`ac-to-test-scaffold` found **0 UCs** in the flagship Konzept because the parser only recognized `## UC-` (H2) and not also `### UC-` (H3 under `## N. Use Cases`); (b) `hatGlossar` did not match `## 9. Glossar` (numbered); (c) the changelog had v1.2 twice + a scrambled order; (d) a stale "9 skills" reference in UC-03 (§7 counts 13). The gates work against themselves — the cheapest QA was pointing our own tool at our own repo ([[feedback_verify_agent]], [[feedback_auditor_over_self_review]]).
- **E2 — A reproducible score needs an anchored rubric.** The reviewer initially gave a gut overall score. Solution: maturity rubric as a **§10.5 policy artifact** (`reife-rubrik.policy.md` + `.json`) + reviewer brief switched to 7 weighted dimensions, each marked **[det]** (pre-checkable by `konzept-lint` → verify, do not guess again) vs. **[jdg]** + mandatory dimension table + ±0.2 reproducibility. Score 9.0 → 9.7 → 10.0 thus became traceable instead of guessed.
- **E3 — "Set the default once, then only checks" (profile-check).** Recurring project requirements (EU AI Act class, security_level, runtime, test framework) belong **once** in a `project-profile.md` (YAML frontmatter) that `profile-check` deterministically verifies against Konzept + repo — instead of asking for them anew at every step. This solved the open EU AI Act point **structurally**. The regulatory class *determination* itself remained an architect gate (§23, AskUserQuestion confirmed = minimal), not an AI assumption ([[feedback_clarify_before_assuming_scope]]).
- **E4 — Security: deterministic gates first, then OWASP judgment.** T1 gates (`secrets-scan`/`pii-scan`) run on the repo → only intentional `*.test.mjs` fixtures, no real leak. Then `review-code` (OWASP-oriented: ReDoS, prototype pollution, path/symlink, injection, redaction). Finding **🔴 ReDoS**: greedy e-mail regex × 1 MB single line → O(n²), ~100 s gate DoS (measured empirically). Plus 🟡 `JSON.parse` without try/catch (crash + wrong exit 0) and 🟡 `statSync` follows symlinks (out-of-tree read/loop). Fix: bounded quantifiers + line cap (100 s → **1 ms**); try/catch → exit 2; `lstatSync` + symlink skip in the shared `lib/scan.mjs` (covers 6 skills). Verified (§10.6) before implementing.
- **E5 — Test writing as design feedback.** While writing the regression test for the symlink fix it became apparent: `secrets-scan.scanRepo` returns `{findings,scanned,hasSecrets}`, `pii-scan.scanRepo` an **array** — two sibling skills with an inconsistent return shape. The test exposed the inconsistency (setup assertion failed). The three findings had **no** existing test coverage — green suite ≠ covered.

## What went well / better

- **Good:** re-score loop as drift detector on our own Konzept; rubric-as-policy made 10/10 provable; deterministic security gates before the judgment review; ReDoS measured empirically instead of only read about; findings verified before implementation.
- **Better:** the parser assumption "UCs are H2" would have been caught early by an H3 fixture in the very first `konzept-lint` test — test fixtures should mirror real Konzept structures, not minimal cases. The return shape of the scanners (`scanRepo`) should be unified across the skills (open follow-up point, non-blocking).

## Core lesson

Two patterns confirmed: (1) **Dogfooding beats tests** — pointing our own detector tool at our own repo/Konzept found real drifts in every round that were test-green. (2) **Security tools are themselves attack surface** — a scanner that matches untrusted input with a greedy regex is a ReDoS candidate; bounded quantifiers + line cap defuse the whole class. The order stays: decidable/deterministic gates first, judgment afterwards ([[feedback_stale_data_first]], [[feedback_deterministic_skills_over_text]]).

## Memory loop (§32.6)

Cited slugs verified present (MEMORY.md pointers exist): [[feedback_verify_agent]], [[feedback_auditor_over_self_review]], [[feedback_clarify_before_assuming_scope]], [[feedback_stale_data_first]], [[feedback_deterministic_skills_over_text]], [[project_claude_skills_marketplace]]. [[project_claude_skills_marketplace]] updated in this session (13 skills, Konzept v1.5 = 10/10). No new slug needed — the lessons fall under existing feedback memories.
