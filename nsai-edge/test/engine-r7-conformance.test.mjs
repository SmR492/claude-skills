import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkConformance, runVector, LEARN_CONSTANTS, DECAY_RECALL_CONSTANTS, QUORUM_CONSTANTS } from '../src/conformance.mjs';
import { DEFAULT_SPEC } from '../src/rules.mjs';

// R7 — Conformance-Härtung: PHP-Parität-Schuld als Test-Lock.
// Die Konstanten-Spiegel verhindern, dass eine PHP-Drift unbemerkt durchgeht — eine Werteänderung
// hier muss SOFORT in der PHP-Seite nachgezogen werden (und umgekehrt).

test('AC-R7.1: LEARN_CONSTANTS spiegeln rules.mjs::DEFAULT_SPEC bit-exakt + sind eingefroren', () => {
  assert.equal(LEARN_CONSTANTS.demoteLimitedThreshold, DEFAULT_SPEC.demoteLimitedThreshold);
  assert.equal(LEARN_CONSTANTS.demoteUntrustedThreshold, DEFAULT_SPEC.demoteUntrustedThreshold);
  assert.equal(LEARN_CONSTANTS.trustAdjustMinEvidence, DEFAULT_SPEC.trustAdjustMinEvidence);
  assert.ok(Object.isFrozen(LEARN_CONSTANTS), 'LEARN_CONSTANTS muss frozen sein (PHP-Drift-Schutz)');
});

test('AC-R7.2: DECAY_RECALL_CONSTANTS spiegeln rules.mjs::DEFAULT_SPEC bit-exakt + sind eingefroren', () => {
  assert.deepEqual(DECAY_RECALL_CONSTANTS.decayPerPeriod, DEFAULT_SPEC.decayPerPeriod);
  assert.equal(DECAY_RECALL_CONSTANTS.deleteThreshold, DEFAULT_SPEC.deleteThreshold);
  assert.equal(DECAY_RECALL_CONSTANTS.quarantineThreshold, DEFAULT_SPEC.quarantineThreshold);
  assert.equal(DECAY_RECALL_CONSTANTS.recallProtectionDays, DEFAULT_SPEC.recallProtectionDays);
  assert.equal(DECAY_RECALL_CONSTANTS.recallDecayDivisor, DEFAULT_SPEC.recallDecayDivisor);
  assert.ok(Object.isFrozen(DECAY_RECALL_CONSTANTS), 'DECAY_RECALL_CONSTANTS muss frozen sein');
  assert.ok(Object.isFrozen(DECAY_RECALL_CONSTANTS.decayPerPeriod), 'decayPerPeriod-Map muss frozen sein');
});

test('AC-R7.3: QUORUM_CONSTANTS bleiben unverändert (Regression seit M.1)', () => {
  assert.equal(QUORUM_CONSTANTS.quorumAuthFloor, DEFAULT_SPEC.quorumAuthFloor);
  assert.equal(QUORUM_CONSTANTS.quorumMulti, DEFAULT_SPEC.quorumMulti);
  assert.deepEqual(QUORUM_CONSTANTS.quorumTrustRank, DEFAULT_SPEC.quorumTrustRank);
});

test('AC-R7.4: Conformance-Vektor `decay-recall-bonus` — last_recalled_at < recallProtectionDays halbiert die Reduktion', () => {
  // UC-AD Spaced-Repetition. temporal-Tripel mit decay 50; recall protection aktiv → reduction = 25.
  // 800 - 25 = 775 (statt 750 ohne Recall-Bonus).
  const vector = {
    name: 'decay-recall-bonus',
    input: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 800, temporality: 'temporal' }],
    recall: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen' }],
    op: 'decay',
    expected: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 775, status: 'active' }],
  };
  const out = runVector(vector);
  const k = Object.keys(out)[0];
  assert.equal(out[k].confidence, 775, `recall-bonus halbiert decay: erwartet 775, tatsächlich ${out[k].confidence}`);
  assert.equal(out[k].status, 'active');
});

test('AC-R7.5: Conformance-Vektor `decay-recall-cascade` (R6) — P+K fallen im selben Pass, K ist retracted (nicht superseded)', () => {
  // R6-Doktrin als bit-exakter Conformance-Vektor. Engine baut die Konklusion via infer NICHT
  // automatisch — der Vektor enthält nur den direkten Decay-Pfad: zwei Tripel ohne derived_from,
  // beide ephemeral mit conf=200 → 1 Pass: beide auf 0 → superseded. Keine TMS-Cascade aktiv,
  // weil keine Inferenz dahinter. Aber die Counter-Drift-Fix-Eigenschaft wird ebenso gespiegelt.
  // (Volle Cascade braucht infer + decay als zwei ops — out of scope für 1-op-runVector.)
  const vector = {
    name: 'decay-double-supersede',
    input: [
      { subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 200, temporality: 'ephemeral' },
      { subject: 'Sand', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 200, temporality: 'ephemeral' },
    ],
    op: 'decay',
    expected: [
      { subject: 'Glatteis', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 0, status: 'superseded' },
      { subject: 'Sand', predicate: 'ist_ein', object: 'Strassengefahr', confidence: 0, status: 'superseded' },
    ],
  };
  const r = checkConformance([vector, { name: 'infer-noop', input: [], op: 'infer', expected: [] }]);
  assert.equal(r.allPass, true, `Cascade-Vektor muss passen: ${JSON.stringify(r)}`);
  assert.equal(r.phpVerified, false, 'ohne phpRunner: kein grünes Cross-Lang-Gate');
});

test('AC-R7.6: Conformance-Vektor `decay-recall-expired` — last_recalled_at NICHT gesetzt → voller Decay', () => {
  // Negative Variante: ohne recall → temporal 50, 800-50=750. Sicherheits-Test gegen accidental
  // recall-Bonus-Aktivierung in der PHP-Spiegelung.
  const vector = {
    name: 'decay-no-recall',
    input: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 800, temporality: 'temporal' }],
    op: 'decay',
    expected: [{ subject: 'Wetter', predicate: 'ist', object: 'Regen', confidence: 750, status: 'active' }],
  };
  const r = checkConformance([vector, { name: 'infer-noop', input: [], op: 'infer', expected: [] }]);
  assert.equal(r.allPass, true);
});

test('AC-R7.7: Determinismus — wiederholter Recall-Lauf gibt identisches Ergebnis (kein Mikrosekunden-Drift)', () => {
  // Stefan-Constraint: deterministische Engine. Zwei Läufe innerhalb Mikrosekunden müssen IDENTISCH
  // sein — das `now - last_recalled_at < recallProtectionMs` darf nicht durch Timer-Jitter flippen.
  const vector = {
    name: 'recall',
    input: [{ subject: 'Alpha', predicate: 'praedikat', object: 'Beta', confidence: 800, temporality: 'temporal' }],
    recall: [{ subject: 'Alpha', predicate: 'praedikat', object: 'Beta' }],
    op: 'decay',
    expected: [{ subject: 'Alpha', predicate: 'praedikat', object: 'Beta', confidence: 775, status: 'active' }],
  };
  const o1 = runVector(vector);
  const o2 = runVector(vector);
  assert.deepEqual(o1, o2, 'recall-Bonus muss über Läufe stabil sein');
});
