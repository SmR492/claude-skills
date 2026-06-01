# Brücke: Defeasible Entrenchment & verdientes Trust-Modell

> **Explorations-/Brücken-Material** (Design-Dialog Stefan ↔ Claude, 2026-05-29). **Keine CDP5-Bindung, kein ADR, keine Entscheidung** — zitierbarer **ADR-Input**. Verbindet die Lüge/Wahrheit/Fiktion-Linse (`06-…`) mit der „defeasible Entrenchment"-Richtung, die parallel eine andere Claude-Instanz formuliert hat.
>
> **Lesehinweis (Arbeitsweise):** Dieses Dokument hält einen *Dialog gleichwertiger Beiträge* fest. Stefans Anregungen **(S)** und Claudes Verfeinerungen **(C)** sind markiert; abgelehnte/überarbeitete Erstvorschläge bleiben *stehen* (mit Begründung), weil der Denkweg Teil des Materials ist — passend zum Thema selbst (These → Antithese → Synthese). Stefan hält aktuell die verfeinerten Vorschläge für besser, bewertet sie aber als gleichwertige Optionen.
>
> **Invarianten-Legende:** (1) Zero-Dep · (2) Offline · (3) Determinismus · (4) CRDT-Konvergenz · (5) lokale Lese-Linsen über signiertem Wire-Wert · (6) „Anzahl zählt nie" · (7) Open-World · (8) „Nie raten".

---

## §1 Ausgangsspannung (aus `06-…` + Parallel-Instanz)

NSAI-Edge presst heute drei kategorial verschiedene Dinge in `source_type`/`trust_level`/`confidence`. **(S)** „Können wir Lüge/Wahrheit/Fiktion unterscheiden? Müssen wir das TrustLevel ersetzen?" **(C)** Nein-ersetzen, ja-ergänzen: das TrustLevel misst *Provenienz* korrekt; es fehlen zwei orthogonale Achsen. Ein „besseres System, das Lüge von Wahrheit unterscheidet", ist im starken Sinn unmöglich (Tarski) — genau der Überanspruch, gegen den das Projekt gebaut ist.

## §2 Die drei orthogonalen Achsen

1. **Provenienz-Autorität** (WER) — `source_tier × origin_trust`. Entscheidbar, sozial/institutionell.
2. **Wahrheitswert** (IST es so) — Korrespondenz/Kohärenz/Konsens; nach **Tarski** intern nur *approximierbar*, nie *definierbar*. Niemals als Feld gespeichert, immer abgeleitet.
3. **Assertions-Modus** (WIE vorgebracht) — Kant-Modalität (problematisch/assertorisch/apodiktisch) + Searle/Lewis (Fiktion = commitment-*suspendiert*, nicht falsch). Fiktion wird *gescoped*, nicht widerlegt.

Orthogonalität: autoritative Quelle kann Fiktives sagen; llm-Tier kann Wahres assertorisch sagen; eine Lüge hat volles Commitment + falschen Wert + beliebige Provenienz.

## §3 Defeasible Entrenchment (Architektur-Entscheidung, Parallel-Instanz)

**(S)** Kern-Axiom: **„Alles was reinkommt, ist erstmal widerlegbar, weil wir die Wahrheit noch nicht kennen."** = Fallibilismus / AGM-Entrenchment / Popper (trusted → tested).
**(C)** **Trust nicht abschaffen, sondern von *terminaler Autorität* auf *defeasible Entrenchment* umstellen: Trust = Widerlegungs-*Schwelle*, nicht Verdikt.** Abschaffen bräche Sybil-Schutz, Echo-Kammer-Neutralisierung, deterministischen Merge, Domänen-Semantik (`gesetz > web`). Drei orakel-freie Pfade:
1. **Contestation-Override:** großer + *unabhängiger* + korroborierter Widerspruch kippt Top-Tier auf `contested` — **nie auf `contradicted`** (man kann die Gegenseite nicht als *wahr* behaupten, nur die Autorität als *bestritten*).
2. **Verdiente statt zugewiesene Trust** (Track-Record-Drift) — siehe §6.
3. **Mensch-Override** (existiert; Endorsement = externes Orakel).

**Harte Grenze:** eine in sich konsistente, *unwidersprochene* Lüge einer vertrauten Quelle ist für *jedes* geschlossene System ohne Orakel unentdeckbar. Erreichbare Latte: **keine Lüge überlebt, der verfügbare unabhängige Evidenz widerspricht.**

## §4 Der Defeater-Trigger (wann wird ein Widerspruch zum Defeater?)

**(S)** Alltagsregel: Unbekanntes erstmal hinnehmen; zwei gleich-fremde Widersprüche → im Netz bei *einer glaubwürdigen* Quelle nachsehen; widerspricht ein Fremder einer *bekannten* Quelle → ich vermute, der Fremde lügt, und lasse es mir belegen.
**(C)** Das ist die fehlende Trigger-Spezifikation = **Erkenntnistheorie des Zeugnisses** (Reid: default-Glaube bis Defeater) + **Beweislast** (Walton). Drei Antworten, je nach Trust-Verhältnis:

| Situation | Verhalten | Mechanik |
|---|---|---|
| **A.1** Fremd, kein Gegenwissen | „erstmal hinnehmen" | niedrige Entrenchment, default-Glaube, kein reject |
| **A.2** Zwei *gleich*-fremde widersprechen sich | „glaubwürdige Quelle suchen" | `contested` + **Eskalation eine Tier-Stufe nach OBEN** |
| **B** Bekannte X, Fremde ¬X | „Fremde lügt, soll's belegen" | Trusted **hält**; **Beweislast → Fremde**; Widerspruch **nicht verworfen**, sondern persistente offene Anfechtung |

Regeln daraus:
- **Schwelle relativ zum Trust-Abstand:** ein Defeater kippt nur auf `contested`, wenn seine *entrenchment-gewichtete, durch unabhängige Wurzeln gestützte* Backing die Entrenchment der etablierten Aussage **übersteigt**. Darunter: nur protokolliert + Herausforderer belastet.
- **Eskalation nach OBEN (Tier), Korroboration in die BREITE (unabhängige Wurzeln)** — zwei Achsen. Zehn voneinander abgeschriebene Fremde = *eine* Quelle (Hash-DAG-Independent-Roots → formales „Anzahl zählt nie").
- **(C) Falle in B, ehrlicher Pushback:** „Fremde lügt" reproduziert exakt den Single-Point-of-Failure — *wenn die Bekannte lügt*, wischt man die wahrheitssagende Fremde weg. Schutz: abgewiesener Widerspruch bleibt eine **offene Schleife (Zeigarnik)**, die *akkumuliert* — jede *unabhängige* gleichlautende Anfechtung knabbert an der Entrenchment der Bekannten, bis genug unabhängige Widersprüche selbst eine hohe Schwelle reißen → `contested`. „Glaube, sie lügt" = *Präsumtion + persistente Anfechtung + Trust-Abzug*, **nicht löschen.** (Genau deshalb sind Contestation-Override und verdiente Trust *dieselbe* akkumulierende Maschine.)

## §5 Die Eingangs-Matrix (Beurteilung beim Eingang einer These)

**(S)** „Eine 6-Faktoren-Matrix beim Eingang; solange ich sie nicht selbst bestätigt habe, gilt sie als *nicht gesichert* — nicht wahr/falsch, aber **mit Tendenzen**."
**(C)** Ja — und „Matrix" trifft es: **Zeilen = Faktoren · Spalten = konkurrierende Objekte** → Spalten-Summe = **Tendenz-Verteilung**, der „Gewinner" ist nicht *wahr*, nur *stärkste Tendenz, weiterhin nicht gesichert*. Das re-derived die eigene A4/MYCIN-Position des Konzepts (*Konfidenz = Evidenz-Gewicht, keine Wahrscheinlichkeit-wahr-zu-sein*). Sauberer geschnitten als „6 gleichartige":

- **Davor — Modus-Gate (Achse 3):** nur *assertorische* Thesen laufen durch die Matrix; Fiktion/Hypothese/Zitat → in eine **Welt/Kontext** gescoped (ATMS/Lewis), *keine* Wahrheits-Tendenz. (Das fehlte der 6er-Tabelle.)
- **Tendenz-Faktoren (5):** ① Provenienz (`tier × origin_trust`) · ② Rebutting-Konsistenz (`verify`: widerspricht es höher-vertrautem Bestand?) · ③ Undercutting-Begründung (TMS: lebt die Stütze?) · ④ Korroboration (unabhängige Wurzeln) · ⑤ Aktualität (Decay). *(② und ③ getrennt = die zwei Defeater-Typen, Pollock rebut/undercut — kein Doppel.)*
- **Boden, kein Faktor — Open-World:** keine Basis → `unknown`, *keine* Tendenz (ehrliches Nicht-Wissen).
- **Behälter, kein Faktor — Status `gesichert`/`nicht gesichert`:** flippt nur durch Selbst-Bestätigung. Bis dahin: nur Tendenz.
- **Repräsentation der Tendenz:** Belief-Verteilung *oder* **Possibility/Necessity-Intervall `[N, Π]`** (N = belegte Untergrenze, Π = nicht-ausgeschlossene Obergrenze, Lücke = „nicht gesichert", Lage darin = Tendenz). *Nur lokale Lese-Linse* (sonst Subjective-Logic-Wire-Bruch). Selbst „gesichert" = „bis widerlegt", nie „wahr" (Tarski).

## §6 Trust-Dynamik — verdientes, lokales `origin_trust`

### Zwei Felder, nicht eins
**(S)** „Wir brauchen ein TrustLevel 0–100 pro Quelle."
**(C)** Ja zu *kontinuierlich + verdient*, aber: **0–1000 Integer-Promille** (konsistent mit Konfidenz, Determinismus/Parität), und **zwei orthogonale Felder**, damit die kontinuierliche Zahl den *harten* Tier nicht schluckt:

| Feld | Rolle | Eigenschaft |
|---|---|---|
| `source_tier` (0–6) | **Prior/Baseline** — wo die Widerlegungs-Schwelle startet | harte ordinale Klasse, *nicht* verrechenbar (trägt „gesetz>web unabhängig von Anzahl" + Tier-Cap) |
| `origin_trust` (0–1000) | **Modulator** — driftet nach Track-Record | kontinuierlich, **lokal**, **verdient**, Lese-Linse |

Tier = Prior, `origin_trust` = Bewegung darum, Defeater-Trigger = was die Schwelle reißt. (Ein einziger Wert würde die harte Klasse auflösen → genug Hoch-Trust-Web schlägt ein Gesetz = Anzahl-Falle.)

### Score als Projektion einer Bilanz (Beta-Reputation)
**(S)** „entwickler.de 79, Bild.de 36; verliert Bild den Disput, sinkt entwickler um 5, Bild steigt um 3."
**(C) Pushback:** feste Deltas haben zwei Bugs — (a) Magnitude müsste mit der *Überraschung* skalieren (Elo: `Δ = K·(actual − expected)`); (b) feste −5/+3 lassen *netto* Punkte leaken → sogar ehrliche 50%-Quellen sinken auf 0. Besser: **Bilanz `(α Erfolge, β Fehlschläge)` speichern, Score *ableiten*** (nicht ein Konto mutieren):
```
trustScore = floor( 1000 · α / (α+β) )          # Promille, deterministisch
```
Das skaliert automatisch (junge Quelle bewegt sich viel, etablierte wenig), **ohne Deflation, ohne magische Deltas.** Die „leicht zu verlieren"-Asymmetrie kommt als *gedeckelter* Knopf (Fehlschlag-Übergewicht), nicht aus willkürlichen Zahlen.

### Prior = skeptischer Start
**(S)** „Start bei 30 (gute Skepsis), 50 = Mitte, 80 = vertrauenswürdig."
**(C)** „30" ist kein Startscore, sondern ein **Beta-Prior** (sonst startet eine frische Quelle mathematisch bei 50): **Beta(3,7)** → `3/10 = 300‰`. Der eigentliche Knopf ist die Prior-**Stärke** `k=α₀+β₀`: „gute *bewegliche* Skepsis" = **schwacher** Prior (k≈10) → ~25–30 saubere Korroborationen bis 80 (erarbeitet, erreichbar). Starker Prior = Dauer-Vorurteil (schlecht). Bänder doppeln als kategoriale Präsentation (B5/Rosch): `<300` skeptisch · `300–500` unbestätigt · `500–800` plausibel · `≥800` vertrauenswürdig. Skala ist *nicht-linear* (30→50 billig, 80→90 teuer) — genau „muss erarbeitet werden".

### Eine Update-Regel für alle Fälle (inkl. Teilwahrheit)
**(S)** „Beide teils wahr/teils gelogen → beide −1; einer mehr Wahrheit → der +1, der andere ±0."
**(C)** „Wie viel Wahrheit" ist nur entscheidbar, weil die These in **atomare Tripel zerfällt**, je binär adjudiziert → **`s` = korroborierte/alle Tripel** der Quelle. Eine Regel subsumiert alle Fälle (Sieg/Niederlage/halb/mehr):
```
α += korrobierte_Tripel ;  β += widerlegte_Tripel      # fraktional, s = c/N
```
Erwartungs-Relativität fällt automatisch: eine 50%-Leistung **senkt** entwickler (Ruf 79), aber **hebt** Bild (Ruf 36) — *kein* fixes „beide −1".
- **Kalibrierungs-Gewicht (C):** ein *überconfident* behauptetes, dann widerlegtes Tripel zählt **doppelt** auf β (Anmaßung schmerzt, ehrliche Unsicherheit kaum; Brier/ECE-Link → D1/E1).
- **Surprise-Gewicht (C):** ein Fehlschlag bei hohem Stand kostet mehr (etablierte sinken schneller).
- **Oracle-Gating (C):** Updates feuern **nur** auf adjudizierten Ausgängen (höher-Tier-Korrespondenz / unabhängige Korroboration / Mensch); der Herausforderer-Gewinn kommt aus den *beigebrachten Belegen*, nicht aus Lautstärke → blockt „Streit fabrizieren, um Trust zu farmen" (Sybil).

### Recency statt Tenure (Mean-Reversion)
**(S)** „Länge der Vertrauenswürdigkeit als Multiplikator: Neue steigen schwerer; etablierte+zuverlässige steigen von selbst; Etablierte können schneller sinken."
**(C) Pushback:** *Kalenderlänge* ist die falsche Variable (gameable = **Sleeper-Angriff**; doppelt zählt, was Beta schon kann). Reframe als **anhaltende, jüngere Zuverlässigkeit** = **Mean-Reversion der Beta-Bilanz zum Prior** (Vergessen): `α ← λ·α + (1−λ)·α₀`, `β ← λ·β + (1−λ)·β₀`. Liefert alle drei Effekte evidenzbasiert:

| Stefan-Effekt | aus Mean-Reversion |
|---|---|
| Neue haben's schwerer | Aufstieg muss die Reversion *überholen* (kein Parken auf kurzem Streak) — fair, ohne Newbie-Strafe |
| Steigt, wenn etabliert+zuverlässig **bleibt** | anhaltende Treffer schlagen die Reversion → bleibt oben |
| Etablierte sinken schneller | faded altes Guthaben schützt nicht mehr → Fehler-Lauf dominiert |
| *Bonus: Anti-Sleeper* | stille Quelle driftet zurück auf 30 (steigt **nicht** durchs Altern) |

**(C)** Gegen Eigenschaft 1 als *extra* Drossel: der Prior macht Neue schon skeptisch; ein zusätzlicher Newbie-Throttle verschärft das Kaltstart-Problem unnötig. **Falle des wörtlichen Vorschlags:** „langsam-rauf-jung + schnell-runter-alt" als rohe Multiplikatoren → *niemand bleibt stabil oben* (Dauer-Churn). Mean-Reversion ist selbst-korrigierend.
**Kosten (ehrlich):** verlässt reine Integer-Counts → Fixed-Point-Milli-Counts; braucht deterministischen Zeit-Anker (= *vorhandenes* Konfidenz-Decay, wiederverwendet); **ist Adaptivität, NICHT Sybil-Abwehr** (Forschung: Zeit-/Epoch-Decay hilft Sybil-Toleranz nicht — das macht MeritRanks Connectivity-Decay, *andere* Achse — nicht verwechseln).

### Offene Trust-Entscheidungen
- **Global vs. pro (Quelle × Domäne):** CDPR (§7) zeigt: Trust zerfiel domänen-gespalten (Erzählung hielt, Technik/Marketing stürzten). Starkes Argument für domänen-spezifischen Trust; einfacher Start global. **Offen.**
- **Einführungs-Provenienz:** Mensch-hinzugefügt startet ggf. bei 50 (Akt = schwaches Endorsement), anonym bei 30; eigenes Wissen/Inferenz (self) bleibt verankert (full).
- **Konstanten** (`λ`, `α₀/β₀`, Bänder, Kalibrierungs-/Surprise-Gewicht) = Wire-Konstanten → Konstanten-Konsistenz-Gate.

## §6-neu (Synthese 2026-06-01): Impuls-Ledger-Trust über dem Provenienz-DAG

> **Supersediert** die Konto-Mutations-Mechanik aus §6 (bleibt als Denkweg stehen, Doc-Konvention). Auch ersetzt das Tag-Propagations-Netz (#6 aus `08-…`): statt Trust über ein komplexes Tag-Netz oszillieren zu lassen, extrahieren wir die Dynamik gerichtet aus der **vorhandenen, zyklenfreien Provenienz-Struktur** + den Adjudikations-Urteilen. **(S)**-Idee (2026-06-01), **(C)** vier Invarianten-Korrekturen (Float→Integer, Primär-Events-only, Total-Ordnung, unabhängige-Wurzeln-Nenner).

**Kern-Axiom:** Trust ist **kein gespeicherter Zustand**, sondern eine deterministische **Projektion (Fold)** über ein append-only **Ledger adjudizierter Impulse**, gerichtet entlang des TMS-DAG. Es gibt kein eingefrorenes `trust`-Feld; der Trust eines Knotens zu `T` = kumulierte Bilanz aller Verschiebungs-Impulse bis `T`.

### Substrat — Event-Store (append-only)
Gespeichert werden **NUR primäre Adjudikations-Events** auf dem *direkt* beurteilten Item:
`E = (target_id, adj_class, delta_promille, occurred_at_norm, event_hash)`
- `adj_class ∈ {human_endorse, human_reject, oracle_higher_tier, auto_corroborate}` — Anker-Klasse (Oracle-Gating).
- `delta_promille ∈ [−1000,+1000]` — **Integer-Promille, KEIN Float** (Invariante 3/4, gleiche Disziplin wie K1/K2/Conformance). Teilwahrheit aus der Tripel-Zerlegung: `delta = trunc(1000·(c−w)/N)` bei `c` korroborierten, `w` widerlegten von `N` atomaren Tripeln.
- Quell-/Eltern-Beiträge werden **nicht** gespeichert — reine Read-Time-Projektion über den DAG (kein Doppel-Zählen, append-only bleibt rein).

### Projektion — der Fold (rein lesend, deterministisch)
`trust(node, T)` = Fold über alle Events bis `T` in **deterministischer Total-Ordnung** `(occurred_at_norm, event_hash)` (sonst foldet nicht jeder Knoten identisch → CRDT-Bruch, Invariante 4). Drei gerichtete Beiträge je Event auf K:
1. **Direkt (K):** Bilanz von K verschiebt sich um `delta`.
2. **Quelle(K):** `Δ_source = trunc(delta · w_src / 1000)` — Beta-Bilanz der Quelle (§6) als Fold-Beitrag statt Konto-Mutation.
3. **Eltern(K)** entlang `derived_from`/`episode_triples`, mit zwei Schutzfiltern:
   - **Distanz-Decay (integer):** `delta_parent = trunc(delta · γ^d)`, `γ` Promille-Koeffizient, `γ^d` als d-fach getrunkte Multiplikation (kein Float-Exponential).
   - **Attribuierung + Verdünnung:** Eltern-Abzug NUR bei prämissen-attribuiertem Versagen (**Undercut**, nicht Rebut — Pollock); geteilt durch `n` = **Anzahl unabhängiger Wurzeln** (Hash-DAG/MeritRank-Independence, NICHT roher Kind-Count): `Δ_parent = trunc(delta_parent / n)`. So kippt ein einzelnes fehlerhaftes Blatt keine breit gestützte Eltern-Hypothese.

### Oracle-Gating / „Anzahl zählt nie" (Invariante 6)
Nur extern-verankerte `adj_class` (`human_*`, `oracle_higher_tier`) erzeugen signifikante Verschiebungen. `auto_corroborate` (z. B. baugleiche Sätze aus 3 Büchern) stabilisiert nur innerhalb eines Plausibilitäts-Bands und erzeugt **keine eigenständigen Impuls-Zyklen**; korrelierte Kinder werden über ihren gemeinsamen Herkunfts-Hash als **ein** Signal gewertet.

### Tags = Kaltstart-Prior (statisch, keine Dynamik)
Neue Quelle ohne Historie: Tag-komponierter Beta-Prior (skeptisch, z. B. `Blog` → niedrig). Sobald eigene adjudizierte Events vorliegen, **dominiert der Fold den Prior vollständig.** Tags oszillieren nicht — sie sind nur der Kaltstart-Hint.

### Eigenschaften
- **Safe-by-default:** ohne Events bleibt jeder Knoten am Prior — das System schaukelt nicht, ist nur inert. → *sicher früh baubar*, lernt mit wachsendem Adjudikations-Strom (entschärft das Empirie-Gate #14).
- **Gating-Invariante:** Fold läuft vollautomatisch, rein lesend, lokal — kein blockierender Schreib-/Sync-Pfad; optionale materialisierte Snapshots als Cache (Ledger bleibt maßgeblich, weil unveränderlich).
- **Ausnahme institutioneller Floor:** ein berechneter Trust-Sturz senkt NIEMALS autonom einen institutionellen Tier/Floor (Gesetz); ein solcher Wechsel ist **endorsement-pflichtig** — das System schlägt vor, vollzieht nicht (Constraint #4 + Defeater-Typ „institutioneller Akt", §11-b).

### AC-Skizzen
- AC-T.1 Fold deterministisch + total-geordnet → gleiches Event-Set ⇒ identischer Trust auf zwei Knoten (CRDT-Parität).
- AC-T.2 Integer-Promille durchgängig, kein Float (Konstanten-Konsistenz-Gate-fähig).
- AC-T.3 Distanz-Decay gedeckelt: ein Blatt-Reject senkt einen breit (n unabhängige Kinder) gestützten Eltern-Knoten höchstens um `trunc(delta·γ^d/n)`.
- AC-T.4 Undercut-vs-Rebut: ein Kind-Reject, das der Regel (nicht der Prämisse) zuzuschreiben ist, lässt den Eltern-Trust unberührt.
- AC-T.5 Oracle-Gating: `auto_corroborate` allein hebt keinen Knoten über das Plausibilitäts-Band; korrelierte Herkunft = ein Signal.
- AC-T.6 Institutioneller Floor: negativer Fold schlägt Tier-Senkung nur VOR; ohne Endorsement kein Vollzug.
- AC-T.7 Safe-by-default: ohne Events == Prior (kein Drift).

## §7 Validierung an Beispielen

### entwickler.de vs. Bild.de (Beta-Verlauf, illustrativ)
| Ereignis | entwickler ✓/✗ · α/β · Score | Bild ✓/✗ · α/β · Score |
|---|---|---|
| Start (Prior 3/7) | — · 3/7 · **30** | — · 3/7 · **30** |
| früh | +6✓ → 9/7 · 56 ; +5✓ → 14/7 · 67 | 1✓3✗ → 4/10 · 29 |
| **Streit** | 4✓ → 18/7 · **72** ↑ | 1✓3✗ → 5/13 · **28** ↓ |
| halb wahr (50%) | (würde *sinken*, da 50%<Ruf) | 2✓2✗ → 7/15 · **32** ↑ (50%>Ruf!) |
| überconf. Patzer (×2) | 2✓ 2✗→β+4 → 20/11 · **65** ↓ | echter Upset (höher-Tier-Belege) 3✓1✗ → 10/16 · **38** ↑ |
| Erholung | +7✓ → … → **~79** | zurück zum Muster → **~37** |

Lehren: derselbe Streit bewegt gegenläufig; „halb wahr" hebt die schwache, senkt die starke Quelle (erwartungs-relativ); Überconfidenz kostet doppelt; Bild klettert *nur* mit echten Belegen; der Gipfel ist klebrig; ein paar Treffer waschen keine schlechte Bilanz rein.

### CD Projekt Red (realer Stresstest)
| Zeit | Ereignis | Score |
|---|---|---|
| 2007→2015 | Witcher 1→2→3+DLCs, *nachhaltig* | 30 → **~90** |
| Dez 2020 | **Cyberpunk 2077** — kollektiv widerlegte, überconfident vermarktete Versprechen bei Höchst-Trust | **~40** (Ein-Ereignis-Crash) |
| 2021→2024 | Patches → 1.5 → **2.0 + Phantom Liberty** (gefeiert), *nachhaltig* | 40 → **~80** (nicht ganz zurück auf 90) |

**Warum das Modell das reproduziert:** Cyberpunk ist *ein Tripel-Schwall* × Überconfidenz(×2) × Höchst-Trust-Surprise(×2) × Recency-Dominanz → Titan stürzt aus großer Höhe. Ein *unbekanntes* Studio (30) fiele bei gleichem Fehler nur auf ~26. **Recency-Vergessen ist *notwendig* für die Erholung** (rein-kumulativ wäre die Crash-β-Masse fast unverwindbar — die reale 4-Jahres-Erholung *belegt empirisch*, dass Trust-Systeme vergessen). Plateau unter dem alten Gipfel = nicht-ganz-verblasste Narbe.
**Wo es ächzt (ehrlich):** Trust ist hier *kein Skalar* — „CDPR×Erzählung" hielt, „CDPR×Technik/Marketing" stürzte → **stärkstes reales Argument für domänen-spezifischen Trust.** Plattformabhängige Adjudikation (PC vs. Last-Gen) → kontextuell/bitemporal. Soziale Verstärkung (Shitstorm/Refunds/Sony-Rauswurf) liegt *außerhalb* der epistemischen Ledger — das Modell bildet die *epistemische* Kurve ab, nicht die PR-Dynamik. Pre-Order = *Versprechens*-Trust (Achse-3-Modalität „über Zukunft", erst beim Einlösen adjudizierbar).

## §8 Ehrlichkeits-Grenzen (die Leitplanke gegen Über-Erwartung)
- **Tarski:** kein internes Wahrheits-Orakel; `is_true`-Feld verboten; `verify()` ist Falsifikations-/Konsistenz-Maschine, kein Wahrheits-Beweiser.
- Eine konsistente, unwidersprochene Lüge bleibt unentdeckbar; erreichbar: keine Lüge überlebt, der *verfügbare unabhängige Evidenz* widerspricht.
- Trust *driftet mit adjudizierter Evidenz*, ist **kein Wahrheits-Sensor**; das Rating *akkumuliert die Urteile des Adjudikators*, erzeugt keine Wahrheit.
- Single-Scalar-Trust strapaziert (CDPR-Domänen-Spaltung) → domänen-spezifisch offen.

## §9 Invarianten-Check (Gesamtmodell)
| Invariante | Status |
|---|---|
| (1) Zero-Dep | ✅ (Integer/Beta/Decay in JS) |
| (2) Offline | ✅ |
| (3) Determinismus | ✅ — Fixed-Point bei Recency-Milli-Counts; Konstanten Wire-fix |
| (4) CRDT | ✅ — `origin_trust`/Tendenz sind *lokale* Lese-Linsen, nicht im signierten Wire |
| (5) Lese-Linsen | ✅ — Bilanz/Score/`[N,Π]`/Modus lokal abgeleitet bzw. signiert; signierte Wire-Felder unangetastet |
| (6) „Anzahl zählt nie" | ✅ — Korroboration = *unabhängige Wurzeln*; Trust-Drift zählt adjudizierte Tripel *einer* Quelle, kein Quellen-Voting |
| (7) Open-World | ✅ — `unknown` ≠ falsch; Fiktion gescoped; Contestation → `contested`, nie `contradicted` |
| (8) Nie raten | ✅ — Updates oracle-gated; Modus-Gate hält Fiktion aus Fakten; Lern-Drift = Constraint #4 → Vorschlags-/Endorsement-Modus |

## §10 Roadmap-Anschluss
Substrat für **C1** (EigenTrust), **C3** (MeritRank — Sybil, *andere* Achse als Recency), **D1** (Conformal — Schwellen), **E1** (Meta-Kognition/Brier-ECE = Kalibrierungs-Gewicht), **A1** (Defeasible-Argumentation = `supports`/`rebuts`, grounded extension), **6.1** (Trust-Adjustment). **Nächster Schritt (Concept-First):** CDP5-**ADR** „Belief von terminaler Autorität → defeasible Entrenchment" + Slice-Konzept — **🔴-Slice** (Belief-Kern-Re-Fundierung: `resolveBelief`-Präzedenz tier-primär → entrenchment-gewichtet, eternal-Behandlung, mergeIncoming, Verdikt-Modell) → voller CDP5 + Threat-Model des Widerlegungs-Pfads + adversarial-auditor. **Dieses Dokument ist der ADR-Input, nicht der ADR.**

## §11 Offene Entscheidungen (für den ADR gesammelt)
- (a) `temporality='eternal'`: streichen vs. als *max-Entrenchment / langsamster Decay* behalten (nicht „unfalsifizierbar").
- (b) Defeater-Typen: Evidenz-Defeater vs. institutioneller Akt-Defeater **trennen** (Rat: trennen — sonst „widerlegt" Web-Mehrheit ein geltendes Gesetz) oder kollabieren.
- (c) Widerlegungs-Schwelle: Integer-Regel, trust-/korroborations-gewichtet (unabhängige Wurzeln).
- (d) akzeptiertes Restrisiko: konsistente Lüge ohne Widerspruch unentdeckbar — explizit deklarieren.
- (e) **Domänen-spezifischer Trust** (global Start, später pro Domäne?).
- (f) Prior-Stärke `k`, Recency-`λ`, Kalibrierungs-/Surprise-Gewicht, Bänder-Schwellen.
- (g) Einführungs-Provenienz-Prior (Mensch-hinzugefügt 50 vs. anonym 30).

## §12 Dialektik-Notiz (gleichwertige Beiträge)
- **Stefan-Anregungen (S):** Lüge/Wahrheit/Fiktion-Frage · „TrustLevel ersetzen?" · kategorisches Denken & „These" · 6-Faktoren-Eingang · „nicht gesichert, mit Tendenz" · Trust 0–100 pro Quelle · −5/+3-Disput · ±1-Teilwahrheit · Prior 30/50/80 · Tenure-Multiplikator · CDPR-Stresstest · Axiom „alles erstmal widerlegbar".
- **Claude-Verfeinerungen (C):** ergänzen-statt-ersetzen · drei Achsen · defeasible Entrenchment (mit Parallel-Instanz) · 0–1000 statt 0–100 · zwei Felder (`tier × origin_trust`) · Beta-Bilanz statt feste Deltas · fraktional+erwartungs-relativ+Tripel-Decomposition · Kalibrierungs-/Surprise-Gewicht · Mean-Reversion statt Tenure · Beweislast/Open-Loop-Trigger · Tarski-Leitplanke · domänen-spezifisch als reales Bedürfnis.
- Beide als gleichwertige Optionen behandelt; Stefan hält die Verfeinerungen aktuell für die besseren — die Erstvorschläge bleiben hier mit Begründung erhalten.
