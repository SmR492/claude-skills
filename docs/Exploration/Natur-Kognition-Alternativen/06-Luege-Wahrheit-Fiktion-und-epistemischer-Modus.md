# Lüge / Wahrheit / Fiktion & der epistemische Modus (inkl. „These" + kategorisches Denken)

> **Explorations-Rohmaterial** (Batch 2026-05-29), web-quellengestützt. **Keine CDP5-Bindung.** Dieses Dokument beantwortet drei zusammenhängende Stefan-Fragen aus der Exploration: (1) „Das System kann nicht zwischen Lüge / Wahrheit / Fiktion unterscheiden — findest du einen Ansatz?" (2) „Sollten wir das TrustLevel durch ein vermeintlich besseres System ersetzen, um Lüge von Wahrheit zu unterscheiden?" (3) „Analysiere das kategorische Denken des Menschen und sieh dir https://de.wikipedia.org/wiki/These an."
>
> **Kern-Antwort vorweg:** Nein — **TrustLevel nicht ersetzen, sondern ergänzen.** TrustLevel misst *Provenienz-Autorität* korrekt; es vermengt diese aber mit zwei fehlenden, orthogonalen Achsen: *Wahrheitswert* (nach Tarski nie intern entscheidbar, nur approximierbar) und *Assertions-Modus* (behauptet/vermutet/notwendig/fiktiv). Ein „besseres System, das Lüge von Wahrheit unterscheidet" ist im starken Sinn **unmöglich** — und genau die Art Überanspruch, gegen die das Projekt designt ist. Was geht: die Achsen trennen.

---

## ANKER: Wikipedia-Artikel „These" (de) — treue Wiedergabe
**Quelle:** https://de.wikipedia.org/wiki/These — Abschnitte: 1. Definition · 2. Geschichte des Begriffs · 3. These als Begriff in anderen Sprachen · 4. Siehe auch · 5. Weblinks · 6. Einzelnachweise.

Zentrale Definitionssätze (wörtlich):
- *„Die These (von altgriechisch θέσις thésis, deutsch ‚aufgestellter Satz, Behauptung') bezeichnet eine zu beweisende Behauptung oder einen Leitsatz."*
- *„Eine These ist ein Gedanke oder Satz, dessen Wahrheitsinhalt eines Beweises bedarf."*
- *„Ist die These nicht haltbar, muss sie verworfen werden. Andernfalls kann an der These festgehalten werden."*
- *„Eine Arbeitsthese ist eine vorläufig aufgestellte These."*
- Dialektischer Gebrauch (Antike): die These ist die vom Befragten gehaltene Position, die der Fragende zu erschüttern sucht. Beispiel: Luthers **95 Thesen** als *Disputationsthesen*.

**Take für NSAI-Edge:** Eine These ist definitorisch (a) *aufgestellt*, (b) *begründungspflichtig*, (c) *anfechtbar/verwerfbar*, (d) im Diskurs *gehalten, aber revidierbar*. Genau diesen Status repräsentiert der heutige Faktengraph **nicht** — Tripel sind flache Fakten mit Konfidenz, keine „behaupteten, begründungspflichtigen, anfechtbaren Sätze".

---

## STRANG 1 — Die „These" als epistemische Kategorie (anfechtbare Behauptung, nicht Faktum)

**These vs. Hypothese vs. Axiom vs. Faktum.** Skala abnehmender Strittigkeit / zunehmend erfüllter Begründungslast: *Axiom* (gesetzt, nicht begründungspflichtig) → *These* (zu beweisen) → *Hypothese* (zu testen, Popper) → *Faktum* (bewiesen/etabliert). Diskriminierender Marker ist NICHT der Wahrheitswert, sondern der *Begründungs-/Anfechtungs-Status*.
- **NSAI-Edge-Übertragung (ERGÄNZUNG):** Neues signiertes Enum `epistemic_status ∈ {axiom, these, hypothese, faktum}`, orthogonal zu `confidence`/`source_type`. Plus zwei Kanten-Typen `supports`/`rebuts` (Toulmin warrant/rebuttal) auf andere Tripel. Ein Tripel mit offenen `rebuts`-Kanten kann nicht auf `faktum` aufsteigen. Macht den Graphen *argumentativ* statt nur *deklarativ*.
- **Determinismus/Zero-Dep:** Voll (Enum + Kantenzählung; Auf-/Abstufung über deterministische Schwellen).

**These-Antithese-Synthese (Fichte/Hegel).** Im Wikipedia-Artikel **Fichte** (*Grundlage der gesamten Wissenschaftslehre*) zugeschrieben, popularisiert durch Hegel (der die Formel selbst kaum nutzte); Kant nutzt These/Antithese in den *Antinomien*. Zwei widersprechende Behauptungen erzeugen idealerweise eine dritte, qualifizierte (Synthese: „P gilt unter Bedingung C").
- **NSAI-Edge-Übertragung (ERGÄNZUNG der Belief-Resolution):** Statt autoritativem Überschreiben bei P/¬P-Konflikt ein *Synthese-Modus*: erzeuge eine *bedingte* These (`P unless C`, hypothetisches Tripel, siehe Strang 2) und bewahre die Antithese als `rebuts`-Kante (auditierbar). Deterministisch, sofern „Synthese" regelbasierte Kontextualisierung ist, keine generative Aussage.

**Toulmin-Schema & defeasible Logik (ASPIC⁺/Dung).** Toulmin (1958) zerlegt Argumente in claim / data / warrant / backing / qualifier / rebuttal. Ein *defeasible warrant* erlaubt Ausnahmen → Basis für Dung'sche abstrakte Argumentation. „Wahrheit" wird durch *Verteidigbarkeit im Argument-Graphen* approximiert (Tarski-konform, weil rein relational).
- **NSAI-Edge-Übertragung (ERGÄNZUNG):** `verify(claim)` wird vom Lookup zum Mini-Argument-Evaluator — ein Tripel ist „verteidigt", wenn seine `supports`-Kanten nicht durch unwidersprochene `rebuts`-Kanten höherer Autorität geschlagen werden (Dung „grounded extension", deterministisch in Polynomialzeit, Fixpunkt-Iteration, kein Solver). **Hinweis:** Das ist exakt der bereits im Konzept evaluierte Kandidat **I.3-A1 (Defeasible-Argumentation)** — die „These"-Linse liefert ihm den fehlenden UC-Bedarf.
- **Quellen.** [Wikipedia: These](https://de.wikipedia.org/wiki/These) · [Toulmin Argument Model](https://pressbooks.calstate.edu/writingargumentsinstem/chapter/toulmin-argument-model/)

---

## STRANG 2 — Kant'sche Urteilstafel: Modalität + Relation als fertige Modus-Achsen

**Modalität: problematisch / assertorisch / apodiktisch.** Kant (*KrV*, Urteilstafel): die Modalität *„bestimmt den Wert der Kopula in Beziehung auf das Denken überhaupt"* — sie sagt nichts über den Inhalt, nur über den *Behauptungs-Status*: **problematisch** = als bloß möglich angenommen; **assertorisch** = als wirklich/wahr behauptet; **apodiktisch** = als notwendig. Eine reine *Modus*-Achse, getrennt von Wahrheitswert und Quelle. Fiktion/Hypothese = problematisch; Sensor-Messung = assertorisch; mathematisches/definitorisches Gesetz = apodiktisch.
- **NSAI-Edge-Übertragung (NEUES signiertes Feld — das Kernfeature):** `assertion_mode ∈ {problematic, assertoric, apodictic}` als signiertes Integer-Enum pro Tripel, gesetzt am Ingest, Default `assertoric`. Die direkteste, am wenigsten kontroverse Antwort auf das Modus-Problem. `verify()` und Decay reagieren modusabhängig: problematische Tripel reifen nicht zu Fakten; apodiktische unterliegen keinem Decay.
- **Determinismus/Zero-Dep:** Triviale Enum, signierbar, ordinal vergleichbar.

**Relation: kategorisch / hypothetisch / disjunktiv.** Kant: **kategorisch** = unbedingt (S ist P); **hypothetisch** = bedingt (wenn A dann B); **disjunktiv** = exklusive Alternativen (entweder A oder B oder C). Das aktuelle S–P–O-Tripel ist strukturell *nur kategorisch* — „wenn A dann B" und „entweder/oder" kann NSAI-Edge nativ gar nicht ausdrücken.
- **NSAI-Edge-Übertragung (ERGÄNZUNG):** `relation_type ∈ {categorical, hypothetical, disjunctive}`. Für `hypothetical` ein optionaler `condition`-Verweis (anderes Tripel/Welt aus Strang 7) → deckt die Synthese aus Strang 1 ab. Für `disjunctive` eine Gruppe-ID exklusiver Alternativen (genau eine wahr — nützlich für unaufgelöste Belief-Konflikte).
- **Quellen.** [Kant — Modalität der Urteile (textlog)](https://www.textlog.de/kant-logik-modalitaet-urteil.html) · [Kant — Relation der Urteile (textlog)](https://www.textlog.de/kant-logik-relation-urteile.html)

---

## STRANG 3 — Aristotelische kategorische Aussagen + kategoriales Denken (Rosch)

**Aristotelische A/E/I/O-Aussagen.** Vier kategorische Formen: **A** „All S are P", **E** „No S are P", **I** „Some S are P", **O** „Some S are not P". „Kategorisch" = unbedingte, definitive Behauptung über Klassen-Zugehörigkeit. Zwei Binärachsen: Quantität (universell/partikulär) + Qualität (affirmativ/negativ). Ein Tripel ist implizit A oder I — aber NSAI-Edge unterscheidet „alle X sind Y" (durch ein Gegenbeispiel falsifizierbar) nicht von „dieses X ist Y" (singulär).
- **NSAI-Edge-Übertragung (ERGÄNZUNG):** Felder `quantity ∈ {universal, particular, singular}` + `polarity ∈ {affirmative, negative}`. Nutzen: Falsifizierbarkeit von `verify()` — ein universell-affirmatives Tripel ist durch EIN Gegenbeispiel höherer Autorität widerlegbar; ein singuläres nicht. Negative Tripel erlauben explizite *closed-world-Inseln* in der ansonsten open-world-Architektur.

**Rosch: Prototypentheorie, Basic-Level, graduelle Mitgliedschaft, kategoriale Wahrnehmung.** Menschliche Kategorien funktionieren NICHT klassisch (notwendige+hinreichende Merkmale), sondern über **Prototypen** + **Familienähnlichkeit** (Rosch & Mervis 1975): Mitgliedschaft ist *graduell* (Rotkehlchen „typischerer" Vogel als Pinguin). **Basic-Level-Kategorien** („Hund") sind kognitiv privilegiert. **Kategoriale Wahrnehmung:** kontinuierliche Reize (Farb-/Phonem-Kontinua) werden diskret wahrgenommen — der Mensch zieht harte Grenzen in weiche Kontinua.
- **NSAI-Edge-Übertragung (ERGÄNZUNG, UX/Retrieval-Layer):** Eine deterministische *Diskretisierungs-Funktion* über `confidence` (0–1000) zu benannten **Belief-Kategorien** (`verbürgt` ≥900, `wahrscheinlich` 600–899, `umstritten` 300–599, `zweifelhaft` <300) — spiegelt kategoriale Wahrnehmung, macht den Graphen für den LLM-Agenten kognitiv lesbar. **Wichtig: Belief-Kategorie ist eine *Projektion* der Konfidenz, kein neues Speicherfeld** (Single Source of Truth bleibt der Integer). Deckt sich mit B5 (Dok 05).
- **Take zum „kategorischen Denken":** Der Mensch denkt zugleich *graduell* (Prototyp-Typikalität) UND *diskret* (kategoriale Wahrnehmung, A/E/I/O). NSAI-Edge hat die graduelle Achse (Integer-Konfidenz), aber keine *diskrete kategoriale Projektion* und keine *Quantität/Polarität* — beides billig nachrüstbar und stark erklärbarkeits-steigernd.
- **Quellen.** [Syllogism (Wikipedia)](https://en.wikipedia.org/wiki/Syllogism) · [Prototype theory (Wikipedia)](https://en.wikipedia.org/wiki/Prototype_theory) · [Rosch & Mervis, Cognition and Categorization (PDF)](https://www.cs.rice.edu/~vo9/recognition/2016/slides/lecture07/CognitionAndCategorization.pdf)

---

## STRANG 4 — Sprechakttheorie & Fiktion: Fiktion ist nicht „falsch", sondern Modus-verschoben

**Austin: Lokution/Illokution/Perlokution.** Jede Äußerung hat drei Ebenen: lokutionär (Wörter+Bedeutung), illokutionär (die *Kraft*: Behaupten/Fragen/Befehlen), perlokutionär (Wirkung beim Hörer). → Das gesuchte „Assertions-Modus"-Feld erfasst die *illokutionäre Kraft*. NSAI-Edge speichert heute nur die Lokution (S–P–O), verwirft die Kraft.

**Searle: Assertion = Aufrichtigkeits- + Wahrheits-Commitment.** Eine ernsthafte Assertion hat als *sincerity condition* den ausgedrückten Glauben, dass p wahr ist, und als *essential condition* ein *Commitment auf die Wahrheit von p*. Frege markierte denselben Schritt mit dem **Urteilsstrich** (⊢): vom bloß *gedachten* Inhalt zur *Anerkennung seiner Wahrheit*. → saubere Begründung, „assertiert" von „nicht-assertiert" zu trennen.

**Searle „The Logical Status of Fictional Discourse" (1975) + Frege „Scheingedanken".** Der Fiktions-Autor *gibt vor* (pretends), Standard-Illokutionen zu vollziehen, *ohne Täuschungsabsicht*; durch Konventionen werden die Wahrheits-Commitments *suspendiert*. **KERN: Fiktion ist NICHT falsch — sie ist modus-verschoben (commitment-suspendiert), orthogonal zum Wahrheitswert.** Lüge = *volles, aber invertiertes* Commitment + Täuschungsabsicht; Fiktion = *kein* Commitment + *keine* Täuschung.

**David Lewis „Truth in Fiction" (1978): Fiktions-Operator.** *„In der Fiktion f gilt A"* ist wahr, wenn A in jenen Welten gilt, in denen f als Tatsache erzählt wird und die unserer Welt am wenigsten unähnlich sind. Fiktion = Menge von Welten.
- **NSAI-Edge-Übertragung (Feature + Verknüpfung zu Strang 2 & 7):** (i) `assertion_mode` (Strang 2) um Flag `suspended/fictional` ergänzen (= „problematisch + commitment=none"). (ii) Fiktive/Beispiel-/Hypothese-Tripel NICHT in den Faktengraphen, sondern in eine *benannte Welt* (Lewis-Operator als Welt-ID, Strang 7). (iii) **Ingest-Heuristik (deterministisch, regelbasiert):** Quelltyp `llm`/`web` + sprachliche Trigger („angenommen", „stell dir vor", „in der Geschichte", „z. B.", Konjunktiv, Zitat-Anführung) → `mode=suspended`, Ziel = Sandbox-Welt. Approximation, nicht Wahrheit (Tarski), aber konservativ: im Zweifel Sandbox.
- **Determinismus/Zero-Dep:** Operator = Welt-ID-Präfix; Ingest-Marker = deterministische Schlüsselwort-/Strukturregeln (kein NLP-Modell), bewusst grob, signierbar, auditierbar.
- **Quellen.** [SEP: Assertion](https://plato.stanford.edu/entries/assertion/) · [Searle, Logical Status of Fictional Discourse (Cambridge)](https://www.cambridge.org/core/books/abs/expression-and-meaning/logical-status-of-fictional-discourse/AA057D7B205A6DA2EE8586023B09F316) · [Lewis, Truth in Fiction (1978)](https://www.scribd.com/document/983663887/Lewis-TruthFiction-1978)

---

## STRANG 5 — Lüge, Irrtum, Bullshit, Fiktion: Taxonomie und strukturelle (Un-)Erkennbarkeit

**Definition der Lüge (Mahon, SEP).** *„To make a believed-false statement to another person with the intention that the other person believe that statement to be true."* Vier Bedingungen: statement / **untruthfulness** (entscheidend ist der *Glaube des Sprechers an die Falschheit*, NICHT die faktische Falschheit) / addressee / **intention-to-deceive**. Abgrenzung: ehrlicher Irrtum = der Irrende glaubt die falsche Aussage selbst; Täuschung = Erfolgsverb; Lügen = kein Erfolgsverb. → Lüge ist intern definiert über den *mentalen Zustand* (Glaube + Absicht) — für einen Wissensgraph-Knoten *prinzipiell unbeobachtbar*.

**Frankfurt „On Bullshit" (1986/2005): Bullshit als wahrheits-indifferent.** *„Bullshit is a greater enemy of the truth than lies are."* Der **Lügner kennt die Wahrheit und invertiert sie gezielt** (respektiert das Wahr/Falsch-Spiel); der **Bullshitter ist indifferent** gegenüber dem Wahrheitswert (optimiert nur Zweck-Eignung). → **HOCHRELEVANT für den `llm`-Tier:** ein LLM ist der paradigmatische Bullshit-Generator — es invertiert die Wahrheit nicht (das wäre eine Lüge, die Wahrheitskenntnis voraussetzt), sondern ist ihr gegenüber *strukturell indifferent* (optimiert Plausibilität/Nächstes-Token). „Halluzination" = Bullshit, nicht Lüge.
- **NSAI-Edge-Übertragung (ERGÄNZUNG — ein Flag, KEIN neuer Tier):** `truth_orientation`-Flag pro Quelle/Tripel: `truth-tracking` (gesetz/behoerde/sensor/fachquelle) vs. `truth-indifferent` (`llm`/`inference`). Konsequenz: `truth-indifferent`-Tripel können NIE allein auf `faktum`/`verbürgt` aufsteigen, egal wie hoch die Konfidenz — sie brauchen Korroboration durch eine `truth-tracking`-Quelle. Direkte Operationalisierung von Frankfurt für den llm-Tier.

**Taxonomie der Modi — die diskriminierende Matrix** (trennt entlang *Wahrheits-Commitment × Täuschungsabsicht*, NICHT entlang der Wahrheit):

| Modus | Glaubt Sprecher p? | Wahrheits-Commitment | Täuschungsabsicht | Wahrheitswert |
|---|---|---|---|---|
| **Wahrheit/Wissen** | ja | ja (erfüllt) | nein | p wahr |
| **Ehrlicher Irrtum** | ja | ja (verfehlt) | nein | p falsch |
| **Lüge** | nein (glaubt ¬p) | ja, aber *invertiert* | **ja** | meist falsch |
| **Bullshit** | egal | **keines (indifferent)** | (Täuschung über Indifferenz) | unbestimmt |
| **Fiktion** | egal | **suspendiert** (vorgetäuscht) | **nein** | n/a (modus-verschoben) |

- **Strukturelle (Un-)Erkennbarkeit (Kern für die Stefan-Frage):** Glaube und Absicht sind unbeobachtbar — eine **Lüge ist für einen Einzelbeobachter prinzipiell unsichtbar.** Detektierbar NUR über drei externe Hebel: (a) **Kohärenz-Inkonsistenz** (Widerspruch zu anderen Tripeln derselben Quelle/des Graphen → Kohärenztheorie); (b) **Korrespondenz-Widerspruch** (Konflikt mit authoritative/Sensor-Ground-Truth → Korrespondenztheorie); (c) **Anreiz/Spieltheorie** (Quelle profitiert systematisch von Verzerrung → Trust-Signal). NSAI-Edge kann (a) und (b) deterministisch prüfen, (c) heuristisch über TrustLevel.
- **NSAI-Edge-Übertragung (der „Lügen-Detektor", den es realistisch geben kann):** `verify()` bekommt einen **Inkonsistenz-Score** = Anzahl/Autorität widersprechender Tripel. Eine Quelle, deren Tripel wiederholt zu authoritative-Ground-Truth in Korrespondenz-Widerspruch stehen, verliert Vertrauen (Lügen-*Indikation über Verhalten*, nicht über inneren Zustand — das einzig Mögliche). Quarantäne bei hartem Korrespondenz-Widerspruch. Innerer Zustand (Glaube/Absicht) wird explizit NICHT geschätzt (kein ML-Lügendetektor).
- **Quellen.** [SEP: The Definition of Lying and Deception (Mahon)](https://plato.stanford.edu/entries/lying-definition/) · [On Bullshit (Wikipedia)](https://en.wikipedia.org/wiki/On_Bullshit) · [Carson: Bullshitting, Lying, and Indifference toward Truth (Ergo)](https://quod.lib.umich.edu/e/ergo/12405314.0004.010/--bullshitting-lying-and-indifference-toward-truth)

---

## STRANG 6 — Wahrheitstheorien & Tarski: Was ein Knoten approximieren — und nie entscheiden — kann

**Die Wahrheitstheorien als verfügbare Mechanismen.** **Korrespondenz** (stimmt mit der Realität — operationalisierbar nur via privilegierte Ground-Truth: Sensor/Gesetz/Behörde); **Kohärenz** (widerspruchsfrei im akzeptierten System — graph-intern prüfbar); **Konsens** (von der Gemeinschaft akzeptiert — über mehrere unabhängige Peers); **pragmatisch** (bewährt sich — über erfolgreiche verify()-Vorhersagen); **deflationär** (Tarski-T-Schema, „wahr" fügt nichts hinzu).
- **NSAI-Edge-Übertragung (teilimplizit vorhanden, jetzt explizit):** NSAI-Edge hat *drei* approximative Wahrheits-Operationalisierungen und sollte sie als getrennte, kombinierbare Signale ausweisen: **Korrespondenz** = Abgleich gegen authoritative/Sensor; **Kohärenz** = Inkonsistenz-Score (Strang 5); **Konsens** = unabhängige Korroboration durch ≥N Peers verschiedener Tiers. Empfehlung: `verify()` gibt `{korrespondenz, kohaerenz, konsens}` zurück statt eines einzelnen Wahr/Falsch.

**Tarskis Undefinierbarkeit der Wahrheit (1933).** Eine hinreichend ausdrucksstarke, konsistente Sprache kann ihr eigenes Wahrheitsprädikat NICHT definieren; Wahrheit ist nur in einer ausdrucksstärkeren *Metasprache* definierbar (sonst Lügner-Paradoxon). **Es gibt kein sprachinternes Wahrheits-Orakel.**
- **Konsequenz (HARTE GRENZE):** Ein Wissensgraph ist eine Objektsprache über seine Tripel. Er kann kein internes, vollständiges, konsistentes `ist_wahr(tripel)` definieren. Jede „Wahrheits-Entscheidung" muss aus einer *Metaebene* kommen: privilegierte externe Quelle (Korrespondenz) oder Konsistenz-Check *über* den Tripeln (Kohärenz) — nie aus einem selbstbehaupteten Wahrheits-Flag.
- **NSAI-Edge-Übertragung (Architektur-Leitplanke, kein Feature):** (i) Verbiete ein selbstbehauptetes `is_true`-Feld — Wahrheit ist immer *abgeleitet/relational*, nie *deklariert*. (ii) authoritative-Tier + Sensoren spielen formal die *Metasprache* (externe Korrespondenz-Verankerung). (iii) `verify()` ist eine *Falsifikations-/Konsistenz-Maschine* (findet Widersprüche, quarantänisiert), kein Wahrheits-Beweiser.

**Truth-Discovery / Fact-Checking als praktische Approximation.** KG-Forschung (Yin „TruthFinder" KDD'07; Dong et al. VLDB'09): Quell-Verlässlichkeit und Aussage-Glaubwürdigkeit verstärken sich gegenseitig + Korroboration unabhängiger Quellen.
- **NSAI-Edge-Übertragung (ERGÄNZUNG der Belief-Resolution):** Ein *deterministischer* Truth-Discovery-Schritt: Tripel-Glaubwürdigkeit = gewichtete Summe stützender Quellen (Gewicht = Tier × TrustLevel), Quell-Verlässlichkeit = laufende Korrespondenz-Trefferquote gegen authoritative. Deterministische Ein-Pass-/Fixpunkt-Variante (statt probabilistischem Sampling) bleibt zero-dep.
- **Quellen.** [Tarski's undefinability theorem (Wikipedia)](https://en.wikipedia.org/wiki/Tarski%27s_undefinability_theorem) · [SEP: Axiomatic Theories of Truth](https://plato.stanford.edu/entries/truth-axiomatic/) · [Yin et al., TruthFinder (KDD'07)](http://web.cs.ucla.edu/~yzsun/classes/2014Spring_CS7280/Papers/Trust/kdd07_xyin.pdf)

---

## STRANG 7 — Annahme-/Hypothesen-Reasoning: getrennte Welten ohne Faktengraph-Verschmutzung

**de Kleer ATMS (1986).** Verwaltet gleichzeitig *mehrere, möglicherweise widersprüchliche* Kontexte: **assumptions**, **environments** (Annahmemengen), **labels** (jede abgeleitete Aussage trägt die minimalen Environments, unter denen sie gilt), **nogoods** (als widersprüchlich erkannte Environments). Konflikte werden lokal isoliert, statt das Gesamtsystem zu invalidieren.
- **NSAI-Edge-Übertragung (NEUES Feature — „Welten/Kontexte", der zweite Kern-Hebel):** `world`/`context`-Scopes. Faktengraph = Welt `actual`. Hypothetische/fiktive/zitierte Tripel in benannte Welten (`hypothesis:X`, `fiction:f` (Lewis-Operator, Strang 4), `quote:src`). `verify(claim, world=actual)` ignoriert per Default alle Nicht-`actual`-Tripel → **kein Faktengraph-Verschmutzen.** Belief-Konflikte erzeugen *nogood*-Welten (sich ausschließende Annahmemengen, Strang 2 disjunktiv). Decay/Quarantäne pro Welt.
- **Determinismus/Zero-Dep:** Ein `world`-String/ID pro Tripel + Scope-Filter; Label-Propagation deterministisch (Horn-Klauseln, polynomiell, kein Solver).

**Possible-Worlds-/Modallogik (Kripke, Lewis).** □ („notwendig" = in allen zugänglichen Welten) / ◇ („möglich" = in mindestens einer) über eine Zugänglichkeitsrelation. □/◇ entsprechen exakt Kants apodiktisch/problematisch (Strang 2): Modus = *wie stark* committed, Welt = *worin* committed. Kontrafaktische Tripel leben in eigener Welt mit Zugänglichkeit zu `actual`.
- **Quellen.** [de Kleer, An Assumption-Based TMS (AIJ 1986)](https://www.sciencedirect.com/science/article/abs/pii/0004370286900809) · [Reason maintenance (Wikipedia)](https://en.wikipedia.org/wiki/Reason_maintenance)

---

## SCHLUSS A — Die drei orthogonalen Achsen (die eigentliche Antwort)

Der Kern des Problems ist eine **Achsen-Verwechslung**: NSAI-Edge presst in `TrustLevel`/`source_type`/`confidence` drei *kategorial verschiedene* Dimensionen, die jede Erkenntnistheorie strikt trennt:

1. **Provenienz-Autorität** (WER sagt es) — `source_type`-Tiers + Peer-`TrustLevel` messen das *korrekt*. Soziales/institutionelles Maß. „Wie ernst nehme ich die Quelle?"
2. **Wahrheitswert** (IST es der Fall) — Korrespondenz/Kohärenz/Konsens. Semantisches Maß — nach Tarski intern nur *approximierbar*, nie *definierbar*.
3. **Assertions-Modus** (WIE wird es vorgebracht — behauptet/vermutet/notwendig/fiktiv/zitiert) — Kants Modalität + Searle/Austin illokutionäre Kraft. Pragmatisch-illokutionäres Maß. „Mit welcher Verpflichtung steht der Satz da?"

**Diese drei sind orthogonal.** Eine **autoritative Quelle** kann eine **fiktive** Aussage machen (ein Gesetzestext zitiert ein hypothetisches Beispiel) — hohe Provenienz, suspendierter Modus, kein Wahrheits-Commitment. Ein **llm-Tier** (niedrig) kann eine **wahre** Aussage **assertorisch** vorbringen. Eine **Lüge** hat *volles* assertorisches Commitment (Modus hoch), *falschen* Wahrheitswert und *beliebige* Provenienz. Genau diese Kombinationen kann NSAI-Edge heute nicht ausdrücken, weil alles in *einer* Skala kollabiert.

**Begründete Position: ERGÄNZEN, nicht ersetzen.** `TrustLevel`/`source_type` misst Achse 1 *richtig* und sollte unangetastet bleiben — es ist als Provenienz-Maß valide, deterministisch und signierbar. Der Fehler ist nicht, dass TrustLevel *falsch* misst, sondern dass die Achsen 2 und 3 *fehlen* und ihre Last fälschlich auf Achse 1 abgeladen wird. Konkret zwei neue signierte, orthogonale Felder:
- `assertion_mode` (Achse 3): Kant-Enum `{problematic, assertoric, apodictic}` + Flag `suspended/fictional`. Deterministisch am Ingest setzbar.
- Wahrheitswert (Achse 2) bleibt bewusst **abgeleitet, nie gespeichert** — `verify()` liefert ein `{korrespondenz, kohaerenz, konsens}`-Signal on demand (Tarski-Leitplanke).

`TrustLevel` zu *ersetzen*, um „Lüge von Wahrheit zu unterscheiden", wäre ein **Kategorienfehler:** Provenienz *ist nicht* Wahrheit, und kein Provenienz-Maß kann den Wahrheitswert eines Einzeltripels bestimmen. Man würde eine valide Achse durch eine prinzipiell unentscheidbare ersetzen.

---

## SCHLUSS B — Was ein Knoten prinzipiell NIE entscheiden kann
1. **Den absoluten Wahrheitswert eines Einzeltripels (Tarski).** Kein vollständiges, konsistentes internes Wahrheitsprädikat. Ein selbstbehauptetes `is_true`-Flag ist semantisch leer.
2. **Den inneren Zustand einer Quelle — *Lüge* im strikten Sinn (Mahon).** Glaube an ¬p + Täuschungsabsicht sind unbeobachtbar. Der Knoten misst nur *Verhalten* (Inkonsistenz, Widerspruch, Anreiz-Muster) → *Unzuverlässigkeit*, nie „Lüge" beweisen.
3. **Bullshit vs. ehrlichen Irrtum bei einer Einzelaussage (Frankfurt).** Trennt sich nur über die *Haltung zur Wahrheit* der Quelle — nur über *aggregiertes Verhalten* erschließbar (llm-Tier = strukturell `truth-indifferent`), nicht pro Aussage.
4. **Open-World-Konsequenz:** Abwesenheit eines Tripels ist kein Beweis seiner Falschheit. „Nicht im Graphen" ≠ „falsch". Der Knoten kann *falsifizieren* und *korroborieren*, aber keine Vollständigkeits-/Wahrheitsurteile über die Welt fällen.

**Konsequenz fürs Design:** NSAI-Edge sollte sich als **Falsifikations- und Konsistenz-Maschine** verstehen, nicht als Wahrheits-Orakel. Es kann Widersprüche und Unzuverlässigkeit deterministisch aufdecken — das ist das erkenntnistheoretisch Maximale.

---

## SCHLUSS C — Top 3 konkrete Feature-Hebel für Lüge / Wahrheit / Fiktion

**Hebel 1 — `assertion_mode`: signiertes Kant-Modalitäts-Feld (löst „Fiktion ≠ falsch").** Orthogonales Enum `{problematic, assertoric, apodictic}` + Suspended/Fictional-Flag (Kant + Searle + Lewis). Default `assertoric`, deterministisch am Ingest (Quelltyp + Marker). Wirkung: Fiktion/Hypothese/Zitat sind *modus-verschoben* statt „falsch"; problematische Tripel reifen nie eigenständig zu Fakten; apodiktische unterliegen keinem Decay. Größter Nutzen/Aufwand — ein Feld, vollständig zero-dep.

**Hebel 2 — Welten/Kontexte (ATMS + Lewis): Fiktion/Hypothese aus dem Faktengraphen isolieren.** `world`-Scope pro Tripel; Faktengraph = `actual`; fiktive/hypothetische/zitierte Tripel in Sandbox-Welten. `verify(claim, world=actual)` ignoriert Sandbox-Welten per Default. Belief-Konflikte erzeugen nogood-Welten statt destruktivem Überschreiben (auditierbar). Deterministische Label-Propagation.

**Hebel 3 — Mehrsignal-`verify()` + `truth_orientation`-Flag: das erkenntnistheoretisch ehrliche Wahrheits-Surrogat.** `verify()` liefert `{korrespondenz, kohaerenz, konsens}` statt Wahr/Falsch (die drei operationalisierbaren Wahrheitstheorien, Tarski-konform als *Approximation*). Plus `truth_orientation`-Flag (`truth-tracking` vs. `truth-indifferent`), das den `llm`/`inference`-Tier als Frankfurt'sche Bullshit-Quelle markiert: solche Tripel steigen nie allein auf `verbürgt`/`faktum`, nur via Korroboration. Der praktikable „Lügen-/Bullshit-Schutz": nicht über inneren Zustand (unmöglich), sondern über Verhalten (Inkonsistenz) und Quell-Orientierung.

**Verhältnis:** Hebel 1 trennt Achse 3 (Modus) ab, Hebel 3 trennt Achse 2 (Wahrheit-Approximation) ab — beide *entlasten* das bestehende `TrustLevel` (Achse 1), das unverändert korrekt Provenienz misst. Hebel 2 ist die Infrastruktur, die Modus operationalisiert. Alle drei deterministisch, signierbar, zero-dep.

> *Quellen-Hinweis des Agenten:* „On Bullshit" Essay 1986 / Buch Princeton UP 2005; Searles Assertions-Bedingungen aus SEP *Assertion* (en-Wiki-Pfad `Assertion_(speech_act)` ist 404). Übrige Befunde durch ≥1 Primär-/SEP-/Wikipedia-Quelle gestützt.
