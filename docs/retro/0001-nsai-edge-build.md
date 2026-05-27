# Retro-ADR 0001 — NSAI-Edge: Konzept → Engine → MCP → Pre-Merge-Review

**Status:** abgeschlossen (Pre-Merge, PR #1 NICHT gemergt)
**Datum:** 2026-05-26
**Zweck:** Retrospektive über den Bau von `nsai-edge` und die Frage, ob das Ziel „datenbankbasierte Wissensbasis für Claude Code" erreicht wurde.

## Kontext

Ziel (Stefan): Claude Code effizient + strukturiert mit Wissen versorgen, ohne lange Dateien zu lesen — persistent, dezentral (git-artig P2P), als Peer des PHP-`NeuroSymbolicAiBundle`. Bewusste Entscheidungen: Voll-Parität lokal, zwei gespiegelte Engines, P2P/föderiert, MCP-Server.

## Entscheidungschronik

- **E1 — Gemini-Konzepte verworfen.** Zwei Fremd-Entwürfe (v1.0/v1.2) hatten Skill-vs-MCP-Mismatch, Einbahn-Sync, erfundene Bundle-Schnittstelle. Verifikation gegen echten Bundle-Code deckte die Erfindungen auf (`ai:graph:ingest-json`, `fp_app_container` existierten nie).
- **E2 — Eigenes Konzept iterativ auf Reife.** v2.0 (8,05) → v2.1 (8,55) → v2.2 (9,30/10) über deterministischen Lint + Judgment-Reviewer. Kern-Fixes: Fixed-Point statt Float (Drift), Clone-UC, Hash-Kanonisierung, CRDT-Merge trust-unabhängig.
- **E3 — NSAI-Bundle-Konzept nachgezogen** (3,5 → 9,2/10), gemeinsamer Wire-Vertrag v1 byte-identisch gespiegelt.
- **E4 — Engine TDD-First implementiert.** 41 Tests grün, keine externen Deps (node:sqlite + Ed25519). CLI + MCP-stdio-Transport. Live in Claude Code eingebunden, mit verifiziertem PDF-Wissen befüllt und abgefragt (KI-Kompetenz/Art. 4 KI-VO: Miss → Ingest → Hit, kein Halluzinieren).
- **E5 — Marketplace-Plugin** (manifest + `.mcp.json` mit `${CLAUDE_PLUGIN_ROOT}` + marketplace.json-Eintrag).
- **E6 — Gegnerischer Pre-Merge-Review → NEIN.** Drei 🔴 (Origin-Impersonation, Trust-Laundering via Relay, Re-Sign zerstört Herkunft) + 🟡 (Clock-Reset, fehlende Transaktionen/busy_timeout, fehlende Input-Validierung in mergeIncoming). Merge blockiert.

## Ziel-Verdikt

- **Datenbankbasierte Wissensbasis (Single-Node, lokal): ERREICHT + live bewiesen.** Persistent (SQLite, `~/.claude/nsai-edge/`), abfragbar, ehrlich (Miss statt Halluzination), mit Konfidenz + Herkunft + Inferenz + Decay. Der Kern-Nutzen für Claude Code funktioniert.
- **Föderation / P2P-Sicherheit: NICHT produktionsreif.** Die drei 🔴 betreffen genau die verteilte Vertrauenskette. Bis zum Fix ist nur der lokale/Einzelknoten-Betrieb vertrauenswürdig.

## Was gut lief

- Verifikation gegen echte Quelle (Bundle-Code, PDF) statt Annahmen — fing Fremd-Erfindungen + lieferte echtes Wissen.
- CDP5-Gate-Kette (Lint → Judgment-Reviewer → adversarial-auditor) hielt die Qualität messbar hoch und fing vor dem Merge schwere Bugs.
- TDD-First + Fixed-Point-Entscheidung eliminierten ganze Fehlerklassen früh.

## Was besser muss

- **Grüne Tests gaben falsche Sicherheit:** Die Föderations-Tests umgingen den Signaturpfad (Fake-Signatur `'ed25519:x'` in `mergeIncoming`-Aufrufen). Sicherheits-Eigenschaften müssen End-to-End über den echten Verify-Pfad getestet werden, nicht über die Merge-Algebra allein. Siehe Memory [[feedback-green-tests-bypass-security]].
- Architektur-Lücke (origin = Erstbehaupter vs. letzter Hop) war im Konzept sauber spezifiziert, aber die Implementierung wich ab — Konzept↔Code-Drift an einer Sicherheits-Invariante.

## Kern-Lehre

Ein bestandener Test-Lauf belegt nur, was getestet wird. Wenn Tests den sicherheitskritischen Pfad abkürzen (hier: Signatur/Herkunft), ist „alles grün" ein Trugschluss. Gegnerischer Review vor jedem Merge eines verteilten/sicherheitsrelevanten Slices ist Pflicht, nicht Kür. → [[feedback-green-tests-bypass-security]]
