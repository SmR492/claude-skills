# nsai-edge

Föderierter neuro-symbolischer Wissensgraph-Knoten (Node.js) für Claude Code. Liefert Claude in-session strukturiertes Wissen (statt lange Dateien zu lesen) und synchronisiert sich bidirektional + dezentral (git-artig P2P) mit anderen Knoten — insbesondere dem PHP-`NeuroSymbolicAiBundle` (`SmR492/ai-bundle`) als autoritativem Peer.

## Installation über den Marketplace

```
/plugin marketplace add SmR492/claude-skills
/plugin install nsai-edge@claude-skills
```

Das Plugin deklariert seinen MCP-Server selbst (`.mcp.json` mit `${CLAUDE_PLUGIN_ROOT}`) — nach Installation + Reload registriert Claude Code die Tools `mcp__nsai-edge__graph__*` automatisch. **Voraussetzung:** Node ≥ 22.5 (für `node:sqlite`). DB + Identität liegen unter `~/.claude/nsai-edge/` und sind damit unabhängig vom Installationspfad persistent.

> Wer den Server lokal aus dem Checkout testet, kann ihn alternativ direkt per `.mcp.json` (absoluter Pfad zu `bin/nsai-edge-mcp.mjs`) oder `claude mcp add` einbinden. Nicht beides gleichzeitig mit gleichem Servernamen `nsai-edge` (Namenskonflikt).

## Status

- **Konzept:** [`KONZEPT.md`](./KONZEPT.md) — v2.2, Reife 9,3/10, konzept-lint 10/10.
- **Engine:** implementiert in `src/` — **34 Tests grün** (`npm test`), alle 11 UCs im Kern abgedeckt.
- Keine externen Dependencies: `node:sqlite` (DatabaseSync) + `node:crypto` (Ed25519). Node ≥ 22.5.

```bash
npm test            # 34/34 grün
node bin/nsai-edge.mjs whoami
```

## Was implementiert ist

| Bereich | UCs | Modul |
|---|---|---|
| Erfassen / Abfragen (Subgraph + effektive Konfidenz) | UC-01, UC-02 | `src/engine.mjs` |
| Forward-Chaining-Inferenz | UC-03 | `src/engine.mjs` + `src/rules.mjs` |
| Decay & Reinforcement (Fixed-Point, Trunkierung) | UC-04 | `src/engine.mjs` |
| Quarantäne (Promote/Reject, Signaturpflicht) | UC-05 | `src/engine.mjs` |
| Föderation Pull/Push (transport-injiziert, Loopback getestet) | UC-06, UC-07 | `src/engine.mjs` |
| CRDT-Merge (max, trust-unabhängig, kommutativ/assoziativ/idempotent) | UC-08 | `src/engine.mjs` |
| Peer-Trust (TOFU-Fingerprint, Rotate, Revoke) | UC-09 | `src/engine.mjs` + `src/identity.mjs` |
| Conformance-Runner (Node-Seite) | UC-10 | `src/conformance.mjs` |
| Clone / Bootstrap (Quarantäne + Bulk-Promote) | UC-11 | `src/engine.mjs` |
| **Evidenz-Gewichtung / Belief-Resolution** (Autorität × Aktualität × Konfidenz) | UC-12 | `src/engine.mjs` |
| Kanonischer Hash (NFC/0x1F/sha256:) | Wire-Vertrag v1 | `src/canonical.mjs` |
| MCP-stdio-Server (JSON-RPC 2.0) + Marketplace-Plugin | — | `src/mcp-server.mjs`, `bin/nsai-edge-mcp.mjs` |

**Kern-Eigenschaften (getestet, 50 Tests):** Fixed-Point-Konfidenz (Integer-Promille 0–1000); Provenienz-**Modell B** (origin=Erstbehaupter, signiert, kein Re-Sign, Web-of-Trust-Verify gegen Origin-Key, Trust am Origin nie am Relay → kein Impersonation/Trust-Laundering); trust-unabhängiger CRDT-Merge; Replay-Schutz; Clock-Persistenz; **Evidenz-Gewichtung**: konkurrierende/veraltete/falsche Aussagen werden nach `source_type`-Autorität × Aktualität × Konfidenz gewichtet (Belief 0–1000, Anzahl zählt nie), Überstimmtes bleibt auditierbar (`disputed`/`dominant`).

## CLI

```bash
node bin/nsai-edge.mjs store --subject=Glatteis --predicate=ist_ein --object=Strassengefahr --confidence=900
node bin/nsai-edge.mjs store --subject=Temperatur --predicate=zustand --object=unter_null --confidence=900
node bin/nsai-edge.mjs infer
node bin/nsai-edge.mjs query --term=Fahrbahn --depth=1
node bin/nsai-edge.mjs decay --dry=true
# MCP-Server (stdio): node bin/nsai-edge-mcp.mjs — Tool graph__resolve_belief für gewichtete Konflikt-Auflösung
node bin/nsai-edge.mjs peer-add --peer=peer:bundle --key=./bundle.pub --endpoint=...
node bin/nsai-edge.mjs peer-trust --peer=peer:bundle --level=authoritative
```

DB + Identität liegen unter `~/.claude/nsai-edge/` (override via `NSAI_EDGE_DB`).

## Noch offen (Phase 2 — PHP-Gegenseite, bewusst deferred)

Die **Node-Hälfte der Föderation ist fertig + getestet**: realer HTTP-Transport (Node↔Node) und `bundleAdapter` (docker exec via `execFile`-Argument-Array, kein Shell, Container validiert) in `src/transport.mjs`.

- **PHP-Bundle-Commands `nsai:graph:ingest`/`export`** existieren noch nicht (separate Symfony-Arbeit). Sobald gebaut, läuft die Bundle-Föderation ohne Node-Änderung.
- **PHP-Conformance-Gegenlauf (UC-10):** Node-Seite läuft; `phpVerified` bleibt `false`, bis ein `phpRunner` die Vektoren in der PHP-Engine rechnet.
- **MCP-Föderations-Tools** (`pull`/`push`/`clone`) nur via CLI/HTTP, nicht als in-session-MCP-Tool (async). `peer_add`/`peer_trust` + alle Lese-/Schreib-Tools sind MCP-verfügbar.

## Föderations-Wire-Vertrag v1

Wire-Format + kanonische Hash-Serialisierung (`KONZEPT.md` §8.2/§8.3) sind byte-identisch zum PHP-Bundle-Gegenstück, versioniert über `wire_version`.
