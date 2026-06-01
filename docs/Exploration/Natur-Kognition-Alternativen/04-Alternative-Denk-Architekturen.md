# Alternative „Denk-"/Repräsentations-Architekturen (kognitiv + technisch)

> **Explorations-Rohmaterial** (Batch 2026-05-29), web-quellengestützt. **Keine CDP5-Bindung.** Determinismus-/Zero-Dep-Urteile sind bewusst scharf, weil hier die meisten Invarianten-Konflikte lauern. Zweck: Rohmaterial fürs Konzept.
>
> **Invarianten-Legende:** (1) Zero-Dep · (2) Offline · (3) Determinismus · (4) CRDT · (5) lokale Lese-Linsen · (6) „Anzahl zählt nie" · (7) Open-World · (8) „Nie raten".

---

## 1. Predictive Coding / Free Energy / Active Inference — Konfidenz = Präzision
**Prinzip.** Das Gehirn minimiert variationelle freie Energie (obere Schranke auf Surprise). Belief-Updates werden durch *Präzision* (inverse Varianz, Π = Σ⁻¹) gewichtet: ein Prediction-Error treibt den Belief umso stärker, je präziser/zuverlässiger die Beobachtung. **Konfidenz IST Präzision.**
**Mechanismus.** Gradient-Descent auf F: gewichteter Fehler ξ = Π·ε mit ε = (Beobachtung − Vorhersage); Update μ̇ ∝ Π·ε (Belief-Bewegung = Präzision × Surprise).
**NSAI-Edge-Übertragung (ergänzt + vereinheitlicht).** Heute sind Decay, Reinforcement, Belief-Resolution drei getrennte Heuristiken. Predictive Coding bietet EIN Prinzip: modelliere jedes Tripel als (Wert, Präzision). Eingehende Evidenz = Prediction-Error gegen den Graph-Belief; das Konfidenz-Update wird durch die *relative Präzision* von Prior (Graph) vs. Likelihood (Quelle) bestimmt = präzisionsgewichtete Mittelung. Bonus: verify(claim) wird natürlich zu „wie groß ist der Prediction-Error des Claims gegen den Graph" = Surprise als Falsifikations-Score.
**Determinismus-/Zero-Dep-Urteil: TEILWEISE.** Die *präzisionsgewichtete Mittelung* ist trivial integer-deterministisch: `new = (w_prior·c_prior + w_evi·c_evi) / (w_prior + w_evi)` (Integer-Promille, definierte Rundung). NEIN für die volle Active-Inference-Maschinerie (kontinuierliche generative Modelle, Laplace-Approximation, Float-Gradientenfluss). Empfehlung: nur die *Präzision-als-Gewicht*-Idee adaptieren.
**Invarianten-Check.** (3) ✅ (Integer-Mittelung) / (1) ✅ Mittelung, ❌ volle AI / (6) ❌ Präzisions-Addition = Stimmenzählung durch die Hintertür → MUSS an Autorität/Trust gekoppelt werden, nicht an Quellenanzahl / (5) ✅ Präzision als lokale Lese-Linse.
**Quellen.** Friston, *Predictive coding under the free-energy principle*, Phil Trans R Soc B 2009 ([FIL PDF](https://www.fil.ion.ucl.ac.uk/~karl/Predictive%20coding%20under%20the%20free-energy%20principle.pdf)); *Free Energy, Precision and Learning* ([PMC4235126](https://pmc.ncbi.nlm.nih.gov/articles/PMC4235126/)).

---

## 2. ACT-R Base-Level Activation — kognitiv fundierter Decay (Anderson & Schooler)
**Prinzip.** Item-Verfügbarkeit spiegelt die statistische Umweltstruktur: kürzlich/häufig Gebrauchtes wird wahrscheinlicher wieder gebraucht. Abrufwahrscheinlichkeit folgt einem *Potenzgesetz* in Recency & Frequency — rational optimal.
**Mechanismus.** `B_i = ln(Σⱼ tⱼ^(−d))`, d=0,5. Volle Aktivierung mit Spreading: `A_i = B_i + Σⱼ Wⱼ·S_ji`, mit `S_ji = S − ln(fan_j)` (Fan-Effekt). Optimierte Form: `B_i ≈ ln(n/(1−d)) − d·ln(L)`; Petrov-Hybrid: exakte Summe über k jüngste Zugriffe + geschlossene Decay-Form für den Rest.
**NSAI-Edge-Übertragung (ersetzt Decay + ergänzt Retrieval).** Ersetze das zeitbasierte Decay durch das ACT-R-Potenzgesetz (kognitiv fundiert, monoton; optimierte Form braucht nur (n, L, t_letzter) pro Tripel — speicherarm). Spreading Activation = belief-gewichtete Nachbarschaftsausbreitung (≈ vorhandenes PPR), aber ACT-R liefert die *Fan-Dämpfung* (S − ln(fan)): ein Knoten mit vielen Kanten verteilt weniger Aktivierung pro Kante — elegante, prinzipientreue Anti-Hub-Heuristik.
**Determinismus-/Zero-Dep-Urteil: JA (mit Fixed-Point-ln).** ln/Potenz via Fixed-Point-Log über Integer-Mathe (LUT/CORDIC), byte-identisch. Da NSAI-Edge bereits eine softmax-/exp-haltige Belief-Resolution deterministisch fährt, existiert die Infrastruktur für deterministische transzendente Funktionen wahrscheinlich schon. `tⱼ^(−0,5)=1/√tⱼ` integer-approximierbar (Newton, fixe Rundenzahl).
**Invarianten-Check.** (3) ✅ / (1) ✅ / (6) ✅ Frequency ist Recency-Statistik DESSELBEN Tripels, kein Quellen-Voting / (4) ⚠️ k + d MÜSSEN Wire-Konstanten sein (sonst Föderations-Divergenz → greift das Konstanten-Konsistenz-Gate).
**Quellen.** Anderson & Schooler 1991; Petrov, *Computationally Efficient Approximation of Base-Level Learning* ([ICCM06 PDF](http://alexpetrov.com/pub/iccm06/PetrovICCM06.pdf)); [Springer CBB 2018](https://link.springer.com/article/10.1007/s42113-018-0015-3).

---

## 3. Drift-Diffusion / Evidence Accumulation to Bound (Ratcliff)
**Prinzip.** Entscheidung = Akkumulation verrauschter Evidenz bis zu einer Schwelle. Schwellenabstand steuert Speed-Accuracy-Tradeoff.
**Mechanismus.** dx = v·dt + s·dW (Wiener-Rauschen); Grenzen 0/a; Entscheidung = First-Passage. Der Within-Trial-Prozess ist *stochastisch*.
**NSAI-Edge-Übertragung (ergänzt Belief-/Quorum-Auflösung).** Statt Softmax-Snapshot: akkumuliere Evidenz über Zeit — jedes bestätigende Tripel = ein Inkrement Richtung „decided", widersprechende Richtung Gegen-Grenze. Erst wenn |Evidenz| Schwelle a überschreitet, gilt ein Claim als *decided*; sonst *contested*. Gibt NSAI-Edge eine natürliche „Reife"-Semantik (jung/kontrovers vs. etabliert) und einen prinzipiellen Quorum-Schwellwert.
**Determinismus-/Zero-Dep-Urteil: TEILWEISE — Kern stochastisch.** Die Wiener-Diffusion (dW) ist Zufall = Determinismus-Bruch. ABER man braucht das Rauschen NICHT: das deterministische Skelett — „akkumuliere Integer-Evidenz-Inkremente bis Schwelle a" — ist ein reiner Integer-Akkumulator. Übernimm die *Bound-Crossing-Logik*, nicht den Diffusionsprozess.
**Invarianten-Check.** (3) ✅ (ohne dW) / ❌ (echte DDM) / (6) ⚠️ Inkremente müssen trust-gewichtet + gesättigt (sonst Quellen-Zählen) / (5) ⚠️ Akkumulator-Zustand persistiert → bricht „reine Lese-Linse über reinem Wire-Wert", müsste föderiert werden.
**Quellen.** Ratcliff & McKoon, *Diffusion Decision Model* ([PMC4928591](https://pmc.ncbi.nlm.nih.gov/articles/PMC4928591/)).

---

## 4. Conceptual Spaces (Gärdenfors) — geometrische Ähnlichkeit OHNE ML-Embeddings
**Prinzip.** Konzepte = *konvexe Regionen* in Qualitätsdimensionen; Ähnlichkeit = Distanz; Kategorisierung = Voronoi-Tessellation um Prototypen. Geometrie der Bedeutung ohne gelernte Vektoren.
**NSAI-Edge-Übertragung (ergänzt — Embedding-Ersatz für numerische Domänen).** Für *quantitative* Prädikate (Temperatur, Preis, Datum, Alter): Ähnlichkeit/Konsistenz geometrisch-deterministisch prüfen statt nur lexikalisch („38 °C" nah an „Fieber"-Region). verify() bekommt eine *graduelle* Konsistenzprüfung für numerische Slots; Widerspruch = „Wert außerhalb der konvexen Region". Der Embedding-Nutzen für den Teilraum, wo Dimensionen *interpretierbar und schema-vorgegeben* sind — ohne ML.
**Determinismus-/Zero-Dep-Urteil: JA (für vorgegebene Dimensionen).** Punkte/Boxen/Konvexität/Distanz = Integer-Geometrie (Manhattan/Chebyshev exakt). Der harte Teil: woher kommen die Dimensionen? → aus dem *Schema* deklarieren. Automatisches Dimensions-Lernen (MDS) wäre Float/iterativ → NEIN.
**Invarianten-Check.** (3) ✅ / (1) ✅ / (7) ✅ / (8) ✅ (Distanz ist exakt) / ⚠️ nur deklarierte Dimensionen.
**Quellen.** Gärdenfors, *Conceptual Spaces: The Geometry of Thought* (MIT 2000); [Wikipedia](https://en.wikipedia.org/wiki/Conceptual_space).

---

## 5. Vector Symbolic Architectures / Hyperdimensional Computing (Kanerva MAP, Plate HRR) — DER starke Kandidat
**Prinzip.** Symbole als hochdim. (~10.000-dim) Zufallsvektoren; in so hohen Dimensionen sind Zufallsvektoren quasi-orthogonal (Toleranz ~30 % Bit-Korruption). Drei algebraische Operationen erzeugen kompositionelle Struktur.
**Mechanismus.** **Binding** ⊗ (Rolle-Füller): MAP = elementweise Multiplikation bipolarer ±1-Vektoren (*selbst-invers*); BSC = XOR (auch selbst-invers); HRR = zirkuläre Faltung (reell). **Bundling** ⊕ (Superposition/Menge): elementweise Addition + Schwellung (Majority bei binär). **Permutation** ρ: zyklischer Shift. Ähnlichkeit = Hamming (binär) / Dot (bipolar). Cleanup über Item-Memory-Codebook.
**NSAI-Edge-Übertragung (neu — deterministische, ML-freie „Embedding"-Schicht).** **Der wichtigste Kandidat.** Kodiere jedes Tripel holographisch: `T = (S⊗rolleS) ⊕ (P⊗rolleP) ⊕ (O⊗rolleO)`. Atomare Vektoren *deterministisch aus dem Term-String geseedet* (SHA-256(term) → Bit-Expansion → bipolar). Ergebnis: (a) inhaltsadressierbares, tippfehler-robustes Retrieval (Teil-Query → Cleanup); (b) kompositionelle Analogie/Substitution via Unbinding (`T⊗rolleO⁻¹ ≈ O` → „was ist das Objekt?"); (c) eine *similarity*-Schicht als Embedding-Ersatz — OHNE die zurückgestellten ML-Embeddings, OHNE Determinismus-Bruch.
**Determinismus-/Zero-Dep-Urteil: JA — der seltene Volltreffer.** Atomare Vektoren via SHA-256-Seed (`node:crypto` ist bereits im Kern!) → byte-identisch. Binding (XOR/±1-Multiply), Bundling (Integer-Add + Sign), Permutation (Shift), Hamming (popcount) — alles Integer, kein Float (binäres BSC/MAP, NICHT reelles HRR). 10.000 Bit = 1,25 KB/Vektor. Föderation: gleicher Term aus gleichem Seed → identischer Vektor → CRDT-konvergent. Cleanup-Schwellen müssen Wire-Konstanten sein.
**Invarianten-Check.** (3) ✅ / (1) ✅ / (2) ✅ / (4) ✅ / (6) ✅ Similarity ≠ Konfidenz / (7) ✅. **Sauberster Invarianten-Score aller acht.** (Risiko: Bundling-Kapazität begrenzt → Crosstalk; Kapazitäts-Governor nötig; Similarity nie in den signierten Konfidenz-Wert.)
**Quellen.** Kanerva, *Hyperdimensional Computing: An Introduction*, Cogn Comput 2009 ([Springer](https://link.springer.com/article/10.1007/s12559-009-9009-8)); Kleyko et al., *Survey on HDC/VSA Part I* ([ACM CSUR 2022](https://dl.acm.org/doi/10.1145/3538531)); [hd-computing.com](https://www.hd-computing.com/).

---

## 6. Sparse Distributed Memory (Kanerva) & moderne Hopfield-Netze — inhaltsadressierbares Recall
**Prinzip.** Speicher über *Inhalt* statt Adresse, Vervollständigung aus Teil-Cues. SDM: spärliche „harte" Adressen, Schreiben/Lesen in einer Hamming-Kugel um die Query. Moderne Hopfield: Single-Shot-Assoziativspeicher, exponentielle Kapazität.
**Mechanismus (Universal-Hopfield).** Retrieval = `z = P·sep(sim(M,q))`. SDM: Hamming + Threshold + Mehrheits-Counter. Modern: Softmax-Separation. Klassisch: Dot + Identität.
**NSAI-Edge-Übertragung (ergänzt Retrieval — robustes Recall).** Komplementär zu #5: VSA liefert die Vektoren, SDM/Hopfield den Speicher-/Vervollständigungs-Mechanismus. Verrauschte/unvollständige Query (Tippfehler, fehlendes Objekt) wird auf das nächste gespeicherte Tripel gezogen (Cleanup) → robusteres lexikalisches Seeding ohne Stemming-Heuristiken.
**Determinismus-/Zero-Dep-Urteil: JA (SDM/klassisch) / TEILWEISE (modern).** SDM: Hamming (popcount) + Integer-Counter + Threshold = vollständig Integer-deterministisch. Klassisch Hopfield mit Integer-Gewichten + fixer Update-Reihenfolge ebenfalls. Modern (Softmax über Float-Dot) → nur über die vorhandene Fixed-Point-Softmax. **Empfehlung: SDM-Variante**, passt zu binärem VSA.
**Invarianten-Check.** (3) ✅ (SDM/klassisch, fixe Reihenfolge) / ⚠️ (modern) / (1) ✅ / (8) ✅ Cleanup = exaktes argmin / (4) ⚠️ Radius Wire-fix.
**Quellen.** Kanerva, *Sparse Distributed Memory* (MIT 1988); *Universal Hopfield Networks* ([PMC7614148](https://pmc.ncbi.nlm.nih.gov/articles/PMC7614148/)); Ramsauer et al., *Hopfield Networks is All You Need* (2020).

---

## 7. Possibility Theory / Fuzzy / MLN / PSL — alternative Unsicherheits-Kalküle
**Prinzip.** Andere Algebren als die Softmax-Belief: *Possibility Theory* trennt Möglichkeit (Π) von Notwendigkeit (N) — natürlich für Open-World/Ignoranz. Fuzzy: Wahrheit ∈ [0,1] mit t-Normen. MLN/PSL: gewichtete First-Order-Formeln → Verteilung über mögliche Welten.
**Mechanismus.** Łukasiewicz-t-Norm: T(a,b)=max(0, a+b−1); Possibility: N(A)=1−Π(¬A), Open-World-tauglich (Π(A)+Π(¬A) ≥ 1, Ignoranz erlaubt). MLN P(welt) ∝ exp(Σ wᵢ·nᵢ).
**NSAI-Edge-Übertragung (ergänzt — Inferenz-Konfluenz).** Beim Forward-Chaining müssen Konfidenzen *kombiniert* werden. **Łukasiewicz-t-Norm** ist ideal: `max(0, a+b−1000)` auf Promille — exakt integer, konservativer als Multiplikation (keine künstliche Sicherheit). Das Possibility/Necessity-Paar passt zu Open-World + „Nie raten": Necessity = belegte Untergrenze, Possibility = nicht-ausgeschlossene Obergrenze → erweitert Konfidenz von einem Punkt zu einem *Intervall* [N, Π] (ehrlichere Ignoranz). **Bezug zu Dok 06: Possibility/Necessity ist eine natürliche Repräsentation für „behauptet aber unbelegt" vs. „belegt".**
**Determinismus-/Zero-Dep-Urteil: JA (Fuzzy/Possibility) / NEIN (volle MLN/PSL-Inferenz: MCMC/konvexe Optimierung, stochastisch-float).** Nur die *t-Norm-Kombination* + ggf. *Intervall-Konfidenz* übernehmen, nicht den Lerner.
**Invarianten-Check.** (3) ✅ (t-Norm/Possibility) / ❌ (MLN-MCMC) / (1) ✅ / (7) ✅ (Possibility ist dafür gebaut) / (5) ⚠️ Intervall [N,Π] nur als Lese-Linse über DEM EINEN signierten Wert — sonst derselbe Wire-Bruch wie Subjective Logic (bereits abgelehnt!).
**Quellen.** *On the Semantic Relationship between PSL and Markov Logic* ([arXiv:1606.08896](https://arxiv.org/pdf/1606.08896)); *Encoding MLNs in Possibilistic Logic* ([arXiv:1506.01432](https://arxiv.org/pdf/1506.01432)).

---

## 8. Bayesian Knowledge Tracing / Beta-Dirichlet-Reputation / Kalman — Konfidenz-Tracking über Zeit
**Prinzip.** Verfolge eine latente „Mastery"/Vertrauens-Wahrscheinlichkeit über verrauschte Beobachtungen mit Bayes-Updates (BKT), Beta/Dirichlet-Zählung (Reputation) oder Kalman-Filter.
**Mechanismus (BKT).** Vier Parameter P(L₀), P(T), P(G uess), P(S lip). Posterior nach korrekt: `P(L|c)=P(L)(1−S) / [P(L)(1−S)+(1−P(L))G]`. Lern-Transition `P(L')=P(L|obs)+(1−P(L|obs))·P(T)`. Beta-Reputation: Belief aus (α=Erfolge+1, β=Misserfolge+1); Erwartung α/(α+β) ∈ [0,1]. Kalman-Gain `K=P⁻/(P⁻+R)` (gewichtet Messung gegen Prior nach Varianz — eng verwandt mit #1 Präzision).
**NSAI-Edge-Übertragung (ergänzt — Quellen-Trust-Tracking & Reinforcement).** BKT ist ein direktes Modell für *Trust einer signierenden Quelle*: jede bestätigte/falsifizierte Aussage = eine „Beobachtung" mit eingebautem Guess/Slip (eine korrekte könnte Glück sein, eine falsche ein Ausrutscher). Beta-Reputation = simpelste integer-nahe Variante für die Trust-Linse, die NSAI-Edge schon hat. Kalman = prinzipielles Konfidenz-Tracking einzelner Tripel (Decay = Varianz wächst; Reinforcement = Messung mit kleinem R).
**Determinismus-/Zero-Dep-Urteil: TEILWEISE → JA mit Fixed-Point.** Alle BKT-Formeln sind Brüche → Integer-Promille mit fixer Rundung. Beta-Reputation ist NATÜRLICH integer (α, β sind Counts). Kalman: Gain integer-approximierbar, Varianz-Propagation braucht sorgfältige Fixed-Point-Spec.
**Invarianten-Check.** (3) ✅ / (1) ✅ / (6) ⚠️ Zählen nur für Trust EINER Quelle über DEREN Historie legitim, NICHT für Quellen-Voting / (5) ✅ Trust ist bereits lokale Linse / (4) ⚠️ Parameter Wire-fix.
**Quellen.** [Bayesian Knowledge Tracing (Wikipedia)](https://en.wikipedia.org/wiki/Bayesian_Knowledge_Tracing); Jøsang, Beta Reputation; *Improving Trust Estimation with Beta Reputation* ([arXiv:2411.01866](https://arxiv.org/pdf/2411.01866)).

---

## Top 3 wildeste Ideen
1. **Holographische Tripel-Kodierung (VSA/MAP, #5) mit SHA-256-geseedeten bipolaren Vektoren + SDM-Cleanup (#6).** Eine *deterministische, zero-dep, integer-only* „Embedding"-Schicht — genau das, wofür Vektor-Embeddings zurückgestellt wurden — CRDT-konvergent, weil gleicher Term aus gleichem Seed knotenübergreifend denselben Vektor erzeugt. Der seltene Fall, der *alle* harten Invarianten besteht.
2. **Evidence-Accumulation-to-Bound als Reife-Semantik (#3, deterministisches Skelett ohne Rauschen).** Claims haben einen Integer-Evidenz-Stand, der trust-gewichtet bis zu einer Schwelle akkumuliert — „contested → decided" wird ein erklärbarer Zustandsübergang statt Snapshot-Softmax.
3. **Possibility/Necessity-Intervall-Konfidenz [N, Π] (#7).** Statt eines Punkt-Promille ein Integer-Intervall: Necessity = belegte Untergrenze, Possibility = nicht-ausgeschlossene Obergrenze — macht Open-World + „Nie raten" *im Konfidenz-Typ selbst* sichtbar (nur Lese-Linse, sonst Wire-Bruch).

## Welche EINE alternative Architektur würde am meisten ändern — und lohnt es sich?
**Vector Symbolic Architectures / Hyperdimensional Computing (#5).** Es würde am meisten ändern, weil es eine *komplett neue Repräsentationsschicht* neben das Tripel stellt (holographische Vektor-Signatur, similarity-/Cleanup-Stufe, Analogie via Unbinding) — Fähigkeiten, die der lexikalisch+PPR+BM25-Stack strukturell nicht hat. **Und es lohnt sich ungewöhnlich klar JA**, weil VSA als einziger der acht *alle* harten Invarianten gleichzeitig besteht (Determinismus via Integer+SHA-Seed über das vorhandene `node:crypto`, Zero-Dep, Offline, CRDT-Konvergenz, „Anzahl zählt nie"). Die zurückgestellten Vektor-Embeddings wurden genau wegen Determinismus/Zero-Dep abgelehnt — VSA löst beide Blocker. Hauptrisiko: Bundling-Kapazitätsgrenzen (Crosstalk) + Pflicht, alle Schwellen/Dimensionen als Wire-Konstanten zu fixieren.

> *Anmerkung des Agenten:* Mehrere Original-PDFs (Friston FIL 2009, Kanerva Redwood 2022, ACT-R-CMU) waren gescannt/binär; Formeln über parseable Sekundärquellen verifiziert (mehrfach quergeprüft).
