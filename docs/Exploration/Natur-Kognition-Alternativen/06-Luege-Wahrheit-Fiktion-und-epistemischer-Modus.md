# Lie / Truth / Fiction & the Epistemic Mode (incl. "These" + categorical thinking)

> **Exploration raw material** (batch 2026-05-29), web-sourced. **No CDP5 binding.** This document answers three related questions from Stefan raised during the exploration: (1) "The system cannot distinguish between lie / truth / fiction — can you find an approach?" (2) "Should we replace the TrustLevel with a supposedly better system in order to distinguish lie from truth?" (3) "Analyze the categorical thinking of humans and look at https://de.wikipedia.org/wiki/These."
>
> **Core answer up front:** No — **do not replace TrustLevel, complement it.** TrustLevel measures *provenance authority* correctly; but it conflates it with two missing, orthogonal axes: *truth value* (per Tarski never internally decidable, only approximable) and *assertion mode* (asserted/assumed/necessary/fictional). A "better system that distinguishes lie from truth" is **impossible** in the strong sense — and exactly the kind of overreach the project is designed against. What is possible: separate the axes.

---

## ANCHOR: Wikipedia article "These" (de) — faithful rendering
**Source:** https://de.wikipedia.org/wiki/These — sections: 1. Definition · 2. Geschichte des Begriffs · 3. These als Begriff in anderen Sprachen · 4. Siehe auch · 5. Weblinks · 6. Einzelnachweise.

Central defining sentences (verbatim):
- *„Die These (von altgriechisch θέσις thésis, deutsch ‚aufgestellter Satz, Behauptung') bezeichnet eine zu beweisende Behauptung oder einen Leitsatz."*
- *„Eine These ist ein Gedanke oder Satz, dessen Wahrheitsinhalt eines Beweises bedarf."*
- *„Ist die These nicht haltbar, muss sie verworfen werden. Andernfalls kann an der These festgehalten werden."*
- *„Eine Arbeitsthese ist eine vorläufig aufgestellte These."*
- Dialectical usage (antiquity): the These is the position held by the respondent, which the questioner seeks to shake. Example: Luther's **95 Theses** as *disputation theses*.

**Take for NSAI-Edge:** A These is by definition (a) *put forward*, (b) *in need of justification*, (c) *contestable/discardable*, (d) *held but revisable* in discourse. Precisely this status is **not** represented by today's fact graph — triples are flat facts with confidence, not "asserted, justification-requiring, contestable sentences".

---

## STRAND 1 — The "These" as an epistemic category (contestable assertion, not fact)

**These vs. hypothesis vs. axiom vs. fact.** Scale of decreasing contestedness / increasingly discharged burden of justification: *axiom* (posited, not in need of justification) → *These* (to be proven) → *hypothesis* (to be tested, Popper) → *fact* (proven/established). The discriminating marker is NOT the truth value but the *justification/contestation status*.
- **NSAI-Edge transfer (COMPLEMENT):** New signed enum `epistemic_status ∈ {axiom, these, hypothese, faktum}`, orthogonal to `confidence`/`source_type`. Plus two edge types `supports`/`rebuts` (Toulmin warrant/rebuttal) to other triples. A triple with open `rebuts` edges cannot ascend to `faktum`. Makes the graph *argumentative* instead of merely *declarative*.
- **Determinism/zero-dep:** Full (enum + edge counting; promotion/demotion via deterministic thresholds).

**Thesis-antithesis-synthesis (Fichte/Hegel).** Attributed in the Wikipedia article to **Fichte** (*Grundlage der gesamten Wissenschaftslehre*), popularized through Hegel (who hardly used the formula himself); Kant uses thesis/antithesis in the *Antinomies*. Two contradicting assertions ideally produce a third, qualified one (synthesis: "P holds under condition C").
- **NSAI-Edge transfer (COMPLEMENT to belief resolution):** Instead of authoritative overwriting on a P/¬P conflict, a *synthesis mode*: create a *conditional* These (`P unless C`, hypothetical triple, see strand 2) and preserve the antithesis as a `rebuts` edge (auditable). Deterministic, provided "synthesis" is rule-based contextualization, not a generative statement.

**Toulmin schema & defeasible logic (ASPIC⁺/Dung).** Toulmin (1958) decomposes arguments into claim / data / warrant / backing / qualifier / rebuttal. A *defeasible warrant* allows exceptions → basis for Dung's abstract argumentation. "Truth" is approximated by *defensibility in the argument graph* (Tarski-conformant, because purely relational).
- **NSAI-Edge transfer (COMPLEMENT):** `verify(claim)` turns from lookup into a mini argument evaluator — a triple is "defended" if its `supports` edges are not beaten by uncontradicted `rebuts` edges of higher authority (Dung "grounded extension", deterministic in polynomial time, fixpoint iteration, no solver). **Note:** This is exactly the candidate **I.3-A1 (defeasible argumentation)** already evaluated in the Konzept (concept document) — the "These" lens supplies its missing UC need.
- **Sources.** [Wikipedia: These](https://de.wikipedia.org/wiki/These) · [Toulmin Argument Model](https://pressbooks.calstate.edu/writingargumentsinstem/chapter/toulmin-argument-model/)

---

## STRAND 2 — Kant's table of judgments: modality + relation as ready-made mode axes

**Modality: problematic / assertoric / apodictic.** Kant (*KrV*, table of judgments): modality *„bestimmt den Wert der Kopula in Beziehung auf das Denken überhaupt"* — it says nothing about the content, only about the *assertion status*: **problematic** = assumed as merely possible; **assertoric** = asserted as actual/true; **apodictic** = as necessary. A pure *mode* axis, separate from truth value and source. Fiction/hypothesis = problematic; sensor measurement = assertoric; mathematical/definitional law = apodictic.
- **NSAI-Edge transfer (NEW signed field — the core feature):** `assertion_mode ∈ {problematic, assertoric, apodictic}` as a signed integer enum per triple, set at ingest, default `assertoric`. The most direct, least controversial answer to the mode problem. `verify()` and decay react mode-dependently: problematic triples do not mature into facts; apodictic ones are not subject to decay.
- **Determinism/zero-dep:** Trivial enum, signable, ordinally comparable.

**Relation: categorical / hypothetical / disjunctive.** Kant: **categorical** = unconditional (S is P); **hypothetical** = conditional (if A then B); **disjunctive** = exclusive alternatives (either A or B or C). The current S–P–O triple is structurally *categorical only* — NSAI-Edge cannot natively express "if A then B" and "either/or" at all.
- **NSAI-Edge transfer (COMPLEMENT):** `relation_type ∈ {categorical, hypothetical, disjunctive}`. For `hypothetical` an optional `condition` reference (another triple/world from strand 7) → covers the synthesis from strand 1. For `disjunctive` a group ID of exclusive alternatives (exactly one true — useful for unresolved belief conflicts).
- **Sources.** [Kant — Modalität der Urteile (textlog)](https://www.textlog.de/kant-logik-modalitaet-urteil.html) · [Kant — Relation der Urteile (textlog)](https://www.textlog.de/kant-logik-relation-urteile.html)

---

## STRAND 3 — Aristotelian categorical propositions + categorical thinking (Rosch)

**Aristotelian A/E/I/O propositions.** Four categorical forms: **A** "All S are P", **E** "No S are P", **I** "Some S are P", **O** "Some S are not P". "Categorical" = unconditional, definitive assertion about class membership. Two binary axes: quantity (universal/particular) + quality (affirmative/negative). A triple is implicitly A or I — but NSAI-Edge does not distinguish "all X are Y" (falsifiable by one counterexample) from "this X is Y" (singular).
- **NSAI-Edge transfer (COMPLEMENT):** Fields `quantity ∈ {universal, particular, singular}` + `polarity ∈ {affirmative, negative}`. Benefit: falsifiability for `verify()` — a universal-affirmative triple is refutable by ONE counterexample of higher authority; a singular one is not. Negative triples allow explicit *closed-world islands* in the otherwise open-world architecture.

**Rosch: prototype theory, basic level, graded membership, categorical perception.** Human categories do NOT work classically (necessary+sufficient features) but via **prototypes** + **family resemblance** (Rosch & Mervis 1975): membership is *graded* (a robin is a "more typical" bird than a penguin). **Basic-level categories** ("dog") are cognitively privileged. **Categorical perception:** continuous stimuli (color/phoneme continua) are perceived discretely — humans draw hard boundaries into soft continua.
- **NSAI-Edge transfer (COMPLEMENT, UX/retrieval layer):** A deterministic *discretization function* over `confidence` (0–1000) to named **belief categories** (`verbürgt` ≥900, `wahrscheinlich` 600–899, `umstritten` 300–599, `zweifelhaft` <300) — mirrors categorical perception, makes the graph cognitively readable for the LLM agent. **Important: the belief category is a *projection* of confidence, not a new storage field** (the single source of truth remains the integer). Coincides with B5 (doc 05).
- **Take on "categorical thinking":** Humans think *graded* (prototype typicality) AND *discrete* (categorical perception, A/E/I/O) at the same time. NSAI-Edge has the graded axis (integer confidence) but no *discrete categorical projection* and no *quantity/polarity* — both cheaply retrofittable and strongly explainability-enhancing.
- **Sources.** [Syllogism (Wikipedia)](https://en.wikipedia.org/wiki/Syllogism) · [Prototype theory (Wikipedia)](https://en.wikipedia.org/wiki/Prototype_theory) · [Rosch & Mervis, Cognition and Categorization (PDF)](https://www.cs.rice.edu/~vo9/recognition/2016/slides/lecture07/CognitionAndCategorization.pdf)

---

## STRAND 4 — Speech act theory & fiction: fiction is not "false" but mode-shifted

**Austin: locution/illocution/perlocution.** Every utterance has three levels: locutionary (words+meaning), illocutionary (the *force*: asserting/asking/commanding), perlocutionary (effect on the hearer). → The sought "assertion mode" field captures the *illocutionary force*. NSAI-Edge today stores only the locution (S–P–O), discards the force.

**Searle: assertion = sincerity + truth commitment.** A serious assertion has as its *sincerity condition* the expressed belief that p is true, and as its *essential condition* a *commitment to the truth of p*. Frege marked the same step with the **judgment stroke** (⊢): from the merely *thought* content to the *acknowledgment of its truth*. → clean justification for separating "asserted" from "non-asserted".

**Searle "The Logical Status of Fictional Discourse" (1975) + Frege "Scheingedanken".** The author of fiction *pretends* to perform standard illocutions, *without intent to deceive*; by convention the truth commitments are *suspended*. **CORE: Fiction is NOT false — it is mode-shifted (commitment-suspended), orthogonal to truth value.** Lie = *full but inverted* commitment + intent to deceive; fiction = *no* commitment + *no* deception.

**David Lewis "Truth in Fiction" (1978): fiction operator.** *"In fiction f, A holds"* is true if A holds in those worlds in which f is told as fact and which are least dissimilar to our world. Fiction = set of worlds.
- **NSAI-Edge transfer (feature + link to strands 2 & 7):** (i) Extend `assertion_mode` (strand 2) with flag `suspended/fictional` (= "problematic + commitment=none"). (ii) Fictional/example/hypothesis triples NOT into the fact graph but into a *named world* (Lewis operator as world ID, strand 7). (iii) **Ingest heuristic (deterministic, rule-based):** source type `llm`/`web` + linguistic triggers ("suppose", "imagine", "in the story", "e.g.", subjunctive, quotation marks) → `mode=suspended`, target = sandbox world. Approximation, not truth (Tarski), but conservative: when in doubt, sandbox.
- **Determinism/zero-dep:** Operator = world-ID prefix; ingest markers = deterministic keyword/structure rules (no NLP model), deliberately coarse, signable, auditable.
- **Sources.** [SEP: Assertion](https://plato.stanford.edu/entries/assertion/) · [Searle, Logical Status of Fictional Discourse (Cambridge)](https://www.cambridge.org/core/books/abs/expression-and-meaning/logical-status-of-fictional-discourse/AA057D7B205A6DA2EE8586023B09F316) · [Lewis, Truth in Fiction (1978)](https://www.scribd.com/document/983663887/Lewis-TruthFiction-1978)

---

## STRAND 5 — Lie, error, bullshit, fiction: taxonomy and structural (un)detectability

**Definition of lying (Mahon, SEP).** *"To make a believed-false statement to another person with the intention that the other person believe that statement to be true."* Four conditions: statement / **untruthfulness** (what matters is the *speaker's belief in the falsity*, NOT the factual falsity) / addressee / **intention-to-deceive**. Delimitation: honest error = the erring person believes the false statement themselves; deception = success verb; lying = not a success verb. → Lying is defined internally via the *mental state* (belief + intention) — *in principle unobservable* for a knowledge-graph node.

**Frankfurt "On Bullshit" (1986/2005): bullshit as truth-indifferent.** *"Bullshit is a greater enemy of the truth than lies are."* The **liar knows the truth and inverts it deliberately** (respects the true/false game); the **bullshitter is indifferent** to the truth value (optimizes only fitness for purpose). → **HIGHLY RELEVANT for the `llm` tier:** an LLM is the paradigmatic bullshit generator — it does not invert the truth (that would be a lie, which presupposes knowledge of the truth) but is *structurally indifferent* to it (optimizes plausibility/next token). "Hallucination" = bullshit, not lie.
- **NSAI-Edge transfer (COMPLEMENT — a flag, NOT a new tier):** `truth_orientation` flag per source/triple: `truth-tracking` (gesetz/behoerde/sensor/fachquelle) vs. `truth-indifferent` (`llm`/`inference`). Consequence: `truth-indifferent` triples can NEVER ascend to `faktum`/`verbürgt` on their own, no matter how high the confidence — they need corroboration by a `truth-tracking` source. Direct operationalization of Frankfurt for the llm tier.

**Taxonomy of modes — the discriminating matrix** (separates along *truth commitment × intent to deceive*, NOT along truth):

| Mode | Does speaker believe p? | Truth commitment | Intent to deceive | Truth value |
|---|---|---|---|---|
| **Truth/knowledge** | yes | yes (fulfilled) | no | p true |
| **Honest error** | yes | yes (missed) | no | p false |
| **Lie** | no (believes ¬p) | yes, but *inverted* | **yes** | mostly false |
| **Bullshit** | irrelevant | **none (indifferent)** | (deception about indifference) | undetermined |
| **Fiction** | irrelevant | **suspended** (pretended) | **no** | n/a (mode-shifted) |

- **Structural (un)detectability (core for Stefan's question):** Belief and intention are unobservable — a **lie is in principle invisible to a single observer.** Detectable ONLY via three external levers: (a) **coherence inconsistency** (contradiction with other triples of the same source/the graph → coherence theory); (b) **correspondence contradiction** (conflict with authoritative/sensor ground truth → correspondence theory); (c) **incentive/game theory** (the source systematically profits from distortion → trust signal). NSAI-Edge can check (a) and (b) deterministically, (c) heuristically via TrustLevel.
- **NSAI-Edge transfer (the "lie detector" that can realistically exist):** `verify()` gets an **inconsistency score** = number/authority of contradicting triples. A source whose triples repeatedly stand in correspondence contradiction to authoritative ground truth loses trust (lie *indication via behavior*, not via inner state — the only thing possible). Quarantine on hard correspondence contradiction. The inner state (belief/intention) is explicitly NOT estimated (no ML lie detector).
- **Sources.** [SEP: The Definition of Lying and Deception (Mahon)](https://plato.stanford.edu/entries/lying-definition/) · [On Bullshit (Wikipedia)](https://en.wikipedia.org/wiki/On_Bullshit) · [Carson: Bullshitting, Lying, and Indifference toward Truth (Ergo)](https://quod.lib.umich.edu/e/ergo/12405314.0004.010/--bullshitting-lying-and-indifference-toward-truth)

---

## STRAND 6 — Theories of truth & Tarski: what a node can approximate — and never decide

**The theories of truth as available mechanisms.** **Correspondence** (agrees with reality — operationalizable only via privileged ground truth: sensor/law/authority); **coherence** (contradiction-free within the accepted system — checkable graph-internally); **consensus** (accepted by the community — via several independent peers); **pragmatic** (proves itself — via successful verify() predictions); **deflationary** (Tarski T-schema, "true" adds nothing).
- **NSAI-Edge transfer (partly implicitly present, now explicit):** NSAI-Edge has *three* approximate operationalizations of truth and should expose them as separate, combinable signals: **correspondence** = check against authoritative/sensor; **coherence** = inconsistency score (strand 5); **consensus** = independent corroboration by ≥N peers of different tiers. Recommendation: `verify()` returns `{korrespondenz, kohaerenz, konsens}` instead of a single true/false.

**Tarski's undefinability of truth (1933).** A sufficiently expressive, consistent language can NOT define its own truth predicate; truth is definable only in a more expressive *metalanguage* (otherwise liar paradox). **There is no language-internal truth oracle.**
- **Consequence (HARD LIMIT):** A knowledge graph is an object language over its triples. It cannot define an internal, complete, consistent `ist_wahr(tripel)`. Every "truth decision" must come from a *meta level*: privileged external source (correspondence) or consistency check *over* the triples (coherence) — never from a self-asserted truth flag.
- **NSAI-Edge transfer (architecture guardrail, not a feature):** (i) Forbid a self-asserted `is_true` field — truth is always *derived/relational*, never *declared*. (ii) authoritative tier + sensors formally play the *metalanguage* (external correspondence anchoring). (iii) `verify()` is a *falsification/consistency machine* (finds contradictions, quarantines), not a truth prover.

**Truth discovery / fact checking as practical approximation.** KG research (Yin "TruthFinder" KDD'07; Dong et al. VLDB'09): source reliability and claim credibility reinforce each other + corroboration by independent sources.
- **NSAI-Edge transfer (COMPLEMENT to belief resolution):** A *deterministic* truth-discovery step: triple credibility = weighted sum of supporting sources (weight = tier × TrustLevel), source reliability = running correspondence hit rate against authoritative. A deterministic single-pass/fixpoint variant (instead of probabilistic sampling) stays zero-dep.
- **Sources.** [Tarski's undefinability theorem (Wikipedia)](https://en.wikipedia.org/wiki/Tarski%27s_undefinability_theorem) · [SEP: Axiomatic Theories of Truth](https://plato.stanford.edu/entries/truth-axiomatic/) · [Yin et al., TruthFinder (KDD'07)](http://web.cs.ucla.edu/~yzsun/classes/2014Spring_CS7280/Papers/Trust/kdd07_xyin.pdf)

---

## STRAND 7 — Assumption/hypothesis reasoning: separate worlds without fact-graph pollution

**de Kleer ATMS (1986).** Manages *several, possibly contradictory* contexts simultaneously: **assumptions**, **environments** (assumption sets), **labels** (every derived statement carries the minimal environments under which it holds), **nogoods** (environments recognized as contradictory). Conflicts are isolated locally instead of invalidating the whole system.
- **NSAI-Edge transfer (NEW feature — "worlds/contexts", the second core lever):** `world`/`context` scopes. Fact graph = world `actual`. Hypothetical/fictional/quoted triples in named worlds (`hypothesis:X`, `fiction:f` (Lewis operator, strand 4), `quote:src`). `verify(claim, world=actual)` by default ignores all non-`actual` triples → **no fact-graph pollution.** Belief conflicts create *nogood* worlds (mutually exclusive assumption sets, strand 2 disjunctive). Decay/quarantine per world.
- **Determinism/zero-dep:** One `world` string/ID per triple + scope filter; label propagation deterministic (Horn clauses, polynomial, no solver).

**Possible-worlds/modal logic (Kripke, Lewis).** □ ("necessary" = in all accessible worlds) / ◇ ("possible" = in at least one) over an accessibility relation. □/◇ correspond exactly to Kant's apodictic/problematic (strand 2): mode = *how strongly* committed, world = *in what* committed. Counterfactual triples live in their own world with accessibility to `actual`.
- **Sources.** [de Kleer, An Assumption-Based TMS (AIJ 1986)](https://www.sciencedirect.com/science/article/abs/pii/0004370286900809) · [Reason maintenance (Wikipedia)](https://en.wikipedia.org/wiki/Reason_maintenance)

---

## CONCLUSION A — The three orthogonal axes (the actual answer)

The core of the problem is an **axis confusion**: NSAI-Edge squeezes into `TrustLevel`/`source_type`/`confidence` three *categorially different* dimensions that every epistemology strictly separates:

1. **Provenance authority** (WHO says it) — `source_type` tiers + peer `TrustLevel` measure this *correctly*. Social/institutional measure. "How seriously do I take the source?"
2. **Truth value** (IS it the case) — correspondence/coherence/consensus. Semantic measure — per Tarski internally only *approximable*, never *definable*.
3. **Assertion mode** (HOW it is put forward — asserted/assumed/necessary/fictional/quoted) — Kant's modality + Searle/Austin illocutionary force. Pragmatic-illocutionary measure. "With what commitment does the sentence stand there?"

**These three are orthogonal.** An **authoritative source** can make a **fictional** statement (a legal text quotes a hypothetical example) — high provenance, suspended mode, no truth commitment. An **llm tier** (low) can put forward a **true** statement **assertorically**. A **lie** has *full* assertoric commitment (mode high), *false* truth value and *arbitrary* provenance. Precisely these combinations NSAI-Edge cannot express today, because everything collapses into *one* scale.

**Reasoned position: COMPLEMENT, do not replace.** `TrustLevel`/`source_type` measures axis 1 *correctly* and should remain untouched — it is valid as a provenance measure, deterministic and signable. The error is not that TrustLevel measures *wrongly*, but that axes 2 and 3 are *missing* and their load is wrongly dumped onto axis 1. Concretely two new signed, orthogonal fields:
- `assertion_mode` (axis 3): Kant enum `{problematic, assertoric, apodictic}` + flag `suspended/fictional`. Deterministically settable at ingest.
- Truth value (axis 2) deliberately remains **derived, never stored** — `verify()` delivers a `{korrespondenz, kohaerenz, konsens}` signal on demand (Tarski guardrail).

*Replacing* `TrustLevel` in order to "distinguish lie from truth" would be a **category error:** provenance *is not* truth, and no provenance measure can determine the truth value of a single triple. One would replace a valid axis with one that is undecidable in principle.

---

## CONCLUSION B — What a node can NEVER decide in principle
1. **The absolute truth value of a single triple (Tarski).** No complete, consistent internal truth predicate. A self-asserted `is_true` flag is semantically empty.
2. **The inner state of a source — *lie* in the strict sense (Mahon).** Belief in ¬p + intent to deceive are unobservable. The node measures only *behavior* (inconsistency, contradiction, incentive patterns) → can prove *unreliability*, never "lie".
3. **Bullshit vs. honest error for a single statement (Frankfurt).** Separable only via the source's *attitude toward truth* — inferable only via *aggregated behavior* (llm tier = structurally `truth-indifferent`), not per statement.
4. **Open-world consequence:** The absence of a triple is no proof of its falsity. "Not in the graph" ≠ "false". The node can *falsify* and *corroborate*, but cannot pass completeness/truth judgments about the world.

**Consequence for the design:** NSAI-Edge should understand itself as a **falsification and consistency machine**, not as a truth oracle. It can deterministically uncover contradictions and unreliability — that is the epistemological maximum.

---

## CONCLUSION C — Top 3 concrete feature levers for lie / truth / fiction

**Lever 1 — `assertion_mode`: signed Kant modality field (solves "fiction ≠ false").** Orthogonal enum `{problematic, assertoric, apodictic}` + suspended/fictional flag (Kant + Searle + Lewis). Default `assertoric`, deterministic at ingest (source type + markers). Effect: fiction/hypothesis/quotation are *mode-shifted* instead of "false"; problematic triples never mature into facts on their own; apodictic ones are not subject to decay. Greatest benefit/effort ratio — one field, fully zero-dep.

**Lever 2 — Worlds/contexts (ATMS + Lewis): isolate fiction/hypothesis from the fact graph.** `world` scope per triple; fact graph = `actual`; fictional/hypothetical/quoted triples in sandbox worlds. `verify(claim, world=actual)` ignores sandbox worlds by default. Belief conflicts create nogood worlds instead of destructive overwriting (auditable). Deterministic label propagation.

**Lever 3 — Multi-signal `verify()` + `truth_orientation` flag: the epistemologically honest truth surrogate.** `verify()` delivers `{korrespondenz, kohaerenz, konsens}` instead of true/false (the three operationalizable theories of truth, Tarski-conformant as *approximation*). Plus `truth_orientation` flag (`truth-tracking` vs. `truth-indifferent`) that marks the `llm`/`inference` tier as a Frankfurtian bullshit source: such triples never ascend to `verbürgt`/`faktum` on their own, only via corroboration. The practicable "lie/bullshit protection": not via inner state (impossible), but via behavior (inconsistency) and source orientation.

**Relationship:** Lever 1 separates off axis 3 (mode), lever 3 separates off axis 2 (truth approximation) — both *relieve* the existing `TrustLevel` (axis 1), which unchanged measures provenance correctly. Lever 2 is the infrastructure that operationalizes mode. All three deterministic, signable, zero-dep.

> *Agent's note on sources:* "On Bullshit" essay 1986 / book Princeton UP 2005; Searle's assertion conditions from SEP *Assertion* (en-Wiki path `Assertion_(speech_act)` is 404). Remaining findings supported by ≥1 primary/SEP/Wikipedia source.
