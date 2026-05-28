// SQLite-Schema (KONZEPT §8.1) via node:sqlite (DatabaseSync, kein nativer Build).
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;
PRAGMA busy_timeout = 5000;

CREATE TABLE IF NOT EXISTS knowledge_nodes (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT UNIQUE NOT NULL CHECK(length(name) BETWEEN 2 AND 160),
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS knowledge_edges (
  triple_hash TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL CHECK(length(predicate) BETWEEN 2 AND 50),
  object_id TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 1000),            -- lokaler Live-Wert (Decay/Reinforcement)
  asserted_confidence INTEGER NOT NULL CHECK(asserted_confidence BETWEEN 0 AND 1000), -- signierter Origin-Wert (unveränderlich)
  source_type TEXT NOT NULL DEFAULT 'llm',     -- Autoritäts-Klasse (signiert): gesetz/behoerde/fachquelle/web/llm/manual/sensor
  asserted_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z', -- Behauptungs-Zeitpunkt (signiert, für Recency)
  temporality TEXT NOT NULL CHECK(temporality IN ('eternal','stable','temporal','ephemeral')),
  local_status TEXT NOT NULL DEFAULT 'active' CHECK(local_status IN ('active','quarantined','superseded','retracted')),
  origin_peer_id TEXT NOT NULL,                -- Erstbehaupter (signiert)
  relayed_by TEXT,                             -- letzter Hop (unsigniert, Transport-Metadatum)
  signature TEXT NOT NULL,                     -- Origin-Signatur über die unveränderliche Aussage
  vector_clock TEXT NOT NULL,
  derived_from TEXT,
  context_slug TEXT,
  valid_from TEXT,                             -- UC-BT: lokale Event-/Valid-Time-Start (Default-Fallback = asserted_at), NICHT im Wire
  valid_to TEXT,                               -- UC-BT: lokales Gültigkeits-Ende (NULL = offen), NICHT im Wire
  asserted_at_norm TEXT,                       -- UC-5d: UTC-Z-normalisierte Form von asserted_at für lexikografisch korrekte Lese-Linse; NICHT im Wire (Signatur prüft Original).
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(subject_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(object_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS peers (
  peer_id TEXT PRIMARY KEY NOT NULL,
  public_key TEXT NOT NULL,
  fingerprint TEXT NOT NULL,
  endpoint TEXT,
  trust_level TEXT NOT NULL DEFAULT 'untrusted'
    CHECK(trust_level IN ('untrusted','limited','full','authoritative')),
  last_clock TEXT,
  cluster_id TEXT                            -- UC-MS Slice #M.1: optionale Cluster-Markierung; NULL ⇒ Fallback peer_id
);

-- UC-MS Slice #M.1: Multi-Source-Corroboration. Eine Zeile pro (Tripel, Origin) — Trust-Quorum-Aggregation.
CREATE TABLE IF NOT EXISTS triple_endorsements (
  triple_hash TEXT NOT NULL,
  origin_peer_id TEXT NOT NULL,
  source_type TEXT NOT NULL DEFAULT 'llm',
  asserted_confidence INTEGER NOT NULL CHECK(asserted_confidence BETWEEN 0 AND 1000),
  asserted_at TEXT NOT NULL,                  -- Wire-Original (für signingString-Re-Verify)
  asserted_at_norm TEXT,                      -- UC-5d-konsistent
  signature TEXT NOT NULL,
  created_at TEXT DEFAULT (datetime('now')),
  PRIMARY KEY (triple_hash, origin_peer_id),
  FOREIGN KEY (triple_hash) REFERENCES knowledge_edges(triple_hash) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_endorsements_hash ON triple_endorsements(triple_hash);
CREATE INDEX IF NOT EXISTS idx_endorsements_origin ON triple_endorsements(origin_peer_id);

CREATE INDEX IF NOT EXISTS idx_edges_status ON knowledge_edges(local_status);
CREATE INDEX IF NOT EXISTS idx_edges_subject ON knowledge_edges(subject_id);
CREATE INDEX IF NOT EXISTS idx_edges_object ON knowledge_edges(object_id);

-- Episodische Schicht (UC-EP, NS-Mem). LOKAL/peer-privat — NICHT im Wire-Vertrag.
CREATE TABLE IF NOT EXISTS episodes (
  id TEXT PRIMARY KEY NOT NULL,
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 8000),
  source_type TEXT NOT NULL DEFAULT 'llm',  -- Herkunfts-Label, KEINE Autoritäts-Stufe
  occurred_at TEXT NOT NULL,                -- ggf. mit Offset; das was reinkommt
  occurred_at_norm TEXT,                    -- UC-5d: UTC-Z-normalisiert; verwendet für lexikografische Filter (since/until)
  context_slug TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS episode_triples (
  episode_id TEXT NOT NULL,
  triple_hash TEXT NOT NULL,                 -- bewusst KEIN FK auf edges (GC darf Tripel entfernen)
  PRIMARY KEY (episode_id, triple_hash),
  FOREIGN KEY(episode_id) REFERENCES episodes(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_episodes_occurred ON episodes(occurred_at);
CREATE INDEX IF NOT EXISTS idx_episodes_context ON episodes(context_slug);
CREATE INDEX IF NOT EXISTS idx_episode_triples_hash ON episode_triples(triple_hash);
`;

// knowledge_edges-DDL OHNE PRAGMA/IF-NOT-EXISTS — für den transaktionalen Rebuild der Migration
// (WAL-PRAGMA ist in einer Transaktion verboten). MUSS mit SCHEMA.knowledge_edges deckungsgleich sein.
const EDGES_REBUILD = `
CREATE TABLE knowledge_edges (
  triple_hash TEXT PRIMARY KEY NOT NULL,
  subject_id TEXT NOT NULL,
  predicate TEXT NOT NULL CHECK(length(predicate) BETWEEN 2 AND 50),
  object_id TEXT NOT NULL,
  confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 1000),
  asserted_confidence INTEGER NOT NULL CHECK(asserted_confidence BETWEEN 0 AND 1000),
  source_type TEXT NOT NULL DEFAULT 'llm',
  asserted_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  temporality TEXT NOT NULL CHECK(temporality IN ('eternal','stable','temporal','ephemeral')),
  local_status TEXT NOT NULL DEFAULT 'active' CHECK(local_status IN ('active','quarantined','superseded','retracted')),
  origin_peer_id TEXT NOT NULL,
  relayed_by TEXT,
  signature TEXT NOT NULL,
  vector_clock TEXT NOT NULL,
  derived_from TEXT,
  context_slug TEXT,
  valid_from TEXT,
  valid_to TEXT,
  asserted_at_norm TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(subject_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(object_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);
CREATE INDEX idx_edges_status ON knowledge_edges(local_status);
CREATE INDEX idx_edges_subject ON knowledge_edges(subject_id);
CREATE INDEX idx_edges_object ON knowledge_edges(object_id);
`;

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  migrateRetractedStatus(db);
  migrateValidityColumns(db);
  migrateUtcZNormalization(db);
  migrateClusterId(db);
  return db;
}

// UC-MS Slice #M.1: additive `peers.cluster_id`-Spalte (idempotent).
function migrateClusterId(db) {
  const cols = new Set(db.prepare("PRAGMA table_info('peers')").all().map((r) => r.name));
  if (!cols.has('cluster_id')) db.exec('ALTER TABLE peers ADD COLUMN cluster_id TEXT');
}

// UC-5d: additive Spalten + idempotente Befüllung der UTC-Z-Normalisierung.
// Wire/Signatur bleiben unangetastet (Original-`asserted_at`/`occurred_at` werden NICHT modifiziert).
// Beim Lesen verwendet die Engine `asserted_at_norm`/`occurred_at_norm` für lexikografisch
// korrekten Vergleich. Idempotent — zweiter Lauf no-op (WHERE _norm IS NULL).
function migrateUtcZNormalization(db) {
  const edgeCols = new Set(db.prepare("PRAGMA table_info('knowledge_edges')").all().map((r) => r.name));
  if (!edgeCols.has('asserted_at_norm')) db.exec('ALTER TABLE knowledge_edges ADD COLUMN asserted_at_norm TEXT');
  const epCols = new Set(db.prepare("PRAGMA table_info('episodes')").all().map((r) => r.name));
  if (!epCols.has('occurred_at_norm')) db.exec('ALTER TABLE episodes ADD COLUMN occurred_at_norm TEXT');

  // JavaScript-seitig normalisieren (SQLite hat kein ISO-Z-Toleranz-Built-in).
  // Nur Zeilen mit _norm IS NULL anfassen → idempotent.
  const fillRows = (table, srcCol, normCol) => {
    const rows = db.prepare(`SELECT rowid, ${srcCol} FROM ${table} WHERE ${normCol} IS NULL AND ${srcCol} IS NOT NULL`).all();
    if (!rows.length) return;
    const upd = db.prepare(`UPDATE ${table} SET ${normCol}=? WHERE rowid=?`);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const r of rows) {
        const t = Date.parse(r[srcCol]);
        const norm = Number.isNaN(t) ? null : new Date(t).toISOString();
        upd.run(norm, r.rowid);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  fillRows('knowledge_edges', 'asserted_at', 'asserted_at_norm');
  fillRows('episodes', 'occurred_at', 'occurred_at_norm');

  // Adversarial 🟡 (Re-Audit): `valid_from`/`valid_to` sind lokale Spalten (nicht im Wire/Signatur)
  // — eine In-Place-Normalisierung ist hier zulässig. Engine schreibt sie schon via `_normIso`,
  // aber Altbestand vor Slice #5-Fix (oder externer SQL-Tool-Schreibung) könnte Offset-Form tragen.
  // Idempotent: nur Werte mit Offset-Notation anfassen.
  const fixInPlace = (table, col) => {
    const offsetRows = db.prepare(`SELECT rowid, ${col} FROM ${table} WHERE ${col} IS NOT NULL AND (${col} LIKE '%+%' OR ${col} GLOB '*-[0-9][0-9]:[0-9][0-9]')`).all();
    if (!offsetRows.length) return;
    const upd = db.prepare(`UPDATE ${table} SET ${col}=? WHERE rowid=?`);
    db.exec('BEGIN IMMEDIATE');
    try {
      for (const r of offsetRows) {
        const t = Date.parse(r[col]);
        if (!Number.isNaN(t)) upd.run(new Date(t).toISOString(), r.rowid);
      }
      db.exec('COMMIT');
    } catch (e) { db.exec('ROLLBACK'); throw e; }
  };
  fixInPlace('knowledge_edges', 'valid_from');
  fixInPlace('knowledge_edges', 'valid_to');
}

// UC-BT (Slice #5): additive valid_from/valid_to-Spalten für Bestands-DBs (idempotent, kein Rebuild).
// Reihenfolge-unabhängig zum retracted-Rebuild — dieser kopiert namensbasiert die Spalten-Schnittmenge.
function migrateValidityColumns(db) {
  const cols = new Set(db.prepare("PRAGMA table_info('knowledge_edges')").all().map((r) => r.name));
  if (!cols.has('valid_from')) db.exec('ALTER TABLE knowledge_edges ADD COLUMN valid_from TEXT');
  if (!cols.has('valid_to')) db.exec('ALTER TABLE knowledge_edges ADD COLUMN valid_to TEXT');
}

// Idempotente, CRASH-SICHERE Migration: ältere persistente DBs haben die CHECK-Constraint ohne
// 'retracted' (UC-TMS Slice #1). SQLite kann CHECK nicht per ALTER ändern → Tabelle neu aufbauen,
// aber atomar in EINER Transaktion (Adversarial-Finding 🔴-1: ein Abbruch mitten im Rebuild dürfte
// keine Daten verlieren). Resumption: ein zurückgebliebenes _old → unterbrochener Lauf → zurückrollen.
function migrateRetractedStatus(db) {
  // Resumption (vor-transaktionale Altlast): neue, evtl. leere Tabelle verwerfen, _old zurückbenennen.
  if (db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='knowledge_edges_old'").get()) {
    db.exec('DROP TABLE IF EXISTS knowledge_edges');
    db.exec('ALTER TABLE knowledge_edges_old RENAME TO knowledge_edges');
  }
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_edges'").get();
  if (!row || String(row.sql).includes("'retracted'")) return; // schon aktuell

  // Spalten-Schnittmenge (namensbasiert — Reihenfolge kann durch frühere ALTER ADD COLUMN abweichen),
  // COALESCE für nachgerüstete NOT-NULL-Felder.
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec('ALTER TABLE knowledge_edges RENAME TO knowledge_edges_old');
    db.exec('DROP INDEX IF EXISTS idx_edges_status; DROP INDEX IF EXISTS idx_edges_subject; DROP INDEX IF EXISTS idx_edges_object;');
    db.exec(EDGES_REBUILD); // neue Tabelle + Indizes, ohne PRAGMA (tx-fähig)
    const newCols = db.prepare("PRAGMA table_info('knowledge_edges')").all().map((r) => r.name);
    const oldCols = new Set(db.prepare("PRAGMA table_info('knowledge_edges_old')").all().map((r) => r.name));
    const backfill = {
      asserted_confidence: 'COALESCE(asserted_confidence, confidence)',
      source_type: "COALESCE(source_type, 'llm')",
      asserted_at: "COALESCE(asserted_at, '1970-01-01T00:00:00Z')",
    };
    const cols = newCols.filter((c) => oldCols.has(c));
    const selects = cols.map((c) => backfill[c] ?? c);
    db.exec(`INSERT INTO knowledge_edges (${cols.join(',')}) SELECT ${selects.join(',')} FROM knowledge_edges_old`);
    db.exec('DROP TABLE knowledge_edges_old');
    db.exec('COMMIT');
  } catch (e) {
    db.exec('ROLLBACK');
    db.exec('PRAGMA foreign_keys=ON');
    throw e;
  }
  db.exec('PRAGMA foreign_keys=ON');
}
