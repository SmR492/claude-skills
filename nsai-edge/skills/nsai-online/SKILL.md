---
name: nsai-online
description: Pflegt die hybride Online/Offline-Sync-Verbindung eines NSAI-Systems (rocket-launch-nsai-style Symfony-App) — Status prüfen, Endpunkt+Key konfigurieren, Erreichbarkeit testen, Offline-Backlog flushen, Worker/Cron sicherstellen. Use bei „Online-Verbindung prüfen/einrichten", „Sync hängt", „Backlog synchronisieren", „NSAI offline/online".
---

# nsai-online — Online-Sync-Verbindung pflegen

Das NSAI-System schreibt Wissen hybrid: **Server-first** (konfigurierbarer Online-MCP-Endpunkt, asynchron via Messenger) mit **stillem Offline-Fallback** (lokaler nsai-bundle-Graph) und **Backlog-Sync**, sobald die Verbindung wieder steht. Ist kein Server eingerichtet, läuft alles offline. Sync ist **Opt-In**.

Dieser Skill pflegt diese Verbindung über das Konsolen-Kommando `app:nsai:online` (im App-Verzeichnis ausführen).

## Diagnose-Reihenfolge (immer zuerst, read-only)

```bash
php bin/console app:nsai:online            # Status: Opt-In, Server eingerichtet?, Endpunkt, Backlog-Größe
php bin/console app:nsai:online --test     # Erreichbarkeit + Key-Gültigkeit (HTTP tools/list-Probe)
```

Interpretation:
- **Server eingerichtet = nein** → bewusster Offline-Mode (kein Mangel).
- **--test: erreichbar + gültig** → Online-Pfad gesund.
- **--test: 401** → Key ungültig → neu setzen.
- **--test: nicht erreichbar** → Endpunkt/Netz prüfen; System fällt automatisch offline zurück (kein Datenverlust, Backlog wächst).

## Verbindung einrichten / ändern (schreibend — Operator-Bestätigung)

```bash
php bin/console app:nsai:online --endpoint="https://host/mcp" --key="<bearer>"
php bin/console app:nsai:online --enable       # Hybrid-Sync aktivieren (Opt-In an)
php bin/console app:nsai:online --disable      # zurück in reinen Offline-Mode
```

Nach jeder Änderung: erneut `--test`. Der Key wird maskiert angezeigt; Klartext nur beim Setzen.

## Backlog synchronisieren

```bash
php bin/console app:nsai:online --flush        # offline vorgemerkte Aussagen jetzt zum Online-Store schieben
# entspricht dem Cron-Kommando:
php bin/console app:nsai:sync
```

Steht die Verbindung, wird der Backlog auch automatisch bei jedem erfolgreichen Online-Write mitgezogen.

## Betrieb sicherstellen (Worker + Cron)

Der asynchrone Versand braucht einen laufenden **Worker**, der Backlog-Flush einen **Cron**:

```bash
php bin/console messenger:consume async        # Worker (dauerhaft, via supervisor/systemd/Docker-Service)
php bin/console app:nsai:sync                   # Backlog-Flush (Cron, z. B. alle 5 min)
```

Prüfen, ob der Worker läuft: `ps aux | grep "messenger:consume"`. Im Docker-Setup laufen Worker + Cron als eigene Compose-Services (siehe `compose.yaml`: `nsai_worker`, `nsai_cron`).

## Leitplanken
- **Nur `--endpoint/--key/--enable/--disable` schreiben** — und nur nach Operator-Freigabe (Mensch-Verantwortung).
- **Niemals Keys im Klartext loggen/committen** — `--test` und Status zeigen sie maskiert.
- Bei „Sync hängt": erst `--test` (Verbindung), dann `--flush` (Backlog), dann Worker-Status — in dieser Reihenfolge.
