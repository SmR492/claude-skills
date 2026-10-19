# Open Points to Decide — Trust Model / Defeasible Entrenchment

> **For the ride home.** Self-contained decision worklist from the design session 2026-05-29. Full context: `06-Luege-Wahrheit-Fiktion-…` (axes/truth) + `07-Bruecke-zu-Defeasible-Entrenchment.md` (model). Here only the *questions* — compact, with options + my tendency. **My tendency is an equal proposal, not a default — you decide.**
>
> **Markers:** 🟢 clear recommendation · 🟡 genuine trade-off · 🔴 belongs to you (scope/value decision).
>
> **What it is about at the core:** Do not *abolish* trust, but switch it from "terminal authority" to "defeasible entrenchment" — trust = *refutation threshold*, not verdict; everything incoming initially refutable; truth never internally decidable (only approximable), trust *earned*.

---

## A — Trust parameters & start

**1. Prior strength `k` (how skeptically does a new source start?)** 🟢
Start at 30 = Beta(3,7). The question is the *strength* `k=α₀+β₀`: how many observations to overcome the skepticism.
- A) weak (k≈10): ~25–30 clean hits to "trustworthy" (80) — movable.
- B) strong (k≈100): practically permanent distrust.
- *Tendency:* **A** — "good skepticism" means open to persuasion, not prejudice; B makes the system blind to good new sources.

ANSWER: A  


**2. Introduction-provenance prior** 🟡
Does every source start the same, or does the start value depend on *how* it came in?
- A) all the same at 30.
- B) added-by-you → 50 (your act = weak endorsement), anonymous/auto-discovered → 30; own knowledge/inference (self) → anchored high.
- *Tendency:* **B** — your manual adding *is* information; ignoring it would be a waste.

ANSWER: B  

**3. Scale bands (display for humans)** 🟢
300/500/800 ‰ → `<300` skeptical · `300–500` unconfirmed · `500–800` plausible · `≥800` trustworthy.
- *Tendency:* adopt, they serve double as prior anchor *and* categorical display. (Thresholds are fine-tunable.)

ANSWER: Make 5 thresholds instead of 3, that way we are also more dynamic

**4. Recency strength `λ` (how fast does the old balance fade?)** 🟡
Mean reversion toward the prior: old successes/failures fade, a source must *stay at it*.
- Fast forgetting = more reactive (CDPR crash & recovery faster), but less stable. Slow = more sluggish, more stable.
- *Tendency:* medium — effective window ~last 1–2 years of activity. (Can vary per tier: `gesetz` hardly fades, `web` faster.)

ANSWER: Let them fade according to their current prior, less prior = faster fading. That way secure sources persist longer than insecure ones or lies. Meaning we can not only distinguish, but also keep the true in memory longer.

**5. Calibration & surprise weight** 🟡
- Calibration: an *overconfidently* asserted, then refuted triple counts **×2** on failures (presumption hurts more than honest uncertainty).
- Surprise: a blunder at a high level costs more than at a low one (established ones sink faster).
- *Tendency:* both **yes**, keep the factor small (×1.5–2). Together they produce the CDPR effect cleanly.

ANSWER: Yes, I agree, both.  

---

## B — Trust architecture

**6. Confirm two fields: `source_tier` (hard) × `origin_trust` (earned)?** 🟢
- Hard `source_tier` (gesetz>…>llm) = prior/baseline; continuous `origin_trust` (0–1000, local, earned) = modulator around it.
- *Tendency:* **yes, keep separate** — a single value would dissolve the hard class (enough high-trust web would beat a law = count trap). The tier stays *defeasible*, but not *computable against*.

ANSWER: We have to rework this anyway, since in my view the source_tier belongs not to the knowledge but to the source the knowledge comes from, and is thus again influenced via the overall factor. So what we need here is, let us compute this over the totality. What I currently have in mind is: an article comes from Bild, is a press article from the internet. So a kind of tags like: press article, internet get a weight, depending on how their connected topics perform. So memories also influence each other. Because the source_tier and origin_trust too are a kind of knowledge that has to develop. Think this through in detail. 

**7. Global vs. domain-specific trust** 🔴
CDPR shows: trust decays domain-split ("CDPR×narrative" held, "CDPR×tech/marketing" crashed).
- A) one trust per source (simple, but smeared).
- B) trust per (source × domain) (more honest, more expensive — more state, domain assignment needed).
- *Tendency:* **start with A, B as roadmap** — global trust first, retrofit domain-specific when the smearing really hurts. (Genuine complexity/value decision → yours.)

ANSWER: See 6. We have to create a computable system here. But we also need a fallback: if too much trust is gained or lost too fast, one should be skeptical toward the gain or loss.  

---

## C — Belief core (defeasible entrenchment)

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

**8. `temporality='eternal'` — drop or keep?** 🔴
The axiom "everything refutable" collides with "eternal = never decaying/unfalsifiable".
- A) drop (everything refutable, no exception).
- B) keep, but reinterpret as **"highest entrenchment / slowest decay"**, NOT "unfalsifiable".
- *Tendency:* **B** — no "promote→true/strict" end state (that would be the single point of failure through the back door), but definitional/mathematical sentences may have the highest threshold.

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

**9. Separate or collapse defeater types?** 🟢
- Empirical facts → refuted by *contradictory evidence*.
- Institutional/definitional facts (a law *is in force*) → refuted by an *explicit act* (repeal), not by an evidence majority.
- *Tendency:* **separate** — otherwise a web majority can "refute" a law in force, which is factually wrong. (Searle: institutional facts.)

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

**10. Confirm contestation-override form** 🟢
A sufficient (entrenchment-weighted, *independently* supported) contradiction tips a top tier to **`contested`** — **never to `contradicted`** (one cannot assert the other side as *true*, only the authority as contested).
- *Tendency:* adopt. Plus: a dismissed contradiction is **not deleted** but remains a persistent open contestation that accumulates (protection against "trusted source lies").

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

**11. Declare residual risk explicitly as a guardrail?** 🟢
The consistent, *uncontradicted* lie from a trusted source is undetectable for any oracle-free system. Achievable: "no lie survives that *available independent evidence* contradicts."
- *Tendency:* **yes** — as a "What the system does NOT deliver: truth verification" section in the Konzept (concept document) (§B). Honest guardrail against over-expectation.

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

---

## D — Mode axis (fiction / hypothesis) — *orthogonal to trust*

**12. Introduce `assertion_mode` + worlds/contexts?** 🔴
Trust/entrenchment solves provenance↔truth. It does **not** solve fiction/hypothesis — that is not *refuted* but *scoped*.
- A) not now (keep scope small).
- B) `assertion_mode` (asserted/assumed/fictional) + `world` scopes (fiction in its own world, `verify` ignores it) — the third axis building block.
- *Tendency:* **B as its own, later slice** — important (prevents examples/hypotheses from landing as facts), but independent of the trust ADR. Order: first defeasible-entrenchment ADR, then mode axis.

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

**13. `verify()` multi-signal instead of true/false?** 🟡
`verify()` delivers `{korrespondenz, kohaerenz, konsens}` (the three operationalizable truth approximations) instead of a single verdict.
- *Tendency:* **yes** — Tarski-honest (no truth, three approximations), and it feeds the entry matrix directly.

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

---

## E — Preconditions / empirics (gating)

**14. Is there enough *adjudicated* data for "earned trust" to take hold at all?** 🔴
Earned trust needs a stream of adjudicated outcomes (higher-tier correspondence / independent corroboration / *your* verdicts = `user_rejected_at`).
- Question to you: order of magnitude of your endorse/reject actions + peer-set size. If very little: trust stays near the prior, the model runs but hardly learns → then secure the *data source* first (couples to §I.8 of the roadmap).
- *Tendency:* this is the *first* question before any trust implementation — without adjudication data it is theory.

ANSWER: See answers from trust architecture, in order to possibly re-evaluate this.

---

## F — Process

**15. Who writes the ADR, in what order?** 🔴
- This doc (07) is **ADR input**, not an ADR. The actual ADR "belief: terminal authority → defeasible entrenchment" is a **🔴 slice** (belief-core re-foundation) → full CDP5 + threat model + adversarial-auditor.
- *Tendency:* concept-first; the other instance (which drives the entrenchment strand) builds on doc 07. Recommended order: **(1)** entrenchment ADR → **(2)** trust-dynamics slice → **(3)** mode axis (point 12).

---

### Quick pass for the road
Clear recommendations (🟢), only nod through/reject: **1, 3, 6, 9, 10, 11.**
Genuine trade-offs (🟡): **2, 4, 5, 13.**
Your value/scope decisions (🔴): **7, 8, 12, 14, 15.**

---

## RESOLUTION 2026-06-01 (O1–O6, post-§6-new) — SUPERSEDES the deferred answers #6–#14 above

> After the §6-new synthesis (impulse ledger instead of tag network, `07`), the open points were gone through as a consolidated worklist O1–O6 and **explicitly decided** (design session 2026-06-01). This resolution is the authoritative source for ADR 0019; the earlier "See answers from trust architecture" deferrals (#6–#14) are thereby resolved.

- **O1 Empirics:** asymmetric (few exclusive human verdicts + dense ingestion stream) → **build safe-inert**; the fold runs along from day 1, unfolds its power with growing data. `auto_corroborate` counts, strictly banded.
- **O2 Undercut:** **B+C** — independent support protects the premise (`trust_ext` without K path); rules are their own trust nodes with their own fold.
- **O3 Domain:** **projection per (source×topic)**, global fold as fallback prior for a thin cell.
- **O4 Constants:** k≈10/Beta(3,7)→300‰; **5 bands** 0–200/201–400/401–600/601–800/801–1000 (skeptical/unconfirmed/plausible/solid/trustworthy); γ≈500‰; w_src≈300–500‰; calibration/surprise ×1.5–2; recency `λ(trust)=trunc(λ_base·(1000−trust)/1000)` with `λ_min>0`; per-period delta clamp.
- **O5 auto_corroborate band:** cap **exactly 600‰**, only an external anchor breaks through; origin/content-hash dedup.
- **O6 Institutional tags:** floor (lowerable only via endorsement act): `statute/law`, `official-gazette/authority`, `academic-peer-reviewed`. Empirical (fold-driven, tag = cold-start hint): `press/news`, `blog/web`, `llm-extraction`, `sensor/telemetry`.

**Still OPEN (for the ADR review gate, NOT explicitly confirmed in O1–O6):** #8 `eternal`=floor (Claude recommendation), #10 contestation-override form (Claude recommendation), #12 `assertion_mode`/fiction (own later slice S5). → carried in the ADR as `[F-*]` flags.
