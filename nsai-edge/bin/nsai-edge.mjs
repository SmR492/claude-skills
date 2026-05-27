#!/usr/bin/env node
// NSAI-Edge CLI — dünner Host-Wrapper um die lokale Engine.
// DB + Identität persistieren unter ~/.claude/nsai-edge/ (override via NSAI_EDGE_DB).
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, dirname } from 'node:path';
import { Engine } from '../src/engine.mjs';
import { createIdentity } from '../src/identity.mjs';

// node:sqlite ist experimentell — die Warnung aus der CLI-Ausgabe filtern (stdout bleibt sauberes JSON).
const _emitWarning = process.emitWarning.bind(process);
process.emitWarning = (w, ...args) => {
  const msg = typeof w === 'string' ? w : w?.message;
  if (msg && msg.includes('SQLite is an experimental')) return;
  return _emitWarning(w, ...args);
};

const DB = process.env.NSAI_EDGE_DB || join(homedir(), '.claude', 'nsai-edge', 'graph.db');
const IDFILE = join(dirname(DB), 'identity.json');
mkdirSync(dirname(DB), { recursive: true });

const identity = existsSync(IDFILE)
  ? JSON.parse(readFileSync(IDFILE, 'utf8'))
  : (() => { const id = createIdentity(); writeFileSync(IDFILE, JSON.stringify(id), { mode: 0o600 }); return id; })();

const engine = new Engine({ dbPath: DB, identity });
const [cmd, ...rest] = process.argv.slice(2);
const a = Object.fromEntries(rest.map((s) => (s.match(/^--([^=]+)=(.*)$/) || []).slice(1)).filter((x) => x.length));
const out = (x) => console.log(JSON.stringify(x, null, 2));

try {
  switch (cmd) {
    case 'whoami': out({ peerId: engine.peerId, fingerprint: identity.fingerprint, db: DB }); break;
    case 'store': out(engine.storeTriple({
      subject: a.subject, predicate: a.predicate, object: a.object,
      confidence: a.confidence ? Number(a.confidence) : undefined,
      temporality: a.temporality, context_slug: a.context ?? null,
    })); break;
    case 'query': out(engine.query(a.term, { maxDepth: a.depth ? Number(a.depth) : 1, explain: a.explain === 'true' })); break;
    case 'infer': out(engine.infer()); break;
    case 'decay': out(engine.decayPass({ dryRun: a.dry === 'true' })); break;
    case 'reinforce': out({ confidence: engine.reinforce(a.hash) }); break;
    case 'quarantine': out(engine.quarantineList()); break;
    case 'promote': out({ promoted: engine.promote(a.hash) }); break;
    case 'peer-add': out(engine.peerAdd(a.peer, readFileSync(a.key, 'utf8'), a.endpoint ?? null)); break;
    case 'peer-trust': engine.peerTrust(a.peer, a.level); out({ ok: true, peer: a.peer, level: a.level }); break;
    default:
      console.error('nsai-edge <cmd> — whoami | store | query | infer | decay | reinforce | quarantine | promote | peer-add | peer-trust');
      process.exit(2);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.code ?? 'ERROR', message: err.message }));
  process.exit(1);
}
