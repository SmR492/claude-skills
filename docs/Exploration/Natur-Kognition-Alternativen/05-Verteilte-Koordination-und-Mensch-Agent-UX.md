# Verteilte Koordination, Wissens-Verbreitung & Mensch↔Agent-Gedächtnis-UX

> **Explorations-Rohmaterial** (Batch 2026-05-29), web-quellengestützt. **Keine CDP5-Bindung.** Strang B (Mensch↔Agent-UX) bekommt bewusst Übergewicht — dort liegen die im Konzept unterbelichteten Lücken. Zweck: Rohmaterial fürs Konzept.
>
> **Invarianten-Legende:** (1) Zero-Dep · (2) Offline · (3) Determinismus · (4) CRDT · (5) lokale Lese-Linsen · (6) „Anzahl zählt nie" · (7) Open-World · (8) „Nie raten".

---

## STRANG A — Wie sich Wissen in Systemen verbreitet & koordiniert

### A1 — Merkle-Search-Tree als Anti-Entropy-Primitiv (statt naiver Voll-State-Diff)
**Prinzip.** Ein Merkle-Search-Tree (MST) ist ein deterministisch balancierter, durchsuchbarer Baum, dessen Knoten per Inhalts-Hash adressiert sind. Zwei Replikate ermitteln in O(log n)-Roundtrips, *welche* Tripel divergieren (gleicher Teilbaum-Hash ⇒ identisch ⇒ überspringen). Auvolat & Taïani: ein MST über CRDT-Werten ist selbst ein State-based CRDT.
**NSAI-Edge-Übertragung (ergänzt Pull/Push + Vector-Clock).** MST-Index über die Tripel (Schlüssel = kanonischer S–P–O-Hash) ersetzt naiven Diff durch logarithmisches „Was fehlt dir?". Der **Wurzel-Hash wird zum 1-Wort-Gesundheits-Fingerprint** („sind A und B im selben Zustand? ein Hash-Vergleich"). Spielt mit RFC-8785-Canonicalization zusammen.
**Invarianten-Check.** ✅ alle — explizit zero-dep, deterministisch, CRDT-konvergent. Reiner Gewinn ggü. naivem Diff. (Trade-off: Baum-Wartung kostet CPU/Speicher; bei winzigen Graphen Overkill.)
**Quellen.** [Merkle Search Trees (Auvolat & Taïani, SRDS 2019)](https://inria.hal.science/hal-02303490)

### A2 — δ-CRDTs: nur Delta-Mutationen joinen statt Voll-State
**Prinzip.** δ-CRDTs definieren δ-Mutatoren, die nur ein kleines Delta-Fragment zurückgeben (Op-Based-Effizienz mit State-Based-Robustheit).
**NSAI-Edge-Übertragung (ergänzt CRDT-Merge).** Statt beim Push den ganzen Store zu serialisieren: nur seit-letzter-Sync neue/veränderte Tripel als Delta-Set. Achtung: zwei veränderliche Achsen — Tripel-Menge (gut δ-fähig) und Konfidenz-Decay (häufige kleine Änderungen). Decay rein lokal-deterministisch halten (Funktion von t, nicht propagiert) → vermeidet Delta-Flut.
**Invarianten-Check.** ✅ Konvergenz/Determinismus erhalten; ⚠️ nur falls Decay als propagierter State statt lokaler Lese-Linse modelliert ist (Analogie zu Invariante 5).
**Quellen.** [Efficient State-based CRDTs by Delta-Mutation (arXiv:1410.2803)](https://arxiv.org/abs/1410.2803)

### A3 — Equivocation-tolerante / hash-graph-verkettete CRDTs (BFT ohne Quorum)
**Prinzip.** Kleppmann: bestehende CRDTs lassen sich byzantinisch-fehlertolerant machen — bei **beliebig vielen** Byzantinischen Knoten (Sybil-immun) — indem jede Operation ihren kausalen Vorgänger per Hash referenziert (Hash-Graph statt Vektor-Uhr); Equivocation (zwei widersprüchliche signierte Ops mit gleichem Vorgänger) wird kryptographisch erkennbar.
**NSAI-Edge-Übertragung (ergänzt Vector-Clock + signierte Tripel).** Tripel sind bereits signiert. Ersetze/ergänze die Vector-Clock durch einen **Git-artigen Hash-DAG**: jedes Tripel referenziert Hash(es) seiner Vorgänger ⇒ (a) manipulationssicherer Kausal-Verlauf, (b) automatische Equivocation-Erkennung („Knoten X signierte zwei widersprüchliche Versionen" → Quarantäne), (c) MST (A1) wird natürlicher Anti-Entropy-Layer. Sehr nah an git-artiger P2P-Sync.
**Invarianten-Check.** ✅ Zero-Dep (Hash + Signatur vorhanden), Determinismus, Konvergenz, Open-World, **Anzahl-zählt-nie (Sybil-immun!)**; ⚠️ Offline: Equivocation-Detektion braucht *irgendwann* Begegnung der divergierenden Ketten. (Trade-off: Hash-DAG schwerer als Vector-Clock; Historie-Pruning nicht-trivial — kollidiert mit Forgetting-by-Design B3.)
**Quellen.** [Making CRDTs Byzantine Fault Tolerant (Kleppmann, PaPoC 2022)](https://martin.kleppmann.com/2022/04/05/bft-crdt-papoc.html) · [On CRDTs and Equivocation (arXiv:2109.10554)](https://arxiv.org/abs/2109.10554)

### A4 — Epidemic Anti-Entropy + Rumor-Mongering als zweistufige Föderations-Verbreitung
**Prinzip.** Demers et al.: **Rumor-Mongering** (SIR-Epidemie: neue Tripel aggressiv an zufällige Peers pushen; Interesse erlischt, wenn nur noch „schon-bekannt" → „removed") verbreitet schnell mit wenig Traffic; **Anti-Entropy** (paarweiser Voll-Abgleich, A1/A2) läuft selten und garantiert Konvergenz mit W'keit 1.
**NSAI-Edge-Übertragung (ergänzt Pull/Push).** Epidemisches Overlay macht Föderation *selbst-organisierend*: neue Hochkonfidenz-Tripel „infizieren" das Netz in O(log N) Runden ohne manuelles Sync; A1-Merkle-Anti-Entropy schließt periodisch Lücken. SIR-„removed"-Zustand = natürliche Backoff-Regel gegen Gossip-Sturm.
**Invarianten-Check.** ⚠️ Determinismus: Verbreitungs-*Pfad/Timing* probabilistisch, das Konvergenz-*Ergebnis* deterministisch (CRDT) — FLAGGEN: Gossip-Timing braucht Seed/Logging für Reproduzierbarkeit; ✅ Offline, ✅ Konvergenz.
**Quellen.** [Gossip and Epidemic Protocols (Montresor)](http://disi.unitn.it/~montreso/ds/papers/montresor17.pdf)

### A5 — Misinfo-Eindämmung im Föderations-Layer: SIR-Inokulation & Belief-Quarantäne-Gossip
**Prinzip.** Falschwissen verbreitet sich epidemisch wie wahres. Aus der Epidemiologie: **Inokulation** (Gegen-Signal „immunisiert" Knoten) + selektives Removal. Hier will man Verbreitung *bremsen*, nicht beschleunigen.
**NSAI-Edge-Übertragung (ergänzt Quarantäne + verify()).** Mach Quarantäne **föderiert-propagierbar**: erkennt Knoten A per verify()/Self-Critique einen widerlegten Fakt, gossipt er ein signiertes „Refutation"-Tripel (monoton/Tombstone-artig), das empfangende Knoten „immunisiert". Wegen Invariante 6: die Refutation überzeugt nicht durch *Menge*, sondern durch *Provenienz/Beweis* (Verweis auf widersprechende Hochkonfidenz-Quelle).
**Invarianten-Check.** ⚠️ Invariante 6: Eindämmung darf nicht zu Mehrheits-Wahrheit degenerieren — Refutation evidenz-, nicht anzahl-getragen; ✅ Open-World (Refutation = neue Information); ✅ Zero-Dep. (Risiko: Zensur-via-falsche-Refutation → signiert, begründet, selbst anfechtbar halten.)
**Quellen.** [Epidemic Algorithms for Replicated Database Maintenance (Demers et al.)](https://swift.sites.cs.wisc.edu/classes/cs739-sp11/blog/2011/02/epidemic_algorithms_for_replic.html)

### A6 — Diversity-Prediction-Theorem & Bounded-Confidence als Echo-Kammer-Wächter
**Prinzip.** Scott Pages Diversity-Prediction-Theorem: *kollektiver Fehler = mittlerer Einzelfehler − Vorhersage-Diversität*. Genauigkeit hängt nicht von *Menge*, sondern *Unabhängigkeit/Diversität* ab. Bounded-Confidence (Hegselmann-Krause/Deffuant): wenn nur noch nahe Meinungen akzeptiert werden, kollabiert Diversität → Echo-Kammer, Konsens dann *wertlos*.
**NSAI-Edge-Übertragung (ergänzt Multi-Source-Corroboration + MeritRank/EigenTrust).** Multi-Source-Corroboration zählt heute *bestätigende Quellen* — gefährlich, wenn die nicht unabhängig sind (zwei Peers, die voneinander abschrieben = eine Quelle). **Provenienz-Diversitäts-Metrik**: Korroboration zählt nur *unabhängige Wurzeln* im A3-Hash-DAG (gemeinsamer Vorfahr ⇒ eine Quelle). **Das ist die präzise mathematische Form von Invariante 6 „Anzahl zählt nie".** Plus **Echo-Kammer-Warnsignal**: geht die Provenienz-Diversität eines hochkonfidenten Clusters gegen 0 → downgrade + Flag an den Menschen („hohe Übereinstimmung, niedrige Unabhängigkeit").
**Invarianten-Check.** ✅ Stützt Invariante 6 *direkt* (formaler Unterbau!); ✅ Determinismus (DAG-Vorfahren-Analyse); ✅ lokale Lese-Linse.
**Quellen.** [Diversity prediction theorem](https://rosettacode.org/wiki/Diversity_prediction_theorem) · [Bounded confidence opinion dynamics: survey (Automatica 2024)](https://www.sciencedirect.com/science/article/pii/S0005109823004661)

### A7 — Stigmergie: der Graph als geteilte Umwelt statt direkter Knoten-Kommunikation
**Prinzip.** Heylighen: Stigmergie = Koordination *durch die Umwelt* (Spuren regen andere zur Weiterarbeit an). Wikis/GitHub/PageRank/Folksonomien sind menschliche Stigmergie.
**NSAI-Edge-Übertragung (Framing + Feature: stigmergische Annotations-Tripel).** Reframe: der föderierte Graph *ist* das stigmergische Medium für mehrere Claude-Instanzen/Menschen. Feature: **„Spur"-Tripel** — niedrig-konfidente Marker („dieser Teilgraph wirkt veraltet", „hier fehlt Korroboration", „hier war ich zuletzt aktiv"), die andere Sessions zur Weiterarbeit anregen (Active-Learning-Review wird stigmergisch verteilt).
**Invarianten-Check.** ✅ passt nativ zu CRDT (add-only), Offline, Open-World; ⚠️ Spur-Tripel dürfen Belief-Resolution nicht verschmutzen → eigener Namespace/Prädikat-Klasse, getrennt von Sachwissen; müssen verfallen (Decay).
**Quellen.** [Stigmergy as a Universal Coordination Mechanism (Heylighen)](https://www.researchgate.net/publication/279058749)

---

## STRANG B — Mensch↔Agent-Gedächtnis-Interaktion & UX (Schwerpunkt)

### B1 — Transactive Memory System (TMS): explizites „Wer-weiß-Was" Claude↔Graph
**Prinzip.** Wegner (1985): in Paaren/Teams entsteht ein geteiltes Gedächtnis aus (a) Individualwissen + (b) **Metamemory** — wer was weiß. „Ich muss es nicht wissen, ich weiß, wer/wo es weiß." Aktuelle Forschung: Mensch-KI-Dyaden als „co-memorising dyad".
**NSAI-Edge-Übertragung (neu: Metamemory-Layer / Zuständigkeits-Routing).** Heute undifferenzierter Speicher. Ein TMS-Layer macht Arbeitsteilung explizit: ein **Domänen-/Zuständigkeits-Index** („Knoten X = Autorität für Projekt Y") + eine **Routing-Heuristik**, die Claude sagt, *welchen Teilgraphen/Knoten* er abfragen soll, statt global. Brücke zwischen „query-first" und Effizienz: Claude muss nicht alles wissen, sondern *wo* es liegt. In Föderation = MST-Wurzeln (A1) pro Domäne als „Experten-Adressen".
**Invarianten-Check.** ✅ alle (Directory sind selbst Tripel); ⚠️ Open-World: „Knoten X kennt Y nicht" ist kein Faktum → Routing darf nicht „Y existiert nicht" schließen (Invariante 8). (TMS-Fehlerfall: das „Wer-weiß-Was" veraltet → Drift-Monitor sollte *auch* das Metamemory überwachen.)
**Quellen.** [Transactive memory (Wikipedia)](https://en.wikipedia.org/wiki/Transactive_memory) · [Group mind of hybrid human-agent teams (2025)](https://journals.sagepub.com/doi/10.1177/02683962241296883)

### B2 — Google-Effekt / Cognitive-Offloading-Kalibrierung: wann query-first schadet
**Prinzip.** Sparrow, Liu & Wegner (2011): wer erwartet, Information später abrufen zu können, merkt sich *den Inhalt schlechter*, dafür *den Ort besser* („digitale Amnesie"). Offloading senkt Last, erzeugt Abhängigkeit + Atrophie. Meta-Analyse 2024 bestätigt.
**NSAI-Edge-Übertragung (Policy-Design für query-first).** Naives „*immer* query-first" ist genau der Google-Effekt — Claude lagert alles aus und übernimmt jede Graph-Halluzination ungeprüft. **Offloading-Kalibrierung**: query-first *gezielt* bei (a) niedriger interner Konfidenz, (b) faktischen/projekt-spezifischen Claims, (c) driftendem Wissen; *nicht* bei stabilem Allgemeinwissen. Spiegelbild: der Graph sollte signalisieren, *wie verlässlich* sein Abruf ist (B5), damit Claude weiß, wie sehr er sich verlassen darf.
**Invarianten-Check.** ✅ keine Invariante berührt (Nutzungs-Policy); ⚠️ berührt Invariante 8 positiv (weniger blindes Übernehmen = weniger Raten-durch-Proxy).
**Quellen.** [Google effects on memory: meta-analytical review (Front Public Health 2024)](https://www.frontiersin.org/journals/public-health/articles/10.3389/fpubh.2024.1332030/full)

### B3 — Forgetting-by-Design: nachvollziehbares, auditierbares Vergessen im CRDT
**Prinzip.** Vergessen muss intentionale, rechenschaftspflichtige Design-Praxis sein (GDPR, Privacy, Hygiene). In einem add-only CRDT ist „echtes Löschen" hart.
**NSAI-Edge-Übertragung (neu: Tombstone-Tripel + Krypto-Shredding + Vergessens-Audit).** (1) **Tombstone als CRDT-Tripel** — Löschung ist selbst signiertes, konvergentes Wissen („Tripel T widerrufen am … von …, Grund: …"), via A5-Gossip propagiert; nie still verschwinden. (2) **Krypto-Shredding für PII** — sensible Tripel verschlüsselt, Vergessen = Schlüssel löschen (löst das „im DAG unlöschbar"-Problem von A3 ohne Hash-Bruch). (3) **Vergessens-Audit-Log** — *warum* etwas vergessen wurde bleibt prüfbar. Bezug zur `pii-scan`-Skill: PII-Funde → Krypto-Shredding-Kandidaten.
**Invarianten-Check.** ✅ Konvergenz (Tombstones = kanonische CRDT-Löschung); ⚠️ Krypto-Shredding braucht Crypto-Primitiv — `node:crypto` eingebaut (kein npm), also ✅ aber FLAGGEN; ✅ Open-World (Tombstone = „widerrufen", nicht „existierte nie"). (Tombstones akkumulieren → GC mit Stabilitäts-Schwelle.)
**Quellen.** [Memory Undone (arXiv:2602.21180)](https://arxiv.org/pdf/2602.21180) · [Forget via Key Deletion (arXiv:2603.15033)](https://arxiv.org/pdf/2603.15033)

### B4 — FSRS/Spaced-Repetition als Decay-Modell *und* proaktives Review-Pattern
**Prinzip.** FSRS (Anki-Default seit 23.10) modelliert Vergessen mit **Difficulty, Stability, Retrievability** (DSR), sagt voraus, *wann* ein Item vergessen wird, um genau davor zu reviewen. 20–30 % weniger Reviews bei gleicher Retention vs. SM-2.
**NSAI-Edge-Übertragung (ersetzt naives Decay + proaktives Review).** Das **DSR-Modell ist ein fundierter Ersatz**: Salienz = Retrievability(Stability, t); jede Korroboration/Nutzung erhöht *Stability* (nicht nur additiv die Konfidenz) — erklärt sauber, *warum* oft-bestätigtes Wissen langsamer zerfällt. UX-Hälfte: der Graph schlägt proaktiv „review-fällige" Tripel vor (Retrievability unter Schwelle + hohe Wichtigkeit) → priorisiert Active Learning *vergessenskurven-optimiert* statt nur nach Unsicherheit.
**Invarianten-Check.** ✅ Determinismus (DSR = geschlossene Formel — *wenn* Optimizer-Parameter fixiert/versioniert; ML-Optimizer selbst reproduzierbar geseedet → ⚠️ FLAGGEN); ✅ Zero-Dep; ✅ lokale Lese-Linse.
**Quellen.** [The fundamental of FSRS (DSR-Modell)](https://github.com/open-spaced-repetition/fsrs4anki/wiki/The-fundamental-of-FSRS/8c793cefb3ec361cd6fa6ab8f750e31c3da57e8e)

### B5 — Vertrauenskalibrierung: Unsicherheit kategorisch (nicht als nackte Zahl) kommunizieren
**Prinzip.** Human-AI-Trust-Forschung: Über- UND Untervertrauen sind schädlich; gut kalibriertes Vertrauen ist das Ziel. **Simple visuelle/kategoriale Hinweise verhindern Over-Reliance besser als nackte numerische Konfidenz** (die sogar Overtrust induziert).
**NSAI-Edge-Übertragung (Output von verify()/belief; neu: kategoriale Konfidenz-Linse).** Integer-Promille ist intern goldrichtig, als Mensch-Output aber genau die „nackte Zahl". Eine **kategoriale Präsentations-Linse** über den Promille (*verbürgt / wahrscheinlich / unbestätigt / umstritten / widerrufen*). Bei *umstrittenen* oder *niedrig-diversen* (A6) Tripeln ein explizites **Warn-Flag**, nicht nur eine niedrigere Zahl. Menschenseitige Umsetzung von Invariante 6: der Mensch sieht „umstritten", nicht „73 %". **(Deckt sich mit der Belief-Kategorien-Idee aus Dok 06, Strang 3 / kategoriale Wahrnehmung.)**
**Invarianten-Check.** ✅ rein additive Lese-Linse (Invariante 5 — kein Promille mutiert); ✅ Determinismus (Schwellen-Mapping). Reiner UX-Gewinn ohne Invarianten-Konflikt.
**Quellen.** [AI Hallucinations: What Designers Need to Know (NN/g)](https://www.nngroup.com/articles/ai-hallucinations/) · [Fostering Appropriate Trust in Human-AI Interaction (ACM)](https://dl.acm.org/doi/10.1145/3696449)

### B6 — Proaktives statt reaktives Erinnern: der Graph meldet sich ungefragt
**Prinzip.** Distributed/Extended Cognition (Hutchins; Clark & Chalmers) + neuere LLM-Memory-Architekturen: externes Gedächtnis als aktiver Partner, der *relevantes* Wissen einbringt, *bevor* gefragt wird. Reines reaktives query-first verpasst „unknown unknowns".
**NSAI-Edge-Übertragung (neu: proaktiver Relevanz-Push + Konflikt-Frühwarnung).** Beim Eintritt in einen Kontext (Datei/Projekt) pusht der Graph ungefragt die top-k aktivierten relevanten Tripel — *insbesondere* Warnungen („frühere Entscheidung X widerspricht dem, was du gerade tust", „dieser Fakt ist review-fällig", „hier herrscht ein Belief-Konflikt"). Der Punkt, an dem NSAI-Edge vom *Lexikon* zum *Kollegen mit Gedächtnis* wird.
**Invarianten-Check.** ✅ Determinismus (Aktivierungs-Scores als Graph-Funktion); ⚠️ Invariante 8: Push zeigt nur *Vorhandenes*, generiert nie; ✅ Offline. FLAGGEN: Relevanz-Ranking darf nicht „Anzahl" als Proxy nehmen (Invariante 6). (Risiko Kontext-Spam → strenge Relevanz-/Wichtigkeits-Schwelle, Push nur bei Konflikt oder hoher Aktivierung.)
**Quellen.** [SYNAPSE: LLM Agents with Episodic-Semantic Memory via Spreading Activation (arXiv:2601.02744)](https://arxiv.org/pdf/2601.02744) · [ACT-R-Inspired Remembering/Forgetting in LLM Agents (HAI 2025)](https://dl.acm.org/doi/10.1145/3765766.3765803)

### B7 — Human-AI Co-Memory: wer kuratiert das geteilte Gedächtnis? (epistemische Risiken)
**Prinzip.** Stufen (Rev. Phil. Psych. 2026): *distributed memory* → *AI-curated memory* (die KI *wählt/formt*, was erinnert wird) → *human-AI co-memory*. Der Sprung zur *Kuratierung* bringt Verzerrungs-, Abhängigkeits- und Metamemory-Verlust-Risiken.
**NSAI-Edge-Übertragung (Governance + neu: Provenienz-/Kuratierungs-Transparenz).** NSAI-Edge ist *AI-curated* (Claude entscheidet, was eingepflegt/decayed/quarantäniert wird). Risiko: der Mensch verliert Überblick, *was* sein Gedächtnis enthält und *wer* es formte. Features: (1) **Provenienz pro Tripel sichtbar** — „von Claude inferiert" vs. „vom Menschen bestätigt" vs. „von Peer gepullt" als first-class Unterscheidung. (2) **Kuratierungs-Diff / Memory-Review** — periodische, menschenlesbare Zusammenfassung „was hat sich seit letztem Mal geändert (neu/decayed/widerrufen)". (3) **menschliches Veto/Pin** — Tripel als „verbürgt, nicht decayen" pinnen oder ablehnen.
**Invarianten-Check.** ✅ Provenienz sind Tripel (CRDT-konform); ✅ Open-World; ⚠️ menschliches „Pin/nicht-decayen" ist *lokale* Override-Linse — darf in der Föderation nicht als globale Wahrheit propagieren (Invariante 5). FLAGGEN.
**Quellen.** [Remembering with AI: Distributed → AI-Curated → Co-Memory (Rev Phil Psych 2026)](https://link.springer.com/article/10.1007/s13164-026-00815-1)

---

## Top 3 wildeste Ideen
1. **A3 + A6 zusammen — „Wahrheit aus dem Hash-DAG, nicht aus der Mehrheit".** Git-artiger kausaler Hash-DAG signierter Tripel macht NSAI-Edge byzantinisch-robust *und* Sybil-immun *und* liefert den *mathematischen* Unterbau für Invariante 6: Korroboration zählt nur *unabhängige Wurzeln* im DAG. „Anzahl zählt nie" wird von einem Vorsatz zu einer berechenbaren Eigenschaft. Vereint Vector-Clock, Multi-Source-Corroboration und Anti-Sybil in *einer* Datenstruktur.
2. **B6 — der Graph als proaktiver Kollege mit Konflikt-Frühwarnung.** Statt passiv auf query-first zu warten, pusht der Graph beim Kontext-Eintritt ungefragt *Widersprüche zu früheren Entscheidungen* („du baust gerade gegen ADR-X"). Vom Speicher zum Gewissen.
3. **B3 Krypto-Shredding im Hash-DAG.** Vergessen in einem unlöschbaren, hash-verketteten Verlauf per Schlüssel-Zerstörung statt Daten-Löschung — Hash-Verlauf bleibt intakt (Konvergenz!), der *Inhalt* wird unwiederbringlich. Löst Recht-auf-Vergessen vs. CRDT-Add-Only vs. manipulationssicherer Verlauf.

## Die größte übersehene UX-/Koordinations-Lücke von NSAI-Edge
**Das Konzept behandelt das Gedächtnis als Datenbank, nicht als Beziehungspartner — es fehlt die Metamemory- und Kuratierungs-Transparenz-Schicht (B1 + B7 + B5).** Sauber durchdacht ist *was gespeichert/synct/verifiziert wird*, aber blank bei: **„Was passiert im Kopf des Menschen (und Claudes), wenn dieses externe Gedächtnis existiert?"** Drei verkoppelte Lücken: (a) **kein „Wer-weiß-Was"** (B1) — query-first ist global-blind; (b) **Kuratierung intransparent** (B7) — Claude formt das „Gedächtnis" des Menschen ohne Fenster/Veto; (c) **Unsicherheit als Zahl statt Kategorie** (B5). Die Pointe: alle drei sind *billig* (reine Lese-/Präsentations-Layer, kaum Invarianten-Konflikt) und liefern überproportionalen Vertrauens-/Brauchbarkeits-Gewinn. Die schwere verteilte Maschinerie nützt wenig, wenn der Mensch dem Gedächtnis nicht *kalibriert* vertrauen kann und nicht weiß, *was* darin steht und *wer* es geformt hat.
