---
title: Konzept-Fehlerfunde NSAI-Edge (unabhängige adversariale Prüfung)
date: 2026-05-29
status: Befund-Liste (read-only Review, kein Code/Konzept-Edit)
scope: nsai-edge/KONZEPT.md v2.4
hinweis: Erstellt während KONZEPT.md + engine.mjs parallel von einem anderen Agenten editiert wurden. Funde gelten gegen den damaligen Festplatten-Snapshot; engine.mjs war mid-write (NULL-Byte) → NICHT gegengeprüft. Verifiziert gegen intakte rules.mjs/conformance.mjs/db.mjs.
---

# Konzept-Fehlerfunde NSAI-Edge

Unabhängige zweite Perspektive (parallel zur laufenden Konzept-Bearbeitung). Jeder Fund firsthand an der Quelle bestätigt.

## 🔴 NEU & kritisch (parität-gefährdend, in keinem Retro erwähnt)

### K1 — Widersprüchliche `sourceTier`-Skala
- `rules.mjs:21` & §B: `gesetz 6, behoerde 5, sensor 4, fachquelle 3, manual 2, web 1, llm/inference 0`.
- KONZEPT **UC-MS Z.1035**: `sensor=1, web=2, manual=0, behoerde=4, gesetz=5, audit=6` — komplett andere Nummerierung; `audit` existiert im Code nicht.
- Wirkung: `clusterContribution = trustRank × tier` → `full × behoerde` = 5000 (Code) vs. 4000 (UC-MS); erreicht `AUTH_FLOOR=4500` einmal, einmal nicht. PHP-Re-Implementierung nach UC-MS bräche die deklarierte Parität.
- Fix: UC-MS-Tabelle + Glossar (`audit 6`, Z.672) auf `rules.mjs`-Skala angleichen; klären, ob `audit` eine reale Stufe sein soll.

### K2 — `AUTH_FLOOR`-Beispiel rechnet falsch
- UC-MS **Z.1047**: „`trustRank ≥ full × tier ≥ fachquelle`" erreiche `AUTH_FLOOR=4500`. Aber `full(1000) × fachquelle(3) = 3000 < 4500`.
- `rules.mjs:39` sagt korrekt: 3000 < AUTH_FLOOR; erst `full × behoerde = 5000` erreicht.
- Fix: „`tier ≥ fachquelle`" → „`tier ≥ behoerde`".

## 🟡 NEU & wichtig
- **M5** — Recency-Halbwertszeiten (`{eternal:∞, stable:3650, temporal:180, ephemeral:30}`, rules.mjs:28) nur im Code, in §B nur qualitativ → normative Tabelle in §B/§5 ergänzen.
- **M2** — `weighted_support` (Σ über Cluster) ohne Cap/Range-Notiz; andere UCs haben DoS-Caps. Range-Hinweis ergänzen.
- **K3** — Decay-Recall-Divisor `trunc(reduction/divisor)` kann auf 0 fallen → stiller Decay-Stillstand; als Invariante/AC festhalten (`max(1, …)` oder bewusst erlaubter Stopp).
- **M1** — TOC-Drift: listet „UC-01…UC-11", real ~19 UCs + §G/§H/§I.
- **G1** — AC-Nummernkollision (`AC-9/10/11/12.x` mehrfach belegt) → UC-Präfix in §H-Slice-ACs.

## 🟢 Bekannt-akzeptiert (Retro 0012 — Konsolidierungs-Lücke, kein neuer Fehler)
- **M3** — Self-Endorsement-Eskalation (`full × gesetz 6 = 6000 ≥ 4500`) + Cluster-Korrelation: als Restrisiko-Prosa (UC-MS Z.1055/1059) + Slice #M.2 vertagt, aber NICHT in der §7.2-STRIDE-Tabelle. Tabelle + Querverweis auf AC-15.15/15.16 ergänzen.
- **M4** — AC-15.13 prüft Float-freien *Output*; kein AC verbietet strukturell Float-Leak aus `search`/PPR in einen *Verdikt-Berechnungspfad* (Provenienz-Taint). Schmaler Härtungspunkt.

## 🚀 Durchbruch-Lösung für den vertagten Slice #M.2
**MeritRank (arXiv 2207.09950) — Sybil-Toleranz statt -Detektion.** Begrenzt deterministisch den Gewinn aus Sybil/Kollusion über Decay auf einem gewichteten Random-Walk (= vorhandene PPR-Maschine):
- **Connectivity-Decay** wertet Beiträge ab, die nur über eine einzelne Brücke zum Pre-Trust-Seed hängen — exakt der Korrelations-/Cluster-Fall (M3), ohne Cluster zu „beschuldigen" (löst den „Sippenhaft"-Einwand aus Retro 0012).
- **Transitivity-Decay** dämpft mit Distanz zum Seed.
- Warnung: **Epoch-(Zeit-)Decay verbessert Sybil-Toleranz NICHT** → vorhandenes Zeit-Decay schützt nicht gegen Sybil.
- Synergie mit **C1 (EigenTrust-Linse)**: C1 + MeritRank-Decay = Sybil-tolerante Trust-Linse ohne fragilen Cluster-Detector; deterministisch, fixed-point, seed-verankert, lokale Linse → alle 4 Invarianten gewahrt.

Ergänzend: **Truth-Discovery Copying/Dependence-Detection** (SmartMTD arXiv 1708.02018; Dong et al.) = statistische Basis für dynamische Cluster-Inferenz aus Verhalten statt manuellem `cluster_id`. **Decentralized-Reputation-Trilemma** = Rahmen, um im Konzept ehrlich zu deklarieren, welche Eigenschaft geopfert wird (Pre-Trust-Seed-Abhängigkeit).

## ⭐ Meta-Fund (höchster Hebel — Prozess)
K1/K2 sind eine Fehlerklasse, die grüne Tests (lesen nur `rules.mjs`) UND Adversarial-Audits (prüfen nur Verhalten) systematisch übersehen: **numerische Konstante in Prosa ≠ Code.** Empfehlung: vorhandenes `konzept-model-api`-Gate um einen **Konstanten-Tabellen-Konsistenz-Check** erweitern (diffe sourceTier/trustTierCap/quorum*/Decay/Recency-Tabellen in KONZEPT.md gegen rules.mjs/conformance.mjs). Hätte K1+K2 in 0 Token gefangen.

## Quellen
- Sybil-Toleranz: https://arxiv.org/abs/2207.09950 (MeritRank) · https://arxiv.org/pdf/1803.06772 (SybilFuse) · https://www.princeton.edu/~pmittal/publications/sybilfuse-cns18.pdf
- Truth Discovery / Copying: https://arxiv.org/pdf/1708.02018 (SmartMTD) · https://arxiv.org/abs/1505.02463 (Survey)
