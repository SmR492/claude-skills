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
    // System/Mensch-Tür für den ECHTEN Decay-Lauf (Final-Pass Origin-Guard): das MCP-Tool
    // graph__decay_pass ist dry_run-erzwungen (read-only Vorschau, kann fremde Edges nicht
    // eliminieren). Hier — direkt an der Engine, KEIN MCP — läuft der echte Decay (default;
    // --dry=true nur Vorschau). KONZEPT §UC-04: Akteur=System.
    case 'decay': out(engine.decayPass({ dryRun: a.dry === 'true' })); break;
    case 'reinforce': out({ confidence: engine.reinforce(a.hash) }); break;
    case 'quarantine': out(engine.quarantineList()); break;
    case 'promote': out({ promoted: engine.promote(a.hash) }); break;
    case 'peer-add': out(engine.peerAdd(a.peer, readFileSync(a.key, 'utf8'), a.endpoint ?? null)); break;
    // Mensch-Tür: Trust-VERGABE ist ein Autoritäts-Akt → NUR hier (direkt an der Engine, KEIN MCP).
    // 🔴-1: das ungegatete graph__peer_trust-MCP-Tool wurde entfernt; Claude kann nur via
    // graph__propose_peer_trust einen Vorschlag erzeugen, den der Mensch hier (oder via approve) vollzieht.
    // Akzeptiert positional `peer-trust <peer_id> <level>` (analog approve/reject) ODER --peer/--level.
    case 'peer-trust': {
      const peer = a.peer ?? rest[0];
      const level = a.level ?? rest[1];
      engine.peerTrust(peer, level);
      out({ ok: true, peer, level });
      break;
    }
    // ADR 0019 Slice S6a — Mensch-Tür: Two-Door-Approval-Gate (direkt an der Engine, KEIN MCP).
    // Claude (MCP) erzeugt nur Vorschläge in pending_actions; hier vollzieht der Mensch.
    case 'review': {
      const status = a.status ?? 'pending';
      const rows = engine.listPending({ status });
      out({ status, count: rows.length, pending: rows.map((r) => ({
        id: r.id,
        kind: r.kind,
        proposed_by: r.proposed_by,
        created_at: r.created_at,
        // menschenlesbare Tragweite je kind:
        scope: r.kind === 'reject'
          ? { triple_hash: r.preview?.triple_hash, affected_derived_count: r.preview?.affected_derived?.length ?? 0, current_status: r.preview?.current_status }
          : r.kind === 'promote_fiction'
            ? { subject: r.preview?.subject, predicate: r.preview?.predicate, object: r.preview?.object, already_fact: r.preview?.already_fact }
            : r.kind === 'peer_trust'
              ? { peer_id: r.preview?.peer_id, level: r.preview?.level, current_level: r.preview?.current_level }
              : r.kind === 'set_validity'
                ? { triple_hash: r.preview?.triple_hash, origin_peer_id: r.preview?.origin_peer_id, current_valid_from: r.preview?.current_valid_from, current_valid_to: r.preview?.current_valid_to, new_valid_from: r.preview?.new_valid_from, new_valid_to: r.preview?.new_valid_to }
                : r.kind === 'supersede_temporal'
                  ? { subject: r.preview?.subject, predicate: r.preview?.predicate, object: r.preview?.object, as_of: r.preview?.as_of, affected_edges: r.preview?.affected_edges ?? [] }
                  : { target_id: r.preview?.target_id, adj_class: r.preview?.adj_class, delta: r.preview?.delta, current_trust: r.preview?.current_trust },
      })) });
      break;
    }
    case 'approve': out(engine.approveAction(Number(rest[0] ?? a.id))); break;
    case 'reject': out(engine.rejectAction(Number(rest[0] ?? a.id), a.reason ?? null)); break;
    default:
      console.error('nsai-edge <cmd> — whoami | store | query | infer | decay | reinforce | quarantine | promote | peer-add | peer-trust | review | approve <id> | reject <id>');
      process.exit(2);
  }
} catch (err) {
  console.error(JSON.stringify({ error: err.code ?? 'ERROR', message: err.message }));
  process.exit(1);
}
