# nsai-edge

Föderierter neuro-symbolischer Wissensgraph-Knoten als **Node.js-MCP-Server** für Claude Code. Liefert Claude in-session strukturiertes Wissen (statt lange Dateien zu lesen) und synchronisiert sich bidirektional + dezentral (git-artig P2P) mit anderen Knoten — insbesondere dem PHP-`NeuroSymbolicAiBundle` (`SmR492/ai-bundle`) als autoritativem Peer.

## Status

- **Konzept:** [`KONZEPT.md`](./KONZEPT.md) — v2.2, Reife **9,3/10** (CDP5 konzept-reviewer), konzept-lint 10/10, keine 🔴-Blocker → implementierungsreif.
- **Tests:** `test/nsai-edge.scaffold.test.mjs` — 42 **failing** TDD-Skelette (eine Methode je Akzeptanzkriterium aus dem Konzept, CDP5 §11.7/§27.4). TDD-First: erst rot, dann implementieren.
- **Implementierung:** noch nicht begonnen.

```bash
npm test   # 42 rote Tests (erwartet, TDD-First)
```

## Architektur (Kurzfassung)

- **Voll-paritäre Engine** lokal in Node (Inferenz/Decay/Quarantäne), gespiegelt zum PHP-Bundle; Drift verhindert durch sprachneutrale Regel-Spec + Cross-Language-Conformance-Vektoren **und** Fixed-Point-Arithmetik (Konfidenz = Integer-Promille 0–1000).
- **CRDT-Föderation:** content-adressierte Tripel (`triple_hash`) mit `vector_clock` + Ed25519-Signatur; Merge = `max(confidence)` → trust-unabhängiger Föderationswert; Trust nur als lokale Lese-Linse.
- **Sicherheit:** P2P aktiviert alle drei Lethal-Trifecta-Achsen → Peer-Trust (TOFU/Rotate/Revoke), Signaturpflicht, Replay-Schutz, Quarantäne für Fremd-Fakten.

## Föderations-Wire-Vertrag v1

Wire-Format + kanonische Hash-Serialisierung sind in `KONZEPT.md` (§8.2/§8.3) normativ definiert und **byte-identisch** zum Gegenstück im PHP-Bundle (`nsai:graph:ingest`/`nsai:graph:export`, Bundle-Konzept v2.1). Versioniert über `wire_version`.

## UCs

11 Use-Cases: lokale Engine (UC-01–05), Föderation P2P (UC-06–09), Governance (UC-10 Conformance-Gate, UC-11 Clone/Bootstrap). Details in `KONZEPT.md`.

## Offene 🟢-Punkte für die Umsetzung

GC-Tombstone-Default; Inferenz-Idempotenz-Schlüssel.
