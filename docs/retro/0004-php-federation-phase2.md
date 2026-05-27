# Retro-ADR 0004 — PHP-Föderations-Gegenseite (NSAI-Edge Phase 2)

**Status:** abgeschlossen (Implementierung + Review) · ai-bundle-Branch `feature/graph-federation-phase2` NICHT gepusht/gemergt
**Datum:** 2026-05-27
**Zweck:** Retrospektive der Phase-2-Schleife — PHP-Gegenseite der Föderation (`nsai:graph:ingest`/`export`) im Symfony-Bundle `smr492/neuro-symbolic-ai-bundle`, konzept-first nach CDP5.

## Kontext
Nach dem Merge von PR #1 (nsai-edge live im Marketplace) die vom Nutzer autorisierte Phase 2: PHP wird co-gleichberechtigter P2P-Peer. Optionen bestätigt: Ingest **mit** Ed25519-Verify, Export **mit** Vector-Clock-Delta. Vorgabe: konzept-first, voller Loop (Konzept→Umsetzung→Review→Retro→Refinement).

## Entscheidungschronik
- **E1 — Interop zuerst de-riskt:** Vor dem Konzept ein Spike (PHP-sodium verifiziert Node-PKCS8-Ed25519 via raw-Key aus SPKI-PEM; triple_hash + signingString byte-identisch). Lehre aus den Adversarial-Runden: riskanten Interop empirisch beweisen, nicht annehmen.
- **E2 — Konzept v1.1:** lint 10/10, konzept-reviewer 6,5→9,0/10 nach Einarbeitung. threat-modeler fand 7 föderations-spezifische Klassen (T1–T8) → als Paritäts-ACs F1.9–F1.15 verankert.
- **E3 — Modell-Impedanz:** Schattentabelle `FederationEdge` (Wire 1:1) statt Föderations-Spalten am count-basierten `KnowledgeEdge` — beide Vertrauensmodelle koexistieren; native Projektion via `ingestFact()`.
- **E4 — Umsetzung TDD-first:** WireCanonical/FederationMerge/WireValidator/PeerRegistry/Ingest+Export-Service/Commands + Doctrine-Migration. 37 Föderations-Tests (Krypto-/Merge-Cross-Conformance gegen Node-Fixtures + Functional), 142/142 Bundle grün.
- **E5 — Adversarial-Review:** Verdikt safe-mit-Einschränkung, keine Forgery-Lücke. 3 Findings gefixt (Typ-Gate, striktes Datum, U+2028-Konformität).

## Prozess-Lehre (Kern) — Finding gegen die REALITÄT verifizieren, nicht gegen die Annahme
Der adversarial-auditor meldete 🟡-1 „signingString divergiert bei U+2028: Node escaped, PHP nicht". Die Divergenz war **real**, aber die behauptete **Richtung falsch**: ein Hexdump von `JSON.stringify` zeigte, dass Node die rohen UTF-8-Bytes ausgibt (escaped NICHT), während **PHP** selbst escaped. Ein blindes Befolgen des Findings (PHP zusätzlich escapen) hätte die Byte-Identität erst **gebrochen**. Korrekt war `JSON_UNESCAPED_LINE_TERMINATORS` (PHP → roh = Node). → Auch ein qualifizierter, „sicher" klingender Review ist eine Behauptung; vor der Umsetzung gegen die Quelle prüfen ([[feedback-green-tests-bypass-security]], review-verify-Doktrin). Die grünen Tests verdeckten es, weil alle Fixtures ASCII waren — genau die Lücke, vor der „grüne Tests ≠ Sicherheit" warnt.

## Inhaltliche Lehre
Byte-Identität zweier Engines über Sprachgrenzen ist an wenigen, exakt benannten Stellen fragil: JSON-Escaping (Slashes/Unicode/Line-Terminators), Zahl-vs-String-Typen signierter Felder, Datums-Parser-Permissivität. Jede dieser Stellen gehört als Cross-Conformance-Fixture + Negativtest fixiert, nicht als Prosa-Zusicherung.

## Offen
- **Node-Parität-Härtung (§1.2):** F1.9–F1.15 gelten als Paritäts-ACs auch für `engine.mjs` (freier peer_id, VC-Plausibilität, Quarantäne im UPDATE-Zweig, Live-Deckel). Eigener Slice — vom konzept-reviewer einzeln gegen den Code bestätigt. Noch offen.
- ai-bundle-Branch ist lokal; Push/PR ist Mensch-Gate.
- Phase 3: HTTP-Transport (Trifecta-Vorbedingung: Egress-Allowlist/Approval).
