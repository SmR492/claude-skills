# Konzept: Föderierter neuro-symbolischer Wissensgraph für Claude Code (NSAI-Edge)

**Version:** 2.4
**Stand:** Mai 2026
**Änderung ggü. v2.3 (siehe §F):** NSAI-Edge als **persistentes Gedächtnis** (Standard-Wissensablage statt Wiki/Traces) — Wissens-Ingestion (Struktur + tiefe Extraktion aus Tabellen/Key-Value), mehrwertige Prädikate von der Belief-Konkurrenz ausgenommen, query-first-Betriebsmodell.
**Änderung ggü. v2.2 (Implementierungs-Stand, siehe Delta-Section direkt unten):** Provenienz-Modell B (origin=Erstbehaupter, signiert, kein Re-Sign, Web-of-Trust-Verify) nach Pre-Merge-Review; **Evidenz-Gewichtung** (source_type-Autorität × Aktualität × Konfidenz → Belief-Verteilung) für Widersprüche, veraltetes + falsches Wissen.
**Änderung v2.2 ggü. v2.1:** Trust aus dem gemergten Föderationswert herausgezogen — gemergte Konfidenz ist trust-unabhängiger CRDT-Wert (überall identisch konvergent), Trust wirkt nur als **lokale Lese-Linse** (effektive Konfidenz) und lokale Konflikt-/Quarantäne-Entscheidung (R1); Integer-Divisions-Rundung normativ als **Trunkierung gegen Null** + „Periode"-Definition + Decay-Halbwertszeit-Beispieltabelle (R2); Merge-**Assoziativität** als AC (R3); Promille↔float-Roundtrip-Invariante an der Bundle-Grenze (R4); revozierter Peer × Re-Push (R5).
**Änderung v2.1 ggü. v2.0:** Bundle-Schnittstelle gegen echten Quellcode verifiziert; Fixed-Point-Konfidenz; Clone-UC; Hash-Kanonisierung, Replay-Schutz, Key-Rotation.
**Scope:** Lokal laufender, voll funktionsfähiger neuro-symbolischer Wissensgraph-Knoten (Node.js MCP-Server), der Claude Code in-session strukturiertes Wissen liefert und sich bidirektional + dezentral (git-artig P2P) mit anderen Knoten — insb. dem PHP-`NeuroSymbolicAiBundle` — synchronisiert. Funktionale Parität mit dem Bundle; Drift verhindert durch sprachneutrale Regel-Spec + Cross-Language-Conformance-Vektoren **und** Fixed-Point-Arithmetik.
**Nicht enthalten:** Browser-GUI, eigene Benutzerverwaltung, Cloud-Hosting, Ablösung des PHP-Bundles. **Bundle-seitig neu zu bauen (separate Symfony-Arbeit):** Command `nsai:graph:ingest` (stdin-JSON → `LearningManager::ingestFact`) und `nsai:graph:export` (Graph → JSON für Clone) — existieren laut Verifikation noch nicht.

## v2.3 — Delta zum Implementierungs-Stand (normativ)

Diese Section hält den realen Code-Stand fest (Konzept↔Code-Alignment, Lehre aus Retro 0001).

### A. Provenienz-Modell B (nach Pre-Merge-Review)

- `origin_peer_id` = **Erstbehaupter** (wer den Fakt zuerst behauptet hat), nicht der letzte Hop.
- Signiert wird die **unveränderliche Aussage**: `[wire_version, triple_hash, subject, predicate, object, asserted_confidence, temporality, source_type, asserted_at, origin_peer_id, derived_from]`. **Nicht** signiert (Transport/lokal): `vector_clock`, `relayed_by`, der lokale Live-`confidence`.
- **Kein Re-Sign** beim Export — die Origin-Signatur bleibt erhalten. `relayed_by` = letzter Hop (unsigniert).
- Empfang verifiziert gegen den **Origin-Key** (Web-of-Trust: unbekannter Origin → reject). **Trust hängt am Origin, nie am Relay** → kein Impersonation/Trust-Laundering.
- `asserted_confidence` = signierter Origin-Wert (unveränderlich, föderiert). `confidence` = lokaler Live-Wert (Decay/Reinforcement, lokal).

### B. Evidenz-Gewichtung (neuro-symbolisch, Lese-Linse)

Konkurrierende Aussagen (gleiches Subjekt+Prädikat, verschiedenes Objekt) werden **nicht** hart quarantänisiert, sondern zur Lesezeit **tier-basiert** gewichtet (UC-12 `resolveBelief`):

```
effTier(claim)   = min( sourceTier(source_type), trustTierCap(originTrust) )   # HARTE Autoritäts-Stufe
withinWeight     = recency(asserted_at, temporality) × confidence × trustFactor(originTrust)/1000
recency(t, temp) = 2^(−Alter_in_Tagen / halflife[temp])   # eternal=∞ (kein Decay); stable lang; temporal/ephemeral kurz
# Nur die HÖCHSTE Tier-Stufe konkurriert um Belief; niedrigere Stufen → belief 0 (sichtbar als disputed).
belief(obj)      = withinWeight(obj)^beliefSharpness / Σ_top withinWeight(j)^beliefSharpness
```

- **Autorität ist eine HARTE Stufe** (`sourceTier`): `gesetz` 6 > `behoerde` 5 > `sensor` 4 > `fachquelle` 3 > `manual` 2 > `web` 1 > `llm`/`inference` 0. Eine höhere Stufe schlägt eine niedrigere **unabhängig von Anzahl, Alter oder Konfidenz** — ein gültiges altes Gesetz schlägt frisches Web. **Anzahl zählt nie** (max je Objekt, nicht Summe).
- **Trust-Deckel** (`trustTierCap`): ein Origin kann keine höhere Stufe behaupten, als sein Trust erlaubt (`limited` → max. Web-Stufe, `untrusted` → ausgeschlossen). So kann sich ein limited-Peer kein `gesetz` erschleichen (kein source_type-Spoofing).
- **Aktualität entscheidet nur INNERHALB derselben Stufe** (Recency-Decay, temporalitäts-gekoppelt) — Aktualität kann Autorität nie überstimmen.
- **Zukunfts-`asserted_at`** wird lokal geklemmt und föderiert (pull/clone) abgelehnt — keine Recency-Manipulation.
- **Trust-primäre Präzedenz auf BEIDEN Pfaden (Schreiben + Lesen):** sowohl die Provenienz-Übernahme im Merge (`mergeIncoming`) als auch die Belief-Auflösung (`resolveBelief`) ordnen lexikografisch nach `(Origin-Trust-Rang, effektive Stufe, …)`. Ein niedriger-vertrautes Incoming/Kandidat kann ein höher-vertrautes Edge weder in der Provenienz kapern noch im Belief auf 0 drücken — auch nicht per effTier-Sprung. **Innerhalb derselben Trust-Stufe dominiert die Autorität** (Gesetz schlägt Web), und die Live-Konfidenz wird nur durch full/authoritative-Beiträge angehoben. Damit ist die Klasse „untrusted/limited beeinflusst Belief-Werte eines höher-vertrauten Edges" auf allen Achsen (Tier, Konfidenz, Recency, Provenienz) und allen Pfaden geschlossen. Eigene Inferenz (self=full) ist geschützt.
- **Determinismus:** bei Belief-Gleichstand entscheidet ein wertbasierter Tiebreak (lexikografisch nach object) → föderationsweit gleicher Gewinner, unabhängig von der Ingest-Reihenfolge. Fällt die oberste Trust/Stufe komplett auf Gewicht 0, greift die nächste nicht-leere. (Hinweis: Recency allein wird nie exakt 0 — `2^(−Alter)` bleibt minimal positiv —, der Fallthrough greift praktisch nur bei `confidence=0`. „Aktualität überstimmt Autorität nie" ist damit auch im Grenzfall gewahrt: eine höher-vertraute/höher-autoritative, aber alte Quelle dominiert eine frische niedrigere weiterhin.)
- **Provenienz-Präzedenz trust-primär:** beim Merge desselben Hashes ist die Reihenfolge `(Origin-Trust-Rang, effektive Stufe, asserted_confidence, origin_id)`. Ein niedriger-vertrauter Origin übernimmt NIE den Record eines höher-vertrauten — auch nicht durch einen effTier-Sprung via source_type-Anspruch. (Die Belief-Auflösung zwischen VERSCHIEDENEN Objekten bleibt autoritäts-primär — andere Operation.)
- **Lokale Trust-Projektion (bewusst nicht-konvergent, wie `local_status`):** die gespeicherten Provenienz-Felder `origin_peer_id`/`source_type`/`asserted_at` können zwischen Knoten mit gespiegelten Trust-Zuweisungen abweichen (jeder Knoten behält den nach SEINEM Trust präzedenten Record). Der einzige deklariert-konvergente Föderationswert ist die Live-`confidence` (CRDT-max, trust-unabhängig); das signierte Wire bleibt überall identisch re-verifizierbar.
- **Veraltetes/falsches Wissen** sinkt im Belief gegen 0, bleibt aber gespeichert (auditierbar, revidierbar — non-monoton, BEWA-Stil). Decay senkt zusätzlich den Live-Wert.
- Query markiert überstimmte Aussagen als `disputed` + nennt das `dominant`-Objekt; eine Gruppe ist `contested`, wenn der Zweitplatzierte ≥ `contestedThreshold` Belief hält.
- **Float-Hinweis:** Scoring/Belief sind eine **lokale** Float-Lese-Linse — nicht föderiert, nicht conformance-relevant; die signierten/föderierten Werte bleiben Integer-exakt.
- Vorbild: NN-Attention (Relevanz-Gewichte statt Zählen) + BEWA (Bayesian Epistemology with Weighted Authority: Autorität + temporaler Decay + revidierbare Überzeugungen).

### C. Neue/erweiterte UCs

- **UC-12 `resolveBelief(subject, predicate)`** — gewichtete Belief-Verteilung über konkurrierende Objekte; Gewinner + Kandidaten mit `belief` (0–1000) + `contested`. MCP-Tool `graph__resolve_belief`.
- UC-08 (Merge): Widersprüche koexistieren aktiv (Belief entscheidet); Peer-Trust bleibt Sicherheits-Gate (untrusted-Origin → Quarantäne).

### D. Reinforcement-Semantik (Klärung)

Lokales Re-Erfassen (UC-01 gleicher Hash) und der Föderations-Merge nutzen **CRDT-max** auf der Konfidenz (monoton, deterministisch, reihenfolge-unabhängig) — bewusst NICHT additiv, damit Föderation konvergent bleibt. Additive Verstärkung ist der separate, **lokale, feedback-getriebene** Pfad `reinforce(hash)` (UC-26-Analog: 👍/Bestätigung erhöht um `reinforceDelta`, Deckel 1000). Damit ist „Reinforcement bei Wiederholung" erfüllt, ohne die CRDT-Konvergenz zu brechen.

### E. Bekannte offene Punkte (Phase 2, bewusst deferred — CDP5 §10.4)

Diese betreffen die **PHP-Gegenseite** und sind aus dem Node-Repo nicht baubar (separate Symfony-Arbeit):
- **`nsai:graph:ingest` / `nsai:graph:export`** im PHP-Bundle existieren noch nicht. Die **Node-Hälfte der Brücke ist fertig + sicher getestet**: HTTP-Transport (Node↔Node, real) + `bundleAdapter` (docker exec via `execFile`-Argument-Array, kein Shell-String, Container-Name validiert, SyncSkipped bei Nichterreichbarkeit). Sobald die zwei PHP-Commands stehen, ist die Bundle-Föderation ohne Node-Änderung lauffähig.
- **Cross-Language-Conformance (UC-10)** läuft Node-seitig; `phpVerified` bleibt `false`, bis ein `phpRunner` (docker exec) die identischen Vektoren in der PHP-Engine rechnet. Das Anti-Drift-Gate ist konstruiert, aber erst halbseitig verifiziert.
- **MCP-Föderations-Tools** (`pull`/`push`/`clone`) sind über CLI/HTTP-Transport nutzbar, aber noch nicht als in-session-MCP-Tools exponiert (async-Lifecycle). `peer_add`/`peer_trust` + alle Lese-/Schreib-Tools sind als MCP-Tools verfügbar.

Diese Punkte mindern die lokale Produktivnutzung (Ziele 1/2/4/5) nicht; sie betreffen die vollständige bidirektionale Bundle-Föderation (Ziel 3).

### F. NSAI-Edge als Gedächtnis — Wissens-Ingestion & Betriebsmodell (v2.4)

**Betriebsmodell:** NSAI-Edge ist die **primäre, persistente Wissensablage** ("Gedächtnis") für Claude Code — nicht mehr Wiki/Traces. Alles Besprochene/Programmierte/Entschiedene wird als Tripel eingepflegt; vor dem Antworten wird der Graph abgefragt (query-first), statt Dateien zu lesen. Über Sessions hinweg persistent (`~/.claude/nsai-edge/graph.db`).

**Wissens-Ingestion (UC-13):** Markdown-Wissen (Wiki + Brain-Backup `raw/` + Traces) wird in den Graphen migriert. Zwei Ebenen:
1. **Struktur** je Seite: `kategorie`, `gehoert_zu`, `ist_ein` (frontmatter type), `hat_tag`, `quelle`, `aktualisiert_am`, `verweist_auf` (Links), `hat_abschnitt` (Überschriften).
2. **Tiefe Domänen-Fakten:** aus **Markdown-Tabellen** (`Zeilen-Subjekt → Spalten-Header-Prädikat → Zellwert`) und **Key-Value-Zeilen** (`**Label:** kurzer Wert`, ≤80 Zeichen). So beantwortet das Gedächtnis inhaltliche Fragen (z.B. Package, Status, Entity-Felder, Config-Werte), nicht nur Struktur.

**Slug-Konvention:** Knoten = slugifizierter Titel/Wert (Umlaute transliteriert äöü→ae/oe/ue, Sonderzeichen→`_`, ≤160). Prädikate lowercase_underscore, `^[a-z_]{2,50}$` (keine Ziffern/Bindestriche). `source_type` der Ingestion: `wiki` / `backup` (Brain) / `trace` / `project` (Projekt-Selbstwissen).

**Mehrwertige Prädikate (set-valued):** `hat_tag`, `hat_abschnitt`, `verweist_auf`, `quelle`, `gehoert_zu`, `hat_wert`, `enthaelt`, `beispiel` sind **von der Belief-Konkurrenz ausgenommen** — mehrere Objekte sind gleichzeitig gültig (jedes belief 1000, kein `disputed`). Nur ein-wertige Relationen (z.B. `ist`, `betraegt`, `geregelt_in`) durchlaufen die Belief-/Widerspruchs-Auflösung.

**Recall vs. Precision:** die Tabellen-Extraktion ist bewusst recall-orientiert (lieber ein Fakt zu viel) — Rauschen wird über Konfidenz/Decay/Belief mit der Zeit abgewertet, nicht hart gefiltert.

**Precision-Bewertung (2026-05-27, gemessen):** Stichprobe über 12.141 Kanten ergab **~97% bedeutungstragende Relationen** — die Top-Prädikate sind echte Domänen-Relationen (`typ`, `status`, `kriterium`, `beschreibung`, `route`, `akteur`, `pflicht`, `test_klasse`, `verhalten`, `werkzeug`). „Geringwertig" sind nur ~42 `hat_wert`-Fallbacks (Header fehlte, Objekt aber sinnvoll) + ~289 Boolean-Objekte (`pflicht→Ja`) = ~2,7%, allesamt gültige Fakten. **Entscheidung:** KEINE destruktive Bereinigung des Bestands (würde gegen Recall>Precision wertvolle Fakten löschen). Precision-Verbesserung greift nur in der **künftigen** Ingestion: triviale Boolean-/Separator-Zellen werden übersprungen, der `hat_wert`-Fallback nur bei sinnvollem Objekt (≥3 Zeichen, kein reines Satzzeichen) gesetzt.

#### Akzeptanzkriterien (UC-13)
| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-13.1 | Jede Quelldatei (Wiki+Backup+Traces) ist als Knoten mit ≥1 Kante vertreten (Coverage 1:1) | Integration | ingest::coverage | grün |
| AC-13.2 | Mehrwertiges Prädikat (hat_tag) erzeugt kein `disputed`; alle Objekte belief 1000 | Unit | engine-local::multiValue | grün |
| AC-13.3 | Tabellen + Key-Value liefern abfragbare Domänen-Fakten (Package/Status/Entity-Felder) | Integration | ingest::deep | grün |

## Inhaltsverzeichnis

1. Architektur-Entscheidung (ADR-Kurzform)
2. Verifizierte Bundle-Schnittstelle
3. Rollen-Übersicht
4. Datenmodell (merge-fähig, content-adressiert, Fixed-Point)
5. Anti-Drift: Regel-Spec + Conformance-Gate
6. Use Cases (UC-01…UC-11)
7. Sicherheit & Bedrohungsanalyse
8. Technische Anhänge & Schemata
9. Glossar & Semantische Anker
10. Probabilistik-Statement
11. Vendor-Risiko-Statement
12. Verantwortungs-Matrix

## 1. Architektur-Entscheidung (ADR-Kurzform)

| Entscheidung | Wahl | Begründung / Konsequenz |
| --- | --- | --- |
| Kognitions-Ort | Voll-Parität lokal (Inferenz/Decay/Quarantäne in Node) | Offline-Autonomie; Claude Code arbeitet ohne laufendes Bundle. |
| Engine-Verhältnis | Zwei gleichberechtigte Engines (Node + PHP), gespiegelt | Beide implementieren dieselbe Regel-Spec (§5); Drift verhindert durch Conformance-Tests + Fixed-Point, nicht durch Codeteilung. |
| **Konfidenz-Darstellung** | **Fixed-Point: Integer-Promille 0–1000** | Decay/Merge in Integer-Arithmetik → Node und PHP bit-identisch; Conformance-Gate verlangt exakte Gleichheit (kein Epsilon). |
| Topologie | P2P/föderiert (git-artig: clone/pull/push/merge) | Jeder Knoten hält Voll-Replik; Bundle ist *ein* (Sonder-)Peer. |
| Mechanismus | MCP-Server | Pull/Föderation brauchen Hintergrund-Lifecycle. Fällt unter §33.3. |
| Transport | Signiertes JSON über HTTP(S); Bundle-Peer via `docker exec`-Adapter | Container-Name wird **konfiguriert** (kommt aus Host-App, nicht hartkodiert). |
| Clone-Trust | Bundle-Bestand läuft beim Clone durch Quarantäne, mit **Bulk-Promote** | Maximale Vorsicht (Entscheidung Stefan); Bulk-Promote hält großen Bestand handhabbar. |

## 2. Verifizierte Bundle-Schnittstelle

Gegen echten Quellcode geprüft (frischer Checkout, Mai 2026):

| Aspekt | Verifizierter Fakt | Folge |
| --- | --- | --- |
| Root-Namespace | `SmR492\NeuroSymbolicAiBundle\` (PSR-4 → `src/`) | alle Imports auf diesen NS. |
| Triple-Model | `SmR492\NeuroSymbolicAiBundle\Model\Triple` mit `fromArray/toArray/isValid`, Felder `subject,predicate,object,confidence,rawText` | Wire-Format mappt darauf. |
| Ingest | **Kein** CLI-Ingest; nur `LearningManager::ingestFact(Triple, string $source)` | Bundle-seitig `nsai:graph:ingest`-Command bauen (stdin → ingestFact). |
| Export | **Keine** Export-/Dump-Funktion vorhanden | Bundle-seitig `nsai:graph:export`-Command bauen (für Clone, UC-11). |
| Konfidenz-Feld | Edge = `weight` (float), Node = `impactScore`; `temporality` auf `KnowledgeNode` | Adapter mappt lokale Promille ↔ `weight`/`impactScore`. |
| DB | Keine DBAL-Festlegung im Bundle; Migrationen MySQL/MariaDB-typisiert (`TINYINT(1)`) | **nicht** auf PostgreSQL-Spezifika bauen. |
| Entities | `KnowledgeNode/Edge/Episode/InferenceRule/QuarantineVote/PersonalityProfile` — alle vorhanden | wie angenommen nutzbar. |
| Services | `LearningManager` (`ingestFact`,`runDecayCycle`,`processQuarantineVote`), `QuarantineManager` (`checkAndPromote`,`vote`,`autoPromote`), `ConflictResolver`,`BehaviorValidator`,`ForwardChainingEngine`(impl. `InferenceEngineInterface`) | Ziel-API für Adapter. `BackwardChainingEngine` hat abweichende Signatur (`infer(KnowledgeNode,int)`), impl. das Interface nicht. |
| Events | alle 6 vorhanden (`FactIngested/Promoted/Quarantined`, `DecayCycleCompleted`, `InferenceCompleted`, `FeedbackRecorded`) | Event-Hooks nutzbar. |
| Command-Prefix | `nsai:` (nicht `ai:`) | neue Commands als `nsai:graph:*`. |

## 3. Rollen-Übersicht

| Rolle | Scope | Beschreibung | Typische Person |
| --- | --- | --- | --- |
| `Developer` | Host-System | Erfasst/abfragt Wissen, autorisiert Peers, promotet Quarantäne. | Stefan Riedl |
| `LocalEngine` | Host (Node) | Voll funktionsfähige Engine + MCP-Server. | MCP-Daemon |
| `Peer` | Netzwerk | Fremder Knoten oder das Bundle (Sonder-Peer `authoritative` möglich). | Bundle / fremder Host |
| `System` | Automatisch | Hintergrund-Sync/Merge/Decay. | Cron / Session-Hook |

## 4. Datenmodell (merge-fähig, content-adressiert, Fixed-Point)

- `triple_hash` = SHA-256 über die **kanonische Serialisierung** (§8.3): `sha256( nfc(subject) ⟨US⟩ nfc(predicate) ⟨US⟩ nfc(object) )`, UTF-8 NFC-normalisiert, Trennzeichen `0x1F`, kein Trimming/Case-Folding (Identität ist case-sensitiv). Byte-identisch in Node und PHP.
- `confidence` = **Integer 0–1000** (Promille), gespeichert = **gemergter Föderationswert** (CRDT, trust-unabhängig → konvergiert auf allen Knoten identisch). Alle Operationen (Decay, Inferenz, Merge) Integer-Arithmetik.
- **Effektive Konfidenz** (nicht gespeichert, beim Lesen berechnet, UC-02): `effective = trunc(confidence × trust_factor(origin_peer) / 1000)`. Trust ist eine **lokale Linse über** dem konvergierten Wert, fließt nie in den gespeicherten/gemergten Wert ein. So bleibt der Föderationswert knotenübergreifend gleich, während jeder Knoten Fremd-Wissen lokal trust-gewichtet sieht.
- `temporality` ∈ {`eternal`,`stable`,`temporal`,`ephemeral`} — steuert Decay.
- `origin_peer_id` + `signature` (Ed25519) — wer hat zuerst behauptet.
- `vector_clock` (JSON {peer_id: counter}) — kausal vs. nebenläufig.
- `local_status` ∈ {`active`,`quarantined`,`superseded`} — **knoten-lokal, konvergiert bewusst NICHT** (anders als `confidence`/`vector_clock`): Trust-abhängige Quarantäne-/Widerspruch-Entscheidungen dürfen sich je Knoten unterscheiden. Zwei Knoten teilen denselben Föderationswert, aber evtl. unterschiedlichen `local_status`.
- `derived_from` (JSON [triple_hash…] + rule_id) — Erklärbarkeit; NULL = beobachtet.

## 5. Anti-Drift: Regel-Spec + Conformance-Gate

- **Normative Arithmetik-Regeln (gelten für beide Engines, R2):**
  - **Jede Integer-Division rundet per Trunkierung gegen Null** (`trunc`, nicht `round`/`floor` für Negative — Werte sind aber stets ≥ 0). Node: `Math.trunc(a/b)` bzw. `(a/b)|0`; PHP: `intdiv(a,b)`.
  - **„Periode" = ein Decay-Pass** (UC-04, typ. ein Session-Start-Hook). Decay rechnet pro Periode genau einen Tabellenschritt, nicht zeit-kontinuierlich.
  - Abgeleitete Konfidenz (UC-03): `trunc(min(Prämissen) × Faktor / 1000)`.
  - **Reinforcement (UC-04, additiv mit Deckel):** `confidence = min(confidence + reinforce_delta, 1000)`. **Trigger:** erneutes `graph__store_triple` (UC-01) ODER Pull (UC-06) mit identischem `triple_hash`. Default `reinforce_delta` = 50 ‰ (in der Spec überschreibbar). Additiv (nicht multiplikativ), damit auch niedrige Konfidenzen durch Wiederholung wachsen.
- **`nsai-rules.spec.json`** (Single Source of Truth, sprachneutral): Inferenzregeln; Decay-Tabelle (Promille-Reduktion **pro Periode** je Temporalität); Reinforcement-Faktor (Integer); Quarantäne-Schwelle (Promille); Konfidenz-Merge-Funktion (§UC-08); `trust_factor` je Trust-Level (0–1000).
- **Decay-Beispieltabelle** (normativer Startwert, in der Spec überschreibbar): Reduktion pro Periode — `eternal` = 0 (unverändert), `stable` = 5 ‰, `temporal` = 50 ‰, `ephemeral` = 200 ‰. Lösch-Schwelle = 50 ‰. `trust_factor`: `full`/`authoritative` = 1000, `limited` = 500, `untrusted` = 0 (→ Quarantäne, kein Merge-Beitrag).
- **`conformance-vectors.json`**: Input-Graph → erwarteter Output-Graph nach Inferenz/Decay/Merge. Beide Engines müssen **exakt gleiche** Integer-Outputs liefern (Fixed-Point + feste Rundung ⇒ keine Toleranz nötig). Vektor-Suite muss Grenzfälle abdecken (Promille-Unterlauf, leere Prämisse, Inferenz-Zyklus, Trunkierungs-Grenzwert) — Coverage-Mindestmaß als CI-Bedingung.
- CI-Gate (UC-10) blockt Merge bei Abweichung Node↔PHP↔Erwartung.

## 6. Use Cases

### UC-01: Semantisches Tripel lokal erfassen

**Akteur:** `Developer` · **Route/MCP-Tool:** `graph__store_triple` · **Kein LLM** (Tier 1)

#### Formularfelder

| Feld | Typ | Pflicht | Wertebereich |
| --- | --- | --- | --- |
| subject | Text | Ja | `^[\w\-\\.:]{2,160}$` |
| predicate | Text | Ja | `^[a-z_]{2,50}$` |
| object | Text | Ja | `^[\w\-\\.:]{2,160}$` |
| confidence | Zahl | Nein | Integer 0–1000 (Default 700) |
| temporality | Text | Nein | eternal/stable/temporal/ephemeral (Default stable) |
| context_slug | Text | Nein | `^[a-z0-9\-]{1,50}$` |

#### Verhalten

1. Claude Code erkennt eine dauerhafte Wissenseinheit, ruft das Tool auf.
2. Engine validiert (Regex + Range); Fehler → fail-closed.
3. Berechnet `triple_hash` (kanonisch, §8.3); öffnet SQLite, `BEGIN IMMEDIATE`.
4. Knoten anlegen falls fehlend; `origin_peer_id` = lokal, Ed25519-signieren, `vector_clock[self]++`.
5. Existiert `triple_hash`: Konfidenz per Merge-Regel (UC-08) zusammenführen; sonst neu (`active`).
6. COMMIT; gibt `{success, triple_hash, confidence, status}` zurück.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Regex/Range-Verletzung | `INVALID_PARAMETER_FORMAT`, fail-closed vor DB-Zugriff. |
| DB gesperrt | `DATABASE_LOCKED`, 3 Retries (200ms), dann 503. |
| Signatur-Schlüssel fehlt | `NO_PEER_IDENTITY`, Abbruch + Hinweis auf UC-09. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-1.1 | Neues Tripel legt beide Knoten an und signiert (Ed25519) | Integration | LocalStoreTest::testNodesCreatedAndSigned | grün |
| AC-1.2 | Identischer `triple_hash` führt Konfidenz zusammen statt Duplikat | Unit | LocalStoreTest::testHashCollisionMergesConfidence | grün |
| AC-1.3 | Regex/Range-Verletzung bricht vor DB-Zugriff ab (fail-closed) | Unit | LocalStoreTest::testInvalidFailsClosed | grün |
| AC-1.4 | Konfidenz außerhalb 0–1000 wird hart abgewiesen | Unit | LocalStoreTest::testConfidenceRangeEnforced | grün |

### UC-02: Lokalen Wissens-Graphen abfragen (Subgraph + Erklärung)

**Akteur:** `Developer` · **Route/MCP-Tool:** `graph__query_knowledge`

#### Formularfelder

| Feld | Typ | Pflicht | Wertebereich |
| --- | --- | --- | --- |
| query_term | Text | Ja | `^[\w\-\\.:]+$` |
| max_depth | Zahl | Nein | 1–3 (Default 1) |
| explain | Boolean | Nein | true → BackwardChaining-Kette mitliefern |

#### Verhalten

1. Claude Code ruft das Tool für semantischen Kontext auf.
2. `max_depth` > 3 → auf 3 begrenzt, Warnung im Header.
3. Rekursive CTE-Traversierung; Zyklen via `visited`-Set abgefangen.
4. Je Kante **effektive Konfidenz** berechnen (§4): `trunc(confidence × trust_factor(origin_peer) / 1000)` — lokale Trust-Linse, ändert den gespeicherten Föderationswert nicht.
5. `explain=true` → je inferiertem Fakt `derived_from`-Kette anhängen.
6. >25 Pfade → bei 25 kappen, `truncated=true`.
7. Kompaktes JSON zurück (Token-effizient), Konfidenz als effektiver Wert + Roh-Föderationswert.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Keine Treffer | `{nodes:[],edges:[],truncated:false,message:"No matching nodes found."}` |
| max_depth ungültig | `INVALID_DEPTH`, Default 1 (robust). |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-2.1 | Mehrebenen-Abfrage (Depth 2) liefert korrekte Beziehungen | Integration | QueryTest::testMultiDepth | grün |
| AC-2.2 | >25 Pfade hart gekappt, als truncated markiert | Unit | QueryTest::testTruncation | grün |
| AC-2.3 | Zyklen führen nicht zur Endlosschleife | Unit | QueryTest::testCycleSafe | grün |

### UC-03: Lokale Inferenz (Forward/Backward Chaining)

**Akteur:** `System` · **Route/MCP-Tool:** `graph__infer` · **Kein LLM** (Regel-Engine nach Spec §5)

#### Verhalten

1. Engine lädt aktive Regeln aus `nsai-rules.spec.json`.
2. ForwardChaining: kombiniert Tripel zu neuen Fakten; abgeleitete Konfidenz = `trunc(min(Prämissen-Promille) × Regel-Faktor / 1000)` (Integer, Trunkierung gegen Null gemäß §5).
3. Neue Fakten unter Quarantäne-Schwelle → `quarantined`.
4. Idempotenz: bereits abgeleitete Fakten aktualisieren, nicht duplizieren.
5. Gibt Anzahl neuer/aktualisierter Fakten zurück.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Regel-Spec fehlt/ungültig | `RULE_SPEC_INVALID`, fail-closed, keine Teil-Inferenz. |
| Konfidenz-Unterlauf (0) | Fakt landet in Quarantäne statt aktiv. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-3.1 | ForwardChaining erzeugt erwarteten Fakt aus Conformance-Vektor | Integration | InferTest::testForwardChainingVector | grün |
| AC-3.2 | Abgeleitete Konfidenz unter Schwelle → Quarantäne | Unit | InferTest::testLowConfidenceQuarantined | grün |
| AC-3.3 | Inferenz-Ergebnis Integer-identisch zum PHP-Bundle bei gleichem Vektor | Conformance | ConformanceTest::testInferParity | grün |

### UC-04: Decay & Reinforcement (zeitbasiert, Integer)

**Akteur:** `System` · **Route/MCP-Tool:** `graph__decay_pass`

#### Verhalten

1. Periodischer Lauf (Session-Start-Hook): reduziert `confidence`-Promille je `temporality` gemäß Integer-Halbwertszeit-Tabelle der Spec.
2. `eternal` unverändert; `ephemeral` zerfällt am schnellsten.
3. Konfidenz unter Lösch-Schwelle → `superseded` (nicht physisch gelöscht bis synchronisiert + GC, §8.4).
4. Reinforcement (§5, normativ): `confidence = min(confidence + reinforce_delta, 1000)` bei erneutem Store/Pull mit gleichem `triple_hash` (Default-Delta 50 ‰).
5. Gibt Statistik (zerfallen/verstärkt/superseded) zurück.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| DB gesperrt | `DATABASE_LOCKED`, sanfter Abbruch, kein UI-Fehler. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-4.1 | `temporal`-Fakt verliert Promille gemäß Spec-Tabelle (exakt) | Unit | DecayTest::testTemporalDecay | grün |
| AC-4.2 | `eternal`-Fakt bleibt unverändert | Unit | DecayTest::testEternalStable | grün |
| AC-4.3 | Decay-Ergebnis Integer-identisch zum PHP-Bundle bei gleichem Vektor | Conformance | ConformanceTest::testDecayParity | grün |
| AC-4.4 | Reinforcement addiert `reinforce_delta` mit Deckel 1000 (additiv, exakt) | Unit | DecayTest::testReinforcementAdditiveCapped | grün |

### UC-05: Quarantäne-Verwaltung (inkl. Fremd-Fakten)

**Akteur:** `Developer` (Review) / `System` (Einstellen) · **Route/MCP-Tool:** `graph__quarantine_review`

#### Verhalten

1. System stellt Fakten unter Schwelle ODER von nicht-voll-vertrauten Peers in Quarantäne.
2. `graph__quarantine_review` listet quarantänisierte Fakten mit Grund + Origin.
3. Developer: promote (→active) / reject (→superseded); optional Bulk-Promote je Peer (UC-11).
4. Widerspruch (gleiches subject+predicate, anderes object/Hash, beide hohe Konfidenz) → Konflikt-Marker; finaler Auflösungs-Schritt: Developer wählt gewinnendes object, Verlierer → `superseded`.
5. Gibt aktualisierte Status zurück.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Promote eines unsignierten Fremd-Fakts | `UNVERIFIED_ORIGIN`, Promote blockiert bis Signaturprüfung. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-5.1 | Fakt von nicht-vertrautem Peer landet automatisch in Quarantäne | Integration | QuarantineTest::testUntrustedPeerQuarantined | grün |
| AC-5.2 | Promote eines unsignierten Fakts wird blockiert | Unit | QuarantineTest::testUnsignedPromoteBlocked | grün |
| AC-5.3 | Widerspruch-Auflösung setzt Verlierer auf superseded | Integration | QuarantineTest::testConflictResolution | grün |

### UC-06: Wissen von Peer empfangen (Pull)

**Akteur:** `System` / `Developer` · **Route/MCP-Tool:** `graph__pull`

#### Verhalten

1. Kontaktiert autorisierten Peer (HTTP) bzw. Bundle-Adapter (`docker exec` → `nsai:graph:export`-Delta), holt Tripel seit letztem bekannten `vector_clock`.
2. Prüft je Tripel die Ed25519-Signatur gegen den Peer-Schlüssel (UC-09).
3. **Replay-Schutz:** eingehender Hash, der lokal `superseded` ist UND `vector_clock` ≤ bekannt → ignorieren (kein Revival).
4. Gültige Tripel → Merge (UC-08); Fremd-Fakten initial in Quarantäne je Trust-Level.
5. Aktualisiert lokalen `vector_clock` für den Peer.
6. Gibt Bilanz (empfangen/akzeptiert/quarantänisiert/abgelehnt/ignoriert) zurück.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Peer offline / Timeout | `PEER_UNREACHABLE`, lautloser Abbruch, lokaler Stand unverändert. |
| Signaturprüfung schlägt fehl | `SIGNATURE_INVALID`, Tripel verworfen + Sicherheits-Log. |
| Push/Pull eines revozierten Peers (UC-09.5) | `PEER_REVOKED`, hart abgewiesen + Sicherheits-Log, kein Merge. |
| Bundle-Container offline | `SyncSkippedException`, kein UI-Fehler. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-6.1 | Nur signaturgeprüfte Tripel werden gemergt | Integration | PullTest::testOnlyVerifiedAccepted | grün |
| AC-6.2 | Manipuliertes Tripel wird verworfen + geloggt | Integration | PullTest::testTamperedRejected | grün |
| AC-6.3 | Peer-Timeout lässt lokalen Stand unverändert | Integration | PullTest::testTimeoutNoMutation | grün |
| AC-6.4 | Re-Inject eines superseded Fakts (≤ Clock) wird ignoriert (Replay-Schutz) | Integration | PullTest::testReplayIgnored | grün |
| AC-6.5 | Push/Pull eines revozierten Peers wird hart abgewiesen + geloggt (kein Merge) | Integration | PullTest::testRevokedPeerRejected | grün |
| AC-6.6 | Tripel mit `wire_version ≠ 1` wird fail-closed verworfen (Versions-Gate, symmetrisch zu Bundle AC-29.6) | Unit | PullTest::testWireVersionGate | grün |

### UC-07: Wissen an Peer weitergeben (Push)

**Akteur:** `System` · **Route/MCP-Tool:** `graph__push`

#### Verhalten

1. Ermittelt lokale Tripel neuer als der dem Peer bekannte `vector_clock`.
2. Signiert Batch, sendet an Peer (HTTP) bzw. Bundle-Adapter (`docker exec -i <container> bin/console nsai:graph:ingest`, stdin, parameter-gekapselt via `execFile`-Array).
3. Peer mergt eigenständig; gibt accepted/quarantined/rejected zurück.
4. Lokal: Erfolg aktualisiert den für den Peer geführten Clock; kein Datenverlust bei Teil-Fehler.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Peer/Container offline | `SyncSkippedException`, Batch unverändert. |
| Inkompatibles Wire-Format | Exit > 0, gesamter Batch fail-closed, lokal unverändert. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-7.1 | Nur Tripel neuer als Peer-Clock werden gesendet (inkrementell) | Integration | PushTest::testIncrementalByClock | grün |
| AC-7.2 | `docker exec` via execFile-Array (keine Shell-Interpolation) | Unit | PushTest::testNoShellInjection | grün |
| AC-7.3 | Teil-Fehler hinterlässt keinen halb-synchronisierten Zustand | Integration | PushTest::testNoPartialState | grün |

### UC-08: Merge & Konfliktauflösung (CRDT, deterministisch)

**Akteur:** `System` · **Route:** intern (von UC-06/UC-11 aufgerufen) · **Kein LLM**

#### Verhalten

1. Gleicher `triple_hash` von verschiedenen Peers → **kein** inhaltlicher Konflikt (Hash = Inhalt): nur `confidence` + `vector_clock` mergen, **keine** Quarantäne.
2. **Konfidenz-Merge-Funktion (trust-unabhängig, kommutativ + assoziativ + idempotent):** `merged = max(confidence_a, confidence_b)`; Vector-Clock: elementweises Maximum. Da `max` und elementweises Max kommutativ/assoziativ/idempotent sind, konvergiert der gespeicherte Wert **auf allen Knoten identisch**, unabhängig von Reihenfolge, Wiederholung und lokalem Trust. **Kein** Trust-Faktor und **kein** `authoritative`-Override fließen in den gemergten Wert ein (das wäre knoten-abhängig → CRDT-Bruch). Trust wirkt ausschließlich als lokale Lese-Linse (§4, UC-02) und lokale Konflikt-Entscheidung (Schritt 4).
3. Replay-Schutz (s. UC-06.3) greift vor dem Merge.
4. **Inhaltlicher Widerspruch** = gleiches subject+predicate, **anderes** object (anderer Hash), beide aktiv mit hoher effektiver Konfidenz → beide → Quarantäne mit Konflikt-Marker (UC-05). **Lokale** Auflösung: stammt eine Seite von einem `authoritative`-Peer, gewinnt deren object lokal automatisch (Verlierer → `superseded`); diese Auflösung ist eine lokale Sicht und verändert die bei anderen Knoten gespeicherten Föderationswerte nicht.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Unvergleichbare Vector-Clocks bei **gleichem** Hash | kein Konflikt — Konfidenz/Clock-Merge (Schritt 2), Inhalt ist per Hash identisch. |
| Widerspruch (verschiedener Hash), kein authoritative-Peer | Konflikt-Pfad (UC-05, Developer entscheidet), nicht Silent-Overwrite. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-8.1 | Merge ist kommutativ (A∪B == B∪A) | Unit | MergeTest::testCommutative | grün |
| AC-8.2 | Merge ist idempotent (A∪A == A) | Unit | MergeTest::testIdempotent | grün |
| AC-8.3 | Nebenläufiger gleicher Hash → kein Quarantäne-Pfad, nur Konfidenz/Clock-Merge | Unit | MergeTest::testConcurrentSameHashNoQuarantine | grün |
| AC-8.4 | Widersprüchliches object (anderer Hash) → beide in Quarantäne | Integration | MergeTest::testConflictingObjectQuarantined | grün |
| AC-8.5 | Gemergter Föderationswert ist trust-unabhängig (zwei Knoten mit verschiedenem Trust für denselben Peer speichern denselben Wert) | Unit | MergeTest::testMergeIsTrustIndependent | grün |
| AC-8.6 | Merge ist assoziativ (A∪(B∪C) == (A∪B)∪C über drei Peers) | Unit | MergeTest::testAssociative | grün |
| AC-8.7 | `authoritative`-Peer gewinnt nur die **lokale** Widerspruch-Auflösung, nicht den gespeicherten Föderationswert | Integration | MergeTest::testAuthoritativeLocalOnly | grün |

### UC-09: Peer-Trust & Identität

**Akteur:** `Developer` · **Route/MCP-Tools:** `graph__peer_add`, `graph__peer_trust`, `graph__peer_rotate`, `graph__peer_revoke`

#### Verhalten

1. `peer_add`: registriert Peer (Public Key + Endpoint), Trust-Level initial `untrusted`. **TOFU**: Engine zeigt den Key-Fingerprint, Developer bestätigt out-of-band.
2. `peer_trust`: hebt Trust-Level (`untrusted`/`limited`/`full`/`authoritative`) bewusst an.
3. Trust steuert **lokal** (nie den gemergten Föderationswert, §4/UC-08): `untrusted` → `trust_factor`=0, alle Fakten Quarantäne, kein Merge-Beitrag; `limited` → `trust_factor`<1000 (effektive Konfidenz lokal gedämpft); `full` → `trust_factor`=1000, direkter Merge; `authoritative` → `trust_factor`=1000 + gewinnt lokale Widerspruch-Auflösung (nur Bundle).
4. `peer_rotate`: ersetzt den Public Key eines Peers nach erneuter Fingerprint-Bestätigung (legitime Rotation ≠ `PEER_EXISTS`-Block).
5. `peer_revoke`: sperrt Peer (Trust→`untrusted`); bereits gemergte Fakten dieses Peers → Quarantäne zur Re-Review; künftige Push/Pull des revozierten Peers werden hart abgewiesen (UC-06 Fehlerfall).
6. Lokale Identität: einmalig Ed25519-Schlüsselpaar (`~/.claude/nsai-edge/keys/`).

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Fingerprint nicht bestätigt | `FINGERPRINT_UNCONFIRMED`, Peer bleibt `untrusted`. |
| Schlüssel-Datei nicht lesbar | `KEY_ACCESS_DENIED`, fail-closed. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-9.1 | `untrusted`-Peer: alle Fakten in Quarantäne | Integration | PeerTest::testUntrustedAllQuarantined | grün |
| AC-9.2 | `limited`-Peer: Konfidenz-Abschlag angewendet | Unit | PeerTest::testLimitedConfidencePenalty | grün |
| AC-9.3 | Key-Rotation ersetzt Schlüssel nach Bestätigung ohne Datenverlust | Integration | PeerTest::testKeyRotation | grün |
| AC-9.4 | Revoke setzt gemergte Fakten des Peers auf Quarantäne | Integration | PeerTest::testRevokeRequarantines | grün |

### UC-10: Cross-Language-Conformance-Check (Anti-Drift-Gate)

**Akteur:** `System` (CI) · **Route:** CLI `nsai-edge conformance` · **Kein LLM** (Tier 1)

#### Verhalten

1. Lädt `conformance-vectors.json`.
2. Führt jeden Vektor durch die Node-Engine; vergleicht Output **exakt** (Integer, keine Toleranz) mit Erwartung.
3. (CI) Führt dieselben Vektoren gegen die PHP-Engine via `docker exec`.
4. Abweichung Node↔PHP↔Erwartung → Exit 1 (Merge-Blocker).
5. Prüft Vektor-Coverage-Mindestmaß (Grenzfälle) → unterschritten = Exit 1.

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| PHP-Engine nicht erreichbar | Node-only-Lauf, PHP-Seite `unverified` (kein grünes Gate). |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-10.2 | Node-seitige Vektoren bestehen Integer-exakt; ohne PHP-Runner `phpVerified=false` (ehrlich) | Integration | conformance AC-10.2 | grün |
| AC-10.4 | Conformance Node-seitig reproduzierbar/deterministisch (kein interner Drift über Läufe) | Unit | conformance AC-10.4 | grün |
| AC-10.1 | Abweichung Node↔PHP blockt Gate (Exit 1) | Integration | — | Phase 2 (braucht PHP-Runner) |
| AC-10.3 | Unterschrittene Vektor-Coverage blockt Gate | Unit | — | Phase 2 |

### UC-11: Initialer Clone des Bundle-Bestands (Bootstrap)

**Akteur:** `Developer` · **Route/MCP-Tool:** `graph__clone` · **Kein LLM**

#### Formularfelder

| Feld | Typ | Pflicht | Wertebereich |
| --- | --- | --- | --- |
| peer_id | Text | Ja | registrierter Peer (UC-09) |
| bulk_promote | Boolean | Nein | true → ganzen Bestand nach Clone freigeben (Default false) |

#### Verhalten

1. Frischer Knoten ohne Clock für den Peer → Voll-Replik via `nsai:graph:export` (Bundle-Adapter) bzw. HTTP-Full-Dump.
2. Batch-Signaturprüfung; Mapping `weight`/`impactScore` → Promille (§2).
3. Alle Fakten gehen zunächst in **Quarantäne** (Entscheidung Stefan).
4. `bulk_promote=true` → ganzer Bestand des Peers auf einen Schlag → `active` (handhabbar bei großem Bestand).
5. Setzt Initial-`vector_clock` für den Peer; markiert Clone als abgeschlossen (idempotent: erneuter Clone = Pull-Delta).

#### Fehlerfälle

| Fall | Verhalten |
| --- | --- |
| Peer nicht erreichbar | `PEER_UNREACHABLE`, kein Teil-Clone, Knoten bleibt leer. |
| Signaturfehler im Batch | betroffene Tripel verworfen + geloggt, Rest quarantänisiert. |

#### Akzeptanzkriterien

| # | Kriterium | Test-Typ | Test-Klasse | Status |
| --- | --- | --- | --- | --- |
| AC-11.1 | Voll-Clone landet vollständig in Quarantäne (Default) | Integration | CloneTest::testCloneAllQuarantined | grün |
| AC-11.2 | `bulk_promote` hebt ganzen Peer-Bestand auf active | Integration | CloneTest::testBulkPromote | grün |
| AC-11.3 | Erneuter Clone wirkt als idempotentes Pull-Delta (keine Dubletten) | Integration | CloneTest::testReCloneIsDelta | grün |

### UC-12: Belief-Auflösung konkurrierender Aussagen (`resolveBelief`)

**Akteur:** `System`/`Developer` · **Route/MCP-Tool:** `graph__resolve_belief` · **Kein LLM** (deterministische Lese-Linse, §B)

#### Verhalten
1. Sammelt aktive Edges zu `subject`+`predicate`, gruppiert nach distinktem Objekt (max je Objekt → anzahl-unabhängig).
2. Präzedenz `(Origin-Trust-Rang, effektive Stufe, within-weight)`; nur die höchste Trust/Stufe-Gruppe konkurriert, niedrigere → belief 0 (sichtbar `disputed`).
3. Innerhalb der Gruppe Potenz-Normalisierung über within-weight (Recency×Konfidenz); deterministischer Tiebreak (object lexikografisch).
4. Liefert Gewinner + Kandidaten mit `belief` (0–1000) + `contested`.

#### Fehlerfälle
| Fall | Verhalten |
|---|---|
| Kein Treffer | `null` (ehrliches „weiß nicht", kein Halluzinieren). |
| Alle Kandidaten Gewicht 0 | `winner=null`, `contested=true` (unentscheidbar). |

#### Akzeptanzkriterien (Test-First)
| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-12.1 | Höhere Autoritäts-Stufe gewinnt bei gleichem Trust, anzahl-unabhängig (Gesetz schlägt N×Web) | Unit | resolveBelief::gesetzSchlaegtWeb | grün |
| AC-12.2 | Bei gleicher Stufe gewinnt der neuere (Recency), veraltetes → belief→0, bleibt gespeichert | Unit | resolveBelief::recency+veraltet | grün |
| AC-12.3 | Höherer Origin-Trust gewinnt; limited kann per effTier-Sprung nichts überstimmen; eigene Inferenz geschützt | Integration | SEC-11/11b | grün |
| AC-12.4 | Auflösung ist ingest-reihenfolge-unabhängig (deterministischer Tiebreak) | Unit | resolveBelief::determinismus | grün |
| AC-12.5 | Überstimmte Aussage als `disputed`+`dominant` markiert | Unit | query::disputed | grün |

## 7. Sicherheit & Bedrohungsanalyse (§33)

### 7.1 Lethal-Trifecta-Gate (§33.1)

| Achse | Status | Begründung |
| --- | --- | --- |
| 1 — sensible Daten | Ja | Host-Dateizugriff + `docker exec`. |
| 2 — nicht-vertrauenswürdige Inhalte | **Ja** | Föderation empfängt Fremd-Fakten. |
| 3 — Egress | Ja | Push an Peers + Docker-Socket. |

**Alle drei aktiv = Lethal Trifecta.** Pflicht-Gegenmaßnahmen: Fremd-Fakten sind **Daten, nie Instruktion** (erst nach UC-05/09 in den Kontext); Signatur-Pflicht (UC-06); Trust-Gating + TOFU (UC-09); Replay-Schutz (UC-06.3); Egress nur an registrierte Peers.

### 7.2 STRIDE „light" (§33.4)

| STRIDE | Szenario | W/S | Gegenmaßnahme (Sicherheits-AC) |
| --- | --- | --- | --- |
| Spoofing | Fremder gibt sich als vertrauter Peer aus | M/H | AC-Sec-1: Ed25519-Signaturprüfung + TOFU-Fingerprint (UC-06/09). |
| Tampering | SQL-Injection über Tripel-Felder | M/H | AC-Sec-2: striktes Parameter-Binding. |
| Tampering | Vergifteter Fakt von Peer | H/H | AC-Sec-3: Trust-Gating + Quarantäne (UC-05/09). |
| Tampering | Replay eines superseded Fakts | M/M | AC-Sec-4: Replay-Schutz via Clock-Vergleich (UC-06.3). |
| Repudiation | Peer leugnet Herkunft | G/M | AC-Sec-5: `origin_peer_id` + Signatur persistent/auditierbar. |
| Information Disclosure | Pfad-/Stacktrace-Leak | M/G | AC-Sec-6: opake Fehler nach außen, Details nur lokal. |
| Elevation of Privilege | Command-Injection über Sync-Argumente | G/H | AC-Sec-7: `child_process.execFile` mit statischem Array. |

## 8. Technische Anhänge & Schemata

### 8.1 SQLite-Schema (Auszug)

```sql
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS knowledge_nodes (
    id TEXT PRIMARY KEY NOT NULL,
    name TEXT UNIQUE NOT NULL CHECK(length(name) BETWEEN 2 AND 160),
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
    triple_hash TEXT PRIMARY KEY NOT NULL,          -- SHA-256 der kanonischen Serialisierung (§8.3)
    subject_id TEXT NOT NULL,
    predicate TEXT NOT NULL CHECK(length(predicate) BETWEEN 2 AND 50),
    object_id TEXT NOT NULL,
    confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 1000),   -- Promille (Fixed-Point)
    temporality TEXT NOT NULL CHECK(temporality IN ('eternal','stable','temporal','ephemeral')),
    local_status TEXT NOT NULL DEFAULT 'active' CHECK(local_status IN ('active','quarantined','superseded')),
    origin_peer_id TEXT NOT NULL,
    signature TEXT NOT NULL,
    vector_clock TEXT NOT NULL,                     -- JSON {peer_id: counter}
    derived_from TEXT,                              -- JSON [triple_hash...] + rule_id, NULL = beobachtet
    context_slug TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY(subject_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
    FOREIGN KEY(object_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS peers (
    peer_id TEXT PRIMARY KEY NOT NULL,
    public_key TEXT NOT NULL,
    fingerprint TEXT NOT NULL,
    endpoint TEXT,
    trust_level TEXT NOT NULL DEFAULT 'untrusted'
        CHECK(trust_level IN ('untrusted','limited','full','authoritative')),
    last_clock TEXT
);

CREATE INDEX IF NOT EXISTS idx_edges_status ON knowledge_edges(local_status);
CREATE INDEX IF NOT EXISTS idx_edges_subject ON knowledge_edges(subject_id);
```

### 8.2 Föderations-Wire-Format

```json
{
  "wire_version": 1,
  "triple_hash": "sha256:…",
  "subject": "WorkingMemory", "predicate": "depends_on", "object": "GraphRepository",
  "confidence": 820, "temporality": "stable",
  "origin_peer_id": "peer:stefan-host", "vector_clock": {"peer:stefan-host": 7},
  "derived_from": null,
  "signature": "ed25519:…"
}
```
> **Wire-Vertrag v1:** `wire_version` ist Pflichtfeld; beide Seiten (Edge + Bundle) weisen abweichende `wire_version` fail-closed ab. Identisch zu NSAI-Bundle „Föderations-Wire-Vertrag v1".

### 8.3 Kanonische Hash-Serialisierung (Node ↔ PHP bit-identisch)

```
input  = nfc(subject) + U+001F + nfc(predicate) + U+001F + nfc(object)   # UTF-8, NFC, kein Trim/Case-Fold
hash   = "sha256:" + hex( SHA256( utf8_bytes(input) ) )
```
Node: `crypto.createHash('sha256')` über `Buffer.from(input.normalize('NFC'),'utf8')`.
PHP: `hash('sha256', \Normalizer::normalize($input, \Normalizer::FORM_C))`.
Conformance-Vektor erzwingt identischen Hash für dasselbe Tripel in beiden Sprachen.

### 8.4 Bundle-Feld-Mapping & GC

- Promille ↔ Bundle: `weight` (Edge) = `confidence/1000.0`; `impactScore` (Node) analog; Rück-Mapping `round(weight*1000)`.
- **Roundtrip-Invariante (R4):** Die „kein-Epsilon"-Doktrin gilt für die Node-interne Engine + die Conformance-Vektoren. An der **Bundle-Grenze** (float-`weight`) gilt stattdessen die Invariante `round(weight*1000) == confidence` für alle confidence ∈ 0–1000 — als AC im Conformance-Gate verankert (`ConformanceTest::testPromilleRoundtripInvariant`). Damit ist der einzige Float-Berührungspunkt explizit eingehegt, statt implizit toleriert.
- GC: `superseded`-Tripel werden physisch gelöscht, sobald an alle `full`/`authoritative`-Peers synchronisiert (Clock bestätigt) UND älter als Tombstone-Frist (Spec). Verhindert ewige Tombstones.

## 9. Glossar & Semantische Anker (§14)

| Begriff | Definition | Anker |
| --- | --- | --- |
| Semantisches Tripel | Atomare Wissenseinheit Subjekt-Prädikat-Objekt | RDF, Entity-Relationship |
| Content-Adressierung | Identität über Inhalts-Hash (peer-unabhängig) | git-Blob, IPFS |
| Fixed-Point (Promille) | Konfidenz als Integer 0–1000 statt Float → sprach-deterministisch | Festkomma-Arithmetik |
| CRDT | Conflict-free Replicated Data Type — kommutativer, idempotenter Merge | Distributed Systems, Eventual Consistency |
| Vector Clock | Pro-Peer-Zähler für kausal vs. nebenläufig | Lamport, Causal Order |
| TOFU | Trust On First Use — Key-Echtheit per Erst-Fingerprint-Bestätigung | SSH-Known-Hosts |
| Föderation | Dezentraler Austausch gleichberechtigter Peers ohne Zentralserver | git remote, ActivityPub |
| Conformance-Vektor | Gemeinsamer Input→Output-Testfall für beide Engines | Golden-Test, §19 |
| Lethal Trifecta | sensible-Daten + untrusted-Content + Egress zugleich | §33.1 |
| Context-Rot | Präzisionsverlust durch überfüllten, veralteten Kontext | Token Exhaustion |
| sourceTier | Autoritäts-Stufe je source_type (gesetz 6 … llm 0); harte Dominanz höherer Stufen | Authority tier |
| trustTierCap | Trust-Deckel: maximale Stufe, die ein Origin gemäß seinem Trust behaupten darf | Privilege ceiling |
| effTier | effektive Stufe = min(sourceTier, trustTierCap) — trust-gekappte Autorität | — |
| beliefSharpness | Exponent der Potenz-Normalisierung der Belief-Verteilung (Schärfe) | Softmax temperature |
| contestedThreshold | Belief-Schwelle, ab der eine Aussage als „umstritten" gilt | — |
| disputed / dominant | Markierung überstimmter Aussagen + Verweis auf den Belief-Gewinner | Non-monotonic belief |
| Justification / Begründung | Prämissen + Regel, aus denen ein Fakt abgeleitet wurde (`derived_from`) | JTMS, Doyle 1979 |
| IN / OUT (Belief-Label) | geglaubt (begründet) vs. zurückgenommen (Begründung tot) | JTMS |
| retracted | TMS-OUT-Status — durch Undercutting zurückgenommen, getrennt von `superseded` (Decay) | §H, Reason Maintenance |
| Foundations vs. Coherence | Glaube nur mit lebender Begründung (foundations) vs. nur global konsistent (coherence) | Belief-Revision-Theorie |
| Rebutting vs. Undercutting | Defeater gegen das Objekt vs. gegen die Inferenz-Verknüpfung | Pollock, Defeasible Reasoning |
| Epistemische Entrenchment | Resistenz eines Glaubens gegen Rücknahme = Retraktions-Priorität | AGM (Gärdenfors/Makinson) |
| strikt vs. defeasible | nicht-relabelbar (`eternal`) vs. revidierbar | Defeasible Logic |
| Episode | Roh-Erlebnis mit Zeit/Kontext (episodische Schicht), lokal/peer-privat | NS-Mem, Tulving (episodisch vs. semantisch) |
| Konsolidierung | Verknüpfung Episode→Fakt (Audit/Erklärbarkeit) + Recency-Refresh, kein Count-Boost | NS-Mem, Memory consolidation |
| episodisch vs. semantisch | Roh-Erlebnis (wann/woher) vs. verdichtetes Wissen (Tripel) | NS-Mem 3-Schichten |
| Personalized PageRank (PPR) | belief-gewichtete Random-Walk-Relevanz mit Teleport auf Seed-Knoten — deterministische Multi-Hop-Suche | HippoRAG, Power-Iteration |
| Hub-Dilution | hochgradige Knoten verteilen PPR-Masse uniform → Präzisionsverlust; via k-Hop-Schranke + Konfidenz gedämpft | HippoRAG-2 |
| Teleport / Damping | Random-Walk-Neustart-Vektor (`p`, hier Seeds) bzw. Fortsetz-Wahrscheinlichkeit (`d=0.85`) | PageRank |
| Verifikation (supported/contradicted/unknown) | deterministisches Verdikt einer Aussage gegen den Graphen | VeriCoT, Eidoku, ClaimVer |
| Open-World-Annahme | fehlendes Wissen ist `unknown`, NICHT `false` (Abwesenheit ≠ Widerlegung) | OWA vs. Closed-World |
| Bi-temporal (Valid- vs Transaction-Time) | Wann war es wahr (`valid_from/valid_to`) vs. wann gelernt (`created_at`) | BiTRDF, Zep/Graphiti |
| as-of-Abfrage | „was galt zum Zeitpunkt T" — Filter über das Gültigkeits-Intervall `[valid_from, valid_to)` | Bitemporale DB |
| nicht-destruktive Invalidierung | überholten Fakt nicht löschen, sondern `valid_to` setzen (historisch abfragbar) | Graphiti edge-invalidation |
| Endorsement (UC-MS) | Eine separat signierte Wieder-Bestätigung eines Tripels durch einen Origin — eine Zeile pro `(triple_hash, origin_peer_id)`. Wire-Vertrag-kompatibel additiv. | Subjective Logic, Multi-Source-Corroboration |
| Cluster (UC-MS) | Markierungs-Gruppe für korrelierte Peers; gleiche `peers.cluster_id` ⇒ als nicht-unabhängig behandelt. Default `cluster_id = peer_id` (konservativ — jeder als eigener Cluster). | FoolsGold-Style Independence-Filter |
| Quorum-Schwelle (Q, AUTH_FLOOR) | Integer-Schwellen für kategorische Verdikte: AUTH_FLOOR=4500 (Single-Authoritative-Pfad), Q=2000 (Multi-Cluster-Pfad, ≥2 beitragende Cluster). Konstanten in `conformance.mjs` (PHP-spiegelbar). | Trust-Quorum |
| weighted_support / cluster_count | Aggregations-Größen pro `triple_hash`: `cluster_count` = Anzahl beitragender Cluster; `weighted_support` = Σ über `clusterContribution(c) = MAX_{e∈c}(trustRank × tier)`. Integer, dimensionslos. | UC-MS Mechanik Punkt 2 |
| Echo-Kammer-Neutralisierung | Innerhalb eines Clusters zählt nur das stärkste Endorsement (MAX), nicht die Summe — verhindert dass mehrere Aussagen aus derselben Quelle den Belief inflationieren. | UC-MS, Wisdom of Crowds (Independence-Annahme) |

## 10. Probabilistik-Statement (§2.6)

Engine deterministisch (Tier 1, Fixed-Point); aufrufender Claude-Code-Agent probabilistisch. §13.1-Felder für den einzigen LLM-berührten UC (UC-01):

| Feld | Wert |
| --- | --- |
| Kontext-Quelle | Codebase-Analyse der aktuellen Session |
| Erwartete Ausgabe | strukturiertes Tripel (subject/predicate/object) |
| Validierung | Regex-Schema + Developer-Sichtung via Git/CLI |
| Fallback | Abbruch + Klarstellungs-Frage |
| Cutoff | bei Unsicherheit niedrige Default-Konfidenz (700) + Quarantäne-Nähe |

| UC | Toleranz | Strategie | Fallback | EU-AI-Act-Klasse |
| --- | --- | --- | --- | --- |
| UC-01 | 90 % Extraktion | Regex + Developer-Review | Klarstellungs-Frage | minimal |
| UC-03/04/08 | 100 % (Fixed-Point) | Conformance-Vektoren (exakt) | Gate-Block | minimal |
| UC-06/11 | 100 % Signaturprüfung | Ed25519-Verify | Verwerfen + Log | minimal |

## 11. Vendor-Risiko-Statement (§2.7)

| UC | Provider | Modell | Migrations-Strategie | Daten-Souveränität |
| --- | --- | --- | --- | --- |
| Alle | Anthropic | Claude Code (Opus/Sonnet) | Offenes MCP/JSON-RPC + sprachneutrale Regel-Spec → client-agnostisch + sprach-portierbar; DB-agnostisch (Host-App wählt, Bundle nutzt aktuell MySQL-Migrationen) | Volle Souveränität; lokale SQLite + lokale Ed25519-Schlüssel; Föderation nur mit autorisierten Peers; keine externe Telemetrie |

## 12. Verantwortungs-Matrix (§23.1)

| UC | KI-Anteil | Mensch-Validator | Mindset-Niveau | Haftung |
| --- | --- | --- | --- | --- |
| UC-01 | 75 % (Extraktion) | Developer | hoch | Stefan Riedl |
| UC-02 | 15 % (Rendering) | Developer | niedrig | Stefan Riedl |
| UC-03/04/08/10 | 0 % (Engine/Gate) | — | n/a (deterministisch + Conformance) | Stefan Riedl |
| UC-05/09/11 | 0 % (Tooling) | Developer (Trust/Promote/Clone) | hoch (Sicherheits-Entscheidung) | Stefan Riedl |
| UC-06/07 | 0 % (Sync) | Developer (Peer-Autorisierung) | mittel | Stefan Riedl |

## §G — Föderations-Härtung Phase 2 (Parität zur PHP-Gegenseite)

Aus dem Threat-Model + Adversarial-Review der PHP-Gegenseite (ai-bundle, `docs/KONZEPT-graph-federation.md` AC-1.9–1.15) folgen Paritäts-ACs, die auch hier gelten — `engine.mjs` darf die latenten Lücken nicht behalten, sonst divergieren die co-gleichberechtigten Engines sicherheitsseitig.

- **F1.9 — Fingerprint-Bindung am Verify-Gate.** `_verifyAgainstOrigin` akzeptiert einen Origin nur, wenn `origin_peer_id === "peer:"+fingerprint(originPubKey).slice(0,12)`. Schließt Key-Confusion (frei gewählter `peer_id` mit fremdem Key). Greift am Sicherheits-Gate (verify/pull/receive/clone), nicht in `peerAdd` — die Merge-Algebra-Unit-Tests nutzen bewusst ungebundene IDs ohne Verify.
- **F1.11 — VC-Plausibilität.** `mergeIncoming` verwirft Wires mit nicht-ganzzahligen/negativen VC-Werten oder einem Sprung > `MAX_CLOCK_JUMP` (1e6) über den lokalen Stand — verhindert Clock-Vergiftung (künstlich hoher VC unterdrückt künftige echte Updates).
- **F1.13 — Quarantäne im UPDATE-Zweig.** Geht bei gleichem Hash die Provenienz auf einen `untrusted`-Origin über, wird der Record `quarantined` (kein stiller Verbleib als `active`).
- **F1.15 — Live-Konfidenz-Deckel.** `incLive = min(wire.confidence, asserted_confidence)` — das unsignierte Live-Feld hebt den Belief nie über die signierte Origin-Aussage.

Nachweis: eigener Test-Block in `test/engine-federation.test.mjs`; alle Bestands-Tests bleiben grün (Bindung greift nur am echten Verify-Pfad, Live-Deckel ist No-op solange `confidence==asserted`).

## §H — Forschungs-fundierte Verfeinerungen (Roadmap)

Aus einem Quellenvergleich (Neuro-symbolische KI / Kautz-Taxonomie; Truth-Maintenance Doyle JTMS + de Kleer ATMS; AGM-Belief-Revision + epistemische Entrenchment; Defeasible Reasoning / Pollock-Defeater; MYCIN-Certainty-Factor-Kritik; NS-Mem 3-Schichten-Gedächtnis; GraphRAG hybrid retrieval) abgeleitet. Ziel-Anker: das ai-bundle-Goal **„erklärbares, halluzinationsfreies Reasoning"** + NSAI-Edge als revidierbares Gedächtnis.

### H.1 Hervorstechende Annahmen (quellenübergreifend)

- **A1 — Foundations statt Coherence (JTMS + NS-Mem-Regelschicht + Defeasible konvergieren):** Ein abgeleiteter Fakt wird nur geglaubt, solange seine **Begründung lebt**. Verliert eine Prämisse den Glauben (superseded/Decay < Schwelle/Quarantäne), MUSS der abgeleitete Fakt automatisch relabelt (OUT) werden. Verwaiste Schlussfolgerungen = Halluzinationsquelle → direkt gegen das ai-bundle-Goal. **→ Slice #1 (UC-TMS).** *Scope-Einschränkung Slice #1: genau EINE Begründung je Edge (`derived_from`); echtes Mehrfach-Support (Fakt bleibt IN solange irgendeine Begründung lebt) ist Slice #1b.*
- **A2 — Trust/Authority IST eine epistemische Entrenchment-Ordnung (AGM):** Unsere trust-primäre Präzedenz (sourceTier × trustTierCap) ist formal die Retraktions-Prioritäts-Ordnung der AGM-Revision. Konsequenz: **Minimal Change** — bei Konflikt nur den weniger entrenchten Glauben (+ dessen unbegründete Folgen) zurücknehmen, nicht den Teilgraphen.
- **A3 — Zwei Defeater-Typen trennen (Pollock):** *Rebutting* (widerspricht dem Objekt, gleiches s/p, anderes o) → bereits durch Belief-Softmax/`disputed` behandelt. *Undercutting* (greift die Inferenz-Verknüpfung an, Prämisse gilt nicht mehr) → **bislang nicht** behandelt; genau das leistet die TMS-Retraktion (Slice #1).
- **A4 — Konfidenz ist Evidenz-Gewicht, keine Wahrscheinlichkeit (MYCIN-Kritik):** Certainty-Factors scheiterten an Unabhängigkeits-Annahme/Paradoxa und wurden durch Bayes abgelöst. Konsequenz für uns: Belief bleibt **tier-primär** (Autorität), Konfidenz nur Within-Tier-Modulator (BEWA). Inferenz-Konfidenz **konservativ**: `trunc(min(Prämissen-Konfidenz) × Regel-Faktor / 1000)` — **kein** naives Produkt über die Begründungskette (keine Scheinpräzision).
- **A5 — Strikte vs. defeasible Fakten (Defeasible-Logik):** **`temporality='eternal'`** definiert die strikte Achse (kein Decay — bereits im Code so; nicht defeasible, nicht TMS-relabelbar). Temporality und sourceTier sind orthogonal (ein `gesetz`-Fakt kann temporal sein); Strikt-heit hängt allein an `eternal`. Der Rest ist defeasible — nur dort greifen Decay und TMS-Retraktion.

### H.2 Roadmap (priorisierte Slices)

Umpriorisiert nach Recherche-Runde 2 (2026-Frontier-Validierung): neuro-symbolische **Verifikation** + **bi-temporale** Memory tragen nachweislich am meisten zum Ziel bei und passen zum Determinismus-Gate; die ursprüngliche „gelernte Gewichtung" rückt ans Ende (nicht-deterministisch → höchstens offline).

1. **Justification-TMS (Slice #1, UC-TMS):** Retraktions-Propagation. ✅ erledigt.
2. **3-Schichten-Gedächtnis (Slice #2, UC-EP):** episodische Schicht + Konsolidierung. ✅ erledigt.
3. **Hybrid-Retrieval (Slice #3, UC-HR):** lexikalische Seeds + Personalized PageRank (rein deterministisch). ✅ erledigt.
4. **Verifikation (Slice #4, UC-V unten):** `verify(claim)` → **supported / contradicted / unknown** gegen den Graphen. Frontier 2026 (VeriCoT, Eidoku „kein Pfad ⇒ ablehnen", ClaimVer). Deterministisch, nutzt Belief (Widerspruch) + TMS (Stützung) + `search`/PPR (Pfad) — der Schlussstein für „halluzinationsfreies Reasoning". Open-World-Pflicht: **unknown ≠ falsch**.
5. **Bi-temporale Gültigkeit (Slice #5):** `valid_from/valid_to` + „as-of T"-Abfrage; Konflikt nicht-destruktiv (invalidieren statt löschen). Validiert durch Zep/Graphiti (+18,5 % LongMemEval); wir haben mit `asserted_at`/`created_at` das Rohmaterial.
6. **Gelernte Gewichtung (Backlog):** Belief-Spec-Konstanten aus Daten lernen — nicht-deterministisch, daher nur **offline** gelernte Konstanten (Determinismus-Gate); ans Ende verschoben.

Deferred-Verfeinerungen: Slice #1b (OUT→IN-Reaktivierung + Multi-Justification), #2b (LLM-Extraktion, frequenz-bewusste GC), #3b (Episoden als Kontextknoten im Retrieval, Vektor-Ähnlichkeit).

### UC-TMS — Justification-basierte Belief-Revision (Slice #1)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern, getriggert durch Status-Änderungen · **Scope-Schnitt (Review-Runde 1):** nur die **Retraktions-Richtung** (IN→OUT); Re-Aktivierung (OUT→IN) und Multi-Justification sind **Slice #1b** (H.2). Single-Justification (eine `derived_from`-Liste je Edge) ist akzeptiert.

**Ziel:** Verliert eine Prämisse den Glauben, wird die Schlussfolgerung **deterministisch** zurückgenommen und transitiv propagiert — non-monoton, zyklenfrei (DAG-Invariante), minimal, reihenfolge-unabhängig.

**Datenmodell:**
- `derived_from` (bestehend): JSON-Array der Prämissen-`triple_hash` + Regel-Id (Single-Justification).
- **Neuer `local_status`-Wert `retracted`** (TMS-OUT) — getrennt von `superseded` (Decay/GC) und `quarantined` (🔴-1): so bleibt unterscheidbar, **warum** ein Edge inaktiv ist, und der Replay-/Revival-Schutz in `mergeIncoming` (keyt auf `superseded`+Clock-LEQ) wird **nicht** ausgelöst.
- **DAG-Invariante (🟡-5/🟢-9):** `infer()` legt eine Justification nur an, wenn die Prämissen den Konklusions-Hash nicht (transitiv) enthalten → deterministischer Fixpunkt, BFS-reihenfolge-unabhängig.
- **Status-only (🟡-3):** Propagation schreibt ausschließlich `local_status`; sie verändert **nicht** die Live-`confidence` (im Wire + CRDT-max → Absenkung wäre nicht monoton) und tickt **nicht** den `vector_clock`.

**IN/OUT-Ableitung:** Edge ist **IN** gdw. `local_status='active'`; ein abgeleiteter Edge bleibt IN, solange **alle** Prämissen IN sind. Verliert eine Prämisse IN (→ `superseded`/`retracted`/`quarantined`) oder existiert sie nicht (mehr), gilt der abgeleitete Edge als **undercut** → `retracted`.

**Ablauf (nummeriert, verzweigt) — `_propagateRetraction(changedHash)`:**
1. Sammle **Dependents**: aktive Edges, deren `derived_from` `changedHash` enthält.
2. BFS mit `visited`-Set (Terminierung garantiert; DAG-Invariante ⇒ kein Oszillieren):
   1. Strikt? `temporality='eternal'` → nie relabeln (A5), überspringen.
   2. Mind. eine Prämisse nicht IN → **undercutting** (A3): `local_status='retracted'`; Dependent in die Queue (transitiv; A2-minimal: nur tatsächlich unbegründete).
3. Alles in **einer** Transaktion (Rollback bei Fehler — kein Teil-Relabel).

**Trigger:** am Ende von `decayPass` (Edge → `superseded`), `reject`, `quarantine`, sowie im `mergeIncoming`/supersede-Pfad: `_propagateRetraction(hash)` für den geänderten Hash.

**Erklärbarkeit:** `query(explain=true)` liefert die `derived_from`-Kette eines IN-Fakts als Proof-Tree (BackwardChaining-Parität) — vorhandenes `explain`, hier nur verankert.

| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-9.1 | Inferierter Fakt mit Prämissen p1,p2: wird p1 `superseded` → Fakt wird `retracted` (OUT), in einer Transaktion. | unit | offen (Slice #1) |
| AC-9.2 | Transitive Kette A→B→C: Retraktion der Prämisse von A propagiert bis C. | unit | offen |
| AC-9.3 | `infer()` verbietet zyklus-bildende Justification (DAG-Invariante); Propagation terminiert per `visited`. | unit | offen |
| AC-9.4 | Strikter Fakt (`temporality='eternal'`) wird durch Prämissen-Verlust NICHT relabelt (A5). | unit | offen |
| AC-9.5 | Propagation schreibt nur `local_status`; Live-`confidence` und `vector_clock` bleiben unverändert (🟡-3). | unit | offen |
| AC-9.6 | Minimalität (A2): ein selbst-behaupteter Edge (kein `derived_from`) wird durch Propagation NIE retracted. | unit | offen |
| AC-9.7 | Determinismus: Endstatus aller Edges ist unabhängig von der Trigger-/BFS-Reihenfolge. | unit | offen |
| AC-9.8 | Föderations-Parität: signierte Origin-Aussage/`asserted_confidence`/Wire-Vertrag unberührt; `retracted` wird NICHT exportiert (nur `active`). | unit | offen |

**Fehlerfälle (UC-TMS):** zyklus-bildende `derived_from` → von `infer()` abgewiesen (AC-9.3), Propagation terminiert per `visited`-Set; fehlende Prämisse (Hash nicht (mehr) vorhanden, z.B. GC) → wie nicht-IN behandelt (undercutting, `retracted`); Propagation während Föderations-Merge → dieselbe Transaktion, sonst Rollback.

> **Verschoben auf Slice #1b (Review-Runden 1+2, dokumentiert):** Re-Aktivierung OUT→IN bei Prämissen-Rückkehr (braucht Trigger im re-assert-Pfad + binäre „kein offenes Rebutting"-Bedingung via `resolveBelief`); Multi-Justification (mehrere `derived_from` je Edge). Beides ist für die Halluzinations-Prävention (Retraktions-Richtung) nicht erforderlich. **Bekannte Einschränkung (Adversarial-Runde 2, 🟡):** solange OUT→IN fehlt, bleibt ein `retracted` Edge inaktiv, auch wenn eine Prämisse lokal re-asserted oder die Aussage von einem Peer neu behauptet wird (mergeIncoming gibt dann `accepted` zurück, der Edge bleibt aber `retracted`/unsichtbar bis #1b). Kein Datenverlust — nur keine automatische Re-Validierung.

### UC-EP — Episodisches Gedächtnis + Konsolidierung (Slice #2)

**Akteur:** System (deterministisch, Tier 1, **kein LLM** — die Extraktion von Tripeln aus Roh-Text bleibt beim aufrufenden Agenten) · **Route:** intern + MCP-Tools `graph__record_episode`/`graph__recall_episodes` · **Roadmap:** §H.2 Punkt 2 (NS-Mem 3-Schichten).

**Ziel (A1/NS-Mem):** NSAI bekommt eine **episodische Schicht** (Roh-Erlebnisse mit Zeit/Kontext) neben der **semantischen** (Tripel) und der **Regel**-Schicht. Konsolidierung verknüpft Episoden mit den daraus entstandenen Fakten (Provenienz/Erklärbarkeit: „warum glaube ich X? → Episoden E1,E2") und hält deren **Recency** frisch — **ohne** Count-Inflation (Leitplanke „Aktualität statt Anzahl der Quellen"; A4).

**Abgrenzung Föderation (wichtig):** Episoden sind **lokal/peer-privat** — sie sind **nicht** Teil des Wire-Vertrags, werden nie exportiert/gemergt. Föderiert wird ausschließlich die semantische Schicht (signierte Tripel). Damit ist die episodische Schicht CRDT-/Wire-neutral.

**Datenmodell (neu, additiv):**
- `episodes`: `id` (uuid PK), `content` (Roh-Text, Länge 1–8000, fail-closed), `source_type` (nur **Herkunfts-Label** der Episode, **KEINE** Autoritäts-Stufe wie das `source_type` der Tripel/§B — Episoden durchlaufen keine Belief-Konkurrenz), `occurred_at` (ISO), `context_slug` (nullable), `created_at`.
- `episode_triples`: `episode_id` + `triple_hash` (PK-Paar) — reiner **Audit-Trail**, welche Fakten aus welcher Episode entstanden. FK auf `episodes` ON DELETE CASCADE; **bewusst kein FK auf edges**: Tripel können per GC (§8.4) physisch verschwinden → der Link wird dann **verwaist** (tolerierte Audit-Spur). Invariante: alle Lese-Pfade behandeln verwaiste Links definiert (LEFT JOIN/Überspringen, kein Crash).

**Status-Unabhängigkeit (🔴-1, entschieden):** Ein `episode_triples`-Link ist **status-unabhängig** — er darf auf ein Tripel **jeden** `local_status` zeigen (active/quarantined/superseded/retracted); er dokumentiert das Erlebnis, nicht den aktuellen Glauben. Ein Episode-getriebenes `storeTriple` auf ein `retracted` Tripel **reaktiviert es NICHT** (OUT→IN bleibt Slice #1b): `storeTriple` lässt `local_status` unberührt, refresht aber Recency (`asserted_at`). `episodesForTriple` liefert die Episoden samt aktuellem Tripel-Status, blendet nichts aus.

**Ablauf (nummeriert, verzweigt):**
1. `recordEpisode({content, source_type, occurred_at?, context_slug?})`: `content` leer/>8000 → fail-closed; `occurred_at` default = jetzt, **Zukunftsdatum** → auf jetzt geklemmt (wie storeTriple); persistiert Episode, gibt `episode_id` zurück.
2. `storeTriple({…, episode_id?})`: ist `episode_id` gesetzt → Tripel-Write **und** `episode_triples`-Link in **derselben Transaktion** (atomar). Existiert die Episode nicht → Link wird übersprungen + Reason geloggt, der Tripel-Write bleibt gültig. Recency folgt dem bestehenden `asserted_at`-Mechanismus (Refresh on re-assert); **kein** Konfidenz-Boost je Episode (A4 — Korroboration ≠ Zählen). `local_status` bleibt unberührt.
3. `recallEpisodes({context_slug?, term?, since?, limit=25})`: Episoden **recency-geordnet** (`occurred_at` DESC), optional gefiltert nach Kontext / Volltext-`term` (LIKE) / Zeitfenster; `limit` hart auf 100 gekappt, `truncated`-Flag wie UC-02.
4. `episodesForTriple(triple_hash)`: die Episoden hinter einem Fakt + dessen aktueller `local_status` (Erklärbarkeit). Verwaiste/fehlende Tripel definiert behandelt.
5. `episodicGc({maxAgeDays})`: alte Episoden + ihre Links physisch entfernen; zusätzlich verwaiste Links (Ziel-Tripel weg) aufräumen; **semantische Tripel bleiben** unangetastet.
6. Nebenläufigkeit: Schreib-Tools laufen unter WAL + busy_timeout wie der Bestand; `DATABASE_LOCKED` → Retry/fail-closed analog UC-01/04.

| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-10.1 | `recordEpisode` persistiert Roh-Episode + gibt `episode_id`; `occurred_at` in der Zukunft wird auf jetzt geklemmt. | unit | offen (Slice #2) |
| AC-10.2 | `storeTriple` mit `episode_id` legt genau einen `episode_triples`-Link an (in derselben Tx wie der Tripel-Write); ohne `episode_id` keinen. | unit | offen |
| AC-10.3 | Konsolidierung inflationiert die Konfidenz NICHT: dieselbe Aussage aus N Episoden → Konfidenz wie bei einem Re-Assert (kein Count-Boost, A4). | unit | offen |
| AC-10.4 | Recency-Refresh: `storeTriple` mit `episode_id` aktualisiert `asserted_at` des Ziel-Tripels (messbar), ohne Konfidenz-Boost. | unit | offen |
| AC-10.5 | `recallEpisodes` recency-geordnet (occurred_at DESC) + respektiert context/term/since; `limit` hart bei 100 gekappt + `truncated`. | unit | offen |
| AC-10.6 | `episodesForTriple` liefert verknüpfte Episoden + Tripel-Status; status-unabhängig (auch für `retracted` Tripel). | unit | offen |
| AC-10.7 | Status-Unabhängigkeit: `storeTriple(episode_id)` auf ein `retracted` Tripel legt den Link an, lässt `local_status='retracted'` (keine Reaktivierung, #1b). | unit | offen |
| AC-10.8 | `episodicGc` entfernt alte Episoden + Links + verwaiste Links; semantische Tripel unangetastet. | unit | offen |
| AC-10.9 | Verwaister Link (Ziel-Tripel per GC weg) → `episodesForTriple`/`recallEpisodes` crashen nicht, behandeln ihn definiert. | unit | offen |
| AC-10.10 | Föderations-Parität: Episoden nicht im Wire — `exportSince` enthält keine Episoden-Daten; Links beeinflussen `vector_clock`/Signatur nicht. | unit | offen |
| AC-10.11 | Additive Migration: bestehende DB ohne `episodes`-Tabellen → Tabellen werden angelegt, Bestandsdaten unberührt. | unit | offen |
| AC-10.12 | Fehlerfall: leerer/>8000-Zeichen-`content` → fail-closed (kein Schreiben); nicht-existente `episode_id` → Tripel-Write bleibt committet, Link übersprungen. | unit | offen |

**Fehlerfälle (UC-EP):** leerer/überlanger `content` → fail-closed (AC-10.12); `episode_id` auf nicht-existente Episode → Link übersprungen + geloggt, Tripel bleibt gültig (AC-10.12); verwaister Link nach Tripel-GC → definiert (AC-10.9); `recallEpisodes` mit kaputtem `since` → leeres Ergebnis/Fehlerquittung; `episodicGc` läuft nie über semantische Tripel (AC-10.8); `DATABASE_LOCKED` → Retry/fail-closed (Bestands-Verhalten).

**Web-validierte Design-Entscheidungen + Risiken (Quellenvergleich, kritisch geprüft):** Die episodisch/semantisch-Trennung, Konsolidierung, Provenienz/Audit, Recency-Gewichtung und Forgetting/GC decken sich mit dem Stand der Agent-Memory-Forschung 2025/26 (NS-Mem; FadeMem; ACT-R-inspirierte Architekturen; SSGM). **Bewusst NICHT übernommen / validiert:**
> - **Zugriffs-Frequenz als Signal** (FadeMem): kollidiert nur scheinbar mit der Leitplanke „Aktualität statt Anzahl" — Quellen-/Episoden-*Anzahl* darf den **Belief** nie inflationieren (A4, fix), Zugriffs-Häufigkeit dürfte allenfalls die **GC-Retention** modulieren (anderer Mechanismus, belief-neutral) → deferred, nicht im Belief.
> - **Memory-Poisoning** (reales, dokumentiertes Risiko): Roh-`content` aus `recallEpisodes` ist **untrusted Data** — ein vergifteter Episode-Text ist ein persistenter Injection-Vektor, wenn der Konsument ihn als Instruktion behandelt. Schutz: (a) Episoden sind lokal/peer-privat (kein Fremd-Poisoning über Föderation), (b) Episoden treiben **nie** direkt den Belief — nur die vom Agenten extrahierten **Tripel** (die durch Trust/Belief/TMS laufen). Konsument MUSS recall-`content` als Daten, nicht als Anweisung behandeln (Threat-Model-Vermerk für den Adversarial-Review).

> **Slice #2b (deferred):** automatische Tripel-Extraktion aus `content` (Agenten-Aufgabe, nicht deterministisch); unscharfe (ähnlichkeitsbasierte) Episoden-Suche ist Teil von Slice #3; zugriffs-frequenz-bewusste GC-Retention (belief-neutral).

### UC-HR — Hybrid-Retrieval: lexikalische Seeds + Personalized PageRank (Slice #3)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern + MCP-Tool `graph__search` · **Roadmap:** §H.2 Punkt 3 (GraphRAG-artig, aber **rein deterministisch** — Nutzer-Entscheidung).

**Ziel (query-first memory):** Auf eine Frage „die richtige Antwort ODER den Weg dahin" liefern — auch ohne exakten Knotennamen. Kombiniert **lexikalische Seed-Suche** (Einstieg) mit **belief-gewichteter Personalized PageRank** (Multi-Hop-Relevanz) + optionalem **Episoden-Recall** (Slice #2). Operator schlägt Struktur (Forschung: PPR > naive Nähe für Multi-Hop).

**Web-validierte Designentscheidung (mehrere Optionen, kritisch geprüft):**
- **Gewählt:** lexikalisch + Personalized PageRank (deterministisch, kein externer Dep). Vorbild HippoRAG.
- **Verworfen:** Vektor-Embeddings (extern/LLM → bricht Determinismus + Dep-Freiheit) → Slice #3b/Agentenseite.
- **Gefahr/Einschränkung (Meta-Analyse 2025/26):** GraphRAG-Gewinne werden leicht überschätzt; bei *einfachen* Lookups ist exakte Suche besser. Konsequenz: exakter/lexikalischer Treffer bleibt **primär**, PPR ist **Anreicherung** für Multi-Hop/thematische Fragen — kein Allheilmittel, keine Überverkaufs-Claims.
- **Hub-Dilution (2026-Befund, HippoRAG-2):** hochgradige Knoten (hunderte Kanten) verteilen PPR-Masse uniform und verwässern die Präzision. Mitigation: belief-Gewichtung (schwache Kanten zählen weniger) dämpft das bereits; Grad-Normalisierung/Hub-Cap als optionale Verfeinerung **deferred** (#3b).

**§20.3-RAG-Einordnung (deterministisch, kein Embedding-RAG):** Dies ist **graph-natives** Retrieval, kein Chunk/Embedding-RAG. Felder: **Chunking** = n/a (keine Dokumente, atomare Tripel); **Embedding** = bewusst keine Vektor-Embeddings (Determinismus) — Ersatz: lexikalische Seeds + PPR; **Retrieval** = lexikalische Seed-Suche + belief-gewichtete Personalized PageRank; **Caching** = keiner, Re-Compute je Query (read-only, immer aktueller Graph-Stand); **Invalidierung** = entfällt mangels Cache (kein veralteter Index möglich).

**Determinismus-Einordnung:** `search` ist eine **lokale Lese-Linse** (wie `resolveBelief`) — Float-PPR ist erlaubt, weil lokal + nicht föderiert (kein Wire, keine Cross-Language-Bit-Identität nötig). Reproduzierbarkeit **innerhalb** einer Engine via fixe Iterationszahl + feste Knotenordnung (sortiert) + Konvergenz-Toleranz.

**Parameter:** `term` (String, Pflicht, ≥2 Zeichen) · `limit` (Int 1–50, Default 10) · `max_hops` (Int 1–5, Default 3) · `max_iter` (Int 1–200, Default 100) · `tol` (Float, Default 1e-6) · Damping `d=0.85` (fix). Hinweis: bei `d=0.85` ist die Konvergenzrate ~0.85/Iteration → `tol=1e-6` wird um ~Iteration 85 erreicht; für Ranking genügt das (relative Ordnung stabilisiert früher). `converged=false` (Cap erreicht) ist kein Fehler, nur Information — das Ranking bleibt deterministisch.

**Ablauf (nummeriert, verzweigt) — `search({term, limit, max_hops, max_iter, tol, as_of?})`:**
1. **Seed-Suche (lexikalisch):** Knoten, deren Name `term` enthält (LIKE mit `ESCAPE`, Sonderzeichen literal). Keine Seeds → Frühausstieg mit leerem Ergebnis (kein globaler PageRank-Fallback — vermeidet Hub-Rauschen).
2. **Subgraph (k-Hop, 🟡-Perf/Hub):** von den Seeds aus BFS bis `max_hops` über `local_status='active'`-Kanten — bei `as_of=T` zusätzlich konjunktiv über die UC-BT-Lese-Linse `COALESCE(valid_from, asserted_at) ≤ T AND (valid_to IS NULL OR T < valid_to)` (Slice #5b: dieselbe Klausel wie in `query`/`verify`/`resolveBelief`, keine Linsen-Inkonsistenz möglich) → begrenzter, fokussierter Subgraph (statt Vollgraph; dämpft Hub-Dilution + begrenzt Laufzeit). Knoten- und **Kantenordnung deterministisch nach `triple_hash`/Name sortiert** (🔴-1: fixiert die Float-Summationsreihenfolge — IEEE-754-Addition ist nicht assoziativ).
3. **Personalized PageRank:** Power-Iteration `r = (1−d)·p + d·(Wᵀr + dangling·p)`, Teleport `p` uniform auf den Seeds, Kanten-Gewicht = **trust-diskontierte Konfidenz** `confidence/1000 × trustFactor(originTrust)/1000` (🟡-3: ein `limited`/niedrig-vertrauter Origin rankt nicht allein wegen hoher gespeicherter confidence oben); **Dangling-Knoten** verteilen ihre Masse über `p` (kein Rank-Leck); Abbruch bei L1-Delta < `tol` ODER `max_iter` (dann `converged=false`). Parameter werden geklemmt (Ranges oben).

**Relevanz ≠ Glaubwürdigkeit (Klarstellung, Adversarial 🟡-3):** `search` ist eine **Relevanz-Linse** (trust-diskontierte Konfidenz × Graph-Zentralität), **nicht** die volle Belief-Auflösung. Die autoritäts-/recency-/widerspruchs-gewichtete Glaubwürdigkeit pro Aussage liefert weiterhin `resolveBelief` (Softmax über distinkte Objekte). Konsument: `search` für „was ist relevant/wo ist die Antwort", `resolveBelief` für „was gilt".
4. **Ranking (🔴-2 eindeutig):** Tripel-Score = `(r_subject + r_object) × confidence/1000`; absteigend, **stabiler Tie-Break** lexikografisch nach `triple_hash` (wie `resolveBelief`). Top-`limit` (hart bei 50 gekappt + `truncated`).
5. **Hybrid-Ausgabe:** exakte lexikalische Tripel-Treffer (**primär**) + PPR-gerankte Nachbarschaft + (optional) `recallEpisodes(term)`; je Treffer die Herkunft (`lexical`/`graph`/`episodic`).

| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-11.1 | `search` findet ein relevantes Tripel über einen Multi-Hop-Pfad (innerhalb `max_hops`), das eine Tiefe-1-`query` nicht liefert. | unit | offen (Slice #3) |
| AC-11.2 | Seeds rein lexikalisch (LIKE+ESCAPE, Sonderzeichen literal); kein Treffer → leeres Ergebnis (kein Crash, kein globaler Fallback). | unit | offen |
| AC-11.3 | Konfidenz-Gewichtung: bei sonst gleicher Topologie rankt das höher-konfidente Nachbar-Tripel vor dem schwächeren. | unit | offen |
| AC-11.4 | **Determinismus:** identische Tripel in **umgekehrter Insert-Reihenfolge** → identisches Ranking (fixe Knoten-+Kanten-Summationsordnung + stabiler Tie-Break). | unit | offen |
| AC-11.5 | Konvergenz/Terminierung: Abbruch bei `tol` ODER `max_iter`; Dangling lecken keine Masse: `|Σr − 1| < 1e-9`. | unit | offen |
| AC-11.6 | Nur `active`-Tripel: `retracted`/`superseded`/`quarantined` sind weder Seed noch im Subgraph/PPR. | unit | offen |
| AC-11.7 | `limit` hart bei 50 gekappt + `truncated`-Flag. | unit | offen |
| AC-11.8 | read-only: keine Schreibwirkung, kein Wire, kein `vector_clock`-Tick, keine Konfidenz-/Status-Änderung. | unit | offen |
| AC-11.9 | k-Hop-Begrenzung: ein Tripel jenseits `max_hops` von jedem Seed ist NICHT im Ergebnis (Perf-/Hub-Schranke). | unit | offen |
| AC-11.10 | erreicht PPR `max_iter` ohne Konvergenz → Ergebnis wird trotzdem geliefert mit `converged=false`. | unit | offen |
| AC-11.11 | **(Slice #5b)** `as_of=T` filtert nicht-zu-T-gültige Kanten aus dem Subgraphen (konjunktiv zu `active`); halb-offen `[from,to)`. | unit | erfüllt (engine-search.test.mjs: „AC-11.11 (Slice #5b)") |
| AC-11.12 | **(Slice #5b)** ungültiges `as_of` (kein ISO-Datum) → `INVALID_PARAMETER_FORMAT` (fail-closed, keine stille „jetzt"-Antwort). | unit | erfüllt (engine-search.test.mjs: „AC-11.12 (Slice #5b)" + mcp.test.mjs: „graph__search as_of …") |
| AC-11.13 | **(Slice #5b)** Lese-Linsen-Vertrag (per Kante, **kein** objekt-bezogener Subset): keine zu T außerhalb-gültige Kante taucht in `search` oder `query` auf — beide Linsen tragen dieselbe SQL-Klausel. Hinweis (🟡-B Adversarial): `search ⊆ query` ist NICHT der Vertrag, weil Topologie-Reichweiten (LIKE+k-Hop vs. exact+1-Hop) sich unterscheiden. | unit | erfüllt (engine-search.test.mjs: „AC-11.13 (Slice #5b): Lese-Linsen-Vertrag …") |
| AC-11.14 | **(Slice #5b 🟡-A)** `search` reicht `as_of` als obere Schranke (`until`) an `recallEpisodes` durch — der Hybrid-Output enthält keine Episode mit `occurred_at > as_of`. Sonst wäre die Lese-Linse zwischen Kanten- und Episoden-Achse inkonsistent. | unit | erfüllt (engine-search.test.mjs: „AC-11.14" + „AC-11.14b" Slice #5b 🟡-A) |

**Fehlerfälle (UC-HR):** leerer/<2-Zeichen-`term` → leeres Ergebnis (kein Crash); Graph ohne aktive Kanten / keine Seeds → leeres Ergebnis; `term` mit LIKE-Sonderzeichen → literal (ESCAPE, vgl. UC-EP 🟡-1); großer Graph → `max_hops`+`max_iter`-Cap begrenzen die Laufzeit (read-only, keine Sperre); **(Slice #5b)** ungültiges `as_of` (kein ISO-Datum) → `INVALID_PARAMETER_FORMAT`, fail-closed vor Seed-Suche (identisch zu UC-BT-Fehlerfall); `as_of` in der fernen Zukunft mit leerer Linse → leeres Ergebnis (kein Crash, konsistent zu UC-BT AC-13.12).

> **Slice #3b (deferred):** echte semantische Ähnlichkeit via Vektor-Embeddings (extern/LLM, nicht deterministisch — Agentenseite); Re-Ranking-Verfeinerungen.

> **Slice #5b → erledigt:** `search({as_of:T})` hebt die UC-BT-Lese-Linse von `query`/`verify`/`resolveBelief` auch ins Hybrid-Retrieval — gleiche Klausel, gleiche Semantik (halb-offen, konjunktiv zu `active`), fail-closed bei ungültigem ISO. **Episoden-Achse mit-erledigt (🟡-A):** `recallEpisodes` bekam `until`-Parameter, `search` reicht `as_of` als obere Schranke durch — damit ist die Hybrid-Antwort linsenkonsistent zwischen Kanten und Episoden. Damit ist jede lokale Lese-Linse zeitlich konsistent.

### UC-V — Verifikation: `verify(claim)` gegen den Graphen (Slice #4)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern + MCP-Tool `graph__verify` · **Roadmap:** §H.2 Punkt 4 (Frontier 2026: VeriCoT, Eidoku, ClaimVer).

**Ziel (Schlussstein „halluzinationsfrei"):** Eine vom Agenten/LLM behauptete Aussage `(subject, predicate, object)` gegen das Gedächtnis prüfen und ein **deterministisches Verdikt** liefern — nutzt die drei bestehenden Säulen: Belief (Widerspruch), TMS/`derived_from` (Stützung), `search`/PPR (Pfad/Relatedness). Der Agent kann so vor dem Ausgeben einer Antwort prüfen, ob sie das Gedächtnis stützt, ihm widerspricht oder unbekannt ist.

**Verdikt-Definition (über `resolveBelief(s,p)`):**
- **`supported`** — die Aussage ist der Belief-Gewinner (single-value) ODER ein gültiges Objekt eines Mehrwert-Prädikats. Belief + Stützung (`derived_from`, falls abgeleitet) werden mitgeliefert.
- **`contradicted`** — für `(s,p)` glaubt der Graph ein **anderes, durchsetzungsfähiges** Objekt (single-value, `winner ≠ null` UND `winner ≠ object`). Das dominante Objekt wird mitgeliefert; `present` = ob `object` selbst noch unter den (belief-unterlegenen) Kandidaten ist → `present:true, dominant:X`.
- **`unknown`** — **OPEN-WORLD-PFLICHT:** keine aktiven `(s,p)`-Aussagen (`resolveBelief=null`), **ODER kein durchsetzungsfähiger Belief-Gewinner** (`rb.winner === null`, allZero — alle Top-Kandidaten Gewicht 0), ODER Mehrwert-Prädikat ohne dieses Objekt. Fehlendes/gewichtsloses Wissen ist **NIE** `contradicted` — Abwesenheit ≠ Widerlegung.

**Invariante:** `verify` trifft **keine** eigene Glaubwürdigkeits-Entscheidung — das Verdikt ist eine reine **Projektion von `resolveBelief`** (Trust-/Autoritäts-/Recency-Linse unverändert geerbt → kein zweiter Belief-Pfad, keine Drift).

**Ablauf (nummeriert, verzweigt) — `verify({subject, predicate, object})`:**
1. Format validieren (s/p/o-Regex wie storeTriple); ungültig → Fehler (kein Verdikt).
2. `rb = resolveBelief(subject, predicate)`.
3. `rb === null` → **`unknown`** (kein Subjekt-Knoten ODER keine aktive `(s,p)`-Aussage — beide open-world).
4. `rb.multiValue` → `object` in `rb.candidates`? ja → **`supported`**; nein → **`unknown`** (set-valued, Abwesenheit ≠ Widerspruch).
5. `rb.winner === null` (allZero, kein durchsetzungsfähiger Gewinner) → **`unknown`** (🔴-1: NIE contradicted).
6. `rb.winner === object` → **`supported`**, Verdikt bleibt supported auch bei `rb.contested===true` (Flag wird durchgereicht, warnt den Konsumenten).
7. sonst (`winner ≠ null` UND `winner ≠ object`) → **`contradicted`** (+ `dominant = rb.winner`, + `present = rb.candidates.some(c => c.object === object)` — Objekt-Ebene, nicht Kanten-Identität).
8. Read-only: keine Schreibwirkung, kein Wire, kein `vector_clock`-Tick.

| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-12.1 | Aktive Aussage, die Belief-Gewinner ist → `supported` (+ Belief). | unit | offen (Slice #4) |
| AC-12.2 | `(s,p)` mit dominantem Objekt X, geprüft wird Y≠X → `contradicted` (+ `dominant=X`). | unit | offen |
| AC-12.3 | **Open-World:** unbekanntes `(s,p)` (keine aktive Aussage) → `unknown`, **niemals** `contradicted`. | unit | offen |
| AC-12.4 | Mehrwert-Prädikat (`hat_tag`): vorhandenes Objekt → `supported`; nicht vorhandenes → `unknown` (kein Widerspruch). | unit | offen |
| AC-12.5 | Belief-unterlegene, aber präsente Kante (Y aktiv, aber X dominiert) → `contradicted` mit `present:true, dominant:X`. | unit | offen |
| AC-12.6 | Nur `active` zählt: ein `retracted`/`superseded`/`quarantined` Objekt gilt nicht als Stützung; ist es das einzige → `unknown`. | unit | offen |
| AC-12.7 | `supported` einer abgeleiteten Aussage liefert die Begründung (`derived_from`/Stützung) mit (Erklärbarkeit). | unit | offen |
| AC-12.9 | **Open-World (allZero):** multi-candidate mit `rb.winner===null` (alle Top-Kandidaten Gewicht 0 / nur untrusted) → `unknown`, **niemals** `contradicted`. | unit | offen |
| AC-12.10 | Belief-Gewinner mit Zweitplatziertem ≥ `contestedThreshold` → `supported` MIT `contested:true` (Verdikt bleibt supported). | unit | offen |
| AC-12.11 | Projektion: `verify` nutzt ausschließlich `resolveBelief` (keine eigene Belief-Logik) — Verdikt folgt der trust-primären Linse ohne Divergenz. | unit | offen |
| AC-12.8 | read-only: keine DB-/Konfidenz-/Status-/`vector_clock`-Änderung durch `verify`. | unit | offen |

**Fehlerfälle (UC-V):** ungültiges s/p/o-Format → Fehler, kein Verdikt; **Abwesenheit von Wissen → `unknown`, nie `contradicted`** (open-world, die zentrale Gefahr); Mehrwert-Prädikat-Abwesenheit → `unknown`; `verify` ist read-only (keine Sperre).

> **Slice #4b (deferred):** strukturelle Pfad-Verifikation à la Eidoku (existiert *irgendein* Pfad subject↔object? via `search`/PPR als Zusatz-Signal `related`), und Mehr-Schritt-Claim-Zerlegung (mehrere Tripel einer Antwort gemeinsam prüfen) — bleibt Agenten-/Folge-Arbeit.

### UC-BT — Bi-temporale Gültigkeit + „as-of"-Abfrage (Slice #5)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern + MCP `graph__set_validity` / `graph__query` (`as_of`) · **Roadmap:** §H.2 Punkt 5. Validiert (Zep/Graphiti +18,5 % LongMemEval; BiTRDF) + CDP5-geprüft.

**Ziel:** „Was galt zum Zeitpunkt T" — temporales Gedächtnis mit **Gültigkeits-Intervallen** statt nur Zeitstempeln. Konflikt **nicht-destruktiv**: ein temporal überholter Fakt wird nicht gelöscht, sondern sein Gültigkeits-Ende gesetzt (historisch abfragbar).

**Zwei Zeitachsen (ohne Wire-Bruch — CDP5-Architektur-Entscheidung):**
- **Event-/Valid-Time:** `valid_from` (Default = signiertes `asserted_at`) … `valid_to` (offen = `NULL`). Halb-offenes Intervall `[valid_from, valid_to)`.
- **Transaction-Time:** vorhandenes `created_at`/`updated_at`.
- `valid_to` (+ optionaler `valid_from`-Override) sind **LOKAL** — wie `retracted`/`superseded` **nicht** signiert/föderiert (kein Wire-v2-Bruch, Parität gewahrt). Föderiert bleibt nur das signierte `asserted_at` (= Default-`valid_from`).

**Determinismus (CDP5):** Graphitis LLM-Widerspruchs-Erkennung wird NICHT übernommen. Temporale Supersession ist **explizit** (`supersedeTemporally`) oder über die deterministische same-(s,p)-Regel — nie geraten.

**Parameter:** `as_of` (ISO-8601, optional; Default „jetzt") · `valid_from`/`valid_to` (ISO-8601, nullable). Ungültiges ISO → Fehler.

**Datenmodell:** additive Spalten `valid_from TEXT`, `valid_to TEXT` (beide nullable) auf `knowledge_edges`. **Default-Materialisierung (🔴-1):** Spalten bleiben NULL; der Default `valid_from = asserted_at` greift als **Fallback in der Query** via `COALESCE(valid_from, asserted_at)` (keine Backfill-Schreibung; Bestandszeilen bleiben damit korrekt „offen gültig"). **Migrations-Korrektheit (🔴-6):** `valid_from`/`valid_to` werden in BEIDEN Schema-Quellen ergänzt — `SCHEMA` (frische DB) **und** `EDGES_REBUILD` (db.mjs) — damit ein späterer `retracted`-Rebuild (namensbasierte Spalten-Kopie) sie nicht abschneidet. Für Bestands-DBs: idempotentes `ALTER ADD COLUMN` (nur falls fehlend, reihenfolge-unabhängig zum retracted-Rebuild). Keine CHECK-Constraint.

**Ablauf (nummeriert, verzweigt):**
1. `setValidity(hash, {valid_from?, valid_to?})`: unbekannter Hash → `null` (kein Schreiben, wie `reinforce`); ISO-Validierung; `valid_to ≤ valid_from` → Fehler (leeres Intervall). **Zukunfts-`valid_from` ist ERLAUBT** (🟡-3: legitime geplante Gültigkeit „gilt ab morgen" — anders als das Zukunfts-Klemmen von `asserted_at`, das Rückdatierungs-Betrug der signierten Aussage verhindert; `valid_*` ist lokale Welt-Gültigkeit).
2. `supersedeTemporally({subject, predicate, object, as_of})` — **nur single-value** (Mehrwert-Prädikate sind set-valued → nicht anwendbar, 🔴-2): 2a. neuer Hash existiert bereits → nur `valid_from=as_of` setzen (idempotent, kein Duplikat); 2b. **alle** offenen (`valid_to IS NULL`) aktiven same-`(s,p)`-Fakten mit `valid_to=as_of` schließen; 2c. neuen Fakt mit `valid_from=as_of` anlegen. Alte bleiben `active` + auditierbar.
3. **as-of-Lese-Linse** auf `query`/`resolveBelief` (Param `as_of=T`): eine Aussage zählt nur, wenn **`local_status='active'` UND** `COALESCE(valid_from, asserted_at) ≤ T` UND (`valid_to IS NULL` ODER `T < valid_to`) — halb-offen, **konjunktiv zur active-Menge** (🔴-2). Ohne `as_of` = „jetzt". Mehrwert-Prädikate: Filter gilt je Kante (mehrere gleichzeitig gültig bleiben möglich).
4. **as-of verfeinert die `active`-Menge, garantiert KEINE Vergangenheits-Vollständigkeit (🟡-5):** ein per Decay `superseded`/per TMS `retracted`/`quarantined` gewordener Fakt erscheint NIE, auch nicht historisch (GC/Decay löschen historische Sichtbarkeit — bewusst akzeptiert; valid_* sind lokal, kein vollständiger History-Store).
5. Read-only außer `set/supersede`; diese schreiben nur lokale Spalten (kein Wire/`vector_clock`-Tick, kein Signatur-Eingriff). `DATABASE_LOCKED` → Retry/fail-closed (Bestands-Verhalten).

| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-13.1 | `valid_from` default = `asserted_at`; ohne `valid_to` gilt der Fakt „jetzt" (offen). | unit | offen (Slice #5) |
| AC-13.2 | `as_of=T` liefert nur zu T gültige Fakten (halb-offen `[from,to)`); ein vor T beendeter Fakt fehlt, ein nach T begonnener fehlt. | unit | offen |
| AC-13.3 | `supersedeTemporally` schließt den alten Fakt (`valid_to=as_of`) + legt neuen (`valid_from=as_of`) an; **beide bleiben `active`** (nicht gelöscht). | unit | offen |
| AC-13.4 | as-of in der Vergangenheit liefert den ALTEN Fakt, as-of „jetzt" den NEUEN (nicht-destruktive Historie). | unit | offen |
| AC-13.5 | `resolveBelief(s,p,{as_of:T})` wählt den Gewinner nur unter den zu T gültigen Fakten. | unit | offen |
| AC-13.6 | `setValidity` mit `valid_to ≤ valid_from` → Fehler (leeres Intervall); ungültiges ISO → Fehler. | unit | offen |
| AC-13.7 | Föderations-/Wire-Parität: `valid_from/valid_to` sind nicht im Wire/`signingString`; `exportSince` + Signatur unverändert; bit-identisch mit/ohne Validitäts-Daten. | unit | offen |
| AC-13.8 | Additive Migration: Bestands-DB ohne `valid_*`-Spalten → Spalten ergänzt, Bestandsdaten + Tripel unberührt; idempotent. | unit | offen |
| AC-13.9 | Open-World/Determinismus: fehlende Validitäts-Info = „gültig/offen" (Bestandszeile mit `valid_from=NULL` via COALESCE in jeder as_of-Abfrage sichtbar); `as_of`-Filter deterministisch + read-only. | unit | offen |
| AC-13.10 | `as_of`-Filter ist **konjunktiv zu `active`**: ein abgelaufener-aber-`active` Fakt zählt im „jetzt"-Belief NICHT doppelt; ein `retracted`/`superseded` Fakt erscheint auch historisch nicht. | unit | offen |
| AC-13.11 | `supersedeTemporally` auf ein Mehrwert-Prädikat → abgewiesen/nicht anwendbar (nur single-value); existierender Hash → idempotent (`valid_from` gesetzt, kein Duplikat). | unit | offen |
| AC-13.12 | Zukunfts-`valid_from` (> jetzt) ist erlaubt; der Fakt erscheint erst ab `valid_from` in „jetzt"-Abfragen. | unit | offen |
| AC-13.13 | Migrations-Robustheit: `valid_*` sind in `SCHEMA` **und** `EDGES_REBUILD`; ein `retracted`-Rebuild NACH gesetzter Validität erhält `valid_from/valid_to` (kein Spaltenverlust). | unit | offen |

**Fehlerfälle (UC-BT):** leeres/negatives Intervall (`valid_to ≤ valid_from`) → Fehler; ungültiges ISO-Datum → Fehler; unbekannter Hash bei `setValidity` → `null` (kein Schreiben); `as_of` ohne Treffer → leeres Ergebnis (kein Crash); `supersedeTemporally` ohne offenen Vorgänger → legt nur den neuen Fakt an (kein Fehler); Mehrwert-Prädikat bei `supersedeTemporally` → nicht anwendbar; fehlende `valid_*` = offen gültig (open-world); `DATABASE_LOCKED` → Retry/fail-closed.

**Bekannte Grenzen (Adversarial-Runde, bewusst akzeptiert):**
- **🟡-3 Föderations-Asymmetrie:** ein lokal temporal abgelöster Fakt (`valid_to` gesetzt, aber `local_status='active'`) wird weiter exportiert; der Peer hat kein `valid_to` → sieht ihn als offen. `supersedeTemporally` wirkt **rein lokal** (konsistent mit „valid_* nicht föderiert"). Föderierte Gültigkeit bräuchte Wire-v2 → Slice #5b.
- **🟡-5 UTC-Pflicht:** alle Zeitstempel werden bei `setValidity`/`supersedeTemporally` auf UTC-`Z` normalisiert (`_normIso`), da der as-of-Vergleich lexikografisch ist. Offset-Eingaben (`+02:00`) werden korrekt umgerechnet.
- **🔴-1 Inversions-Schutz:** `supersedeTemporally` weist eine Ablösung ab, deren `as_of` vor dem `valid_from` eines offenen Vorgängers liegt (verhindert leeres/invertiertes Intervall = stiller Verlust).

> **Slice #5b (erledigt):** `as_of` auch auf `search` (siehe UC-HR AC-11.11–11.14); föderierte Gültigkeit (Wire-v2 — bewusst weiter deferred); LLM-gestützte Widerspruchs-Erkennung bleibt Agenten-Aufgabe (nicht-deterministisch). (`verify` hat `as_of` seit 🟡-2 Slice #5.)

> **Slice #5d (UC-5d, in Bearbeitung) — UTC-Z-Normalisierung auch auf der Datenseite:** Slice #5 normalisiert die *Lese-*Seite (`_validClause` via `_normIso`), aber `storeTriple`/`mergeIncoming`/`clone` legen `asserted_at` verbatim ab (inkl. Offset `+02:00`). Folge: der lexikografische SQLite-Vergleich `COALESCE(valid_from, asserted_at) <= ?` verschiebt die Sichtbarkeit eines mit `+02:00` gespeicherten Fakts um die Offset-Differenz in die Zukunft. Slice #5b machte das sichtbarer (Hybrid-Retrieval-Linse).
>
> **Design-Constraint (Wire-Vertrag intakt):** `asserted_at` ist Bestandteil des `signingString`. Eine In-Place-Modifikation würde die Origin-Signatur ungültig machen (wir können nicht resignieren — Origin-Privatkey fehlt). Daher **abgeleitete Spalte** statt In-Place-Mutation.
>
> **Implementation:**
> - Schema: `knowledge_edges.asserted_at_norm TEXT` (UTC-Z-normalisiert) + `episodes.occurred_at_norm TEXT` — additiv, kein Rebuild nötig.
> - Engine: beim INSERT/UPDATE wird `_norm` automatisch via `_normIso(asserted_at)` befüllt; `_edgeToWire` ignoriert die `_norm`-Spalten (Wire unverändert, Signatur intakt).
> - Lese-Pfade (`_validClause`, `_recencyFactor`, `COALESCE(valid_from, asserted_at)`): verwenden konsequent `asserted_at_norm` statt `asserted_at`.
> - Migration (idempotent): einmaliger Pass beim DB-Open setzt `asserted_at_norm = _normIso(asserted_at)` für alle Edges mit `asserted_at_norm IS NULL`. Analog für `occurred_at_norm`.
> - Eingangs-Härtung beim Wire: ein Wire mit nicht-UTC-Z `asserted_at` wird **akzeptiert** (Wire-Kompat, Signatur prüft Original), aber lokal normalisiert in `asserted_at_norm` für korrekte Lese-Linsen.
>
> **AC-Tabelle:**
> - AC-5d.1: Wire mit `asserted_at='+02:00'` wird akzeptiert (mergeIncoming-Signatur prüft Original); `asserted_at_norm` ist UTC-Z.
> - AC-5d.2: `query`/`search`/`verify` mit `as_of` knapp nach dem semantisch echten Instant zeigt den Fakt (Linsen-Drift behoben).
> - AC-5d.3: `_edgeToWire` enthält weiterhin **das ursprüngliche** `asserted_at` (keine `_norm`-Felder im Wire); `verifyTriple` gegen Origin bleibt grün.
> - AC-5d.4: Migration ist idempotent — zweiter DB-Open verändert nichts; Bestands-Fakten ohne Offset (bereits Z) bleiben byte-gleich.
> - AC-5d.5: `_recencyFactor` nutzt `asserted_at_norm` → ein mit `+02:00` empfangener Fakt hat dieselbe Recency wie ein semantisch identischer mit `Z`.
> - AC-5d.6: `episodes.occurred_at_norm` analog; `recallEpisodes`-Filter (`since`/`until`) lexikografisch korrekt für Offset-Eingaben.
> - AC-5d.7: Föderations-Parität — gleiche Wire-Daten ergeben auf zwei Knoten gleichen `asserted_at_norm` (deterministische `_normIso`).
> - AC-5d.8 (Adversarial-Repro): Probe-Case mit `asserted_at='2024-06-01T12:00:00+02:00'` und `as_of='2024-06-01T10:00:01Z'` → Fakt sichtbar (vorher: Drift 2 h).
>
> **Fehlerfälle (UC-5d):** ungültiges ISO im Wire → `asserted_at_norm` bleibt `NULL`, Lese-Linse fällt auf `valid_from`/Epoch zurück; Migration crash → idempotent restartbar (kein partieller Schaden, weil `_norm`-Spalte additiv); concurrent INSERT während Migration → durch `BEGIN IMMEDIATE` serialisiert.
>
> **Determinismus-Gate:** `_normIso` ist deterministisch (Standard-`Date.parse` + UTC-Z-toISOString); zwei Knoten ergeben dieselbe normalisierte Form.

### UC-MS — Multi-Source-Corroboration (Trust-Quorum-Endorsement, Slice #M.1)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern + neue Tabelle `triple_endorsements`, MCP `graph__endorse_triple` (additiv) · **Roadmap:** §H.2 zwischen #5 und #6, vor #R1/R2/R3.

**Ziel (menschenähnliche Stärke ohne menschliche Schwäche):** Eine Aussage soll an Glaubwürdigkeit gewinnen, wenn sie von mehreren *unabhängigen* Quellen bestätigt wird — **ohne** Echo-Kammer (gleiche Quelle 100×), **ohne** Sybil-Verstärkung (100 untrusted-Peers), **ohne** Wahrheits-Vorhersage (keine `believe(70%)`-Aussagen). Endprodukt von `verify`/`resolveBelief` bleibt **kategorisch** (`supported`/`contradicted`/`disputed`/`unknown`) mit Provenienz.

**Forschungs-Anker (validiert + CDP5-geprüft 2026):**
- *Subjective Logic* (Jøsang, fortlaufend bis 2026 — DSPG-Synthesis): formale Multi-Source-Fusion mit Trust-Discounting. **Frame übernommen, probabilistische Ausgabe verworfen** (Determinismus-Gate + „keine plumpen Halluzinationen").
- *Wisdom of Crowds* (2026): unabhängige Bestätigungen mit unkorrelierten Fehlern aggregieren konstruktiv — **Korrelations-Annahme kritisch** → Cluster-Independence-Filter Pflicht.
- *Sybil-Defense* (FoolsGold/FedSybil 2026): trust-gewichtete Aggregation > naive Stimmenzahl. **Konzept übernommen**, Sybil bei uns ohnehin durch manuelle `trust_level`-Vergabe weitgehend eingedämmt (untrusted → tier 0 → kein Belief-Gewicht).

**Daten-Modell (Schema-Eingriff, additiv):**
- `triple_endorsements(triple_hash, origin_peer_id, source_cluster_id, source_type, asserted_confidence, asserted_at, asserted_at_norm, signature, PRIMARY KEY (triple_hash, origin_peer_id))` — eine Zeile pro (Tripel, Origin). Wire bleibt: jedes Endorsement ist eine eigene signierte Wire-Nachricht (kein Wire-v2).
- `peers.cluster_id TEXT` — optionale Cluster-Markierung; Default: `cluster_id = peer_id` (jeder als eigener Cluster, konservativ). Manuelle Cluster-Zuweisung wie heute `trust_level`.

**Wertebereiche (zitiert aus §B):** `trustRank ∈ {0 untrusted, 500 limited, 1000 full, 1500 authoritative}`; `tier ∈ {0..6}` (llm/manual=0, sensor=1, web=2, fachquelle=3, behoerde=4, gesetz=5, audit=6). Die Aggregation rechnet in dieser Integer-Promille-Skala.

**Mechanik (deterministisch):**
1. **Endorsement-Empfang** (`endorseTriple(wire)` ODER `mergeIncoming` für bekannten Hash): Signatur über das Endorsement-Tupel prüfen; bei akzeptierter Signatur in `triple_endorsements` einfügen. Kollidierende Wieder-Behauptung desselben (triple, origin) → `INSERT OR IGNORE` (Idempotenz).
2. **Quorum-Aggregation** (Lese-Pfad in `resolveBelief`) — **explizite Formel (🔴-1 geschlossen):**
   ```
   clusterContribution(c) = MAX_{e ∈ c}(trustRank(e.origin) × tier(e.source_type))   // Integer, Wertebereich 0..9000
   weighted_support       = Σ_c clusterContribution(c)                                // Σ über distinkte cluster_id
   cluster_count          = |{c : clusterContribution(c) > 0}|                        // gezählt werden nur „beitragende" Cluster
   ```
   Pro Cluster zählt das **stärkste** Endorsement (MAX), nicht die Summe — Echo-Kammer innerhalb eines Clusters neutralisiert. `weighted_support` ist die **Summe** dimensionsloser Promille×Tier-Beiträge über Cluster-Grenzen hinweg.
3. **Kategorisches Verdikt** (Schwellen, KEINE Probabilistik) — Konstanten in `conformance.mjs` (PHP-spiegelbar):
   - `supported` ⇔ ∃ Cluster `c*` mit `clusterContribution(c*) ≥ AUTH_FLOOR=4500` (single authoritative-Pfad: `trustRank ≥ full × tier ≥ fachquelle`) **ODER** `cluster_count ≥ 2 ∧ weighted_support ≥ Q=2000`.
   - `disputed` (intern, Flag `contested:true`) ⇔ zwei *konkurrierende* Objekte (gleiche s+p, distinkte o) erreichen jeweils die `supported`-Schwellen.
   - `contradicted` ⇔ ein dominantes Objekt erreicht `supported` UND das gefragte Objekt nicht.
   - `unknown` ⇔ keine Schwelle erreicht (Open-World — niemals „vermutlich", niemals Float-Wahrscheinlichkeit im Output).
4. **Wire-Konsistenz:** `knowledge_edges` bleibt Single-Row pro Hash (für `_edgeToWire`-Konsumenten, die das nicht kennen, weiter konsumierbar). Live-`confidence` projiziert weiter das stärkste Endorsement.

**`verify`-Verträglichkeit (🟡-1 geschlossen):** UC-V bleibt bei den drei Verdikten `{supported, contradicted, unknown}`. `disputed` ist **kein** viertes verify-Verdikt, sondern ein **Flag** `contested:true` zusammen mit `supported`/`contradicted` (wie heute in UC-12). Konsumenten, die nur die drei Verdikte kennen, sehen weiterhin nur drei Werte.

**Restrisiko-Notiz Self-Endorsement (Re-Audit 🟡-A):** Ein lokaler Peer kann sein eigenes Tripel mit einem `gesetz`/`behoerde`-source_type-Endorsement allein auf Quorum-`supported` heben (`full × tier 6 = 6000 ≥ AUTH_FLOOR=4500`). Dieses Verhalten ist konsistent mit der allgemeinen Single-Auth-Schwelle, aber Konsumenten sollten wissen: `supported` aus dem MCP unterscheidet derzeit nicht zwischen „extern korroboriert" und „lokal mit hoher Autoritäts-Selbst-Aussage". Slice #M.2 wird ein `external_cluster_count`-Feld in der Output-Struktur ergänzen, damit der Konsument das selbst entscheiden kann.

**multiValue-Verträglichkeit (Re-Audit 🔴 multiValue):** Bei mehrwertigen Prädikaten (`hat_tag`, `quelle`, `verweist_auf`, `gehoert_zu`, `hat_wert`, `enthaelt`, `beispiel`, `hat_abschnitt`) sind Geschwister-Aussagen **kein Widerspruch**. Der Quorum-Pfad in `verify` umgeht für diese Prädikate die Konflikt-Logik (kein `contested`, kein `contradicted` aus Geschwister-Endorsements) — jedes Endorsement gilt isoliert für das eigene Objekt.

**Restrisiko-Notiz Cluster-Inference (🔴-2 als bewusster Slice-#M.1-Kompromiss):** In Slice #M.1 wird `peers.cluster_id` **manuell** zugewiesen; Default `cluster_id = peer_id` (jeder Peer = eigener Cluster). **Sybil-Schutz bleibt damit primär die `trust_level`-Achse** (untrusted → trustRank=0 → clusterContribution=0; tragen niemals zum Quorum bei — AC-15.4). Wenn jedoch *mehrere* `trust=full`-Peers ohne explizite Cluster-Zuweisung de facto korreliert sind (z. B. dieselbe Organisation, derselbe LLM-Provider), zählt das aktuelle Slice sie als unabhängig. Schließen erfolgt in **Slice #M.2** (dynamische Cluster-Inference via Endpoint-Suffix / Key-Issuer / Verhaltens-Ähnlichkeit). Bis dahin ist `trust=full` eine **manuell verantwortete** Vertrauens-Aussage — wer einen Peer auf `full` hebt, übernimmt explizit das Korrelations-Risiko.

**Föderations-Race „Endorsement vor Edge" (🔴-3 entschieden — Option b):** Ein Endorsement für unbekannten `triple_hash` wird mit `status=rejected` quittiert (Wire-Vertrag-Response). Es gibt **keine** Pending-Queue (Komplexität + DoS-Vektor). Es liegt am Endorser, beim nächsten Push-Zyklus erneut zu senden — der Edge ist dann hoffentlich angekommen. **Idempotenz nach AC-15.10** garantiert, dass das saubere eventual-consistency-Verhalten bleibt. Sender-Side-Logik (Re-Push pending Endorsements bis `accepted`) ist Verantwortung des Föderations-Partners. AC-15.14 prüft den Re-Push-Pfad.

**AC-Tabelle:**
| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-15.1 | Mehrere Endorsements aus **unterschiedlichen Clustern** mit `trust=full` heben das Verdikt von `unknown` auf `supported` (Quorum erreicht). | unit | offen |
| AC-15.2 | Mehrere Endorsements aus **gleichem Cluster** wirken NICHT doppelt (Max-Aggregation je Cluster) — kein Echo-Verstärken. | unit | offen |
| AC-15.3 | Ein einzelnes `authoritative`-Endorsement schaltet `supported` (kein Quorum nötig). | unit | offen |
| AC-15.4 | 100 untrusted-Endorsements bewegen das Verdikt NICHT (tier=0 → Beitrag=0); Verdikt bleibt `unknown` — Sybil neutralisiert. | unit | offen |
| AC-15.5 | Open-World: kein Endorsement + keine konkurrierende Aussage → `unknown` (NIEMALS `vermutlich` oder probabilistische Aussage). | unit | offen |
| AC-15.6 | Determinismus: gleiche Endorsement-Menge in beliebiger Empfangs-Reihenfolge → gleiches Verdikt + gleiche Candidate-Reihenfolge (lexikografisch sortiert). | unit | offen |
| AC-15.7 | Konkurrierende Objekte aus verschiedenen vertrauten Clustern → `contested:true` + beide candidates sichtbar; `verify` liefert `contradicted` für nicht-dominante Objekte und `supported`+`contested` für das dominante. | unit | offen |
| AC-15.8 | Wire-Kompatibilität: alte Peers konsumieren `_edgeToWire`-Projektion (Single-Row pro Hash) ohne Endorsement-Wissen — Signatur bleibt prüfbar, Determinismus-Gate intakt. | unit | offen |
| AC-15.9 | Föderations-Parität: zwei Knoten mit gleicher Endorsement-Menge ergeben gleiches Quorum-Verdikt (deterministische Aggregations-Funktion). | unit | offen |
| AC-15.10 | Idempotenz: zweimaliger `endorseTriple` desselben (triple, origin) führt zu einer (nicht zwei) Endorsement-Zeile. | unit | offen |
| AC-15.11 | UTC-Z-Konsistenz: Endorsement-`asserted_at_norm` wird wie in UC-5d gepflegt (gleiche Migration). | unit | offen |
| AC-15.12 | Status-Konjunktion: ein `retracted`/`quarantined` Tripel zählt **kein** Endorsement (Quorum gilt nur auf `active`-Tripeln). | unit | offen |
| AC-15.13 | **Probabilistik-Leak-Test (🟡-2):** Verdikt-Felder von `verify`/`resolveBelief`/`graph__endorse_triple` enthalten **keine** Float-Werte, keine `%`/`vermutlich`/`believe_pct`-Ausdrücke; der Schema-Validator wirft sonst. | unit | offen |
| AC-15.14 | **Föderations-Race-Recovery (🔴-3):** ein für unbekannten Hash rejected-Endorsement wird nach Edge-Eintreffen **idempotent** ein zweites Mal angenommen (Endorser-Re-Push) → genau eine Zeile in `triple_endorsements`. | unit | offen |
| AC-15.15 | **Replay-Schutz revozierter Peers (🟡-5):** ein Endorsement, dessen Origin nach `asserted_at` `peer_revoke`-d wurde, wird abgelehnt; bestehende Endorsements desselben Origin werden nach Revoke aus dem `weighted_support` ausgenommen (Decay-konjunktiv zu trust). | unit | offen |
| AC-15.16 | **Default-Cluster-Restrisiko (🔴-2 dokumentiert):** drei `trust=full`-Peers ohne explizite Cluster-Zuweisung werden als drei unabhängige Cluster gezählt — das ist das deklarierte Restrisiko von #M.1 und wird durch das Slice ausdrücklich akzeptiert, bis #M.2 dynamisches Clustering liefert. | doc | offen |

**Fehlerfälle (UC-MS):** Endorsement mit unverifizierter Signatur → rejected; Endorsement für unbekannten triple_hash → rejected (kein Auto-Materialisieren — der Edge muss separat ankommen); Endorsement von eigener Identität → akzeptiert wie Selbst-Aussage (gleiche `_signSelf`-Logik); ungültiges ISO im Endorsement → rejected; `peers.cluster_id` NULL → Fallback `cluster_id = peer_id` (konservativ).

**Determinismus-Gate:** Cluster-Max-Aggregation = `MAX(trustRank × tier)` per Cluster (Integer); Quorum-Schwellen als Konstanten in `conformance.mjs` (PHP-spiegelbar); deterministische Sortierreihenfolge bei Candidates (Cluster-Count DESC, dann Object-Name ASC).

**Wire-Vertrag intakt:** Endorsement-Wire ist eine Erweiterung von `wire_version` — wir nutzen den **gleichen** signingString-Aufbau wie für Tripel (gleiches Format `[wire_version, triple_hash, ...]`), nur mit `endorsement=true`-Marker. PHP-NSAI-Bundle erhält additiv die `triple_endorsements`-Tabelle; alte PHP-Peers ohne MS-Wissen empfangen weiter via `_edgeToWire` die single-row-Projektion.

> **Slice #M.1 (erledigt):** Quorum-Endorsement Phase 1 — Schema, Engine-Aggregation, MCP-Tool `graph__endorse_triple`. **Deferred** zu #M.2: dynamisches Cluster-Inference, Endorsement-Decay über Recency-Achse, Endorsement-Revocation.

### UC-CR — Corrective Retrieval (Eskalations-Loop, Slice #R1)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern in `verify`, MCP `graph__verify` (transparent, derselbe Output) · **Roadmap:** §H.2 nach #M.1.

**Ziel (menschenähnliche Stärke „nochmal nachdenken bevor man unknown sagt", ohne Konfabulations-Risiko):** Wenn `verify` ein `unknown` produzieren würde, sucht das System im graph-strukturellen 2-Hop-Subgraph nach **verwandten supported-Tripeln** und gibt diese als `corrective_hints` zurück — **als Hinweise, nicht als Verdikt-Änderung**. Verdikt bleibt `unknown`. Konsument entscheidet selbst, ob die Hinweise hilfreich sind.

**Adversarial-Audit-Lehre (Slice-Re-Design):** Eine erste Implementation hob `unknown` auf `supported` mittels Substring-Matches und Subgraph-Verwandtschaft — und produzierte damit zwei Konfabulations-Pfade: (1) ein gefragtes Subject „KI-VO" matched per LIKE „FAKE-KI-VO" und übernahm dessen Endorsements; (2) ein `hat_tag`-Quorum für Doc-B leakte als Tag-Aussage über Doc-A (verbunden via `relates_to`). Beide sind genau die plumpen Halluzinationen, die der Slice eliminieren sollte. Konsequenz: **Hint-Modell** — Stufe 2 ändert das Verdikt NIE.

**Forschungs-Anker (RAG 2026, validiert):**
- *Self-Reflective / Corrective RAG* (2026): "wenn Evidenz schwach, re-query mit erweitertem Suchraum". Wir übernehmen die **Idee** (zweite, breitere Lookup-Runde) ohne die Halluzinations-Falle (Suggestion → Verdikt).
- *Adaptive Retrieval* (RAG 2026): Query-Classifier wählt Pipeline. Wir reduzieren auf **Regelbasiert** (Stufe 1 = Standard, Stufe 2 = Subgraph-Hints).

**Mechanik (deterministisch, 2-Stufen):**
1. **Stufe 1 — Standard-Lookup:** `verify` läuft wie bisher (Quorum-Pfad + resolveBelief-Fallback). Liefert `supported`/`contradicted`/`unknown`.
2. **Stufe 2 — Hint-Sammlung (nur wenn Stufe 1 = `unknown` UND subject ist ein exakter Knoten im Graph):**
   - **(a) Exakter-Knoten-Gate:** ist `subject` in `knowledge_nodes.name` NICHT exakt vorhanden → keine Stufe 2 (kein Substring-Match).
   - **(b) Graph-strukturelle 2-Hop-BFS:** vom `subject_id` aus über `knowledge_edges`-Adjazenz (subject_id OR object_id) mit UC-BT-konjunktiver Klausel. Kein `search`/PPR/LIKE (Sycophancy-Lehre).
   - **(c) Hint-Auswahl:** unter den im Subgraph erreichbaren Knoten suche Tripel `(other_subject, gefragtes_predicate, gefragtes_object)` mit `_quorumFor === supported`. Lege diese als `corrective_hints[]` an (sortiert nach `triple_hash`).
3. **Verdikt-Stabilität:** Verdikt bleibt `unknown`, egal wie viele Hints gefunden werden. Konsument liest `corrective_hints` als Diagnose-Hilfe („verwandte Subjekte tragen diese Aussage, dein gefragtes nicht").

**multiValue-Verträglichkeit (AC-16.9):** Bei mehrwertigen Prädikaten (`hat_tag`, …) ist Stufe 2 vollständig **deaktiviert** — Tags/Eigenschaften sind Subject-spezifisch und dürfen nicht über verwandte Subjekte projiziert werden.

**Sicherheits-Constraint (Open-World absolut):** Stufe 2 ändert **NIE** das Verdikt. Damit ist Konfabulation strukturell ausgeschlossen. Hints sind reine Lese-Diagnose; das gefragte Tripel bleibt `unknown` bis ein direktes Endorsement/Belief es supported macht.

**AC-Tabelle:**
| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-16.1 | Stufe-2 ändert das Verdikt NIE — bleibt immer `unknown` (kein Verdikt-Hochheben, keine Konfabulation). | unit | erfüllt |
| AC-16.2 | Stufe-2 findet ein `(other_subject, predicate, object)`-Quorum-supported im 2-Hop-Subgraph → als `corrective_hints[]` ausgegeben; Verdikt bleibt `unknown`. | unit | erfüllt |
| AC-16.3 | Stufe-2-Subgraph-Distanz hart auf max_hops=2 gekappt; **keine** PPR/`search`-Aufrufe, nur BFS über `knowledge_edges`-Adjazenz. | unit | erfüllt |
| AC-16.4 | Output-Feld `corrective_hints[]` ist gesetzt, wenn Hints existieren; sonst nicht vorhanden. Es gibt KEIN `corrective=true`-Flag mehr (Slice-Re-Design). | unit | erfüllt |
| AC-16.5 | Subject existiert nicht als exakter Knoten → unverändert `unknown`, kein Stufe-2-Aufwand. **Insbesondere KEIN Substring-Match-Rescue** über andere Knoten, die den Subject-String enthalten (Adversarial 🔴-1). | unit | erfüllt |
| AC-16.6 | Determinismus: gleicher Graph + Anfrage → gleicher Output, in beliebiger Insert-Reihenfolge. Hints sind nach `triple_hash` sortiert. | unit | erfüllt |
| AC-16.7 | Open-World absolut: Stufe 2 hebt NIE `unknown` auf `supported` — keine Pattern-Match-Vermutung, keine Cross-Subject-Tag-Projektion. | unit | erfüllt |
| AC-16.8 | Föderations-Parität: nur lokale Daten — kein Wire, keine Reentrant-Pull-Operationen während verify. | unit | erfüllt |
| AC-16.9 | multiValue (`hat_tag`, …): Stufe 2 ist deaktiviert (Subject-spezifische Tags dürfen nicht projiziert werden — Adversarial 🔴-2). | unit | erfüllt |
| AC-16.10 | UC-BT-Verträglichkeit: bei `as_of=T` wird Stufe 2 auch über die UC-BT-Linse ausgewertet (gleiche `_validClause`-Klausel wie Stufe 1). | unit | erfüllt |

**Fehlerfälle (UC-CR):** `subject`-Knoten existiert nicht → unverändert `unknown` (kein Stufe-2-Aufwand); ungültiges `as_of` → wie Stufe 1 fail-closed (`INVALID_PARAMETER_FORMAT`); recursive `verify` während Stufe 2 → Stufe 2 ruft nur `_quorumFor` (deterministisch, kein Rekursions-Pfad).

**Determinismus-Gate:** keine LLM-Aufrufe in Stufe 2; nur deterministisch ausgewertete BFS über `knowledge_edges`-Adjazenz (kein `search`/PPR/LIKE) + `_quorumFor`. Alle Schwellen aus `spec`. Hints sortiert nach `triple_hash` (deterministische Reihenfolge zwischen Knoten).

> **Slice #R1 (erledigt):** Corrective Retrieval als Hint-Modell — `_maybeCorrective` sammelt diagnostische Hinweise, ändert das Verdikt NIE. **Deferred** zu #R1b: Alias-Tabelle für Synonym-Knoten, Domain-Wörterbuch.

### UC-SC — Self-Critique-Pflicht-Pass (Multi-Claim-Verify, Slice #R2)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** MCP `graph__assert_claims` (neu); intern `assertClaims([claims])` · **Roadmap:** §H.2 nach #R1.

**Ziel (menschenähnliche Stärke „innerer Fakten-Check vor dem Aussprechen", ohne Konfabulations-Schwäche):** Vor der Generierung einer zusammengesetzten Antwort prüft der LLM-Konsument **mehrere Aussagen gleichzeitig** über `assertClaims([{s,p,o}, ...])` gegen das Gedächtnis. Bekommt pro Claim ein kategorisches Verdikt mit Provenienz plus eine Aggregat-Empfehlung (`all_supported` / `any_contradicted` / `any_unknown`). Damit entscheidet der Agent **deterministisch**, ob er antworten darf oder eine Klarstellungs-Frage stellen muss.

**Forschungs-Anker (RAG 2026, validiert):**
- *Self-Reflective RAG* (2026): „LLM prüft eigene Antwort gegen Retrieval-Quellen vor Ausgabe". Wir liefern das **deterministisch** als Bulk-Verify mit Aggregat — der LLM ist Konsument, nicht Teil der Bewertung.
- *VeriCoT* (Chain-of-Thought-Verifikation): jedes Reasoning-Schritt-Tripel gegen Graph. Wir reduzieren auf den Bulk-Verify-Kern.

**Mechanik (deterministisch):**
1. **Eingabe:** Array von `{subject, predicate, object, as_of?}` Claims (max 50 pro Aufruf, AC-17.6).
2. **Verarbeitung:** für jeden Claim → `verify(claim)` (nutzt komplette UC-V/UC-MS/UC-CR-Pipeline inkl. Quorum + Hints).
3. **Aggregat-Empfehlung** (kategorisch, KEINE Probabilistik) — Priorität streng:
   - `any_contradicted` ⇔ mindestens ein `contradicted` → Agent MUSS Antwort revidieren (höchste Priorität).
   - `any_contested` ⇔ kein contradicted, aber mindestens ein supported mit `contested:true` → Agent MUSS klären/auf Konflikt hinweisen (Adversarial 🔴-5: contested darf NIE als all_supported maskiert werden).
   - `any_unknown` ⇔ keiner der höheren Stufen, mindestens ein unknown → Agent darf ausgeben, muss aber `unknown`-Claims als „unbestätigt" kennzeichnen.
   - `all_supported` ⇔ alle Claims supported und keiner contested.
4. **Per-Claim-Output reduziert auf kategorische Felder (Adversarial 🔴-1/4):** `verdict`, `contested` (Flag), `multiValue` (Flag), `dominant` (String), `present` (Boolean), `corrective_hints[]` (mit `via_subject`+`triple_hash`), `corrective_searched`. **NICHT** durchgereicht werden numerische Provenienz-Felder wie `belief` (Promille), `quorum.weighted_support`, `quorum.cluster_count`, `quorum.contributions` und auch nicht `derived_from` (Inferenz-Ketten) — sonst Wahrscheinlichkeits-/Provenienz-Leak. Wer Provenienz-Details braucht, ruft `graph__verify` (volle Provenienz inkl. `derived_from`) oder `graph__endorsements_for(triple_hash)` separat auf.

**AC-Tabelle:**
| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-17.1 | Bulk-verify über N Claims liefert pro Claim das gleiche Verdikt wie ein einzelner `verify`-Aufruf (Korrektheits-Identität). | unit | offen |
| AC-17.2 | Aggregat `all_supported` ⇔ alle Claims supported. | unit | offen |
| AC-17.3 | Aggregat `any_contradicted` ⇔ mindestens ein contradicted (höchste Priorität). | unit | offen |
| AC-17.3b | **(Adversarial 🔴-5)** Aggregat `any_contested` ⇔ kein contradicted, mindestens ein supported mit `contested:true`. `contested` wird NIE als `all_supported` maskiert. | unit | offen |
| AC-17.4 | Aggregat `any_unknown` ⇔ keiner der höheren Stufen, mindestens ein unknown. | unit | offen |
| AC-17.5 | Leere Claim-Liste → `all_supported` (vacuously) + `count: 0`. | unit | offen |
| AC-17.6 | Mehr als 50 Claims → `INVALID_PARAMETER_FORMAT` (DoS-Schutz, deterministischer Cap). | unit | offen |
| AC-17.7 | Determinismus: gleiche Claim-Liste in gleicher Reihenfolge → identische Verdikt-Reihenfolge. | unit | offen |
| AC-17.8 | Output bleibt **kategorisch** — keine Float-Aggregate, keine Prozent-Zahlen, kein „vermutlich"-Feld. Insbesondere KEINE numerischen Provenienz-Felder (`belief`, `weighted_support`, `cluster_count`, `contributions`) im per-Claim-Result — diese sind Wahrscheinlichkeits-Repräsentationen (Adversarial 🔴-1/4). | unit | offen |
| AC-17.9 | UC-BT-Verträglichkeit: pro-Claim `as_of` wird respektiert. | unit | offen |
| AC-17.10 | MCP-Tool `graph__assert_claims` reicht die Output-Struktur 1:1 durch. | unit | offen |
| AC-17.11 | Ungültige Claim-Struktur (fehlende s/p/o) → `INVALID_PARAMETER_FORMAT`, kein partielles Ergebnis. | unit | offen |
| AC-17.12 | **(Adversarial 🟡-2)** Ungültiges `as_of` in einem Claim → `INVALID_PARAMETER_FORMAT` (fail-closed, KEINE stille Coercion auf jetzt). | unit | offen |
| AC-17.13 | **(Adversarial 🟡-3)** `assertClaims` läuft in einer Read-Transaktion — alle Per-Claim-`verify` sehen einen konsistenten Snapshot, selbst wenn parallel Schreibungen einlaufen würden. | unit | offen |

**Fehlerfälle (UC-SC):** leere Claim-Liste → `all_supported` mit `count: 0` (vacuously true); >50 Claims → `INVALID_PARAMETER_FORMAT`; ungültige Claim-Struktur → wirft auf dem ersten ungültigen Claim, kein partielles Ergebnis.

**Determinismus-Gate:** keine LLM-Aufrufe, keine Floats; reine Schleife über `verify` mit kategorischer Aggregations-Regel.

> **Slice #R2 (erledigt):** Multi-Claim-Verify als Pflicht-Schnittstelle für Agenten. Output kategorisch + Strip-Allowlist.

### UC-VS — Volltext-Suche im Episoden-Recall via FTS5/BM25 (Slice #R3)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern `recallEpisodes`, MCP `graph__recall_episodes` (Output unverändert) · **Roadmap:** §H.2 nach #R2.

**Ziel (menschenähnliche Stärke „relevante Erlebnisse zuerst", ohne Konfabulations-Risiko):** Ein LLM-Konsument formuliert eine Mehrwort-Anfrage („Schulung Risiko KI-VO"). Heute scannt `recallEpisodes` per `content LIKE '%term%'` linear über alle Episoden — ein Term, eine Trefferliste in Recency-DESC. **Mit FTS5+BM25** bekommt der Konsument die nach Relevanz rangierten Episoden zuerst: häufig auftauchende Tokens werden weniger gewichtet (IDF), kurze Episoden mit gehäuften Treffern stehen vorn (TF normalisiert über `avgdl`).

**Scope-Klarstellung (nach Bewertung externer KI-Vorschläge):**
- **FTS5 wird nur für `episodes.content` aufgebaut** — echter Volltext (1–8000 Zeichen), wo BM25 semantisch wirkt.
- **`knowledge_nodes.name` bleibt LIKE-Pfad** — atomare Identifier (`EU-KI-VO`, `KI-Kompetenz`) sind keine Volltexte; FTS5 würde sie als Whole-Tokens speichern, was keinen messbaren Gewinn gegenüber LIKE bringt.
- **Recursive CTE für Graph-Traversal bewusst NICHT übernommen** — würde unsere deterministische BFS-Reihenfolge (#R1-Härtung), die Status-Konjunktion (#M.1-Härtung) und die UC-BT-Lese-Linse (#5d-Härtung) zurücksetzen. JS-BFS bleibt.
- **`search()` Hybrid-Output** nutzt die FTS5-Episoden-Rankliste statt Recency-DESC bei Mehrwort-Anfragen — Knoten-Seed-Auswahl bleibt LIKE.

**Forschungs-Anker (RAG 2026, validiert):**
- *BM25 als Minimum-Viable-Baseline* (RAG 2026): in mehreren 2026-Benches schlägt BM25 sogar text-embedding-3-large — Begründung dafür, keine Vektoren einzuführen (würde Wire/Determinismus brechen).
- *Hybrid Retrieval* (RAG 2026): lexikalisch (BM25) + Graph (PPR). Wir haben den Graph-Teil seit Slice #3.

**Mechanik (deterministisch):**
1. **Schema additiv** — virtuelle Tabelle `episodes_fts(content)` als Contentless-View auf `episodes(rowid, content)`. Tokenizer: `unicode61 remove_diacritics 2` (Umlaut-Toleranz: „Süß" matched „suess").
2. **Trigger-Sync** — `AFTER INSERT/UPDATE/DELETE ON episodes` hält FTS5-Index konsistent zur Quell-Tabelle. ACID innerhalb derselben Transaktion.
3. **Idempotente Migration** — beim DB-Open: `CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts ...`, dann Initial-Index-Build über bestehende Episoden, die noch keinen Eintrag haben (Re-Run no-op).
4. **Query-Sanitization** — `_sanitizeFtsQuery(term)` ersetzt FTS5-Operatoren (`-`, `+`, `:`, `*`, `^`, `(`, `)`, `"`) durch Space und normalisiert Whitespace. Verhindert die ganze Klasse `no such column: VO`-Fehler und schließt eine Injection-Klasse aus.
5. **`recallEpisodes(term=…)`** — wenn `term` vorhanden: `JOIN episodes_fts ON … WHERE episodes_fts MATCH ? ORDER BY bm25(episodes_fts) ASC LIMIT N+1`. Sortiert nach BM25-Score (FTS5-Konvention: negative Werte, kleiner = relevanter), dann nach `id` als Tie-Break. Ohne `term`: Fallback auf bestehende `occurred_at_norm DESC, id`-Sortierung.
6. **`search()` Hybrid** — Mehrwort-Terme verwenden den FTS5-Pfad in `recallEpisodes`; single-token-Terme können entweder Pfad nehmen, Default bleibt FTS5 (deterministisch in beiden Pfaden).

**BM25-Parameter (FTS5-Defaults, in SQLite C-Source hartcodiert):**
- `k1=1.2`, `b=0.75` — FTS5-Defaults, stabil seit SQLite 3.20. FTS5 erlaubt KEIN expliziten Override im SQL (`CREATE VIRTUAL TABLE` hat keine k1/b-Parameter). Determinismus zwischen NSAI-Edge-Knoten ist gegeben, solange beide SQLite ≥ 3.20 nutzen — über `node:sqlite` (Node ≥ 22) und die PHP-Seite mit ihrer eigenen Volltext-Implementierung (z. B. MySQL FULLTEXT). Diese Werte sind eine Doku-Annahme, kein Code-Pinning.

**Term-Sanitization (Adversarial 🔴-1 — textuelle Operatoren):**
- Allowlist `[\\p{L}\\p{N}\\s]` entfernt Symbol-Operatoren strukturell. Aber FTS5 hat auch textuelle Operatoren (`AND`, `OR`, `NOT`, `NEAR`) — reine Letters, die durch die Allowlist passieren würden. Lösung: **jeder Token nach Sanitization wird in Phrase-Quotes (`"token"`) eingebettet**. FTS5 nimmt Phrasen wörtlich; eine Anfrage „Sicherheit AND wichtig" wird zu `"Sicherheit" "AND" "wichtig"` → drei Phrasen mit implizitem AND-Verknüpfung. Keine Operator-Interpretation, keine Crashes bei zufällig groß geschriebenen deutschen Konjunktionen.

**Was NICHT angeboten wird (bewusste Scope-Grenze):**
- Prefix/Wildcard-Matching (`KI*`) — durch Phrase-Quoting strukturell ausgeschlossen. Wer Substring-Match braucht, nutzt `search()` (LIKE-Pfad über Knoten-Namen).
- Boolean-Operatoren als User-Eingabe (`AND`/`OR`/`NEAR`) — werden zu Literal-Phrasen. Mehrwort-Anfragen verknüpfen sich über impliziten AND zwischen den Phrasen.
- Sprachen-spezifisches Stemming (deferred Slice #R3b).

**AC-Tabelle:**
| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-18.1 | `recallEpisodes(term)` mit Mehrwort-Term liefert relevantere Episoden zuerst (BM25-Score ASC). | unit | offen |
| AC-18.2 | `_sanitizeFtsQuery` entfernt alle FTS5-Operatoren — ein Term mit `-`/`+`/`"`/`(` etc. erzeugt KEINE SQL-Exception, sondern eine sanitisierte MATCH-Query. | unit | offen |
| AC-18.3 | Umlaut-Toleranz: Suche nach „suess" findet Episode mit „Süß" (remove_diacritics 2). | unit | offen |
| AC-18.4 | Trigger-Sync: nach `recordEpisode` ist die Episode sofort über FTS5 auffindbar (gleiche Transaktion). | unit | offen |
| AC-18.5 | DELETE: nach `episodicGc` ist die gelöschte Episode NICHT mehr im FTS5-Index. | unit | offen |
| AC-18.6 | Idempotente Migration: zweiter DB-Open ohne neue Episoden ändert nichts; Erst-Build über Bestand füllt nur fehlende Einträge. | unit | offen |
| AC-18.7 | Determinismus: gleicher Index-Stand + gleicher Term → identische Reihenfolge (BM25-Score deterministisch, Tie-Break nach `id`). | unit | offen |
| AC-18.8 | Output-Schema unverändert: `recallEpisodes` liefert dieselben Felder wie vor #R3 (Konsumenten-Kompatibilität). | unit | offen |
| AC-18.9 | Ohne `term`: Fallback auf occurred_at_norm-DESC-Sortierung (UC-5d-konform). | unit | offen |
| AC-18.10 | Föderation/Wire unverändert: FTS5-Index ist rein lokal, nicht im Wire, nicht in Signatur. | unit | offen |
| AC-18.11 | UC-BT-Verträglichkeit: `since`/`until`-Filter kombinieren sich mit FTS5-MATCH (WHERE-Bedingung konjunktiv). | unit | offen |
| AC-18.12 | Open-World-Verträglichkeit: Term ohne Treffer → leeres Ergebnis (kein „nearby"-Konfabulations-Match). | unit | offen |

**Fehlerfälle (UC-VS):** leerer Term nach Sanitization → leeres Ergebnis (kein MATCH-Aufruf); FTS5-Index inkonsistent (Trigger-Bug) → DB-Open repariert via Initial-Build (idempotent); ungültiges ISO in since/until → wie bisher in recallEpisodes ignoriert/normalisiert.

**Determinismus-Gate:** FTS5 ist deterministisch (gleiche Parameter, gleicher Tokenizer → gleiche Token-Liste → gleicher BM25-Score). Tokenizer-Version: SQLite ≥ 3.9. Wir pinnen den Tokenizer-String explizit in der `CREATE VIRTUAL TABLE`-Definition.

**Wire-Vertrag intakt:** FTS5 ist rein lokal — Index nicht im Wire, nicht in Signatur. PHP-NSAI-Bundle muss nicht spiegeln (PHP nutzt seine eigene Volltext-Variante, z. B. MySQL FULLTEXT — Output-Format `recallEpisodes` ist gleich, interner Algorithmus darf abweichen).

> **Slice #R3 (erledigt):** FTS5+BM25 für Episode-Volltextsuche mit Phrase-Quote-Sanitization. **Deferred** zu #R3b: BM25 auf `knowledge_nodes.name`; Sprachen-spezifisches Stemming.

### UC-VPS — Verify-Physical-Status (UX-Schliff für reject/retract, Slice #R4)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern `verify`, MCP `graph__verify` (Output additiv erweitert) · **Roadmap:** §H.2 nach #R3.

**Ziel (Erklärbarkeit ohne Verdikt-Drift):** Nach einem `reject(hash)` ist das Tripel physisch in der DB (Status `superseded`), aber nicht mehr im Belief-Pfad. Wenn ein Konsument danach `verify(s, p, rejected_object)` ruft, liefert das System weiter `contradicted` (richtige single-value-Logik, weil das dominante Objekt ein anderes ist) — aber der Konsument hat keinen Hinweis darauf, dass er die Frage schon einmal beantwortet hat und das Tripel bewusst abgelehnt wurde. UC-VPS schließt diese Erklärbarkeits-Lücke durch ein **zusätzliches** Feld `physical_status` im `verify`-Output. Verdikt-Kategorien bleiben unverändert; keine neue Probabilistik, keine Verdikt-Drift.

**Ursprung (KI-VO-Demo Backlog):** „nach `reject` zeigt `verify` das Gerücht weiter als `contradicted` — konsistent zur Dominanz-Logik, aber für die Erklärbarkeit fragwürdig." Korrekt-Erkenntnis: das Verdikt ist richtig (single-value-Dominanz), das Erklärbarkeits-Feld fehlte.

**Mechanik (deterministisch):**
1. `verify({s, p, o, as_of?})` läuft wie bisher (Quorum-Pfad + resolveBelief-Fallback + Corrective-Hints). Verdikt bleibt aus `supported`/`contradicted`/`unknown`.
2. **Additiv:** das `physical_status`-Feld wird gesetzt, **wenn** das gefragte Tripel `(s, p, o)` als Edge in `knowledge_edges` physisch existiert. Werte:
   - `'active'` — Edge ist active.
   - `'superseded'` — durch `reject` oder Decay nicht-aktiv. **Genau der Demo-Fall.**
   - `'retracted'` — TMS-OUT (Retraktions-Propagation).
   - `'quarantined'` — untrusted-Origin oder unter Quarantäne-Schwelle.
3. **Wenn das Tripel nicht physisch existiert** (`_getEdge(hash) === null`), wird das Feld **NICHT** gesetzt (Open-World: Abwesenheit signalisieren wir durch das Fehlen des Felds, nicht durch `'none'`).
4. **Wire/Föderation unverändert:** `physical_status` ist eine lokale Lese-Linse, kein Wire-Inhalt.

**AC-Tabelle:**
| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-19.1 | nach `reject(hash)` liefert `verify(s,p,o)` für das rejected Tripel `verdict: 'contradicted'` + `physical_status: 'superseded'`. | unit | offen |
| AC-19.2 | Verdikt-Stabilität: kein bestehender Verdikt-Pfad ändert sich; das Feld ist rein additiv. | unit | offen |
| AC-19.3 | Open-World absolut: das gefragte Tripel existiert nicht physisch → `physical_status` ist NICHT im Output (Abwesenheit durch Feld-Fehlen). | unit | offen |
| AC-19.4 | `physical_status: 'active'` bei einem konkurrierenden-aber-existierenden Tripel. | unit | offen |
| AC-19.5 | `retracted`/`quarantined`-Stati werden korrekt durchgereicht. | unit | offen |
| AC-19.6 | Föderation/Wire: `physical_status` taucht NIE in `_edgeToWire`/`exportSince` auf. | unit | offen |
| AC-19.7 | UC-BT-Verträglichkeit: bei `as_of=T` reflektiert `physical_status` den Status **aktuell** (nicht zum Zeitpunkt T) — Status ist nicht bi-temporal (#R2-Lehre). | unit | offen |
| AC-19.8 | Output bleibt **kategorisch** — keine numerischen Werte, keine Wahrscheinlichkeits-Felder im Erweiterungs-Output. | unit | offen |
| AC-19.9 | Determinismus: gleicher Graph + gleiche Anfrage → identischer Output (Feld-Existenz + identischer String-Wert). | unit | offen |
| AC-19.10 | `assertClaims`-Strip-Allowlist erweitert: `physical_status` darf im Self-Critique-Output erscheinen (kategorischer String, kein Probabilistik-Leak). | unit | offen |

**Klarstellung `present` vs. `physical_status` (Adversarial 🟡-2):** Beide Felder beschreiben **unterschiedliche Lese-Linsen** und können gleichzeitig im Output erscheinen. `present` antwortet auf „Ist das gefragte Objekt ein Kandidat im resolveBelief-Pfad?" (Belief-Linse). `physical_status` antwortet auf „Existiert das Tripel als Edge im Graphen, und wie ist sein lokaler Status?" (Edge-Linse). Beispiel nach `reject`: `verdict:'contradicted'`, `present:false` (kein active-Kandidat im rb), `physical_status:'superseded'` (Edge existiert weiter, aber nicht aktiv) — alles konsistent, jeweils eine andere Frage.

**Fehlerfälle (UC-VPS):** keine neuen Fehlerfälle — UC-VPS ist rein additiv und greift nur, wenn `_getEdge(hash)` ein Tripel findet.

**Determinismus-Gate:** reine DB-Lese-Operation auf `local_status`-Spalte; deterministisch.

**Wire-Vertrag intakt:** `physical_status` ist eine lokale UX-Anreicherung, kein Wire-Feld. PHP-Bundle muss nicht spiegeln.

> **Slice #R4 (erledigt):** Additives `physical_status`-Feld im `verify`-Output. Wrapper-Pattern, kein Verdikt-Drift, kein neuer Wire-Inhalt.

### UC-TA — Peer-Trust-Adjustment (Offline-Lernen, Vorschlags-Modus, Slice #6.1)

**Akteur:** System (deterministisch, Tier 1, **kein LLM**) · **Route:** intern `learnTrustAdjustments`, MCP `graph__learn_trust_adjustments` · **Roadmap:** §H.2 Punkt 6 — erster Offline-Lern-Slice (Option A aus #6-Diskussion).

**Ziel (menschenähnliche Stärke „wer mich oft enttäuscht, dem glaube ich weniger", ohne Bias-Falle):** Aus der Reject/Supersede/Quarantine-Historie pro Origin-Peer ableiten, **welche Peers sich nicht bewährt haben**. Output ist ein **Vorschlag** mit Belegen (welche Tripel wurden abgelehnt, wann), kein Auto-Apply. Der Nutzer entscheidet explizit per `peerTrust(peer_id, level)`.

**Bewusste Scope-Grenzen (constraint-verträglich):**
- **KEIN Auto-Apply** — sonst wäre es genau die menschliche Schwäche „kodierter Bias", die wir vermeiden (Option E der #6-Diskussion).
- **Lokale Trust-Achse**, **NICHT** globale Spec-Tuning — `trust_level` ist per Definition lokal pro Peer-Beziehung; kein Föderations-Bruch.
- **Integer-Promille-Berechnung** — kein Float, deterministisch.
- **Audit-Pfad** — jeder Vorschlag kommt mit konkreten `triple_hash`-Belegen.
- **NUR explicit-Nutzer-Reject zählt** (Adversarial 🔴-1/-2): `learnTrustAdjustments` zählt ausschließlich Edges mit `user_rejected_at IS NOT NULL` — also Aussagen, die der Nutzer explizit per `reject(hash)` abgelehnt hat. **System-Quarantäne** (low-confidence-inference, default-quarantine bei untrusted-Clone, peerRevoke), **Decay-Supersede** und **TMS-Retraktion** lassen `user_rejected_at` NULL und werden **NICHT** als Trust-Signal interpretiert. Das schließt die Konfabulations-Konfusion strukturell aus.

**Mechanik (deterministisch):**
1. **Eingabe:** `learnTrustAdjustments({ since? = epoch, min_evidence = 5 })`. `since` filtert den Bewertungs-Zeitraum (UTC-Z-normalisiert) — Aussagen mit `COALESCE(asserted_at_norm, asserted_at) ≥ since` werden gezählt; Reject-Aktionen mit `user_rejected_at ≥ since`. `min_evidence` ist die Mindest-Anzahl signed-Aussagen pro Peer, damit der Peer überhaupt in die Auswertung eingeht (Sybil-Schutz: 2-3 Aussagen sind kein Trust-Signal).
2. **Aggregation pro `origin_peer_id`:**
   - `total` = Anzahl Aussagen ab `since` (über `asserted_at_norm`).
   - `rejected` = Anzahl davon mit `user_rejected_at IS NOT NULL AND user_rejected_at ≥ since` — **NUR explicit-User-Rejects** (Adversarial 🔴-1/-2). System-Quarantäne, Decay-Supersede, TMS-Retraktion zählen NICHT.
   - `reject_rate_promille` = `trunc(rejected * 1000 / total)` (Integer-Division, Trunkierung gegen Null).
3. **Vorschlags-Logik (Schwellen aus `spec`, Integer-Promille):**
   - `reject_rate >= demoteUntrustedThreshold` (Default 800) → Vorschlag `level: 'untrusted'`.
   - `reject_rate >= demoteLimitedThreshold` (Default 500) → Vorschlag `level: 'limited'`.
   - sonst → kein Vorschlag (Peer hat sich bewährt oder Daten reichen nicht).
4. **Skip-Bedingungen:** `total < min_evidence` → kein Vorschlag (zu wenig Daten); aktuelle `trust_level === 'authoritative'` → kein Vorschlag (Autoritäts-Setzung ist explizit). Self-Peer wird übersprungen.
5. **Audit-Belege:** je Vorschlag eine Liste der bis zu 20 jüngsten user-rejected `triple_hash`-Werte (deterministisch sortiert nach `user_rejected_at DESC, triple_hash`).
6. **Output-Format:** Array von `{ peer_id, current_level, suggested_level, total, rejected, reject_rate_promille, evidence: [{triple_hash, local_status, user_rejected_at}, …] }`. `current_level` ist `'untrusted'|'limited'|'full'|'authoritative'` ODER `'unknown'` (Peer existiert in `knowledge_edges`, aber nicht in `peers` — Re-Audit 🟡-4).

**Un-Reject-Semantik (Re-Audit 🟡-B):** `promote(hash)` ist die komplementäre Aktion zu `reject(hash)` und nimmt einen früheren Reject zurück — setzt `local_status='active'` UND **löscht** `user_rejected_at`. Damit verschwindet der Reject aus dem `learnTrustAdjustments`-Zähler. Sonst entstünde ein „Geisterzähler" (Peer steht weiter belastet auf der Liste, obwohl der Nutzer den Reject zurückgenommen hat).

**Legacy-Daten (Re-Audit 🟡-C):** Edges, die VOR Slice #6.1 angelegt und mittels `reject()` quittiert wurden, haben `user_rejected_at = NULL` (das Feld existierte noch nicht). Sie sind aus Sicht des Trust-Lerners **unsichtbar** — konservativ richtig: das System kann „legacy-superseded durch reject" nicht von „legacy-superseded durch Decay" unterscheiden, also wird die ältere Reject-Historie ignoriert. Trust-Lernen beginnt effektiv mit dem Slice; ältere Reject-Aktionen sind kein Trust-Signal.

**Anwendung durch den Nutzer (KEIN Auto-Apply):** der Konsument liest die Vorschläge, prüft die Belege, entscheidet → ruft `peerTrust(peer_id, suggested_level)` für die Vorschläge die er annehmen will. Der Lern-Pfad selbst schreibt **nichts** in `peers`.

**AC-Tabelle:**
| AC | Kriterium | Test-Typ | Status |
|---|---|---|---|
| AC-20.1 | Peer mit reject-Rate ≥ 800‰ wird zu `untrusted` vorgeschlagen. | unit | offen |
| AC-20.2 | Peer mit reject-Rate ≥ 500‰ und < 800‰ wird zu `limited` vorgeschlagen. | unit | offen |
| AC-20.3 | Peer mit reject-Rate < 500‰ erhält keinen Vorschlag. | unit | offen |
| AC-20.4 | Peer mit `total < min_evidence` erhält keinen Vorschlag (Sybil-Schutz). | unit | offen |
| AC-20.5 | `authoritative`-Peer erhält keinen Vorschlag (Autoritäts-Setzung ist explizit). | unit | offen |
| AC-20.6 | Self-Peer wird übersprungen. | unit | offen |
| AC-20.7 | KEIN Auto-Apply: nach `learnTrustAdjustments` ist kein `peers.trust_level` verändert. | unit | offen |
| AC-20.8 | Audit-Belege: je Vorschlag bis 20 jüngste rejected `triple_hash`-Werte, deterministisch sortiert. | unit | offen |
| AC-20.9 | Determinismus: gleicher Graph → identische Vorschlags-Liste in identischer Reihenfolge. | unit | offen |
| AC-20.10 | Integer-Promille im Output: `reject_rate_promille` ist Integer 0–1000, keine Floats. | unit | offen |
| AC-20.11 | `since`-Filter: nur Aussagen mit `updated_at >= since` werden gezählt (`updated_at_norm` falls vorhanden, UC-5d-konform). | unit | offen |
| AC-20.12 | Wire/PHP-Parität: `learn_trust_adjustments` ist eine lokale Lese-Op, kein Wire-Inhalt; PHP-Bundle muss nicht spiegeln. | unit | offen |
| AC-20.13 | **(Adversarial 🔴-1)** System-Quarantänen (low-conf inference, default-quarantine bei untrusted-Clone, peerRevoke) zählen NICHT als reject — der Vorschlag entsteht nur bei `user_rejected_at IS NOT NULL`. | unit | offen |
| AC-20.14 | **(Adversarial 🔴-2)** Decay-Supersede zählt NICHT als reject (kein `user_rejected_at`). Ein Peer, dessen Aussagen veralten, wird NICHT herabgestuft vorgeschlagen. | unit | offen |
| AC-20.15 | **(Adversarial 🟡-4)** Peer, der in `knowledge_edges` als origin auftaucht aber NICHT in `peers` registriert ist, erhält `current_level: 'unknown'` (nicht stillschweigend `untrusted`). | unit | offen |
| AC-20.16 | **(Re-Audit 🟡-B)** `promote(hash)` löscht `user_rejected_at` — nach Un-Reject zählt das Tripel nicht mehr im Trust-Lerner; der Peer wird aus der Vorschlags-Liste herausgenommen (wenn dadurch die Schwelle unterschritten ist). | unit | offen |

**Fehlerfälle (UC-TA):** keine bekannten Origin-Peers → leeres Array (kein Fehler); ungültiges `since` (kein ISO) → `INVALID_PARAMETER_FORMAT`; `min_evidence < 1` → `INVALID_PARAMETER_FORMAT`.

**Determinismus-Gate:** reine SQL-Aggregation + Integer-Arithmetik. Keine LLM-Aufrufe, keine Floats, keine probabilistischen Aggregate.

**Wire-Vertrag intakt:** UC-TA ist eine **lokale Lese-Operation**; sie schreibt nichts in den Graphen, sie liefert nur Vorschläge. `trust_level` selbst ist seit Anfang lokal pro Knoten (Peer-Beziehungen sind subjektiv) — kein Föderations-Bruch.

**Bias-Schutz (Adversarial-Vorab):** wir lernen aus **lokalen reject-Aktionen**. Das spiegelt die Werturteile des lokalen Nutzers — was *kann* eine Form von Bias-Kodierung sein, ist aber bewusst auf die lokale Trust-Achse beschränkt (subjektives Vertrauen). Die *globalen* `sourceTier`/`trustFactor`-Skalen bleiben statisch (#6.4-Diskussion deferred). Kein Konfabulationspfad in den Belief-Output, weil das Verhalten nur Vorschläge generiert und nicht den Belief-Pfad ändert.

> **Slice #6.1 (in Bearbeitung):** Offline-Peer-Trust-Adjustment als reine Vorschlags-Logik. Nach #6.1 folgen #6.3 (zugriffs-basiertes Decay), #6.2 (Schema-Konsolidierung), #6.4 (signiertes Spec-Tuning). **Slice #6.E (Bias-Lerner) ist bewusst verworfen** (Konfabulationsfalle, Drift bei zu wenig Kontext).
