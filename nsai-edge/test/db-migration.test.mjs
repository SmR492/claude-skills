import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { openDb } from '../src/db.mjs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';

const OLD_EDGES = `
CREATE TABLE knowledge_nodes(id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, created_at TEXT);
CREATE TABLE knowledge_edges(
  triple_hash TEXT PRIMARY KEY, subject_id TEXT NOT NULL, predicate TEXT NOT NULL, object_id TEXT NOT NULL,
  confidence INTEGER NOT NULL, asserted_confidence INTEGER NOT NULL, source_type TEXT NOT NULL DEFAULT 'llm',
  asserted_at TEXT NOT NULL DEFAULT '1970-01-01T00:00:00Z',
  temporality TEXT NOT NULL CHECK(temporality IN ('eternal','stable','temporal','ephemeral')),
  local_status TEXT NOT NULL DEFAULT 'active' CHECK(local_status IN ('active','quarantined','superseded')),
  origin_peer_id TEXT NOT NULL, relayed_by TEXT, signature TEXT NOT NULL, vector_clock TEXT NOT NULL,
  derived_from TEXT, context_slug TEXT, created_at TEXT, updated_at TEXT);
CREATE TABLE peers(peer_id TEXT PRIMARY KEY, public_key TEXT NOT NULL, fingerprint TEXT NOT NULL, endpoint TEXT,
  trust_level TEXT NOT NULL DEFAULT 'untrusted', last_clock TEXT);
`;
const seedEdge = (db) => db.prepare("INSERT INTO knowledge_edges(triple_hash,subject_id,predicate,object_id,confidence,asserted_confidence,temporality,origin_peer_id,signature,vector_clock) VALUES ('sha256:t','n1','pp','n2',700,700,'stable','peer:a','ed25519:x','{}')").run();
const tmp = (n) => join(tmpdir(), `nsai-mig-${process.pid}-${n}-${Math.random().toString(36).slice(2)}.db`);

test('Migration: alte CHECK-Constraint → retracted, Daten erhalten', () => {
  const p = tmp('happy');
  try {
    const db = new DatabaseSync(p);
    db.exec(OLD_EDGES);
    db.exec("INSERT INTO knowledge_nodes(id,name) VALUES ('n1','Aa'),('n2','Bb')");
    seedEdge(db); db.close();
    const m = openDb(p);
    assert.ok(m.prepare("SELECT sql FROM sqlite_master WHERE name='knowledge_edges'").get().sql.includes('retracted'));
    assert.equal(m.prepare("SELECT COUNT(*) c FROM knowledge_edges").get().c, 1);
    m.prepare("UPDATE knowledge_edges SET local_status='retracted' WHERE triple_hash='sha256:t'").run();
    assert.equal(m.prepare("SELECT local_status s FROM knowledge_edges WHERE triple_hash='sha256:t'").get().s, 'retracted');
    m.close();
  } finally { rmSync(p, { force: true }); }
});

test('Migration: idempotent (zweiter openDb kein Datenverlust)', () => {
  const p = tmp('idem');
  try {
    const db = new DatabaseSync(p); db.exec(OLD_EDGES);
    db.exec("INSERT INTO knowledge_nodes(id,name) VALUES ('n1','Aa'),('n2','Bb')"); seedEdge(db); db.close();
    openDb(p).close();
    const m2 = openDb(p);
    assert.equal(m2.prepare("SELECT COUNT(*) c FROM knowledge_edges").get().c, 1);
    assert.equal(m2.prepare("SELECT 1 FROM sqlite_master WHERE name='knowledge_edges_old'").get(), undefined);
    m2.close();
  } finally { rmSync(p, { force: true }); }
});

test('🔴-1: Resumption — zurückgebliebenes _old (unterbrochener Rebuild) verliert keine Daten', () => {
  const p = tmp('resume');
  try {
    // Simuliere Abbruch NACH RENAME (+ leere neue Tabelle), VOR INSERT: _old hält die Daten.
    const db = new DatabaseSync(p);
    db.exec(OLD_EDGES);
    db.exec("INSERT INTO knowledge_nodes(id,name) VALUES ('n1','Aa'),('n2','Bb')"); seedEdge(db);
    db.exec('ALTER TABLE knowledge_edges RENAME TO knowledge_edges_old');
    // „neue" (leere) Tabelle mit retracted-CHECK, wie sie der abgebrochene Lauf angelegt hätte:
    db.exec("CREATE TABLE knowledge_edges(triple_hash TEXT PRIMARY KEY, subject_id TEXT, predicate TEXT, object_id TEXT, confidence INTEGER, asserted_confidence INTEGER, source_type TEXT, asserted_at TEXT, temporality TEXT, local_status TEXT DEFAULT 'active' CHECK(local_status IN ('active','quarantined','superseded','retracted')), origin_peer_id TEXT, relayed_by TEXT, signature TEXT, vector_clock TEXT, derived_from TEXT, context_slug TEXT, created_at TEXT, updated_at TEXT)");
    db.close();
    const m = openDb(p); // muss aus _old wiederherstellen + sauber migrieren
    assert.equal(m.prepare("SELECT COUNT(*) c FROM knowledge_edges").get().c, 1, 'Daten aus _old gerettet');
    assert.equal(m.prepare("SELECT 1 FROM sqlite_master WHERE name='knowledge_edges_old'").get(), undefined, '_old aufgeräumt');
    assert.ok(m.prepare("SELECT sql FROM sqlite_master WHERE name='knowledge_edges'").get().sql.includes('retracted'));
    m.close();
  } finally { rmSync(p, { force: true }); }
});
