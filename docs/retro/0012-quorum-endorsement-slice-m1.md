# Retro-ADR 0012 — Trust-Quorum-Endorsement (NSAI-Edge Slice #M.1)

**Status:** abgeschlossen · autonom + self-merged (PR #12) · drei Adversarial-Audit-Runden
**Datum:** 2026-05-28
**Zweck:** Retrospektive des ersten Slice unter Stefans Klarstellung „weg von plumpen Halluzinationen, hin zu menschenähnlichem Gedächtnis mit Stärken aber ohne Schwächen". Multi-Source-Konsens-Verstärkung als deterministisches Trust-Quorum.

## Kontext
Stefans Frage am Anfang: „Wenn man etwas mehrfach hört, sollte das nicht die Glaubwürdigkeit erhöhen?" → triggerte die Erkenntnis, dass das aktuelle NSAI-Edge-Modell `triple_hash` origin-unabhängig dedupliziert und **keine** Konsens-Verstärkung kannte. Subjective Logic (Jøsang) als Frame, aber Stefans Constraint „kategorische Verdikte, keine Wahrscheinlichkeit" → Trust-Quorum statt probabilistischer Fusion.

## CDP5-geprüfte Architektur-Entscheidungen
- **Frame Subjective Logic übernommen, probabilistische Ausgabe verworfen.** Kategorisches Verdikt (`supported`/`contradicted`/`unknown`) bleibt das einzige API-Endprodukt — interne Aggregation in Promille×Tier-Skala, aber niemals als Float-Wahrscheinlichkeit nach außen.
- **Schema additiv** (neue Tabelle `triple_endorsements`, optionale `peers.cluster_id`) — `knowledge_edges` bleibt Single-Row pro Hash für `_edgeToWire`-Konsumenten, die das Konzept nicht kennen. Wire-Vertrag/PHP-Parität intakt.
- **Cluster-Independence-Filter manuell in #M.1** — dynamische Inferenz auf #M.2 deferred, weil ein automatischer Cluster-Detector hier mehr Risiko (Sippenhaft) als Nutzen brächte.
- **Echo-Schutz strukturell** durch Max-pro-Cluster (nicht Sum) — formal sauber, deterministisch, audit-bar.

## Entscheidungschronik
- **E1** — Web-Recherche RAG-2026 + Subjective-Logic-Frontier + Sybil-Defense (FoolsGold/FedSybil) + Wisdom of Crowds. Erkenntnis: unsere bestehende Architektur steht *näher* an RAG-2026-Gewinner-Patterns als ich dachte (HippoRAG 2 = unser PPR, signiert + deterministisch).
- **E2** — Konzept-First UC-MS mit Forschungs-Ankern, AC-Tabelle (12 ACs), Wertebereich aus §B zitiert, Aggregat-Formel formal, Restrisiko-Notizen (Cluster, Föderations-Race).
- **E3** — konzept-reviewer 8,4 → drei 🔴 (Aggregat-Formel-Schärfe, Cluster-Restrisiko, Föderations-Race-Pfad) alle dokumentations-seitig geschlossen + drei zusätzliche ACs (15.13–15.16). Glossar erweitert.
- **E4** — Implementation TDD: Schema, `_quorumFor`, `endorseTriple`, `endorsementsFor`, `_clusterIdOf`, `verify`-Quorum-Pfad, MCP-Tools.
- **E5** — Adversarial-Audit Runde 1: **NEIN.** Drei harte 🔴:
  - 🔴-1 Status-Konjunktion: `_quorumFor` prüfte `local_status` nicht → retracted Edge meldete weiter `supported`. **Echte Halluzinations-Quelle.**
  - 🔴-2 Doppel-supported: verify-Quorum short-circuit ignorierte resolveBelief-Konkurrenz → mehrere Objekte gleichzeitig `supported` für single-value-Prädikate = Konfabulation.
  - 🔴-3 as_of-Drift: `_quorumFor` ignorierte UC-BT — historische Anfragen sahen Zukunfts-Endorsements.
- **E6** — Fix Runde 1: `_quorumFor(hash, {as_of})` mit doppelter Sichtbarkeits-Klausel (active + UC-BT). verify-Quorum-Pfad mit resolveBelief-Konfliktcheck. Plus 🟡-1 (conformance.mjs-Spiegel), 🟡-2 (leerer Cluster-String). 5 Regressionstests.
- **E7** — Adversarial-Audit Runde 2: **NEIN.** Neuer 🔴 multiValue-Pfad: `hat_tag rot` + Quorum-Endorsement → `hat_tag blau` wurde fälschlich `contradicted`/`contested`. Standard-Spec hat 8 multiValue-Prädikate → wäre produktiv getriggert.
- **E8** — Fix Runde 2: multiValue-Guard in beiden verify-Quorum-Branches. Plus 🟡-B (`|| true` toter Branch entfernt), 🟡-C (`_tick()` aus endorse — kein VC im Schema, war Side-Effect-Bug). 🟡-A (Self-Endorsement-Restrisiko) in KONZEPT.md als Notiz.
- **E9** — Adversarial-Audit Runde 3: **safe JA.** Drei kleine 🟡-Doku-/Härtungs-Hinweise (kein Block). Empirisch verifiziert: multiValue-Fix sauber, _tick-Entfernung ohne Nebenwirkungen auf VC-Pfade, Status-Konjunktion bleibt bei retracted/quarantined/superseded scharf.
- **E10** — Self-Merge PR #12.

## Prozess-Lehre (Kern)
**Drei Audit-Runden waren nötig — und JEDE Runde fand etwas, das die vorherige übersah.**

- Runde 1: 3×🔴 — Status, Doppelwahrheit, as_of-Linse. Klassiker des „neuer Pfad ohne Wechselwirkungs-Check".
- Runde 2: 1×🔴 — multiValue-Pfad. Ich hatte multiValue im resolveBelief gewürdigt, aber im neuen Quorum-Pfad **vergessen**. Sycophancy-Lehre: ein bestätigender Reviewer hätte die multiValue-Lücke nie gefunden, weil die 13 AC-15-Tests grün waren — aber sie testeten nur single-value-Konstellationen.
- Runde 3: safe JA.

**Lehre:** Wenn ein neuer Lese-Pfad bestehende Semantiken (Status, valid-Time, multiValue) überlagert, müssen ALLE drei explizit als ACs+Tests durchgespielt werden. Es reicht nicht, „das System weiß doch schon, dass `hat_tag` set-valued ist" — der neue Pfad weiß es nicht von alleine.

**Stefans Klarstellung war wertvoller als jeder Reviewer:** „weg von plumpen Halluzinationen" gab die exakte Schwelle vor, an der Befunde 🔴 statt 🟡 wurden. Das gefährliche Verhalten (retracted Edge meldet supported, multiValue meldet contradicted) ist KONKRET Stefans definierte Halluzination — keine theoretische Drift, sondern Bruch des deklarierten Constraints.

## Inhaltliche Lehre
**Trust-Quorum mit Max-pro-Cluster ist das richtige Pattern für „Konsens ohne Echo".** Drei Bestätigungen aus derselben Quelle = 1 Cluster = 1 Beitrag. Drei aus verschiedenen Clustern = 3 Beiträge. Sybil neutralisiert via `trustRank(untrusted)=0`.

**Open-World ist verteidigt:** weder das Tripel ohne Endorsements (`unknown`) noch das Tripel mit retracted-Status (`unknown`) noch eine `as_of`-Anfrage vor dem Endorsement (`unknown`) leakt eine probabilistische Aussage. Verdikt bleibt kategorisch.

**multiValue ist ein Sonderfall, der explizit codifiziert sein muss.** Open-World heißt für set-valued-Prädikate: Abwesenheit eines bestimmten Tags ist `unknown`, nicht `contradicted`. Geschwister-Tags sind kein Konflikt.

## Offen
- **Slice #M.2 (deferred):** dynamische Cluster-Inferenz (Endpoint-Suffix, Key-Issuer, Verhaltens-Ähnlichkeit). Bis dahin bleibt `peers.cluster_id` manuell.
- **Trust-Decay:** schlechtes Verhalten erodiert trust_level über Zeit (Slice #M+).
- **Endorsement-Revocation:** explizites Zurückziehen eines Endorsements als eigener Wire-Type (Slice #M+).
- 🟡-Hinweise aus Runde 3 (Klarstellungs-Doku im KONZEPT, optionaler Härtungstest für _tick-Stabilität) — Backlog.
