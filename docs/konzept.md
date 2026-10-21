# claude-skills — User Konzept

**Version:** 1.5
**As of:** May 2026
**Scope:** A project-independent Claude Code marketplace that provides **CDP5-based skills and agents** with which an AI orchestrator performs Konzept (concept document)→code work **effectively** (low token consumption), **fast** (< 5 min per interactive step) and **accurately** (Konzept maturity ≥ 9.0/10, ≤ 3 drifts per Konzept implementation). **Not included:** project-/framework-specific implementation agents (stay local with the respective project), code-mutating automation without a Mensch-Gate (human gate), own LLM inference (uses Claude Code).

## Probabilistic statement (§2.6)

The system mixes **deterministic skills** (T1, no LLM — reproducible, no tolerance threshold, output = evidence) and **judgment agents** (T2, LLM — probabilistic).

| UC | Tolerance threshold | Validation strategy | Fallback | EU AI Act class |
|---|---|---|---|---|
| UC-01 Konzept review | ~90 % (score proposal) | `review-verify` (§10.6) + architect sign-off | Architect decides, iterates | minimal |
| UC-02/03/04 (T1) | n/a (deterministic) | Output = evidence (exit code) | — | minimal |
| UC-05 Threat/MCP review | ~85 % | deterministic pre-checks (secrets-scan/mcp-config-lint) + security sign-off | Senior review | minimal |
| UC-06 Adversarial audit | n/a (adversarial, no auto-merge) | empirical counter-check + operator decision | Escalation to the operator | minimal |

**EU AI Act class = minimal** (architect ruling 2026-05-26, §23): all UCs are read-only code/documentation analysis + judgment proposals without automated decisions about persons/credit/biometrics/critical infrastructure → *minimal risk*. Declarable per consumer and verifiable via `profile-check` against `project-profile.md` (`eu_ai_act_class`).

## Vendor risk statement (§2.7)

| UC | Provider | Model | Migration strategy | Data sovereignty |
|---|---|---|---|---|
| UC-01/05/06 (judgment) | Anthropic / Claude Code | opus | CDP5 method portable; agent mechanics bound to Claude Code; method transferable to another agent runner | read-only code/docs, no PII sent |
| UC-02/03/04 (T1) | — (no LLM) | — | pure Node.js, **vendor-/LLM-independent**, survives a provider switch | purely local, nothing sent |

---

## 1. Goals & success metrics (§22 quantified)

Three equal quality goals, each with a metric, a mechanism and a threshold:

| Goal | Metric | Threshold | Mechanism (how achieved) |
|---|---|---|---|
| **Effective** (tokens) | Model tokens per step (`gen_ai.usage.*`, OTEL §15.1) vs. budget per UC type | T1 step ≈ 0 model tokens; judgment step ≤ budget (see below) | T1 determinism · `cdp5-reference` JIT instead of the full doctrine · pointer briefs · model tier · context hygiene §28.6 |
| **Fast** (latency) | Wall-clock per **interactive** dev step | **< 5 min** per interactive step; T1 < 30 s. Full eval/test-suite run = **CI batch**, not a "step" | T1 runs locally (no LLM round trip) · scoped briefs · cheapest sufficient model · independent workers in parallel |
| **Accurate** (quality) | (a) Konzept Reife-Score (maturity score) · (b) drifts per implementation | (a) **≥ 9.0/10** (after ≤ 2 iterations) · (b) **≤ 3 drifts** | konzept-reviewer rubric (a) · drift detectors konzept-mapper/konzept-model-api/roadmap-drift (b) · double review + §10.6 verification |
| **Secure** (own gate) | open 🔴 security findings | **0** — separate, **not** part of the drift count | Threat modeling §33.4 · `secrets-scan`/`pii-scan`/`mcp-config-lint` · `adversarial-auditor`/`mcp-security-reviewer` |

**Token budget per UC type (guideline, baseline for "effective"):** deterministic check (T1) = 0 model tokens; knowledge retrieval (cdp5-reference) ≤ 1k; verification/review (agent, scoped) ≤ 40k; Konzept review (opus) ≤ 80k. Exceeding it = finding.

**Drift definition (measurable):** a Konzept artefact that deviates in the code — a UC without a code counterpart (konzept-mapper "missing"), an enum/property mismatch model↔OpenAPI (konzept-model-api), a roadmap position marked as FERTIG (done) but missing (roadmap-drift). Counted **after** a Konzept implementation; every drift is documented as an issue.

---

## 2. Role overview

| Role | Scope | Description |
|---|---|---|
| `Orchestrator` | Global | Main session: chooses the mode, delegates, runs skills, verifies, holds the Mensch-Gates (CDP5 §32) |
| `T1-Skill` | Tool | Deterministic Node program (read-only detector/report); output = evidence |
| `Judgment-Agent` | Tool | Isolated subagent (findings + proposals, no destructive actions) |
| `Operator` | Global | Human: merge/push responsibility, approval of destructive steps, final sign-off |

---

## 3. Use Cases

**UC overview (§2.2):** UC-01 Konzept review · UC-02 drift gate · UC-03 run a T1 check · UC-04 CDP5 retrieval · UC-05 security/threat review · UC-06 adversarial audit (🔴 slice).

### UC-01: Check a Konzept for implementation readiness
**Actor:** `Orchestrator` (delegates to `konzept-reviewer`, opus) · **Step type:** Judgment

**Behaviour**
1. Orchestrator briefs `konzept-reviewer` with a pointer to the Konzept document (no paste — §32.8(2)).
2. Agent consults the relevant §§ (§2/§7/§10/§10.7) via `cdp5-reference` — JIT, not the full doctrine.
3. Agent checks against the maturity rubric (see §4), assigns a score 0–10 per UC + overall, prioritises gaps.
4. If overall < 9.0: gap list + closing proposals are returned; Orchestrator clarifies open points with the user (§1.9), iterates.

**Error cases**

| Case | Behaviour |
|---|---|
| Konzept file missing/empty | Abort with hint, no score |
| Score claim unsubstantiated | Counter-check with `review-verify` (§10.6) |
| Time/token budget (AC-3) exceeded | Abort with partial score + gap list so far; Orchestrator decides re-run/escalation |

**Acceptance criteria (test-first)**

| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Score output is a number 0–10 per UC + overall | Integration | red |
| AC-2 | Score per iteration logged in measurement harness §6 until overall ≥ 9.0 | Eval | red |
| AC-3 | Step tokens ≤ 80k, runtime < 5 min | Trace/metric | red |

### UC-02: Drift gate after a Konzept implementation
**Actor:** `Orchestrator` (runs T1 skills) · **Step type:** Deterministic

**Behaviour**
1. After the implementation: `konzept-mapper --konzept=… --repo=…` (UC↔code), `konzept-model-api --repo=… --openapi=…` (enum/property drift), `roadmap-drift --roadmap=… --repo=…`.
2. Aggregate the findings = drift count.
3. If > 3 drifts: gate red — one issue per drift, catch up the implementation or update the Konzept (living artefact §1.4).
4. If ≤ 3: gate green, documented.

**Error cases**

| Case | Behaviour |
|---|---|
| Konzept not §3-conformant (no `## UC-…`, no backtick artefacts) | Mapper reports n/a → Konzept bug, back to UC-01 |

**Acceptance criteria (test-first)**

| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Drift count = sum of the three detector reports | Integration | red |
| AC-2 | Exit 1 if > 3 drifts (CI-gate capable) | Integration | red |
| AC-3 | Total runtime < 5 min, 0 model tokens | Metric | red |

### UC-03: Run a deterministic check (every T1 skill)
**Actor:** `Orchestrator` · **Step type:** Deterministic

**Behaviour**
1. Determinism gate (§32.9): is the task decidable? → T1 skill instead of agent.
2. Call the skill with structured input (paths/args); output = report (exit code = pass/fail).
3. Orchestrator interprets the report (LLM shell around the deterministic core).

**T1 skill contract (generic, for all T1 skills from §7):** input = args `--<name>=<wert>`; output = report (stdout) + exit code (`0` pass · `1` finding/drift · `2` usage error); reproducible; own `node:test` suite.

**Error cases**

| Case | Behaviour |
|---|---|
| Mandatory arg missing | Exit 2 + usage hint |
| Target path/file not readable | Exit 2, no partial report |
| Skill non-deterministic (finding) | Bug issue against the skill; not used as a gate until fixed |

**Acceptance criteria**

| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Same input → same output (reproducible) | Unit | red |
| AC-2 | 0 model tokens in the core, runtime < 30 s typically | Metric | red |
| AC-3 | Own test suite present (node:test) | CI | green |

### UC-04: Retrieve CDP5 knowledge (token economy)
**Actor:** `Judgment-Agent` / `Orchestrator` · **Step type:** Deterministic (retrieval)

**Behaviour**
1. Instead of loading the 2000-line doctrine: `cdp5-reference --section=<§>` or `--keyword=<term>`.
2. Only the relevant excerpt flows into the context (§28.6 just-in-time).

**Error cases**

| Case | Behaviour |
|---|---|
| Unknown § number | Exit 1 + hint "`--list` shows all sections" |
| Ambiguous keyword (many hits) | all hit blocks with snippet; Orchestrator narrows the query |
| Doctrine version mismatch (anchor not present) | Finding; check against the shipped version (§7) |

**Acceptance criteria**

| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | `--section=33.1` returns exactly the section incl. subsections | Unit | green |
| AC-2 | Retrieval ≤ 1k tokens instead of ~30k (full doctrine) | Metric | red |

### UC-05: Security/threat review (when there is an agent/tool/security share)
**Actor:** `Orchestrator` (delegates `threat-modeler` / `mcp-security-reviewer`; runs `secrets-scan`/`mcp-config-lint`) · **Step type:** Hybrid

**Behaviour**
1. **Deterministic pre-checks first**, in this order (every exit `1` = finding → feeds the secure gate §1, all read-only/0 model tokens): (a) `secrets-scan --repo=<root>` · (b) `pii-scan --repo=<root>` · (c) `mcp-config-lint --config=<mcp.json>` (only with an MCP share). Clean pre-checks (exit `0`) narrow the judgment surface for step 2.
2. Judgment afterwards: `threat-modeler` (STRIDE-light) or `mcp-security-reviewer` (lethal trifecta, tool hardening).
3. Findings → countermeasures as AC (§33).

> **Lethal trifecta axes (§33.1):** The `cdp5-agents` are **read-only** (Read/Grep/Glob, Bash read-only) → axis (c) egress + write/mutation paths drop out; the trifecta risk is structurally defused.

**Error cases**

| Case | Behaviour |
|---|---|
| Heuristic parser false positive (mcp-config-lint/model-api) | mark as hint, counter-check with `review-verify` (§10.6) |
| External scan tool (semgrep/syft) not installed | dependency-free skills (secrets-scan) as minimal gate; document the gap |

**Acceptance criteria**

| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Secret/config findings with exit 1, redacted output | Integration | green |
| AC-2 | Lethal-trifecta verdict + hardening recommendations | Eval | red |

### UC-06: Adversarially review a risky diff (🔴 slice)
**Actor:** `Orchestrator` (delegates `adversarial-auditor`, opus) · **Step type:** Judgment

**Behaviour**
1. For a 🔴 slice: `adversarial-auditor` with an exact target.
2. Auditor searches for the latent error/loss path, performs an empirical counter-check, gives a verdict (JA/JA-m.-Einschr./NEIN, i.e. yes / yes with reservations / no).
3. Self-review + green tests do **not** count as a substitute (§11.4).

**Error cases**

| Case | Behaviour |
|---|---|
| No empirical counter-check can be constructed | Auditor stops, lists what was tried, escalates to the operator (no verdict from gut feeling) |
| Verdict NEIN, but the operator wants to merge | Follow-up issue + risk note; merge responsibility explicitly with the operator (§1.6) |
| Time budget (AC-2, < 5 min) exceeded | Auditor delivers an interim state + open axes; operator decides continuation/escalation |

**Acceptance criteria**

| # | Criterion | Test type | Status |
|---|---|---|---|
| AC-1 | Verdict + ≥1 empirical counter-check (command+output) | Eval | red |
| AC-2 | Step runtime < 5 min | Metric | red |

---

## 4. Maturity rubric (for the "≥ 9.0/10" goal)

Score = weighted mean (0–10) over: **Clerk test** (0.2) · **Mandatory structure complete** (0.2) · **UC steps numbered + branched** (0.15) · **AC table per UC** (0.15) · **Error cases complete** (0.1) · **Evidence convention** §10.7 (0.1) · **Glossary/vocabulary** (0.1). Every "mandatory" without a Nachweis-Typ (evidence type) = automatic deduction. ≥ 9.0 = ready for implementation. Anchored as a policy (weights reproducible, not just prose): [`plugins/cdp5-gates/policy/reife-rubrik.policy.md`](../plugins/cdp5-gates/policy/reife-rubrik.policy.md) — gate (§7 items) plus score; plugin default threshold 8.0, project threshold of this repo 9.0.

---

## 5. Mechanics — how the three goals are achieved systematically

- **Effective:** (1) Determinism gate (§32.9): decidable work → T1 = 0 model tokens. (2) `cdp5-reference` JIT instead of the full doctrine. (3) Pointer briefs instead of paste (§32.8(2)). (4) Model tier per worker (§32.3) — haiku for mechanical work. (5) Context hygiene + `/clear` (§28.6).
- **Fast:** T1 skills locally in seconds; LLM steps cut narrowly; independent workers in parallel (§32.10 only when worthwhile); no loading of the full doctrine.
- **Accurate:** konzept-reviewer (rubric §4) drives 9.0/10; the three drift detectors measure ≤3 drifts; double review (self before commit + PR) + `review-verify` (§10.6) + `adversarial-auditor` for 🔴.

---

## 6. Measurement harness (§22.2)

Captured per UC step: **tokens** (`gen_ai.usage.total_tokens`, sampling from §15.1), **latency** (wall-clock), **score** (konzept-reviewer output), **drifts** (sum of the detector exit reports). Aggregation as a table (UC | tokens | time | score | drifts | threshold met?). T1 steps: tokens = 0, time = script runtime. Expected figures: ≥ 90 % of steps under budget + < 5 min; Konzept score ≥ 9.0 after ≤ 2 iterations.

---

## 7. Entities / artefact overview

| Artefact | Type | Table/location |
|---|---|---|
| `cdp5-gates` | Plugin (14 T1 skills) | `plugins/cdp5-gates/` |
| `cdp5-agents` | Plugin (5 judgment agents) | `plugins/cdp5-agents/` |
| `cdp5-reference` | T1 skill (doctrine + query) | `…/skills/cdp5-reference/` |
| Marketplace manifest | Config | `.claude-plugin/marketplace.json` (+ per plugin `.claude-plugin/plugin.json`) |
| Skill structure | Convention | `plugins/<plugin>/skills/<name>/{SKILL.md, *.mjs, *.test.mjs}` |
| **Maturity rubric (policy)** | Policy artefact | `plugins/cdp5-gates/policy/reife-rubrik.policy.md` (+ generated `.json`) — gate plus 7 weighted dimensions, reproducible |
| **CDP5 doctrine (shipped)** | Knowledge base | `…/cdp5-reference/konzept-design-pattern-v5.md` — **v5 (active)**; v4.7 FROZEN, **not** bundled |

---

## 8. Responsibility matrix (§23.1)

| UC | AI share | Human validator | Validation mindset | Liability |
|---|---|---|---|---|
| UC-01 Konzept review | 70 % (proposal) | Architect (score sign-off) | high | Architect |
| UC-02 Drift gate | 0 % (deterministic) | Operator (decides at > 3) | medium | Operator |
| UC-03/04 T1 checks | 0 % | — | n/a | System owner |
| UC-05/06 Security/audit | 60 % | Security/senior (sign-off) | high | Security owner |

Destructive actions (push/merge/schema drop) never automatic — operator (§1.6/§23).

---

## 9. Glossary (§14)

| Term | Definition | Anchor |
|---|---|---|
| `T1-Skill` | Deterministic Node program, output = evidence, 0 model tokens | CDP5 §32.9 |
| `Judgment-Agent` | LLM subagent for judgment work, findings + proposals | CDP5 §32 |
| `Drift` | Konzept artefact that deviates or is missing in the code | konzept-mapper/-model-api |
| `Reife-Score` | weighted 0–10 value of implementation readiness (7-dimension rubric) | §4 (rubric) · `reife-rubrik.policy.md` · CDP5 §10.5 |
| `Orchestrator` | Main session: chooses the mode, delegates, runs skills, verifies, holds the Mensch-Gates | CDP5 §32 |
| `Operator` | Human with merge/push responsibility + final sign-off | CDP5 §1.6 / §23 |
| `JIT-Retrieval` | load only the needed doctrine excerpt | CDP5 §28.6 |
| `Lethal Trifecta` | sensitive data + untrusted content + egress | CDP5 §33.1 |
| Drift detectors | `konzept-mapper` · `konzept-model-api` · `roadmap-drift` (T1) | measure the drift count (UC-02) |
| Audit/security agents | `adversarial-auditor` · `threat-modeler` · `mcp-security-reviewer` (T2) | judgment in UC-05/06 |

---

## 10. Anti-patterns (what is avoided)

- Running a decidable task as an agent instead of a T1 skill (tokens + latency burned, §32.9).
- Loading the full doctrine into every prompt instead of `cdp5-reference` JIT (§28.6).
- Adopting score/findings unchecked (§10.6 violated).
- "Waving through" > 3 drifts without issue/Konzept update.
- Bringing project-/framework-specific code into the marketplace (negative requirement → grep gate).

---

## 11. Risks / Known issues (§22.4)

- Heuristic parsers (mcp-config-lint, konzept-model-api YAML scanner) → findings are hints, to be verified by the Orchestrator (§10.6).
- **`pii-scan` is hybrid:** the regex detector is deterministic, the *semantic* PII classification (name vs. random string) needs a `review-verify` overlay — not a final truth gate on its own.
- Score/drift measurement against a **CDP5-conformant** Konzept (numbered UCs, backtick artefacts) — non-conformant Konzepte return n/a (Konzept bug, back to UC-01).
- Token/latency budgets are guidelines; calibrate per repo size.
- **Scope honesty:** the actual **coding** is **not** covered by the marketplace (project-bound local impl agents). The "< 5 min/step" when coding depends on **vertical slicing** (§27.2), not on these tools — the marketplace secures the stages *around* the coding (Konzept · test scaffold · drift · review · security).

---

## 12. Changelog

**v1.0 (May 2026):** Initial Konzept. Goals effective/fast/accurate quantified (§1), 6 UCs with AC, maturity rubric (§4), mechanics (§5) + measurement harness (§6). Reference: CDP5 v5 (§32.9 determinism, §28.6 context economy, §33 security, §10/§22 score/PoC).

**v1.1 (May 2026, dogfood review patch):** Konzept scored by the `konzept-reviewer` (8.4 → target ≥9.0). Closed: §2.6 probabilistic + §2.7 vendor risk statement as mandatory tables (per UC); error-case tables for UC-03/04/05/06; T1 skill contract (UC-03); lethal-trifecta axes statement (UC-05/06, read-only → defused); glossary +drift detectors/audit agents; §7 appendix +skill structure +shipped CDP5 version (v5). Open (architect, §1.9): final confirmation of the EU AI Act class.

**v1.2 (May 2026, simulation patch):** Sharpened from 5 fictitious runs: §1 "Fast" = **< 5 min per interactive step** (full eval = CI batch, not a "step"); §1 "Accurate" = ≥ 9.0 **after ≤ 2 iterations**; new **4th row "Secure"** (0 open 🔴 security findings, separate from the drift count). UC-05 + §11 `pii-scan` as hybrid (deterministic regex + `review-verify` overlay, not a final truth gate). +Scope honesty (coding quality depends on vertical slicing, not on the skill alone).

**v1.3 (2026-05-26, re-score patch):** `konzept-reviewer` re-score = 9.0/10 (goal reached, exactly on the threshold). Closed for buffer: header version drift (1.0 → 1.3, self-dogfood of the own drift gate UC-02); §7 skill count 9 → **12** (stale); §2.2 UC overview; glossary +`Orchestrator`/`Operator` + `Reife-Score` anchor sharpened to §4/§10.5; timeout/budget error cases for UC-01/UC-06; AC-2 (UC-01) bound to measurement harness §6 (testable); **maturity rubric anchored as §10.5 policy** `reife-rubrik.policy.md` (reproducible, not just prose). Open (architect, §1.9): confirmation of the EU AI Act class.

**v1.4 (2026-05-26, profile-check):** New T1 skill `profile-check` (§7 count 12 → 13) — implements "set the default once, afterwards only conformance checks": a project declares its requirements once in `project-profile.md` (YAML frontmatter: EU AI Act class, security_level, runtime, test framework, mandatory tokens), the skill verifies Konzept + repo deterministically against it instead of asking again. Resolves the open EU AI Act point structurally (architect sets the class once in the profile). Falls under UC-03 (no new UC). 7 tests, dogfood against claude-skills itself green. Re-score v1.4 = **9.7/10**.

**v1.5 (2026-05-26, maturity polish):** The two non-blocking polish points from the v1.4 review closed: (1) **EU AI Act class final = minimal** (architect ruling §23) — §2.6 footnote from "open, to be confirmed" to a binding ruling, verifiable per consumer via `profile-check`/`project-profile.md` (dim 6 evidence convention → 10). (2) **UC-05 pre-check sequence** explicitly ordered (a `secrets-scan` · b `pii-scan` · c `mcp-config-lint`, each with exit semantics → secure gate; dim 1 clerk test → 10). Also the §7 skill reference in UC-03 made count-agnostic ("all T1 skills" instead of "9", no more skill-count drift). **Re-score v1.5 = 10.0/10** (all 7 dimensions 10; konzept-lint "§13.1 LLM fields" flag refuted as a heuristic false positive per §10.6).
