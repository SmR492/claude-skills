# Retro-ADR 0017 — Peer-Trust-Adjustment (NSAI-Edge Slice #6.1)

**Status:** abgeschlossen · autonom + self-merged (PR #17) · 2 Adversarial-Audit-Runden + 3 🟡 nachgezogen
**Datum:** 2026-05-28
**Zweck:** Erster Offline-Lern-Slice. Retrospektive eines Slices, dessen erster Wurf zwei Konfabulations-Quellen einführte (System-Schutz-Aktionen als Trust-Signal gezählt) — und wie ein Spalten-Re-Design das strukturell schloss.

## Kontext
Stefan hatte in der #6-Diskussion explizit Option E (Bias-Lerner) verworfen mit „evtl. drift, da zu wenig Kontext". Slice #6.1 ist die abgeschwächte Form (Vorschlags-Modus, kein Auto-Apply). Erste Implementation fiel trotzdem in die gleiche Falle — auf einer subtileren Ebene.

## CDP5-geprüfte Architektur-Entscheidungen
- **Vorschlags-Modus, kein Auto-Apply** — Nutzer entscheidet explizit via `peerTrust()`.
- **Nur explicit-Nutzer-Reject zählt** — neue Spalte `user_rejected_at`, gesetzt NUR durch `reject(hash)`. System-Aktionen (low-conf inference, default-Quarantäne, peerRevoke, Decay) tasten sie nicht an.
- **Lokale Trust-Achse**, nicht globale Spec-Tuning — `trust_level` ist per Definition lokal.
- **Integer-Promille**, deterministisch, kein Float.

## Entscheidungschronik
- **E1** — Konzept-First UC-TA mit AC-20.1-20.12. Implementation: `learnTrustAdjustments` aggregiert `local_status IN ('superseded', 'retracted', 'quarantined')` als reject-Rate.
- **E2** — Adversarial-Audit Runde 1: **NEIN.** Zwei kritische Konfabulations-Pfade:
  - 🔴-1 **`quarantined` ≠ user-reject**: System setzt das auf low-confidence-Inferenz, default-Quarantäne bei untrusted-Clone, peerRevoke. Empirisch: full-Peer mit 10 low-conf-inference-Tripeln → Vorschlag `untrusted`. **Genau Stefans Bias-Falle.**
  - 🔴-2 **`superseded` ≠ user-reject**: Decay-Supersede ist zeit-bedingt, nicht user-bedingt. Peer mit veralteten Aussagen → fälschlicher Trust-Abbau.
- **E3** — Fix: neue Spalte `user_rejected_at` (additiv, idempotent migriert). `reject()` setzt sie, `learnTrustAdjustments` zählt nur `user_rejected_at IS NOT NULL`. Schema-CHECK-Constraint nicht erweitert (additive Spalte ist sauberer als CHECK-Migration).
- **E4** — Adversarial-Audit Runde 2: **JA-mit-Einschränkung.** Konfabulations-Quelle strukturell geschlossen. Drei 🟡:
  - 🟡-A **KONZEPT-Drift**: Doku-Texte sagten noch `updated_at`-Filter und `local_status`-Aggregation, Code filterte schon auf `asserted_at_norm` + `user_rejected_at`. Re-Drift-Gefahr für künftige Wartung.
  - 🟡-B **`promote()` Un-Reject-Lücke**: setzte local_status=active, ließ aber `user_rejected_at` gesetzt → „Geisterzähler" (Peer steht weiter belastet, obwohl Nutzer den Reject zurückgenommen hat).
  - 🟡-C **Legacy-Daten**: Pre-Slice-Rejects haben `user_rejected_at=NULL` (Spalte existierte noch nicht) → unsichtbar für den Lerner. Konservativ richtig, aber sollte dokumentiert sein.
- **E5** — Alle 3 🟡 gefixt: KONZEPT angeglichen, `promote()` löscht `user_rejected_at`, Legacy-Konvention dokumentiert.
- **E6** — Self-Merge PR #17.

## Prozess-Lehre (Kern)
**Subtile Status-Semantik kann eine ganze Slice-Klasse kippen.** Mein erster Wurf hatte 14 ACs, alle grün. Aber er erfüllte den Constraint nur **buchstäblich** („wir lernen aus reject-Aktionen"), nicht **semantisch** (was IST eine reject-Aktion?). `local_status='quarantined'` ist im Schema die formale Markierung — aber semantisch ist das eine Mischung aus Nutzer-Reject UND System-Schutz. Eine Allowlist nach Status-Namen verwechselt beide. Die saubere Lösung war eine **explizite User-Aktion-Spalte** (`user_rejected_at`), die strukturell nur durch eine einzige Code-Stelle gesetzt wird.

**Lehre für Stefans Bias-Constraint**: „Lernen aus Nutzer-Aktionen" ist ein scharfes Versprechen. Es muss durch **strukturelle** Trennung zwischen User-Aktion und System-Aktion eingelöst werden, nicht durch heuristische Status-Interpretation. Der Spaltenname `user_rejected_at` codiert die Semantik direkt im Schema.

**Adversarial-Audit fand den Pfad, den ich nicht gesehen hatte.** Der Auditor lief ein paar Probes:
- 10 system-quarantined edges → `suggested: untrusted` ✗
- 10 decay-superseded edges → `suggested: untrusted` ✗
- gemischt → Konfabulation systematisch.

Klassischer Sycophancy-Blindfleck: 14 ACs alle grün, weil alle Tests nur direkt `local_status` mutierten. Reale Pfade (System-Quarantäne, Decay) wurden nicht getestet — der Auditor hat das mit zwei zusätzlichen Probes aufgedeckt.

**Re-Audit findet noch immer was.** Nach dem 🔴-Fix tauchten drei 🟡 auf: Doku-Drift (klassisch), `promote()`-Un-Reject (semantische Lücke), Legacy-Konvention (nicht dokumentiert). Drei Audit-Runden wären nicht überraschend gewesen — die 🟡 waren ohne neuen Code in einer Runde schließbar.

## Inhaltliche Lehre
**Explizite Spalten > implizite Status-Interpretation.** Wenn eine Aktion verschiedene semantische Bedeutungen hat (System-Schutz vs. Nutzer-Wahl), gehört das in separate Spalten oder Status-Werte. Sonst lernt ein Lerner-Algorithmus aus der falschen Quelle.

**`promote()` ist die symmetrische Operation zu `reject()`.** Wenn `reject()` einen Lerner-Counter erhöht, muss `promote()` ihn wieder zurücknehmen — sonst entsteht Inkonsistenz, sobald der Nutzer seine Meinung ändert.

**Legacy-Konventionen explizit machen.** Pre-Slice-Daten sind aus der neuen Sicht-Linse oft „unsichtbar" — das ist konservativ richtig (kann nicht unterschieden werden) und sollte als bewusste Konvention im KONZEPT stehen.

## Offen
- **Slice #6.3** (in Bearbeitung): zugriffs-basiertes Decay / Spaced-Repetition.
- **Slice #6.2** (pending): Episoden→Schema-Konsolidierung.
- **Slice #6.4** (pending): globale Spec-Tuning signiert+föderiert (der größte Slice mit Wire-Erweiterung).
- **Auto-Apply-Variante** (deferred): bei wiederholtem Vorschlag derselben Herabstufung könnte ein Trust-Decay-Mechanismus den Apply automatisieren — bewusst NICHT in #6.1, weil das wieder Richtung „kodierter Bias" geht. Stefan würde das explizit autorisieren müssen.
