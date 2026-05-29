---
title: Wissenschaftliche Evaluierung — Erweiterungen für NSAI-Edge
date: 2026-05-29
status: Evaluierungs-Dossier (kein Konzept-Delta, kein Code)
scope: nsai-edge
invarianten-regel: Abweichung nur bei dokumentiertem Vorteils-Überhang
---

# Wissenschaftlicher Evaluierungsbericht — Erweiterungen für NSAI-Edge

**Auftrag:** Sinnvolle, *neuartige* Erweiterungen nach Konzeptvorgaben + CDP5 evaluieren; Abweichungen nur mit dokumentiertem Vorteils-Überhang; wissenschaftlich, mit Ansätzen, die das System noch nicht probiert hat.

**Vier Kern-Invarianten (Bewertungsmaßstab):** zero-dependency · Offline-Autonomie · Node↔PHP-Fixed-Point-Parität · CRDT-Konvergenz.

## 1. Methode

Grundlage: vollständige Lektüre `KONZEPT.md` v2.4, Engine-Konstanten/Regel-Spec, Code-Inventur (269 Tests / 19 UCs), alle 18 Retros, 13 Websuchen + 4 Primärquellen-Fetches (Stand 2025/2026). Bewertung je Kandidat: Neuheit, Konzept-Konformität, Aufwand, Risiko, Wert (●●● hoch · ●● mittel · ● gering).

**Provenienz:** Abschnitt 3-E + die Verfeinerungen darin integrieren zwei NotebookLM-Berichte (2026-05-29), die selbst auf diesem Dossier + externen Quellen fußen. NotebookLM ist eine KI-Quelle → kritisch gefiltert: nur durch das Determinismus-/Invarianten-Gate bestätigte Punkte (✅) übernommen; abgelehnte/nicht-anwendbare Punkte mit Begründung in §6.1 festgehalten.

## 2. Ausgangsbefund — bereits gebaut (nicht erneut vorschlagen)

Forward-Chaining + JTMS-Retraktion (Slice 5) · tier-autoritäre Belief-Softmax (UC-12) · CRDT-max-Merge, trust-primäre Präzedenz (Slice 2) · Trust-Quorum-Endorsement, Cluster-Max/FoolsGold (M.1) · Personalized-PageRank-Hybridretrieval (Slice 3) · BM25/FTS5-Episoden (R3) · Bi-temporalität (Slice 5) · Spaced-Repetition-Decay (6.3) · Offline-Reject-Rate-Trust-Lernen (6.1).

### Strukturelle Hebel
- **H1 — Geteilte deterministische Power-Iteration:** PPR-Maschine (feste Summationsordnung über `triple_hash`) trägt auch EigenTrust (C1).
- **H2 — `user_rejected_at` ist ungenutztes, konfabulations-freies Trainingssignal:** sauber von System-Aktionen getrennt (6.1) → der lokale, exchangeable Kalibrierungs-Datensatz für D1/D2/D3.
- **H3 — „Magische Konstanten":** `contestedThreshold=150`, `quorumAuthFloor=4500`, `quarantineThreshold=300`, `beliefSharpness=3`, `demote*Threshold` sind handgesetzt → datengetriebene, garantiert-kalibrierte Ablösung möglich.

## 3. Kandidaten je Dimension

### A — Reasoning & Inferenz
- **A1 Defeasible-Argumentation (grounded extension, ASPIC⁺/Dung-light)** — Rebut/Undercut als Attack-Graph, grounded extension (eindeutig, polynomiell; arXiv 2309.12731). Konform (lokale Linse). Neuheit ●●● Wert ●● Aufwand ●●●. Mittelpriorität, am ehesten Erklärungs-Aufsatz über resolveBelief.
- **A2 Abduktives Backward-Chaining** — bei `unknown` minimale fehlende Prämissen als *Hypothesen* (quarantined) ausgeben; deterministisch, open-world-sicher (arXiv 2510.11462, 2512.07218). Konform. Neuheit ●●● Wert ●●● Aufwand ●● Risiko ●. **Starker Kandidat.**

### B — Retrieval & Gedächtnis
- **B1 Embedding-freie Semantik via PMI/SOC-PMI** — sparse PPMI aus Tripel-Ko-Okkurrenz + Episoden-Terme; deterministisch, zero-dep, lokale Linse wie PPR/BM25 (SOC-PMI; arXiv 2007.13273). Schließt deferred Alias/Stemming/Slice-3b. Neuheit ●●● Wert ●●● Aufwand ●●. **Top Retrieval.**
- **B2 Schema-Abstraktion / Regel-Induktion** — Frequent-Pattern-Mining → vorgeschlagene Regeln; nur als Vorschlags-Modus (Konfabulationsrisiko). Neuheit ●● Wert ●● Risiko ●●●. Niedrigere Priorität.

### C — Föderation & Trust
- **C1 EigenTrust-Linse (transitiver Trust)** — Power-Iteration über Endorsement-Graph, seed-verankert am lokalen Pre-Trust → bleibt lokale Lese-Linse, CRDT unberührt; renutzt H1 (Stanford EigenTrust; EigenTrust++ 2012). Konform alle 4. Neuheit ●●● Wert ●●● Aufwand ●●. **Top Föderation.**
- **C2 Subjective Logic / evidenz-theoretische Fusion** — Opinion ⟨belief,disbelief,uncertainty⟩, explizite Ignoranz-Masse; ändert Belief-Repräsentation → echte Abweichung (Parität/Output-Kosten). Vorteil überwiegt **derzeit nicht**. Zurückstellen.

### D — Lernen & Selbst-Kalibrierung
- **D1 Conformal Prediction für `verify()`** — `user_rejected_at` (H2) als Kalibrierungsmenge; Schwelle = ⌈α(ℓ+1)⌉-kleinster Nichtkonformitäts-Score; set-wertiges, kategorisches Verdikt mit Coverage-Garantie; deterministisch, integer-fähig (arXiv 2510.24754, 2605.08077). Ersetzt H3-Konstanten prinzipiell. Konform alle 4. Neuheit ●●● Wert ●●● Aufwand ●●. **Stärkster Gesamt-Kandidat (Flagschiff).**
- **D2 Selbst-kalibrierende Temporalität** — Decay-Klasse aus beobachteter Churn-Rate lernen. Auflage: `temporality` ist signiertes Wire-Feld → nur als **lokale `effective_temporality`-Linse** konform. Neuheit ●●● Wert ●● Aufwand ●●. Zweite Welle.
- **D3 Kalibriertes Active Learning** — ranke contested/quarantined nach Unsicherheit × PPR-Einfluss; schlägt informationsreichste Review zuerst vor (arXiv 2510.03162). Konform, read-only. Neuheit ●● Wert ●● Aufwand ●. Schleifenschluss.

### E — Quer-Dimensionen (aus NotebookLM-Stoßrichtungen)
- **E1 Meta-Kognition / Self-Monitoring (Dach)** — Kalibrierungs-Drift-Monitor (Brier/ECE auf Integer-Promille) vergleicht Belief gegen `user_rejected_at`-Wahrheit; löst Re-Kalibrierung (D1) / Review (D3) aus. mcp-doc-drift-gate = strukturelle Spielart (Zylos 2026; ASU Neuro-Symbolic Metacognition; Metagent-P ACL 2025). Konform. Neuheit ●●● Wert ●●● Aufwand ●●. **Narratives Zentrum.**
- **E5 MCP-Governance / Policy-Enforcement** — deklarative Cedar-artige Policy über MCP-Tools: Egress-Freigabe für pull/push/clone, Parameter-Caps (term-Länge, deferred 0015), Rate-Limits/DoS (DX Heroes 2026; NSA CSI MCP; arXiv 2604.05969, 2511.20920). Konform, zero-dep machbar. Neuheit ●●● Wert ●●● Aufwand ●●. **Sicherheits-Track.**
  - **Verfeinerung (NotebookLM ✅) — Deterministisches Gate als Tool-Call-Interceptor.** Sicherheits-Constraints aus dem flüchtigen LLM-Kontext in eine *persistente Interceptor-Schicht* ziehen (CSL-Core-Idee), die Tool-Calls vor der Ausführung deterministisch gegen ALLOW/BLOCK/ESCALATE prüft + lückenlos loggt (Auditierbarkeit). `mcp-doc-drift-gate` ist die strukturelle Spielart. **Umsetzung zero-dep** (eigene kleine Policy-Eval), keine schwere DSL-Runtime.
  - **Verfeinerung (NotebookLM ⚠️) — Formale Policy-Verifikation NUR zur Build-/CI-Zeit.** SMT-Solver (z.B. Z3) dürfen die Policy *vor Deploy* einmal auf Konsistenz / Erreichbarkeit jedes ALLOW-Pfads / Konfliktfreiheit (kein Input triggert ALLOW+BLOCK) beweisen — analog zum Conformance-Gate. **Im Runtime nur die kompilierte, deterministische Allow/Block-Tabelle auswerten.** Ein SMT-Solver im Runtime bräche zero-dep → ausgeschlossen.
- **E2 Cross-Language-Determinismus (Phase-2-Anker)** — RFC 8785 JCS als normative Referenz für Node↔PHP-Byte-Identität + MET-artige CRDT-Permutationstests (RFC 8785; CBOR Determinism; MET arXiv 2204.14129). Härtungs-Anker, keine Abweichung. **NotebookLM ✅ bestätigt:** sicherheitsrelevante Events (z.B. ein Gate-Event) propagieren mit Strong Eventual Consistency; kommutativ/assoziativ/idempotent ist seit Slice 2 (UC-08) erfüllt — Serialisierungs-Conformance ist der einzige offene Punkt und genau hier verankert.
- **E3 Vektor-Embeddings (kontrollierte Abweichung)** — *nach* B1, falls Recall unzureichend: nur agentenseitig außerhalb des Kerns, deterministischer Cache, liefern nur Kandidaten (Kern verifiziert), nie in Wire/Signatur/Belief (Hybrid-Muster WJAETS 2025; OLIVE 2025). Abweichung nur unter diesen drei Auflagen gerechtfertigt.
  - **Verfeinerung (NotebookLM ✅) — „So What?"-Layer / VectorOWL-Muster.** Die Vektorsuche ist reiner *Kandidatengenerator*; ein semantischer Validator prüft jeden Kandidaten gegen die existenziellen Graph-Invarianten, **bevor** ein State-Change committet — bei NSAI-Edge ist dieser Validator schlicht `verify()`. Deterministisches Embedding-Caching verhindert wiederholte probabilistische Alias-Evaluation. Das ist die saubere Trennung „Probabilistik schlägt vor, Determinismus entscheidet".
- **E4 Zwei orthogonale Decay-Achsen** — epistemische Achse (Volatilität → Rate, = D2) vs. Retentions-Achse (Abruf → Speicherstärke, FSRS-artig; FadeMem arXiv 2601.18642) explizit trennen; keine Achse hebt den belief/Autoritäts-Pfad. Schärft die in 6.3 latente Vermischung.
  - **Verfeinerung (NotebookLM ✅) — Promotion-Gate episodisch→prozedural.** Wissen wandert nur dann vom flüchtigen (episodisch, schneller Decay) in den permanenten (prozedural) Speicher, wenn es eine **formale Erdung** erfahren hat — d.h. `verify()` liefert `supported`. So verhindert das Langzeitgedächtnis Belief-Inflation durch reine Abrufhäufigkeit; die Promotion ist an einen deterministischen Verifikations-Beweis gekoppelt, nicht an Frequenz.

## 4. Abweichungs-Ledger

| Kandidat | Invariante | Abweichung? | Vorteils-Überhang? |
|---|---|---|---|
| A1, A2, B1, C1, D1, D3, E1, E2, E5 | — | Nein (lokale Linse / read-only / Anker) | konform |
| B2 Schema-Induktion | „nie raten" | Ja, falls auto-asserted | nur als Vorschlags-Modus |
| C2 Subjective Logic | Parität + Output | Ja (neue Repräsentation) | NEIN, derzeit nicht |
| D2 / E4-Retention | Fixed-Point-Signatur | Ja, falls Wire-Feld mutiert | nur via lokaler Linse |
| E3 Embeddings | zero-dep + Determinismus | Ja (Dep + Probabilistik) | nur eingehegt (agentenseitig, Cache, Kandidaten-only) |

**Lehre:** Die wertvollsten Kandidaten (D1, C1, B1, A2, E1, E5) brauchen **keine** Konzept-Abweichung — sie verlängern das tragende Muster „Trust/Belief/Temporalität = lokale Lese-Linsen über dem konvergenten Wire-Wert".

## 5. Priorisierte Synergie-Roadmap

1. **E1 Meta-Kognition (Dach) + D1 Conformal** — selbst-überwachende Kalibrierung
2. **C1 EigenTrust-Linse** — transitiver Trust, renutzt H1
3. **E5 MCP-Governance** — Sicherheits-Track, bündelt deferred Caps
4. **A2 Abduktion + B1 PMI** — Reasoning-/Retrieval-Substanz
5. **D3 Active Learning** — Daten-Kreislauf (füttert E1/C1)
6. *(2. Welle)* E2 Phase-2-Anker · D2/E4 zwei Decay-Achsen · A1 Argumentations-Erklärung
7. *(bedingt/zurückgestellt)* E3 Embeddings (eingehegt, nach B1) · C2 Subjective Logic · B2 Auto-Schema

Synergie-Cluster D1+D3+C1+E1 läuft auf *einem* Signal (H2) und *einer* Maschine (H1).

## 6. Anti-Pattern (bewusst NICHT)
- Keine ML-Embeddings im Kern (B1 ist der konforme Ersatz; E3 nur eingehegt).
- Keine Mutation signierter Wire-Felder (`temporality`/`asserted_at`/`asserted_confidence`) — Selbst-Kalibrierung nur als lokale Linse.
- Keine numerischen Belief/Quorum-Werte im Output — Conformal-Verdikte bleiben kategorisch.
- Kein Auto-Assert gelernter Regeln (B2) — nur Vorschlags-Modus.

### 6.1 Aus NotebookLM gefiltert — abgelehnt / nicht anwendbar
- **❌ SMT-Solver (Z3) im Runtime** — externe Dependency, bräche zero-dep. Nur als Build-/CI-Gate zulässig (siehe E5-Verfeinerung).
- **❌ PN-Counter (CRDT) für Trust/Belief** — ein Up/Down-Zähler ist genau die Anzahl-Inflation, gegen die das System designt ist (Leitplanke „Anzahl zählt nie"; Echo-Kammer-Neutralisierung M.1; Sybil-Schutz). Höchstens für *nicht-epistemische* Ressourcen-Metrik, nie für Vertrauen.
- **❌ OAuth-Proxy via Cloudflare Workers/KV (DCR-Problem)** — Konzept-Scope „Nicht enthalten: Cloud-Hosting"; der MCP-Server ist lokal (stdio), kein OAuth/DCR-Problem. Nur relevant bei einem hypothetischen remote-authenticated MCP-Server (nicht geplant).
- **❌ „FF-Layers als Key-Value-Memories / Residual Connection"** — beschreibt Transformer-Interna eines LLM, nicht die symbolische SQLite-Engine. Kategorienfehler, nicht im Konzept führen.
- **⚠️ Unbelegte Kennzahlen** (z.B. „Instruction-Drift 8–12 %") — nur als „berichtete Größenordnung" behandeln, nie als Fakt zitieren; sonst importiert man genau die Konfabulation, gegen die das System gebaut ist.

## 7. Empfehlung
Flagschiff **D1 (Conformal)** unter dem Dach **E1 (Meta-Kognition)**. Nächster Schritt (wenn gewünscht): CDP5-Konzept-Delta (UC + AC-Tabellen) für D1/C1/A2 — kein Code ohne Konzept-First.

## Quellen
- Defeasible Reasoning / KG: https://arxiv.org/pdf/2309.12731 · https://arxiv.org/html/2510.11462 · https://www.arxiv.org/pdf/2512.07218
- Conformal / Kalibrierung: https://arxiv.org/html/2510.24754 · https://arxiv.org/html/2605.08077 · https://www.arxiv.org/pdf/2510.03162
- EigenTrust: https://nlp.stanford.edu/pubs/eigentrust.pdf · https://faculty.cc.gatech.edu/~lingliu/papers/2012/XinxinFan-EigenTrust++.pdf
- PMI / embedding-frei: https://www.researchgate.net/publication/228615350 · https://arxiv.org/pdf/2007.13273
- Subjective Logic / DST: https://arxiv.org/html/2508.08075
- Memory/Decay: https://arxiv.org/pdf/2601.18642 · https://arxiv.org/pdf/2603.14517
- Meta-Kognition: https://zylos.ai/research/2026-03-14-metacognition-ai-agent-self-monitoring-adaptive-control/ · https://neurosymbolic.asu.edu/metacognition/ · https://aclanthology.org/2025.findings-acl.1169.pdf
- MCP-Governance: https://dxheroes.io/insights/mcp-governance-landscape-early-2026 · https://www.nsa.gov/Portals/75/documents/Cybersecurity/CSI_MCP_SECURITY.pdf · https://arxiv.org/pdf/2604.05969 · https://arxiv.org/pdf/2511.20920
- Cross-Language-Determinismus: https://www.rfc-editor.org/info/rfc8785/ · https://cborbook.com/part_2/determinism.html · https://arxiv.org/pdf/2204.14129 · https://www.arxiv.org/pdf/2511.22010
- Hybrid Neuro-Symbolic / Embeddings: https://wjaets.com/sites/default/files/fulltext_pdf/WJAETS-2025-0491.pdf · https://journals.sagepub.com/doi/10.1177/15705838251329268
