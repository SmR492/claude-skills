# Retro-ADR 0019 — Belief: terminale Autorität → defeasible Entrenchment

**Status:** ENTWURF (Concept-First, fürs Review-Gate) — 🔴 Belief-Kern-Re-Fundierung
**Datum:** 2026-06-01
**Quellen (ADR-Input, firsthand verifiziert):** `docs/Exploration/Natur-Kognition-Alternativen/06,07,08`. **Maßgebliche Entscheidungs-Quelle:** `08` → Abschnitt **„RESOLUTION 2026-06-01 (O1–O6)"** (supersediert die früheren #6–#14-Deferrals). §6-neu-Mechanik: `07`.
**Zweck:** Belief-Kern von *terminaler Autorität* (Top-Tier gewinnt absolut, unwiderlegbar) auf *defeasible Entrenchment* (Trust = Widerlegungs-Schwelle, nicht Verdikt) umstellen. Bindende Entscheidung + Mechanik + fixierte Parameter (O1–O6) + AC + Threat-Model + Implementierungs-Slicing.

> **Review-Flags (bewusst offen, fürs Review-Gate T2 — KEINE stillen Entscheidungen):**
> **[F-λmin]** `λ_min > 0` (Recency nie exakt 0) — Empfehlung.
> **[F-Demut]** Verdiente Historie deckelt ≤800; Band ≥801 nur via Endorsement/Institution.
> **[F-Local]** Impuls-Ledger **lokal** (Read-Lens, NICHT im Wire) — aus 07 §9 Inv. 4; Trust-Föderation = Wire-v2, eigener Slice.
> **[F-eternal]** ✅ **vom Nutzer bestätigt** (AskUserQuestion-Entscheid „Institutioneller Floor"): `eternal` = institutioneller Floor (statt streichen). Operativ seit S2a (`proposedDemotion`); S4 baut die institutionelle Contestation (`proposedContested`) konsistent darauf.
> **[F-contest]** ✅ **entschieden 2026-06-02 (Modell H):** Contestation lebt in einem **separaten, append-only Ledger `contestation_events`** (eigene Achse, schreibt NIE in `trust_events` → senkt strukturell nie den Trust). Read-time gefoldet zu `contested` (nie `contradicted`; Gewinner hält), Beweislast-Schwelle skaliert mit `trustOf(Gewinner)`. Nutzer verwarf die Unified-Single-Table-Variante (kehrt Sandbox-Isolation fail-closed→fail-open um, entypt CHECK-Conformance zu JSON). S1a-Ledger-Disziplin gespiegelt (getypte Spalten, CHECK-Enum, append-only-Trigger).
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
     mit `trust_ext(P)` = Fold über P's unabhängige Wurzeln **ohne den K-Pfad** (sonst Zirkel; Pfad-Identifikation über `derived_from`-Kanten), `n` = **Anzahl der Geschwister-Prämissen (unabh. Kinder, konsistent zu AC-T.7) des gerade zerlegten Knotens** — die Blame wird über die gemeinsam die Konklusion stützenden Prämissen verdünnt (**n=0 → kein Eltern-Impuls**). Nur bei prämissen-attribuiertem Versagen; Regel-Versagen geht an den **Regel-Knoten** (eigener Fold).
   - **Event-Modell (S2b geliefert, Stefan-Entscheid): 5. `adj_class = derived_blame`** (CHECK-Migration + Rebuild). `propagateRejectBlame(K, {delta<0, attribution})`: **rebut** propagiert transitiv die `derived_from`-Kette hoch (γ je Hop, `seen`-Set gegen Doppel-Blame, `maxDepth`-Bound), **undercut** belastet nur `rule_id` (n=1). Implementierung: `trust_ext(P) = trustOf(P)` — der „K-Pfad" ist via **DAG-Invariante** (`infer` überspringt zyklische Justifications) garantiert NICHT in P's Wurzeln, daher zirkel-frei ohne explizite Pfad-Subtraktion. `derived_blame` foldet in `trustOf` als **gedämpfter negativer Autoritäts-Impuls** (β-seitig, KEIN `anchored`, KEIN auto-Cap/Clamp) → Provenienz bleibt sauber getrennt (abgeleitet ≠ Mensch-direkt ≠ auto). Konstante `trustBlameGamma=500`.

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

### 4.6 Entrenchment-gewichtete Präzedenz (S2a, Modell C — Stefan-Entscheid 2026-06-01)
`resolveBelief` rankte bisher hart-lexikografisch `trustRank(Peer) → tier(sourceTier) → weight`. **S2a moduliert die effektive Autoritäts-Stufe mit der Entrenchment** (`trustOf` des Tripels), statt sie hart zu fixieren — „tier-primär → entrenchment-**gewichtet**":
- `bandShift(triple) = clamp( trunc((trustOf(triple_hash) − prior) / STEP) , −K , +K )` (Default `K=2`, `STEP=200`, `prior=300`).
- `effTierEntrenched(e) = clamp( effTier(e) + bandShift(e) , 0 , 6 )`. Dieser Wert ersetzt `tier` im Kandidaten (Präzedenz, Tier-Gruppierung, Tiebreak, query-Output). **`trustOf` (gemergt) + `_effTier` (Quorum/Conformance) bleiben unberührt.**
- **`trustRank(Peer)` bleibt primärer Gate** (Föderations-/Sybil-Resistenz): Entrenchment moduliert NUR die Tier-Achse, nicht den Peer-Trust. Ein auto-gepumptes Item (Kappe 600 → bandShift ≤ +1..+2) kann ein Gesetz NICHT überholen (sim-belegt).
- **eternal = institutioneller Floor [F-eternal]:** für `temporality='eternal'` wird ein NEGATIVER `bandShift` auf 0 geklemmt — ein negativer Fold **senkt die Stufe NICHT**, sondern wird nur als **Vorschlag** (`proposedDemotion`) im Ergebnis ausgewiesen; Vollzug nur mit Mensch-Endorsement (AC-T.12). Positiver Shift gilt auch für eternal.
- **Safe-by-default / keine Regression:** nach Wipe ist `trustOf`=Prior(300) → `bandShift=0` → exakt heutiges Tier-Verhalten. Determinismus bleibt (trustOf ist deterministisch). Konstanten `trustEntrenchmentBandK`,`trustEntrenchmentBandStep` in `rules.mjs`.
- Simulations-Beleg (alle Modelle verglichen): C ist Sybil-sicher + eternal-haltbar; defeasibel v.a. innerhalb/zwischen benachbarten Tiers + Same-Tier-Tiebreak; große Tier-Gaps bleiben autoritäts-dominiert außer bei Extrem-Widerlegung. **S2b** (Eltern-Attribuierung `trust_ext`/`blame`, T.7–T.9) ist eine eigene, additive Folge-Slice.

### 4.7 Domain-skopierter Trust (S3a, O3 — Stefan-Entscheid 2026-06-01)
`trustOf(id, {domain})` projiziert die Entrenchment auf ein **Thema** (Quelle×Thema): Fold über Events mit `domain=Thema` **ODER** `domain IS NULL`. **`domain`-Semantik:** Themen-Tag; nicht-themen-spezifische Impulse (`derived_blame`, generische Adjudikation) tragen `domain=null` und zählen **global in ALLE Themen-Scopes** (S2b's `derived_blame` auf `null` korrigiert). **Dünne-Zelle-Fallback (Hart-Schwelle):** < `trustDomainMinEvidence` themen-spezifische Events auf dem Knoten → Rückfall auf den **globalen** `trustOf` (die dünne Zelle ist nicht belastbar). **`domain=null` (Default) = exakt bisheriges Verhalten → kein Regress.** **Scope S3a = Substrat:** nur die `trustOf`-Fähigkeit + Recording-mit-Domain; die **Themen-Bestimmung im Belief-Pfad** (Prädikat→Thema / Tag) ist **S3b** (deferred) — `resolveBelief` bleibt unberührt (nimmt höchstens einen optionalen expliziten `domain`). Konstante `trustDomainMinEvidence=5`. Determinismus + S1b-Fold (Recency/Decke/Mass) unberührt (nur Event-Filterung).

### 4.8 Modus-Achse / Fiktion (S5a — Stefan-Entscheid 2026-06-01: separater Sandbox-Store)
Dritte orthogonale Achse: **Assertions-Modus** `asserted` vs `suspended` (Fiktion/Hypothese/Beispiel/Zitat — commitment-suspendiert). **Fiktion ist NICHT falsch, sondern modus-verschoben** (Searle/Frege; Tarski-Leitplanke §B). **Storage = PHYSISCH separater `sandbox_edges`-Store** (NICHT same-table-Filter): die Fakt-Lese-Pfade (`resolveBelief`/`query`/`verify`) lesen ausschließlich `knowledge_edges` → sehen die Sandbox **nie** (Isolation by Default — kein Filter, den ein Pfad vergessen kann; stärkste Tarski-Garantie „Fiktion wird nie versehentlich Fakt"). **Welt-Scope** (`world`, Lewis-Operator „in Welt f gilt A") via `recallWorld(world)` — **explizites Opt-In**; `includeFacts=true` schlägt temporär die UnionRead Sandbox(world)+Faktengraph. **Promotion** (`promoteFiction(world, hash)`, Stefan-Modell): reife Fiktion wird **gelöscht + als frische Ingestion** in `knowledge_edges` geschrieben → sammelt ihre ersten Impulse neu im Trust-Ledger (kein Flag-Mutieren). **S5a = Substrat** (`storeFiction`/`recallWorld`/`promoteFiction`); die deterministische **Ingest-Heuristik** (llm/web + sprachliche Trigger → suspended+Sandbox) ist **S5b** (deferred). Fakt-Pfad byte-genau unberührt (eigene Tabelle).

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

**Modell H (S4 geliefert 2026-06-02):** separater append-only Ledger `contestation_events` (getypt: `contest_type ∈ {empirical, institutional}` CHECK, `weight_promille` 0–1000 CHECK, append-only-Trigger). `contest(target_id, {contester_id, contest_type, weight, reason, dedup_hash})` appendet **immer eine distinkte Zeile** (monotone seq, NIE `INSERT OR IGNORE`) → keine Zeile kann je verdrängt werden → **Suppression strukturell unmöglich** (Audit-R4-🔴-2). **`contestationOf(id,{type,asOf})` = Stärke-pro-Herkunft mit TRUST-PEER-GATE (Stefan-Entscheid, Audit R1–R4): es zählen NUR Anfechtungen registrierter, VERTRAUTER Peers (`_originTrust ≠ untrusted`; self=full) — pro Peer nur dessen STÄRKSTE Anfechtung (MAX), nicht Frequenz/Summe** (exakt die `trustOf`-vouch-Disziplin „Anker-Stärke, nicht Anzahl"). **Anonyme/untrusted Herkunft trägt 0 bei** (Zeile bleibt als Audit-Spur). Damit ist Identität an die authentifizierte Peer-Registry gebunden, NICHT an einen frei wählbaren String → kein String-Trick (Unicode-ZeroWidth/Pseudonym/Whitespace) erzeugt eine Herkunft (schließt R1–R4 an der Wurzel statt per fragiler Normalisierung). Das Fälschen vieler vertrauter Identitäten erfordert `peerAdd`+`peerTrust` (gegatete Akte = Trust-Boundary). Distinkte vertraute Anfechter akkumulieren unbegrenzt (Defeasibility bleibt). `peerRevoke` senkt rückwirkend (Read-Lens). **Voll-gewichtete Peer-Trust-Aggregation (statt binär trusted/untrusted) = S4c, deferred.** `resolveBelief` reichert read-time an (`_augmentContestation`): `contested = accEff ≥ thr` mit **`thr = trustContestBase(300) + trunc(trustOf·trustContestSlope(1000)/1000)`** (Beweislast skaliert mit Verankerung); Gewinner unverändert; über Schwelle → `contestation.escalation.neededTier = effTier+1`. **eternal-Floor:** gegen `eternal` zählt nur **empirische** Last automatisch; **institutionelle** Last über Schwelle wird nur als `contestation.proposedContested` ausgewiesen (Endorsement-pflichtig, AC-T.12-Parität). **Trust-Invariante strukturell:** der Ledger kann `trust_events` physisch nicht schreiben → eine Anfechtung senkt nie den Trust. **Safe-by-default:** ohne Anfechtungs-Events bleibt `resolveBelief` byte-identisch (kein `contestation`-Feld). **Deferred S4b:** Auto-Erkennung von §6-Zeile 2 (zwei gleich-fremde → contested) im Belief-Pfad ohne expliziten `contest`-Akt; as-of-historische Anfechtung (Epochen-Linse).

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
| AC-T.15 | Contestation strukturell trust-neutral: `contest()` erzeugt KEIN `trust_events`-Event; `trustOf(target)` byte-identisch davor/danach (eigener Ledger) | S4 |
| AC-T.16 | Gewinner hält: Anfechtung über Schwelle setzt `contested=true`, ändert `winner` NIE (nie `contradicted`) | S4 |
| AC-T.17 | Beweislast skaliert: `thr=trustContestBase+trunc(trustOf·trustContestSlope/1000)`; höhere Verankerung ⇒ höhere Schwelle ⇒ dieselbe Last kippt sie nicht | S4 |
| AC-T.18 | eternal-Floor: institutionelle Last über Schwelle ⇒ nur `proposedContested` (Endorsement-pflichtig); empirische Last zählt automatisch | S4 |
| AC-T.19 | append-only erzwungen (UPDATE/DELETE-Trigger); `dedup_hash` kollabiert identische Anfechtung; safe-by-default (ohne Events `resolveBelief` byte-identisch) | S4 |
| AC-T.20 | Trust-Peer-Gate + Stärke-pro-Herkunft: nur registrierte vertraute Peers (`_originTrust≠untrusted`) zählen, je nur ihre STÄRKSTE Anfechtung (MAX). Anonyme/untrusted/beliebige String-Varianten (Unicode/Whitespace/Pseudonym) tragen 0 → keine Frequenz-/Identitäts-Inflation; distinkte vertraute Anfechter akkumulieren | S4 |
| AC-T.21 | Suppressions-frei strukturell: Storage immer distinkt (kein `INSERT OR IGNORE`) → keine Zeile verdrängbar; `weight=0` verdrängt nie eine starke Anfechtung (MAX-Fold) | S4 |
| AC-T.22 | `peerRevoke`/`peerTrust`-Entzug senkt das Anfechtungs-Standing rückwirkend (read-time Trust-Projektion, kein gespeichertes Verdikt) | S4 |

## 8. Implementierungs-Slicing (CDP5 — narrow, additiv zuerst)
| Slice | Inhalt | AC | Risiko | Bricht Bestand? |
|---|---|---|---|---|
| **S1a Substrat** (✅ geliefert + 4. Audit safe-JA) | Event-Store (lokal, append-only Trigger-gehärtet) + Fold-Projektor **Direkt+Quelle+Band+Hash-Dedup** (integer-promille, total-geordnet, safe-by-default). **Klassen-getrennter event_hash:** `auto_corroborate` inhalts-deterministisch + `INSERT OR IGNORE` (idempotenter Dedup gewollt); `human/oracle` mit monotonem seq + plain `INSERT` (distinkte Akte kollabieren NIE — Audit-3-Datenverlust geschlossen). **KEINE Recency/Dampener** (→ S1b), **KEINE Eltern-Attribuierung/`trust_ext`** (→ S2). `resolveBelief` unberührt. Cap-Uncap NUR durch positiven externen Anker DIREKT auf den Knoten (item-bezogen). | T.1–T.6,T.10 | 🟢 | nein (additiv) |
| **S1b Recency/Dampener** | `λ_eff`-Recency/Mean-Reversion + Pro-Periode-Delta-Clamp. **Perioden-Modell entschieden 2026-06-01: B (Epochen-Zähler) + Cron-Hybrid** (§4.3) — Epochen-Stempel je Event, `trustOf` wall-clock-frei/conformance-fähig. Algorithmus + Referenz-Simulation in §4.3. **[F-tiebreak]** (S3a-Audit präzisiert): bei gleichem `dedup_hash` + **divergierendem** delta (= **Verletzung** des §4.4-„ein Signal"-Kontrakts „gleicher Inhalts-Hash ⇒ gleiches delta") ist der `seenDedup`-Gewinner vom Total-Order-Tiebreak abhängig; da der auto-`event_hash` den `ts` enthält, ist das Ergebnis bei nahezu-gleichzeitigen Events **wall-clock-abhängig und flippt** (z. B. 481↔448) — NICHT bloß „folgenarm". **Nur bei Kontraktbruch erreichbar** (kontraktkonforme Daten sind voll deterministisch, S3a-Audit 15×stabil); **vorbestehend (S1a/S1b), von S2/S3 nicht eingeführt/verbreitert.** **Fix (deferred, eigene S1-Härtungs-Slice):** Dedup-Gewinner inhalts-deterministisch wählen (z. B. „stärkstes \|delta\| gewinnt") ODER auto-`event_hash` ts-frei machen — dann auch unter Kontraktbruch deterministisch. | T.11,T.13 | 🟡 | nein (additiv) |
| **S2a Entrenchment-Präzedenz** (✅ geliefert, Audit safe-JA) | Modell C (§4.6): `resolveBelief` moduliert die effektive Tier-Stufe mit `trustOf` (bandShift ±K, K=2); `eternal`=Floor (negativer Shift→`proposedDemotion`, kein Vollzug ohne Endorsement, AC-T.12); Peer-Trust bleibt primärer Gate; safe-by-default (Prior→shift 0, kein Regress). | T.12 | 🔴 | nein (additiv, Prior-neutral) |
| **S2b Eltern-Attribuierung** (✅ geliefert) | `propagateRejectBlame` über `derived_from` (rebut: transitiv γ^d/n/trust_ext-gedämpft; undercut: Regel-Knoten) → `derived_blame`-Events (5. adj_class). zirkel-frei via DAG-Invariante. Additiv auf S2a (`trustOf` foldet derived_blame als neg. Autoritäts-Impuls). | T.7–T.9 | 🔴 | nein (additiv) |
| **S3a Domäne** (✅ geliefert) | `trustOf(id,{domain})`: (Quelle×Thema)-Projektion (domain=Thema ∨ null) + Hart-Schwellen-Fallback auf global bei dünner Zelle; domain=null=global/kein-Regress. Substrat (resolveBelief unberührt). **S3b** (Themen-Bestimmung im Belief-Pfad) deferred. | — | 🟢 | nein (additiv) |
| **S4 Defeater/Contestation** (✅ geliefert 2026-06-02, Modell H; 5 Audit-Runden) | separater append-only `contestation_events`-Ledger (senkt strukturell nie Trust); `contest`/`contestationOf` (**Trust-Peer-gegateter Stärke-pro-Herkunft-Fold: nur vertraute Peers, per-Peer-MAX; anonym/untrusted=0; immer-distinkt-einfügen → inflations- + suppressions-fest an der Identitäts-Wurzel, Audit R1–R4**); `resolveBelief` read-time `contested`-Verdikt mit verankerungs-skalierter Schwelle (`_augmentContestation`); Gewinner hält (nie `contradicted`); eternal-Floor → `proposedContested`; Eskalation +1 Tier; safe-by-default. **S4b** (Auto-§6-Zeile-2, as-of-Anfechtung), **S4c** (voll-gewichtete Peer-Trust-Aggregation statt binär) deferred. | T.15–T.22 | 🔴 | nein (additiv, safe-by-default) |
| **S5a Modus-Achse/Fiktion** (✅ geliefert) | Separater `sandbox_edges`-Store (Isolation by Default); `storeFiction`/`recallWorld` (Welt-Opt-In)/`promoteFiction` (Löschen+frische Ingestion). Fakt-Pfade lesen nur knowledge_edges → Fiktion unsichtbar. **S5b** (Ingest-Heuristik) deferred. | — | 🟢 | nein (additiv) |

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
