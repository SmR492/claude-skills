import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine, EngineError } from '../src/engine.mjs';

// ADR 0019 Slice S1a — Impuls-Ledger-Substrat: append-only Event-Store + deterministischer
// Direkt+Quelle-Fold (Beta-Reputation, integer-promille), auto_corroborate-Band-Kappe + Hash-Dedup,
// safe-by-default-Prior. KEINE Recency/Eltern-Attribuierung (S1b/S2). resolveBelief unberührt (additiv).

const PRIOR = 300; // Beta(3,7) → trunc(1000·3/10) = 300‰

test('AC-T.4: safe-by-default — ohne Events liefert trustOf den Prior (300‰)', () => {
  const e = new Engine();
  assert.equal(e.trustOf('peer:unknown'), PRIOR);
  assert.equal(e.trustOf('triple:doesnotexist'), PRIOR);
});

test('AC-T.2: trustOf liefert Integer-Promille 0..1000', () => {
  const e = new Engine();
  e.recordAdjudication({ target_id: 'X', source_id: 'srcA', adj_class: 'human_endorse', delta: 1000 });
  const t = e.trustOf('X');
  assert.equal(Number.isInteger(t), true);
  assert.ok(t >= 0 && t <= 1000);
});

test('AC-T.5: Validierung — ungültige adj_class / delta-Range → INVALID_PARAMETER_FORMAT', () => {
  const e = new Engine();
  assert.throws(() => e.recordAdjudication({ target_id: 'X', adj_class: 'foo', delta: 100 }),
    (err) => err instanceof EngineError && err.code === 'INVALID_PARAMETER_FORMAT');
  assert.throws(() => e.recordAdjudication({ target_id: 'X', adj_class: 'human_endorse', delta: 1500 }),
    (err) => err instanceof EngineError && err.code === 'INVALID_PARAMETER_FORMAT');
  assert.throws(() => e.recordAdjudication({ target_id: 'X', adj_class: 'human_endorse', delta: -1001 }),
    (err) => err instanceof EngineError && err.code === 'INVALID_PARAMETER_FORMAT');
  assert.throws(() => e.recordAdjudication({ target_id: 'X', adj_class: 'human_endorse', delta: 1.5 }),
    (err) => err instanceof EngineError && err.code === 'INVALID_PARAMETER_FORMAT');
});

test('AC-T.6: append-only — zwei Events = zwei Zeilen; trustOf ist reine Lese-Projektion', () => {
  const e = new Engine();
  e.recordAdjudication({ target_id: 'X', adj_class: 'human_endorse', delta: 800 });
  e.recordAdjudication({ target_id: 'X', adj_class: 'human_endorse', delta: 600 });
  const rows = e.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id='X'").get().c;
  assert.equal(rows, 2);
  const before = e.db.prepare('SELECT COUNT(*) c FROM trust_events').get().c;
  e.trustOf('X'); e.trustOf('X');
  const after = e.db.prepare('SELECT COUNT(*) c FROM trust_events').get().c;
  assert.equal(before, after, 'trustOf darf nichts schreiben');
});

test('AC-T.1: Determinismus — identische Events (beliebige Insert-Reihenfolge) → identischer Trust', () => {
  const mk = () => new Engine();
  const e1 = mk();
  e1.recordAdjudication({ target_id: 'K', adj_class: 'human_endorse', delta: 900 });
  e1.recordAdjudication({ target_id: 'K', adj_class: 'human_reject', delta: -400 });
  const e2 = mk();
  // umgekehrte Insert-Reihenfolge, gleiche occurred_at via _now-Mock egalisiert → Total-Ordnung greift
  const FIX = Date.parse('2026-06-01T00:00:00Z');
  e1._now = () => FIX; e2._now = () => FIX;
  const a = mk(); a._now = () => FIX;
  a.recordAdjudication({ target_id: 'K', adj_class: 'human_reject', delta: -400 });
  a.recordAdjudication({ target_id: 'K', adj_class: 'human_endorse', delta: 900 });
  const b = mk(); b._now = () => FIX;
  b.recordAdjudication({ target_id: 'K', adj_class: 'human_endorse', delta: 900 });
  b.recordAdjudication({ target_id: 'K', adj_class: 'human_reject', delta: -400 });
  assert.equal(a.trustOf('K'), b.trustOf('K'), 'Total-Ordnung → reihenfolge-unabhängig');
});

test('AC-T.3: Quell-Beitrag — Event auf Tripel K mit source_id S hebt trustOf(S) gemäß w_src', () => {
  const e = new Engine();
  // Vergleich: dasselbe Delta direkt auf D vs. als Quelle S — S bewegt sich gedämpft (w_src<1000)
  e.recordAdjudication({ target_id: 'D', adj_class: 'human_endorse', delta: 1000 });
  e.recordAdjudication({ target_id: 'Kx', source_id: 'S', adj_class: 'human_endorse', delta: 1000 });
  const tD = e.trustOf('D');
  const tS = e.trustOf('S');
  assert.ok(tS > PRIOR, 'Quelle steigt durch Erfolg ihres Items');
  assert.ok(tS < tD, 'Quell-Beitrag ist gegenüber dem Direkt-Beitrag gedämpft (w_src < 1000)');
});

test('AC-T.10a: auto_corroborate allein ist bei 600‰ gedeckelt (egal wie viele)', () => {
  const e = new Engine();
  for (let i = 0; i < 50; i++) {
    e.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  }
  assert.ok(e.trustOf('A') <= 600, `auto_corroborate-Kappe verletzt: ${e.trustOf('A')}`);
});

test('AC-T.10b: ein menschlicher Endorse durchbricht die 600‰-Kappe', () => {
  const e = new Engine();
  for (let i = 0; i < 50; i++) e.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  e.recordAdjudication({ target_id: 'A', adj_class: 'human_endorse', delta: 1000 });
  assert.ok(e.trustOf('A') > 600, `externer Anker hebt nicht über die Kappe: ${e.trustOf('A')}`);
});

test('AC-T.10c: Hash-Dedup — korrelierte auto_corroborate (gleicher dedup_hash) zählen als EIN Signal', () => {
  const e = new Engine();
  const one = new Engine();
  for (let i = 0; i < 20; i++) e.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: 'same' });
  one.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: 'same' });
  assert.equal(e.trustOf('A'), one.trustOf('A'), '20× gleicher Hash == 1× (kein Anzahl-Boost)');
});

test('AC-T.5b (🔴-2): auto_corroborate OHNE dedup_hash → INVALID_PARAMETER_FORMAT (Anzahl-Falle-Schutz)', () => {
  const e = new Engine();
  assert.throws(() => e.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 500 }),
    (err) => err instanceof EngineError && err.code === 'INVALID_PARAMETER_FORMAT');
  // mit dedup_hash geht es:
  assert.doesNotThrow(() => e.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 500, dedup_hash: 'c1' }));
});

test('AC-T.10d (🔴-1): ein FREMDER negativer Anker (human_reject, Knoten nur source_id) hebt die Kappe NICHT', () => {
  const e = new Engine();
  for (let i = 0; i < 50; i++) e.recordAdjudication({ target_id: 'T', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  // S1b-Verfeinerung (additiv): der Pro-Perioden-Clamp dämpft den Genesis-auto-Schwall — der Pegel-Cap
  // (≤600) gilt weiter, aber in EINER Epoche ist der Exaktwert der Clamp-Deckel (Prior+Clamp), nicht 600
  // (ein „Ingestion-Schwall" wird auch beim Import rate-begrenzt; T.13/ADR §4.3). Intention unverändert:
  // ein FREMDER Anker (Knoten nur als source_id) hebt die Kappe nie.
  assert.equal(e.trustOf('T'), PRIOR + (e.spec.trustPerPeriodClamp ?? 150), `auto-Schwall ist rate-geklemmt ≤Kappe: ${e.trustOf('T')}`);
  e.recordAdjudication({ target_id: 'OTHER', source_id: 'T', adj_class: 'human_reject', delta: -1000 });
  assert.ok(e.trustOf('T') <= 600, `negativer Fremd-Anker darf die Kappe nicht sprengen: ${e.trustOf('T')}`);
});

test('AC-T.6b (🟡-2): trust_events ist append-only — UPDATE/DELETE werden vom Trigger abgebrochen', () => {
  const e = new Engine();
  e.recordAdjudication({ target_id: 'A', adj_class: 'human_endorse', delta: 500 });
  assert.throws(() => e.db.prepare("UPDATE trust_events SET delta_promille=1000 WHERE target_id='A'").run(), /append-only/);
  assert.throws(() => e.db.prepare("DELETE FROM trust_events WHERE target_id='A'").run(), /append-only/);
});

test('AC-T.4b: negativer Verlauf — Rejects drücken unter den Prior', () => {
  const e = new Engine();
  // Zwei IDENTISCHE Rejects (gleiches delta) — kein Distinkt-Delta-Workaround mehr (3.-Audit-Befund):
  // distinkte human-Akte dürfen NICHT idempotent kollabieren, also müssen beide β real senken.
  e.recordAdjudication({ target_id: 'L', adj_class: 'human_reject', delta: -1000 });
  e.recordAdjudication({ target_id: 'L', adj_class: 'human_reject', delta: -1000 });
  assert.equal(e.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id='L'").get().c, 2,
    'zwei distinkte Rejects = zwei Zeilen (kein Idempotenz-Collapse)');
  assert.ok(e.trustOf('L') < PRIOR, `Rejects müssen unter Prior drücken: ${e.trustOf('L')}`);
});

test('AC-T.6c (3.-Audit-🔴): distinkte human-Akte gleichem delta+ts werden NICHT verschluckt (Datenverlust-Regress)', () => {
  // Gegenstück zum umgangenen AC-T.4b: gleiches delta + gleicher ts + gleiche Klasse → MÜSSEN getrennt
  // bleiben (sonst wall-clock-Nichtdeterminismus + Datenverlust; vor dem Fix kollabierten 100 Endorses
  // via INSERT OR IGNORE auf 1 Zeile → ~363 statt ~936). Klassen-getrennter event_hash (seq) heilt das.
  const FIX = Date.parse('2026-06-01T00:00:00Z');
  const e = new Engine(); e._now = () => FIX;
  e.recordAdjudication({ target_id: 'H', adj_class: 'human_reject', delta: -1000 });
  e.recordAdjudication({ target_id: 'H', adj_class: 'human_reject', delta: -1000 });
  assert.equal(e.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id='H'").get().c, 2,
    'zwei distinkte human-Akte (gleiches delta+ts) → 2 Zeilen, kein Verschlucken');
  const e2 = new Engine(); e2._now = () => FIX;
  for (let i = 0; i < 100; i++) e2.recordAdjudication({ target_id: 'P', adj_class: 'human_endorse', delta: 1000 });
  assert.equal(e2.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id='P'").get().c, 100,
    '100 distinkte Endorses → 100 Zeilen (vor Fix: 1)');
  assert.ok(e2.trustOf('P') > 900, `100× endorse muss Trust real hochziehen (>900), nicht auf ~363 verschlucken: ${e2.trustOf('P')}`);
  // Kontrast: auto_corroborate mit gleichem dedup_hash KOLLABIERT weiterhin korrekt (Idempotenz gewollt):
  const e3 = new Engine(); e3._now = () => FIX;
  for (let i = 0; i < 100; i++) e3.recordAdjudication({ target_id: 'Q', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: 'same' });
  assert.equal(e3.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id='Q'").get().c, 1,
    'auto_corroborate gleicher dedup_hash bleibt idempotent (1 Zeile) — Klassen-Trennung intakt');
});

test('AC-T.10e (🔴-A): ein POSITIVER Fremd-Quell-Anker (human_endorse auf fremdes Item, Knoten=source) hebt die Kappe NICHT', () => {
  const e = new Engine();
  for (let i = 0; i < 50; i++) e.recordAdjudication({ target_id: 'T', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  e.recordAdjudication({ target_id: 'OTHER', source_id: 'T', adj_class: 'human_endorse', delta: 1000 });
  assert.ok(e.trustOf('T') <= 600, `Quell-Anker auf fremdes Item darf T's auto-Kappe nicht sprengen: ${e.trustOf('T')}`);
  // Direkter positiver Anker auf T HEBT dagegen (Kontrast — AC-T.10b-Linie):
  e.recordAdjudication({ target_id: 'T', adj_class: 'human_endorse', delta: 1000 });
  assert.ok(e.trustOf('T') > 600, `direkter Anker MUSS heben: ${e.trustOf('T')}`);
});

test('AC-T.1b (🔴-B): Replay-Determinismus — gleicher dedup_hash, divergierendes delta, gleicher ts, umgekehrte Insert-Reihenfolge → identischer Trust', () => {
  const FIX = Date.parse('2026-06-01T00:00:00Z');
  const a = new Engine(); a._now = () => FIX;
  a.recordAdjudication({ target_id: 'M', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: 'same' });
  a.recordAdjudication({ target_id: 'M', adj_class: 'auto_corroborate', delta: 100, dedup_hash: 'same' });
  const b = new Engine(); b._now = () => FIX;
  b.recordAdjudication({ target_id: 'M', adj_class: 'auto_corroborate', delta: 100, dedup_hash: 'same' });
  b.recordAdjudication({ target_id: 'M', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: 'same' });
  assert.equal(a.trustOf('M'), b.trustOf('M'), 'inhalts-deterministischer event_hash → reihenfolge-/replay-stabiler Dedup');
});

test('S1a-Regress: resolveBelief / bestehender Pfad unberührt (additiv)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800 });
  // trust_events leer beeinflusst nichts am klassischen Belief-Pfad (resolveBelief unberührt, additiv)
  const r = e.resolveBelief('Aa', 'pp');
  assert.ok(r && r.winner === 'Bb', 'resolveBelief funktioniert unverändert weiter');
});
