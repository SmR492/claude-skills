import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S1b — Recency/Dampener über dem S1a-Impuls-Ledger.
// Perioden-Modell B (Epoche): eine Periode = ein decayPass(); jedes trust_event trägt die Epoche
// bei Insert; trustOf repliziert Epochen [min_event_epoch … asOf=current_epoch] mit
// λ-Mean-Reversion (Anti-Sleeper) + Pro-Perioden-Clamp (NUR reine auto/Quell-Epochen).
// trustOf bleibt wall-clock-frei → replay-/conformance-stabil. resolveBelief unberührt (additiv).

const PRIOR = 300;
const mkAuto = (n, target = 'A') =>
  Array.from({ length: n }, (_, i) => ({ target_id: target, adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` }));

test('AC-T.11a: Anti-Sleeper — Hoch-Trust-Quelle driftet bei Stille über Epochen messbar zurück', () => {
  const e = new Engine();
  for (let i = 0; i < 40; i++) e.recordAdjudication({ target_id: 'H', adj_class: 'human_endorse', delta: 1000 });
  const t0 = e.trustOf('H');
  assert.ok(t0 > 700, `Aufbau sollte hohen Trust liefern (clamp-frei, human-Epoche): ${t0}`);
  for (let i = 0; i < 20; i++) e.decayPass();
  const t20 = e.trustOf('H');
  assert.ok(t20 < t0, `bei Stille muss Trust zurückdriften: t0=${t0} t20=${t20}`);
  for (let i = 0; i < 200; i++) e.decayPass();
  const tFar = e.trustOf('H');
  assert.ok(tFar < t20 && tFar <= 400, `in endlich vielen Epochen zurück Richtung Prior (Anti-Sleeper): ${tFar}`);
});

test('AC-T.11b: Verankerung — der Pro-Epochen-Abfall am Hoch-Trust ist klein (λ_min-Boden, „das Wahre bleibt")', () => {
  const e = new Engine();
  for (let i = 0; i < 60; i++) e.recordAdjudication({ target_id: 'H', adj_class: 'human_endorse', delta: 1000 });
  const tPeak = e.trustOf('H');
  e.decayPass();
  const tNext = e.trustOf('H');
  assert.ok(tPeak - tNext >= 0, 'Stille darf nicht steigen');
  assert.ok(tPeak - tNext <= 30, `Hoch-Trust verblasst langsam (≤30‰/Epoche), nicht abrupt: Δ=${tPeak - tNext}`);
});

test('AC-T.13a: Pro-Perioden-Clamp — reiner auto-Schwall bewegt den Score je Epoche höchstens um den Clamp', () => {
  const e = new Engine();
  for (const ev of mkAuto(1000, 'S')) e.recordAdjudication(ev);
  const clamp = e.spec.trustPerPeriodClamp ?? 150;
  const t = e.trustOf('S');
  assert.ok(t <= PRIOR + clamp, `auto-Schwall (1000) in einer Epoche darf nur ≤ Prior+Clamp erreichen: ${t} > ${PRIOR + clamp}`);
});

test('AC-T.13b: „Anzahl zählt nie" rate-wise — 50 vs 1000 auto in EINER Epoche liefern denselben (geklemmten) Trust', () => {
  const a = new Engine(); for (const ev of mkAuto(50, 'A')) a.recordAdjudication(ev);
  const b = new Engine(); for (const ev of mkAuto(1000, 'A')) b.recordAdjudication(ev);
  assert.equal(a.trustOf('A'), b.trustOf('A'), 'Clamp macht die Anzahl im Schwall irrelevant');
});

test('AC-T.13c: Clamp-Ausnahme (Additivität) — eine Epoche mit direktem human-Akt ist clamp-frei (Anker durchbricht sofort)', () => {
  const e = new Engine();
  for (const ev of mkAuto(50, 'A')) e.recordAdjudication(ev);
  e.recordAdjudication({ target_id: 'A', adj_class: 'human_endorse', delta: 1000 });
  assert.ok(e.trustOf('A') > 600, `human-Anker in der Epoche hebt sofort über die auto-Kappe (kein Clamp): ${e.trustOf('A')}`);
});

test('AC-T.13d: nachhaltiger auto-Aufbau steigt graduell, bleibt aber an der 600‰-Kappe (Pegel-Cap intakt)', () => {
  const e = new Engine();
  let prev = e.trustOf('A');
  for (let ep = 0; ep < 12; ep++) {
    for (let i = 0; i < 20; i++) e.recordAdjudication({ target_id: 'A', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `e${ep}_${i}` });
    const now = e.trustOf('A');
    assert.ok(now <= 600, `auto darf nie über die Kappe: ${now}`);
    prev = now;
    e.decayPass();
  }
  assert.ok(prev >= 550, `nachhaltiger auto-Aufbau sollte die Kappe annähern: ${prev}`);
});

test('AC-T.13e (Audit-🔴-1): ein co-lokaler human_reject SENKT — er darf die auto-Masse nie über den Clamp heben', () => {
  // Gegnerisch gefunden: der vorzeichen-blinde Clamp-Bypass ließ einen human_reject die gesamte
  // co-lokale auto-Masse vom Rate-Clamp befreien → Reject HOB den Trust (450→600). Zwei-Achsen-Fold:
  // Autorität (reject, frei abwärts) ist die Clamp-Baseline; Anzahl (auto) wird darum geklemmt.
  const autoAlone = new Engine();
  for (let i = 0; i < 100; i++) autoAlone.recordAdjudication({ target_id: 'M', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  const mixed = new Engine();
  for (let i = 0; i < 100; i++) mixed.recordAdjudication({ target_id: 'M', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  mixed.recordAdjudication({ target_id: 'M', adj_class: 'human_reject', delta: -1000 });
  assert.ok(mixed.trustOf('M') < autoAlone.trustOf('M'), `reject+auto (${mixed.trustOf('M')}) muss < auto-allein (${autoAlone.trustOf('M')}) sein — SENKEN`);
  assert.ok(mixed.trustOf('M') < 600, `reject darf die auto-Masse nicht ins solide-Band heben: ${mixed.trustOf('M')}`);
});

test('AC-T.13f (2.-Audit-🔴): ein VERBLASSTER Einmal-Anker hebt einen späteren auto-Schwall NICHT (Inv. 6 über die Zeit-Achse)', () => {
  // Der Cap/Clamp-Bypass ist EPOCHEN-lokal, nicht fold-global-sticky: `anchored` überlebt zwar, aber
  // der Anker-Trust verblasst per Mean-Reversion. Ein längst verblasster Einmal-Anker darf einen viel
  // späteren auto-Schwall nicht ungebremst ins solide-Band heben (vorher: 996; jetzt clamp-gedeckelt).
  const e = new Engine();
  e.recordAdjudication({ target_id: 'Z', adj_class: 'human_endorse', delta: 1000 }); // Anker, Epoche 0
  for (let i = 0; i < 100; i++) e.decayPass();                                        // Anker verblasst
  assert.ok(e.trustOf('Z') <= 400, `Anker-Trust muss zum Prior zurückdriften (Anti-Sleeper): ${e.trustOf('Z')}`);
  for (let i = 0; i < 2000; i++) e.recordAdjudication({ target_id: 'Z', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `late${i}` });
  assert.ok(e.trustOf('Z') <= 600, `verblasster Anker darf auto-Schwall nicht ins solide-Band (≥601) heben: ${e.trustOf('Z')}`);
  assert.ok(e.trustOf('Z') <= PRIOR + (e.spec.trustPerPeriodClamp ?? 150), `einmaliger auto-Schwall bleibt clamp-gedeckelt trotz altem Anker: ${e.trustOf('Z')}`);
});

test('AC-T.13g (gehobene, abklingende Decke): Vouch+Schwall-Peak >600, driftet bei Stille zurück Richtung Prior (KEIN Sleeper)', () => {
  // Stefans Entscheid: ein positiver Vouch hebt die auto-Decke (>600), die ABklingt → der Peak fällt
  // über Epochen zurück. Strukturell sleeper-frei (Massen-Bound): kein Kleben im soliden Band.
  const build = () => {
    const e = new Engine();
    e.recordAdjudication({ target_id: 'P', adj_class: 'human_endorse', delta: 1000 });
    for (let i = 0; i < 2000; i++) e.recordAdjudication({ target_id: 'P', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
    return e;
  };
  const peakE = build();
  const peak = peakE.trustOf('P');
  assert.ok(peak > 600, `frischer Vouch hebt die auto-Decke ins solide-Band: ${peak}`);
  const driftE = build();
  for (let i = 0; i < 10; i++) driftE.decayPass();
  const t10 = driftE.trustOf('P');
  assert.ok(t10 < peak, `Decke klingt ab — Peak driftet bei Stille zurück: t10=${t10} peak=${peak}`);
  const farE = build();
  for (let i = 0; i < 60; i++) farE.decayPass();
  const t60 = farE.trustOf('P');
  assert.ok(t60 <= 450, `nach 60 Stille-Epochen zurück Richtung Prior (kein Sleeper im soliden Band): ${t60}`);
});

test('AC-T.13h (Trivial-Anker): ein delta=1-„Vouch" hebt die auto-Decke NICHT spürbar (Anker-Stärke zählt)', () => {
  // Geerbte S1a-Schärfe geschlossen: ein billiger delta=1-Endorse darf die auto-Masse nicht ins
  // solide-Band entsperren — die gehobene Decke ist proportional zur Vouch-STÄRKE, nicht binär.
  const e = new Engine();
  e.recordAdjudication({ target_id: 'D', adj_class: 'human_endorse', delta: 1 });
  for (let i = 0; i < 2000; i++) e.recordAdjudication({ target_id: 'D', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `h${i}` });
  assert.ok(e.trustOf('D') <= 625, `Trivial-Anker (delta=1) darf 2000 auto nicht ins solide-Band heben: ${e.trustOf('D')}`);
});

test('AC-T.13i (Audit-🔴-4): Dauer-Vouch ist STÄRKE- nicht FREQUENZ-getrieben — billiger Trickle parkt nicht im soliden Band', () => {
  // vouch = max(decayed, delta) statt += delta: ein konstanter schwacher Trickle (delta=50/Epoche) +
  // beliebig viel auto darf die Decke nur stärke-proportional heben, NICHT über Frequenz auf 800
  // akkumulieren (vor dem Fix: ~636). Frequenz/Anzahl zählt nicht — nur die Einzelakt-Stärke.
  const trickle = (delta, epochs) => {
    const e = new Engine();
    for (let ep = 0; ep < epochs; ep++) {
      e.recordAdjudication({ target_id: 'X', adj_class: 'human_endorse', delta });
      for (let i = 0; i < 200; i++) e.recordAdjudication({ target_id: 'X', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: `e${ep}h${i}` });
      e.decayPass();
    }
    return e.trustOf('X');
  };
  const short = trickle(50, 5), long = trickle(50, 50);
  assert.ok(long <= short + 10, `Trickle darf über die Zeit NICHT akkumulieren (Frequenz zählt nicht): kurz=${short} lang=${long}`);
  assert.ok(long <= 620, `schwacher Dauer-Trickle (delta=50) bleibt stärke-gebunden nahe der Kappe: ${long}`);
  assert.ok(trickle(100, 20) > trickle(50, 20), 'stärkerer Einzel-Vouch hebt höher (Stärke zählt)');
  assert.ok(trickle(1000, 20) <= 800, 'auch ein voller Dauer-Vouch hebt auto nie über vouchCap=800 (verifiziert nur via Autorität)');
});

test('AC-T.11c: Replay-Determinismus — identische (recordAdjudication+decayPass)-Sequenz → identischer Trust', () => {
  const run = () => {
    const e = new Engine();
    e.recordAdjudication({ target_id: 'K', adj_class: 'human_endorse', delta: 900 });
    e.recordAdjudication({ target_id: 'K', adj_class: 'human_reject', delta: -400 });
    e.decayPass();
    e.recordAdjudication({ target_id: 'K', adj_class: 'human_endorse', delta: 500 });
    e.decayPass(); e.decayPass();
    return e.trustOf('K');
  };
  assert.equal(run(), run(), 'reine Store-Projektion → reproduzierbar');
});

test('AC-T.11d: Epochen-Determinismus ist wall-clock-frei — _now-Mock ändert trustOf NICHT', () => {
  const build = (now) => {
    const e = new Engine(); e._now = () => now;
    e.recordAdjudication({ target_id: 'W', adj_class: 'human_endorse', delta: 800 });
    e.decayPass();
    e.recordAdjudication({ target_id: 'W', adj_class: 'auto_corroborate', delta: 1000, dedup_hash: 'c1' });
    e.decayPass();
    return e.trustOf('W');
  };
  assert.equal(build(Date.parse('2026-01-01T00:00:00Z')), build(Date.parse('2030-12-31T00:00:00Z')),
    'verschiedene Wall-Clock, gleiche Epochen-Sequenz → gleicher Trust');
});

test('AC-T.2b: trustOf bleibt Integer-Promille 0..1000 über viele Epochen', () => {
  const e = new Engine();
  e.recordAdjudication({ target_id: 'I', adj_class: 'human_endorse', delta: 777 });
  e.decayPass(); e.decayPass();
  e.recordAdjudication({ target_id: 'I', adj_class: 'human_reject', delta: -333 });
  for (let q = 0; q < 12; q++) { const v = e.trustOf('I'); assert.equal(Number.isInteger(v), true); assert.ok(v >= 0 && v <= 1000); e.decayPass(); }
});

test('AC-T.4c: safe-by-default bleibt über Epochen — ohne Events liefert trustOf den Prior, auch nach decayPass', () => {
  const e = new Engine();
  assert.equal(e.trustOf('nix'), PRIOR);
  for (let i = 0; i < 10; i++) e.decayPass();
  assert.equal(e.trustOf('nix'), PRIOR, 'Stille auf leerem Knoten driftet nicht vom Prior weg');
});

test('S1b-Regress: resolveBelief / klassischer Pfad unberührt (additiv)', () => {
  const e = new Engine();
  e.storeTriple({ subject: 'Aa', predicate: 'pp', object: 'Bb', confidence: 800 });
  e.decayPass();
  const r = e.resolveBelief('Aa', 'pp');
  assert.ok(r && r.winner === 'Bb', 'resolveBelief funktioniert unverändert weiter');
});
