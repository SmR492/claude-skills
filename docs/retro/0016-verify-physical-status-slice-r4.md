# Retro-ADR 0016 — Verify-Physical-Status (NSAI-Edge Slice #R4)

**Status:** abgeschlossen · autonom + self-merged (PR #16) · 1 Adversarial-Audit-Runde + 3 🟡 nachgezogen
**Datum:** 2026-05-28
**Zweck:** Retrospektive eines reinen Erklärbarkeits-Slice, der eine in der KI-VO-Demo entdeckte Subtilität schließt — ohne Verdikt-Drift, ohne neue Konfabulations-Klasse.

## Kontext
KI-VO-Live-Demo zeigte: nach `reject(hash)` zeigt `verify` das Gerücht weiter als `contradicted`. Konsistent zur single-value-Dominanz-Logik (KI-Kompetenz dominiert, „nichts" wird widerlegt), aber für den Konsumenten erklärbarkeitsfeindlich — er sieht nicht, dass er das Tripel selbst abgelehnt hat. Stefan markierte das als Backlog-Subtilität. Slice #R4 schließt diese Lücke durch ein **additives** `physical_status`-Feld.

## CDP5-geprüfte Architektur-Entscheidungen
- **Additives Feld, kein Verdikt-Drift**: `verify` bleibt bei den drei Verdikt-Kategorien. `physical_status` ist eine reine Lese-Linse auf `knowledge_edges.local_status`, hängt nur additiv an.
- **Open-World absolut**: Wenn das Tripel nicht physisch existiert, FEHLT das Feld — nicht `'none'`. Abwesenheit wird durch Feld-Fehlen signalisiert, konsistent zu unserer Open-World-Pflicht.
- **Wrapper-Pattern**: bestehende `verify`-Logik wurde zu `_verifyCore()` umbenannt, `verify` ist Public-Wrapper. Garantiert: bestehende Verdikt-Pfade unverändert.
- **Kategorischer String aus Schema-CHECK-Constraint**: 4 mögliche Werte (`active`/`superseded`/`retracted`/`quarantined`), strukturell durch SQLite-CHECK garantiert. Kein Probabilistik-Leak möglich.
- **Strip-Allowlist erweitert**: `assertClaims`-Strip lässt `physical_status` durch (kategorischer String), bleibt aber für numerische Provenienz strikt.

## Entscheidungschronik
- **E1** — KI-VO-Demo-Subtilität aus Backlog priorisiert (Stefans Option 3).
- **E2** — Konzept-First UC-VPS mit AC-19.1-19.10. Lint 10/10.
- **E3** — Implementation: Wrapper-Pattern (`verify` → `_verifyCore`), additives Feld, Strip-Allowlist erweitert. 10 AC-Tests grün.
- **E4** — Adversarial-Audit: **safe JA-mit-Einschränkung.** Drei 🟡 (alle Doku-/Test-Schliffe, kein Code-Defekt):
  - 🟡-1 MCP-Tool-Descriptions erwähnten `physical_status` nicht → Konsumenten-Sycophancy-Risiko (LLM könnte das Feld als „belief-Wert" missinterpretieren). **Fix**: Tool-Descriptions ergänzt mit klarem Hinweis „reine Erklärbarkeit, kein Verdikt-Drift".
  - 🟡-2 `present` und `physical_status` können beide gleichzeitig erscheinen → scheinbar widersprüchlich. **Fix**: KONZEPT-Klarstellung — beide beschreiben unterschiedliche Lese-Linsen (rb-Linse vs. Edge-Linse).
  - 🟡-3 AC-19.5 testete `retracted` über Direkt-DB-Mutation, nicht über echte TMS-Propagation. **Fix**: AC-19.5b ergänzt — derived_from-Kette + Premise reject → propagateRetraction setzt abgeleiteten Fakt auf retracted.
- **E5** — Self-Merge PR #16.

## Prozess-Lehre (Kern)
**Erklärbarkeits-Schliffe sind keine kosmetischen Issues.** Die KI-VO-Demo-Subtilität war kein Bug — die Logik war korrekt. Aber der Konsument bekam eine Antwort, die er nicht ohne weiteres als „das hast du selbst abgelehnt" interpretieren konnte. Genau hier ist die Halluzinations-Falle für den Konsumenten: ohne Erklärbarkeits-Hinweis konstruiert er sich selbst eine Geschichte (warum sagt das System nicht einfach „unknown"?). Slice #R4 schließt das durch ein präzises additives Feld — keine Halluzinations-Quelle, keine probabilistische Aussage, einfach mehr Kontext.

**Wrapper-Pattern für additive Felder ist sicherer als verschachtelte Returns.** Hätte ich versucht, das Feld in jedem der 7+ Return-Statements von `verify` einzubauen, wäre eines mit Sicherheit vergessen worden. Der Public-Wrapper sieht das Endergebnis und ergänzt zentral — Wartungs-Defensive eingebaut.

**MCP-Tool-Descriptions sind Konsumenten-Sycophancy-Schutz.** Der Auditor fand: das Feld existiert im Output, aber die Tool-Description erwähnt es nicht. Ein LLM-Konsument liest die Description, sieht das Feld im Output, baut eine eigene Erklärung. Drift-Risiko strukturell. Tool-Descriptions müssen **alles** dokumentieren, was im Output erscheinen kann — sonst entsteht stille Konsumenten-Konfabulation. [[feedback-green-tests-bypass-security]]

**Tests müssen den ECHTEN Pfad testen.** AC-19.5 setzte `retracted` per Direkt-UPDATE — das prüfte das Durchreichen, aber nicht die TMS-Propagation, die im Produktiv-Fall der Pfad zu `retracted` ist. Hätte `_propagateRetraction` einen Bug bekommen, der das Feld vergisst, wäre der Test grün geblieben. AC-19.5b ergänzt jetzt den echten Pfad mit derived_from-Kette.

## Inhaltliche Lehre
**Status ist nicht bi-temporal.** Stefan hatte das in #R2 schon als bewusste Entscheidung dokumentiert. `physical_status` reflektiert den **aktuellen** local_status — auch bei `as_of`-Anfragen in der Vergangenheit. Eine bi-temporale Status-Achse wäre eine komplette zusätzliche Spalte und ein eigenes Slice (#Future); für die Erklärbarkeits-Anwendung von #R4 reicht der aktuelle Status.

**Schema-CHECK-Constraints sind Defensive-Defaults für kategorische Felder.** `local_status` ist via CHECK-Constraint auf 4 Werte beschränkt. Damit ist die Allowlist im JS-Code redundant — aber die Sicherheit kommt aus dem Schema, nicht aus dem Code. Das ist die richtige Schichtung.

## Offen
- **MCP-Tool-Descriptions als CDP5-AC** — Idee aus dem Audit: jede Slice-Erweiterung, die ein neues Output-Feld bringt, sollte explizit prüfen, dass die Tool-Description aktualisiert wurde. Könnte ein deterministischer `mcp-doc-drift`-Gate-Skill werden (Backlog).
- **bi-temporale Status-Achse** (Slice #Future) — falls historische Status-Anfragen je gewünscht werden, eine eigene Spalte `status_history(triple_hash, status, valid_from, valid_to)`. Aktuell nicht gefordert.
