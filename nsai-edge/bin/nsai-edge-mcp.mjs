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

// ── Hybrid-Bridge zum NSAI-Hub (Default: https://nsai.bittransit.io/mcp mit dem
// geteilten "Extern"-Key; eigener Key/Server via NSAI_APP_KEY/NSAI_APP_ENDPOINT,
// offline via NSAI_APP_ENDPOINT=off). Sync: beim Start, debounced nach Writes,
// periodisch. Fehler sind still (stderr) — lokal bleibt immer die Wahrheit.
const { bridgeConfig, bridgeSync } = await import('../src/bridge.mjs');
const { openDb } = await import('../src/db.mjs');
const bridgeCfg = bridgeConfig();
let bridgeRunning = false;
let bridgeTimer = null;
const runBridge = async (reason) => {
  if (!bridgeCfg.configured || bridgeRunning) return;
  bridgeRunning = true;
  try {
    const r = await bridgeSync(engine, openDb(DB), DB, bridgeCfg);
    process.stderr.write(`nsai-edge bridge (${reason}): push=${r.push.pushed} pull=${r.pull.added}\n`);
  } catch (err) {
    process.stderr.write(`nsai-edge bridge (${reason}) fehlgeschlagen: ${err.message}\n`);
  } finally {
    bridgeRunning = false;
  }
};
const onWrite = () => {
  clearTimeout(bridgeTimer);
  bridgeTimer = setTimeout(() => runBridge('write'), 5000);
  bridgeTimer.unref?.();
};

process.stderr.write(`nsai-edge MCP-Server bereit (peer ${engine.peerId}, db ${DB}, hub ${bridgeCfg.configured ? bridgeCfg.endpoint + (bridgeCfg.defaultKey ? ' [default-key]' : ' [eigener key]') : 'offline'})\n`);
if (bridgeCfg.configured) {
  void runBridge('startup');
  setInterval(() => runBridge('interval'), 10 * 60 * 1000).unref();
}
serveStdio(new McpServer({ engine, onWrite }));
