import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S3a — domain-skopierter Trust (Quelle×Thema, O3).
// trustOf(id,{domain}) foldet (domain=Thema ODER domain IS NULL); nicht-themen-spezifische Impulse
// (domain=null) zählen global in ALLE Scopes; dünne Zelle (<trustDomainMinEvidence) → globaler Fallback.
// domain=null → exakt bisheriges Verhalten (kein Regress).

const mk = () => new Engine();
const endorse = (e, id, n, domain) => { for (let i = 0; i < n; i++) e.recordAdjudication({ target_id: id, adj_class: 'human_endorse', delta: 1000, domain }); };
const reject = (e, id, n, domain) => { for (let i = 0; i < n; i++) e.recordAdjudication({ target_id: id, adj_class: 'human_reject', delta: -1000, domain }); };

test('AC-S3a.1: domain=null ist exakt das bisherige (globale) Verhalten — kein Regress', () => {
  const e = mk();
  endorse(e, 'N', 8);
  assert.equal(e.trustOf('N'), e.trustOf('N', { domain: null }), 'domain=null == kein domain');
});

test('AC-S3a.2: dünne Themen-Zelle → globaler Fallback (Hart-Schwelle)', () => {
  const e = mk();
  endorse(e, 'S', 10, 'recht');     // reiches Thema recht
  reject(e, 'S', 2, 'medizin');     // dünnes Thema medizin (<5)
  assert.equal(e.trustOf('S', { domain: 'medizin' }), e.trustOf('S'),
    'dünne medizin-Zelle fällt auf den globalen Fold (alle Events) zurück, NICHT nur die 2 Rejects');
  // unbekanntes Thema (0 Events) → ebenfalls global
  assert.equal(e.trustOf('S', { domain: 'unbekannt' }), e.trustOf('S'));
});

test('AC-S3a.3: reiche Zellen divergieren themen-spezifisch (Quelle×Thema)', () => {
  const e = mk();
  endorse(e, 'Q', 8, 'medizin');    // in medizin geschätzt
  reject(e, 'Q', 8, 'recht');       // in recht widerlegt
  const tMed = e.trustOf('Q', { domain: 'medizin' });
  const tRecht = e.trustOf('Q', { domain: 'recht' });
  assert.ok(tMed > 600 && tRecht < 400, `themen-spezifisch divergent: medizin=${tMed} recht=${tRecht}`);
  assert.ok(tMed > tRecht);
});

test('AC-S3a.4: domain=null-Events zählen global in JEDEN Themen-Scope', () => {
  const e = mk();
  endorse(e, 'G', 8, 'medizin');
  const before = e.trustOf('G', { domain: 'medizin' });
  reject(e, 'G', 3, null);          // globaler negativer Impuls (domain=null), z.B. derived_blame-artig
  const after = e.trustOf('G', { domain: 'medizin' });
  assert.ok(after < before, `globaler (null) Reject senkt auch den medizin-Scope: ${after} < ${before}`);
});

test('AC-S3a.5: Determinismus — gleicher Bestand → gleicher domain-Trust', () => {
  const run = () => { const e = mk(); endorse(e, 'D', 8, 'medizin'); reject(e, 'D', 2, null); return e.trustOf('D', { domain: 'medizin' }); };
  assert.equal(run(), run());
});

test('AC-S3a.6: Quell-Beitrag ist ebenfalls domain-skopiert', () => {
  const e = mk();
  // 6 themen-spezifische Quell-Events (Knoten X als source in medizin) → reiche Zelle
  for (let i = 0; i < 6; i++) e.recordAdjudication({ target_id: `K${i}`, source_id: 'X', adj_class: 'human_endorse', delta: 1000, domain: 'medizin' });
  assert.ok(e.trustOf('X', { domain: 'medizin' }) > 300, 'Quell-Beitrag im Thema hebt den Trust');
  assert.equal(e.trustOf('X', { domain: 'leer' }), e.trustOf('X'), 'leeres Thema → globaler Fallback');
});
