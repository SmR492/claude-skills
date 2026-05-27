# Retro-ADR 0007 — Deterministisches Hybrid-Retrieval (NSAI-Edge Slice #3)

**Status:** abgeschlossen (Adversarial safe JA) · Branch `nsai-edge-retrieval-slice3`, PR offen
**Datum:** 2026-05-27
**Zweck:** Retrospektive der dritten §H-Roadmap-Verfeinerung: query-first-Retrieval via lexikalische Seeds + belief/trust-gewichtete Personalized PageRank — **rein deterministisch** (Nutzer-Entscheidung).

## Kontext
Weiter im CDP5-Loop. Nutzer-Vorgaben dieser Phase: (a) **rein deterministisch** (keine Vektor-Embeddings), (b) **Web-Recherche in der Konzeptphase, kritisch validiert**, (c) Suchanfragen mit dem **laufenden Jahr (2026)**. Ziel: „die richtige Antwort ODER den Weg dahin" auch ohne exakten Knotennamen.

## Entscheidungschronik
- **E1 — Web-validierte Designgabel:** lexikalisch + Personalized PageRank (Vorbild HippoRAG) statt Vektor-Embeddings (extern/LLM → bricht Determinismus). **Gefahr erkannt (Meta-Analyse 2025/26):** GraphRAG-Gewinne werden überschätzt → exakter Lookup bleibt primär, PPR ist Anreicherung. **2026-Befund:** Hub-Dilution (hochgradige Knoten verwässern PPR) → via k-Hop-Schranke + Konfidenz gedämpft.
- **E2 — Konzept-first UC-HR:** lint 10/10; konzept-reviewer **7,35/10** → 🔴/🟡 eingearbeitet: Determinismus-Härtung (feste Kanten-Summationsordnung nach triple_hash + stabiler Tie-Break — IEEE-754-Nicht-Assoziativität!), eindeutiger Tripel-Score `(r_subj+r_obj)×weight`, k-Hop-Subgraph (Perf/Hub), Parameter-Tabelle, `converged`-Flag, Konvergenz-Mathematik (d=0.85 → tol=1e-6/max_iter=100).
- **E3 — Umsetzung TDD:** `search()` (Seed→k-Hop→PPR→Ranking→Hybrid mit Episoden), MCP-Tool. Lokale read-only Lese-Linse (nicht föderiert, kein Wire).
- **E4 — Adversarial-Review: safe JA.** Determinismus über 200+ Permutationen + Massenerhaltung (Σr=1, err≤4e-16) + Read-only + Injection empirisch bestätigt. 3 🟡 gefixt: Param-Klemmung (max_hops/max_iter/tol — CPU-DoS), und v.a. **🟡-3 Trust-Diskont**: Ranking nutzte rohe `confidence` → ein limited/niedrig-vertrauter Peer hätte über Föderation fälschlich oben ranken können. Fix: Kantengewicht = `confidence × trustFactor(originTrust)`. 116/116 grün.

## Prozess-Lehre (Kern)
**Determinismus-Anspruch ≠ feste Knotenordnung allein.** Der Reviewer fand, dass IEEE-754-Addition nicht assoziativ ist → unsortierte `_activeEdges` machten die PPR-Summation insert-abhängig. Erst die feste **Kanten**-Summationsordnung (triple_hash) + stabiler Tie-Break machen das Ranking reproduzierbar. Float-Determinismus ist subtiler als „sortiere die Knoten".
**Relevanz ≠ Glaubwürdigkeit.** Der Adversarial-Review deckte auf, dass Retrieval-Relevanz und Belief-Auflösung auseinanderfallen können (rohe confidence vs. trust-primäre Belief-Linse). Lösung: trust-diskontierte Relevanz + klare Konzept-Trennung (`search` = was ist relevant, `resolveBelief` = was gilt). [[feedback-green-tests-bypass-security]] erneut bestätigt: die Tests prüften nur den Single-Peer-Fall, der Föderations-Fall war der blinde Fleck.

## Inhaltliche Lehre
PPR als lokale Float-Lese-Linse ist legitim (wie resolveBelief) — Determinismus ist hier „reproduzierbar innerhalb einer Engine", nicht Cross-Language-Bit-Identität (das gilt nur für den föderierten Wire). k-Hop-Begrenzung löst Perf UND Hub-Dilution in einem. Web-Forschung lieferte sowohl die Methode (HippoRAG/PPR) als auch die nötige Skepsis (Meta-Analyse: nicht überverkaufen).

## Offen
- Slice #3b: echte semantische Ähnlichkeit (Vektor-Embeddings, extern/LLM — Agentenseite); Hub-Cap/Grad-Normalisierung.
- §H-Roadmap: Slice #4 (gelernte Gewichtung) bleibt letzter Punkt — Determinismus-Gate beachten.
- Slice #1b (OUT→IN), Slice #2b (LLM-Extraktion). PR-Merge (Mensch).
