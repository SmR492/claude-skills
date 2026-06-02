import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S5a — Modus-Achse / Fiktion (separater Sandbox-Store).
// Isolation by Default: resolveBelief/query/verify lesen NUR knowledge_edges → sehen Fiktion NIE.
// Welt-Scope (Lewis) via recallWorld (Opt-In). Promotion = Sandbox-Löschung + frische Ingestion → Trust-Prior.

const mk = () => new Engine();

test('AC-S5a.1: Isolation — Fiktion ist im Fakt-Pfad (resolveBelief/query) UNSICHTBAR', () => {
  const e = mk();
  e.storeFiction({ subject: 'Sherlock', predicate: 'wohnt_in', object: 'Bakerstreet', world: 'doyle' });
  assert.equal(e.resolveBelief('Sherlock', 'wohnt_in'), null, 'Fiktion erzeugt KEINEN Belief-Gewinner im Faktengraphen');
  const q = e.query('Sherlock');
  assert.equal(q.edges.length, 0, 'query (Fakt-Pfad) sieht die Fiktion nicht');
});

test('AC-S5a.2: Fiktion verdrängt/widerspricht keinem Fakt (modus-verschoben, nicht falsch)', () => {
  const e = mk();
  e.storeTriple({ subject: 'Mars', predicate: 'hat_farbe', object: 'rot', source_type: 'fachquelle' });
  e.storeFiction({ subject: 'Mars', predicate: 'hat_farbe', object: 'gruen', world: 'roman' });
  const r = e.resolveBelief('Mars', 'hat_farbe');
  assert.equal(r.winner, 'rot', 'der Fakt gewinnt; Fiktion ist kein Kandidat');
  assert.ok(!r.candidates.some((c) => c.object === 'gruen'), 'fiktives Objekt taucht NICHT in den Kandidaten auf');
});

test('AC-S5a.3: Welt-Scope (Opt-In) — recallWorld liefert die Fiktion ihrer Welt', () => {
  const e = mk();
  e.storeFiction({ subject: 'Sherlock', predicate: 'wohnt_in', object: 'Bakerstreet', world: 'doyle' });
  e.storeFiction({ subject: 'Sherlock', predicate: 'wohnt_in', object: 'Sussex', world: 'spaetwerk' });
  const w = e.recallWorld('doyle', { subject: 'Sherlock' });
  assert.equal(w.fiction.length, 1);
  assert.equal(w.fiction[0].object, 'Bakerstreet');
  assert.equal(w.fiction[0].assertion_mode, 'suspended');
  assert.equal(e.recallWorld('spaetwerk', { subject: 'Sherlock' }).fiction[0].object, 'Sussex', 'Welten sind getrennt');
});

test('AC-S5a.4: Promotion = Sandbox-Löschung + FRISCHE Ingestion (Trust startet am Prior)', () => {
  const e = mk();
  const f = e.storeFiction({ subject: 'Hypothese', predicate: 'ist', object: 'bestaetigt', world: 'sandbox', source_type: 'manual' });
  assert.equal(e.resolveBelief('Hypothese', 'ist'), null, 'vor Promotion: kein Fakt');
  assert.equal(e.trustOf(f.triple_hash), 300, 'Fiktion hat noch keine Trust-Impulse (Prior)');
  const p = e.promoteFiction('sandbox', f.triple_hash);
  assert.equal(p.promoted, true);
  assert.equal(e.resolveBelief('Hypothese', 'ist').winner, 'bestaetigt', 'nach Promotion: echter Fakt im Graphen');
  assert.equal(e.recallWorld('sandbox', { subject: 'Hypothese' }).fiction.length, 0, 'Fiktion hat die Sandbox verlassen');
  assert.equal(e.trustOf(f.triple_hash), 300, 'frische Ingestion sammelt Trust-Impulse NEU (Prior)');
});

test('AC-S5a.5: verify behandelt Fiktion nicht als Fakt (erbt Isolation über resolveBelief)', () => {
  const e = mk();
  e.storeFiction({ subject: 'Drache', predicate: 'existiert', object: 'ja', world: 'maerchen' });
  // kein Fakt vorhanden → resolveBelief null → verify leitet kein supported/contradicted aus Fiktion ab
  assert.equal(e.resolveBelief('Drache', 'existiert'), null);
});

test('AC-S5a.6: Validierung + Determinismus', () => {
  const e = mk();
  assert.throws(() => e.storeFiction({ subject: 'AA', predicate: 'pp', object: 'BB' }), /INVALID_PARAMETER_FORMAT/); // world fehlt
  assert.throws(() => e.storeFiction({ subject: 'AA', predicate: 'pp', object: 'BB', world: '' }), /INVALID_PARAMETER_FORMAT/);
  const FIX = Date.parse('2026-06-01T00:00:00Z');
  const run = () => { const x = mk(); x._now = () => FIX; x.storeFiction({ subject: 'AA', predicate: 'pp', object: 'BB', world: 'w' }); return JSON.stringify(x.recallWorld('w')); };
  assert.equal(run(), run(), 'reproduzierbar (bei fixierter Uhr)');
});

test('AC-S5a.7 (Audit-🔴): Promotion einer Fiktion mit Fakt-Hash-Kollision mutiert den Fakt NICHT', () => {
  const e = mk();
  const fact = e.storeTriple({ subject: 'Erde', predicate: 'form', object: 'rund', confidence: 500, source_type: 'manual' });
  e.storeFiction({ subject: 'Erde', predicate: 'form', object: 'rund', world: 'flacherde', confidence: 999, source_type: 'llm' });
  const p = e.promoteFiction('flacherde', fact.triple_hash);
  assert.equal(p.promoted, false, 'kein Merge in den bestehenden Fakt');
  assert.equal(p.alreadyFact, true);
  const edge = e.db.prepare('SELECT confidence, source_type FROM knowledge_edges WHERE triple_hash=?').get(fact.triple_hash);
  assert.equal(edge.confidence, 500, `Fakt-Konfidenz UNVERÄNDERT (nicht durch Fiktions-999 mutiert): ${edge.confidence}`);
  assert.equal(edge.source_type, 'manual', 'Fakt-source_type unverändert');
  assert.equal(e.recallWorld('flacherde', { subject: 'Erde' }).fiction.length, 0, 'redundante Fiktion verlässt die Sandbox');
});

test('AC-S5a.8 (Audit-🔴): ein vom Nutzer abgelehnter Fakt wird durch Fiktions-Promotion NICHT resurrected/kontaminiert', () => {
  const e = mk();
  const fact = e.storeTriple({ subject: 'Impf', predicate: 'wirkt', object: 'nein', confidence: 600, source_type: 'web' });
  e.reject(fact.triple_hash); // Nutzer lehnt ab → superseded
  e.storeFiction({ subject: 'Impf', predicate: 'wirkt', object: 'nein', world: 'verschwoerung', confidence: 999 });
  e.promoteFiction('verschwoerung', fact.triple_hash);
  const edge = e.db.prepare('SELECT confidence, local_status FROM knowledge_edges WHERE triple_hash=?').get(fact.triple_hash);
  assert.equal(edge.confidence, 600, `abgelehnter Fakt nicht auf 999 kontaminiert: ${edge.confidence}`);
  assert.notEqual(edge.local_status, 'active', 'abgelehnter Fakt bleibt abgelehnt (nicht resurrected)');
});

test('AC-S5a.9 (Audit-🔴-2): GC löscht user-rejected Tombstone NICHT → keine Resurrection nach GC+Promotion', () => {
  const e = mk();
  const fact = e.storeTriple({ subject: 'Impf', predicate: 'wirkt', object: 'nein', confidence: 600, source_type: 'web' });
  e.reject(fact.triple_hash); // → superseded + user_rejected_at
  e._now = () => Date.parse('2027-01-01T00:00:00Z'); // Zukunft → GC-cutoff passiert das reale updated_at
  const g = e.gc({ maxAgeDays: 30 });
  assert.equal(g.edgesDeleted, 0, 'user-rejected Tombstone wird NICHT GC-gelöscht');
  const tomb = e.db.prepare('SELECT local_status, user_rejected_at FROM knowledge_edges WHERE triple_hash=?').get(fact.triple_hash);
  assert.ok(tomb && tomb.user_rejected_at, 'reject-Markierung überlebt GC (Resurrection-Sperre)');
  e.storeFiction({ subject: 'Impf', predicate: 'wirkt', object: 'nein', world: 'v', confidence: 999 });
  const p = e.promoteFiction('v', fact.triple_hash);
  assert.equal(p.alreadyFact, true, 'Promotion bleibt blockiert (Tombstone da)');
  const after = e.db.prepare('SELECT confidence, local_status FROM knowledge_edges WHERE triple_hash=?').get(fact.triple_hash);
  assert.notEqual(after.local_status, 'active', 'abgelehnter Fakt NICHT resurrected');
  assert.equal(after.confidence, 600, 'nicht kontaminiert');
});

test('S5a-Regress: bestehender Fakt-Pfad unberührt (knowledge_edges nur)', () => {
  const e = mk();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800 });
  assert.equal(e.resolveBelief('Aa', 'pp').winner, 'Bb');
});
