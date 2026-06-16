// Hybrid-Bridge nsai-edge ⇄ nsai-App (Symfony /mcp). ADDITIV & risikolos:
// - PUSH: eigene aktive SELF-Fakten (seit Watermark) → App (nsai.assert). Dual-Write.
// - PULL: externes Wissen aus der App, das lokal FEHLT → lokal ergänzen (Online-Diff).
// Lokal bleibt IMMER die Wahrheit (Backup). Ist die App nicht konfiguriert/erreichbar,
// ist die Bridge ein No-op und nsai-edge verhält sich exakt wie ohne sie.
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

/**
 * ENQUEUE (deterministisch): jede eigene aktive Aussage (außer gepullte), die noch nicht in der
 * Outbox liegt, wird eingereiht. triple_hash = PK ⇒ idempotent (INSERT OR IGNORE + NOT EXISTS):
 * dasselbe Tripel landet nie doppelt im Puffer, auch nicht über viele Aufrufe. Reiner SQL-Set-Diff,
 * kein Watermark/Zeitfenster — robust gegen Uhrsprünge und verlustfrei bei Offline.
 *
 * @returns {number} Anzahl neu eingereihter Tripel
 */
export function enqueueOutbox(engine, db, { limit = PUSH_LIMIT } = {}) {
  const r = db.prepare(`
    INSERT OR IGNORE INTO bridge_outbox (triple_hash, subject, predicate, object, confidence)
    SELECT e.triple_hash, sn.name, e.predicate, obj.name, e.confidence
    FROM knowledge_edges e
    JOIN knowledge_nodes sn ON sn.id = e.subject_id
    JOIN knowledge_nodes obj ON obj.id = e.object_id
    WHERE e.local_status = 'active'
      AND e.origin_peer_id = ?
      AND (e.context_slug IS NULL OR e.context_slug != ?)
      AND NOT EXISTS (SELECT 1 FROM bridge_outbox o WHERE o.triple_hash = e.triple_hash)
    LIMIT ${Number(limit) | 0}
  `).run(engine.peerId, PULL_SLUG);
  return Number(r.changes || 0);
}

/**
 * FLUSH (Reconnect-Replay): liefert die ausstehenden Outbox-Tripel an den Hub. Jede Zustellung ist
 * idempotent (gleiches Tripel → der Hub dedupliziert/korroboriert), und delivered-Zeilen bleiben als
 * Ledger liegen, sodass nie doppelt gepusht wird. Beim ersten Fehler (App weg) bricht der Lauf
 * geordnet ab — der Rest bleibt gepuffert und wird beim nächsten Versuch zugestellt.
 *
 * @returns {Promise<{pushed:number, pending:number, failed:boolean}>}
 */
export async function flushOutbox(db, cfg, { fetchImpl } = {}) {
  const pending = db.prepare(
    "SELECT triple_hash, subject, predicate, object, confidence FROM bridge_outbox WHERE status='pending' ORDER BY enqueued_at ASC LIMIT ?",
  ).all(PUSH_LIMIT);

  const markDelivered = db.prepare("UPDATE bridge_outbox SET status='delivered', delivered_at=datetime('now'), last_error=NULL WHERE triple_hash=?");
  const markFailed = db.prepare('UPDATE bridge_outbox SET attempts=attempts+1, last_error=? WHERE triple_hash=?');

  let pushed = 0;
  let failed = false;
  for (const r of pending) {
    let ok = false;
    let err = 'unreachable';
    try {
      const { data } = await rpc(cfg, 'nsai.assert', {
        subject: r.subject, predicate: r.predicate, object: r.object, confidence: r.confidence,
      }, fetchImpl);
      ok = data?.result?.ok === true;
      if (!ok) err = `rejected:${JSON.stringify(data?.error ?? data?.result ?? {}).slice(0, 120)}`;
    } catch (e) { err = String(e?.message || e).slice(0, 120); }

    if (ok) { markDelivered.run(r.triple_hash); pushed++; }
    else { markFailed.run(err, r.triple_hash); failed = true; break; } // App weg → Rest bleibt gepuffert
  }

  const remaining = db.prepare("SELECT COUNT(*) c FROM bridge_outbox WHERE status='pending'").get().c;
  return { pushed, pending: remaining, failed };
}

/** Outbox-Diagnose (für Status-Ausgabe): wie viele Tripel warten/zugestellt sind. */
export function outboxStats(db) {
  const row = db.prepare("SELECT SUM(status='pending') pending, SUM(status='delivered') delivered FROM bridge_outbox").get();
  return { pending: Number(row?.pending || 0), delivered: Number(row?.delivered || 0) };
}

/**
 * PUSH = Direktzugriff: eigene Fakten einreihen (deterministisch, lokal) + sofort an den Hub
 * zustellen (Write-Through). Ist der Hub offline, bleiben sie in der Outbox und werden beim nächsten
 * Lauf (Write/Interval/Startup) nachgeliefert. dbPath bleibt nur aus Signatur-Kompatibilität.
 */
export async function bridgePush(engine, db, _dbPath, cfg, { fetchImpl } = {}) {
  if (!cfg.configured) return { skipped: true, pushed: 0 };
  const enqueued = enqueueOutbox(engine, db);
  const flushed = await flushOutbox(db, cfg, { fetchImpl });
  return { pushed: flushed.pushed, enqueued, pending: flushed.pending, scanned: enqueued };
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

/** Leichte Key-Probe (read-only, tools/list): 'ok' | 'invalid' (401/403) | 'unreachable'. */
export async function probeKey(cfg, fetchImpl = fetch) {
  try {
    const res = await fetchImpl(cfg.endpoint, {
      method: 'POST',
      headers: { Authorization: `Bearer ${cfg.key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
      signal: AbortSignal.timeout(8000),
    });
    if (res.status === 401 || res.status === 403) return 'invalid';
    return res.ok ? 'ok' : 'unreachable';
  } catch {
    return 'unreachable';
  }
}

/**
 * Effektive Konfiguration: Ist ein EIGENER Key konfiguriert, aber ungueltig (401/403),
 * faellt die Bridge auf das Default-Paar (Hub + geteilter Extern-Key) zurueck —
 * leerer Key landet bereits in bridgeConfig() auf dem Default. Sync laeuft so IMMER
 * weiter; der Fallback wird auf stderr gemeldet (Key still verlieren waere schlimmer).
 */
export async function resolveBridgeConfig(cfg = bridgeConfig(), { fetchImpl } = {}) {
  if (!cfg.configured || cfg.defaultKey) return cfg;
  if (await probeKey(cfg, fetchImpl) !== 'invalid') return cfg;

  process.stderr.write('nsai-edge bridge: konfigurierter NSAI_APP_KEY ungueltig (401/403) → Fallback auf Default-Hub + Extern-Key.\n');

  return { ...bridgeConfig({}), fallback: true };
}

export async function bridgeSync(engine, db, dbPath, cfg, opts = {}) {
  const effective = await resolveBridgeConfig(cfg, opts);

  return {
    configured: effective.configured,
    defaultKey: effective.defaultKey,
    fallback: effective.fallback === true,
    push: await bridgePush(engine, db, dbPath, effective, opts),
    pull: await bridgePull(engine, db, effective, opts),
    outbox: outboxStats(db),
  };
}
