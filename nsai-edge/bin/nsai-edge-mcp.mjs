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
process.stderr.write(`nsai-edge MCP-Server bereit (peer ${engine.peerId}, db ${DB})\n`);
serveStdio(new McpServer({ engine }));
