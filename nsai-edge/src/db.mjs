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
  user_rejected_at TEXT,                       -- UC-TA Slice #6.1: ISO-UTC-Z-Timestamp, gesetzt NUR durch reject(hash) (explizit-Nutzer-Aktion). NULL für System-Quarantaene/Decay-Supersede/TMS-Retraktion. learnTrustAdjustments zaehlt NUR Edges mit user_rejected_at IS NOT NULL.
  last_recalled_at TEXT,                       -- UC-AD Slice #6.3: ISO-UTC-Z-Timestamp, gesetzt durch markRecalled(hashes). decayPass dividiert decayPerPeriod durch recallDecayDivisor wenn last_recalled_at innerhalb recallProtectionDays.
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
-- R10-Indizes (asserted_at_norm, user_rejected_at, last_recalled_at) werden NACH den Migrations
-- angelegt (applyPostMigrationIndexes), da die Spalten erst dort sicher existieren.

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
-- ADR 0019 Slice S1a: append-only Impuls-Ledger (LOKAL, Read-Lens — NICHT im Wire/Signatur).
-- Trust ist kein gespeicherter Zustand: trustOf(id) foldet diese Events deterministisch (integer-‰).
CREATE TABLE IF NOT EXISTS trust_events (
  event_hash TEXT PRIMARY KEY NOT NULL,
  target_id TEXT NOT NULL,
  source_id TEXT,
  adj_class TEXT NOT NULL CHECK(adj_class IN ('human_endorse','human_reject','oracle_higher_tier','auto_corroborate')),
  delta_promille INTEGER NOT NULL CHECK(delta_promille BETWEEN -1000 AND 1000),
  dedup_hash TEXT,
  domain TEXT,
  occurred_at_norm TEXT NOT NULL,
  epoch INTEGER NOT NULL DEFAULT 0,            -- ADR 0019 S1b: Decay-Epoche bei Insert (Perioden-Modell B)
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_trust_events_target ON trust_events(target_id);
CREATE INDEX IF NOT EXISTS idx_trust_events_source ON trust_events(source_id);
-- append-only HART erzwingen (nicht nur Konvention): UPDATE/DELETE abbrechen (AC-T.6).
CREATE TRIGGER IF NOT EXISTS trust_events_no_update BEFORE UPDATE ON trust_events BEGIN SELECT RAISE(ABORT, 'trust_events ist append-only'); END;
CREATE TRIGGER IF NOT EXISTS trust_events_no_delete BEFORE DELETE ON trust_events BEGIN SELECT RAISE(ABORT, 'trust_events ist append-only'); END;
-- ADR 0019 S1b: globaler, monotoner Decay-Epochen-Zähler (eine Zeile). Wall-clock-frei →
-- trustOf bleibt replay-/conformance-deterministisch (§4.3). decayPass() inkrementiert ihn.
CREATE TABLE IF NOT EXISTS trust_meta (id INTEGER PRIMARY KEY CHECK(id=1), epoch INTEGER NOT NULL DEFAULT 0);
INSERT OR IGNORE INTO trust_meta (id, epoch) VALUES (1, 0);
CREATE INDEX IF NOT EXISTS idx_episodes_occurred ON episodes(occurred_at);
CREATE INDEX IF NOT EXISTS idx_episodes_context ON episodes(context_slug);
CREATE INDEX IF NOT EXISTS idx_episode_triples_hash ON episode_triples(triple_hash);
-- R10-Index occurred_at_norm: post-migration (s. applyPostMigrationIndexes).

-- UC-VS Slice #R3: FTS5 contentless-Index für Episoden-Volltext (BM25). Tokenizer mit Umlaut-Toleranz.
-- contentless: episodes ist die Quelle; episodes_fts speichert nur den invertierten Index.
-- Trigger halten den Index synchron in derselben Transaktion (ACID).
CREATE VIRTUAL TABLE IF NOT EXISTS episodes_fts USING fts5(
  content,
  content='episodes',
  content_rowid='rowid',
  tokenize="unicode61 remove_diacritics 2"
);
CREATE TRIGGER IF NOT EXISTS episodes_ai AFTER INSERT ON episodes BEGIN
  INSERT INTO episodes_fts(rowid, content) VALUES (new.rowid, new.content);
END;
-- WHEN-Guard: NUR re-indexieren, wenn sich der indexierte content aendert. Ein reiner
-- occurred_at_norm-/context_slug-Backfill (Nicht-Content-Update) fasst den FTS-Index dann NICHT an
-- und kann keinen FTS5-delete-mismatch (malformed database) ausloesen, auch nicht bei einem (aus
-- anderem Grund) desynchronisierten Index. Siehe migrateEpisodesFtsTrigger fuer Bestands-DBs.
CREATE TRIGGER IF NOT EXISTS episodes_au AFTER UPDATE ON episodes WHEN old.content IS NOT new.content BEGIN
  INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
  INSERT INTO episodes_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER IF NOT EXISTS episodes_ad AFTER DELETE ON episodes BEGIN
  INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content);
END;
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
  user_rejected_at TEXT,
  last_recalled_at TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY(subject_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE,
  FOREIGN KEY(object_id) REFERENCES knowledge_nodes(id) ON DELETE CASCADE
);
CREATE INDEX idx_edges_status ON knowledge_edges(local_status);
CREATE INDEX idx_edges_subject ON knowledge_edges(subject_id);
CREATE INDEX idx_edges_object ON knowledge_edges(object_id);
`;

// R10 Performance-Haertung: Indizes auf Spalten, die erst durch Migrations eingefuehrt wurden.
// Idempotent via IF NOT EXISTS; muss NACH allen ALTER TABLE-Migrationen laufen, damit die
// referenzierten Spalten sicher existieren. Schliesst die heissen Lesepfade: UC-BT as_of/since/until,
// UC-AD Recall-Bonus in decayPass, UC-TA user_rejected_at-Lernen, UC-EP since/until-Filter.
function applyPostMigrationIndexes(db) {
  db.exec(
    "CREATE INDEX IF NOT EXISTS idx_edges_asserted_norm ON knowledge_edges(asserted_at_norm);" +
    "CREATE INDEX IF NOT EXISTS idx_edges_user_rejected_at ON knowledge_edges(user_rejected_at);" +
    "CREATE INDEX IF NOT EXISTS idx_edges_last_recalled_at ON knowledge_edges(last_recalled_at);" +
    "CREATE INDEX IF NOT EXISTS idx_episodes_occurred_norm ON episodes(occurred_at_norm);",
  );
}

export function openDb(path = ':memory:') {
  const db = new DatabaseSync(path);
  db.exec(SCHEMA);
  migrateEpisodesFtsTrigger(db);   // MUSS vor migrateUtcZNormalization laufen (s. Funktions-Doku)
  migrateRetractedStatus(db);
  migrateValidityColumns(db);
  migrateUtcZNormalization(db);
  migrateClusterId(db);
  migrateUserRejectedAt(db);
  migrateLastRecalledAt(db);
  migrateTrustEventsEpoch(db);
  migrateEpisodesFts(db);
  applyPostMigrationIndexes(db);
  return db;
}

// ADR 0019 S1b: `epoch`-Spalte auf trust_events für Bestands-DBs nachrüsten (Bestands-Events → Epoche 0).
// ALTER TABLE ADD COLUMN ist kein Row-UPDATE → der append-only-Trigger feuert nicht. trust_meta wird
// bereits durch SCHEMA (CREATE IF NOT EXISTS + INSERT OR IGNORE) auf jedem openDb idempotent angelegt.
function migrateTrustEventsEpoch(db) {
  const cols = new Set(db.prepare("PRAGMA table_info('trust_events')").all().map((r) => r.name));
  if (!cols.has('epoch')) db.exec('ALTER TABLE trust_events ADD COLUMN epoch INTEGER NOT NULL DEFAULT 0');
}

// R-Fix (FTS-Migrations-Bug): den `episodes_au`-Trigger auf Bestands-DBs mit dem content-WHEN-Guard
// nachrüsten. MUSS vor migrateUtcZNormalization laufen — sonst feuert dessen occurred_at_norm-Backfill
// den alten (ungeguardeten) Trigger und crasht bei desynchronisiertem FTS-Index mit „database disk
// image is malformed" (genau dieser Bug ließ den MCP-Server beim Startup crashen). DROP+CREATE ist
// idempotent: neue DBs tragen den Guard schon aus SCHEMA, hier wird er identisch neu gesetzt.
function migrateEpisodesFtsTrigger(db) {
  // Adversarial 🟡-2: DROP+CREATE atomar — kein Fenster, in dem der Trigger gedroppt aber nicht
  // neu angelegt ist (sonst liefe der Index bei einem Crash dazwischen auf Schreibungen auseinander).
  db.exec('BEGIN IMMEDIATE');
  try {
    db.exec(
      'DROP TRIGGER IF EXISTS episodes_au;' +
      'CREATE TRIGGER episodes_au AFTER UPDATE ON episodes WHEN old.content IS NOT new.content BEGIN ' +
      "INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content); " +
      'INSERT INTO episodes_fts(rowid, content) VALUES (new.rowid, new.content); END;',
    );
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// UC-VS Slice #R3: idempotenter Initial-Build des FTS5-Index.
// Adversarial 🔴-2: `COUNT(*) FROM episodes_fts` reflektiert bei External-Content-Tables die
// QUELLE (episodes), nicht den Index. Echter Index-Count steht in der Shadow-Table `episodes_fts_docsize`.
// Wenn diese kleiner ist als episodes-Count → Rebuild nötig (alte DB ohne FTS5 oder versehentlich geleert).
function migrateEpisodesFts(db) {
  const epCount = db.prepare('SELECT COUNT(*) c FROM episodes').get().c;
  if (!epCount) return;
  // Shadow-Table existiert mit CREATE VIRTUAL TABLE; falls nicht vorhanden, sicheren Fallback nehmen.
  let indexedCount = 0;
  try {
    indexedCount = db.prepare('SELECT COUNT(*) c FROM episodes_fts_docsize').get().c;
  } catch { indexedCount = 0; } // FTS5-Shadow fehlt → Migration nötig
  if (indexedCount >= epCount) return; // Index ist auf Stand
  db.exec('BEGIN IMMEDIATE');
  try {
    db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES('rebuild')").run();
    db.exec('COMMIT');
  } catch (e) { db.exec('ROLLBACK'); throw e; }
}

// UC-MS Slice #M.1: additive `peers.cluster_id`-Spalte (idempotent).
function migrateClusterId(db) {
  const cols = new Set(db.prepare("PRAGMA table_info('peers')").all().map((r) => r.name));
  if (!cols.has('cluster_id')) db.exec('ALTER TABLE peers ADD COLUMN cluster_id TEXT');
}

// UC-TA Slice #6.1: additive `knowledge_edges.user_rejected_at`-Spalte (idempotent).
// NUR `reject(hash)` (explizit-Nutzer-Aktion) setzt diesen Timestamp. System-Quarantäne, Decay,
// TMS-Retraktion lassen ihn NULL. learnTrustAdjustments zählt nur diese Spalte (Adversarial 🔴-1/-2).
function migrateUserRejectedAt(db) {
  const cols = new Set(db.prepare("PRAGMA table_info('knowledge_edges')").all().map((r) => r.name));
  if (!cols.has('user_rejected_at')) db.exec('ALTER TABLE knowledge_edges ADD COLUMN user_rejected_at TEXT');
}

// UC-AD Slice #6.3: additive `knowledge_edges.last_recalled_at`-Spalte (idempotent).
// Wird durch markRecalled(hashes) gesetzt; decayPass nutzt sie für Spaced-Repetition-Bonus.
function migrateLastRecalledAt(db) {
  const cols = new Set(db.prepare("PRAGMA table_info('knowledge_edges')").all().map((r) => r.name));
  if (!cols.has('last_recalled_at')) db.exec('ALTER TABLE knowledge_edges ADD COLUMN last_recalled_at TEXT');
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
