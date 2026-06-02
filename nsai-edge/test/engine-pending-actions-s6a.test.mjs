import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';

// ADR 0019 Slice S6a — MCP-Trust-Wiring + Two-Door-Approval-Gate.
// Claude-Tür (MCP): READ + SICHERE Writes direkt; GEFÄHRLICHE Mutationen (reject, promote_fiction,
// authority_endorse) NUR als Vorschlag in pending_actions. Mensch-Tür (CLI): list/approve/reject.
// Claude kann NIE selbst vollziehen und NIE approven. Diese Datei testet die Engine-Seite (Two-Door).

const mk = () => new Engine();

// Helfer: einen aktiven Fakt anlegen und seinen Hash zurückgeben.
const fact = (e, s = 'Aa', p = 'pp', o = 'Bb', opts = {}) => e.storeTriple({ subject: s, predicate: p, object: o, confidence: opts.confidence ?? 800, source_type: opts.source_type ?? 'manual' });

// ===== AC-T1: roh-Trust nicht setzbar über Claude-Pfad =====
test('AC-T1: corroborate schreibt auto_corroborate und hebt trustOf NIE über die auto-Decke (600)', () => {
  const e = mk();
  // Ein Ziel mehrfach mit weight 1000 über VERSCHIEDENE dedup_hash korroborieren (Anzahl-Achse).
  for (let i = 0; i < 20; i++) {
    const r = e.corroborate({ target_id: 'NodeX', weight: 1000, dedup_hash: `dh-${i}` });
    assert.ok(r.event_hash, 'event_hash zurück');
    assert.equal(typeof r.epoch, 'number');
  }
  const t = e.trustOf('NodeX');
  assert.ok(t <= 600, `auto_corroborate kann nie Autorität setzen — trustOf=${t} <= 600`);
  // Belegen, dass die Events tatsächlich adj_class='auto_corroborate' tragen (kein roher human/oracle-Schmuggel).
  const classes = e.db.prepare("SELECT DISTINCT adj_class FROM trust_events WHERE target_id='NodeX'").all().map((r) => r.adj_class);
  assert.deepEqual(classes, ['auto_corroborate'], 'NUR auto_corroborate-Events über den Claude-Pfad');
});

test('AC-T1: corroborate klemmt weight auf [0,1000]', () => {
  const e = mk();
  // weight > 1000 darf nicht werfen, sondern wird geklemmt (recordAdjudication akzeptiert nur [-1000,1000]).
  assert.doesNotThrow(() => e.corroborate({ target_id: 'Clamp', weight: 5000, dedup_hash: 'c1' }));
  assert.doesNotThrow(() => e.corroborate({ target_id: 'Clamp', weight: -99, dedup_hash: 'c2' }));
});

test('AC-T1: corroborate ohne dedup_hash wirft INVALID_PARAMETER_FORMAT', () => {
  const e = mk();
  assert.throws(() => e.corroborate({ target_id: 'NoDedup', weight: 500 }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.corroborate({ target_id: 'NoDedup', weight: 500, dedup_hash: '' }), /INVALID_PARAMETER_FORMAT/);
});

// ===== AC-T2: propose(reject) mutiert nicht; erst approve retraktiert; doppel-approve wirft =====
test('AC-T2: proposeAction(reject) MUTIERT NICHT — Edge bleibt active; approveAction retraktiert', () => {
  const e = mk();
  const f = fact(e);
  const prop = e.proposeAction({ kind: 'reject', payload: { triple_hash: f.triple_hash } });
  assert.equal(prop.status, 'pending');
  assert.ok(prop.id);
  assert.ok(prop.preview, 'preview vorhanden');
  assert.equal(prop.preview.triple_hash, f.triple_hash);
  assert.ok(Array.isArray(prop.preview.affected_derived));
  // Mutation darf NICHT passiert sein:
  const before = e.db.prepare('SELECT local_status FROM knowledge_edges WHERE triple_hash=?').get(f.triple_hash);
  assert.equal(before.local_status, 'active', 'proposeAction retraktiert NICHT');
  // Approve vollzieht die echte Retraktion:
  const res = e.approveAction(prop.id);
  assert.equal(res.executed, true);
  assert.equal(res.kind, 'reject');
  const after = e.db.prepare('SELECT local_status FROM knowledge_edges WHERE triple_hash=?').get(f.triple_hash);
  assert.notEqual(after.local_status, 'active', 'nach approve ist der Edge retraktiert (nicht active)');
});

test('AC-T2: Doppel-approve wirft (status nicht mehr pending)', () => {
  const e = mk();
  const f = fact(e);
  const prop = e.proposeAction({ kind: 'reject', payload: { triple_hash: f.triple_hash } });
  e.approveAction(prop.id);
  assert.throws(() => e.approveAction(prop.id), /INVALID_PARAMETER/);
});

test('AC-T2: proposeAction(reject) auf nicht-existenten Hash wirft', () => {
  const e = mk();
  assert.throws(() => e.proposeAction({ kind: 'reject', payload: { triple_hash: 'deadbeef' } }), /INVALID_PARAMETER_FORMAT/);
});

test('AC-T2: reject mit attribution propagiert Blame beim Approve', () => {
  const e = mk();
  // Basis-Prämisse + abgeleiteter Fakt (derived_from) bauen, damit Blame propagieren KANN.
  const prem = fact(e, 'Prem', 'pp', 'val');
  // Manuell einen abgeleiteten Fakt anlegen, der von prem abhängt.
  const derived = e.storeTriple({ subject: 'Concl', predicate: 'pp', object: 'res', confidence: 700, source_type: 'inference' });
  e.db.prepare('UPDATE knowledge_edges SET derived_from=? WHERE triple_hash=?')
    .run(JSON.stringify({ rule_id: 'r1', from: [prem.triple_hash] }), derived.triple_hash);
  const prop = e.proposeAction({ kind: 'reject', payload: { triple_hash: derived.triple_hash, attribution: 'rebut' } });
  const before = e.trustOf(prem.triple_hash);
  e.approveAction(prop.id);
  const after = e.trustOf(prem.triple_hash);
  assert.ok(after <= before, `Blame propagiert auf die Prämisse (trust ${before} -> ${after})`);
});

// ===== AC-T3: contest-Boundary (Guard self/null; untrusted trägt 0; trusted trägt bei) =====
test('AC-T3: contestationOf zählt untrusted/self/null NICHT, trusted Peer schon (Fold-Verhalten)', () => {
  const e = mk();
  const f = fact(e);
  // self-contest (contester_id = peerId) → self ist trusted=full im Fold; aber der MCP-Guard blockt self.
  // null contester → trägt 0 bei (kein Standing).
  e.contest(f.triple_hash, { contester_id: null, weight: 1000 });
  assert.equal(e.contestationOf(f.triple_hash), 0, 'anonym (null) trägt 0 bei');
  // untrusted, unbekannter Peer → schreibt eine Zeile, trägt aber 0 bei.
  e.contest(f.triple_hash, { contester_id: 'peer:untrusted-xyz', weight: 1000 });
  assert.equal(e.contestationOf(f.triple_hash), 0, 'untrusted Peer hat kein Standing → 0');
  const rows = e.db.prepare('SELECT COUNT(*) c FROM contestation_events WHERE target_id=?').get(f.triple_hash).c;
  assert.ok(rows >= 2, 'Zeilen werden als Audit-Spur dennoch geschrieben');
  // einen Peer registrieren + trusten → trägt jetzt bei.
  const peerEng = mk();
  e.peerAdd('peer:trusted-1', peerEng.identity.publicKeyPem, null);
  e.peerTrust('peer:trusted-1', 'full');
  e.contest(f.triple_hash, { contester_id: 'peer:trusted-1', weight: 700 });
  assert.equal(e.contestationOf(f.triple_hash), 700, 'trusted Peer trägt seine stärkste Anfechtung bei');
});

// ===== AC-T4: pending_actions trägt proposed_by Provenienz =====
test('AC-T4: pending_actions-Zeile trägt proposed_by Default mcp-agent', () => {
  const e = mk();
  const f = fact(e);
  const prop = e.proposeAction({ kind: 'reject', payload: { triple_hash: f.triple_hash } });
  const row = e.db.prepare('SELECT proposed_by FROM pending_actions WHERE id=?').get(prop.id);
  assert.equal(row.proposed_by, 'mcp-agent');
  // explizite Provenienz überschreibbar
  const prop2 = e.proposeAction({ kind: 'reject', payload: { triple_hash: f.triple_hash }, proposed_by: 'cli-test' });
  assert.equal(e.db.prepare('SELECT proposed_by FROM pending_actions WHERE id=?').get(prop2.id).proposed_by, 'cli-test');
});

// ===== AC-T5: Fiktion ohne Gate; promote_fiction nur via propose->approve =====
test('AC-T5: storeFiction/recallWorld ohne Gate; query/resolveBelief sehen Fiktion NICHT; promote nur via approve', () => {
  const e = mk();
  e.storeFiction({ subject: 'Hyp', predicate: 'ist', object: 'wahr', world: 'sandbox', source_type: 'manual' });
  assert.equal(e.recallWorld('sandbox', { subject: 'Hyp' }).fiction.length, 1, 'recallWorld sieht die Fiktion');
  assert.equal(e.resolveBelief('Hyp', 'ist'), null, 'resolveBelief sieht die Fiktion NICHT');
  assert.equal(e.query('Hyp').edges.length, 0, 'query sieht die Fiktion NICHT');
  const hash = e.recallWorld('sandbox', { subject: 'Hyp' });
  const triple_hash = e.db.prepare('SELECT triple_hash FROM sandbox_edges WHERE world=? AND subject=?').get('sandbox', 'Hyp').triple_hash;
  // proposeAction mutiert nicht:
  const prop = e.proposeAction({ kind: 'promote_fiction', payload: { world: 'sandbox', triple_hash } });
  assert.equal(prop.status, 'pending');
  assert.equal(prop.preview.subject, 'Hyp');
  assert.equal(prop.preview.predicate, 'ist');
  assert.equal(prop.preview.object, 'wahr');
  assert.equal(prop.preview.already_fact, false);
  assert.equal(e.resolveBelief('Hyp', 'ist'), null, 'propose mutiert NICHT — noch kein Fakt');
  // approve legt den Fakt an:
  const res = e.approveAction(prop.id);
  assert.equal(res.executed, true);
  assert.equal(e.resolveBelief('Hyp', 'ist').winner, 'wahr', 'nach approve: echter Fakt');
});

test('AC-T5: proposeAction(promote_fiction) auf nicht-existente Sandbox-Zeile wirft', () => {
  const e = mk();
  assert.throws(() => e.proposeAction({ kind: 'promote_fiction', payload: { world: 'nope', triple_hash: 'x' } }), /INVALID_PARAMETER_FORMAT/);
});

// ===== AC-T6: authority_endorse nur via propose->approve; preview ohne Mutation =====
test('AC-T6: authority_endorse — propose berechnet preview OHNE Mutation, approve vollzieht', () => {
  const e = mk();
  const before = e.trustOf('TargetNode');
  const prop = e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'TargetNode', adj_class: 'human_endorse', delta: 500 } });
  assert.equal(prop.status, 'pending');
  assert.equal(prop.preview.target_id, 'TargetNode');
  assert.equal(prop.preview.adj_class, 'human_endorse');
  assert.equal(prop.preview.delta, 500);
  assert.equal(typeof prop.preview.current_trust, 'number');
  assert.equal(e.trustOf('TargetNode'), before, 'propose mutiert trustOf NICHT');
  const res = e.approveAction(prop.id);
  assert.equal(res.executed, true);
  assert.ok(e.trustOf('TargetNode') > before, 'approve vollzieht den Autoritäts-Endorse → trustOf steigt');
});

test('AC-T6: authority_endorse mit adj_class außerhalb {human_endorse,oracle_higher_tier} wirft', () => {
  const e = mk();
  assert.throws(() => e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'X', adj_class: 'auto_corroborate', delta: 100 } }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'X', adj_class: 'derived_blame', delta: -100 } }), /INVALID_PARAMETER_FORMAT/);
  assert.throws(() => e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'X', adj_class: 'human_endorse', delta: 9999 } }), /INVALID_PARAMETER_FORMAT/);
  // oracle_higher_tier ist erlaubt:
  assert.doesNotThrow(() => e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'X', adj_class: 'oracle_higher_tier', delta: 200 } }));
});

// ===== Plus: rejectAction; listPending filtert nach status; unbekannte kind =====
test('rejectAction setzt status=rejected ohne Mutation', () => {
  const e = mk();
  const f = fact(e);
  const prop = e.proposeAction({ kind: 'reject', payload: { triple_hash: f.triple_hash } });
  const r = e.rejectAction(prop.id, 'nicht plausibel');
  assert.equal(r.status, 'rejected');
  const edge = e.db.prepare('SELECT local_status FROM knowledge_edges WHERE triple_hash=?').get(f.triple_hash);
  assert.equal(edge.local_status, 'active', 'rejectAction vollzieht die Mutation NICHT');
  // ein abgelehnter Vorschlag kann nicht mehr approved werden:
  assert.throws(() => e.approveAction(prop.id), /INVALID_PARAMETER/);
});

test('listPending filtert nach status', () => {
  const e = mk();
  const f1 = fact(e, 'A1');
  const f2 = fact(e, 'A2');
  const f3 = fact(e, 'A3');
  const p1 = e.proposeAction({ kind: 'reject', payload: { triple_hash: f1.triple_hash } });
  const p2 = e.proposeAction({ kind: 'reject', payload: { triple_hash: f2.triple_hash } });
  const p3 = e.proposeAction({ kind: 'reject', payload: { triple_hash: f3.triple_hash } });
  e.approveAction(p1.id);
  e.rejectAction(p2.id);
  const pending = e.listPending();
  assert.equal(pending.length, 1, 'nur p3 ist noch pending');
  assert.equal(pending[0].id, p3.id);
  assert.equal(e.listPending({ status: 'approved' }).length, 1);
  assert.equal(e.listPending({ status: 'rejected' }).length, 1);
  // payload/preview sind geparst (Objekte, kein JSON-String):
  assert.equal(typeof pending[0].payload, 'object');
  assert.equal(typeof pending[0].preview, 'object');
});

test('proposeAction mit unbekanntem kind wirft', () => {
  const e = mk();
  assert.throws(() => e.proposeAction({ kind: 'nuke_everything', payload: {} }), /INVALID_PARAMETER_FORMAT/);
});

test('authority_endorse target muss existieren-fähig sein (preview liest trustOf ohne Crash)', () => {
  const e = mk();
  // trustOf akzeptiert beliebige Knoten-IDs (Prior-Fallback) → preview soll nicht crashen.
  const prop = e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'NieGesehen', adj_class: 'human_endorse', delta: 100 } });
  assert.equal(prop.preview.current_trust, e.trustOf('NieGesehen'));
});

// ===== 🔴-1: peer_trust NUR über die Mensch-Tür (propose→approve oder direkt peerTrust) =====
// Trust-VERGABE ist ein Autoritäts-Akt; das ungegatete graph__peer_trust-MCP-Tool ist entfernt.
test('AC-T7 (d): proposeAction(peer_trust) MUTIERT NICHT; approveAction vollzieht; danach zählt ein Contest des Peers >0', () => {
  const e = mk();
  const f = fact(e);
  // Peer registrieren (→ untrusted, kein Standing)
  const peerEng = mk();
  e.peerAdd('peer:cand', peerEng.identity.publicKeyPem, null);
  assert.equal(e.db.prepare('SELECT trust_level FROM peers WHERE peer_id=?').get('peer:cand').trust_level, 'untrusted');
  // Contest VOR dem Trust → trägt 0 bei (untrusted hat kein Standing)
  e.contest(f.triple_hash, { contester_id: 'peer:cand', weight: 1000 });
  assert.equal(e.contestationOf(f.triple_hash), 0, 'untrusted Peer trägt 0 bei');
  // propose mutiert das Trust-Level NICHT
  const prop = e.proposeAction({ kind: 'peer_trust', payload: { peer_id: 'peer:cand', level: 'full' } });
  assert.equal(prop.status, 'pending');
  assert.equal(prop.preview.peer_id, 'peer:cand');
  assert.equal(prop.preview.level, 'full');
  assert.equal(prop.preview.current_level, 'untrusted');
  assert.equal(e.db.prepare('SELECT trust_level FROM peers WHERE peer_id=?').get('peer:cand').trust_level, 'untrusted', 'propose vergibt KEINEN Trust');
  // approve vollzieht die Trust-Vergabe
  const res = e.approveAction(prop.id);
  assert.equal(res.executed, true);
  assert.equal(res.kind, 'peer_trust');
  assert.equal(e.db.prepare('SELECT trust_level FROM peers WHERE peer_id=?').get('peer:cand').trust_level, 'full', 'approve setzt peerTrust=full');
  // NACH dem Trust trägt der Contest des Peers bei (>0)
  assert.ok(e.contestationOf(f.triple_hash) > 0, 'nach peerTrust=full trägt der Contest des Peers >0 bei');
  assert.equal(e.contestationOf(f.triple_hash), 1000, 'die stärkste Anfechtung des nun getrusteten Peers');
});

test('AC-T7 (d): proposeAction(peer_trust) validiert level + Peer-Existenz', () => {
  const e = mk();
  // ungültiges level → INVALID_PARAMETER_FORMAT
  assert.throws(() => e.proposeAction({ kind: 'peer_trust', payload: { peer_id: 'x', level: 'super' } }), /INVALID_PARAMETER_FORMAT/);
  // Peer nicht registriert → INVALID_PARAMETER_FORMAT (erst peer_add)
  assert.throws(() => e.proposeAction({ kind: 'peer_trust', payload: { peer_id: 'nie', level: 'full' } }), /peer unbekannt/);
  // gültige level werden akzeptiert (nach peer_add)
  const peerEng = mk();
  e.peerAdd('peer:ok', peerEng.identity.publicKeyPem, null);
  for (const lvl of ['untrusted', 'limited', 'full', 'authoritative']) {
    assert.doesNotThrow(() => e.proposeAction({ kind: 'peer_trust', payload: { peer_id: 'peer:ok', level: lvl } }));
  }
});

test('AC-T7 (e): Doppel-Approve einer peer_trust-Aktion wirft', () => {
  const e = mk();
  const peerEng = mk();
  e.peerAdd('peer:dbl', peerEng.identity.publicKeyPem, null);
  const prop = e.proposeAction({ kind: 'peer_trust', payload: { peer_id: 'peer:dbl', level: 'limited' } });
  e.approveAction(prop.id);
  assert.throws(() => e.approveAction(prop.id), /INVALID_PARAMETER_STATE/);
  // Trust-Level bleibt beim einmaligen Vollzug (limited), kein Doppel-Effekt
  assert.equal(e.db.prepare('SELECT trust_level FROM peers WHERE peer_id=?').get('peer:dbl').trust_level, 'limited');
});

// ===== 🟡-2: approveAction ist CLAIM-FIRST (at-most-once) =====
test('AC-T8 (f): approveAction ist claim-first — nach Approve ist die Zeile approved; zweites Approve wirft; genau EIN trust_event (authority_endorse)', () => {
  const e = mk();
  const prop = e.proposeAction({ kind: 'authority_endorse', payload: { target_id: 'Claim1st', adj_class: 'human_endorse', delta: 400 } });
  const res = e.approveAction(prop.id);
  assert.equal(res.executed, true);
  // Zeile ist 'approved'
  assert.equal(e.db.prepare('SELECT status FROM pending_actions WHERE id=?').get(prop.id).status, 'approved');
  // genau EIN human_endorse-trust_event für das Ziel entstand
  const cnt1 = e.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id=? AND adj_class='human_endorse'").get('Claim1st').c;
  assert.equal(cnt1, 1, 'genau EIN trust_event nach dem ersten Approve');
  // zweites Approve wirft INVALID_PARAMETER_STATE (Zeile nicht mehr pending) → KEIN zweites Event
  assert.throws(() => e.approveAction(prop.id), /INVALID_PARAMETER_STATE/);
  const cnt2 = e.db.prepare("SELECT COUNT(*) c FROM trust_events WHERE target_id=? AND adj_class='human_endorse'").get('Claim1st').c;
  assert.equal(cnt2, 1, 'kein doppeltes Event durch Re-Approve (at-most-once)');
});

test('AC-T8 (f): claim-first — der status-Flip steht VOR der Mutation (Zeile approved, auch wenn man danach re-approved)', () => {
  const e = mk();
  const f = fact(e);
  const prop = e.proposeAction({ kind: 'reject', payload: { triple_hash: f.triple_hash } });
  e.approveAction(prop.id);
  // Zeile ist approved und Mutation vollzogen
  assert.equal(e.db.prepare('SELECT status FROM pending_actions WHERE id=?').get(prop.id).status, 'approved');
  assert.notEqual(e.db.prepare('SELECT local_status FROM knowledge_edges WHERE triple_hash=?').get(f.triple_hash).local_status, 'active');
  // Re-Approve blockt
  assert.throws(() => e.approveAction(prop.id), /INVALID_PARAMETER_STATE/);
});

// ===== AC-T9 (Adversarial-Audit-🔴): reine Korroboration kann den resolveBelief-Gewinner NICHT autonom kippen =====
// Angriff (vom Auditor gefunden): Claude pumpt über den MCP-`endorse`/`corroborate`-Pfad (adj_class
// auto_corroborate, im Fold auf trustAutoCorroborateCap=600 gedeckelt) + decayPass den trustOf des
// VERLIERER-Edges hoch und kippt via S2a-Band-Shift autonom die Präzedenz. Härtung: der POSITIVE
// Band-Shift greift erst >cap(600) → reine Korroboration erzeugt jetzt Shift 0 und verschiebt KEINE
// Präzedenz. Nur ein AUTORITÄTS-Akt (human_endorse) hebt trustOf >cap und kippt den Gewinner.
test('AC-T9: reine Korroboration (auto_corroborate ≤cap) kippt den Belief-Gewinner NICHT; nur Autorität (>cap) kann es', () => {
  const e = mk();
  // A = aktueller Gewinner (höheres source-tier: fachquelle=3), B = Verlierer (manual=2, aber höhere Konfidenz,
  // damit B BEI Tier-Gleichstand die Top-Stufe per within-tier-Gewicht gewinnen WÜRDE — der Angriff zielt
  // genau auf diesen Tier-Aufstieg von B).
  const A = e.storeTriple({ subject: 'Subj', predicate: 'ist', object: 'A_FACHQ', source_type: 'fachquelle', confidence: 500 });
  const B = e.storeTriple({ subject: 'Subj', predicate: 'ist', object: 'B_MANUAL', source_type: 'manual', confidence: 1000 });
  assert.equal(e.resolveBelief('Subj', 'ist').winner, 'A_FACHQ', 'Ausgangslage: höheres Tier (fachquelle 3) gewinnt');

  // --- ANGRIFF: reiner Engine-Korroborations-Pfad (simuliert MCP-endorse) auf den VERLIERER B ---
  // wiederholt corroborate (verschiedene dedup_hashes, damit nicht idempotent gededupt) + decayPass-Epochen.
  for (let ep = 0; ep < 5; ep++) {
    for (let i = 0; i < 50; i++) e.corroborate({ target_id: B.triple_hash, weight: 1000, dedup_hash: `ep${ep}-h${i}` });
    e.decayPass();
  }
  assert.ok(e.trustOf(B.triple_hash) <= 600, `auto bleibt auf cap gedeckelt: ${e.trustOf(B.triple_hash)}`);
  assert.equal(e._entrenchBandShift({ triple_hash: B.triple_hash }), 0, 'reine Korroboration (≤cap) → KEIN positiver Band-Shift');
  const attacked = e.resolveBelief('Subj', 'ist');
  assert.equal(attacked.winner, 'A_FACHQ', 'KEIN autonomes Kippen: A hält trotz Korroborations-Schwall');
  const cB = attacked.candidates.find((c) => c.object === 'B_MANUAL');
  assert.equal(cB.tier, 2, 'B-Tier wird durch reine Korroboration NICHT angehoben (bleibt manual=2)');

  // --- POSITIVE CONTROL: ein AUTORITÄTS-Akt (human_endorse) hebt trustOf(B) >cap → Band-Shift greift ---
  for (let i = 0; i < 100; i++) e.recordAdjudication({ target_id: B.triple_hash, adj_class: 'human_endorse', delta: 1000 });
  assert.ok(e.trustOf(B.triple_hash) > 600, `Autorität hebt über cap: ${e.trustOf(B.triple_hash)}`);
  assert.equal(e._entrenchBandShift({ triple_hash: B.triple_hash }), 1, 'Autorität >cap → +1 Band-Shift');
  const authorized = e.resolveBelief('Subj', 'ist');
  const cB2 = authorized.candidates.find((c) => c.object === 'B_MANUAL');
  assert.equal(cB2.tier, 3, 'Autorität hebt B-Tier (2→3) auf die Stufe von A');
  assert.equal(authorized.winner, 'B_MANUAL', 'nur Autorität (>cap) verschiebt die Präzedenz → B gewinnt jetzt per within-tier-Gewicht');
});
