# Konzept: Glaubwürdigkeits-Scoring als propagierende Graph-Linse (NSAI-Edge)

**Version:** v0.3 (Slice-Konzept, `evaluated_pending`) · **Datum:** 2026-06-01 · **Autor-Modus:** CDP5 §1.2 (KI-Entwurf, menschliche Verantwortung Stefan) · **Status:** Konzept-Entwurf vor Endorsement; kein Code. · **Scope:** Glaubwürdigkeits-Scoring (interne, deterministische Provenienz-Linse) für NSAI-Edge. **Nicht enthalten:** Belief-Resolution-Kern, Modus-/Fiktions-Achse, Föderations-Transport, ADR „defeasible Entrenchment", Sybil-Abwehr im Allgemeinen (eigene Achse: MeritRank).

**v0.2-Delta (Review-Runde a/b/c):** behob konzept-reviewer (6,4/10) + adversarial-auditor (Verdikt NEIN): F-1 (Reversion-Vorzeichen), F-2 (asymmetrischer Limiter + Domänen-Trennung), F-3 (Pooling an Mitglieder-Unabhängigkeit), F-4 (intern/deterministisch, anker-gebundene Adjudikation), F-5 (Float/Parität), L8 (Promille-Drift), L1/L9/L10.
**v0.3-Delta (V1/V2/V3 aufgelöst, Stefan 2026-06-01):** V2 **Domäne = trust-UNABHÄNGIGER struktureller Top-Ancestor-BFS, Single-Primary** (UC-CS-11) · V3 **`coheres_with_gated_anchor` drei-wertig** (corroborated/contradicted/not-applicable), numerische Toleranzbänder / symbolisch strikt, Korrespondenz statt Lineage · V1 **absoluter `MIN_OUTCOMES`-Floor + Cold-Start-Band-Cap** (kein dynamischer Floor). Gemini-Input gefiltert per Pushback-Doktrin → Ledger §10.

**Determinismus-/Probabilistik-Statement (§2.6):** Deterministisch (Integer-Promille / Fixed-Point-Milli, `floordiv` Richtung −∞, feste Iterations-/Rundungsordnung; KEIN LLM, KEIN Float im Pfad). **Strikt lokale, interne Lese-Linse** über dem signierten Wire-Wert — mutiert keine signierten Felder, **wird nicht föderiert und nicht roh exponiert** (nur 5 Bänder, on-demand). Score = Evidenz-Gewicht, keine W'keit-wahr-zu-sein (A4/MYCIN). Kein Wahrheits-Orakel (Tarski).

**Sichtbarkeits-/Anker-Statement (§2.6, F-4):** Roh-Scores/Bilanzen verlassen den Knoten nie (kein Egress, keine Föderation). **Adjudikation = deterministischer Check, verankert an (a) gated Knoten, (b) Mensch, (c) struktureller Kohärenz** — ein rein **gelernter** Knoten ist nie Adjudikator. Nach außen nur das Band, on-demand.

**LLM-Konsumenten-Schnittstelle (§13.1):** Kein LLM-Call in der Engine. **Kontext:** Agent erhält on-demand nur das **Band** (1 von 5), nie die Zahl. **Ausgabe/Output:** Band → query-first-Gewichtung. **Validierung:** Band = Evidenz-Gewicht, nie Wahrheit (A4). **Fallback:** unbekannt → `skeptisch`. **Cutoff:** entfällt (deterministisch).

---

## Inhaltsverzeichnis
1. Architektur-Entscheidung (ADR-Kurzform)
2. Rollen-Übersicht
3. Datenmodell + Determinismus-Vertrag
4. Algorithmus (deterministischer Kern)
5. Use Cases (UC-CS-01 … UC-CS-11)
6. Sicherheit & Bedrohungsanalyse (§33.4)
7. Glossar (§14)
8. Verantwortungs-Matrix (§23.1)
9. Offene Punkte & Vorbedingungen (§10.4)
10. Externe-KI-Quellen-Ledger (§I.5-NB1 / Pushback)

---

## 1. Architektur-Entscheidung (ADR-Kurzform)

- **Glaubwürdigkeit = dritte, strikt interne Lese-Linse** über dem normalen Graphen (neben Belief/Activation). Provenienz-Knoten (`bild.de`, `Presseartikel`, `Gesetz`) sind gewöhnliche Einträge wie `Buch`/`Straße`, die einen Ruf (Beta-Bilanz) ansammeln; ein Fakt erbt einen Prior via PPR-Propagation (H1).
- **Intern + deterministisch + 5-Band-Egress (F-4):** Roh-Werte bleiben lokal; nur 5 Bänder gehen on-demand nach außen. Adjudikation anker-gebunden, nie durch gelernte Knoten.
- **Domänen-Trennung Pflicht (F-2/#7):** Trust pro **(Knoten × Domäne)**; Nebenthema speist Hauptthema nicht. Domäne ist **trust-unabhängig + strukturell + Single-Primary** (V2) — sonst könnte ein Angreifer Domänengrenzen via Trust verschieben.
- **`source_tier`/`origin_trust` vereinheitlicht:** beide = Knoten-Ruf; Trust ist *berechnetes* Wissen.
- **Zwei-Klassen-Hybrid:** gated Knoten (`Gesetz`/`Sensor`) gepinnt, nur per Mensch-Akt änderbar; gelernte gelernt + gedeckelt.
- **Skala 0–1000‰** (unverändert), 5 Bänder; harter `source_tier` (0–6) als Prior-Baseline via Mapping-Tabelle.
- **Invarianten:** zero-dep · offline · Determinismus (Integer/`floordiv`) · CRDT (Linse lokal) · „Anzahl zählt nie" (unabhängige Wurzeln) · Open-World (Adjudikation drei-wertig) · „nie raten".

## 2. Rollen-Übersicht

| Rolle | Beschreibung |
|---|---|
| **Engine (System)** | berechnet/aktualisiert Scores deterministisch; alle UCs systemisch außer UC-CS-09 (Mensch) |
| **Adjudikator** | Wahrheitssignal **anker-gebunden**: gated-Kohärenz · Mensch-Endorsement · Korroboration-mit-Anker — **nie** gelernter Knoten |
| **Mensch (Stefan)** | externes Orakel; Endorsement (Constraint #4); pin/unpin gated Knoten (UC-CS-09) |
| **Konsument (Agent)** | erhält on-demand nur das 5-Band-Signal |

## 3. Datenmodell (lokale Linse — nicht signiert/föderiert/exponiert) + Determinismus-Vertrag

Pro **(Knoten `N`, Domäne `D`)** — Domäne via UC-CS-11 (trust-unabhängig):

| Feld | Typ | Hinweis |
|---|---|---|
| `cred_alpha[N,D]` / `cred_beta[N,D]` | Integer (Milli) | Korroborations-/Widerlegungs-Gewicht (inkl. Prior) |
| `cred_pinned[N]` | Integer? (‰) | gated: fixer Ruf (domänen-übergreifend) |
| `cred_intro[N]` | Enum | `human_added` \| `anonymous` \| `self` |
| `cred_pending[N,D]` | Integer (Milli) | nur **positives** Delta; Status `held`→`released`\|`reverted` |
| `cred_outcomes[N,D]` | Integer | adjudizierte Ausgänge (Floor-Gate) |
| `cred_audit[]` | Liste | `{ts,node,domain,dAlpha,dBeta,adjudicator,outcome_ref}` (append-only) |

**Spec-Konstanten (Wire-Konstanten, Node↔PHP identisch):**

| Konstante | Default | Bedeutung |
|---|---|---|
| `PRIOR_MEAN` / `k` | 300‰ / 10 | Beta(3,7): α₀=3000, β₀=7000 (Milli) |
| `PRIOR_HUMAN_MEAN` / `PINNED_HIGH` | 500‰ / 950‰ | Einführungs-Prior `human_added` / self |
| `BANDS` | [200,400,600,800] | 4 Schwellen → 5 Bänder (misstrauisch/skeptisch/unbestätigt/plausibel/vertrauenswürdig) |
| `TIER_BASELINE` | {gesetz:950,behoerde:850,sensor:800,fachquelle:600,manual:450,web:300,llm:150}‰ | `source_tier`→‰ (Fallback) |
| `COLD_DOMAIN_CAP` | 600‰ | daten-arme Domäne nie über Band `unbestätigt` (V1) |
| `NUMERIC_TOLERANCE` | 10‰ (±1%) | Toleranzband numerischer Kohärenz (V3) |
| `CALIB_OVERCONF` / `SURPRISE_SLOPE` / `SURPRISE_MAX` | 2000‰ / 1000‰ / 2000‰ | Übergewicht / Surprise |
| `LAM_MIN` / `LAM_MAX` | 400‰ / 950‰ | Retention (niedrig→schnell, hoch→langsam verblassen) |
| `VELOCITY_CAP` | 80‰ | max. **Aufstiegs**-Delta/Epoche (Strafen bypassen) |
| `PROP_DAMPING` / `PROP_MAX_HOPS` / `PROP_MAX_ITER` / `PROP_TOL` | 850‰ / 2 / 200 / 1‰ | Pooling / Hop / Iter / Tol |
| `INDEP_CAP` / `BLEND_W` / `MIN_OUTCOMES` | 5 / 700‰ / 8 | Unabhängigkeits-Sättigung / eigene-Evidenz-Gewicht / Floor |
| `PROVENANCE_PREDICATES` | {`typ`,`medium`,`quelle`,`erschienen_in`,`ist_ein`(Quellenklasse)} | nur diese Kanten tragen Glaubwürdigkeit |
| `CONTENT_ISA_PREDICATE` | `ist_ein`(Inhalt) | Domänen-BFS (trust-unabhängig) |

**Determinismus-Vertrag (§4-normativ):**
1. **`floordiv(n,d)` = Floor Richtung −∞** (Node `Math.floor(n/d)`; PHP eigener `floordiv`, **`intdiv` für Negative VERBOTEN**). `floor` immer **innerhalb** der Division.
2. **Iterationsordnung:** alle Schleifen/Fixpunkte über `node_id` aufsteigend; Ausgänge in Eingangsreihenfolge, Tie-Break `triple_hash` aufsteigend.
3. **PPR-Fixpunkt:** Abbruch `Δ ≤ PROP_TOL` ODER `iter = PROP_MAX_ITER`; Tie → `node_id` aufsteigend.
4. **Keine Float-Pfade.**

## 4. Algorithmus (deterministischer Kern)

```
floordiv(n,d) = Math.floor(n/d)            # Richtung −∞, byte-identisch Node↔PHP
clamp(x,lo,hi) = max(lo, min(hi, x))

# ---------- A0: Domäne bestimmen (UC-CS-11) — V2: trust-UNABHÄNGIG, strukturell, Single-Primary ----------
domainOf(triple):
    n = primaryContentNode(triple)                         # Subjekt-Inhalts-Knoten
    roots = topmostAncestors(n, via=CONTENT_ISA_PREDICATE) # NUR Inhalts-ist_ein, KEINE Provenienz, KEIN Trust
    return min(roots) by node_id                           # genau EINE primäre Domäne (alphanum. Tie-Break)

# ---------- A1: Score + Band (UC-CS-01) ----------
score(N,D):
    if cred_pinned[N] != null: return cred_pinned[N]
    if cred_outcomes[N,D] < MIN_OUTCOMES:                  # Cold-Start-Bootstrap (V1)
        boot = blend( TIER_BASELINE[source_tier(N)], effectivePrior(N,D) )   # provenienz-diversitäts-informiert
        return min(boot, COLD_DOMAIN_CAP)                  # daten-arme Domäne nie über `unbestätigt`
    return floordiv( 1000 * cred_alpha[N,D], cred_alpha[N,D] + cred_beta[N,D] )
band(s): first BANDS-Schwelle > s → {misstrauisch<200,skeptisch<400,unbestätigt<600,plausibel<800,vertrauenswürdig≥800}

# ---------- A2: Update (UC-CS-02) ----------
applyAdjudication(N, D, outcomes):                         # outcomes nur aus UC-CS-08 (anker-gebunden)
    if cred_pinned[N] != null: return
    s0 = score(N,D); dA = dB = 0
    for o in outcomes (Eingangsreihenfolge):
        w = 1000
        if not o.corroborated:
            if o.overconfident: w = floordiv(w*CALIB_OVERCONF,1000)   # ×2
            w = floordiv(w*surprise(s0),1000)                         # etablierte sinken schneller
            dB += w
        else: dA += w
    cred_alpha[N,D]+=dA; cred_beta[N,D]+=dB; cred_outcomes[N,D]+=len(outcomes); audit(...)
    velocityLimit(N,D,s0)                                  # asymmetrisch
surprise(s): clamp( 1000 + floordiv(SURPRISE_SLOPE*(s-500),500), 1000, SURPRISE_MAX )

# ---------- A3: Velocity-Limiter ASYMMETRISCH (UC-CS-05) ----------
velocityLimit(N,D,s0):
    delta = score(N,D) - s0
    if delta <= 0: return                                  # STRAFEN bypassen (sofort voll, fail-closed nach unten)
    if delta > VELOCITY_CAP: excess=delta-VELOCITY_CAP; rollback(N,D,excess); cred_pending[N,D]+=excess  # held

# ---------- A4: Reversion (UC-CS-04) — F-1 korrigiert, F-5 paritätssicher ----------
revert(N,D):                                               # je Decay-Epoche; gated übersprungen
    lam = clamp( LAM_MIN + floordiv((LAM_MAX-LAM_MIN)*score(N,D),1000), 0, 1000 )   # hoher Score → großes lam → langsam
    cred_alpha[N,D] = floordiv( lam*cred_alpha[N,D] + (1000-lam)*ALPHA0, 1000 )     # /1000 INNERHALB floordiv
    cred_beta[N,D]  = floordiv( lam*cred_beta[N,D]  + (1000-lam)*BETA0,  1000 )

# ---------- A5: Propagation (UC-CS-03) — F-3 korrigiert ----------
normVariance(scores): rawVar=floordiv(Σ(sᵢ-mean)²,n); clamp( floordiv(rawVar*1000,250000),0,1000 )
indepFactor(C): floordiv( min(independentRoots(C),INDEP_CAP)*1000, INDEP_CAP )      # F-3: Mitglieder-Unabhängigkeit
poolStrength(C): base=floordiv(PROP_DAMPING*(1000-normVariance(scores(members(C)))),1000); floordiv(base*indepFactor(C),1000)
precisionWeightedCombine(contribs, own): num=Σwᵢ*xᵢ+BLEND_W*ownScore; den=Σwᵢ+BLEND_W*ownPrecision; floordiv(num,den)
provenanceAncestors(N): BFS über PROVENANCE_PREDICATES, ≤PROP_MAX_HOPS, node_id-Ordnung
blend(base,prior): floordiv( base*BLEND_W + prior*(1000-BLEND_W), 1000 )
effectivePrior(N,D): precisionWeightedCombine([(score(C,D),poolStrength(C)) for C in provenanceAncestors(N)], own=(α,β))

# ---------- A6: Eingangs-Prior (UC-CS-07) ----------
entryPrior(fact,D):
    base={human_added:PRIOR_HUMAN_MEAN, anonymous:PRIOR_MEAN, self:PINNED_HIGH}[cred_intro]
    return blend(base, effectivePrior(provenanceNodes(fact),D))

# ---------- A7: Adjudizieren (UC-CS-08) — F-4 anker-gebunden; V3 drei-wertige Kohärenz ----------
coheres_with_gated_anchor(v):                              # V3: Korrespondenz (KEINE Lineage), drei-wertig
    A = gated/authoritative Assertionen auf (subject(v),predicate(v)) IN domainOf(v)   # strukturell: gleiches (S,P) + Domänen-Match
    if A leer: return 'not-applicable'                     # Open-World: nicht abgedeckt ≠ falsch
    if isNumeric(predicate(v)):
        return |value(v)-value(A)|*1000 <= NUMERIC_TOLERANCE*|value(A)| ? 'corroborated' : 'contradicted'   # ±Toleranzband
    else:
        return object(v)==object(A) ? 'corroborated' : 'contradicted'                  # symbolisch strikt
adjudicate(triple):                                        # → {corroborated,overconfident} ODER null
    if humanEndorsed(triple): return outcome(human)                                    # Pfad (b)
    c = coheres_with_gated_anchor(triple)                                              # Pfad (a)
    if c in {'corroborated','contradicted'}: return outcome(c)
    if corroboratedByIndependentRoots(triple) AND anyRootIsAnchor(triple): return outcome  # Pfad (c)
    return null                                            # rein gelernte Knoten adjudizieren NIE (Zirkularität geschnitten)
```

**Anti-Echo-Kammer:** Korroboration zählt unabhängige Wurzeln; nur über denselben Knoten/Single-Bridge korrelierte zählen als eine.

## 5. Use Cases

### UC-CS-01: Glaubwürdigkeits-Score + Band ableiten (intern)
**Akteur:** System · **Verhalten:** 1. `cred_pinned` → gated-Wert. 2. `cred_outcomes<MIN_OUTCOMES` → Cold-Start-Bootstrap (provenienz-informiert, `COLD_DOMAIN_CAP`-gedeckelt). 3. sonst `floordiv(1000·α/(α+β))` für **diese Domäne**. 4. 5-Band projizieren; Roh-Score bleibt intern.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Knoten unbekannt | `PRIOR_MEAN` (skeptisch) |
| Domäne unbekannt | eigener Prior je Domäne (keine Cross-Domain-Aggregation) |
| Egress-Versuch der Roh-Zahl | abgelehnt; nur Band |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-1.1 | Frischer Knoten (3000/7000 Milli) → exakt 300‰ | Unit | cred::score::prior | offen |
| AC-1.2 | Score byte-identisch über zwei Neustarts | Unit | cred::determinism | offen |
| AC-1.3 | `cred_pinned` überschreibt exakt | Unit | cred::score::pinned | offen |
| AC-1.4 | Cold-Start (`outcomes<8`) nie über `COLD_DOMAIN_CAP` (600) | Unit | cred::degrade | offen |
| AC-1.5 | Band-Grenzen: 199→misstrauisch,200→skeptisch,799→plausibel,800→vertrauenswürdig | Unit | cred::bands | offen |
| AC-1.6 | Nur das Band ist egress-fähig; Roh-Zahl verlässt den Knoten nie | Integration | cred::egress | offen |
| AC-1.7 | Reine `floordiv`-Integer (kein Float) | Unit | cred::integer | offen |

### UC-CS-02: Score-Update bei adjudiziertem Ausgang (pro Domäne)
**Akteur:** System · **Verhalten:** 1. Ausgang nur aus UC-CS-08. 2. Domäne via UC-CS-11; nur `(N,D)`. 3. widerlegt+überconfident → ×2; widerlegt → ×surprise. 4. Bilanz+`cred_outcomes`+`audit()`. 5. asymmetrischer Limiter.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Quelle gated | kein Update |
| Ausgang nicht adjudiziert | abgelehnt |
| Herausforderer ohne Belege | Update am Herausforderer (Beweislast) |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-2.1 | `s=0,5` hebt 360‰-Quelle, senkt 790‰-Quelle | Unit | cred::update::expectation | offen |
| AC-2.2 | Überconfident-widerlegt kostet doppelt β | Unit | cred::update::calib | offen |
| AC-2.3 | Patzer bei 800 kostet mehr als bei 300 | Unit | cred::update::surprise | offen |
| AC-2.4 | Ohne UC-CS-08-Adjudikation kein Update | Unit | cred::update::gate | offen |
| AC-2.5 | Update wirkt nur auf `(N,D)`, nie `(N,D')` (Domänen-Isolation) | Unit | cred::update::domain | offen |
| AC-2.6 | Bilanz gespeichert, Score abgeleitet | Unit | cred::update::ledger | offen |
| AC-2.7 | DoS-Cap 1000 Ausgänge/Aufruf | Unit | cred::update::cap | offen |

### UC-CS-03: Kategoriale Propagation (varianz- UND unabhängigkeits-gated)
**Akteur:** System (Batch) · **Verhalten:** 1. Provenienz-Subgraph je Domäne. 2. `poolStrength` aus niedriger Varianz UND hoher Unabhängigkeit. 3. deterministische PPR. 4. eigene Evidenz dominiert (Shrinkage).
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Inhalts-Prädikat | ausgeschlossen (kein Sippenhaft) |
| Zyklus | Iter-Cap terminiert |
| konsistente Single-Bridge-Sybil-Kategorie | `indepFactor≈0` → `poolStrength≈0` |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-3.1 | N identisch-gescorte Knoten gleicher Single-Bridge-Provenienz → `poolStrength≈0` (nicht max) | Integration | cred::prop::sybil | offen |
| AC-3.2 | niedrige Varianz UND hohe Unabhängigkeit → stark; hohe Varianz (BMW≠Fiat) → schwach | Integration | cred::prop::variance | offen |
| AC-3.3 | FAZ in „Print" arbeitet sich via eigener Evidenz heraus | Integration | cred::prop::shrinkage | offen |
| AC-3.4 | nur `PROVENANCE_PREDICATES` propagieren | Unit | cred::prop::role | offen |
| AC-3.5 | byte-identisch über Neustart | Integration | cred::prop::determinism | offen |
| AC-3.6 | DoS-Cap: Subgraph ≤ K, `iter ≤ PROP_MAX_ITER` | Unit | cred::prop::cap | offen |

### UC-CS-04: Trust-abhängige Recency (Reversion) — F-1 korrigiert
**Akteur:** System (je Epoche) · **Verhalten:** 1. `lam` steigt mit Score (hoch → langsam verblassen). 2. Reversion (Division innerhalb `floordiv`). 3. gated übersprungen. 4. unbestätigtes `cred_pending` revertiert.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| stille Hoch-Trust-Quelle | langsame Drift (Sleeper-Rest-Risiko) |
| negativer Numerator | `floordiv` Richtung −∞ |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-4.1 | Epochen(850→Prior) > Epochen(400→Prior) — numerisch | Unit | cred::revert::trustdep | offen |
| AC-4.2 | stille Quelle driftet zum Prior (300), steigt NICHT durchs Altern | Unit | cred::revert::dormant | offen |
| AC-4.3 | Reversion `floordiv`, Division innerhalb floor, byte-identisch Node↔PHP | Unit | cred::revert::parity | offen |
| AC-4.4 | 800‰-Quelle: längere Tripel-Halbwertszeit als 200‰ | Integration | cred::retention | offen |
| AC-4.5 | gated reverten nicht | Unit | cred::revert::pinned | offen |

### UC-CS-05: Velocity-Limiter ASYMMETRISCH (F-2)
**Akteur:** System · **Verhalten:** 1. `delta≤0` (Strafe) → sofort voll, Filter umgangen. 2. `delta>CAP` (Aufstieg) → nur CAP, Rest `held`. 3. `held` → `released` bei unabhängiger Bestätigung, sonst `reverted`.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Streit-Schwall (Aufstieg) | Großteil `held` |
| widerlegte Lüge (Abstieg) | sofort voll |
| pending nie bestätigt | revertiert |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-5.1 | Aufstiegs-Sprung > CAP gekappt; Rest `held` | Unit | cred::velocity::cap | offen |
| AC-5.2 | Strafe (negatives Delta) bypasst den Cap, sofort voll | Unit | cred::velocity::asymmetry | offen |
| AC-5.3 | `held` nur bei unabhängiger Bestätigung `released`, sonst `reverted` | Unit | cred::velocity::lifecycle | offen |
| AC-5.4 | deterministisch | Unit | cred::velocity::determinism | offen |

### UC-CS-06: Graceful Degradation, Cold-Start-Bootstrap & Tier-Mapping (V1)
**Akteur:** System · **Verhalten:** 1. `cred_outcomes<MIN_OUTCOMES` → Cold-Start-Bootstrap: `min(blend(TIER_BASELINE, effectivePrior), COLD_DOMAIN_CAP)`. 2. gated Knoten gepinnt (nur UC-CS-09). 3. Knoten-Zuweisung gated (Selbst-Anheften abgelehnt). 4. **Absoluter** Floor (kein dynamischer/aktivitäts-relativer Floor — gameable, abgelehnt §10).
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Knoten ohne Track-Record | provenienz-informierter Bootstrap, gedeckelt |
| unbekannter `source_tier` | Default `web` (300) |
| Entpinnen ohne Mensch-Akt | abgelehnt |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-6.1 | Cold-Start nie über `COLD_DOMAIN_CAP`, provenienz-informiert | Integration | cred::degrade::bootstrap | offen |
| AC-6.2 | `Gesetz`-Knoten behält gepinnten Ruf trotz Web-Mehrheit | Integration | cred::gated::law | offen |
| AC-6.3 | Selbst-Anheften gated Tag durch limited-Quelle abgelehnt | Unit | cred::gated::spoof | offen |
| AC-6.4 | Floor ist absolut (`MIN_OUTCOMES`), nicht aktivitäts-relativ | Unit | cred::degrade::floor | offen |

### UC-CS-07: Eingangs-Glaubwürdigkeits-Prior (pro Domäne)
**Akteur:** System (Ingest) · **Verhalten:** 1. Basis-Prior aus `cred_intro`. 2. Domäne via UC-CS-11; `effectivePrior(…,D)` mischen. 3. speist Faktor 1 der Eingangs-Matrix → `nicht gesichert`+Tendenz.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Fakt ohne Provenienz-Knoten | reiner Einführungs-Prior |
| `cred_intro` fehlt | Default `anonymous` (300) |
| Provenienz daten-arm | Prior nahe Bootstrap |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-7.1 | `human_added`→500, `anonymous`→300 | Unit | cred::entry::intro | offen |
| AC-7.2 | neuer Bild-Artikel erbt `Presseartikel`-Prior **der Domäne** | Integration | cred::entry::inherit | offen |
| AC-7.3 | Eingang erzeugt nie wahr/falsch, nur Tendenz | Integration | cred::entry::open-world | offen |

### UC-CS-08: Ausgang adjudizieren (anker-gebunden, drei-wertig) — F-4 / V3
**Akteur:** System (+ Mensch Pfad b) · **Verhalten:** 1. Pfad (b) Mensch-Endorsement → adjudiziert. 2. Pfad (a) `coheres_with_gated_anchor` → drei-wertig (corroborated/contradicted/**not-applicable**); numerisch Toleranzband, symbolisch strikt; Strukturprüfung = gated Assertion auf **gleichem (S,P) + Domäne** (KEINE Lineage). 3. Pfad (c) unabhängige Korroboration MIT ≥1 gated/Mensch-Anker. 4. sonst `null`. **Rein gelernte Knoten adjudizieren NIE.** 5. `overconfident` = assertorischer Modus / Konfidenz ≥ Schwelle.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| zwei rein-gelernte bestätigen sich | `null` — keine Eskalation über `plausibel` |
| `not-applicable` (kein gated Anker auf S,P) | `null`, Pfad b/c versuchen (Open-World, nicht Strafe) |
| Korroboration nur Single-Bridge | 1 Wurzel → kein Quorum |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-8.1 | zwei rein-gelernte Knoten nicht über Band `plausibel` adjudizierbar | Integration | cred::adj::circular | offen |
| AC-8.2 | Mensch-Endorsement adjudiziert deterministisch + auditiert | Unit | cred::adj::human | offen |
| AC-8.3 | Kohärenz drei-wertig: kein gated Anker auf (S,P) → `not-applicable` → `null` (kein Strafe, Open-World) | Unit | cred::adj::openworld | offen |
| AC-8.4 | numerisch: 180,2 bei Anker 180 ±1% → corroborated; symbolisch: ≠ → contradicted | Unit | cred::adj::tolerance | offen |
| AC-8.5 | Pfad (c) verlangt ≥1 gated/Mensch-Anker UND unabhängige Wurzeln | Integration | cred::adj::anchor | offen |

### UC-CS-09: Gated-Knoten pinnen/entpinnen (Mensch-Akt)
**Akteur:** **Mensch** · **Route:** Mensch-Aktion · **Verhalten:** 1. Mensch pinnt Provenienz-Knoten auf ‰-Ruf. 2. Berechtigungs-Check + Audit-Log. 3. Entpinnen nur per erneutem Akt.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Nicht-Mensch pinnt | abgelehnt |
| Pin ohne Berechtigung | 403-Äquiv., Audit |
| Entpinnen ohne Akt | abgelehnt |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-9.1 | nur Mensch-Akt setzt/löscht `cred_pinned` | Unit | cred::pin::human | offen |
| AC-9.2 | jeder Pin/Unpin → Audit-Log-Eintrag | Unit | cred::pin::audit | offen |
| AC-9.3 | System ändert gated Ruf nie autonom (auch nicht durch Evidenz) | Integration | cred::pin::immutable | offen |

### UC-CS-10: Adjudikations-Audit-Log
**Akteur:** System · **Verhalten:** 1. jede Bilanz-Änderung + Pin schreibt `{ts,node,domain,dAlpha,dBeta,adjudicator,outcome_ref}`. 2. append-only. 3. lokal, auditierbar.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| Log-Schreibfehler | Update fail-closed |
| nachträgliche Mutation | verboten |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-10.1 | jedes Update + Pin → genau ein append-only Eintrag | Unit | cred::audit::append | offen |
| AC-10.2 | Update ohne Audit-Eintrag wird zurückgerollt (fail-closed) | Unit | cred::audit::failclosed | offen |
| AC-10.3 | Eintrag enthält Adjudikator-Pfad (a/b/c) | Unit | cred::audit::provenance | offen |

### UC-CS-11: Domäne eines Tripels bestimmen — V2 (trust-unabhängig, Single-Primary)
**Akteur:** System · **Verhalten:** 1. primären Inhalts-Knoten des Tripels nehmen. 2. oberste(n) `ist_ein`-Vorfahr(en) über **Inhalts**-Kanten (NICHT Provenienz, **KEIN** Trust). 3. bei mehreren Wurzeln **alphanumerischer Tie-Break** über `node_id` → **genau eine** primäre Domäne. 4. Ergebnis ist **statisch-strukturell** und damit angreifer-unverschiebbar.
**Fehlerfälle**
| Fall | Verhalten |
|---|---|
| kein `ist_ein`-Vorfahr | Knoten selbst = Domäne (Default) |
| mehrere gleichrangige Wurzeln | alphanumerischer Tie-Break (eine primäre) |
| Zyklus im Inhalts-`ist_ein` | BFS mit Visited-Set terminiert |

| # | Kriterium | Test-Typ | Test-Klasse | Status |
|---|---|---|---|---|
| AC-11.1 | Domäne ist deterministisch + byte-identisch über Neustart | Unit | cred::domain::determinism | offen |
| AC-11.2 | Domänen-Zuordnung ist **trust-unabhängig** (Trust-Änderung verschiebt die Domäne nicht) | Unit | cred::domain::trustfree | offen |
| AC-11.3 | mehrere Top-Wurzeln → **genau eine** primäre via Tie-Break (Single-Primary) | Unit | cred::domain::single | offen |
| AC-11.4 | nur Inhalts-`ist_ein`, keine Provenienz-Kanten | Unit | cred::domain::content | offen |

## 6. Sicherheit & Bedrohungsanalyse (§33.4)

**Data-Flow:** Adjudikator (UC-CS-08, anker-gebunden) → `applyAdjudication` (pro Domäne via UC-CS-11) → Beta-Bilanz (lokal) → nur 5-Band-Egress on-demand.

| Bedrohung | Szenario | Gegenmaßnahme (AC) |
|---|---|---|
| **Spoofing** | gated Tag selbst behaupten | AC-6.3 + AC-9.1 |
| **Farming (Low-and-Slow)** | Nebenthema-Wahrheiten farmen, dann Lüge | **Domänen-Trennung** AC-2.5 + AC-11.2 (trust-unabhängige Domäne, nicht verschiebbar) + AC-8.1 |
| **Tag-Poisoning** | konsistente Sybil-Kategorie | AC-3.1 (Varianz UND Unabhängigkeit) |
| **Repudiation** | Streit über Trust-Änderung | AC-10.1/10.3 |
| **Info-Disclosure** | Score sehen, um Schwellen zu optimieren | AC-1.6 (nur Band egress) |
| **DoS** | Update-/Propagations-Flut | AC-2.7, AC-3.6 |
| **Elevation** | low→hoch ohne Anker | AC-8.1/8.5 + AC-5.1 |
| **Open-World-Verletzung** | „nicht abgedeckt" → falsch behandeln | AC-8.3 (drei-wertig, `not-applicable`→null, keine Strafe) |
| **Parität-Bruch** | Float/Negativ-Division Node≠PHP | AC-4.3/1.7 (`floordiv`) |

**Lethal-Trifecta (§33.1):** kein Egress (nur Band), keine privilegierten Tool-Calls → keine Exposition.
**Rest-Risiko (akzeptiert §10.4):** (1) konsistente unwidersprochene Lüge unentdeckbar (Tarski). (2) Sleeper bleibt hoch bis Handeln. (3) **Sybil allgemein NICHT gelöst** (eigene Achse MeritRank) — dieses Konzept begrenzt nur den Gewinn (Anker + Domäne + Unabhängigkeit). (4) Daten-Hunger durch Domänen-Trennung (V1) — bewusster Preis für Resilienz.
**Adversarial-Reserve:** 🔴 — Re-Audit auf v0.3 (Anker-Umgehung UC-CS-08, Domänen-Leak UC-CS-11).

## 7. Glossar (§14)

| Begriff | Anker | Definition |
|---|---|---|
| **Glaubwürdigkeit** | credibility-lens | interne propagierende Lese-Linse; Evidenz-Gewicht |
| **Domäne** | domainOf (UC-CS-11) | trust-unabhängige, strukturelle, Single-Primary Top-`ist_ein`-Kategorie; Trust-Isolation |
| **Adjudikation** | adjudicate (UC-CS-08) | anker-gebundenes, drei-wertiges Wahrheitssignal |
| **Kohärenz-Check** | coheres_with_gated_anchor | Inhalts-Korrespondenz (kein Lineage); numerisch Toleranzband / symbolisch strikt |
| **gated Knoten** | pinned | gepinnter, akt-änderbarer Ruf |
| **unabhängige Wurzel** | independentRoots | DAG-disjunkte Provenienz; Single-Bridge = 1 |
| **Surprise / Partial Pooling** | surprise / precisionWeightedCombine | Fehler-bei-Hoch-Stand / Kategorie-Prior vs. eigene Evidenz |
| **Velocity-Limiter** | asymmetric | deckelt nur Aufstieg; Strafen bypassen |
| **Cold-Start-Bootstrap** | UC-CS-06 | daten-arme Domäne: provenienz-informiert, `COLD_DOMAIN_CAP`-gedeckelt |
| **`floordiv`** | determinism | Floor Richtung −∞; `intdiv` für Negative verboten |

## 8. Verantwortungs-Matrix (§23.1)

| Aufgabe | KI (Claude) | Mensch (Stefan) |
|---|---|---|
| Algorithmus-/Konzept-Entwurf | ✅ Entwurf | ✅ Endorsement + Verantwortung |
| Konstanten (k,λ,Caps,Bänder,Toleranz,`TIER_BASELINE`) | Vorschlag | **Entscheidung** |
| gated-Knoten-Liste + Pin/Unpin | Vorschlag | **Akt (UC-CS-09)** |
| Adjudikations-Endorsement (Pfad b, Constraint #4) | nie auto | **Pflicht** |
| Domänen-Ontologie (`ist_ein`-Struktur) | Vorschlag | **Endorsement** |
| externe-KI-Übernahme (Gemini) | filtern + Ledger §10 | Freigabe |
| 🔴-Slice Merge | adversarial-auditor-Lauf | Freigabe |

## 9. Offene Punkte & Vorbedingungen (§10.4)

- **V1 — gelöst:** absoluter `MIN_OUTCOMES`-Floor pro Domäne + Cold-Start-Bootstrap mit `COLD_DOMAIN_CAP`; dynamischer Floor abgelehnt (§10). *Restbedingung:* genug adjudizierte Daten **pro Domäne** (Daten-Hunger). **Erste Empirie-Frage vor Code.**
- **V2 — gelöst:** Domäne = trust-unabhängiger struktureller Top-Ancestor-BFS, Single-Primary (UC-CS-11). *Offen:* Dominator-Baum (Lengauer-Tarjan) als rigoroser Fallback nur falls Top-Ancestor mehrdeutig wird.
- **V3 — gelöst:** drei-wertige Kohärenz, numerische Toleranzbänder / symbolisch strikt, Korrespondenz statt Lineage. *Offen:* präzise `value(A)`-Extraktion pro Prädikat-Typ.
- **V4:** Konstanten-Tuning (k, `LAM_MIN/MAX`, `VELOCITY_CAP`, `BANDS`, `TIER_BASELINE`, `NUMERIC_TOLERANCE`, `COLD_DOMAIN_CAP`, `BLEND_W`, `INDEP_CAP`).
- **V5:** Integration als `§J` in die Haupt-`KONZEPT.md` nach dem defeasible-Entrenchment-ADR.
- **F-6-Recheck:** Wissens-Retention-Kopplung (AC-4.4) nach Trust-Fixes adversarial re-prüfen.
- **Reife:** Re-`adversarial-auditor` auf v0.3 + `konzept-reviewer`; Status `evaluated_pending` bis Endorsement.

## 10. Externe-KI-Quellen-Ledger (§I.5-NB1 / „Pushback erwünscht")

Gemini-Input (2026-06-01) zu V1/V2/V3 — als Startmaterial behandelt, gefiltert:

| Vorschlag | Entscheidung | Begründung |
|---|---|---|
| V2 Wurzel-basierte Reichweite über `ist_ein` | ✅ übernommen | deckt sich mit Entwurf; deterministisch |
| V2 `argmax Score(W→v)` mit **trust-gewichteten** Pfaden | ❌ **abgelehnt** | macht Domänengrenze **trust-abhängig → Angreifer verschiebt Domänen** → Anti-Farming korrumpiert. Partition muss statisch-strukturell sein |
| V2 Min-Cut/Max-Flow | ❌ abgelehnt | falsches Problem (Sybil-Isolation = MeritRank-Achse), nicht Themen-Domäne |
| V2 Dominator-Baum | ⚠️ deferred | rigoroser Fallback, für v0.3 unnötig (Top-Ancestor reicht) |
| V2 Single-Primary | ✅ übernommen | Multi-Membership öffnet Cross-Domain-Farming |
| V3 3-Dim-Binärprüfung + Werte-Subsumtion + Domänen-Match | ✅ übernommen | deterministisch; Conceptual-Spaces-tauglich |
| V3 `Path(A→v)` (Lineage) | ❌ abgelehnt | verwechselt Provenienz-Abstammung mit Inhalts-Korrespondenz → ersetzt durch „gated Assertion auf gleichem (S,P)" |
| V3 „Fail → Strafe" | ❌ abgelehnt | verletzt Open-World/Tarski → drei-wertig (`not-applicable`→null) |
| V3 numerische Toleranzbänder | ✅ übernommen | sonst erstickt das System im Mess-Rauschen |
| V1 Cold-Start-Bootstrap (provenienz-informiert, gedeckelt) | ✅ übernommen | verfeinert Graceful Degradation |
| V1 dynamischer, aktivitäts-relativer Floor | ❌ **abgelehnt** | „Activity" angreifer-beeinflussbar → gameable; absoluter Floor + Beta-Varianz reichen |
