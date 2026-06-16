#!/usr/bin/env node
// NSAI-Edge MCP-Server (stdio). In Claude Code via .mcp.json / `claude mcp add` einbinden.
// DB + Identität persistieren unter ~/.claude/nsai-edge/ (override via NSAI_EDGE_DB).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';

// node:sqlite ist experimentell — Warnung NICHT auf stdout/stderr-stören lassen.
const _emitWarning = process.emitWarning.bind(process);
process.emitWarning = (w, ...args) => {
  const msg = typeof w === 'string' ? w : w?.message;
  if (msg && msg.includes('SQLite is an experimental')) return;
  return _emitWarning(w, ...args);
};

const { Engine } = await import('../src/engine.mjs');
const { createIdentity } = await import('../src/identity.mjs');
const { McpServer, serveStdio } = await import('../src/mcp-server.mjs');

const DB = process.env.NSAI_EDGE_DB || join(homedir(), '.claude', 'nsai-edge', 'graph.db');
const IDFILE = join(dirname(DB), 'identity.json');
mkdirSync(dirname(DB), { recursive: true });
const identity = existsSync(IDFILE)
  ? JSON.parse(readFileSync(IDFILE, 'utf8'))
  : (() => { const id = createIdentity(); writeFileSync(IDFILE, JSON.stringify(id), { mode: 0o600 }); return id; })();

const engine = new Engine({ dbPath: DB, identity });

// ── Direktzugriff-Bridge zum NSAI-Hub (Default: https://nsai.bittransit.io/mcp mit dem
// geteilten "Extern"-Key; eigener Key/Server via NSAI_APP_KEY/NSAI_APP_ENDPOINT, offline via
// NSAI_APP_ENDPOINT=off). WRITE-THROUGH: jeder Write reiht die Aussage sofort + DURABLE in die
// lokale Outbox ein und stellt sie direkt zu. Ist der Hub offline, bleibt sie gepuffert und wird
// beim nächsten Write/Intervall/Startup deterministisch + idempotent (triple_hash) nachgeliefert.
// Fehler sind still (stderr) — lokal bleibt immer die Wahrheit.
const { bridgeConfig, bridgeSync, bridgePush, resolveBridgeConfig, enqueueOutbox, outboxStats } = await import('../src/bridge.mjs');
const { openDb } = await import('../src/db.mjs');
const bridgeCfg = bridgeConfig();
const bridgeDb = bridgeCfg.configured ? openDb(DB) : null; // eigene Verbindung für die Bridge-/Outbox-Schreibungen (WAL)
let effectiveCfg = bridgeCfg;                              // key-fallback-aufgelöste Config (am Startup + Intervall aktualisiert)
let bridgeRunning = false;
let pushRunning = false;
let pushTimer = null;

// Voller Sync (Startup/Intervall): Reconnect-Replay der Outbox (push) + Online-Diff (pull) + Key-Refresh.
const runBridge = async (reason) => {
  if (!bridgeCfg.configured || bridgeRunning) return;
  bridgeRunning = true;
  try {
    effectiveCfg = await resolveBridgeConfig(bridgeCfg);
    const r = await bridgeSync(engine, bridgeDb, DB, bridgeCfg);
    process.stderr.write(`nsai-edge bridge (${reason}): push=${r.push.pushed} pull=${r.pull.added} outbox=${r.outbox.pending} gepuffert\n`);
  } catch (err) {
    process.stderr.write(`nsai-edge bridge (${reason}) fehlgeschlagen: ${err.message}\n`);
  } finally {
    bridgeRunning = false;
  }
};

// Write-Through (nach jedem Write, coalesced): nur die Outbox zustellen — schnell, kein Pull.
const runPush = async (reason) => {
  if (!bridgeCfg.configured || pushRunning) return;
  pushRunning = true;
  try {
    const r = await bridgePush(engine, bridgeDb, DB, effectiveCfg);
    if (r.pending) process.stderr.write(`nsai-edge push (${reason}): pushed=${r.pushed}, ${r.pending} gepuffert (Hub offline?)\n`);
  } catch (err) {
    process.stderr.write(`nsai-edge push (${reason}) fehlgeschlagen: ${err.message}\n`);
  } finally {
    pushRunning = false;
  }
};

const onWrite = () => {
  if (!bridgeCfg.configured) return;
  try { enqueueOutbox(engine, bridgeDb); } catch { /* DB-Lock o.ä. → der nächste Lauf reiht nach */ }
  clearTimeout(pushTimer);
  pushTimer = setTimeout(() => runPush('write'), 800); // direkt zustellen, rapide Writes gebündelt
  pushTimer.unref?.();
};

const pendingAtBoot = bridgeDb ? outboxStats(bridgeDb).pending : 0;
process.stderr.write(`nsai-edge MCP-Server bereit (peer ${engine.peerId}, db ${DB}, hub ${bridgeCfg.configured ? bridgeCfg.endpoint + (bridgeCfg.defaultKey ? ' [default-key]' : ' [eigener key]') + (pendingAtBoot ? ` [${pendingAtBoot} gepuffert]` : '') : 'offline'})\n`);
if (bridgeCfg.configured) {
  void runBridge('startup');                                     // Reconnect-Replay alles Gepufferten + Pull
  setInterval(() => runBridge('interval'), 10 * 60 * 1000).unref();
}
serveStdio(new McpServer({ engine, onWrite }));
