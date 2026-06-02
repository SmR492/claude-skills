import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S4 — Defeater/Contestation (Modell H: separater contestation_events-Ledger).
// Invariante (§6): Anfechtung kippt den Top-Tier auf `contested` (Read-Verdikt), NIE auf `contradicted`;
// der Gewinner HÄLT. Beweislast beim Anfechter: die contested-Schwelle skaliert mit trustOf(Gewinner).
// Eigener append-only Ledger → senkt strukturell NIE den Trust.
//
// IDENTITÄT KOMMT AUS DER PEER-REGISTRY (Stefan-Entscheid nach Audit R1–R4): es zählen NUR Anfechtungen
// registrierter, VERTRAUTER Peers (Standing), pro Peer nur dessen STÄRKSTE Anfechtung (MAX, nicht Summe).
// Anonyme/untrusted Herkunft trägt 0 bei (kein freier String erzeugt eine Herkunft → keine Unicode-/
// Pseudonym-/Whitespace-Inflation). Storage immer distinkt (kein INSERT OR IGNORE) → Suppression unmöglich.
// Schwelle: trustContestBase=300 + trunc(trustOf·trustContestSlope/1000) = 300 + trustOf.

const mk = () => new Engine();
const THR = (trust) => 300 + Math.trunc((trust * 1000) / 1000);

// einen registrierten, vertrauten Peer anlegen (gültiger PubKey via frischer Engine-Identität).
function trustedPeer(e, id, level = 'full') {
  e.peerAdd(id, new Engine().identity.publicKeyPem);
  e.peerTrust(id, level);
  return id;
}
// Belief anlegen + optional N× per human_endorse verankern (Autoritäts-Achse, clamp-frei → hebt trustOf).
function belief(e, { subject = 'Subj', predicate = 'pred', object = 'Obj', confidence = 700, source_type = 'fachquelle', endorseN = 0 } = {}) {
  const f = e.storeTriple({ subject, predicate, object, confidence, source_type });
  for (let i = 0; i < endorseN; i++) e.recordAdjudication({ target_id: f.triple_hash, adj_class: 'human_endorse', delta: 1000 });
  return f.triple_hash;
}

test('AC-S4.1: contest() schreibt NICHT in trust_events → trustOf unverändert (Trust-Invariante strukturell)', () => {
  const e = mk();
  const p = trustedPeer(e, 'peerX');
  const h = belief(e);
  const trustBefore = e.trustOf(h);
  const teBefore = e.db.prepare('SELECT COUNT(*) c FROM trust_events WHERE target_id=?').get(h).c;
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 1000, reason: 'Gegenbeleg' });
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM trust_events WHERE target_id=?').get(h).c, teBefore, 'kein trust_events-Eintrag durch contest');
  assert.equal(e.trustOf(h), trustBefore, 'trustOf unverändert — Anfechtung senkt NIE den Trust');
  assert.equal(e.db.prepare('SELECT COUNT(*) c FROM contestation_events WHERE target_id=?').get(h).c, 1, 'liegt im separaten Ledger');
});

test('AC-S4.2: Gewinner HÄLT trotz Anfechtung über Schwelle; kippt nie auf contradicted', () => {
  const e = mk();
  const p = trustedPeer(e, 'p1');
  const h = belief(e, { subject: 'Mars', predicate: 'farbe', object: 'rot' });
  const thr = THR(e.trustOf(h)); // prior 300 → 600
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 1000 }); // ≥ thr
  assert.ok(e.contestationOf(h) >= thr);
  const r = e.resolveBelief('Mars', 'farbe');
  assert.equal(r.winner, 'rot', 'Gewinner hält — Anfechtung verwirft den Fakt NICHT');
  assert.notEqual(r.winner, 'contradicted');
  assert.equal(r.contested, true, 'aber als contested markiert (Read-Verdikt)');
});

test('AC-S4.3: Schwelle skaliert mit Verankerung — Beweislast beim Anfechter', () => {
  const e = mk();
  const p = trustedPeer(e, 'p1');
  const weak = belief(e, { subject: 'Aa', predicate: 'pp', object: 'X1' });            // prior
  const strong = belief(e, { subject: 'Bb', predicate: 'pp', object: 'Y1', endorseN: 6 }); // verankert
  const tw = e.trustOf(weak), tsg = e.trustOf(strong);
  assert.ok(tsg > tw, `stark verankert hat höheren Trust (${tsg} > ${tw})`);
  const thrWeak = THR(tw), thrStrong = THR(tsg);
  assert.ok(thrStrong > thrWeak, 'höhere Verankerung → höhere Anfechtungs-Schwelle');
  const w = Math.min(1000, Math.max(thrWeak, Math.floor((thrWeak + thrStrong) / 2))); // strikt zwischen den Schwellen
  e.contest(weak, { contester_id: p, contest_type: 'empirical', weight: w });
  e.contest(strong, { contester_id: p, contest_type: 'empirical', weight: w });
  assert.equal(e.resolveBelief('Aa', 'pp').contested, true, `schwach Verankertes (Schwelle ${thrWeak}) ist mit Last ${w} contested`);
  const rs = e.resolveBelief('Bb', 'pp');
  assert.equal(rs.contested, false, `stark Verankertes (Schwelle ${thrStrong}) hält dieselbe Last ${w} aus`);
  assert.equal(rs.winner, 'Y1', 'und bleibt Gewinner');
});

test('AC-S4.4: Anfechtung akkumuliert über distinkte vertraute ANFECHTER', () => {
  const e = mk();
  const a = trustedPeer(e, 'src-A'), b = trustedPeer(e, 'src-B');
  const h = belief(e, { subject: 'Cc', predicate: 'pp', object: 'Z1' });
  const thr = THR(e.trustOf(h)); // 600
  e.contest(h, { contester_id: a, contest_type: 'empirical', weight: 400 }); // < 600
  assert.equal(e.contestationOf(h), 400);
  assert.equal(e.resolveBelief('Cc', 'pp').contested, false, 'ein Anfechter unter Schwelle → nicht contested');
  e.contest(h, { contester_id: b, contest_type: 'empirical', weight: 400 }); // +400 = 800 ≥ 600
  assert.equal(e.contestationOf(h), 800, 'zweiter distinkter vertrauter Anfechter akkumuliert');
  assert.equal(e.resolveBelief('Cc', 'pp').contested, true, 'über Schwelle → contested');
});

test('AC-S4.5: append-only (Trigger) + derselbe Anfechter zählt nur seine STÄRKSTE (MAX, keine Doppelzählung)', () => {
  const e = mk();
  const p = trustedPeer(e, 'p1');
  const h = belief(e);
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 300 });
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 500 });
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 200 });
  assert.equal(e.contestationOf(h), 500, 'derselbe Anfechter → MAX (500), nicht Summe (1000)');
  assert.throws(() => e.db.prepare('UPDATE contestation_events SET weight_promille=1 WHERE target_id=?').run(h), /append-only/);
  assert.throws(() => e.db.prepare('DELETE FROM contestation_events WHERE target_id=?').run(h), /append-only/);
});

test('AC-S4.6: institutionelle Anfechtung gegen eternal = proposedContested (kein Auto-Vollzug); empirische zählt', () => {
  const e = mk();
  const p = trustedPeer(e, 'p1');
  const h = belief(e, { subject: 'Dd', predicate: 'pp', object: 'W1' });
  e.db.prepare("UPDATE knowledge_edges SET temporality='eternal' WHERE triple_hash=?").run(h);
  e.contest(h, { contester_id: p, contest_type: 'institutional', weight: 1000 }); // ≥ Schwelle, aber institutionell
  const r = e.resolveBelief('Dd', 'pp');
  assert.equal(r.winner, 'W1', 'Gewinner hält');
  assert.equal(r.contested, false, 'institutionelle Anfechtung vollzieht NICHT automatisch gegen eternal (Floor, AC-T.12-Parität)');
  assert.equal(r.contestation.proposedContested, true, 'sondern Vorschlag (Endorsement-pflichtig)');
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 1000 }); // empirisch zählt sofort
  const r2 = e.resolveBelief('Dd', 'pp');
  assert.equal(r2.contested, true, 'empirische Anfechtung über Schwelle kippt auf contested');
  assert.equal(r2.winner, 'W1', 'Gewinner hält weiterhin (nie contradicted)');
});

test('AC-S4.7: über-Schwelle-Anfechtung surface-t Eskalation (eine Tier-Stufe nach oben)', () => {
  const e = mk();
  const p = trustedPeer(e, 'p1');
  const h = belief(e, { subject: 'Ee', predicate: 'pp', object: 'V1' });
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 1000 });
  const r = e.resolveBelief('Ee', 'pp');
  assert.equal(r.contested, true);
  assert.ok(r.contestation.escalation, 'Eskalations-Hinweis vorhanden');
  const wc = r.candidates.find((c) => c.object === 'V1');
  assert.equal(r.contestation.escalation.neededTier, Math.min(6, wc.tier + 1), 'eine Stufe über der effektiven Tier-Stufe des Gewinners');
});

test('AC-S4.8: Validierung + Determinismus (Conformance)', () => {
  const e = mk();
  const h = belief(e);
  assert.throws(() => e.contest(h, { contest_type: 'bogus', weight: 100 }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.contest(h, { contest_type: 'empirical', weight: 1500 }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.contest(h, { contest_type: 'empirical', weight: -1 }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.contest(h, { contest_type: 'empirical', weight: 100, contester_id: 42 }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.contest('does-not-exist', { contest_type: 'empirical', weight: 100 }), /INVALID_PARAMETER_FORMAT/);
  const run = () => {
    const x = mk(); x._now = () => Date.parse('2026-06-01T00:00:00Z');
    trustedPeer(x, 'p1');
    const hh = belief(x, { subject: 'Ff', predicate: 'pp', object: 'U1' });
    x.contest(hh, { contester_id: 'p1', contest_type: 'empirical', weight: 1000 });
    const r = x.resolveBelief('Ff', 'pp');
    return JSON.stringify({ winner: r.winner, contested: r.contested, c: r.contestation });
  };
  assert.equal(run(), run(), 'reproduzierbar (knoten-/replay-stabil)');
});

test('AC-S4.9 (safe-by-default): ohne Anfechtung ist resolveBelief unverändert (kein contestation-Feld)', () => {
  const e = mk();
  belief(e, { subject: 'Gg', predicate: 'pp', object: 'T1' });
  const r = e.resolveBelief('Gg', 'pp');
  assert.equal(r.winner, 'T1');
  assert.equal(r.contested, false);
  assert.equal(r.contestation, undefined, 'kein contestation-Objekt ohne Anfechtungs-Events (kein Rauschen)');
});

test('AC-S4.10 (Audit R1–R4-🔴): keine Inflation — ein Anfechter = MAX; anonym/untrusted = 0; nur distinkte Trust-Peers akkumulieren', () => {
  const e = mk();
  const h = belief(e, { subject: 'Ii', predicate: 'pp', object: 'S1' }); // thr = 600
  const mono = trustedPeer(e, 'mono');
  // EIN vertrauter Anfechter, viele Anfechtungen → nur seine STÄRKSTE zählt:
  e.contest(h, { contester_id: mono, contest_type: 'empirical', weight: 200 });
  e.contest(h, { contester_id: mono, contest_type: 'empirical', weight: 400 });
  e.contest(h, { contester_id: mono, contest_type: 'empirical', weight: 300 });
  assert.equal(e.contestationOf(h), 400, 'Stärke pro Herkunft = MAX → keine Frequenz-Inflation');
  // anonym (null) + pseudo-anonyme/Unicode-Strings + unregistrierte IDs → ALLE 0 (kein Standing):
  const noise = [null, '', '  ', '\t', '​', '​​', 'rando', 'evilbot​', 'anonymous'];
  for (let i = 0; i < noise.length; i++) e.contest(h, { contester_id: noise[i], contest_type: 'empirical', weight: 1000 });
  assert.equal(e.contestationOf(h), 400, 'keine String-Variante (Unicode/Whitespace/Pseudonym) erzeugt eine Herkunft → unverändert 400');
  assert.equal(e.resolveBelief('Ii', 'pp').contested, false, 'Schwelle (600) NICHT durch einen Anfechter + beliebiges Rauschen überwindbar');
  // ein registrierter, aber UNTRUSTED Peer zählt ebenfalls nicht:
  e.peerAdd('lowtrust', new Engine().identity.publicKeyPem); // bleibt 'untrusted'
  e.contest(h, { contester_id: 'lowtrust', contest_type: 'empirical', weight: 1000 });
  assert.equal(e.contestationOf(h), 400, 'untrusted Peer hat kein Standing');
  // erst ein zweiter VERTRAUTER Anfechter akkumuliert legitim:
  const b = trustedPeer(e, 'src-B');
  e.contest(h, { contester_id: b, contest_type: 'empirical', weight: 500 });
  assert.equal(e.contestationOf(h), 900, 'mono(400)+src-B(500)=900');
  assert.equal(e.resolveBelief('Ii', 'pp').contested, true, 'genug echte distinkte Trust-Peers kippen auf contested');
});

test('AC-S4.11 (Audit-R2/R4-🔴): Suppression strukturell unmöglich — weight=0 verdrängt keine starke Anfechtung', () => {
  const e = mk();
  const wb = trustedPeer(e, 'whistleblower'), def = trustedPeer(e, 'defender');
  const h = belief(e, { subject: 'Mm', predicate: 'pp', object: 'O1' });
  // selber Anfechter, erst weight=0, dann weight=1000 (gleicher dedup_hash) → MAX, nicht first-writer:
  e.contest(h, { contester_id: wb, contest_type: 'empirical', weight: 0, dedup_hash: 'x' });
  e.contest(h, { contester_id: wb, contest_type: 'empirical', weight: 1000, dedup_hash: 'x' });
  assert.equal(e.contestationOf(h), 1000, 'keine Zeile wird verdrängt (kein INSERT OR IGNORE) → MAX gewinnt');
  // fremder „Verteidiger" mit weight=0 + gleichem dedup_hash unterdrückt die echte Anfechtung nicht:
  e.contest(h, { contester_id: def, contest_type: 'empirical', weight: 0, dedup_hash: 'x' });
  assert.equal(e.contestationOf(h), 1000, 'fremde Anfechter bleiben getrennt → Whistleblower überlebt');
});

test('AC-S4.12: institutionelle Anfechter akkumulieren über distinkte Herkunft; Wiederholung nicht', () => {
  const e = mk();
  const a = trustedPeer(e, 'gov-A'), b = trustedPeer(e, 'gov-B');
  const h2 = belief(e, { subject: 'Jj', predicate: 'pp', object: 'R1' });
  e.contest(h2, { contester_id: a, contest_type: 'institutional', weight: 400 });
  e.contest(h2, { contester_id: b, contest_type: 'institutional', weight: 400 });
  assert.equal(e.contestationOf(h2), 800, 'zwei distinkte Institutionen akkumulieren');
  e.contest(h2, { contester_id: a, contest_type: 'institutional', weight: 1000 });
  assert.equal(e.contestationOf(h2), 1400, 'dieselbe Institution → ihre STÄRKSTE (gov-A:1000) + gov-B:400');
});

test('AC-S4.13 (Audit-R1-🟡): as-of-Linse zeigt keine anachronistische (heutige) Anfechtung (S4b-Grenze fail-safe)', () => {
  const e = mk();
  e._now = () => Date.parse('2026-06-01T00:00:00Z');
  const p = trustedPeer(e, 'p1');
  const h = belief(e, { subject: 'Kk', predicate: 'pp', object: 'Q1', confidence: 800 });
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 1000 }); // ≥ Schwelle
  assert.equal(e.resolveBelief('Kk', 'pp').contested, true, 'Live-Sicht: contested');
  const past = e.resolveBelief('Kk', 'pp', { as_of: '2026-06-01T12:00:00Z' });
  assert.equal(past.winner, 'Q1', 'historischer Gewinner unverändert');
  assert.equal(past.contestation, undefined, 'keine anachronistische Anfechtung in der as-of-Sicht');
});

test('AC-S4.14: peerRevoke entzieht rückwirkend das Standing (Read-Lens projiziert aktuellen Trust)', () => {
  const e = mk();
  const p = trustedPeer(e, 'p1');
  const h = belief(e, { subject: 'Nn', predicate: 'pp', object: 'N1' });
  e.contest(h, { contester_id: p, contest_type: 'empirical', weight: 1000 });
  assert.equal(e.resolveBelief('Nn', 'pp').contested, true, 'vertrauter Peer: contested');
  e.peerTrust('p1', 'untrusted'); // Trust entzogen
  assert.equal(e.contestationOf(h), 0, 'entzogener Peer trägt nicht mehr bei');
  assert.equal(e.resolveBelief('Nn', 'pp').contested, false, 'contested fällt rückwirkend weg (Read-Lens)');
});

test('AC-S4.15 (Audit-R5-🟡): self-contestation (eigener Peer, self=full) zählt als EINE Herkunft — bewusste Selbstkorrektur', () => {
  const e = mk();
  const h = belief(e, { subject: 'Pp', predicate: 'pp', object: 'P1' }); // thr 600
  e.contest(h, { contester_id: e.peerId, contest_type: 'empirical', weight: 1000 });
  assert.equal(e.contestationOf(h), 1000, 'self=full hat Standing (genau eine Herkunft)');
  assert.equal(e.resolveBelief('Pp', 'pp').contested, true, 'der Knoten darf seinen eigenen Belief als strittig markieren');
  e.contest(h, { contester_id: e.peerId, contest_type: 'empirical', weight: 1000 }); // Wiederholung
  assert.equal(e.contestationOf(h), 1000, 'self inflationiert nicht (per-Herkunft-MAX, genau eine Herkunft)');
});

test('S4-Regress: bestehende Kandidaten-Uneinigkeit-contested unberührt (ohne Ledger)', () => {
  const e = mk();
  e.storeTriple({ subject: 'Hh', predicate: 'pp', object: 'A2', confidence: 800, source_type: 'fachquelle' });
  e.storeTriple({ subject: 'Hh', predicate: 'pp', object: 'B2', confidence: 800, source_type: 'fachquelle' });
  const r = e.resolveBelief('Hh', 'pp');
  assert.equal(r.contested, true, 'Kandidaten-Uneinigkeit weiterhin contested');
  assert.equal(r.contestation, undefined);
});
