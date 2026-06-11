// Hybrid-Bridge nsai-edge ⇄ nsai-App (Symfony /mcp). ADDITIV & risikolos:
// - PUSH: eigene aktive SELF-Fakten (seit Watermark) → App (nsai.assert). Dual-Write.
// - PULL: externes Wissen aus der App, das lokal FEHLT → lokal ergänzen (Online-Diff).
// Lokal bleibt IMMER die Wahrheit (Backup). Ist die App nicht konfiguriert/erreichbar,
// ist die Bridge ein No-op und nsai-edge verhält sich exakt wie ohne sie.
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tripleHash } from './canonical.mjs';

const PULL_SLUG = 'bridge_app'; // markiert gepullte App-Fakten → vom Push ausgeschlossen (kein Echo-Loop)
const PUSH_LIMIT = 200;

// Default-Anbindung: der zentrale NSAI-Hub. Der Default-Key ist der serverseitig als
// "Extern" hinterlegte, BEWUSST GETEILTE Low-Trust-Informant (Aussagen laufen dort
// durch Quarantäne/Arbitrierung und sind rate-limitiert — kein privilegierter Zugriff).
// Eigener Informant: NSAI_APP_KEY setzen (Key in der App unter /account/source erzeugen);
// eigener Server: NSAI_APP_ENDPOINT. Komplett offline: NSAI_APP_ENDPOINT=off.
const DEFAULT_ENDPOINT = 'https://nsai.bittransit.io/mcp';
const DEFAULT_KEY = '3e67e8bc4b37eb37c92555dc33f24010d76dfbbf2db1d0b5';
const OPT_OUT = new Set(['off', 'none', 'false', '0']);

export function bridgeConfig(env = process.env) {
  const rawEndpoint = (env.NSAI_APP_ENDPOINT || '').trim();
  if (OPT_OUT.has(rawEndpoint.toLowerCase())) {
    return { endpoint: null, key: null, configured: false, defaultKey: false };
  }
  const endpoint = rawEndpoint || DEFAULT_ENDPOINT;
  const key = (env.NSAI_APP_KEY || '').trim() || DEFAULT_KEY;
  return { endpoint, key, configured: true, defaultKey: key === DEFAULT_KEY };
}

async function rpc(cfg, name, args, fetchImpl = fetch) {
  const res = await fetchImpl(cfg.endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }),
    signal: AbortSignal.timeout(8000),
  });
  return { status: res.status, data: await res.json().catch(() => ({})) };
}

function wmFile(dbPath) { return join(dirname(dbPath), 'bridge-state.json'); }
function readWatermark(dbPath) {
  const f = wmFile(dbPath);
  try { return existsSync(f) ? (JSON.parse(readFileSync(f, 'utf8')).lastPushAt || '') : ''; } catch { return ''; }
}
function writeWatermark(dbPath, value) {
  writeFileSync(wmFile(dbPath), JSON.stringify({ lastPushAt: value }), { mode: 0o600 });
}

/** PUSH: eigene Fakten (außer gepullte) seit Watermark an die App senden. */
export async function bridgePush(engine, db, dbPath, cfg, { fetchImpl } = {}) {
  if (!cfg.configured) return { skipped: true, pushed: 0 };

  const rows = db.prepare(`
    SELECT sn.name AS subject, e.predicate AS predicate, obj.name AS object,
           e.confidence AS confidence, e.created_at AS created_at
    FROM knowledge_edges e
    JOIN knowledge_nodes sn ON sn.id = e.subject_id
    JOIN knowledge_nodes obj ON obj.id = e.object_id
    WHERE e.local_status = 'active'
      AND e.origin_peer_id = ?
      AND (e.context_slug IS NULL OR e.context_slug != ?)
      AND e.created_at > ?
    ORDER BY e.created_at ASC
    LIMIT ${PUSH_LIMIT}
  `).all(engine.peerId, PULL_SLUG, readWatermark(dbPath));

  let pushed = 0;
  let lastAt = readWatermark(dbPath);
  for (const r of rows) {
    const { data } = await rpc(cfg, 'nsai.assert', {
      subject: r.subject, predicate: r.predicate, object: r.object, confidence: r.confidence,
    }, fetchImpl);
    if (!data?.result?.ok) break; // App weg/abgelehnt → Rest beim nächsten Lauf
    pushed++;
    lastAt = r.created_at;
  }
  if (pushed > 0) writeWatermark(dbPath, lastAt);

  return { pushed, scanned: rows.length };
}

/** PULL (Online-Diff): App-Fakten, die lokal FEHLEN, ergänzen. */
export async function bridgePull(engine, db, cfg, { fetchImpl } = {}) {
  if (!cfg.configured) return { skipped: true, added: 0 };

  const { data } = await rpc(cfg, 'nsai.query', {}, fetchImpl);
  const rows = data?.result?.results ?? [];
  const has = db.prepare('SELECT 1 FROM knowledge_edges WHERE triple_hash = ?');

  let added = 0;
  for (const r of rows) {
    if (r.status === 'quarantined' || r.status === 'disputed') continue; // nur aktive/unstrittige übernehmen
    if (has.get(tripleHash(r.subject, r.predicate, r.object))) continue; // schon lokal → kein Diff
    try {
      engine.storeTriple({
        subject: r.subject, predicate: r.predicate, object: r.object,
        confidence: r.effective_confidence ?? 700, context_slug: PULL_SLUG,
      });
      added++;
    } catch { /* Tripel passt nicht zu nsai-edge-Regeln (z. B. Prädikat-Regex) → überspringen */ }
  }
  return { added, fetched: rows.length };
}

export async function bridgeSync(engine, db, dbPath, cfg, opts = {}) {
  return {
    configured: cfg.configured,
    push: await bridgePush(engine, db, dbPath, cfg, opts),
    pull: await bridgePull(engine, db, cfg, opts),
  };
}
