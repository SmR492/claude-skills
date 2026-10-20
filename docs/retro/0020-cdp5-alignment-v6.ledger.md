# Ledger 0020 — CDP5 alignment and doctrine v6.0

Mode: C (review and teardown of the agent set) · started 2026-10-19 · kept by hand (plugins not installed in this session, no usage log).

| Task | State | Commit or diff | Review | Open findings |
|---|---|---|---|---|
| Orbit report 1 (agents-skills-programmiererumfeld) → skill-lint, worktree-setup, hedged-claim check, bootstrap | done | 144b499 | self-lint 0 🔴; tests green | — |
| Orbit report 2 (claude-code-packs-detail) → auditor states, PR body, OWASP ids | done | a76baf2 | tests green | — |
| Review: 12 engineering agents vs doctrine | done | report in session (45 findings) | fresh-context reviewer | — |
| Review: orchestration mechanics | done | report in session (70 findings) | fresh-context reviewer | — |
| Review: 17 T1 skills and policy | done | report in session (60 findings) | fresh-context reviewer | — |
| Review: domain-agents | done | report in session (38 findings) | fresh-context reviewer | — |
| Fix: agent texts, contract v2, orchestrate rewrite (orchestrator) | done | f42560d | agents.test, contract.test green | — |
| Fix: hooks and libs (implementer, disjoint ownership) | done | f42560d | 36 → 53 tests | — |
| Fix: konzept-lint and policy v3 (implementer) | done | f42560d | 26 → 44 tests | — |
| Fix: scan skills A (implementer) | done | f42560d | 36 → 60 tests, red-first start guard | — |
| Fix: scan skills B (implementer) | done | f42560d | 55 → 82 tests | — |
| Fix: domain-agents (orchestrator) | done | f42560d | plugin.test green | — |
| Doctrine v6.0 (drafted by a worker from a fixed change list) | done | fb8ac28 | heading structure checked; full suite 247/247 | devils-advocate pass pending (RC4) |
| Retro (pm-retro) and Kaizen RC2/RC3/RC4 | done | this commit | anchors.test, retro check test | ESC-1 open |
| Blind-test round 2 (8 roles + devils-advocate on v6.0 + re-audit + impl-uc) | done | ROLE-TEST-2026-10-19-R2.md | 119/120 | ESC-1 live install open |
| Fix: self-grant, human-confirmed grants, worktree-root and session binding, lock, audit, guard bypasses and false denials (implementer) | done | aef4f30, 5d7d4c9, this commit | 24 tests red first; review-verify closure check 14/14 after the session fix; red-first reproduced 25/41 on fb8ac28 | residual risk recorded |
| Doctrine v6.0 conditions from the devils-advocate pass (free anchors, fork balance, collisions) | done | 83f7eb4 | anchors.test strict | own-scope items for the human |
| Release v0.11.0 / v0.11.1 (descriptions ≤ 500 chars) | done | d09e7e9, 6b5a9ad | sync without warnings | — |
| Live install on the Windows host, portability fixes, v0.11.2 | done | 4aedae8, d488f50 | WSL 266/266, Windows 265 pass + 1 skipped; hook probe D-14 | first real orchestrate run in a new session |
| Gemini report "Claude Code Tools und Befehle" → skill-lint S9, channel check, prompt-audit, eval format; v0.11.3 | done | e3d711d | tests green; batch 10 | — |
| Three external reviews (Perplexity, Gemini 4, Grok 4.7) → concepts page, cdp5-doctor, import marker, pack manifests, C3 quotes, rename, eval suites; v0.12.0 | done | this commit | suite green on WSL and Windows; eval smoke run; batch 11 / D-15 | full eval runs (cost) with the human |
| First real worker run on Claude Code 2.1.304: handback-aware final-answer check (check-handback hook, transcript fallback, `via` field), doctor pointer age; v0.12.1 | done | a46e275 | WSL 282/282, Windows 281 + 1 skipped; live run logged `via: handback`; D-16 | — |
| Retro 0020 open items: nsai-edge retros moved, numbering check per directory, pm-retro memory declined, own-scope items audited (SPERRE, F1–F4); v0.12.2 | done | this commit | retro check 8/8, 0 duplicates; audit protocol in role/; D-17 | F1–F4 and A5 with the human (doctrine v6.1) |
