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
  last_clock TEXT
);

CREATE INDEX IF NOT EXISTS idx_edges_status ON knowledge_edges(local_status);
CREATE INDEX IF NOT EXISTS idx_edges_subject ON knowledge_edges(subject_id);
CREATE INDEX IF NOT EXISTS idx_edges_object ON knowledge_edges(object_id);
`;

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  migrateRetractedStatus(db);
  return db;
}

// Idempotente Migration: ältere persistente DBs haben die CHECK-Constraint ohne 'retracted'
// (UC-TMS Slice #1). SQLite kann CHECK nicht per ALTER ändern → Tabelle einmalig neu aufbauen.
function migrateRetractedStatus(db) {
  const row = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='knowledge_edges'").get();
  if (!row || String(row.sql).includes("'retracted'")) return; // schon aktuell
  db.exec('PRAGMA foreign_keys=OFF');
  db.exec('ALTER TABLE knowledge_edges RENAME TO knowledge_edges_old');
  db.exec('DROP INDEX IF EXISTS idx_edges_status');
  db.exec('DROP INDEX IF EXISTS idx_edges_subject');
  db.exec('DROP INDEX IF EXISTS idx_edges_object');
  db.exec(SCHEMA); // legt knowledge_edges mit neuer CHECK + Indizes neu an (nodes/peers IF NOT EXISTS)
  // Namensbasiert kopieren (Spaltenreihenfolge kann durch frühere ALTER ADD COLUMN abweichen →
  // SELECT * würde positionsbasiert falsch mappen). COALESCE für nachgerüstete NOT-NULL-Felder.
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
  db.exec('PRAGMA foreign_keys=ON');
}
