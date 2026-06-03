<!-- Von `nsai-init` verwalteter Block. Nicht von Hand editieren — `nsai-init` aktualisiert ihn. -->
## NSAI-Edge — Wissensbasis (Tier 1) & Wissens-Abruf-Doktrin

Die **etablierte Wissensbasis** ist `nsai-edge` (lokaler Defeasible-Wissensgraph als MCP-Server). Sie deckt das *WAS* (provenienz-getrackte Fakten/Wissen) ab — komplementär zur CDP5-**Konzept**doktrin (*WIE*: Prozess/Form). MCP-Tools tragen den `graph__`-Präfix (Harness-vollständig: `mcp__nsai-edge__graph__…`).

### 1. Faktischer Inhalt — kaskadierende Quellen-Hierarchie
(für **nicht-triviale Fakten der Projekt-/Domänen-Ebene**: Behauptungen, Definitionen, Zahlen, technische Constraints — das *WAS*; triviale/universelle Fakten wie Sprach-Syntax brauchen KEINEN Lookup):

1. **Tier 1 — `nsai-edge` (NUR via MCP):** primäre Wahrheitsquelle für kuratiertes Projekt-/Domänen-Wissen. **Kein DB-/Daten-Datei-Direktzugriff** — der MCP-Server ist die einzige gegatete Trust-Boundary. **read-before-act** — vor nicht-trivialer Arbeit zuerst hier nachschlagen: `graph__query_knowledge` · `graph__search` · `graph__resolve_belief` (liefert Gewinner + `contested`/`contestation`) · `graph__recall_episodes` · `graph__verify` · `graph__trust_of`. Belief-Verdikte sind **defeasible**: `contested`/Provenienz mitlesen, nicht blind als wahr nehmen.
2. **Tier 2 — Web / externe Docs (WebSearch/Fetch, context7):** wenn Tier 1 nicht ausreicht — aktuelle/externe Fakten + Bibliotheks-Doku.
3. **Tier 3 — internes Trainingswissen:** NUR letzter Fallback, wenn 1+2 erschöpft sind; als unbestätigt kennzeichnen.

**Rückschreib-Pflicht (Wissens-Akkumulation):** Was in Tier 1 FEHLTE, aber über Tier 2 gefunden wurde, MUSS **verifiziert** (gegen Leitplanken + Realität, nie blind übernehmen) und dann **VOLLSTÄNDIG** (nicht fragmentarisch) via MCP eingetragen werden — mit Provenienz (Quelle + Quelltyp `web`/`fachquelle`), sodass es beim nächsten Lookup Tier 1 ist. So wächst der kuratierte Graph; das Modell rät nicht zweimal dasselbe. **Schreib-Tools:** kuratierte Fakten `graph__store_triple` (mit `source_type`-Provenienz) · Erkenntnisse/Verläufe `graph__record_episode` · Korroboration eines bestehenden Fakts `graph__endorse` (Anzahl-Achse, gedeckelt).

**Two-Door-Grenze (KI schreibt vs. Mensch vollzieht):** Die KI darf FREMDE Fakten/Trust NIE autonom herabstufen/retraktieren — gefährliche Änderungen laufen über `graph__propose_*` (`graph__propose_reject` · `graph__propose_supersede_temporal` · `graph__propose_set_validity` · `graph__propose_authority_endorse` · `graph__propose_peer_trust` · `graph__propose_promote_fiction`) → Mensch-Vollzug an der CLI (`review`/`approve`). Anfechtung via `graph__contest` (kippt nur das `contested`-Verdikt, senkt nie Trust). Eigene Fakten (self-origin) darf die KI direkt pflegen.

### 2. Form, Logik, Prosa — Modell direkt (kein Lookup)
Das *WIE* — syntaktisch korrekter Code/Struktur/Format; algorithmisches Schließen, Chain-of-Thought, Constraint-Auswertung; Satzbau, Ton, Übersetzung.

**Harte Grenze (Form ≠ Inhalt):** Modell-Parameter fürs *WIE*, die Tier-1–3-Hierarchie fürs *WAS*. So bleibt nachvollziehbar trennbar, was die KI *formuliert* und was als *Fakt* (provenienz-getrackt) behauptet wird — die Provenienz-/Autoritäts-Achse des Wissensmodells (Mensch/Autorität vs. KI/Ingest).
