// SQLite-Schema (KONZEPT §8.1) via node:sqlite (DatabaseSync, kein nativer Build).
import { DatabaseSync } from 'node:sqlite';

const SCHEMA = `
PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;

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
  confidence INTEGER NOT NULL CHECK(confidence BETWEEN 0 AND 1000),
  temporality TEXT NOT NULL CHECK(temporality IN ('eternal','stable','temporal','ephemeral')),
  local_status TEXT NOT NULL DEFAULT 'active' CHECK(local_status IN ('active','quarantined','superseded')),
  origin_peer_id TEXT NOT NULL,
  signature TEXT NOT NULL,
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
  return db;
}
