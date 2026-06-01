# Retro-ADR 0019 — Belief: terminale Autorität → defeasible Entrenchment

**Status:** ENTWURF (Concept-First, fürs Review-Gate) — 🔴 Belief-Kern-Re-Fundierung
**Datum:** 2026-06-01
**Quellen (ADR-Input, firsthand verifiziert):** `docs/Exploration/Natur-Kognition-Alternativen/06,07,08`. **Maßgebliche Entscheidungs-Quelle:** `08` → Abschnitt **„RESOLUTION 2026-06-01 (O1–O6)"** (supersediert die früheren #6–#14-Deferrals). §6-neu-Mechanik: `07`.
**Zweck:** Belief-Kern von *terminaler Autorität* (Top-Tier gewinnt absolut, unwiderlegbar) auf *defeasible Entrenchment* (Trust = Widerlegungs-Schwelle, nicht Verdikt) umstellen. Bindende Entscheidung + Mechanik + fixierte Parameter (O1–O6) + AC + Threat-Model + Implementierungs-Slicing.

> **Review-Flags (bewusst offen, fürs Review-Gate T2 — KEINE stillen Entscheidungen):**
> **[F-λmin]** `λ_min > 0` (Recency nie exakt 0) — Empfehlung.
> **[F-Demut]** Verdiente Historie deckelt ≤800; Band ≥801 nur via Endorsement/Institution.
> **[F-Local]** Impuls-Ledger **lokal** (Read-Lens, NICHT im Wire) — aus 07 §9 Inv. 4; Trust-Föderation = Wire-v2, eigener Slice.
> **[F-eternal]** `eternal` = institutioneller Floor (statt streichen) — Claude-Empfehlung (#8), vom Nutzer **noch nicht explizit bestätigt**.
> **[F-contest]** Contestation-Override-Form (→`contested`, nie `contradicted`; akkumulierende offene Anfechtung) — Claude-Empfehlung (#10), **noch nicht explizit bestätigt**.
>
> *O2–O6 sind dagegen vom Nutzer explizit entschieden (08-Resolution 2026-06-01) und hier bindend.*

---

## 1. Kontext & Problem
NSAI-Edge behandelt Autorität (`sourceTier`) als **terminales Verdikt**: Top-Tier (`gesetz`) gewinnt in `resolveBelief` absolut, anzahl-unabhängig, **unwiderlegbar** → **Single-Point-of-epistemic-Failure** (lügt die oberste Stufe, lügt das System mit). Kern-Axiom (Nutzer): **„Alles was reinkommt, ist erstmal widerlegbar, weil wir die Wahrheit noch nicht kennen"** (Fallibilismus/AGM/Popper). Trust *abschaffen* wurde verworfen (bräche Sybil-Schutz, Echo-Neutralisierung, deterministischen Merge, Domänen-Semantik).

## 2. Glossar
| Begriff | Bedeutung |
|---|---|
| defeasibel | widerlegbar/revidierbar; Gegenteil von *strikt/terminal* |
| Entrenchment (AGM) | Resistenz eines Glaubens gegen Rücknahme = Retraktions-Priorität; hier: **Widerlegungs-Schwelle** |
| Rebut vs. Undercut (Pollock) | Rebut = widerspricht dem *Objekt*; Undercut = greift die *Inferenz-Verknüpfung/Prämisse* an |
| Fold | deterministische Read-Projektion: `trust = Σ` aller Impuls-Events in Total-Ordnung |
| Impuls / Event | adjudiziertes Ereignis `(target, adj_class, delta_promille, occurred_at_norm, event_hash)` |
| `trust_ext(P)` | Trust der Prämisse P aus **unabhängigen Wurzeln OHNE** den gerade fehlschlagenden Pfad |
| `contested` vs `contradicted` | bestrittene Autorität (Read-Verdikt) vs. als-falsch-belegt (verlangt Wahrheits-Behauptung der Gegenseite — vermeiden) |
| Oracle-Gating | nur extern-verankerte Adjudikation (Mensch/höher-Tier) erzeugt signifikante Verschiebung |
| Floor (institutionell) | Mindest-Entrenchment, nur per **Endorsement-Akt** senkbar, nicht durch Evidenz |

## 3. Entscheidung (Kern)
1. **Trust = Widerlegungs-Schwelle, nicht Verdikt.** `sourceTier` von *terminal* auf *defeasibel*: hohe Autorität = hohe Schwelle, nie unendlich.
2. **Alles eingehende Wissen ist widerlegbar.** Kein `is_true`-Feld; Wahrheit intern nur *approximierbar* (Tarski).
3. **Drei orthogonale Achsen** (07 §2): Provenienz-Autorität (WER) · Wahrheitswert (abgeleitet, nie gespeichert) · Assertions-Modus (Fiktion gescoped, Slice S5).
4. **Trust-Dynamik = Impuls-Ledger über dem Provenienz-DAG** (§4).

## 4. Mechanik — Impuls-Ledger-Trust (integer-gehärtet)
**Axiom:** Trust ist **kein gespeicherter Zustand**, sondern deterministische **Projektion (Fold)** über ein append-only **Ledger adjudizierter Impulse** entlang des zyklenfreien TMS-DAG.

### 4.1 Event-Store (append-only, LOKAL [F-Local])
Nur **primäre** Adjudikations-Events auf dem direkt beurteilten Item:

| Feld | Typ | Wertebereich |
|---|---|---|
| `target_id` | TEXT | triple_hash / source_id / rule_id |
| `adj_class` | TEXT | `human_endorse`·`human_reject`·`oracle_higher_tier`·`auto_corroborate` |
| `delta_promille` | INT | −1000…+1000; `= trunc(1000·(c−w)/N)` (N>0; **N=0 → Event ungültig, abgewiesen**) |
| `occurred_at_norm` | TEXT | ISO-UTC-Z (Total-Ordnungs-Schlüssel 1) |
| `event_hash` | TEXT | Tie-Break (Total-Ordnungs-Schlüssel 2) |

Quell-/Eltern-Beiträge werden **nicht** gespeichert — reine Read-Time-Projektion.

### 4.2 Fold (rein lesend, deterministisch, sequenziell)
`trust(node, T)` = sequenzieller Fold über alle Events bis `T` in **Total-Ordnung** `(occurred_at_norm, event_hash)`. **Recency nutzt den Fold-Stand am Periodenanfang** (vor dem Event) — dadurch deterministisch trotz Trust-abhängigem λ. Beiträge je Event auf K:
1. **Direkt (K):** Bilanz von K um `delta`.
2. **Quelle(K):** `Δ_source = trunc(delta · w_src / 1000)`.
3. **Eltern(K)** (`derived_from`/`episode_triples`) — **erst ab Slice S2/S4, NICHT S1** (s. §8):
   - Distanz-Decay (integer): `delta_parent = trunc(delta · γ^d)` (γ Promille, `γ^d` = d-fach getrunkte Multiplikation).
   - **Undercut-Attribuierung + Verdünnung (O2):** EINE Formel, beide Faktoren explizit:
     `blame(P) = trunc( delta_parent · (1000 − trust_ext(P)) / 1000 / n )`
     mit `trust_ext(P)` = Fold über P's unabhängige Wurzeln **ohne den K-Pfad** (sonst Zirkel; Pfad-Identifikation über `derived_from`-Kanten), `n` = Anzahl unabhängiger Wurzeln (**n=0 → kein Eltern-Impuls**). Nur bei prämissen-attribuiertem Versagen; Regel-Versagen geht an den **Regel-Knoten** (eigener Fold).

### 4.3 Recency / Decay (O4, [F-λmin]) — Perioden-Modell **B (Epoche), bindend 2026-06-01**
`λ_eff(trust) = max( λ_min , trunc(λ_base · (1000 − trust) / 1000) )`, `λ_min > 0`. Hoher Trust → langsamer Fade (Verankerung „das Wahre bleibt", #4); `λ_min>0` garantiert, dass **auch eine trust=1000-Quelle bei kompletter Stille in endlicher Zeit zurückdriftet** (Anti-Sleeper, löst die Kollision mit 07 §6).

**Perioden-Modell-Entscheid (S1b-Blocker, jetzt fixiert):** **Epochen-Zähler, NICHT Wall-Clock.** Eine „Periode" = ein `decay_pass()`-Aufruf (vorhandenes Konfidenz-Decay wiederverwendet, §4.3-Anker). Jedes `trust_event` trägt die globale Epoche bei Insert; `trustOf` rechnet `verstrichene Epochen = current_epoch − event_epoch` — **rein aus dem Store, keine `_now()`-Abhängigkeit**. Begründung: nur so bleibt `trustOf` integer-exakt **conformance-/replay-fähig** (Node↔PHP-Gate vergleicht byte-genau; Wall-Clock würde dieselbe K1/K2-Blindstelle reißen). **Hybrid:** zeitähnliche Alterung entsteht, indem `decay_pass()` planmäßig (Cron) läuft — die Determinismus-Eigenschaft von `trustOf` bleibt davon unberührt. **Migrations-Hinweis (🟡, Audit):** `migrateTrustEventsEpoch` backfillt Bestands-Events auf Epoche 0 → sie werden in einer einzigen Replay-Epoche gefoldet (Recency-Semantik „alles gleich-alt" für Pre-S1b-Bestände). Folgenlos, da das S1a-Substrat frisch ist und kaum Alt-Events existieren; Determinismus/Bounds bleiben.

**Fold-Algorithmus (zustandslose Read-Projektion, Einzige-Wahrheit = Milli-`(α,β)`):** `trustOf(id, asOf=current_epoch)` repliziert Epochen `[min_event_epoch … asOf]`; je Epoche in dieser Reihenfolge:
1. **`trust_start = trunc(1000·α/(α+β))`** (Fold-Stand am Periodenanfang — Quelle für λ).
2. **Decay / Mean-Reversion:** `α ← α₀ + trunc((α−α₀)·(1000−λ_eff)/1000)`, analog `β` (Überschuss über den Prior schrumpft; λ aus `trust_start`).
3. **Vouch-Stärke decay:** separater Skalar `vouch∈[0,1000]` klingt mit eigenem `λ_v=max(λ_min,trunc(λ_base·(1000−vouch)/1000))` ab (NICHT an der auto-getriebenen Gesamt-Trust → nicht zirkulär).
4. **Fold der Epoche in ZWEI Achsen** (gegnerisch gehärtet — ein pauschaler Bypass ließe einen co-lokalen `human_reject` die auto-Masse *heben* statt senken):
   - **4a Autoritäts-Achse:** direkte `human_*`/`oracle_higher_tier` **frei** (beide Richtungen, kein Clamp); ein positiver Direkt-Akt hebt `vouch ← min(1000, vouch+delta)` (∝ Stärke → Trivial-`delta=1` hebt kaum). Danach `tAuth` (Baseline nach Autorität).
   - **4b Anzahl-Achse:** direkte `auto_corroborate` (w=1000) + **alle** Quell-Events (w_src, auto-Dedup über `seenDedup`).
5. **Gehobene, abklingende Decke** (Entscheid [F-vouch-persist], s.u.): `effCap = baseCap + trunc((vouchCap−baseCap)·vouch/1000)`; `capCeil = max(tAuth, effCap)` — **Autorität ist Boden und wird NIE gekappt** (Mensch/Orakel darf über die auto-Decke hinaus). `raw = trunc(1000·α/(α+β))`; falls `raw>capCeil` → Re-Mix bei konstanter Masse auf `capCeil`. Dann **Pro-Perioden-Clamp** (Rate, T.13) um `tAuth ± clamp` — **NUR ohne frischen Vouch** (ein frischer Vouch zählt die akkumulierte auto-Evidenz sofort bis zur gehobenen Decke).
6. **Massen-Bound der Anzahl-Achse:** `setMass(massMax)` skaliert `(α,β)` ratio-erhaltend auf `≤ massMax`. Ohne diesen Bound baut ein auto-Schwall un-normalisierte Beta-Masse auf → Mean-Reversion wird zäh (Sleeper) UND künftige Mensch-Akte ersaufen.

**Entscheid [F-vouch-persist] (Stefan, 2026-06-01): „gehobene, abklingende Decke"** — ein positiver Vouch hebt die auto-Decke (`baseCap=600 → vouchCap=800`) proportional zur **separaten, abklingenden Vouch-Stärke**; die Decke fällt mit dem Vouch auf 600 zurück. **Strukturell sleeper-frei** (Massen-Bound). Schließt die 3 Adversarial-Befunde: 🔴-1 (co-lokaler reject senkt, Zwei-Achsen) · 🔴-2 (verblasster Anker hebt späteren Schwall nicht, Vouch-Decay) · 🔴-3 (Peak driftet zurück, Massen-Bound + Decke-Decay) — **und** die geerbte S1a-Schärfe (Trivial-`delta=1`-Anker hebt jetzt kaum, da `vouch+=delta`). Simulations-/Test-Beleg: Peak 800 → 756(e10) → 339(e40) → 300(e100); `delta=1`+2000 auto = 599; reject+co-lokaler auto senkt (422<450); T.10b 50auto+endorse = 800 (>600); T.4b/T.10a/d/e + Determinismus erhalten. **Stopp-Vorbedingung für S2:** `recordAdjudication` hat noch keinen Ingest-Aufrufer (human/oracle ist Stefan-gated); bevor S2/Ingest den Pfad verdrahtet, muss erzwungen sein, dass `human_*`/`oracle_higher_tier` nicht remote-injizierbar sind.

Final: Auto-Cap (`≤ trustAutoCorroborateCap` falls `!anchored`), Klemmung auf `[0,1000]`. **Innerhalb einer Epoche ist der Fold kommutativ** (additive `(α,β)`-Akkumulation, Per-Event-`trunc`) → reihenfolge-unabhängig; **über Epochen** strikt epochen-geordnet → voll deterministisch. Referenz-Simulation bestätigt: safe-default 300; 1000er-Schwall/Epoche → +150 gekappt; entrenched-dann-still 878→4‰/Epoche (slow-fade) → 669 nach 25 Epochen (Anti-Sleeper); integer/[0,1000]. **Konstanten** (`trustLambdaBase`,`trustLambdaMin`,`trustPerPeriodClamp`) — Single Source = `rules.mjs DEFAULT_SPEC`, dokumentiert in KONZEPT §I.7-DE. **Kein** `LEARN_CONSTANTS`-Spiegel (Trust-Ledger ist lokal, [F-Local] — PHP berechnet keinen Trust). Aufnahme in die `konzept-const-sync`-Allowlist ist ein **Folge-Schritt** (deckt dann auch die ungetrackten S1a-Konstanten `trustPrior*`/`trustSourceWeight`/`trustAutoCorroborateCap` mit ab) → eigener Gate-Enhancement-Diff.

### 4.4 Oracle-Gating / „Anzahl zählt nie" (Inv. 6)
Nur `human_*`/`oracle_higher_tier` erzeugen signifikante Verschiebungen. `auto_corroborate` **gebändert**: **UNgevouchte** auto hebt ein Item asymptotisch **bis exakt 600‰ (Obergrenze ‚plausibel'), nie ins ‚solide'-Band (≥601)**; korrelierte Items über gemeinsamen Herkunfts-/Inhalts-Hash = **ein** Signal. Die `/n`-Verdünnung (§4.2) ist die formale „Anzahl-zählt-nie"-Mechanik.
**S1b-Amendment (Entscheid [F-vouch-persist], §4.3):** Inv. 6 gilt absolut für **ungevouchte** auto (≤600). Ein **positiver human/oracle-Vouch** hebt die auto-Decke proportional zur **Vouch-STÄRKE** (`effCap = baseCap + (vouchCap−baseCap)·vouch/1000`, max. 800) — also „Anzahl zählt nie, **Anker-Stärke schon**". Die Hebung ist **strikt stärke-getrieben, NICHT frequenz-getrieben** (`vouch = max(decayed, delta)`, nicht `+= delta`) → ein billiger Dauer-Trickle kann die Decke nicht über seine Einzelakt-Stärke hinaus akkumulieren (gegnerisch gehärtet); und sie **klingt mit dem Vouch ab** (kein Sleeper). Konsequenz: gevouchte auto kann temporär ins solide-Band (601–800) proportional zur aktiven, anhaltenden menschlichen Aufmerksamkeit — **niemals ins ‚verifiziert' (≥801) via auto** (nur reine Autoritäts-Achse `tAuth` erreicht das). Greift erst scharf mit der S2-Vorbedingung (human/oracle nicht remote-injizierbar).

### 4.5 Tags = Kaltstart-Prior (statisch)
Tag-komponierter Beta-Prior für neue Quellen; sobald eigene adjudizierte Events vorliegen, **dominiert der Fold den Prior vollständig.** Tags oszillieren nicht.

## 5. Fixierte Parameter (O1–O6 — 08-Resolution 2026-06-01, bindend)
| # | Entscheidung |
|---|---|
| O1 | safe-inert; `auto_corroborate` zählt gebändert |
| O2 | Undercut B+C (unabhängige Stützung schützt; Regeln = eigene Trust-Knoten) |
| O3 | Projektion (Quelle×Thema), globaler Fallback-Prior bei dünner Zelle |
| O4 | k≈10/Beta(3,7)→300‰; 5 Bänder 0–200/201–400/401–600/601–800/801–1000; γ≈500‰; w_src≈300–500‰; Kalib./Surprise ×1,5–2; λ s. §4.3; Pro-Periode-Delta-Clamp Default ±150‰/Periode (Konstanten-Gate) |
| O5 | UNgevouchte auto_corroborate-Kappe exakt 600‰; Hash-Dedup. **S1b:** Vouch hebt die Decke stärke-proportional bis 800 (abklingend, §4.4-Amendment) |
| O6 | Floor: `statute/law`,`official-gazette/authority`,`academic-peer-reviewed`. Empirisch: `press/news`,`blog/web`,`llm-extraction`,`sensor/telemetry` |

## 6. Defeater-Trigger & Contestation [F-contest]
| Situation | Verhalten | Mechanik |
|---|---|---|
| Fremd, kein Gegenwissen | hinnehmen | niedrige Entrenchment, kein reject |
| Zwei gleich-fremde widersprechen sich | glaubwürdige Quelle suchen | `contested` + Eskalation eine Tier-Stufe nach oben |
| Bekannte X, Fremde ¬X | Beweislast → Fremde | Trusted hält; Widerspruch **nicht verworfen**, persistente offene Anfechtung, **akkumuliert** |

Contestation kippt Top-Tier auf **`contested`** (Read-Verdikt), **nie `contradicted`**. Defeater-Typen getrennt (O6): empirisch = Evidenz-Defeater (auto); institutionell = Akt-Defeater (Endorsement-pflichtig, [F-eternal]).

## 7. Akzeptanzkriterien
| AC | Kriterium | Slice |
|---|---|---|
| AC-T.1 | Fold deterministisch + total-geordnet → gleiches Event-Set ⇒ identischer Trust (zwei Läufe/Knoten) | S1 |
| AC-T.2 | Integer-Promille durchgängig, kein Float; Konstanten-Konsistenz-Gate-fähig | S1 |
| AC-T.3 | Direkt+Quelle-Beitrag: `Δ_source = trunc(delta·w_src/1000)`, exakt nachrechenbar | S1 |
| AC-T.4 | Safe-by-default: ohne Events == Prior (kein Drift) | S1 |
| AC-T.5 | Degeneration: `N=0`-Event abgewiesen (`INVALID_PARAMETER_FORMAT`); `adj_class` außerhalb der 4 Enums abgewiesen (`INVALID_PARAMETER_FORMAT`); `n=0` → kein Eltern-Impuls (keine Division durch 0) | S1/S2 |
| AC-T.6 | append-only: kein UPDATE/DELETE auf Events; Fold ist reine Lese-Projektion (kein Wire, kein vector_clock) | S1 |
| AC-T.7 | Distanz-Decay gedeckelt: Blatt-Reject senkt breit (n unabh. Kinder) gestützten Eltern höchstens `trunc(delta·γ^d·(1000−trust_ext)/1000/n)` | S2 |
| AC-T.8 | Undercut-vs-Rebut: Kind-Reject, das der Regel zuzuschreiben ist, lässt Eltern-Prämisse unberührt; Regel-Knoten sinkt | S2 |
| AC-T.9 | `trust_ext(P)` schließt den K-Pfad aus (zirkel-frei) — P, das NUR via K gestützt ist, trägt vollen Hit; anderweitig gestütztes P geschont | S2 |
| AC-T.10 | Oracle-Gating: `auto_corroborate` allein hebt nie über 600‰; korrelierte Herkunft = ein Signal | S1 |
| AC-T.11 | `λ_eff=max(λ_min,…)`: trust=1000-Quelle ohne neue Events driftet in endlicher Zeit messbar zurück (Anti-Sleeper) | S1 |
| AC-T.12 | Institutioneller Floor: negativer Fold schlägt Tier-Senkung nur VOR; ohne Endorsement kein Vollzug | S2 |
| AC-T.13 | Dampener: Ingestion-Schwall (N Events/Periode) bewegt den Score höchstens um den Pro-Periode-Clamp (Default ±150‰/Periode, Konstanten-Gate) | S1 |
| AC-T.14 | 🔴-Slice (S2/S4) ist nicht mergebar ohne im PR dokumentierten Adversarial-Auditor-Lauf (Verdict-Zeile) | S2/S4 |

## 8. Implementierungs-Slicing (CDP5 — narrow, additiv zuerst)
| Slice | Inhalt | AC | Risiko | Bricht Bestand? |
|---|---|---|---|---|
| **S1a Substrat** (✅ geliefert + 4. Audit safe-JA) | Event-Store (lokal, append-only Trigger-gehärtet) + Fold-Projektor **Direkt+Quelle+Band+Hash-Dedup** (integer-promille, total-geordnet, safe-by-default). **Klassen-getrennter event_hash:** `auto_corroborate` inhalts-deterministisch + `INSERT OR IGNORE` (idempotenter Dedup gewollt); `human/oracle` mit monotonem seq + plain `INSERT` (distinkte Akte kollabieren NIE — Audit-3-Datenverlust geschlossen). **KEINE Recency/Dampener** (→ S1b), **KEINE Eltern-Attribuierung/`trust_ext`** (→ S2). `resolveBelief` unberührt. Cap-Uncap NUR durch positiven externen Anker DIREKT auf den Knoten (item-bezogen). | T.1–T.6,T.10 | 🟢 | nein (additiv) |
| **S1b Recency/Dampener** | `λ_eff`-Recency/Mean-Reversion + Pro-Periode-Delta-Clamp. **Perioden-Modell entschieden 2026-06-01: B (Epochen-Zähler) + Cron-Hybrid** (§4.3) — Epochen-Stempel je Event, `trustOf` wall-clock-frei/conformance-fähig. Algorithmus + Referenz-Simulation in §4.3. **[F-tiebreak]** (4.-Audit-🟡): bei gleichem `dedup_hash` + gleichem ts + divergierendem delta gewinnt heute der kleinste `event_hash` (vom §4.4-„ein Signal"-Kontrakt gedeckt, durch ≤600-Kappe folgenarm); sobald hier Stärke/Recency zählt, sollte der Tie-Break auf „stärkstes \|delta\| gewinnt" umgestellt werden. | T.11,T.13 | 🟡 | nein (additiv) |
| **S2 Fold→resolveBelief** | Präzedenz tier-primär → entrenchment-gewichtet; Eltern-Attribuierung + `trust_ext`; `eternal`=Floor. | T.7–T.9,T.12 | 🔴 | ja |
| **S3 Domäne** | (Quelle×Thema)-Projektion + globaler Fallback | — | 🟡 | nein |
| **S4 Defeater/Contestation** | akkumulierende offene Anfechtung + `contested`-Fold-Verdikt | — | 🔴 | teilw. |
| **S5 Modus-Achse** | `assertion_mode` + Welt-Scopes (Fiktion), `verify` ignoriert | — | 🟡 | nein (additiv) |

**Scope-Klärung (Reviewer 🟡-4):** Die Eltern-Propagation (§4.2 Beitrag 3) + `trust_ext` gehören **S2/S4, nicht S1**. S1 ist reiner Substrat-Fold (Direkt+Quelle), damit ohne Zirkel-Risiko sofort + sicher baubar.
**Stopp-Grenze:** **S2 wird NICHT autonom durchgezogen** — braucht eigene Migrations-/Wire-Entscheidung für die 12k Bestands-Edges + erneute Stefan-Bestätigung. **Dieser Run liefert S1.**

## 9. Threat-Model des Impuls-Pfads
| Bedrohung | Gegenmaßnahme |
|---|---|
| Fabrizierte Kind-Adjudikationen drücken Eltern/Quelle | Eltern-Impuls nur prämissen-attribuiert + `/n`-verdünnt; `trust_ext` ohne fabrizierten Pfad (§4.2) — **S2** |
| Sybil/Echo über auto_corroborate | Band-Kappe 600 + Hash-Dedup = ein Signal (§4.4) — **S1** |
| Trust-Farming durch Streit-Fabrikation | Oracle-Gating; Gewinn aus Belegen, nicht Lautstärke |
| Floor-Erosion institutioneller Quellen | harter Floor (O6), Senkung nur per Endorsement-Akt |
| Sprung-Trust durch Ingestion-Schwall | Pro-Periode-Delta-Clamp (O4) + Mean-Reversion |
| Stille Kompromittierung Hoch-Trust (λ→0) | `λ_min>0` [F-λmin] + Kalibrierung×2/Surprise bei adjudizierter Lüge |

Adversarial-Auditor-Pflicht je 🔴-Slice (S2/S4).

## 10. Restrisiko-Leitplanke (Tarski)
**Eine konsistente, unwidersprochene Lüge einer vertrauten Quelle ist orakel-frei unentdeckbar.** Erreichbar: **keine Lüge überlebt, der verfügbare unabhängige Evidenz widerspricht.** Trust *driftet mit adjudizierter Evidenz*, ist **kein Wahrheits-Sensor**. → als „Was das System NICHT leistet" ins KONZEPT §B (Slice T3).

## 11. Invarianten-Check
| Invariante | Status |
|---|---|
| (1) Zero-Dep | ✅ Integer/Beta/Decay/Fold in JS |
| (2) Offline | ✅ |
| (3) Determinismus | ✅ Integer-Promille, Fixed-Point-Milli-Counts, Total-Ordnung — kein Float (AC-T.1/T.2) |
| (4) CRDT | ✅ **trivial** — Ledger lokal (Read-Lens, keine Wire-Föderation in S1–S5); Konvergenz erst bei Wire-v2 relevant (out of scope) [F-Local] |
| (5) Lese-Linsen | ✅ Trust/Tendenz/`contested` lokal projiziert; signierte Wire-Felder unangetastet |
| (6) Anzahl zählt nie | ✅ in **S1** über auto_corroborate-Band + Hash-Dedup (§4.4); **S1b-Amendment:** ungevouchte auto ≤600 absolut, Vouch hebt **stärke**- (nicht frequenz-)proportional bis 800, abklingend; ab **S2** zusätzlich `/n`-Verdünnung (§4.2) |
| (7) Open-World | ✅ `unknown`≠falsch; Fiktion gescoped (S5); Contestation→`contested`, nie `contradicted` |
| (8) Nie raten | ✅ Updates oracle-gated; Lern-Drift = Constraint #4 (institutioneller Tier-Wechsel endorsement-pflichtig) |

## 12. Roadmap-Anschluss
Substrat für **C1** (EigenTrust), **C3** (MeritRank — Independence/`n` + Distanz-Decay), **D1** (Conformal — Schwellen/Kalibrierung), **E1** (Meta-Kognition — Brier/ECE), **A1** (Defeasible-Argumentation), **6.1** (Trust-Adjustment als Fold-Beitrag). §I-Roadmap-Eintrag in Slice T3.
