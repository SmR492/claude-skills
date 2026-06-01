# Offene Punkte zum Entscheiden — Trust-Modell / Defeasible Entrenchment

> **Für die Heimfahrt.** Self-contained Entscheidungs-Worklist aus der Design-Session 2026-05-29. Voller Kontext: `06-Luege-Wahrheit-Fiktion-…` (Achsen/Wahrheit) + `07-Bruecke-zu-Defeasible-Entrenchment.md` (Modell). Hier nur die *Fragen* — kompakt, mit Optionen + meiner Tendenz. **Meine Tendenz ist ein gleichwertiger Vorschlag, kein Default — du entscheidest.**
>
> **Marker:** 🟢 klare Empfehlung · 🟡 echte Abwägung · 🔴 gehört dir (Scope/Wert-Entscheidung).
>
> **Worum es im Kern geht:** Trust nicht *abschaffen*, sondern von „terminaler Autorität" auf „defeasible Entrenchment" umstellen — Trust = *Widerlegungs-Schwelle*, nicht Verdikt; alles Eingehende erstmal widerlegbar; Wahrheit nie intern entscheidbar (nur approximierbar), Vertrauen *verdient*.

---

## A — Trust-Parameter & Start

**1. Prior-Stärke `k` (wie skeptisch startet eine neue Quelle?)** 🟢
Start bei 30 = Beta(3,7). Frage ist die *Stärke* `k=α₀+β₀`: wie viele Beobachtungen, um die Skepsis zu überwinden.
- A) schwach (k≈10): ~25–30 saubere Treffer bis „vertrauenswürdig" (80) — beweglich.
- B) stark (k≈100): praktisch Dauer-Misstrauen.
- *Tendenz:* **A** — „gute Skepsis" heißt offen-für-Überzeugung, nicht Vorurteil; B macht das System blind für gute neue Quellen.

ANTWORT: A  


**2. Einführungs-Provenienz-Prior** 🟡
Startet jede Quelle gleich, oder hängt der Startwert davon ab, *wie* sie reinkam?
- A) alle gleich bei 30.
- B) du-selbst-hinzugefügt → 50 (dein Akt = schwaches Endorsement), anonym/auto-entdeckt → 30; eigenes Wissen/Inferenz (self) → verankert hoch.
- *Tendenz:* **B** — dein manuelles Hinzufügen *ist* Information; sie zu ignorieren wäre Verschwendung.

ANTWORT: B  

**3. Skalen-Bänder (Anzeige für Menschen)** 🟢
300/500/800 ‰ → `<300` skeptisch · `300–500` unbestätigt · `500–800` plausibel · `≥800` vertrauenswürdig.
- *Tendenz:* übernehmen, dienen doppelt als Prior-Anker *und* kategoriale Anzeige. (Schwellen sind feinjustierbar.)

ANTWORT: Mach 5 statt 3 Schwellen, so sind wir auch dynamischer

**4. Recency-Stärke `λ` (wie schnell verblasst alte Bilanz?)** 🟡
Mean-Reversion zum Prior: alte Erfolge/Fehler faden, eine Quelle muss *dranbleiben*.
- Schnelles Vergessen = reaktiver (CDPR-Crash & -Erholung schneller), aber instabiler. Langsames = träger, stabiler.
- *Tendenz:* mittel — effektives Fenster ~letzte 1–2 Jahre Aktivität. (Kann pro Tier variieren: `gesetz` faded kaum, `web` schneller.)

ANTWORT: Lass sie anhand ihres aktuellen Prior verblassen, weniger Prior = schnelleres Verblassen. So halten sich sichere Quellen länger als unsichere oder lügen. Heißt wir können nicht nur unterscheiden, sondern haben das Wahre auch länger im Gedächnis.

**5. Kalibrierungs- & Surprise-Gewicht** 🟡
- Kalibrierung: ein *überconfident* behauptetes, dann widerlegtes Tripel zählt **×2** auf Fehlschläge (Anmaßung schmerzt mehr als ehrliche Unsicherheit).
- Surprise: ein Patzer bei hohem Stand kostet mehr als bei niedrigem (etablierte sinken schneller).
- *Tendenz:* beide **ja**, Faktor klein halten (×1,5–2). Gemeinsam erzeugen sie den CDPR-Effekt sauber.

ANTWORT: Ja bin deiner meinung, beide.  

---

## B — Trust-Architektur

**6. Zwei Felder bestätigen: `source_tier` (hart) × `origin_trust` (verdient)?** 🟢
- Harter `source_tier` (gesetz>…>llm) = Prior/Baseline; kontinuierliches `origin_trust` (0–1000, lokal, verdient) = Modulator darum.
- *Tendenz:* **ja, getrennt halten** — ein einziger Wert würde die harte Klasse auflösen (genug Hoch-Trust-Web schlüge ein Gesetz = Anzahl-Falle). Der Tier bleibt *defeasibel*, aber nicht *verrechenbar*.

ANTWORT: Das müssem wir eh nochmal überarbeiten, da meines erachtens das source_tier nicht an das wissen sondern an die Quelle von der das wissen kommt gehört und damit wieder über den gesamten Faktor beeinflusst wird. Wir brauchen hier also lass und das über die Gesamtheit berechnen. Was ich gerade im Kopf habe ist ein: Artikel stammt von Bild ist Presseartikel aus dem Internet. Also eine Art Tags wie: Presseartikel, Internet bekommen ein gewicht, je nach dem wie Ihre Verbundenen Themen abschneiden. Also beeinflussen sich Erinnerungen auch gegenseitig. Weil auch das source_tier und origin_trust ist eine Art Wissen, was sich entwickeln muss. Überleg dir das mal im Detail druch. 

**7. Globaler vs. domänen-spezifischer Trust** 🔴
CDPR zeigt: Vertrauen zerfällt domänen-gespalten („CDPR×Erzählung" hielt, „CDPR×Technik/Marketing" stürzte).
- A) ein Trust pro Quelle (einfach, aber verschmiert).
- B) Trust pro (Quelle × Domäne) (ehrlicher, teurer — mehr State, Domänen-Zuordnung nötig).
- *Tendenz:* **A starten, B als Roadmap** — globaler Trust zuerst, domänen-spezifisch nachrüsten, wenn die Verschmierung real stört. (Echte Komplexitäts-/Wert-Entscheidung → deine.)

ANTWORT: Sie 6 Wir müssen hier ein berechenbares system erschaffen. Brauchen aber auch einen Fallback, wenn sich zu schnell zu viel an Trust gewinnt oder verliert, dann sollte man skeptisch gegenüber dem zugewinn oder verlust sein.  

---

## C — Belief-Kern (defeasible Entrenchment)

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

**8. `temporality='eternal'` — streichen oder behalten?** 🔴
Das Axiom „alles widerlegbar" kollidiert mit „eternal = nie zerfallend/unfalsifizierbar".
- A) streichen (alles widerlegbar, keine Ausnahme).
- B) behalten, aber umdeuten als **„höchste Entrenchment / langsamster Decay"**, NICHT „unfalsifizierbar".
- *Tendenz:* **B** — kein „promote→wahr/strict"-Endzustand (das wäre der Single-Point-of-Failure durch die Hintertür), aber definitorische/mathematische Sätze dürfen die höchste Schwelle haben.

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

**9. Defeater-Typen trennen oder kollabieren?** 🟢
- Empirische Fakten → widerlegt durch *kontradiktorische Evidenz*.
- Institutionelle/definitorische Fakten (ein Gesetz *gilt*) → widerlegt durch *expliziten Akt* (Aufhebung), nicht durch Evidenz-Mehrheit.
- *Tendenz:* **trennen** — sonst kann eine Web-Mehrheit ein geltendes Gesetz „widerlegen", was sachlich falsch ist. (Searle: institutionelle Fakten.)

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

**10. Contestation-Override-Form bestätigen** 🟢
Ein hinreichender (entrenchment-gewichteter, *unabhängig* gestützter) Widerspruch kippt Top-Tier auf **`contested`** — **nie auf `contradicted`** (man kann die Gegenseite nicht als *wahr* behaupten, nur die Autorität als bestritten).
- *Tendenz:* übernehmen. Plus: abgewiesener Widerspruch wird **nicht gelöscht**, sondern bleibt persistente offene Anfechtung, die akkumuliert (Schutz gegen „vertraute Quelle lügt").

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

**11. Restrisiko explizit als Leitplanke deklarieren?** 🟢
Die konsistente, *unwidersprochene* Lüge einer vertrauten Quelle ist für jedes orakel-freie System unentdeckbar. Erreichbar: „keine Lüge überlebt, der *verfügbare unabhängige Evidenz* widerspricht."
- *Tendenz:* **ja** — als „Was das System NICHT leistet: Wahrheits-Verifikation"-Abschnitt im Konzept (§B). Ehrliche Leitplanke gegen Über-Erwartung.

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

---

## D — Modus-Achse (Fiktion / Hypothese) — *orthogonal zum Trust*

**12. `assertion_mode` + Welten/Kontexte einführen?** 🔴
Trust/Entrenchment löst Provenienz↔Wahrheit. Es löst **nicht** Fiktion/Hypothese — die wird nicht *widerlegt*, sondern *gescoped*.
- A) jetzt nicht (Scope klein halten).
- B) `assertion_mode` (behauptet/vermutet/fiktiv) + `world`-Scopes (Fiktion in eigene Welt, `verify` ignoriert sie) — der dritte Achsen-Baustein.
- *Tendenz:* **B als eigener, späterer Slice** — wichtig (verhindert, dass Beispiele/Hypothesen als Fakten landen), aber unabhängig vom Trust-ADR. Reihenfolge: erst defeasible-Entrenchment-ADR, dann Modus-Achse.

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

**13. `verify()` Mehr-Signal statt Wahr/Falsch?** 🟡
`verify()` liefert `{korrespondenz, kohaerenz, konsens}` (die drei operationalisierbaren Wahrheits-Approximationen) statt eines einzelnen Verdikts.
- *Tendenz:* **ja** — Tarski-ehrlich (keine Wahrheit, drei Annäherungen), und es speist die Eingangs-Matrix direkt.

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

---

## E — Vorbedingungen / Empirie (gating)

**14. Gibt es genug *adjudizierte* Daten, damit „verdienter Trust" überhaupt greift?** 🔴
Earned-Trust braucht eine Strom adjudizierter Ausgänge (höher-Tier-Korrespondenz / unabhängige Korroboration / *deine* Urteile = `user_rejected_at`).
- Frage an dich: Größenordnung deiner Endorse/Reject-Aktionen + Peer-Set-Größe. Bei sehr wenig: Trust bleibt nahe Prior, das Modell läuft, lernt aber kaum → dann zuerst die *Datenquelle* sichern (koppelt an §I.8 der Roadmap).
- *Tendenz:* das ist die *erste* Frage vor jeder Trust-Implementierung — ohne Adjudikations-Daten ist es Theorie.

ANTWORT: Siehe antworten von Trust-Architektur, um das eventuell neu bewerten zu können.

---

## F — Prozess

**15. Wer schreibt den ADR, in welcher Reihenfolge?** 🔴
- Dieses Dok (07) ist **ADR-Input**, kein ADR. Der eigentliche ADR „Belief: terminale Autorität → defeasible Entrenchment" ist ein **🔴-Slice** (Belief-Kern-Re-Fundierung) → voller CDP5 + Threat-Model + adversarial-auditor.
- *Tendenz:* Concept-First; die andere Instanz (die den Entrenchment-Strang fährt) setzt auf Dok 07 auf. Empfohlene Reihenfolge: **(1)** Entrenchment-ADR → **(2)** Trust-Dynamik-Slice → **(3)** Modus-Achse (Punkt 12).

---

### Schnell-Durchgang für unterwegs
Klare Empfehlungen (🟢) nur abnicken/ablehnen: **1, 3, 6, 9, 10, 11.**
Echte Abwägungen (🟡): **2, 4, 5, 13.**
Deine Wert-/Scope-Entscheidungen (🔴): **7, 8, 12, 14, 15.**

---

## RESOLUTION 2026-06-01 (O1–O6, post-§6-neu) — SUPERSEDIERT die deferred-Antworten #6–#14 oben

> Nach der §6-neu-Synthese (Impuls-Ledger statt Tag-Netz, `07`) wurden die offenen Stellen als konsolidierte Worklist O1–O6 durchgegangen und **explizit entschieden** (Design-Session 2026-06-01). Diese Resolution ist die maßgebliche Quelle für ADR 0019; die früheren „Siehe Antworten von Trust-Architektur"-Deferrals (#6–#14) sind damit aufgelöst.

- **O1 Empirie:** asymmetrisch (wenige exklusive Mensch-Urteile + dichter Ingestion-Strom) → **safe-inert bauen**; Fold läuft ab Tag 1 mit, entfaltet Kraft mit wachsenden Daten. `auto_corroborate` zählt, strikt gebändert.
- **O2 Undercut:** **B+C** — unabhängige Stützung schützt die Prämisse (`trust_ext` ohne K-Pfad); Regeln sind eigene Trust-Knoten mit eigenem Fold.
- **O3 Domäne:** **Projektion pro (Quelle×Thema)**, globaler Fold als Fallback-Prior bei dünner Zelle.
- **O4 Konstanten:** k≈10/Beta(3,7)→300‰; **5 Bänder** 0–200/201–400/401–600/601–800/801–1000 (skeptisch/unbestätigt/plausibel/solide/vertrauenswürdig); γ≈500‰; w_src≈300–500‰; Kalibrierung/Surprise ×1,5–2; Recency `λ(trust)=trunc(λ_base·(1000−trust)/1000)` mit `λ_min>0`; Pro-Periode-Delta-Clamp.
- **O5 auto_corroborate-Band:** Kappe **exakt 600‰**, nur externer Anker durchbricht; Herkunfts-/Inhalts-Hash-Dedup.
- **O6 Institutionelle Tags:** Floor (nur per Endorsement-Akt senkbar): `statute/law`, `official-gazette/authority`, `academic-peer-reviewed`. Empirisch (fold-getrieben, Tag = Kaltstart-Hint): `press/news`, `blog/web`, `llm-extraction`, `sensor/telemetry`.

**Weiterhin OFFEN (fürs ADR-Review-Gate, NICHT in O1–O6 explizit bestätigt):** #8 `eternal`=Floor (Claude-Empfehlung), #10 Contestation-Override-Form (Claude-Empfehlung), #12 `assertion_mode`/Fiktion (eigener späterer Slice S5). → im ADR als `[F-*]`-Flags geführt.
