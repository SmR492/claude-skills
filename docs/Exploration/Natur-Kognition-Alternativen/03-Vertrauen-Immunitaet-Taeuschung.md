# Biologische Vertrauens-, Abwehr- & Täuschungs-Systeme

> **Explorations-Rohmaterial** (Batch 2026-05-29), web-quellengestützt. **Keine CDP5-Bindung.** Invarianten-Brüche geflaggt. Angle: self/non-self-Diskriminierung, Reputation, Betrugserkennung, adversariale Täuschung → Provenienz/Peer-Trust/Quarantäne/Sybil-Abwehr.
>
> **Invarianten-Legende:** (1) Zero-Dep · (2) Offline · (3) Determinismus · (4) CRDT · (5) lokale Lese-Linsen · (6) „Anzahl zählt nie" · (7) Open-World · (8) „Nie raten".

---

### [1] Danger-Theory-Quarantäne — quarantäniere bei SCHADEN, nicht bei Fremdheit
**Prinzip.** Matzingers Danger-Theory (1994) bricht mit dem self/non-self-Dogma: das Immunsystem reagiert nicht auf „fremd", sondern auf GEFAHR — auf Alarmsignale (DAMPs) aus geschädigtem/gestresstem Gewebe. Harmloses Fremdes (Nahrung, Fötus, Kommensalen) wird toleriert; gefährliches Eigenes (Tumor) angegriffen. Auslöser ist Schaden, nicht Herkunft.
**Mechanismus.** Dendritic-Cell-Algorithm (Greensmith/Aickelin): drei Signal-Klassen — **PAMP** (sicher anomal), **Danger** (Wahrscheinlichkeit steigt mit Wert), **Safe** (sicher normal) — gewichtet integriert; erst Korrelation mit einem Antigen löst Alarm aus. Niedrige False-Positive-Raten.
**NSAI-Edge-Übertragung (ergänzt Quarantäne).** Heute landet *Fremd-/unsicheres* Wissen pauschal in Quarantäne (reine self/non-self-Logik, hohe Über-Quarantäne-Gefahr). Ergänze einen **Danger-Score** statt binär „fremd→quarantäne": quarantänisiere/werte ab nur bei deterministischem *Schaden-Signal* — (a) Widerspruch zu authoritative-Bestand, (b) Constraint-Verletzung (Typ-/Kardinalitäts-Bruch), (c) Signatur-/Provenienz-Defekt, (d) Tier-Floor-Verletzung. Fremd-aber-harmlos (neuer Origin, konsistent) → leichtere Quarantäne / limited-Eingang. Drei Signal-Klassen analog DCA: PAMP=Signaturbruch, Danger=Graph-Inkonsistenz, Safe=Constraint-Konsistenz + bekannter Origin.
**Invarianten-Check.** ✅ Determinismus (Graph-Constraints, Signaturen, kein LLM); ⚠️ „Nie raten": Danger-Score darf nur *zusätzlich quarantänisieren*, nie auto-promoten; ✅ Open-World („kein Danger-Signal" ≠ „wahr", nur „kein Ablehnungsgrund").
**Quellen.** [The danger theory: 20 years later (Front Immunol)](https://www.frontiersin.org/journals/immunology/articles/10.3389/fimmu.2012.00287/full) · [The danger theory revisited (Nat Rev Immunol 2024)](https://www.nature.com/articles/s41577-024-01102-9) · [Dendritic Cell Algorithm](https://arxiv.org/pdf/1006.5008)

---

### [2] Negative-Selektion-Detektoren — lerne „Selbst", alarmiere bei allem anderen
**Prinzip.** Im Thymus werden T-Zellen, die Selbst binden, eliminiert (negative Selektion). Übrig bleiben Detektoren, die *per Definition* nur Nicht-Selbst erkennen. Das System lernt nicht „alle Feinde", sondern „alles Eigene".
**Mechanismus.** Negative-Selection-Algorithm (Forrest): (1) Self-Set aus Normalmustern; (2) Zufalls-Detektoren generieren; (3) jeden verwerfen, der Self matcht; (4) übrige überwachen — Match = Anomalie.
**NSAI-Edge-Übertragung (neu: Self-Profil + Anomalie-Detektor).** Der Knoten konstruiert deterministisch ein **„Self-Profil"** aus seinem authoritative/full-Bestand: typische Prädikat-Vokabulare, Origin-Verteilung, Tier-Muster, Schemata. Eingehende Fremd-Fakten werden dagegen gematcht: passt strukturell → niedrige Anomalie; weicht stark ab (unbekanntes Prädikat, untypische Tier/Origin-Kombination) → hohe Anomalie → strengere Quarantäne. Die *deterministische* Antwort auf „eigenes verlässliches vs. fremdes riskantes Wissen" ohne externe Trainingsdaten. (Statt zufälligem Detektor-Sampling: direkter Abstands-Score gegen ein kompaktes Self-Profil.)
**Invarianten-Check.** ✅ Zero-dep/Offline/Determinismus (lokale Aggregation); ⚠️ Self-Profil ist explizit *lokal* — Anomalie-Bewertung nie in den replizierten Wert zurückschreiben.
**Quellen.** [AIS for Self-Nonself Discrimination (Springer)](https://link.springer.com/chapter/10.1007/978-3-540-78297-1_11) · [Negative selection in anomaly detection — survey](https://www.sciencedirect.com/science/article/abs/pii/S1574013723000242)

---

### [3] CRISPR-Spacer-Blocklist — signaturbasiertes Gedächtnis erkannt-bösartiger Origins/Muster
**Prinzip.** Bakterien speichern bei Phagen-Angriff einen „Spacer" (DNA-Schnipsel) im CRISPR-Array — durchsuchbares, heritables Gedächtnis; bei Wiederkontakt führt es Cas-Nukleasen zum Match.
**NSAI-Edge-Übertragung (neu: Spacer-Array / Defektor-Signaturen).** Wird ein Fakt aus *legitimer* Quarantäne als bösartig **reject**-et, extrahiere eine deterministische **Signatur** — nicht den Fakt, sondern einen „Spacer": Hash über (Origin-Pubkey + Prädikat-Schema + Verletzungsklasse). Eingehende Fakten zuerst gegen das Array → exakter Match = sofortiger Block (schnelle Sekundärantwort, #4) ohne erneute Vollprüfung. Heritabilität = Spacer-Arrays sind selbst signierte, p2p-propagierende Fakten.
**Trade-offs / scharfe Kante.** Geteilte Blocklists sind ein Vergiftungs-Vektor (böswilliger Peer pusht Spacer gegen legitime Origins → Zensur). Gegenmaßnahme analog Modell B: ein *fremder* Spacer blockt nie hart, er erhöht nur den Danger-Score (#1); nur *lokal selbst-erzeugte* Spacer blocken autoritativ. Alternative: nur *Muster*-Spacer (Schema-Verletzungs-Fingerprints), herkunftsneutral.
**Invarianten-Check.** ✅ Determinismus/Zero-dep (Hash-Match); ⚠️ Trust-Laundering: geteilte Spacer dürfen „Trust am Origin" nicht aushebeln; ❌ potenziell gegen „Anzahl zählt nie", falls „viele Peers haben geblockt" als Grund zählt — explizit verbieten.
**Quellen.** [Generation of memory by CRISPR-Cas (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4104294/)

---

### [4] Immunologisches Gedächtnis — schnelle Sekundärantwort auf wiederkehrende Fremd-Fakten
**Prinzip.** Erstkontakt → langsame Primärantwort; danach langlebige Gedächtniszellen; Zweitkontakt → schnelle, starke Sekundärantwort. Latenz-Asymmetrie ist der Kern.
**NSAI-Edge-Übertragung (ergänzt Quarantäne-Pipeline).** Die teure Erstprüfung eines Fremd-Fakts (web-of-trust-verify, Constraint-Check, Danger-Scoring) wird als **Gedächtnis-Eintrag** gecacht: (Origin, Prädikat-Schema) → Entscheidung + Begründung. Wiederkehrende strukturgleiche Fakten desselben Origins → **Fast-Path** ohne Vollprüfung. Positiv-Cache (vertrauter Origin → schneller full-Eingang) + Negativ-Cache (#3 Spacer).
**Trade-offs.** Risiko: gecachter Positiv-Eintrag wird zur Schwachstelle, wenn ein Origin nach erworbenem Vertrauen „umkippt" (Sleeper). Gegenmaßnahme: Cache-TTL + Re-Validierung bei Tier-Eskalation; jede *neue* Tier-Stufe erzwingt frische Primärantwort. **Siehe #11 (original antigenic sin)** als Failure-Mode.
**Invarianten-Check.** ✅ Determinismus (Memoisierung der deterministischen Prüfung); ⚠️ CRDT (Cache ist lokal, nie Wire-Wert ändern); ⚠️ „Nie raten": Fast-Path nur bei *identischem* (Origin, Schema)-Treffer, keine Ähnlichkeits-Heuristik.
**Quellen.** [Immunological memory (NCBI Bookshelf)](https://www.ncbi.nlm.nih.gov/books/NBK27158/)

---

### [5] Klonale Selektion & Affinitätsreifung — Hypothesen-Kandidaten generieren, Treffsichere verstärken
**Prinzip.** B-Zellen, die gut binden, werden zur Proliferation selektiert + somatisch hypermutiert; höher-affine Mutanten bevorzugt selektiert (Affinitätsreifung). Darwinsche Selektion im Kleinen.
**Mechanismus (CLONALG).** Kandidaten-Population; Fitness = Affinität; beste klonen (∝ Fitness); Hypermutation invers zur Fitness; Reselektion; Diversität durch neue Zufalls-Kandidaten.
**NSAI-Edge-Übertragung (ergänzt Self-Critique / Hypothesengenerierung — STARK FLAGGEN).** Aus einem widersprüchlichen/lückenhaften Graph-Bereich generiert der Knoten **Reconciliation-Hypothesen** („welcher von zwei konfligierenden Fakten ist konsistenter mit dem authoritative-Kern?"). Affinität = deterministischer Konsistenz-Score gegen den Graphen. Hoch-affine → als *Kandidaten* markiert (nicht Fakt!), niedrig-affine verworfen. Der einzige Vorschlag, der NSAI-Edge *Kreativität* gäbe.
**Invarianten-Check.** ❌/⚠️ „Determinismus & nie raten": echte stochastische Hypermutation bricht beide → zwingend zu *deterministischer, erschöpfender Kandidaten-Enumeration* erlaubter Reconciliation-Operationen entschärfen; Kandidaten in *separatem, nie repliziertem, nie zählendem* Layer (Vorschlags-Modus); ⚠️ „Anzahl zählt nie": Affinitäts-Verstärkung darf nicht zu „häufigster Kandidat gewinnt" degenerieren. ✅ Zero-dep machbar. **Rohmaterial, kein Implementierungsmandat.**
**Quellen.** [Learning and Optimization Using the Clonal Selection Principle (de Castro & Von Zuben)](https://www.cs.unm.edu/~forrest/classes/immuno-class/readings/DeCastro.pdf)

---

### [6] Regulatorische T-Zellen — Anti-Autoimmunitäts-Bremse gegen Über-Quarantäne
**Prinzip.** Tregs (FoxP3⁺) verhindern Autoimmunität, indem sie selbst-reaktive Zellen unterdrücken. Sie sind die *Bremse*: ohne sie greift das Immunsystem Eigenes an. Gesundheit = Balance Angriff/Toleranz.
**NSAI-Edge-Übertragung (neu: Quarantäne-Governor / Autoimmunitäts-Wächter).** Direkte Antwort auf die Über-Quarantäne-Sorge. Ein deterministischer **Treg-Governor** überwacht die Reject-/Quarantäne-Rate: steigt der Anteil quarantänisierter Fakten eines *bekannten, zuvor verlässlichen* Origins über eine Schwelle, ist das ein Autoimmunitäts-Signal (der Knoten greift „Eigenes" an — z. B. nach fehlerhaftem eigenen Constraint-Update). Reaktion: Dämpfung (konservativere Quarantäne) + Operator-Alert „mögliche Selbstvergiftung des Filters". Verhindert die Spirale, in der ein zu scharfes Self-Profil (#2) legitime Peers ausschließt.
**Trade-offs.** Ein Angreifer könnte die Bremse *absichtlich auslösen*, um die Abwehr zu lähmen (DoS auf den Filter). Gegenmaßnahme: Dämpfung nur auf *etablierte* Origins, nie auf neue/unbekannte; authoritative-Tier nie durch den Governor abgesenkt.
**Invarianten-Check.** ✅ Determinismus (Raten-Schwellwert + Schaltlogik); ⚠️ Governor verändert nur lokale Filterhärte, nie Wire-Wert/Origin-Trust; ✅ Open-World (Bremse = mehr Toleranz).
**Quellen.** [Regulatory T cells in homeostasis and disease (Nature STTT 2025)](https://www.nature.com/articles/s41392-025-02326-4)

---

### [7] Kutikuläre-Kohlenwasserstoff-Fingerprints — TOFU-Verankerung mit Template-Habituation
**Prinzip.** Ameisen/Bienen erkennen Nestgenossen an einem kolonie-spezifischen Profil kutikulärer Kohlenwasserstoffe (CHCs) = chemischer „Fingerprint". Sie lernen das Template und *aktualisieren es per Habituation*; neuartige Kombinationen lösen Aggression aus. Template ist verteilt, homogenisiert durch Mund-zu-Mund-Fütterung.
**NSAI-Edge-Übertragung (ergänzt TOFU).** TOFU ist da (erste Identität verankert), aber statisch. CHC ergänzt: (a) **Multi-Faktor-Fingerprint statt nur Pubkey** — Origin-Profil aus (Pubkey + typisches Prädikat-Vokabular + Tier-Verteilung + Signatur-Algorithmus); plötzliche Diskontinuität im *Verhaltens*-Profil bei gleichem Pubkey = Alarm (kompromittierter Schlüssel). (b) **Habituations-Drift** — das verankerte Profil darf sich langsam, deterministisch anpassen (gleitendes Fenster), sodass ein Peer, der legitim sein Thema erweitert, nicht jedes Mal Reverify auslöst — ein *Sprung* schon.
**Trade-offs.** Drift-Rate gedeckelt, Drift nie über Tier-Grenzen (limited→full per Drift verboten) — sonst „gradual drift attack" (langsame Template-Vergiftung wie bei adaptiven Spam-Filtern).
**Invarianten-Check.** ✅ Determinismus; ⚠️ Verhaltens-Profil als lokale Lese-Linse über dem Pubkey-verankerten Origin (Signatur unangetastet); ✅ Zero-dep.
**Quellen.** [Learning Distinct Chemical Labels of Nestmates (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC6123487/)

---

### [8] Vampirfledermaus-Reziprozität — Defektor-Tracking für Peer-Trust-Adjustment
**Prinzip.** Vampirfledermäuse teilen Blut und tracken, wer zurückgibt — „empfangene Hilfe" sagt künftige Spenden 8,5× besser voraus als Verwandtschaft. Cheater werden über Zeit ausgeschlossen. Vertrauen wird über billige Akte (Allogrooming) graduell aufgebaut, bevor teure (Blutspende) folgen.
**NSAI-Edge-Übertragung (ergänzt Peer-Trust-Adjustment).** Schärft den evaluierten Adjustment-Vorschlags-Modus: pro Peer eine deterministische **Reziprozitäts-Bilanz** — wie oft lieferte er Fakten, die später (durch authoritative-Bestätigung/Constraint-Konsistenz) als *verlässlich* bestätigt wurden, vs. reject-würdiges. Bilanz unter Schwelle → Adjustment-Vorschlag „abwerten". Graduelle Eskalation = neuer Peer startet limited (erst „leichte" Fakten), Hochstufung erst nach Historie.
**Trade-offs.** Dyadische Bilanz ist NICHT Sybil-resistent (viele Identitäten umgehen Einzelbilanzen) → Ergänzung *unter* MeritRank, nicht Ersatz.
**Invarianten-Check.** ✅ Determinismus + Offline (genau „Offline-Lernen von Peer-Verlässlichkeit"); ⚠️ „Anzahl zählt nie": gewichte nach *unabhängiger* Bestätigung, nicht Menge; ✅ Vorschlags-Modus wahrt „nie raten".
**Quellen.** [Reciprocal help predicts donations more than relatedness (Proc R Soc B)](https://royalsocietypublishing.org/doi/abs/10.1098/rspb.2012.2573)

---

### [9] Indirekte Reziprozität / Image-Scoring — propagierte Origin-Reputation ohne Trust-Laundering
**Prinzip.** Nowak & Sigmund (1998): Kooperation auch ohne wiederholte Direktbegegnung — über *Reputation* (Image Score steigt bei Hilfe, fällt bei Verweigerung). Skaliert ohne paarweise Historie — aber „moral hazard": wer bloß auf Image-Scoring vertraut, ist manipulierbar.
**NSAI-Edge-Übertragung (ergänzt Provenienz-Modell B).** Ein **Origin-Reputations-Fakt** („Origin X hat sich in N unabhängigen authoritative-Korroborationen bestätigt") wird selbst zu einem signierten, p2p-propagierbaren Fakt. Ein neuer Knoten kann die *Reputation* von X aus dem Netz lesen statt bei Null zu starten (Kaltstart-Hilfe). Kompatibel mit Modell B nur, wenn die Reputation am *Origin* hängt, nie am Relay.
**Invarianten-Check.** ⚠️/❌ „Anzahl zählt nie": Image-Scoring ist im Kern Zählen — Rettung: Score basiert auf Anzahl *unabhängiger* (verschiedener authoritative) Origins, nicht auf Selbst-Wiederholung; Reputation ist nur *Vorschlag/Bias*, nie Trust-Override (durchbricht den Tier-Deckel nie). **Flaggen.**
**Quellen.** [Evolution of indirect reciprocity by image scoring (Nature)](https://www.nature.com/articles/31225)

---

### [10] Brutparasitismus & Ei-Erkennung — diskriminanz-basierte Sybil-/Spoofing-Abwehr
**Prinzip.** Kuckuck legt sein Ei ins fremde Nest (Provenienz-Spoofing). Wirte kontern mit Ei-Erkennung & Ei-Farb-Polymorphismus (hohe Varianz zwischen Gelegen, niedrige innerhalb — erschwert Mimikry). Koevolutionäres Wettrüsten.
**Mechanismus.** Vergleich jedes Eis gegen internes Template + **Diskriminations-Schwellwert** (selbst evolvierbar: zu scharf → Auswurf eigener Eier = Autoimmunität; zu lax → Parasit kommt durch).
**NSAI-Edge-Übertragung (ergänzt Sybil-Abwehr).** Ein Fakt, der behauptet von einem *vertrauten* Origin zu stammen, wird gegen dessen Verhaltens-/Schema-Template (#7) geprüft — „Kuckucksei" (gefälschte Provenienz / kompromittierter Schlüssel mit untypischem Inhalt) per Schwellwert ausgeworfen. **Ei-Farb-Polymorphismus → Origin-Diversitäts-Bonus**: Fakten aus einem *engen, monomorphen* Origin-Cluster (Sybil-Signatur: künstlich uniform) misstrauischer behandeln als aus diversen, unabhängigen Origins. Komplementär zu MeritRank.
**Invarianten-Check.** ✅ Determinismus (Template-Distanz + Schwellwert, an Danger-Score #1 koppeln); ✅ „Trust am Origin"; ⚠️ Open-World: Auswurf bei Spoofing-Verdacht = „unsicher/quarantäne", nicht „ist falsch".
**Quellen.** [Coevolution underpins speciation in brood-parasitic cuckoos (Science)](https://www.science.org/doi/10.1126/science.adj3210)

---

### [11] Original Antigenic Sin — Failure-Mode-Warnung für Caching/Gedächtnis (Anti-Pattern)
**Prinzip.** Kehrseite des Immungedächtnisses (#4): bei einer *ähnlichen, aber nicht identischen* Variante reagiert das System reflexhaft mit dem *alten* Gedächtnis und unterdrückt die bessere naive Antwort — vom Erstkontakt „gefangen".
**NSAI-Edge-Übertragung (Anti-Pattern für #3/#4/#7).** Kein Feature — eine **Failure-Mode-Spezifikation**: wenn ein gecachter Negativ-Eintrag (#3) oder ein Habituations-Template (#7) zu starr ist, behandelt der Knoten einen *legitim weiterentwickelten* Origin reflexhaft nach altem Urteil und unterdrückt die korrekte Neubewertung. Schutz: (a) Cache-/Spacer-TTL + Re-Validierung; (b) bei *Ähnlichkeit-aber-nicht-Identität* immer frische Primärprüfung statt Fast-Path; (c) Governor (#6) überwacht „altes Urteil unterdrückt neue Evidenz".
**Invarianten-Check.** ✅ Stärkt „nie raten" (verbietet reflexhafte Extrapolation alten Wissens). ✅ Determinismus. Reines Negativ-Constraint auf andere Features.
**Quellen.** [Original Antigenic Sin: the Downside of Immunological Memory (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC8546681/)

---

### [12] Quorum-Quenching & aggressive Mimikry — adversariale Signal-Jamming-Bedrohungsmodelle
**Prinzip.** (a) **Quorum-Quenching**: Bakterien stören Konkurrenten-Kommunikation (Signal-Abbau/-Blockade = Jamming). (b) **Aggressive Mimikry** (Photuris-„Femme-Fatale"-Glühwürmchen): imitiert das Paarungssignal fremder Arten, lockt Männchen an — und frisst sie. Vertrauenssignal als Köder-Falle.
**NSAI-Edge-Übertragung (neu: Bedrohungsmodelle für Self-Critique/Quorum).** Ein **Quorum-Quenching-Angreifer** flutet das Netz mit Widersprüchen, gezielt um Korroboration *zu verhindern* (kein Konsens → kein promote) — ein Verfügbarkeits-Angriff auf den Trust-Mechanismus. Gegenmaßnahme: Quorum zählt *unabhängige authoritative* Bestätigungen (nicht Abwesenheit von Widerspruch); ein Origin, der nur Widersprüche ohne eigene Korroboration liefert, wird per Reziprozitäts-Bilanz (#8) abgewertet. **Aggressive Mimikry** = ein Sybil, der exakt Schema/Vokabular eines vertrauten Origins nachahmt — Gegenmaßnahme #7/#10 (Verhaltens-Diskontinuität); die *Origin-Signatur (Ed25519) kann nicht gefälscht werden* — **Modell B ist hier die fundamentale Verteidigung.**
**Invarianten-Check.** ✅ Stärkt „Anzahl zählt nie" + „Trust am Origin" (Mimikry scheitert an der Signatur); ✅ Determinismus; ⚠️ Quorum darf nicht in „schweigen→ablehnen" kippen (Open-World).
**Quellen.** [Interference in Bacterial Quorum Sensing (Front Pharmacol)](https://www.frontiersin.org/journals/pharmacology/articles/10.3389/fphar.2018.00203/full) · [Aggressive Mimicry in Photuris Fireflies (Science)](https://www.science.org/doi/10.1126/science.187.4175.452)

---

### [Bonus] Apoptose vs. Nekrose — sauberes Verwerfen korrupter Daten ohne Kollateralschaden
**Prinzip.** Apoptose = programmierter, entzündungsfreier Zelltod (saubere Verpackung, Phagozyten räumen ab). Nekrose = unkontrolliert (Membran platzt, Inhalt tritt aus, Entzündung/Kollateral).
**NSAI-Edge-Übertragung (ergänzt reject/Quarantäne-Beseitigung).** **Apoptotisches Reject**: ein bösartiger Fakt wird *sauber* entfernt — CRDT-Tombstone + CRISPR-Spacer (#3) geordnet erzeugt, keine „Entzündung" (keine Kaskade von Folge-Rejects benachbarter legitimer Fakten). **Nekrotisches Reject** (Anti-Pattern): hartes Löschen, das CRDT-Konvergenz bricht oder pauschal alles vom Origin mit-tötet. Spezifikation: jedes Verwerfen über geordnete Tombstones, nie destruktiv.
**Invarianten-Check.** ✅ CRDT (Tombstone konvergenz-erhaltend; hartes Löschen = Bruch); ✅ Determinismus. Im Kern eine *CRDT-Invarianten-Schutz*-Spezifikation für alle reject-Pfade.
**Quellen.** [Programmed cell death and inflammation (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC4455968/)

---

## Top 3 wildeste Ideen
1. **Klonale Selektion / Affinitätsreifung als generativer Self-Critique-Motor (#5).** Der einzige Vorschlag, der NSAI-Edge echte *Hypothesen-Generierung* gäbe — frontal gegen „Determinismus" + „nie raten" + „kein LLM". Nur im strikt separierten Vorschlags-Layer mit deterministischer Operator-Enumeration denkbar. Maximal flaggen.
2. **CRISPR-Spacer-Array als p2p-vererbbares Defektor-Immungedächtnis (#3).** Geteiltes, signiertes Blocklisting, das sich über das Netz *vererbt*. Mächtig, aber scharfer Zensur-/Vergiftungs-Vektor, der „Trust am Origin" zerreißen kann.
3. **Treg-Governor als Autoimmunitäts-Wächter über der eigenen Abwehr (#6).** Ein Meta-Regelkreis, der das *eigene Filtersystem* überwacht und bremst. Der Knoten misstraut nicht nur Peers, sondern auch der eigenen Paranoia. Passt zur Meta-Kognitions-Linie.

## Welcher biologische Abwehr-Mechanismus fehlt NSAI-Edge komplett?
**Die GEFAHR-/Schaden-Achse (Matzinger, #1) — und der negative Feedback-Regelkreis (#6).** NSAI-Edge denkt heute binär entlang der *self/non-self*-Achse: fremd → Quarantäne, unbekannter Origin → reject (das immunologische Dogma der 1950er). Es fehlt die zweite, orthogonale Achse: *gefährlich vs. harmlos*. Keine Notion von „Schaden-Signal" → es kann „fremd und harmlos" (legitimer neuer Peer) nicht von „fremd und gefährlich" (Constraint-brechender Spoof) unterscheiden → strukturell zur **Über-Quarantäne / Autoimmunität** prädisponiert, ohne Bremse. Es fehlen zusammen: (a) ein **deterministisches Danger-Signal**, das Quarantäne *auslöst* (statt bloßer Fremdheit), und (b) ein **regulatorischer Gegenspieler** (Treg-Governor), der die Über-Reaktion *dämpft*. Biologisch: NSAI-Edge hat T-Killerzellen (reject) und einen TOFU-Thymus (#7), aber **weder Danger-Sensorik noch regulatorische T-Zellen** — das Rezept für Autoimmunität. Der fruchtbarste Erweiterungs-Korridor (#1 + #6 als Paar).
