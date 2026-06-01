# Handoff: Credibility-Scoring (CDP5 §28.4)

> **Übergabe-Dokument** für die Fortsetzung des Glaubwürdigkeits-Scoring-Strangs. Stand 2026-06-01. Self-contained: was steht, was blockiert, wo weitermachen.
>
> **Verhältnis zum Entrenchment-Strang:** Dieses Scoring liefert das **Trust-/Glaubwürdigkeits-Substrat** für die ADR „Belief von terminaler Autorität → defeasible Entrenchment" (die der andere Strang fährt). Reihenfolge bleibt: **(1) Entrenchment-ADR → (2) dieses Scoring → (3) Modus-Achse (`assertion_mode`/Welten).** Voller Modell-Hintergrund: `07-Bruecke-zu-Defeasible-Entrenchment.md`; offene Grundsatz-Entscheidungen: `08-Offene-Punkte-zum-Entscheiden.md`.

## TL;DR
Es gibt ein CDP5-Konzept **`nsai-edge/KONZEPT-credibility-scoring.md` (v0.3, konzept-lint 10/10, 11 UCs)**. Zwei Review-Runden durchlaufen. **Der deterministische Kern ist solide; die adversariale Sicherheit der *gelernten* Schicht ist es nicht** — und das ist eine Architektur-Entscheidung, kein Patch. **Blockiert auf einer Stefan-Entscheidung (A/B/Hybrid, siehe unten).**

## ✅ Entscheidung getroffen: A — MeritRank integrieren (Stefan, 2026-06-01)

**Begründung:** „Wir entwickeln eh erst alles und gehen dann live" → die Abhängigkeit auf den C3-MeritRank-Slice ist kein Blocker; gebaut wird die adversarial-saubere Voll-Architektur (A), nicht die herunterskalierte B-Variante.

Hintergrund — das Re-Audit (v0.3) zeigte: alle Sicherheitsmechanismen der gelernten Schicht (Varianz-Gate, Korroborations-Quorum, Domänen-Trennung) ruhen auf `independentRoots` = „DAG-disjunkte Provenienz". Das ist **vom Angreifer beim Ingest baubar** → keine Sybil-Resistenz → zirkuläre Vorbedingung (§32.8(7)). **Strukturell ≠ unmanipulierbar, solange der Angreifer den Ingest-Graphen baut.**

→ Sybil-Resistenz ist **Voraussetzung, nicht Beiwerk**. Drei Wege:

| Option | Inhalt | Konsequenz |
|---|---|---|
| **A** | MeritRank (C3) integrieren → `independentRoots` Sybil-resistent (Connectivity-Decay) | adversarial-sound, aber Scoring **hängt am C3-Slice** |
| **B** | herunterskalieren: nur **gated Anker + Mensch** sind sicherheitsrelevant; Pfad (c) sperren; Domäne/Struktur nur aus **endorseter Ontologie**; gelernte Propagation = **etikettierter, nicht-adversarialer Ranking-Hinweis** | sofort sicher, kleiner Scope |
| **Hybrid** *(Empfehlung)* | **B jetzt** (verteidigbarer Kern) **+ A als Roadmap** (gelernte Schicht bekommt Zähne, wenn C3 landet) | löst N-1/N-3/N-4/N-6 in einem Schnitt |

**Konsequenz von A:** `independentRoots` wird über MeritRank (C3) Sybil-resistent (Connectivity-/Transitivity-Decay, **Seed = die exogenen gated/Mensch-Anker**). Dadurch koppelt dieser Slice an **C3-MeritRank** (selbst noch `evaluated_pending`, §I.3-C3) — beide müssen co-designt werden, `independentRoots` ist die geteilte Schnittstelle. Der Seed (gated/Mensch) wird tragend (Decentralized-Reputation-Trilemma: MeritRank opfert Seed-Unabhängigkeit für Sybil-Toleranz — passt zur „exogener Anker"-Linie aus 07/08).

## Was steht (verteidigbar)
- **Modell (07):** Glaubwürdigkeit = interne, deterministische Lese-Linse über gewöhnlichen Knoten; Beta-Bilanz `(α,β)` → Score `floordiv(1000·α/(α+β))`; skeptischer Prior Beta(3,7)=300‰; 5 Bänder; trust-abhängige Recency; Kalibrierungs- + Surprise-Gewicht; Propagation über `ist_ein` (Partial Pooling); Domänen-Trennung; anker-gebundene Adjudikation.
- **Mechanik-Fixe HALTEN (empirisch belegt im Re-Audit):** **F-1** (Reversion-Vorzeichen, hoher Score → langsam verblassen), **F-2** (asymmetrischer Limiter: Strafen bypassen den Cap), **F-4** (Egress nur 5 Bänder, gated/Mensch-Adjudikation, gelernte Knoten adjudizieren nie), **F-5** (`floordiv` Richtung −∞, Division in floor, Node↔PHP-Parität inkl. negativer Numeratoren).
- **Lint:** struktureller Teil-Score 10/10, alle 11 UCs mit binären AC + Fehlerfällen. Test-Skelette via `ac-to-test-scaffold` ableitbar (32+ AC).

## Review-Historie
| Runde | Gate | Ergebnis |
|---|---|---|
| v0.1 | konzept-lint | 10/10 (nach AC-ID-/Scope-Fix) |
| v0.1 | konzept-reviewer (a) | **6,4/10** — Kern unter-spezifiziert (L1 Black-Box-Formeln, L2 Determinismus, L3 Skala), 3 fehlende UCs (Adjudizieren, pin/unpin, Audit-Log) |
| v0.1 | adversarial-auditor (b) | **NEIN** — F-1 (Vorzeichen), F-2 (Velocity-Achse), F-3 (Varianz-Gate gegen Sybils invertiert), F-4 (zirkulärer Adjudikator), F-5 (Float/Parität) |
| v0.2 | Fixe | F-1/F-2/F-3/F-4/F-5 + L1/L8/L9/L10 + UC-08/09/10 |
| v0.3 | V1/V2/V3 + Gemini-Ledger (§10) | Domäne trust-unabh. Single-Primary (UC-11); Kohärenz drei-wertig + numer. Toleranz; absoluter Floor + Cold-Start-Cap |
| v0.3 | adversarial-auditor (Re-Audit) | **NEIN** — Mechanik hält, aber neue 🔴: ingest-manipulierbare Struktur (siehe Funde) |

## Offene Funde → v0.4-Arbeitsliste
**A-Kern (löst F-3/N-3):**
- **F-3/N-3 🔴 → A:** `independentRoots` über einen **MeritRank-gewichteten Walk** neu definieren (Seed = gated/Mensch-Anker; **Connectivity-Decay** dämpft N Sybil-Wurzeln hinter *einer* Brücke auf ~1; **Transitivity-Decay** dämpft mit Distanz zum Seed). Damit ist `independentRoots` nicht mehr ingest-fälschbar → Varianz-Gate + Quorum tragen, **Pfad (c) wieder sicher freischaltbar** (Anker muss zusätzlich die strittige (S,P,O) corroborieren). Geteilte Schnittstelle zum C3-Slice.

**Auch unter A nötig (A subsumiert das NICHT — Korrektur der früheren Gruppierung):**
- **N-1 🔴** `domainOf` ingest-manipulierbar über Inhalts-`ist_ein` — MeritRank betrifft den *Provenienz-Trust*-Graphen, **nicht die Inhalts-Ontologie**. Bleibt nötig: `domainOf` nutzt nur **gated/endorsete** Inhalts-`ist_ein`; ingest-neue Kanten → Default-Domäne `unzugeordnet`. (AC-11.5)
- **N-4 🟡** `source_tier` **nicht selbst-behauptbar** (Default web bis Endorsement); `COLD_DOMAIN_CAP` → 500 (nie an die `plausibel`-Schwelle).
- **N-6 🟡** Domänen-Erzeugung gated (ingest-frei → gemeinsame `unzugeordnet`-Sammeldomäne); Liveness-AC.

**Gabel-unabhängig (sofort, reine Mechanik):**
- **N-2 🔴** V3-Toleranzband bricht den Float-Vertrag (`value()` nirgends als Integer spezifiziert; AC-8.4-Beispiel „180,2" ist Float + testet die Grenze nicht). Fix: `value()` als **Fixed-Point-Integer (Milli) pro Prädikat-Typ**; Toleranz integer-only; AC-8.4 mit echtem Grenzwert (181,8→corrob., 181,9→contra.) + `anchor=0`-Sonderfall; Node↔PHP-Grenzwert-AC.
- **N-5 🟡** Audit-Log-Lücke: `velocityLimit`/`rollback` mutieren die Bilanz **nach** dem Audit-Eintrag ohne eigenen Eintrag. Fix: velocity/rollback/release/revert schreiben je einen Eintrag; **Δ-Konservierung** (Bilanz = Σ Audit-Deltas). (AC-10.4)
- **§3.0** Verhalten-Schritte aller UCs nummerieren (in v0.3 inline gepackt → Lint-Warnung „Schritte nicht nummeriert", kein Gate-Fail, aber §3.0-Pflicht).
- **V4** Konstanten-Tuning (k, `LAM_MIN/MAX`, `VELOCITY_CAP`, `BANDS`, `TIER_BASELINE`, `NUMERIC_TOLERANCE`, `COLD_DOMAIN_CAP`, `BLEND_W`, `INDEP_CAP`) — Stefan-Entscheidung.

## Kern-Lehre (für jede ingest-getriebene Trust-Mechanik)
**Sybil-Resistenz ist Voraussetzung, nicht Beiwerk.** Jede Sicherheitseigenschaft, die auf graph-struktureller Eigenschaft ruht (Domäne, unabhängige Wurzeln, Provenienz-Diversität), ist wertlos, solange der Angreifer die Struktur beim Ingest baut. Adversariale Garantien gibt es nur an **exogenen Ankern** (gated/institutionell, Mensch-Endorsement) oder über die **Identitäts-/Kosten-Achse (MeritRank)** — nie aus der gelernten Schicht allein. Das deckt sich mit dem Entrenchment-Befund (07/08): der Mensch / `user_rejected_at` ist das einzige externe Orakel; alles andere ist defeasibel und manipulierbar.

## Nächster Schritt für den übernehmenden Agenten
1. ✅ **Entscheidung A getroffen** (2026-06-01) — kein Blocker mehr.
2. v0.4 schreiben: §3.0-Numerierung + N-2 + N-5 (sofort, gabel-unabhängig) + **A** (`independentRoots` via MeritRank) + die auch-unter-A-nötigen **N-1/N-4/N-6**.
3. `konzept-lint` → `konzept-reviewer` → **erneuter `adversarial-auditor`-Lauf** (🔴-Pflicht).
4. **C3-MeritRank-Slice** als Vorbedingung in der Roadmap (§I.7) verankern; `independentRoots` dort Sybil-resistent definieren (geteilte Schnittstelle). C3 ist selbst `evaluated_pending` → braucht eigenes Slice-Konzept; **C3 und dieses Scoring co-designen.**
5. Integration als `§J` in die Haupt-`KONZEPT.md` **erst nach** dem Entrenchment-ADR (V5).
