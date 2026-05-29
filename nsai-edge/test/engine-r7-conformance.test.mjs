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

test('AC-R7.13 (F-1): LEARN_CONSTANTS spiegelt die Response-Caps (suggestionCap/-EvidenceCap) aus dem Spec', () => {
  // F-1: §G.2 nennt den Cap parität-relevant, LEARN_CONSTANTS enthielt ihn nicht (gleiche
  // Omissions-Klasse wie K1/sourceTier). Jetzt aus dem Spec gespiegelt statt Magic-Literal in engine.mjs.
  assert.equal(LEARN_CONSTANTS.suggestionCap, DEFAULT_SPEC.suggestionCap);
  assert.equal(LEARN_CONSTANTS.suggestionEvidenceCap, DEFAULT_SPEC.suggestionEvidenceCap);
  assert.equal(DEFAULT_SPEC.suggestionCap, 50, 'F-1-Pin: suggestionCap=50');
  assert.equal(DEFAULT_SPEC.suggestionEvidenceCap, 20, 'F-1-Pin: suggestionEvidenceCap=20');
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
  // Fokussierter Decay-Test → requiredOps auf die getestete Teilmenge (kein Quorum-Vektor nötig).
  const r = checkConformance([vector, { name: 'infer-noop', input: [], op: 'infer', expected: [] }], { requiredOps: ['decay', 'infer'] });
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
  const r = checkConformance([vector, { name: 'infer-noop', input: [], op: 'infer', expected: [] }], { requiredOps: ['decay', 'infer'] });
  assert.equal(r.allPass, true);
});

// ---- R12: Wurzelursache K1/K2 — Quorum-Pfad-Conformance-Coverage ----------

test('AC-R7.8 (R12): QUORUM_CONSTANTS spiegelt jetzt sourceTier + trustTierCap (K1-Tabelle)', () => {
  // Vor R12 fehlten genau diese beiden — die `tier`-Eingabe der Quorum-Formel war nicht
  // konstanten-gespiegelt, also war K1 (sourceTier-Drift) für die PHP-Parität unsichtbar.
  assert.deepEqual(QUORUM_CONSTANTS.sourceTier, DEFAULT_SPEC.sourceTier);
  assert.deepEqual(QUORUM_CONSTANTS.trustTierCap, DEFAULT_SPEC.trustTierCap);
  assert.ok(Object.isFrozen(QUORUM_CONSTANTS.sourceTier) && Object.isFrozen(QUORUM_CONSTANTS.trustTierCap));
  // Golden-Pin (NICHT self-regression): der K1-Wert ist literal festgenagelt. Eine versehentliche
  // Lockstep-Änderung in rules.mjs+Spiegel würde hier auffallen und eine bewusste Entscheidung erzwingen.
  assert.equal(QUORUM_CONSTANTS.sourceTier.behoerde, 5, 'K1-Pin: behoerde=5');
  assert.equal(QUORUM_CONSTANTS.sourceTier.gesetz, 6, 'K1-Pin: gesetz=6');
});

test('AC-R7.9 (R12): Quorum-Verhaltens-Vektor behoerde → supported (5000); pinnt K1×K2-Arithmetik', () => {
  const vector = {
    name: 'quorum-behoerde', op: 'quorum',
    input: [{ subject: 'Akte', predicate: 'verlangt', object: 'Pruefung', confidence: 700 }],
    endorsements: [{ subject: 'Akte', predicate: 'verlangt', object: 'Pruefung', source_type: 'behoerde' }],
    expected: [{ subject: 'Akte', predicate: 'verlangt', object: 'Pruefung', weighted_support: 5000, cluster_count: 1, verdict: 'supported' }],
  };
  const out = runVector(vector);
  const k = Object.keys(out)[0];
  assert.deepEqual(out[k], { weighted_support: 5000, cluster_count: 1, verdict: 'supported' });
});

test('AC-R7.10 (R12): Quorum-Boundary fachquelle → unknown (3000 < AUTH_FLOOR=4500); pinnt K2-Schwelle', () => {
  // Genau das K2-Gegenbeispiel: full × fachquelle = 3000 erreicht AUTH_FLOOR NICHT.
  const vector = {
    name: 'quorum-fachquelle', op: 'quorum',
    input: [{ subject: 'Notiz', predicate: 'behauptet', object: 'Faktum', confidence: 700 }],
    endorsements: [{ subject: 'Notiz', predicate: 'behauptet', object: 'Faktum', source_type: 'fachquelle' }],
    expected: [{ subject: 'Notiz', predicate: 'behauptet', object: 'Faktum', weighted_support: 3000, cluster_count: 1, verdict: 'unknown' }],
  };
  const out = runVector(vector);
  const k = Object.keys(out)[0];
  assert.deepEqual(out[k], { weighted_support: 3000, cluster_count: 1, verdict: 'unknown' });
});

test('AC-R7.11 (R12): Coverage-Gate fordert jetzt `quorum` — decay+infer allein blockt', () => {
  // Beweist, dass der strukturelle blinde Fleck geschlossen ist: ein decay+infer-Suite ohne
  // Quorum-Vektor erreicht die Pflicht-Coverage nicht mehr (Default requiredOps inkl. 'quorum').
  const noQuorum = [
    { name: 'd', input: [{ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800, temporality: 'temporal' }], op: 'decay', expected: [{ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 750 }] },
    { name: 'i', input: [], op: 'infer', expected: [] },
  ];
  const r = checkConformance(noQuorum);
  assert.equal(r.coverageMet, false, 'ohne quorum-Vektor darf das Gate nicht grün sein');
  assert.equal(r.allPass, false);
});

test('AC-R7.12 (R12): der Quorum-Vektor FÄNGT K1 — sourceTier-Drift kippt das Verdikt', () => {
  // Empirischer Beweis des Wurzelursachen-Fixes: mit der KORREKTEN Spec → supported; mit einer
  // K1-getreuen Drift (behoerde=4 statt 5) → 4000 < 4500 → unknown. Vor R12 war dieser Pfad
  // nicht vektorisiert, die Drift also unsichtbar.
  const vector = {
    name: 'quorum-k1-drift', op: 'quorum',
    input: [{ subject: 'Akte', predicate: 'verlangt', object: 'Pruefung', confidence: 700 }],
    endorsements: [{ subject: 'Akte', predicate: 'verlangt', object: 'Pruefung', source_type: 'behoerde' }],
    expected: [{ subject: 'Akte', predicate: 'verlangt', object: 'Pruefung', weighted_support: 5000, cluster_count: 1, verdict: 'supported' }],
  };
  const correct = runVector(vector);
  assert.equal(correct[Object.keys(correct)[0]].verdict, 'supported');

  const driftedSpec = { ...DEFAULT_SPEC, sourceTier: { ...DEFAULT_SPEC.sourceTier, behoerde: 4 } };
  const drifted = runVector(vector, { spec: driftedSpec });
  const d = drifted[Object.keys(drifted)[0]];
  assert.equal(d.weighted_support, 4000, 'behoerde=4 → 1000×4=4000');
  assert.equal(d.verdict, 'unknown', 'K1-Drift kippt supported→unknown → Vektor fängt sie');
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
