# Kollektive Tier-Intelligenz & Schwarm-Entscheidung

> **Explorations-Rohmaterial** (Batch 2026-05-29), web-quellengestützt. **Keine CDP5-Bindung.** Invarianten-Brüche geflaggt, nicht gefiltert. Zweck: Rohmaterial fürs Konzept.
>
> **Invarianten-Legende:** (1) Zero-Dep · (2) Offline · (3) Determinismus · (4) CRDT-Konvergenz · (5) lokale Lese-Linsen · (6) „Anzahl zählt nie" · (7) Open-World · (8) „Nie raten".

**Querschnitts-Beobachtung vorab:** NSAI-Edge ist heute fast überall ein **stateless, comparison-based, value-INsensitives** System (max-Auswahl, statische Schwellen, Snapshot-Belief-Resolution). Die Biologie löst dieselben Probleme fast überall **value-sensitiv und über persistente, zerfallende Akkumulatoren.** Das ist die rote Linie unten.

---

### [Cross-Inhibition / Stop-Signal-Belief-Resolution]
- **Prinzip (Natur):** Honigbienen-Scouts werben per Waggle-Dance für Nistplätze und senden zugleich *inhibitorische Stop-Signale* (Headbutt + Buzz) gezielt an Werber **konkurrierender** Optionen. Bessere Plätze → mehr Tänze → mehr Inhibition gegen alle anderen. Löst nachweislich den Deadlock bei zwei gleich guten Plätzen, den reines positives Feedback nicht lösen kann (Seeley/Visscher/Marshall, *Science* 2011).
- **Mechanismus:** Dynamisches System mit zwei „committed"-Populationen y₁, y₂ und uncommitted x. Rekrutierung ∝ Qualität, plus Cross-Term −σ·y_i·y_j. Bei hohem σ: **Pitchfork-Bifurkation** → deterministisches Kippen in winner-take-all, *auch* bei y₁≈y₂. Entscheidend (Pais/Marshall 2013): hängt von **Differenz UND Mittelwert** der Werte ab — value-sensitive, nicht nur accuracy-sensitive.
- **NSAI-Edge-Übertragung (ERSETZT/ergänzt Belief-Resolution):** Heute contested-Flag, wenn der Zweitplatzierte ≥ Schwelle — rein *vergleichende* Snapshot-Linse. Cross-Inhibition macht es value-sensitiv: jedes konkurrierende Objekt sammelt einen Integer-Score (source_type·recency·conf·trust), und der Score wird **aktiv gedämpft proportional zum Score seiner Rivalen** (`score_i -= floor(σ·score_i·score_j/SCALE)` über Top-Tier-Paare). Härtet die contested-Schwelle: bei zwei starken gegensätzlichen Quellen entsteht *kein* fauler Mittelweg — klarer Sieger kippt durch ODER sauber contested. Mittelwert-Term liefert ein *kostenloses Konfidenz-Signal*: beide schwach → absichtlich unentschieden (Anti-„Nie raten").
- **Trade-offs:** Statt Paar-Inhibition: globale Normalisierung (softmax-artig) — verletzt aber „Anzahl zählt nie" weniger sauber. Cross-Inhibition bleibt max-artig (kein Summieren über Quellen). σ ist ein neuer Tuning-Parameter (zu klein → Deadlock, zu groß → vorschnell).
- **Invarianten-Check:** ✅ Determinismus (Integer-Iteration, fixe σ); ✅ „Anzahl zählt nie" (Inhibition skaliert mit Score, nicht Count); ⚠️ CRDT: nur lesend über signierte Wire-Werte, nie zurückschreiben.
- **Quellen:** [Stop Signals Provide Cross Inhibition (Science 2011)](https://www.science.org/doi/10.1126/science.1210361) · [Value-Sensitive Decision-Making (PLoS ONE 2013)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0073216)

---

### [Stigmergisches Retrieval — Pfade verstärken sich durch Nutzung]
- **Prinzip:** Ameisen koordinieren über die *persistente Umwelt*: Pheromon zieht an; häufig begangene Pfade akkumulieren mehr, ungenutzte verdunsten. Kürzester Pfad ist *emergent* (Dorigo, ACO).
- **Mechanismus:** Kantenwahl P ∝ τ^α·η^β. Nach jeder Lösung: Verdunstung τ←(1−ρ)·τ, dann Deposit Δτ ∝ 1/Pfadlänge auf genutzten Kanten. ρ verhindert Konvergenz auf Suboptima.
- **NSAI-Edge-Übertragung (ERGÄNZT Retrieval-Routing):** PPR ist heute *strukturell* (Topologie + Belief). Ergänze einen **usage-Pheromon-Layer** pro Kante: bei jedem in einer erfolgreichen Antwort *genutzten* Retrieval-Pfad Integer-Pheromon deponieren; periodisch verdunsten (`τ←τ−floor(τ/HL)`). PPR nutzt τ als Zusatzgewicht. Häufig wertvolle Pfade werden schneller gefunden, „totes" Wissen sinkt im Ranking, ohne gelöscht zu werden (Open-World bleibt). Externalisiertes Nutzungsgedächtnis; Decay-als-Verdunstung ist mathematisch identisch zum bestehenden conf-Decay.
- **Trade-offs:** Pheromon-Feedback ist eine *Echokammer*-Quelle (oft begangen ≠ wahr) — strikt vom Belief trennen (Pheromon rankt Reihenfolge, ändert NIE Konfidenz).
- **Invarianten-Check:** ✅ Determinismus; ✅ Offline/zero-dep (eine Integer-Spalte/Kante); ⚠️ „Anzahl zählt nie": Pheromon *zählt* Nutzungen — zulässig nur, weil es Retrieval-*Reihenfolge* steuert, nie Belief-*Wahrheit*. Diese Trennung ist die ganze Schlacht.
- **Quellen:** [Ant Colony Optimization (Dorigo & Stützle)](https://web2.qatar.cmu.edu/~gdicaro/15382/additional/aco-book.pdf)

---

### [Physarum-Topologie-Pruning — Kanten, die kein Wissen tragen, sterben]
- **Prinzip:** Schleimpilz *Physarum* bildet ein Röhrennetz, das mit dem Protoplasma-Fluss adaptiert: durchströmte Röhren werden dicker, ungenutzte verkümmern. Tokio-Bahn-Experiment: Netz mit fast identischer Effizienz/Fehlertoleranz wie das real geplante Schienennetz — nur lokale Flussregel (Tero et al., *Science* 2010).
- **Mechanismus:** Q_ij = D_ij·(p_i−p_j)/L_ij; Adaptation dD/dt = f(|Q|) − r·D (sigmoide Verstärkung + linearer Decay). Röhren mit D→0 werden gepruned.
- **NSAI-Edge-Übertragung (NEU: Graph-Wartung/Compaction):** periodischer deterministischer **Topologie-Compactor**. „Fluss" = Häufigkeit, mit der eine Kante in belief-gewichteten Retrieval-Pfaden Strom trägt. Kanten unter Schwelle werden *nicht gelöscht* (Open-World!), sondern in „cold storage" verschoben (aus dem Hot-PageRank-Index, on-demand reaktivierbar). Hält den Retrieval-Graph klein/schnell ohne Wissensverlust — biologisch optimiertes Index-Tiering für Knoten mit Millionen Tripeln.
- **Trade-offs:** Reines conf-Decay-Pruning verwirft auch strukturell wichtige Brücken-Kanten (Physarum behält die wegen Fehlertoleranz). Braucht Fluss-Telemetrie (synergetisch mit Pheromon-Layer).
- **Invarianten-Check:** ✅ Determinismus (Integer dD/dt); ✅ Open-World (cold storage statt delete); ⚠️ CRDT: Pruning ist *lokale* Index-Entscheidung — Knoten dürfen unterschiedliche Hot/Cold-Aufteilungen haben, solange der signierte Bestand identisch konvergiert.
- **Quellen:** [Rules for Biologically Inspired Adaptive Network Design (Science 2010)](https://www.science.org/doi/10.1126/science.1177894)

---

### [Quorum-Response-Kurve statt fixer contested-Schwelle]
- **Prinzip:** Fisch-/Vogelschwärme folgen einer *Quorum-Response*: Übernahme-Wahrscheinlichkeit ist eine steile **nichtlineare** Funktion der Zahl der Nachbarn, die ein Verhalten zeigen. Verstärkt korrekte Mehrheiten, filtert Rauschen (Sumpter/Krause/Couzin, *PNAS* 2008). „Many wrongs principle": viele verrauschte Schätzungen mitteln sich gut — aber nur über die nichtlineare Kurve.
- **Mechanismus:** P(n) = n^k/(T^k + n^k) (Hill-Funktion). Unter T fast keine Reaktion (Rauschunterdrückung), knapp darüber steiler Anstieg (Entscheidung rastet ein). Höhere Sicherheitsanforderung → höheres T.
- **NSAI-Edge-Übertragung (ERSETZT Quorum-Schwelle):** Statt *harter* Schwelle (n Quellen → bestätigt) eine **Integer-Hill-Response** über die *aggregierte Evidenzstärke* (nicht Quellenzahl!): die Konfidenz, mit der ein contested-Fakt „resolved" gilt, steigt sigmoidal mit Sieger-Score/Zweitplatzierter-Score. Knappe Rennen bleiben unsicher (flache Region), klare rasten hart ein.
- **Invarianten-Check:** ✅ Determinismus (Integer-Lookup-Table); ✅ „Anzahl zählt nie" *sofern* n die Evidenzstärke ist, nicht die Quellenzahl — sonst ❌. Diese Substitution ist der Knackpunkt.
- **Quellen:** [Quorum decision-making facilitates information transfer (PNAS)](https://www.pnas.org/doi/10.1073/pnas.0710344105)

---

### [Firefly-Synchronisation als Vector-Clock-Ergänzung]
- **Prinzip:** Glühwürmchen synchronisieren ohne Zentraltakt: jeder Oszillator springt bei Schwelle, jeder beobachtete Blitz zieht die Phase der Nachbarn nach. Mirollo & Strogatz (1990): beliebig viele pulse-coupled Oszillatoren synchronisieren garantiert.
- **Mechanismus:** Phase φ steigt bis 1, dann Feuer+Reset. Empfangener Puls: φ ← min(1, φ+ε). Konvexität der Antwortkurve garantiert Konvergenz.
- **NSAI-Edge-Übertragung (ERGÄNZT Vector-Clock):** Vector-Clocks wachsen mit der Peer-Zahl. Ein firefly-artiger **Sync-Heartbeat** etabliert grobe „Föderations-Epochen": Knoten broadcasten periodisch einen Epoch-Puls, beim Empfang ziehen sie ihren Epoch-Zähler nach (max-Regel — CRDT-kompatibel!). Gibt einen *deterministischen, monoton wachsenden, koordinatorfreien* gemeinsamen Decay-Anker → reduziert Re-Assertion-Stürme. Ersetzt Vector-Clock NICHT für Kausalität, aber für *Decay-Phasen-Alignment*.
- **Invarianten-Check:** ⚠️ Determinismus (Phasen-Pull empfangs-reihenfolge-abhängig → nur via max-Regel CRDT-safe); ✅ Offline; ✅ CRDT (Epoch = max-merge G-Counter).
- **Quellen:** [Synchronization of Pulse-Coupled Biological Oscillators (Mirollo & Strogatz, SIAM 1990)](https://www.clear.rice.edu/comp551/papers/MirolloStrogatz-TemporalSynchronization-SIAM1990.pdf)

---

### [CRISPR-Immungedächtnis — signaturbasierte Peer-Abwehr]
- **Prinzip:** Bakterien speichern in einem CRISPR-Array kurze DNA-Fragmente („Spacer") feindlicher Eindringlinge als vererbbares Immungedächtnis; bei Wiederbegegnung wird die Signatur erkannt und die fremde DNA zerstört.
- **Mechanismus:** Adaptation (Spacer-Akquise) → Expression (crRNA-Guides) → Interferenz (Sequenz-Match → Schnitt). Memory persistiert (priming).
- **NSAI-Edge-Übertragung (NEU: adversariales Peer-Immungedächtnis):** Heute TOFU-Fingerprints + Quarantäne, aber kein *positives Gedächtnis schädlicher Muster*. **Spacer-Store**: wird ein Fremd-Fakt als schädlich verworfen/quarantäniert (Signaturfehler, Replay, widerlegter Inhalt, Sybil-Verdacht), speichere eine deterministische **Signatur** (Hash über (peer_pubkey, S–P-Muster, Anomalie-Typ)). Eingehende Tripel werden gegen den Store gematcht → sofortige Interferenz (Reject) ohne erneute teure Prüfung. Föderiert teilbar: Knoten pushen Spacer → kollektive Immunität gegen einen Sybil-Schwarm (im Geist von „Anzahl zählt nie": ein Angriffsmuster reicht zum Impfen). **Siehe Dok 03 für Zensur-/Vergiftungs-Risiko.**
- **Invarianten-Check:** ✅ Determinismus (Hash-Match); ✅ Offline; ⚠️ Open-World: Spacer dürfen nur *verifizierbar* schädliche Muster blocken (Signatur-/Replay-Fehler), nie inhaltliche Meinungsverschiedenheit — sonst ❌.
- **Quellen:** [Molecular memory of prior infections activates CRISPR/Cas (Nature Comms)](https://www.nature.com/articles/ncomms1937)

---

### [Restriction-Modification — „Self"-Methylierung als Fremd-DNA-Filter]
- **Prinzip:** >80% der Bakterien tragen Restriktions-Modifikations-Systeme: eine Methyltransferase markiert *eigene* DNA („self"), eine Endonuklease zerschneidet alles Unmarkierte („non-self"). Angeborener, schwellenloser Fremd-Filter (komplementär zum *adaptiven* CRISPR).
- **NSAI-Edge-Übertragung (ERGÄNZT Quarantäne-Eingangsfilter):** Eigene/voll-vertraute Fakten tragen bereits Ed25519-Signaturen = das „Methyl-Tag". RM legt einen **schwellenlosen angeborenen Eingangsfilter** *vor* der teuren Belief-Resolution nahe: route Fremd-Tripel nach Tag-Status (Signatur × Peer-Trust-Tier) in „self/full → direkt" vs. „non-self → Quarantäne-Pipeline". Zweistufige Immunität: RM (angeboren, billig, Tag) + CRISPR-Spacer (adaptiv, gelernt). NSAI-Edge hat den zweiten nicht und den ersten nur implizit — sauber als zwei Schichten trennen.
- **Invarianten-Check:** ✅ Determinismus (Signaturprüfung); ✅ Trust = lokale Linse; ✅ Offline.
- **Quellen:** [R-M systems modulate HGT susceptibility (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC11736437/)

---

### [Bakterielles Quorum-Sensing — Aktion erst ab Föderations-Dichte]
- **Prinzip:** Bakterien sezernieren Autoinducer, deren Konzentration mit der Zelldichte steigt; ab Schwellenkonzentration kippt kollektiv die Genexpression. Aktion lohnt erst, wenn „genug" mitmachen (Bassler).
- **NSAI-Edge-Übertragung (NEU: Föderations-Dichte-Gating):** Ein Fakt wird erst von „provisorisch/quarantäniert" zu „voll integriert" *promoviert*, wenn die kumulierte, **decay-gewichtete Evidenzdichte** (nicht Quellenzahl!) eine Autoinducer-artige Schwelle übersteigt. Subtiler als simples Quorum: das Signal *zerfällt* (Decay = Autoinducer-Abbau), sodass nur *zeitlich konzentrierte* Korroboration die Schwelle erreicht — alte verstreute Hinweise summieren sich nicht auf. Resistent gegen langsame Sybil-Drip-Attacken.
- **Invarianten-Check:** ⚠️ „Anzahl zählt nie": grenzwertig — erfordert per-Quelle-max-Deckel, sonst ❌; ✅ Determinismus (Integer-Akkumulator mit Decay); ✅ Offline.
- **Quellen:** [Quorum Sensing in Bacteria (Annual Reviews)](https://www.annualreviews.org/content/journals/10.1146/annurev.micro.55.1.165)

---

### [Tandem-Running — verifizierter Lehrer-Schüler-Wissenstransfer]
- **Prinzip:** *Temnothorax*-Ameisen lehren Routen per Tandem-Running mit **bidirektionalem Feedback**: der Lehrer verlangsamt bei Rückstand, der Schüler beschleunigt. Lehrer zahlt Zeit (4× langsamer), Schüler lernt verifiziert und wird selbst zum Lehrer. Erster nachgewiesener Lehr-Akt bei Nicht-Menschen (Franks & Richardson, *Nature* 2006).
- **NSAI-Edge-Übertragung (ERSETZT naiven Bulk-Pull/Push):** Föderations-Sync ist git-artig (Bulk-Pull/Push + CRDT-Merge). Tandem-Running schlägt ein **acknowledged, rate-adaptives Sync-Protokoll** vor: der „Lehrer" pusht Tripel in Tranchen und drosselt, bis der „Schüler" *bestätigt verifiziert* hat (Signaturen geprüft, Spacer-Filter passiert, integriert). Bei Verifikations-Rückstand drosselt der Lehrer automatisch. Kein Quarantäne-Überlauf, Backpressure eingebaut, Schüler wird selbst Lehrer (transitive Ausbreitung mit Provenienzkette).
- **Invarianten-Check:** ✅ CRDT (Merge bleibt max, Reihenfolge egal — Tandem steuert nur *Rate*); ✅ Determinismus; ✅ Offline (asynchrone Quittungen).
- **Quellen:** [Teaching in tandem-running ants (Nature 2006)](https://www.nature.com/articles/439153a)

---

### [Korviden-Cache-Schutz — adversariales „beobachtet"-Modell ohne Theory-of-Mind]
- **Prinzip:** Buschhäher cachen Futter; *wenn beobachtet*, cachen sie später um. Ein Computermodell reproduziert das **ohne Theory of Mind** — allein aus EINER Regel („cache weit weg von Artgenossen") + stress-induzierten Gedächtnisfehlern (van der Vaart et al., *PLoS ONE* 2012). Schutzwirkung als Nebenprodukt simpler Heuristiken.
- **NSAI-Edge-Übertragung (NEU: provenienz-sensitives Re-Hosting / billiger Sybil-Schutz):** (1) *Warnung:* man braucht kein teures „Peer-Intentions-Modell" — simple lokale Regeln liefern denselben Schutz billiger. (2) *Feature:* ein **„observed-while-asserting"-Flag** — wurde ein Tripel zuerst über einen low-trust/öffentlichen Pfad bekannt, markiere es als „exponiert" und priorisiere unabhängige Re-Korroboration, bevor es Belief-Gewicht bekommt (Schutz gegen Cache-Poisoning: der Angreifer weiß, was du gesehen hast). Kostet nur ein Flag + eine lokale Regel.
- **Invarianten-Check:** ✅ Determinismus (lokale Flag-Regel); ✅ „Nie raten" (Re-Korroboration statt Annahme); ✅ Offline.
- **Quellen:** [Corvid Re-Caching without 'Theory of Mind' (PLoS ONE 2012)](https://journals.plos.org/plosone/article?id=10.1371/journal.pone.0032904)

---

### [Uninformierte Mehrheit dämpft fanatische Minderheit (Couzin)]
- **Prinzip:** Couzin et al.: Hinzufügen *uninformierter* Individuen **stärkt die demokratische Mehrheit** und verhindert, dass eine kleine, stark-meinungsstarke Minderheit die Gruppe kapert. Uninformierte = Trägheits-/Verdünnungspuffer gegen Fanatismus.
- **NSAI-Edge-Übertragung (ERGÄNZT Anti-Echo-Kammer/Belief) — KONTRAPUNKT:** NSAI-Edges max-Regel macht es *immun gegen Echo-Kammern*, aber potenziell *anfällig für einen einzelnen sehr lauten (hoch-conf, hoch-trust) Fanatiker*, der jeden breiten schwächeren Konsens überstimmt. Couzin legt eine optionale **„uninformed-ballast"-Linse** nahe: niedrig-konfidente, breit gestreute korroborierende Signale dürfen — rein als *Tie-Breaker* in contested-Fällen — ein Gegengewicht gegen einen einzelnen Extremwert bilden, *ohne* zur Summe zu werden.
- **Invarianten-Check:** ❌/⚠️ „Anzahl zählt nie": direkter Konflikt — nur tragbar, wenn deterministisch gedeckelt + auf contested-Tie-Breaks beschränkt. **Bewusst als Spannung dokumentiert, nicht als Empfehlung.**
- **Quellen:** [Uninformed individuals promote democratic consensus (Couzin et al.)](https://journals.plos.org/ploscompbiol/article?id=10.1371/journal.pcbi.1003762) · [How Is Flocking Like Computing? (Quanta)](https://www.quantamagazine.org/how-is-flocking-like-computing-20240328/)

---

## Top 3 wildeste Ideen

1. **CRISPR-Spacer-Store als föderiert teilbares Angriffsmuster-Immungedächtnis.** Knoten impfen sich gegenseitig gegen Sybil-/Replay-/Poisoning-Muster — kollektive Immunität, bei der *ein* erkannter Angriff den Schwarm schützt. „Anzahl zählt nie", angewandt auf Verteidigung statt Wahrheit.
2. **Cross-Inhibition macht Belief-Resolution value-sensitiv.** Weg vom statischen max-Vergleich, hin zu einem dynamischen Akkumulator mit aktiver Rival-Dämpfung + Pitchfork-Bifurkation. Liefert winner-take-all *und* deadlock-freie, value-sensitive contested-Erkennung — bewiesen optimal (Pais/Marshall).
3. **Firefly-Sync als koordinatorfreier Decay-Epoch-Takt.** Pulse-coupled Oszillatoren ersetzen pro-Peer-Zeitbuchhaltung durch einen emergenten, offline-fähigen, CRDT-max-kompatiblen gemeinsamen Decay-Anker.

## Welches Tier löst ein NSAI-Edge-Problem eleganter als der aktuelle Entwurf?

**Die Honigbiene — bei der Belief-/Quorum-Auflösung.** NSAI-Edges contested-Logik ist *comparison-based und value-INsensitiv*: sie fragt „ist der Zweite nah genug am Ersten?", aber nie „sind beide überhaupt gut genug, um sich zu entscheiden?". **Cross-Inhibition** löst beides in einem Mechanismus: deadlock-frei bei gleich-guten Optionen *und* sensitiv für absolute Qualität (Differenz UND Mittelwert), bewiesen optimal, vollständig integer-/deterministisch und max-kompatibel — ohne „Anzahl zählt nie" zu verletzen.

**Zweitplatzierter: der Schleimpilz — bei der Graph-/Retrieval-Topologie.** PPR optimiert das Ranking *auf* einem statischen Graph; Physarum optimiert *den Graph selbst* via Fluss-Reinforcement + Decay-Pruning und behält gezielt fehlertolerante Redundanz — adaptive Topologie-Wartung, die NSAI-Edge fehlt.

> *Anmerkung des Agenten zur Quellenlage:* Drei load-bearende Primärquellen (Cross-Inhibition Science 2011, Value-Sensitive PLoS ONE 2013, Physarum Science 2010) waren teils paywalled (403); Mechanismen aus offenen Sekundärdarstellungen + PubMed-Abstracts rekonstruiert. Für eine Implementierungs-Spec die Originalgleichungen (Pais 2013 §Model; Tero 2010 dD/dt = f(|Q|)−rD) direkt verifizieren.
