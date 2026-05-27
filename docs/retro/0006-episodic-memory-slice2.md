# Retro-ADR 0006 — Episodisches Gedächtnis (NSAI-Edge Slice #2)

**Status:** abgeschlossen (Adversarial safe JA) · Branch `nsai-edge-episodic-slice2`, PR offen
**Datum:** 2026-05-27
**Zweck:** Retrospektive der zweiten §H-Roadmap-Verfeinerung: die episodische Schicht (NS-Mem) — Roh-Erlebnisse + Konsolidierung — und die erstmalige Integration von Web-Recherche in die Konzeptphase.

## Kontext
Nutzer: weiter im selben CDP5-Loop nach Slice #1 (TMS). Zusätzliche Vorgabe während der Phase: **Web-Recherche in die Konzeptphase einbeziehen, mehrere Lösungen evaluieren, aber immer validieren** (Web-Lösungen können Gefahren bergen). Ziel-Anker unverändert: NSAI-Edge als „Gehirn" (Roh-Erlebnis → verdichtetes Wissen mit Provenienz).

## Entscheidungschronik
- **E1 — Konzept-first UC-EP:** lokale/peer-private episodische Schicht (`episodes` + `episode_triples`), Konsolidierung = Provenienz-Link + Recency-Refresh, **kein** Count-Boost (Leitplanke/A4). lint 10/10; konzept-reviewer **7,8/10** → 🔴/🟡 eingearbeitet (Status-Unabhängigkeit der Links, verwaiste-Link-Behandlung, Atomarität, Recency-AC, Glossar).
- **E2 — Web-Validierung (neue Vorgabe):** Quellenvergleich (NS-Mem, FadeMem, ACT-R-Memory, SSGM, Memory-Poisoning-Literatur). Bestätigt: episodisch/semantisch + Provenienz/Audit + Recency + Föderations-Isolation. **Bewusst nicht übernommen:** Zugriffs-Frequenz in den Belief (kollidiert mit Leitplanke → nur belief-neutrale GC-Option, deferred). **Risiko verankert:** recall-`content` = untrusted Data (Memory-Poisoning-Injection-Vektor).
- **E3 — Umsetzung TDD:** additives Schema (IF NOT EXISTS, keine Rebuild-Migration), `recordEpisode`/`storeTriple+episode_id`/`recallEpisodes`/`episodesForTriple`/`episodicGc`, MCP-Tools. 102/102.
- **E4 — Adversarial-Review: safe JA + 1 🟡.** Alle Sicherheits-/Föderations-/Datenverlust-Achsen robust (inkl. Beweis: der Episode-Existenz-Guard ist load-bearing — ohne ihn würde eine FK-Verletzung den Tripel-Write zurückrollen). Korrektheitsbug: `recallEpisodes` escapte `%`/`_`, aber die `LIKE` hatte keine `ESCAPE`-Klausel → Sonderzeichen-Terme still leer. Gefixt + Regressionstest. 103/103.

## Prozess-Lehre (Kern)
**Web in der Konzeptphase = Stand der Technik + Risiko-Katalog, aber Validierung gegen die Projekt-Leitplanken ist Pflicht.** Die Forschung (FadeMem) hätte uns zu frequenz-gewichtetem Belief verleitet — direkt gegen Stefans „Aktualität statt Anzahl". Die kritische Trennung (Frequenz darf Retention/GC modulieren, NIE den Belief) hat den Konflikt aufgelöst statt ihn zu importieren. Und die Poisoning-Literatur lieferte einen konkreten Threat-Model-Vermerk (recall = untrusted Data). → [[feedback-websearch-in-concept-phase]].
Zweite Lehre (Wiederholung, bestätigt): der **ASCII-only-Testfall** verbarg den LIKE-Escape-Bug — der Adversarial-Review fand ihn über Sonderzeichen-Eingaben. [[feedback-green-tests-bypass-security]].

## Inhaltliche Lehre
Saubere Schicht-Trennung zahlt sich aus: weil Episoden **lokal/peer-privat** (nicht im Wire) sind, ist die ganze Föderations-/CRDT-/Signatur-Achse per Konstruktion unberührt (bit-identischer Wire mit/ohne Episode-Link bewiesen) — und Peer-Poisoning der episodischen Schicht ausgeschlossen. Ein FK auf `episodes` (CASCADE), aber bewusst **keiner** auf `edges` (GC-Freiheit) + definierte Orphan-Behandlung.

## Offen
- Slice #2b: LLM-Extraktion aus `content` (Agenten-Aufgabe); zugriffs-frequenz-bewusste GC-Retention (belief-neutral).
- §H-Roadmap: Slice #3 Hybrid-Retrieval (GraphRAG) — hier kommt die unscharfe/ähnlichkeitsbasierte Episoden- und Tripel-Suche.
- PR-Merge (Mensch).
