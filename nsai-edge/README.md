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
| Kanonischer Hash (NFC/0x1F/sha256:) | Wire-Vertrag v1 | `src/canonical.mjs` |

**Kern-Eigenschaften (getestet):** Fixed-Point-Konfidenz (Integer-Promille 0–1000); gemergter Föderationswert ist trust-**un**abhängig (CRDT), Trust nur als lokale Lese-Linse; Ed25519-Signaturprüfung beim Empfang, Re-Signatur beim Export (transitives Vouching); Replay-Schutz; Widerspruch → Quarantäne, authoritative gewinnt lokal.

## CLI

```bash
node bin/nsai-edge.mjs store --subject=Glatteis --predicate=ist_ein --object=Strassengefahr --confidence=900
node bin/nsai-edge.mjs store --subject=Temperatur --predicate=zustand --object=unter_null --confidence=900
node bin/nsai-edge.mjs infer
node bin/nsai-edge.mjs query --term=Fahrbahn --depth=1
node bin/nsai-edge.mjs decay --dry=true
node bin/nsai-edge.mjs peer-add --peer=peer:bundle --key=./bundle.pub --endpoint=...
node bin/nsai-edge.mjs peer-trust --peer=peer:bundle --level=authoritative
```

DB + Identität liegen unter `~/.claude/nsai-edge/` (override via `NSAI_EDGE_DB`).

## Noch offen (Integration)

- **MCP-stdio-Transport:** Engine-Tools (`graph__store_triple` etc.) als MCP-Server framen (JSON-RPC 2.0). Die Engine-API ist dafür bereit; nur die Protokoll-Hülle fehlt.
- **Netz-/`docker exec`-Peer-Transport:** aktuell ist die Föderation über einen injizierten Transport (Loopback) getestet; HTTP + der Bundle-Adapter (`nsai:graph:ingest`/`export`) fehlen — die Bundle-Commands existieren noch nicht (Symfony-seitige Arbeit).
- **PHP-Conformance-Gegenseite (UC-10):** Node-Seite läuft; das Cross-Language-Gate bleibt `unverified`, bis die PHP-Engine dieselben Vektoren rechnet.
- 🟢 GC-Tombstone-Default, Inferenz-Idempotenz-Schlüssel.

## Föderations-Wire-Vertrag v1

Wire-Format + kanonische Hash-Serialisierung (`KONZEPT.md` §8.2/§8.3) sind byte-identisch zum PHP-Bundle-Gegenstück, versioniert über `wire_version`.
