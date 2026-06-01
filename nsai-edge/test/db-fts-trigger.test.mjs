import { test } from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.mjs';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// R-Fix FTS-Migrations-Bug: der episodes_au-Trigger feuerte bei JEDEM Update — auch beim reinen
// occurred_at_norm-Backfill der UTC-Z-Migration. Bei (aus anderem Grund) desynchronisiertem FTS5-Index
// wirft der delete-Pfad „database disk image is malformed" → crasht openDb → crasht den MCP-Server.
// Fix: WHEN old.content IS NOT new.content (Guard) + Nachrüst-Migration vor migrateUtcZNormalization.

const OLD_TRIGGER = // ungeguardete Vor-Fix-Version (für Repro)
  'DROP TRIGGER IF EXISTS episodes_au;' +
  'CREATE TRIGGER episodes_au AFTER UPDATE ON episodes BEGIN ' +
  "INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES ('delete', old.rowid, old.content); " +
  'INSERT INTO episodes_fts(rowid, content) VALUES (new.rowid, new.content); END;';

function insertEpisode(db, id, content) {
  db.prepare("INSERT INTO episodes(id, content, occurred_at) VALUES(?, ?, '2026-01-01T00:00:00Z')").run(id, content);
  return db.prepare('SELECT rowid FROM episodes WHERE id=?').get(id).rowid;
}
// Desync simulieren: FTS-Eintrag der Episode sauber entfernen (wie der ad-Trigger), Quelle bleibt.
function desyncFts(db, rowid, content) {
  db.prepare("INSERT INTO episodes_fts(episodes_fts, rowid, content) VALUES('delete', ?, ?)").run(rowid, content);
}

test('AC-FTS.1 (Repro): mit ALTEM ungeguardeten Trigger wirft ein Nicht-Content-Update bei desync „malformed"', () => {
  const db = openDb(':memory:');
  db.exec(OLD_TRIGGER); // auf Vor-Fix-Stand zurückbiegen
  const rid = insertEpisode(db, 'ep1', 'alpha foo bar');
  desyncFts(db, rid, 'alpha foo bar');
  assert.throws(
    () => db.prepare("UPDATE episodes SET occurred_at_norm='2026-01-01T00:00:00.000Z' WHERE id='ep1'").run(),
    /malformed/,
    'Vor-Fix-Trigger muss den Bug reproduzieren',
  );
});

test('AC-FTS.2 (Fix): mit Guard-Trigger ist derselbe Nicht-Content-Update unproblematisch', () => {
  const db = openDb(':memory:'); // openDb installiert den geguardeten Trigger
  const rid = insertEpisode(db, 'ep1', 'alpha foo bar');
  desyncFts(db, rid, 'alpha foo bar');
  assert.doesNotThrow(
    () => db.prepare("UPDATE episodes SET occurred_at_norm='2026-01-01T00:00:00.000Z' WHERE id='ep1'").run(),
    'Guard: Nicht-Content-Update fasst den FTS-Index nicht an',
  );
});

test('AC-FTS.3 (Migration/Original-Inzident): openDb repariert eine Bestands-DB mit altem Trigger + NULL-norm + desync ohne Crash', () => {
  const dir = mkdtempSync(join(tmpdir(), 'fts-'));
  const f = join(dir, 'g.db');
  try {
    // Bestands-DB im kaputten Vor-Fix-Zustand herstellen:
    let db = openDb(f);
    db.exec(OLD_TRIGGER);
    const rid = insertEpisode(db, 'ep1', 'gamma delta'); // occurred_at_norm bleibt NULL (Default)
    desyncFts(db, rid, 'gamma delta');                   // FTS desynchronisiert
    db.close();
    // Re-Open mit neuem Code: migrateEpisodesFtsTrigger läuft VOR migrateUtcZNormalization →
    // der norm-Backfill feuert den (jetzt geguardeten) Trigger nicht → kein Crash.
    assert.doesNotThrow(() => { db = openDb(f); }, 'openDb darf nicht mehr an der FTS-Migration crashen');
    const norm = db.prepare("SELECT occurred_at_norm n FROM episodes WHERE id='ep1'").get().n;
    assert.ok(norm, 'occurred_at_norm wurde durch die Migration befüllt');
    db.close();
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('AC-FTS.4 (kein Regress): eine ECHTE content-Änderung re-indexiert den FTS-Index weiterhin', () => {
  const db = openDb(':memory:');
  insertEpisode(db, 'ep1', 'alpha');
  db.prepare("UPDATE episodes SET content='beta' WHERE id='ep1'").run(); // content ändert sich → Guard feuert
  const beta = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'beta'").get().c;
  const alpha = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'alpha'").get().c;
  assert.equal(beta, 1, 'neuer content ist gefunden');
  assert.equal(alpha, 0, 'alter content ist aus dem Index entfernt');
});

test('AC-FTS.5 (Idempotenz): der geguardete Trigger steht nach openDb in sqlite_master mit WHEN-Klausel', () => {
  const db = openDb(':memory:');
  const sql = db.prepare("SELECT sql FROM sqlite_master WHERE type='trigger' AND name='episodes_au'").get().sql;
  assert.match(sql, /WHEN\s+old\.content\s+IS\s+NOT\s+new\.content/i, 'Trigger trägt den content-Guard');
});
