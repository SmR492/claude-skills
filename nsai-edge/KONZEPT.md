# Konzept: Föderierter neuro-symbolischer Wissensgraph für Claude Code (NSAI-Edge)

**Version:** 2.3
**Stand:** Mai 2026
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
