# Das menschliche Gedächtnis & Gehirn als Blaupause

> **Explorations-Rohmaterial** (Batch 2026-05-29), generiert via Recherche-Agent (web-quellengestützt). **Keine CDP5-Bindung** — bewusst breit/kreativ. Invarianten-Brüche sind *geflaggt, nicht gefiltert*. Vorbild: `docs/Exploration/NotebookLM`. Zweck: Rohmaterial fürs Konzept, **nicht selbst Konzept**.
>
> **Invarianten-Legende:** (1) Zero-Dep · (2) Offline · (3) Determinismus · (4) CRDT-Konvergenz · (5) Trust/Belief/Temporalität = lokale Lese-Linsen über signiertem Wire-Wert · (6) „Anzahl zählt nie" · (7) Open-World · (8) „Nie raten".

---

## 1. ACT-R Base-Level Activation als zweite, kognitiv fundierte Decay-Achse

**Prinzip** (Kognition) — Anderson & Schoolers rationale Analyse zeigt: Das menschliche Gedächtnis hält genau die Information bereit, die statistisch am wahrscheinlichsten gleich gebraucht wird. Die „base-level activation" eines Gedächtnis-Chunks verfolgt die Log-Odds, dass dieser Chunk JETZT benötigt wird — und diese Größe folgt empirisch exakt einem Power-Law aus Nutzungs-Recency und -Häufigkeit. Das ist keine biologische Schwäche, sondern eine umweltoptimale Vorhersage.

**Mechanismus/Algorithmus** — `B_i = ln( Σ_{j=1}^{n} t_j^{-d} )`, wobei `t_j` = Zeit seit dem j-ten Zugriff, `d` = Decay-Rate (ACT-R-Default 0.5). Jeder Abruf addiert einen Term, der danach unabhängig zerfällt → Power-Law-of-Practice + Power-Law-of-Forgetting in einer Formel. Wichtig: Power-Law (`t^-d`), nicht das aktuelle exponentielle Halbwertszeit-Decay.

**NSAI-Edge-Übertragung** — Ergänzt (nicht ersetzt) das temporalitäts-basierte Konfidenz-Decay um eine separate, lokal berechnete `activation`-Spalte pro Tripel: Summe über Zugriffs-Timestamps (= das geplante zugriffsbasierte Decay/Spaced-Repetition, aber mathematisch fundiert). Konfidenz bleibt der signierte Wahrheits-*Anspruch*; activation wird die „Wie-schnell-greifbar"-Linse fürs Retrieval-Ranking. Damit hat NSAI-Edge die gewünschten zwei Achsen — kognitiv exakt richtig: Konfidenz ≈ Bjorks storage strength, activation ≈ retrieval strength (Idee 2).

**Alternativen & Trade-offs** — Power-Law ist teurer als Exponential (Summe über n Zugriffe). „Optimized learning"-Approximation `B_i ≈ ln(n/(1-d)) − d·ln(t_now − t_creation)` braucht nur n + creation-time → O(1). Achtung (Petrov 2018): Standard-Approximation kann nicht-monoton in d sein → für Determinismus die volle Summe mit gekappter History (z. B. letzte 20 Zugriffe).

**Invarianten-Check** — (1) ✅; (2) ✅; (3) ⚠️ `ln`/`pow` sind Float — im LOKALEN Retrieval-Pfad unkritisch, NIE im föderierten/signierten Pfad (dort Integer-Promille); (5) ✅ activation lokal, mutiert kein signiertes Feld; (6) ✅ Recency/Frequency des EIGENEN Zugriffs ≠ Quell-Anzahl.

**Quellen** — Anderson & Schooler (1991), *Reflections of the Environment in Memory*; Anderson 2021 (http://act-r.psy.cmu.edu/wordpress/wp-content/uploads/2021/07/ACTR2021anderson.pdf); van Rijn et al., *A Comparison of Approximations for Base-Level Activation in ACT-R*, Comput Brain Behav 2018 (https://link.springer.com/article/10.1007/s42113-018-0015-3).

---

## 2. Storage Strength vs. Retrieval Strength — zwei orthogonale Achsen (Bjork)

**Prinzip** — Bjorks „New Theory of Disuse": zwei unabhängige Maße je Eintrag: **storage strength** (wie tief gelernt — steigt monoton, fällt NIE) und **retrieval strength** (wie schnell gerade abrufbar — zerfällt). Eine Erinnerung kann tief gespeichert, aber temporär unzugänglich sein. Clou: Erfolgreicher Abruf bei NIEDRIGER retrieval strength liefert den größten Zuwachs an storage strength („desirable difficulties").

**Mechanismus** — Zwei Skalare. SS nur additiv (monoton). RS exponentiell/power-law-zerfallend, durch Abruf angehoben — Abruf-Boost auf SS invers proportional zur aktuellen RS: `ΔSS ∝ (1 − RS)`. Hohe SS dämpft den RS-Zerfall.

**NSAI-Edge-Übertragung** — Liefert die saubere SEMANTIK für die zwei Decay-Achsen: `confidence` (signiert, ~SS, darf via reinforce/CRDT-max nur steigen — passt zu „SS steigt nie ab"!) und `activation` (~RS, lokal, zerfällt). Konkret neu: Bei einer Query, deren Top-Treffer NIEDRIGE activation aber HOHE confidence hat → den reinforce()-Boost VERSTÄRKEN (desirable-difficulty-Bonus). Macht aus dem geplanten Spaced-Repetition ein theoretisch korrektes Modell. Bonus: erklärt, warum „disputed/überstimmte" Fakten auditierbar bleiben sollten — niedrige RS, aber SS bleibt → „labil, nicht gelöscht".

**Invarianten-Check** — (3) ✅; (5) ✅ activation als Lese-Linse, confidence/SS bleibt signiert; (4) ✅ CRDT-max auf confidence konsistent mit „SS steigt nie ab"; (6) ✅.

**Quellen** — Bjork & Bjork (1992), *A new theory of disuse* (https://www.researchgate.net/publication/281322665); The Learning Scientists, *Retrieval vs. Storage Strength* (https://www.learningscientists.org/blog/2016/5/10-1).

---

## 3. Offline-„Schlafphase": Sharp-Wave-Ripple-Replay & Batch-Re-Inferenz

**Prinzip** (Neuro) — Im Slow-Wave-Schlaf reaktiviert der Hippocampus jüngste Sequenzen in komprimierten Bursts (sharp-wave ripples, SWR); diese koordinieren mit dem Neokortex und transferieren Inhalte schrittweise in stabilen kortikalen Langzeitspeicher (systems consolidation). 2024/25: Closed-loop-Verstärken großer SWRs steigert Reaktivierung + Gedächtnisleistung; nur eine SUBMENGE großer SWRs trägt die Konsolidierung.

**Mechanismus** — Idle-getriggerter Batch-Job: (a) selektives Replay — bevorzugt Episoden mit hohem Salience-Wert (häufig referenziert / hohe activation / hohe Überraschung); (b) Forward-Chaining-Re-Run über alle Regeln; (c) Promotion: stabilisierte Episoden → semantische Tripel (Idee 5). Selektivität = „große SWR": nur Top-k nach Salience-Score, nicht alles.

**NSAI-Edge-Übertragung** — Neuer Idle-Batch-Modus (kein Online-Pfad): bündelt episodisches Gedächtnis + Konsolidierung + Inferenz in eine deterministische, off-peak laufende „Schlafphase". Konkret: Forward-Chaining heute query-/assert-time → ein zusätzlicher Konsolidierungs-Pass amortisiert Inferenzkosten und extrahiert Gist offline (determinismus-freundlich, zeitlich entkoppelt). Selektives Replay priorisiert via activation-Score (Idee 1).

**Alternativen & Trade-offs** — Eager (alles sofort) ist einfacher konsistent, aber teuer & kann falsche Inferenzen verfrüht festschreiben. Lazy-Schlafphase erlaubt „über Nacht reifen" — Reads müssen den „noch nicht voll abgeleiteten" Zustand tolerieren (Open-World hilft).

**Invarianten-Check** — (2) ✅ lokaler Batch; (3) ✅ deterministisch bei total geordneter Replay-Reihenfolge (z. B. nach (timestamp, hash)); (8) ⚠️ Promotion darf NICHT auto-asserten → Schlaf produziert höchstens QUARANTÄNE-Kandidaten; (4) ✅ abgeleitete Tripel lokal/deterministisch reproduzierbar.

**Quellen** — Buzsáki, *Hippocampal SWR* (https://pmc.ncbi.nlm.nih.gov/articles/PMC4641767/); *Large sharp-wave ripples promote reactivation*, Neuron 2025 (https://www.cell.com/neuron/abstract/S0896-6273(25)00756-1); *Replay and Ripples in Humans*, Annu Rev Neurosci 2024 (https://www.annualreviews.org/doi/pdf/10.1146/annurev-neuro-112723-024516).

---

## 4. Sleep-dependent Abstraction / Insight: drei Transformations-Typen Episode→Semantik

**Prinzip** — Schlaf extrahiert die „Gist" aus Episoden und reduziert Details; daraus entstehen Schemata, Regeln, Insight. Walker & Stickgold („overnight alchemy"): drei Outputs — **unitized** (neue kortikale Verbindung), **assimilated** (Anbindung an bestehende Netze), **abstracted/schema** (Gemeinsamkeiten über Traces). 2025: Gist-Abstraktion teils auch sleep-unabhängig über Zeit → Treiber ist Offline-Reprozessierung, nicht zwingend Schlaf.

**Mechanismus** — In der Schlafphase (Idee 3): wiederkehrende SPO-Muster erkennen. (a) Unitize: häufiges Co-Occurrence-Paar → direkte Kante. (b) Assimilate: neues Tripel an Hub anhängen, wenn PPR-Nähe hoch. (c) Abstract: wenn k Subjekte dasselbe (Prädikat, Objekt) teilen → Kandidat-Regel `∀x: type(x,T) ⇒ p(x,O)`. Schwelle deterministisch (Support ≥ k, kein Sampling).

**NSAI-Edge-Übertragung** — Ergänzt die geplante Episode→Semantik-Promotion um drei klar getrennte Operatoren statt eines undifferenzierten „Konsolidiere". Besonders (c) ist mächtig: schlägt NEUE symbolische Regeln aus Daten vor (data-driven rule mining), die das deterministische Forward-Chaining speist. Der Hebel von „Gedächtnis" zu „Lernen".

**Alternativen & Trade-offs** — Rule-Mining ist klassisch (ILP, AMIE für KGs), passt zu Zero-Dep (Support/Confidence-Zählung). ABER kollidiert direkt mit der DRM-Falscherinnerung (Idee 9) — Übergeneralisierung erzeugt plausible Falsch-Tripel.

**Invarianten-Check** — (8) ❌→⚠️ Auto-Regel-Ableitung verletzt „Nie raten" wörtlich → Mitigation: geminte Regeln/Tripel mit source_type=`inference`, niedrigste Tier, in QUARANTÄNE, brauchen Endorsement; (6) ⚠️ Support-Zählung riecht nach „Anzahl zählt" → Support triggert nur Kandidaten-ERZEUGUNG, nie Belief-GEWICHTUNG; (3) ✅ deterministisch bei festen Schwellen. **Trotzdem hochinteressant** — das einzige Feature hier, das echte neue Strukturen erzeugt.

**Quellen** — Walker & Stickgold, *Overnight alchemy*, Nat Rev Neurosci 2010 (https://walkerlab.berkeley.edu/reprints/WalkerStickgold_NRN_2010.pdf); *Sleep Supports Slow Abstraction of Gist* (https://www.semanticscholar.org/paper/14ea40070fc86748fe5fa63aa3f6a1bd028f4ca5); *Long-Term Visual Gist Abstraction Independent of Sleep*, 2025 (https://pmc.ncbi.nlm.nih.gov/articles/PMC12856105/).

---

## 5. Reconsolidation & Prediction-Error-gated Belief-Update (statt hartem Overwrite)

**Prinzip** (Neuro) — Nader: Eine abgerufene Erinnerung wird kurzzeitig labil und muss neu gespeichert (rekonsolidiert) werden. Entscheidend: Labilisierung wird durch **prediction error** ausgelöst — nur wenn Realität von der Erinnerung abweicht, öffnet sich das Update-Fenster. Memory-Stärke/-Alter begrenzen, ob das Fenster aufgeht.

**Mechanismus** — Beim Re-Assert eines konkurrierenden Objekts: PE = Distanz(neues Objekt, aktueller Belief). Kein PE → kein Update (nur CRDT-max-Reinforcement). PE > Schwelle → „Labilisierungs-Fenster": neues Objekt darf herausfordern, ABER graduell (Konfidenz-Annäherung) statt Hard-Overwrite. Boundary: sehr alte/hoch-konfidente Beliefs brauchen größeren PE (metaplasticity).

**NSAI-Edge-Übertragung** — Verfeinert Belief-Resolution + TMS: heute „höchste Tier × Recency × Konfidenz gewinnt, Rest disputed". PE-Gating: kleine Abweichungen reinforced, große triggern Revision; die Stärke des bestehenden Beliefs ist eine Hürde gegen vorschnelles Kippen (Anti-Flapping bei wechselnden Quellen). Kognitive Begründung dafür, dass NSAI-Edge nicht hart überschreibt, sondern „disputed" markiert.

**Invarianten-Check** — (5) ✅ PE-Gating auf lokaler Belief-Linse; (3) ✅ Integer-Distanz + Integer-Schwelle; (4) ⚠️ Update muss kommutativ bleiben → PE relativ zum CRDT-konvergierten Zustand, nicht zur Ankunftsreihenfolge; (8) ✅.

**Quellen** — *Updating memories — prediction errors in reconsolidation* (https://www.sciencedirect.com/science/article/abs/pii/S0166432814006688); *An update on memory reconsolidation updating*, PMC 2017 (https://pmc.ncbi.nlm.nih.gov/articles/PMC5605913/).

---

## 6. Source-Monitoring-Framework als Konfabulations-Abwehr (Johnson)

**Prinzip** — Erinnerungen tragen KEIN eingebautes Quellen-Etikett (Johnson, Hashtroudi & Lindsay). Die Quelle wird beim Abruf aus Begleit-Merkmalen REKONSTRUIERT — Schwellen-/Pattern-Matching. Reality Monitoring = Spezialfall: wahrgenommen oder selbst gedacht/vorgestellt? Lebhafte Vorstellung kann die „real"-Schwelle überschreiten → Quellverwechslung = Falscherinnerung.

**Mechanismus** — Jeder Belief führt explizite Quell-Attribute; bei Abruf wird die Quelle NICHT vermutet, sondern aus signierten Attributen entschieden. Reality-Monitoring-Kriterium: source_type ∈ {self-generated, llm, inference} bekommt härtere Schwelle als extern-perzipierte (signiert von fremdem Origin), bevor sie als „fact" gelten.

**NSAI-Edge-Übertragung** — Kognitive Validierung für Provenienz-Modell B + den `llm`/`inference`-Tier: NSAI-Edge tut das Richtige, indem Trust am Origin (nicht am Relay) hängt — mechanisierte source attribution, die der Mensch fehleranfällig macht. Ergänzung: ein explizites `reality_monitoring`-Flag, das self-generated/LLM-Inferenz strikt von perzipierten externen Fakten trennt — Schutz gegen das KI-Pendant der Konfabulation (LLM-Output, der als „Faktum" zurückgespeichert wird). Speist den Self-Critique-Pass. **(Direkt relevant für die Lüge/Wahrheit/Fiktion-Frage — s. Dok 06.)**

**Invarianten-Check** — (5) ✅ Quell-Attribute sind signierte Wire-Werte; (8) ✅ stärkt „Nie raten"; (6) ✅; (3) ✅.

**Quellen** — Johnson, Hashtroudi & Lindsay (1993), *Source Monitoring* (https://pubmed.ncbi.nlm.nih.gov/8346328/); *Monitoring what is real*, PMC 2017 (https://pmc.ncbi.nlm.nih.gov/articles/PMC5312673/).

---

## 7. Metamemory: Feeling-of-Knowing / Judgment-of-Learning als query-Selbsteinschätzung

**Prinzip** — Menschen schätzen ihr Wissen über Heuristiken ein, OHNE den Inhalt direkt abzurufen: Feeling-of-Knowing (FOK), Judgment-of-Learning (JOL), Tip-of-the-Tongue (TOT). Basieren auf cue-familiarity/retrieval-fluency, nicht auf dem Ziel selbst — meist erstaunlich gut kalibriert.

**Mechanismus** — Bei jeder query ein deterministisches Meta-Signal NEBEN dem Treffer: (a) FOK = gewichteter Seed-Match × Graph-Konnektivität des Cues (auch ohne hochkonfidentes Ziel — „Material in der Nähe"); (b) JOL ≈ aggregierte activation/confidence; (c) TOT-Analog = „starker Cue-Match, aber Top-Objekt knapp unter Schwelle" → „frag nochmal / endorse mich".

**NSAI-Edge-Übertragung** — query()/verify() bekommen einen Metamemory-Header: nicht nur das Ergebnis, sondern eine kalibrierte Selbsteinschätzung. Hook für den Agenten: niedriges FOK → „Graph hat wenig, hol externe Quelle"; TOT → „fast da, Endorsement fehlt". Verbindet sich mit der evaluierten Meta-Kognition/Kalibrierung (Brier/ECE) als deren EINGABE-Seite.

**Invarianten-Check** — (3) ✅; (7) ✅ unterscheidet „nichts gespeichert" von „gespeichert, niedrig"; (8) ✅ quantifiziert Unsicherheit, rät nicht.

**Quellen** — Koriat, *Sources of information in metamemory* (https://link.springer.com/article/10.3758/BF03213977); *TOT and FOK Enhance Metacognitive Sensitivity*, J Cognition 2024 (https://pmc.ncbi.nlm.nih.gov/articles/PMC12047626/).

---

## 8. Retrieval-Induced Forgetting: kompetitions-getriebene Suppression statt Zeit-Decay

**Prinzip** — Das Abrufen einer Erinnerung UNTERDRÜCKT aktiv konkurrierende ähnliche (RIF) — über präfrontale inhibitorische Kontrolle. Competition-dependent (nur Konkurrenten leiden), cue-independent, adaptiv: räumt Interferenz weg, macht das Gewollte schneller abrufbar. Vergessen als Feature.

**Mechanismus** — Beim Reinforce eines „Gewinner"-Beliefs in einem Konkurrenz-Cluster (gleiches S+P): senke die lokale activation/RS der UNTERLEGENEN Objekte zusätzlich (aktive Suppression), nicht nur passiver Zeit-Decay. Cue-independent = Suppression hängt am Konkurrenten. Competition-dependent = nur bei echtem disputed-Cluster.

**NSAI-Edge-Übertragung** — Ergänzt Decay + Belief-Resolution: heute bleibt „Überstimmtes auditierbar (disputed)" passiv liegen. RIF gibt einen AKTIVEN Mechanismus, disputed-Konkurrenten im Ranking zu dämpfen, sobald der Gewinner bekräftigt wird → weniger Rausch-Treffer. Nur die LESE-Linse (activation) sinkt; signierter Wert bleibt auditierbar (Bjork-SS bleibt).

**Invarianten-Check** — (6) ✅✅ inhibitions-basiert, NICHT anzahl-basiert; (5) ✅ nur activation sinkt; (7) ⚠️ darf disputed nicht löschen (Auditierbarkeit) → nur dämpfen, cappen, nie auf 0.

**Quellen** — *Retrieval induces adaptive forgetting via cortical pattern suppression*, Nat Neurosci (https://www.nature.com/articles/nn.3973); *A retrieval-specific mechanism of adaptive forgetting*, Nat Commun 2018 (https://www.nature.com/articles/s41467-018-07128-7).

---

## 9. Fuzzy-Trace-Theory: Verbatim + Gist als ZWEI parallele Spuren — und die DRM-Warnung

**Prinzip** — Brainerd & Reyna: bei jedem Ereignis ZWEI Spuren — **verbatim** (item-spezifisch, Details) und **gist** (extrahierte Bedeutung). Wahre Erinnerungen stützen sich auf verbatim; Gist erzeugt im DRM-Paradigma FALSCHE Erinnerungen (semantisch verwandte Köder werden akzeptiert). Die Kehrseite jeder Abstraktion.

**Mechanismus** — Episoden (verbatim, vollständige signierte Tripel mit Provenienz) STRIKT getrennt von abgeleiteten Gist-Tripeln (Idee 4). Bei verify(claim): zuerst gegen verbatim — existiert ein verbatim-Beleg, gewinnt er. Gist-Treffer ohne verbatim-Stütze → „gist-only / potenzielle Konfabulation". Mechanisch ein DRM-Detektor.

**NSAI-Edge-Übertragung** — Verfeinert Episode/Semantik-Trennung zu einer Sicherheits-Architektur: Gist-Tripel sind fürs Ranking nützlich, dürfen aber in verify() nie einen verbatim-Beleg vortäuschen. Direkter Schutz gegen das Hauptrisiko von Idee 4. Speist Self-Critique: „Behaupte ich gerade etwas, das nur aus Gist stammt?" **(Zentral für Lüge/Wahrheit/Fiktion — Dok 06.)**

**Invarianten-Check** — (8) ✅ stärkt „Nie raten"; (5) ✅ beide Spuren signiert, anderer source_type; (3) ✅; (7) ✅ kein verbatim-Beleg ≠ falsch, nur „ungestützt".

**Quellen** — Brainerd & Reyna, *Fuzzy-Trace Theory and False Memory* (https://www.semanticscholar.org/paper/577b69191df294839629b00e6d88ea25dc93b07a); *False recall in DRM: gist and associative strength*, PMC (https://pmc.ncbi.nlm.nih.gov/articles/PMC3226830/).

---

## 10. Testing-Effect: Abruf als stärkster Konsolidierungs-Trigger (nicht Re-Studieren)

**Prinzip** — Aktiver ABRUF festigt Gedächtnis stärker als erneutes Anschauen (testing effect). Mechanismus: effortful elaborative retrieval — gerade der anstrengende, nicht-triviale Abruf erzeugt die robusteste Langzeitspeicherung.

**Mechanismus** — Zwei Reinforce-Kanäle: (a) re-assert/re-read derselben Quelle = schwaches Reinforcement; (b) erfolgreiche query/verify, die ein Tripel als Antwort nutzt = starkes Reinforcement (Abruf-Praxis), mit Bjork-Bonus invers zur activation. Effort-Proxy: Abrufe über mehrere PPR-Hops/Inferenz geben mehr Boost als Direkt-Treffer.

**NSAI-Edge-Übertragung** — Verfeinert das zugriffsbasierte reinforce(): nicht jeder Touch ist gleich. Erfolgreich BEANTWORTETE queries (Abruf) bekräftigen deutlich stärker als bloßes Re-Assert. Härtet den Graphen genau an den real benutzten Wissens-Pfaden.

**Invarianten-Check** — (3) ✅ Hop-Zahl/Abruf-Erfolg deterministisch; (5) ✅ reinforce lokal-additiv; (6) ✅ ein Abruf-Event, keine Quell-Anzahl. (Achtung: Effort-Proxy manipulationsresistent halten → Reinforcement-Gaming.)

**Quellen** — *Mechanisms behind the testing effect*, Front Psychol 2015 (https://www.frontiersin.org/articles/10.3389/fpsyg.2015.01054/full).

---

## 11. Zeigarnik-Effekt: prospektives Gedächtnis für offene Schleifen / unverifizierte Beliefs

**Prinzip** — Unerledigte/unterbrochene Aufgaben bleiben besser zugänglich als abgeschlossene (Zeigarnik): ein offenes Ziel hält erhöhte Aktivierung, bis es erledigt ist. Prospektives Gedächtnis = sich erinnern, ETWAS in der Zukunft zu tun.

**Mechanismus** — Markiere Tripel mit offenem Status (quarantäniert, disputed, gist-only, niedrige Konfidenz, „Endorsement ausstehend") als OPEN LOOPS mit künstlich erhöhter, NICHT-zerfallender activation — bis aufgelöst. Prospektiver Trigger: taucht beim nächsten passenden Kontext ein offener Loop auf, gibt query() proaktiv „ungeklärt — bitte verifizieren".

**NSAI-Edge-Übertragung** — „Open-Loop"-Feature über Quarantäne/TMS hinaus: statt dass unsichere Fakten passiv wegdämpfen, bleiben sie SALIENT, bis der Agent sie klärt — ein eingebauter „to-verify"-Antrieb. Bekämpft das Versanden quarantänierter Items. Mit Metamemory (Idee 7): TOT + offener Loop = stärkstes „frag-nach"-Signal.

**Invarianten-Check** — (5) ✅ activation-Linse; (7) ✅✅ kongenial zu Open-World (offener Loop = explizit „noch nicht entschieden"); (8) ✅ erzwingt Endorsement-vor-Promotion; (3) ✅.

**Quellen** — Zeigarnik (1927), *Über das Behalten erledigter und unerledigter Handlungen*; Koriat (Idee 7).

---

## 12. Spreading Activation entlang signierter Kanten als deterministischer PPR-Boost

**Prinzip** — Im semantischen Netz breitet sich Aktivierung von einem aktivierten Konzept zu assoziierten aus (Collins & Loftus; ACT-R: Aktivierung = Base-Level + Spreading aus aktuellen Buffer-Inhalten). Kürzlich genutzte Knoten „wärmen" Nachbarn vor → schnellere, kontext-sensitive Abrufe.

**Mechanismus** — Erweitere die belief-gewichtete PPR um einen kurzlebigen „Buffer": die letzten N abgefragten Knoten als zusätzliche PPR-Seeds mit zerfallendem Gewicht (= aktueller Session-Kontext). Spreading-Stärke = Kanten-Belief × Quell-Aktivierung. Deterministisch: feste Iterationszahl, Integer-Promille, totale Tie-Ordnung.

**NSAI-Edge-Übertragung** — Verfeinert das vorhandene PPR-Retrieval um KONTEXT-Sensitivität: NSAI-Edge ist faktisch bereits ein Spreading-Activation-System (PPR ist die Verallgemeinerung). Zusatz: session-lokaler Buffer, der die letzten Abfragen als Kontext-Seeds einspeist (wie ACT-R den Goal-Buffer). Macht Folge-Queries kohärenter, ohne Embeddings.

**Invarianten-Check** — (3) ✅ feste Iterationen + Integer-Gewichte + Tie-Ordnung, KEINE Embeddings; (5) ✅ Buffer ist Lese-Linse; (4) ✅ lesend; (6) ✅ belief-gewichtet. (Risiko: zu starkes Buffer-Gewicht → „Tunnelblick"/Konfirmationsbias → cappen.)

**Quellen** — Taatgen, Lebiere & Anderson, *Modeling Paradigms in ACT-R* (https://www.ai.rug.nl/~niels/publications/taatgenLebiereAnderson.pdf); Collins & Loftus (1975), *A spreading-activation theory*.

---

## Top 3 wildeste / unkonventionellste Ideen (auch invariantenbrechend)

**W1 — „Träumen": kontrolliertes Konfabulieren als Hypothesen-Generator.** Im REM-Schlaf rekombiniert das Gehirn entfernte Inhalte zu neuartigen Assoziationen — Substrat für Insight. Eine „Dream-Phase", die ABSICHTLICH ungewöhnliche Kanten zwischen schwach verbundenen Knoten zieht (low-belief, hohe Distanz) als HYPOTHESEN. Bricht (8) frontal — **trotzdem interessant**, weil es genau die unerwarteten Verbindungen findet, die Forward-Chaining nie zieht. Mitigation: Träume in separater „Hypothesen"-Sandbox mit Belief 0, nie im Faktengraphen, extern verifizieren.

**W2 — Affektives Tagging / „Emotional Salience" (Amygdala-Hub).** Emotional aufgeladene Erinnerungen werden bevorzugt konsolidiert, langsamer vergessen. Ein „Stakes"/„Surprise"-Tag (Tripel, die einen teuren Agenten-Fehler korrigierten / mit hohem PE ankamen) → langsameres Decay + Replay-Priorität. **Bricht potenziell (6)**, wenn „Wichtigkeit" mit „oft behauptet" verwechselt wird → Salience aus Konsequenz/Überraschung des EIGENEN Systems, nicht aus Quell-Anzahl. Liefert Triage: was über Nacht erhalten/repliziert wird.

**W3 — Method-of-Loci / räumliches Gedächtnis als Graph-Topologie-Layer.** Mensch merkt sich riesig, indem er Fakten an einen vertrauten RAUM heftet (Gedächtnispalast); Hippocampus nutzt place/grid cells für Gedächtnis UND Navigation. NSAI-Edge legt eine stabile „räumliche" Einbettung an (deterministisches Layout / Community-Cluster als „Räume"), an die Retrieval als Navigations-Pfad ankert. **Spannung zu (3)** → nur deterministische Verfahren (seed-fixiertes spektrales Clustering, Integer-Hash-Buckets). Embeddings-freie Organisationsmetapher für massive Graphen.

---

## Was der Mensch tut, das NSAI-Edge noch GAR NICHT versucht

1. **Aktive, kompetitions-getriebene Suppression (RIF).** NSAI-Edge vergisst nur passiv über Zeit-Decay. Der Mensch unterdrückt Konkurrenten AKTIV beim Abrufen des Gewinners (Idee 8). Komplett ungenutzt.
2. **Prediction-Error als Tor zur Veränderbarkeit (Reconsolidation).** NSAI-Edge behandelt jede Re-Assertion gleich (CRDT-max). Der Mensch macht eine Erinnerung NUR bei überraschender Abweichung labil — PE-Gating (Idee 5). Kein Überraschungs-/PE-Konzept vorhanden.
3. **Strikte Verbatim-vs-Gist-Architektur mit DRM-Bewusstsein.** Episode→Semantik geplant, aber NICHT der Schutz, dass Gist nie einen fehlenden Original-Beleg vortäuscht (Idee 9). NSAI-Edge könnte sie SAUBER trennen und Konfabulation strukturell ausschließen — was der Mensch gerade NICHT gut kann.
4. **Metamemory als ausgegebenes Signal (FOK/TOT).** NSAI-Edge gibt Konfidenz aus, aber kein „Material-in-der-Nähe-aber-kein-Treffer" / „fast sicher, Endorsement fehlt" (Idee 7/11). Kein FOK-/TOT-Kanal.
5. **Salience-getriebene selektive Konsolidierung.** Das Gehirn repliziert im Schlaf nur eine SUBMENGE (große SWRs) — es triagiert. NSAI-Edge hat keine Schlafphase und keine Triage-Heuristik, WELCHE Episoden zu Semantik promoviert werden (Idee 3/4 + W2).

---

### Querverbindung (für die Synthese)
**Idee 1+2 (zwei Achsen: confidence=storage / activation=retrieval)** = Fundament; **Idee 3 (Schlafphase)** = Batch-Träger für **4 (Abstraktion), 5 (PE-Update), 8 (RIF)**; **6+9 (Source-Monitoring + Verbatim/Gist)** = Konfabulations-Abwehr-Schicht, die Idee 4 sicher macht (und Kern für Dok 06); **7+11 (Metamemory + Open Loops)** = introspektive Ausgabe-Schicht; **10+12** verfeinern reinforce/PPR ohne Invariantenbruch. Invarianten-sicher + sofort: 1, 2, 7, 8, 10, 12. Riskant (Quarantäne/Endorsement-Gate nötig): 4, W1.
