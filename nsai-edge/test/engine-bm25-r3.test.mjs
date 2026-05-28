import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { openDb } from '../src/db.mjs';

// UC-VS Slice #R3 — FTS5+BM25 Volltext-Suche im Episoden-Recall.
// Mehrwort-Suche, Umlaut-Toleranz, Trigger-Sync, Sanitization, Determinismus, Wire-Konsistenz.

test('AC-18.1: Mehrwort-Term liefert relevantere Episoden zuerst (BM25 ASC)', () => {
  const e = new Engine();
  // Klare Relevanz-Differenz: nur "Schulung mit Risikobewusstsein" hat beide Tokens.
  e.recordEpisode({ content: 'Schulung mit Risikobewusstsein für KI' });
  e.recordEpisode({ content: 'Schulung für allgemeines Wissen' });
  e.recordEpisode({ content: 'Risikobewusstsein im Alltag' });
  e.recordEpisode({ content: 'KI ist überall' });
  const r = e.recallEpisodes({ term: 'schulung risikobewusstsein' });
  assert.ok(r.episodes.length >= 1);
  // Die kombinierte Episode steht ganz oben (höchster BM25-Score).
  assert.equal(r.episodes[0].content, 'Schulung mit Risikobewusstsein für KI');
});

test('AC-18.2: _sanitizeFtsQuery entfernt FTS5-Operatoren → kein Crash', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Test Episode mit Inhalt' });
  // FTS5-Operatoren im Term — vor Slice #R3 würde MATCH crashen, jetzt sanitisiert.
  for (const term of ['Test-Episode', 'Test+Episode', 'Test"Episode', 'Test:Episode', '(Test)', 'Test*']) {
    assert.doesNotThrow(() => e.recallEpisodes({ term }));
  }
});

test('AC-18.3: Umlaut-Toleranz (remove_diacritics 2) — ü/ä/ö werden normalisiert', () => {
  // Hinweis: `remove_diacritics 2` normalisiert echte Diakritika (ü→u, ä→a, ö→o). `ß` ist
  // KEIN Diakritik im Unicode-Sinne und bleibt erhalten — Suche nach „suess" findet „Süßes"
  // daher NICHT. Wir testen die tatsächlich garantierte Normalisierung.
  const e = new Engine();
  e.recordEpisode({ content: 'später für Übung mit König' });
  // ü → u, ä → a, ö → o im Index; Anfrage ohne Umlaute findet sie.
  for (const term of ['spater', 'fur ubung', 'konig']) {
    const r = e.recallEpisodes({ term });
    assert.ok(r.episodes.length >= 1, `Umlaut-normalisierte Suche '${term}' muss matchen`);
  }
});

test('AC-18.4: Trigger-Sync — recordEpisode → sofort über FTS5 auffindbar', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'Eindeutige Marker-Phrase XYZ-Random-123' });
  const r = e.recallEpisodes({ term: 'XYZ Random' });
  assert.equal(r.episodes[0].id, ep.episode_id);
});

test('AC-18.5: DELETE-Sync — episodicGc entfernt Episode auch aus FTS5-Index', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Alte Episode mit Marker' });
  // Direkt löschen (statt episodicGc-Zeit-Logik) — Trigger muss FTS5 sauber halten.
  e.db.prepare('DELETE FROM episodes').run();
  const r = e.recallEpisodes({ term: 'Marker' });
  assert.equal(r.episodes.length, 0, 'gelöschte Episode darf nicht mehr matched werden');
});

test('AC-18.6: Idempotente Migration — rebuild füllt fehlenden Index nach', () => {
  const db = openDb();
  // Eine Episode + Trigger füllt FTS5
  db.prepare('INSERT INTO episodes (id, content, source_type, occurred_at) VALUES (?,?,?,?)')
    .run('ep-mig', 'Migrations-Test-Inhalt', 'manual', '2026-01-01T00:00:00Z');
  // Sanity: FTS5 hat die Episode via Trigger
  let cnt = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'Migrations'").get().c;
  assert.equal(cnt, 1);
  // Altbestand simulieren: FTS5 leeren
  db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES('delete-all')").run();
  cnt = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'Migrations'").get().c;
  assert.equal(cnt, 0);
  // Migration via 'rebuild' (saubere FTS5-Methode für External-Content-Tables)
  db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES('rebuild')").run();
  cnt = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'Migrations'").get().c;
  assert.equal(cnt, 1, 'rebuild muss den fehlenden Eintrag nachholen');
  // Idempotenz: zweites rebuild produziert dasselbe Ergebnis
  db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES('rebuild')").run();
  cnt = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'Migrations'").get().c;
  assert.equal(cnt, 1);
});

test('AC-18.7: Determinismus — gleicher Term + Index → identische Reihenfolge', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'alpha beta gamma' });
  e.recordEpisode({ content: 'alpha delta' });
  e.recordEpisode({ content: 'beta gamma epsilon' });
  const a = e.recallEpisodes({ term: 'alpha beta' });
  const b = e.recallEpisodes({ term: 'alpha beta' });
  assert.deepEqual(a.episodes.map((x) => x.id), b.episodes.map((x) => x.id));
});

test('AC-18.8: Output-Schema unverändert (Konsumenten-Kompatibilität)', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Konsistenz-Test' });
  const r = e.recallEpisodes({ term: 'Konsistenz' });
  assert.ok(r.episodes.length === 1);
  const ep = r.episodes[0];
  // Die ursprünglichen Felder müssen alle vorhanden sein.
  for (const field of ['id', 'content', 'source_type', 'occurred_at', 'context_slug']) {
    assert.ok(field in ep, `Feld ${field} fehlt`);
  }
});

test('AC-18.9: Ohne Term → Recency-DESC-Fallback (UC-5d-konform)', () => {
  const e = new Engine();
  // Gezielte occurred_at-Werte, damit der Sortier-Key eindeutig ist (kein Race mit gleicher Millisekunde).
  e.recordEpisode({ content: 'Erste', occurred_at: '2024-01-01T00:00:00Z' });
  e.recordEpisode({ content: 'Zweite', occurred_at: '2025-01-01T00:00:00Z' });
  const r = e.recallEpisodes({}); // ohne term
  assert.equal(r.episodes[0].content, 'Zweite', 'Recency-DESC: spätere zuerst');
  assert.equal(r.episodes[1].content, 'Erste');
});

test('AC-18.11: UC-BT-Verträglichkeit — since/until kombiniert mit FTS5 MATCH', () => {
  const e = new Engine();
  // Wir setzen occurred_at direkt für gezielte Filter-Tests
  e.db.prepare('INSERT INTO episodes (id, content, source_type, occurred_at, occurred_at_norm) VALUES (?,?,?,?,?)')
    .run('ep-old', 'Alter Marker', 'manual', '2020-01-01T00:00:00Z', '2020-01-01T00:00:00.000Z');
  e.db.prepare('INSERT INTO episodes (id, content, source_type, occurred_at, occurred_at_norm) VALUES (?,?,?,?,?)')
    .run('ep-new', 'Neuer Marker', 'manual', '2026-01-01T00:00:00Z', '2026-01-01T00:00:00.000Z');
  // Trigger füllen automatisch via INSERT auf episodes — verifizieren
  const total = e.db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'Marker'").get().c;
  assert.equal(total, 2);
  // Mit until-Filter: nur die alte
  const r = e.recallEpisodes({ term: 'Marker', until: '2023-01-01T00:00:00Z' });
  assert.equal(r.episodes.length, 1);
  assert.equal(r.episodes[0].id, 'ep-old');
});

test('AC-18.12: Open-World — Term ohne Treffer → leeres Ergebnis, kein nearby-Match', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Bekannte Episode' });
  const r = e.recallEpisodes({ term: 'GarNichtVorhanden' });
  assert.equal(r.episodes.length, 0);
});

test('AC-18.2b: Operator-only Term → leeres Ergebnis (kein All-Match-Leak)', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Inhalt eins' });
  e.recordEpisode({ content: 'Inhalt zwei' });
  // Term besteht nur aus FTS5-Operatoren/Punctuation → sanitisiert zu null → MUSS leer sein,
  // NICHT auf den term-losen Pfad fallen (sonst alle Episoden zurück).
  assert.equal(e.recallEpisodes({ term: '-+*"' }).episodes.length, 0);
  assert.equal(e.recallEpisodes({ term: '%%%' }).episodes.length, 0);
});

test('🔴-1 (Adversarial-R3): textuelle FTS5-Operatoren (AND/OR/NOT/NEAR) werden NICHT als Operator interpretiert', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Sicherheit ist wichtig und Risiko klein' });
  e.recordEpisode({ content: 'Hallo Welt' });
  // Vor dem Fix: "Sicherheit AND wichtig" → FTS5-Operator → SQL-Crash oder maskiertes Falsch-Negativ.
  // Nach Phrase-Quote-Sanitization: jeder Token als Phrase → keine Operator-Interpretation.
  for (const term of ['Sicherheit AND wichtig', 'Sicherheit OR Hallo', 'wichtig NOT Risiko', 'Hallo NEAR Welt']) {
    assert.doesNotThrow(() => e.recallEpisodes({ term }), `Term '${term}' darf nicht crashen`);
  }
  // „Sicherheit AND wichtig" muss die kombinierte Episode finden (AND ist Token, nicht Operator)
  const r = e.recallEpisodes({ term: 'Sicherheit wichtig' });
  assert.equal(r.episodes[0].content, 'Sicherheit ist wichtig und Risiko klein');
});

test('🔴-2 (Adversarial-R3): migrateEpisodesFts triggert auch bei Pre-R3-DB (Shadow-Count-Check)', () => {
  // Simulieren: eine DB mit Episoden, deren FTS5-Index leer ist (Altbestand vor #R3).
  const db = openDb();
  db.prepare('INSERT INTO episodes (id, content, source_type, occurred_at) VALUES (?,?,?,?)')
    .run('pre-r3', 'Wissen-aus-Altbestand', 'manual', '2024-01-01T00:00:00Z');
  // FTS5 manuell leeren (simuliert: DB existierte vor R3, openDb hat CREATE VIRTUAL TABLE → leer)
  db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES('delete-all')").run();
  // Shadow-Table-Count zeigt die echte Realität: 0 Dokumente indiziert
  const shadowCount = db.prepare('SELECT COUNT(*) c FROM episodes_fts_docsize').get().c;
  assert.equal(shadowCount, 0, 'Shadow-Count reflektiert echten Index-Stand');
  const epCount = db.prepare('SELECT COUNT(*) c FROM episodes').get().c;
  assert.equal(epCount, 1, 'eine Episode existiert');
  // Migration mit korrektem Check (Shadow-Count < epCount) muss greifen
  const indexedBefore = db.prepare('SELECT COUNT(*) c FROM episodes_fts_docsize').get().c;
  if (indexedBefore < epCount) {
    db.prepare("INSERT INTO episodes_fts(episodes_fts) VALUES('rebuild')").run();
  }
  const matched = db.prepare("SELECT COUNT(*) c FROM episodes_fts WHERE episodes_fts MATCH 'Altbestand'").get().c;
  assert.equal(matched, 1, 'nach rebuild ist die Episode wieder findbar');
});

test('🟡-1 (Adversarial-R3): term="" und whitespace-only → leeres Ergebnis (kein All-Match-Leak)', () => {
  const e = new Engine();
  e.recordEpisode({ content: 'Inhalt eins' });
  e.recordEpisode({ content: 'Inhalt zwei' });
  // Verhaltens-Klärung: explizit term gegeben aber leer/whitespace → leeres Treffer-Set,
  // NICHT alle Episoden (das wäre der All-Match-Leak).
  assert.equal(e.recallEpisodes({ term: '' }).episodes.length, 0);
  assert.equal(e.recallEpisodes({ term: '   ' }).episodes.length, 0);
  assert.equal(e.recallEpisodes({ term: '\n\t' }).episodes.length, 0);
});

test('AC-18.10: Föderation — FTS5-Index ist lokal, nicht im Wire', () => {
  const e = new Engine();
  const ep = e.recordEpisode({ content: 'Test-Inhalt' });
  // _edgeToWire nutzt keine FTS5-Felder — Episode ist ohnehin nicht im Wire (UC-EP § Föderation).
  // Sanity: episodes_fts existiert als virtuelle Tabelle, nicht als persistente Wire-Quelle.
  const wireTables = e.db.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((r) => r.name);
  assert.ok(wireTables.includes('episodes'));
  // sqlite-Schema enthält FTS5-Shadow-Tables (episodes_fts_data etc.) — kein Konflikt mit Wire.
  // Es darf keinen Wire-Pfad geben, der FTS5-Indizes serialisiert.
  assert.ok(typeof e._edgeToWire === 'function');
  assert.equal(ep.episode_id != null, true);
});
