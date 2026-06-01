# Natur, Kognition & Alternativen — Synthese & Feature-Katalog

> **Explorations-Batch 2026-05-29** für NSAI-Edge. **Keine CDP5-Bindung** — bewusst breites, web-quellengestütztes Rohmaterial *für* das Konzept, **nicht** Konzept. Vorbild: `docs/Exploration/NotebookLM`. Erzeugt via 6 parallele Recherche-Agenten (interdisziplinär), die das Tool + die bereits evaluierten §I-Kandidaten kannten und *darüber hinaus* arbeiten sollten. Invarianten-Brüche sind **geflaggt, nicht gefiltert**.
>
> Anlass: „explorier neue Features wie ein Mensch / wie andere Tiere / mit alternativen Lösungen" + drei Stefan-Vertiefungen (Lüge/Wahrheit/Fiktion, „TrustLevel ersetzen?", kategorisches Denken & die „These").

## Die sechs Linsen
| # | Datei | Linse | Stärkster Beitrag |
|---|---|---|---|
| 01 | [Menschliches Gedächtnis](01-Menschliches-Gedaechtnis.md) | Neuro/Kognition | zwei orthogonale Achsen (storage/retrieval), Schlafphase, RIF, Reconsolidation, Metamemory |
| 02 | [Schwarm- & Tierintelligenz](02-Schwarm-und-Tierintelligenz.md) | kollektive Intelligenz | Bienen-Cross-Inhibition (value-sensitive Belief), Stigmergie-Retrieval, Physarum-Pruning, CRISPR |
| 03 | [Vertrauen, Immunität, Täuschung](03-Vertrauen-Immunitaet-Taeuschung.md) | Evolution/Immunologie | Danger-Theory-Quarantäne, Treg-Governor (Über-Quarantäne-Bremse), Defektor-Tracking |
| 04 | [Alternative Denk-Architekturen](04-Alternative-Denk-Architekturen.md) | KR/theoret. Neuro | **VSA/HDC** (einziger Kandidat, der ALLE Invarianten besteht), Predictive Coding, t-Normen |
| 05 | [Verteilte Koordination & Mensch-Agent-UX](05-Verteilte-Koordination-und-Mensch-Agent-UX.md) | verteilte Systeme + HAI | Hash-DAG (Sybil-immun + formales „Anzahl zählt nie"), **Mensch↔Agent-UX-Lücke** |
| 06 | [Lüge/Wahrheit/Fiktion & epistemischer Modus](06-Luege-Wahrheit-Fiktion-und-epistemischer-Modus.md) | Erkenntnistheorie/Logik | **Drei orthogonale Achsen** (Provenienz/Wahrheit/Modus), These, Kant, Tarski |

---

## Konvergente Quer-Themen (von mehreren Linsen *unabhängig* getroffen — das stärkste Signal)

1. **Zwei orthogonale Gedächtnis-Achsen.** Storage- vs. Retrieval-Stärke (Bjork), ACT-R base-level activation, FSRS-DSR — drei Linsen (01/04/05) landen unabhängig bei: `confidence` (signiert, ~Wahrheits-Anspruch, steigt nur) vs. eine lokale `activation`/Retrievability-Linse (zerfällt). **Bestätigt + fundiert den bereits evaluierten §I-Kandidaten E4** mit drei konvergenten Theorien.
2. **Drei orthogonale *Wissens*-Achsen.** Provenienz-Autorität (TrustLevel — korrekt) · Wahrheitswert (nie intern entscheidbar, nur approximierbar) · Assertions-Modus (behauptet/vermutet/notwendig/fiktiv). Linse 06, gestützt von 01 (Source-Monitoring, Verbatim/Gist). **Das zentrale neue Ergebnis** — siehe Dok 06.
3. **„Anzahl zählt nie" bekommt einen *formalen* Unterbau.** Bienen-Cross-Inhibition (max-artig, 02), Hash-DAG-Independent-Roots + Diversity-Prediction-Theorem (05), Image-Scoring-Caveat (03), VSA-Similarity-≠-Konfidenz (04) — vier Wege, die Invariante von einem Vorsatz zu einer *berechenbaren* Eigenschaft zu machen (unabhängige Wurzeln statt Quellen-Count).
4. **Überraschung / Prediction-Error als Update-Tor.** Reconsolidation-PE-Gating (01) + Predictive-Coding-Präzision (04) konvergieren: Belief ändert sich proportional zu Präzision × Surprise — kleine Abweichung → Reinforce, große → Revision; Anti-Flapping eingebaut.
5. **Offline-Konsolidierung („Schlafphase").** Sharp-Wave-Replay (01) als Batch-Träger für Episode→Semantik-Promotion, RIF-Aufräumen und Re-Inferenz — entkoppelt teure Operationen vom Online-Pfad (determinismus-freundlich).
6. **Immun-Architektur in zwei Schichten + Bremse.** Restriction-Modification (angeboren, billig) + CRISPR-Spacer (adaptiv, gelernt) als Eingangs-/Gedächtnis-Abwehr (02/03), Danger-Theory statt self/non-self, Treg-Governor gegen Über-Quarantäne (03).
7. **Retrieval als adaptives, nutzungsgetriebenes System.** Stigmergie-Pheromon-Layer (02) + Physarum-Topologie-Pruning (02) + ACT-R-Spreading-Activation-Buffer (01/04) — Retrieval-Pfade verstärken sich durch Nutzung, totes Wissen sinkt (ohne Löschen).
8. **Die Mensch↔Agent-UX-Schicht fehlt ganz.** Transactive Memory, Kuratierungs-Transparenz, kategoriale Konfidenz-Präsentation, proaktives Erinnern (05) + Belief-Kategorien aus kategorialer Wahrnehmung (06). Billig (Lese-/Präsentations-Layer), hoher Vertrauens-Gewinn.

---

## Feature-Katalog (Naturvorbild/Theorie → NSAI-Edge-Hebel)

Spalte „Inv." = grobe Invarianten-Verträglichkeit (✅ sicher / ⚠️ mit Auflage / 🔴 bricht eine harte Invariante, nur als Rohmaterial). „Roadmap" = Bezug zu bestehenden §H/§I-Kandidaten.

| Vorbild | NSAI-Edge-Hebel | Inv. | Roadmap-Bezug |
|---|---|---|---|
| ACT-R / Bjork / FSRS | `activation`-Achse neben `confidence` (storage/retrieval) | ✅ | **E4** (zwei Decay-Achsen) — fundiert |
| Kant-Modalität + Searle/Lewis | `assertion_mode` {problematic/assertoric/apodictic} + `suspended` | ✅ | **neu** |
| de Kleer ATMS + Lewis | `world`/`context`-Scopes (Fiktion/Hypothese isoliert) | ✅ | **neu** |
| Tarski + Wahrheitstheorien | Mehrsignal-`verify()` {korrespondenz, kohaerenz, konsens} | ✅ | erweitert UC-V |
| Frankfurt „On Bullshit" | `truth_orientation`-Flag (llm = truth-indifferent, kein Faktum-Aufstieg ohne Korroboration) | ✅ | erweitert source_type |
| „These" / Toulmin / Dung | `epistemic_status` + `supports`/`rebuts`-Kanten | ✅ | **A1** (Defeasible) — liefert UC-Bedarf |
| Aristoteles A/E/I/O | `quantity`/`polarity` (Falsifizierbarkeit, closed-world-Inseln) | ✅ | erweitert UC-V |
| Rosch / kategoriale Wahrnehmung | Belief-Kategorien als Projektion der Konfidenz (verbürgt/…/zweifelhaft) | ✅ | UX, vgl. B5 |
| VSA / Hyperdimensional Computing | holographische Tripel-Vektoren (SHA-Seed, integer), Cleanup-Retrieval, Analogie via Unbinding | ✅ | **ersetzt E3-Bedarf**, ergänzt B1 |
| Sparse Distributed Memory | inhaltsadressierbares, tippfehler-robustes Recall | ✅ | ergänzt B1/Retrieval |
| Bienen-Cross-Inhibition | value-sensitive Belief-Resolution (Rival-Dämpfung, Pitchfork) | ⚠️ | ersetzt/erweitert UC-12 |
| Quorum-Hill-Response | sigmoide Quorum-Schwelle (Evidenzstärke, nicht Count) | ⚠️ | erweitert UC-MS |
| Stigmergie-Pheromon | usage-Layer auf Kanten (Retrieval-Ranking, verdunstet) | ⚠️ | erweitert UC-HR (PPR) |
| Physarum | Topologie-Pruning → cold-storage-Tiering (kein Delete) | ⚠️ | **neu** (Skalierung) |
| Reconsolidation / Predictive Coding | PE-/präzisions-gated Belief-Update | ⚠️ | erweitert UC-12/TMS |
| Sharp-Wave-Replay | Idle-„Schlafphase": Batch-Konsolidierung + Re-Inferenz | ⚠️ | bündelt UC-EP + Inferenz |
| Retrieval-Induced Forgetting | aktive Suppression überstimmter Konkurrenten (activation) | ⚠️ | erweitert Decay/UC-12 |
| Matzinger Danger-Theory | Danger-Score statt fremd→Quarantäne | ⚠️ | erweitert UC-05 |
| Regulatorische T-Zellen | Treg-Governor (Über-Quarantäne-Bremse, Meta-Regelkreis) | ⚠️ | passt zu **E1** Meta-Kognition |
| CRISPR-Spacer + RM | zweistufige Immunabwehr (angeboren + adaptives Muster-Gedächtnis) | ⚠️🔴 | erweitert UC-05/UC-09 (Zensur-Risiko!) |
| Vampirfledermaus-Reziprozität | dyadische Reziprozitäts-Bilanz für Trust-Adjustment | ⚠️ | erweitert **6.1** (Trust-Adjust) |
| Hash-DAG (Kleppmann) + Diversity-Theorem | kausaler Hash-DAG: Sybil-immun + „unabhängige Wurzeln" = formales „Anzahl zählt nie" | ⚠️ | erweitert UC-08/UC-MS, vgl. C3 |
| Merkle-Search-Tree | O(log n)-Anti-Entropy + 1-Hash-Gesundheits-Fingerprint | ✅ | erweitert UC-06/07, vgl. E2 |
| Transactive Memory (Wegner) | „Wer-weiß-Was"-Zuständigkeits-Index + Routing | ✅ | **neu** (UX/Föderation) |
| Forgetting-by-Design | Tombstone-Tripel + Krypto-Shredding + Vergessens-Audit | ⚠️ | **neu** (Privacy/GDPR) |
| Proaktives Erinnern (Extended Mind) | Konflikt-Frühwarnung beim Kontext-Eintritt | ⚠️ | **neu** (UX) |
| Klonale Selektion | generative Reconciliation-Hypothesen (Self-Critique) | 🔴 | erweitert UC-SC (stark flaggen) |
| REM-„Träumen" | Hypothesen-Sandbox aus fernen Kanten | 🔴 | **neu** (nur Sandbox) |

---

## Priorisierungs-Heuristik (für das spätere Konzept, nicht bindend)

- **Invarianten-sichere Quick Wins (✅, kaum Konzept-Risiko):** `assertion_mode` + `world`-Scopes (Dok 06, Hebel 1+2) · Belief-Kategorien-Projektion (B5/Rosch) · Mehrsignal-`verify()` · VSA-Retrieval-Schicht (Dok 04 — der „seltene Volltreffer") · Merkle-Search-Tree-Anti-Entropy · Transactive-Memory-Routing. Diese verlängern das tragende Muster ohne Invarianten-Bruch.
- **Mittel (⚠️, brauchen Slice-Design + ggf. adversarial-auditor):** Cross-Inhibition/Hill-Quorum (Belief-Pfad → 🔴-Auditor) · Danger-Score + Treg-Governor · Stigmergie/Physarum-Retrieval · Schlafphase · Hash-DAG (Architektur-Eingriff).
- **Bewusst Rohmaterial / hohes Risiko (🔴):** generative Hypothesen (klonale Selektion, „Träumen") — nur in nie-replizierter Sandbox mit Endorsement-Gate · föderiert geteilte CRISPR-Blocklists (Zensur-/Trust-Laundering-Vektor) · jede „uninformed-ballast"-Aufweichung von „Anzahl zählt nie".

## Was bewusst Rohmaterial bleibt
Mehrere Ideen brechen eine harte Invariante (geflaggt mit 🔴/❌ in den Dokumenten): generatives Hypothesen-Raten (vs. „Nie raten"), Stimmen-/Dichte-Akkumulation (vs. „Anzahl zählt nie"), Float-Pfade im föderierten Wire (vs. Determinismus), neue Belief-Repräsentationen im Wire (vs. Parität, vgl. abgelehntes C2 Subjective Logic). Sie stehen hier als **Denkanstöße**, nicht als Empfehlungen — die Stefan-Barriere-Schicht (§I.6) und das Drei-Achsen-Prinzip filtern sie im Konzept.

## Anschluss ans Konzept
Dieser Batch ist **Rohmaterial** (wie die NotebookLM-Berichte): zu übernehmen ist nur, was die Stefan-Barriere (§I.6) bestätigt; Abgelehntes mit Begründung verzeichnen (§I.5-Muster, „Pushback erwünscht"). Konkreter nächster Schritt wäre — Concept-First — ein **CDP5-Slice-Konzept (UC + AC-Tabellen)** für die invarianten-sicheren Quick Wins, allen voran das **Drei-Achsen-Modell aus Dok 06** (`assertion_mode` + Welten + Mehrsignal-`verify`), das die meisten Folge-Ideen erst sauber einrahmt.
