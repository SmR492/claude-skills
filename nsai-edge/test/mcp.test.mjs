import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer, TOOLS } from '../src/mcp-server.mjs';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';

const server = () => new McpServer({ engine: new Engine() });

test('initialize liefert protocolVersion + serverInfo', () => {
  const s = server();
  const r = s.handle({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
  assert.equal(r.result.protocolVersion, '2024-11-05');
  assert.equal(r.result.serverInfo.name, 'nsai-edge');
  assert.ok(r.result.capabilities.tools);
});

test('tools/list enthält die graph__-Tools', () => {
  const s = server();
  const r = s.handle({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
  const names = r.result.tools.map((t) => t.name);
  assert.ok(names.includes('graph__store_triple'));
  assert.ok(names.includes('graph__query_knowledge'));
  assert.equal(r.result.tools.length, TOOLS.length);
});

test('tools/call store_triple → danach query_knowledge findet den Fakt', () => {
  const s = server();
  const store = s.handle({
    jsonrpc: '2.0', id: 3, method: 'tools/call',
    params: { name: 'graph__store_triple', arguments: { subject: 'ModuleA', predicate: 'depends_on', object: 'ModuleB', confidence: 900 } },
  });
  assert.ok(!store.result.isError);
  const stored = JSON.parse(store.result.content[0].text);
  assert.equal(stored.created, true);

  const q = s.handle({
    jsonrpc: '2.0', id: 4, method: 'tools/call',
    params: { name: 'graph__query_knowledge', arguments: { query_term: 'ModuleA', max_depth: 1 } },
  });
  const res = JSON.parse(q.result.content[0].text);
  assert.ok(res.edges.some((e) => e.object === 'ModuleB'));
});

test('tools/call mit ungültigen Argumenten → isError-Result (kein Protokollfehler)', () => {
  const s = server();
  const r = s.handle({
    jsonrpc: '2.0', id: 5, method: 'tools/call',
    params: { name: 'graph__store_triple', arguments: { subject: 'A', predicate: 'p', object: 'B' } }, // zu kurz
  });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /INVALID_PARAMETER_FORMAT/);
});

test('unbekanntes Tool → isError', () => {
  const s = server();
  const r = s.handle({ jsonrpc: '2.0', id: 6, method: 'tools/call', params: { name: 'graph__nope', arguments: {} } });
  assert.equal(r.result.isError, true);
});

test('unbekannte Methode → JSON-RPC -32601', () => {
  const s = server();
  const r = s.handle({ jsonrpc: '2.0', id: 7, method: 'does/not/exist' });
  assert.equal(r.error.code, -32601);
});

test('notifications/initialized → keine Antwort', () => {
  const s = server();
  assert.equal(s.handle({ jsonrpc: '2.0', method: 'notifications/initialized' }), null);
});

test('graph__record_episode + recall + store_triple-Link (UC-EP)', () => {
  const s = server();
  const call = (name, args, id = 1) => JSON.parse(s.handle({ jsonrpc: '2.0', id, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const ep = call('graph__record_episode', { content: 'Nutzer meldete Glatteis' });
  assert.ok(ep.episode_id);
  const st = call('graph__store_triple', { subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', episode_id: ep.episode_id });
  assert.equal(st.episode_linked, true);
  const rc = call('graph__recall_episodes', { term: 'Glatteis' });
  assert.equal(rc.episodes.length, 1);
  assert.equal(rc.truncated, false);
});

test('R2: graph__resolve_belief reicht as_of durch (UC-BT-Konsistenz)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // Ein Fakt, dessen Geltung erst ab 2025-01 beginnt
  const st = call('graph__store_triple', { subject: 'Vertrag-MCP', predicate: 'gilt', object: 'aktiv', confidence: 800 });
  call('graph__set_validity', { triple_hash: st.triple_hash, valid_from: '2025-01-01T00:00:00Z' });
  // jetzt: aktiv ist Gewinner
  const now = call('graph__resolve_belief', { subject: 'Vertrag-MCP', predicate: 'gilt' });
  assert.equal(now.winner, 'aktiv');
  // as_of 2024-06: vor Geltung → null/leer
  const past = call('graph__resolve_belief', { subject: 'Vertrag-MCP', predicate: 'gilt', as_of: '2024-06-01T00:00:00Z' });
  // resolveBelief liefert null wenn keine zu T gültigen Edges → MCP-Tool gibt { message: 'No matching claims.' }
  assert.ok(past.message === 'No matching claims.' || past.winner == null);
});

test('R2 Re-Audit 🔴-1/-2/-3: silent-Type-Coercion gegen as_of/since/until fail-closed', () => {
  // Adversarial-Audit fand: Number 42 → Date.parse(42) = valider Timestamp 1970 → silent in
  // den Lese-Pfad → andere Ergebnisse. Nach _validIso-Härtung müssen alle 4 Pfade hart werfen.
  const s = server();
  const call = (name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  // resolve_belief
  for (const bad of [42, '', 'not-a-date', true]) {
    const r = call('graph__resolve_belief', { subject: 'Vertrag-Drift', predicate: 'gilt', as_of: bad });
    assert.equal(r.result.isError, true, `as_of=${JSON.stringify(bad)} muss INVALID_PARAMETER_FORMAT werfen, nicht silent`);
  }
  // verify
  for (const bad of [42, '', 'not-a-date']) {
    const r = call('graph__verify', { subject: 'Vertrag-Drift', predicate: 'gilt', object: 'aktiv', as_of: bad });
    assert.equal(r.result.isError, true);
  }
  // query
  for (const bad of [42, '']) {
    const r = call('graph__query_knowledge', { query_term: 'Vertrag-Drift', as_of: bad });
    assert.equal(r.result.isError, true);
  }
  // recall_episodes since + until
  for (const bad of [42, 'not-a-date']) {
    const r = call('graph__recall_episodes', { until: bad });
    assert.equal(r.result.isError, true);
    const r2 = call('graph__recall_episodes', { since: bad });
    assert.equal(r2.result.isError, true);
  }
});

test('R2: graph__recall_episodes reicht until durch (UC-EP zeitlich)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // 1 Episode jetzt
  call('graph__record_episode', { content: 'Notiz im Jahr 2026' });
  const past = call('graph__recall_episodes', { until: '2020-01-01T00:00:00Z' });
  assert.equal(past.episodes.length, 0, 'until=2020 darf 2026er Episode nicht zurückgeben');
  const now = call('graph__recall_episodes', {});
  assert.equal(now.episodes.length, 1);
});

test('graph__search liefert Hybrid-Retrieval (UC-HR)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  call('graph__store_triple', { subject: 'Alpha', predicate: 'verbindet', object: 'Beta' });
  call('graph__store_triple', { subject: 'Beta', predicate: 'verbindet', object: 'Gamma' });
  const r = call('graph__search', { term: 'Alpha', max_hops: 3 });
  assert.ok(r.results.some((x) => x.object === 'Gamma')); // Multi-Hop
  assert.equal(typeof r.converged, 'boolean');
});

test('graph__search as_of begrenzt den Subgraphen auf zu T gültige Fakten (UC-BT / Slice #5b)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const a = call('graph__store_triple', { subject: 'Alpha', predicate: 'verbindet', object: 'Beta' });
  const b = call('graph__store_triple', { subject: 'Beta', predicate: 'verbindet', object: 'Gamma' });
  assert.ok(a.triple_hash && b.triple_hash);
  // Beide Kanten rückdatieren — sonst wäre default asserted_at=jetzt und as_of=2024 würde a/b ausschließen.
  call('graph__set_validity', { triple_hash: a.triple_hash, valid_from: '2019-01-01T00:00:00Z' });
  call('graph__set_validity', { triple_hash: b.triple_hash, valid_from: '2023-01-01T00:00:00Z', valid_to: '2025-01-01T00:00:00Z' });
  const now = call('graph__search', { term: 'Alpha', max_hops: 3, as_of: '2026-05-01T00:00:00Z' });
  assert.ok(!now.results.some((x) => x.object === 'Gamma')); // außerhalb Gültigkeit
  const past = call('graph__search', { term: 'Alpha', max_hops: 3, as_of: '2024-06-01T00:00:00Z' });
  assert.ok(past.results.some((x) => x.object === 'Gamma')); // im Intervall
  // ungültiges as_of → isError, kein Crash
  const r = s.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'graph__search', arguments: { term: 'Alpha', as_of: 'kein-datum' } } });
  assert.equal(r.result.isError, true);
});

test('graph__verify liefert ein Verdikt (UC-V)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  call('graph__store_triple', { subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall', confidence: 900 });
  assert.equal(call('graph__verify', { subject: 'Glatteis', predicate: 'verursacht', object: 'Unfall' }).verdict, 'supported');
  assert.equal(call('graph__verify', { subject: 'Unbekannt', predicate: 'ist', object: 'Ding' }).verdict, 'unknown');
});

test('graph__assert_claims liefert Aggregat + per-Claim-Verdikte (UC-SC Slice #R2)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  call('graph__store_triple', { subject: 'AA-MCP', predicate: 'ist', object: 'wahr' });
  const r = call('graph__assert_claims', { claims: [
    { subject: 'AA-MCP', predicate: 'ist', object: 'wahr' },
    { subject: 'BB-MCP', predicate: 'ist', object: 'unbekannt' },
  ] });
  assert.equal(r.aggregate, 'any_unknown');
  assert.equal(r.count, 2);
  assert.equal(r.results[0].verdict, 'supported');
  assert.equal(r.results[1].verdict, 'unknown');
});

test('graph__assert_claims wirft INVALID_PARAMETER_FORMAT bei >50 claims', () => {
  const s = server();
  const claims = Array.from({ length: 51 }, (_, i) => ({ subject: `S${i}`, predicate: 'ist', object: 'xx' }));
  const r = s.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'graph__assert_claims', arguments: { claims } } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /INVALID_PARAMETER_FORMAT/);
});

test('graph__endorse_triple + graph__endorsements_for (UC-MS Slice #M.1)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // Tripel anlegen
  const st = call('graph__store_triple', { subject: 'MS-Test', predicate: 'ist', object: 'wahr' });
  assert.ok(st.triple_hash);
  // Self-Endorsement
  const e1 = call('graph__endorse_triple', { subject: 'MS-Test', predicate: 'ist', object: 'wahr', source_type: 'manual', confidence: 800 });
  assert.equal(e1.triple_hash, st.triple_hash);
  assert.ok(e1.weighted);
  // Endorsements abrufen
  const lst = call('graph__endorsements_for', { triple_hash: st.triple_hash });
  assert.equal(lst.endorsements.length, 1);
  assert.equal(typeof lst.quorum.weighted_support, 'number');
});

test('graph__endorse_triple liefert isError bei nicht-existentem Tripel (Föderations-Race-Option-b)', () => {
  const s = server();
  const r = s.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'graph__endorse_triple', arguments: { subject: 'Nope-Test', predicate: 'ist', object: 'leer' } } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /NOT_APPLICABLE/);
});

// ===== ADR 0019 Slice S6a — Two-Door-Trust-Wiring über den MCP-Server =====
test('S6a: neue Tools sind über den Server erreichbar (trust_of, endorse, store_fiction, propose_*, list_pending)', () => {
  const s = server();
  const names = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.map((t) => t.name);
  for (const n of ['graph__trust_of', 'graph__contest', 'graph__endorse', 'graph__store_fiction', 'graph__recall_world',
    'graph__list_pending', 'graph__propose_reject', 'graph__propose_promote_fiction', 'graph__propose_authority_endorse']) {
    assert.ok(names.includes(n), `Tool ${n} muss in tools/list erscheinen`);
  }
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // trust_of liefert NUR den Score (keine Spec-Internals)
  const t = call('graph__trust_of', { id: 'SomeNode' });
  assert.equal(typeof t.trust, 'number');
  assert.deepEqual(Object.keys(t), ['trust']);
  // endorse (SICHERE Claude-Variante) schreibt direkt
  const e1 = call('graph__endorse', { target_id: 'SomeNode', weight: 500, dedup_hash: 'dh1' });
  assert.ok(e1.event_hash);
  // store_fiction + recall_world
  const f = call('graph__store_fiction', { subject: 'Sh', predicate: 'wohnt', object: 'Baker', world: 'doyle' });
  assert.ok(f.triple_hash);
  assert.equal(call('graph__recall_world', { world: 'doyle', subject: 'Sh' }).fiction.length, 1);
  // propose_reject erzeugt nur einen Vorschlag (kein Vollzug)
  const st = call('graph__store_triple', { subject: 'Xy', predicate: 'pp', object: 'Zz', confidence: 800 });
  const prop = call('graph__propose_reject', { triple_hash: st.triple_hash });
  assert.equal(prop.status, 'pending');
  // list_pending sieht den Vorschlag, Edge bleibt active (kein Vollzug über MCP)
  const pend = call('graph__list_pending', {});
  assert.equal(pend.length, 1);
  assert.equal(pend[0].proposed_by, 'mcp-agent');
});

test('S6a: KEIN MCP-Tool vollzieht/approved gefährliche Mutationen (Two-Door-Schutz)', () => {
  const s = server();
  for (const forbidden of ['graph__approve', 'graph__approve_action', 'graph__reject_action',
    'graph__record_adjudication', 'graph__reject', 'graph__promote_fiction']) {
    const r = s.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: forbidden, arguments: {} } });
    assert.equal(r.result.isError, true, `${forbidden} darf KEIN Tool sein`);
    assert.match(r.result.content[0].text, /Unknown tool/, `${forbidden} → Unknown tool`);
  }
  // auch in tools/list dürfen sie nicht auftauchen
  const names = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.map((t) => t.name);
  for (const forbidden of ['graph__approve', 'graph__approve_action', 'graph__reject_action', 'graph__record_adjudication', 'graph__reject', 'graph__promote_fiction']) {
    assert.ok(!names.includes(forbidden), `${forbidden} darf nicht gelistet sein`);
  }
});

test('S6a: contest-Guard lehnt self/null ab, lässt fremden Anfechter zu', () => {
  const engine = new Engine();
  const sv = new McpServer({ engine });
  const call = (name, args) => sv.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const st = JSON.parse(call('graph__store_triple', { subject: 'C1', predicate: 'pp', object: 'V1', confidence: 800 }).result.content[0].text);
  // null contester → Guard blockt (isError)
  const rNull = call('graph__contest', { target_id: st.triple_hash, contester_id: null, weight: 1000 });
  assert.equal(rNull.result.isError, true);
  assert.match(rNull.result.content[0].text, /fremden, registrierten Anfechter/);
  // self contester (eigener peerId) → Guard blockt
  const rSelf = call('graph__contest', { target_id: st.triple_hash, contester_id: engine.peerId, weight: 1000 });
  assert.equal(rSelf.result.isError, true);
  // fremder Anfechter → erlaubt (Untrusted DARF schreiben; Fold zählt 0)
  const rOther = call('graph__contest', { target_id: st.triple_hash, contester_id: 'peer:fremd-1', weight: 1000 });
  assert.equal(rOther.result.isError, undefined);
  const ok = JSON.parse(rOther.result.content[0].text);
  assert.ok(ok.event_hash);
});

// ===== 🔴-1 GATE-UMGEHUNG: graph__peer_trust ist entfernt; Claude kann nicht autonom trusten =====
test('🔴-1: graph__peer_trust ist NICHT mehr in tools/list und tools/call → Unknown tool', () => {
  const s = server();
  const names = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.map((t) => t.name);
  assert.ok(!names.includes('graph__peer_trust'), 'graph__peer_trust darf NICHT gelistet sein (ungegateter Trust-Write entfernt)');
  // graph__peer_add bleibt (harmlos: erzeugt nur untrusted)
  assert.ok(names.includes('graph__peer_add'), 'graph__peer_add bleibt erhalten');
  // tools/call → Unknown tool
  const r = s.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'graph__peer_trust', arguments: { peer_id: 'p', level: 'full' } } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /Unknown tool/);
});

test('🔴-1 SICHERHEITS-REGRESSION (Audit-Angriff): peer_add→contest OHNE peer_trust kippt das Verdikt NICHT auf contested', () => {
  // Der Audit-Angriff: Claude konnte rein über MCP graph__peer_add → graph__peer_trust(full) →
  // graph__contest einem selbst-getrusteten Puppet-Peer Contest-Standing geben → Belief kippt auf
  // contested. graph__peer_trust ist weg → Claude bleibt beim peer_add-Default 'untrusted' hängen
  // (Standing 0) → der Contest trägt 0 bei → das Verdikt bleibt UNVERÄNDERT.
  const engine = new Engine();
  const sv = new McpServer({ engine });
  const call = (name, args) => JSON.parse(sv.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // ein geglaubter Fakt
  const st = call('graph__store_triple', { subject: 'Erde', predicate: 'form', object: 'Kugel', confidence: 900 });
  const before = call('graph__resolve_belief', { subject: 'Erde', predicate: 'form' });
  assert.equal(before.winner, 'Kugel');
  assert.ok(!before.contested, 'vor dem Angriff: nicht contested');
  // ANGRIFF Schritt 1: Puppet-Peer rein über MCP registrieren (→ untrusted, harmlos)
  const peerKeyEng = new Engine();
  const padd = call('graph__peer_add', { peer_id: 'puppet-1', public_key: peerKeyEng.identity.publicKeyPem });
  assert.equal(padd.trust_level, 'untrusted', 'peer_add erzeugt NUR untrusted (kein Standing)');
  // ANGRIFF Schritt 2: KEIN graph__peer_trust mehr verfügbar (s. vorheriger Test) → Peer bleibt untrusted.
  // ANGRIFF Schritt 3: maximaler Contest durch den (untrusted) Puppet
  const ctstd = call('graph__contest', { target_id: st.triple_hash, contester_id: 'puppet-1', weight: 1000, contest_type: 'empirical' });
  assert.ok(ctstd.event_hash, 'Audit-Spur wird geschrieben');
  assert.equal(ctstd.accumulated, 0, 'untrusted Puppet hat KEIN Standing → Contest trägt 0 bei');
  // ERGEBNIS: das Verdikt ist UNVERÄNDERT (kein autonomes Kippen auf contested)
  const after = call('graph__resolve_belief', { subject: 'Erde', predicate: 'form' });
  assert.equal(after.winner, 'Kugel', 'Gewinner unverändert');
  assert.ok(!after.contested, 'NICHT contested — der Angriff ist neutralisiert (Claude hat kein peer_trust)');
  assert.equal(after.contestation, undefined, 'kein contestation-Detailobjekt (accAll==0)');
  // Gegenprobe via assert_claims: Verdikt bleibt supported, nicht any_contested
  const ac = call('graph__assert_claims', { claims: [{ subject: 'Erde', predicate: 'form', object: 'Kugel' }] });
  assert.equal(ac.results[0].verdict, 'supported', 'assert_claims: Claim bleibt supported');
  assert.ok(!ac.results[0].contested, 'assert_claims: Claim NICHT contested');
  assert.notEqual(ac.aggregate, 'any_contested', 'Aggregat NICHT any_contested');
  // POSITIVE CONTROL: würde der Peer (über die jetzt entfernte Tür) auf 'full' getrustet, KIPPTE der Belief.
  // Das beweist die Potenz des Angriffs — neutralisiert NUR dadurch, dass Claude keinen peer_trust mehr hat.
  engine.peerTrust('puppet-1', 'full'); // simuliert die entfernte Tür (Engine-Methode bleibt, MCP-Tür weg)
  const flipped = call('graph__resolve_belief', { subject: 'Erde', predicate: 'form' });
  assert.equal(flipped.contested, true, 'mit Trust WÜRDE der Contest kippen → bestätigt, dass nur die fehlende Trust-Tür schützt');
});

test('🔴-1: graph__propose_peer_trust erzeugt einen pending-Eintrag, ändert das Trust-Level NICHT', () => {
  const engine = new Engine();
  const sv = new McpServer({ engine });
  const call = (name, args) => JSON.parse(sv.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const peerKeyEng = new Engine();
  call('graph__peer_add', { peer_id: 'cand-1', public_key: peerKeyEng.identity.publicKeyPem });
  // Vorschlag → pending, KEINE Mutation
  const prop = call('graph__propose_peer_trust', { peer_id: 'cand-1', level: 'full' });
  assert.equal(prop.status, 'pending');
  assert.equal(prop.kind, 'peer_trust');
  assert.equal(prop.preview.peer_id, 'cand-1');
  assert.equal(prop.preview.level, 'full');
  assert.equal(prop.preview.current_level, 'untrusted');
  // Trust-Level ist UNVERÄNDERT (kein autonomer Vollzug über MCP)
  const lvl = engine.db.prepare('SELECT trust_level FROM peers WHERE peer_id=?').get('cand-1').trust_level;
  assert.equal(lvl, 'untrusted', 'propose vergibt SELBST keinen Trust');
  // der Vorschlag ist in der Queue sichtbar
  const pend = call('graph__list_pending', {});
  assert.ok(pend.some((p) => p.kind === 'peer_trust' && p.payload.peer_id === 'cand-1'));
  // propose auf unbekannten Peer → isError (erst peer_add)
  const r = sv.handle({ jsonrpc: '2.0', id: 9, method: 'tools/call', params: { name: 'graph__propose_peer_trust', arguments: { peer_id: 'nie-registriert', level: 'full' } } });
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /peer unbekannt/);
});

test('graph__supersede_temporally + query as_of (UC-BT)', () => {
  const s = server();
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const st = call('graph__store_triple', { subject: 'Firma', predicate: 'ceo', object: 'Alice', confidence: 900 });
  call('graph__set_validity', { triple_hash: st.triple_hash, valid_from: '2019-01-01T00:00:00Z' }); // rückdatiert
  call('graph__supersede_temporally', { subject: 'Firma', predicate: 'ceo', object: 'Bob', as_of: '2023-01-01T00:00:00Z' });
  const now = call('graph__query_knowledge', { query_term: 'Firma' }).edges.map((x) => x.object);
  assert.ok(now.includes('Bob') && !now.includes('Alice')); // jetzt nur Bob
  const past = call('graph__query_knowledge', { query_term: 'Firma', as_of: '2021-01-01T00:00:00Z' }).edges.map((x) => x.object);
  assert.ok(past.includes('Alice')); // historisch Alice
});

// ===== ADR-0019 Origin-Guard (MCP-Boundary): set_validity / supersede_temporally gegen FREMDE Edges =====
// PRINZIP: über MCP darf Claude einen FREMDEN Edge (origin_peer_id gesetzt und != eigene peerId) NICHT
// autonom in Belief/Validity/Status mutieren. Self (origin null/eigene peerId) bleibt direkt erlaubt.
// Diese Tests fahren den Audit-Angriff über den MCP-Server-Dispatch.

// Helfer: einen FREMDEN authoritative-Peer-Edge in die Engine bringen (origin = peer:auth), der den
// resolveBelief-Gewinner stellt. mergeIncoming verifiziert keine Signatur (wie in der Federation-Suite).
const seedForeignAuthEdge = (engine, { subject, predicate, object, confidence = 900, origin = 'peer:auth' }) => {
  engine.peerAdd(origin, new Engine().identity.publicKeyPem); // registrieren (TOFU)
  engine.peerTrust(origin, 'authoritative');                  // Mensch-Akt simuliert (direkt an der Engine)
  const wire = {
    wire_version: 1, triple_hash: tripleHash(subject, predicate, object), subject, predicate, object,
    confidence, asserted_confidence: confidence, source_type: 'gesetz', asserted_at: '2020-01-01T00:00:00Z',
    temporality: 'stable', origin_peer_id: origin, relayed_by: origin, vector_clock: { [origin]: 1 }, derived_from: null, signature: 'ed25519:x',
  };
  const status = engine.mergeIncoming(wire, { peerTrust: 'authoritative' });
  assert.equal(status, 'accepted', 'Fremd-Edge muss aktiv akzeptiert sein (Setup)');
  return wire.triple_hash;
};

test('Origin-Guard SICHERHEITS-REGRESSION: graph__set_validity auf FREMDEM authoritative-Edge → isError, kein Effekt', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const hash = seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn' });
  // Gewinner vor dem Angriff
  const before = JSON.parse(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).result.content[0].text);
  assert.equal(before.winner, 'Bonn');
  const edgeBefore = engine._getEdge(hash);
  // ANGRIFF: valid_to in die Vergangenheit setzen → Gewinner würde wegfallen
  const r = call('graph__set_validity', { triple_hash: hash, valid_to: '2019-01-01T00:00:00Z', valid_from: '2018-01-01T00:00:00Z' });
  assert.equal(r.result.isError, true, 'Fremd-Edge-set_validity über MCP → isError');
  assert.match(r.result.content[0].text, /fremder Edge.*graph__propose_set_validity/);
  // KEIN Effekt: Edge unverändert + Gewinner unverändert
  const edgeAfter = engine._getEdge(hash);
  assert.equal(edgeAfter.valid_from, edgeBefore.valid_from, 'valid_from unverändert');
  assert.equal(edgeAfter.valid_to, edgeBefore.valid_to, 'valid_to unverändert');
  const after = JSON.parse(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).result.content[0].text);
  assert.equal(after.winner, 'Bonn', 'resolveBelief-Gewinner unverändert (kein autonomer Kipp)');
});

test('Origin-Guard POSITIVE CONTROL: graph__set_validity auf SELF-Edge funktioniert direkt', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const st = call('graph__store_triple', { subject: 'Self', predicate: 'pp', object: 'Val', confidence: 800 });
  const r = call('graph__set_validity', { triple_hash: st.triple_hash, valid_from: '2019-01-01T00:00:00Z' });
  assert.equal(r.triple_hash, st.triple_hash);
  assert.equal(r.valid_from, '2019-01-01T00:00:00.000Z');
  assert.equal(engine._getEdge(st.triple_hash).valid_from, '2019-01-01T00:00:00.000Z', 'Self-Edge wurde direkt mutiert');
});

test('Origin-Guard SICHERHEITS-REGRESSION: graph__supersede_temporally, das einen FREMDEN authoritative-Gewinner beenden würde → isError, Gewinner bleibt', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  seedForeignAuthEdge(engine, { subject: 'Firma', predicate: 'ceo', object: 'Alice' });
  const before = JSON.parse(call('graph__resolve_belief', { subject: 'Firma', predicate: 'ceo' }).result.content[0].text);
  assert.equal(before.winner, 'Alice');
  // ANGRIFF: supersede mit neuem Objekt würde den offenen FREMDEN Vorgänger (Alice) per valid_to beenden
  const r = call('graph__supersede_temporally', { subject: 'Firma', predicate: 'ceo', object: 'Mallory', as_of: '2023-01-01T00:00:00Z' });
  assert.equal(r.result.isError, true, 'supersede, das einen Fremd-Edge beendet → isError');
  assert.match(r.result.content[0].text, /beendet fremden Edge.*graph__propose_supersede_temporal/);
  // KEIN Effekt: Alice noch offen (valid_to NULL), Mallory NICHT angelegt, Gewinner bleibt Alice
  const alice = engine._getEdge(tripleHash('Firma', 'ceo', 'Alice'));
  assert.equal(alice.valid_to, null, 'Fremd-Vorgänger NICHT beendet (valid_to bleibt NULL)');
  assert.equal(engine._getEdge(tripleHash('Firma', 'ceo', 'Mallory')), undefined, 'neuer Fakt NICHT angelegt');
  const after = JSON.parse(call('graph__resolve_belief', { subject: 'Firma', predicate: 'ceo' }).result.content[0].text);
  assert.equal(after.winner, 'Alice', 'Gewinner bleibt der Fremd-Edge (kein autonomer Kipp)');
});

test('Origin-Guard POSITIVE CONTROL: graph__supersede_temporally rein additiv / self funktioniert', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // rein additiv: noch kein (s,p) vorhanden → keine Vorgänger → erlaubt
  const r1 = call('graph__supersede_temporally', { subject: 'Team', predicate: 'lead', object: 'Carol', as_of: '2022-01-01T00:00:00Z' });
  assert.equal(r1.triple_hash, tripleHash('Team', 'lead', 'Carol'));
  // self-Vorgänger beenden → erlaubt (Carol war self)
  const r2 = call('graph__supersede_temporally', { subject: 'Team', predicate: 'lead', object: 'Dave', as_of: '2024-01-01T00:00:00Z' });
  assert.equal(r2.triple_hash, tripleHash('Team', 'lead', 'Dave'));
  const carol = engine._getEdge(tripleHash('Team', 'lead', 'Carol'));
  assert.equal(carol.valid_to, '2024-01-01T00:00:00.000Z', 'self-Vorgänger Carol wurde beendet');
  const now = call('graph__resolve_belief', { subject: 'Team', predicate: 'lead' });
  assert.equal(now.winner, 'Dave');
});

test('Origin-Guard Two-Door: propose_set_validity erzeugt pending (mutiert NICHT); approveAction (Mensch-Tür) vollzieht', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const hash = seedForeignAuthEdge(engine, { subject: 'Stadt', predicate: 'status', object: 'offen' });
  const edgeBefore = engine._getEdge(hash);
  const prop = call('graph__propose_set_validity', { triple_hash: hash, valid_to: '2025-01-01T00:00:00Z' });
  assert.equal(prop.status, 'pending');
  assert.equal(prop.kind, 'set_validity');
  assert.equal(prop.preview.origin_peer_id, 'peer:auth', 'preview zeigt fremden origin');
  assert.equal(prop.preview.new_valid_to, '2025-01-01T00:00:00Z');
  // MUTIERT NICHT:
  assert.equal(engine._getEdge(hash).valid_to, edgeBefore.valid_to, 'propose mutiert den Fremd-Edge NICHT');
  // Mensch-Tür vollzieht:
  const done = engine.approveAction(prop.id);
  assert.equal(done.executed, true);
  assert.equal(engine._getEdge(hash).valid_to, '2025-01-01T00:00:00.000Z', 'nach Mensch-approve ist valid_to gesetzt');
});

test('Origin-Guard Two-Door: propose_supersede_temporal erzeugt pending (mutiert NICHT); approveAction vollzieht', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  seedForeignAuthEdge(engine, { subject: 'Org', predicate: 'chef', object: 'Alt' });
  const altHash = tripleHash('Org', 'chef', 'Alt');
  const prop = call('graph__propose_supersede_temporal', { subject: 'Org', predicate: 'chef', object: 'Neu', as_of: '2024-06-01T00:00:00Z' });
  assert.equal(prop.status, 'pending');
  assert.equal(prop.kind, 'supersede_temporal');
  assert.ok(prop.preview.affected_edges.some((e) => e.triple_hash === altHash && e.origin_peer_id === 'peer:auth'), 'preview listet den betroffenen Fremd-Edge + origin');
  // MUTIERT NICHT:
  assert.equal(engine._getEdge(altHash).valid_to, null, 'propose beendet den Fremd-Vorgänger NICHT');
  assert.equal(engine._getEdge(tripleHash('Org', 'chef', 'Neu')), undefined, 'neuer Fakt noch NICHT angelegt');
  // Mensch-Tür vollzieht:
  const done = engine.approveAction(prop.id);
  assert.equal(done.executed, true);
  assert.equal(engine._getEdge(altHash).valid_to, '2024-06-01T00:00:00.000Z', 'nach Mensch-approve ist der Fremd-Vorgänger beendet');
  const now = call('graph__resolve_belief', { subject: 'Org', predicate: 'chef' });
  assert.equal(now.winner, 'Neu', 'nach Mensch-approve gewinnt der neue Fakt');
});

test('Origin-Guard: neue Tools (propose_set_validity, propose_supersede_temporal) erscheinen in tools/list', () => {
  const s = server();
  const names = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.map((t) => t.name);
  assert.ok(names.includes('graph__propose_set_validity'));
  assert.ok(names.includes('graph__propose_supersede_temporal'));
});

// ===== ADR-0019 Origin-Guard (MCP-Boundary): graph__store_triple gegen FREMDE Edges =====
// AUDIT-🔴: graph__store_triple war ungegated. Ein Re-Assert desselben (s,p,o) — gleicher triple_hash —
// auf einen bereits existierenden FREMDEN Edge ginge in den UPDATE-Branch von storeTriple und setzte
// origin_peer_id BEDINGUNGSLOS auf self → degradiert den Fremd-Edge von trustRank authoritative auf self →
// in resolveBelief gewinnt dann ein konkurrierender Fremd-Edge (anderes Objekt) → Gewinner kippt autonom.
// Zugleich Universal-Bypass des R3-Origin-Guards (erst Fremd-Edge via store_triple zu self machen, dann
// set_validity/supersede). Fix: Origin-Guard an der MCP-Boundary (nicht in der Engine-Methode — interne
// Aufrufer + CLI/Mensch bleiben unberührt), konsistent zu set_validity/supersede_temporally.

test('Origin-Guard SICHERHEITS-REGRESSION: store_triple-Re-Assert auf FREMDEM Gewinner-Edge → isError, kein Bonn→Berlin-Kipp', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  // Zwei KONKURRIERENDE Fremd-Edges (verschiedene Peers, beide authoritative) für (Land, hauptstadt):
  // A=Bonn conf 900 (Gewinner), B=Berlin conf 800.
  const bonnHash = seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 900, origin: 'peer:authA' });
  seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Berlin', confidence: 800, origin: 'peer:authB' });
  const before = JSON.parse(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).result.content[0].text);
  assert.equal(before.winner, 'Bonn', 'Setup: Bonn (Fremd, conf 900) ist Gewinner');
  const bonnBefore = engine._getEdge(bonnHash);
  assert.equal(bonnBefore.origin_peer_id, 'peer:authA', 'Setup: Bonn-Edge ist fremd (origin peer:authA)');

  // ANGRIFF (1 MCP-Call): Re-Assert des Bonn-Tripels mit hoher confidence → würde origin auf self setzen,
  // Bonn von authoritative auf self degradieren → Berlin (authoritative) würde Belief-Gewinner.
  const r = call('graph__store_triple', { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 1000 });
  assert.equal(r.result.isError, true, 'store_triple auf Fremd-Edge über MCP → isError');
  assert.match(r.result.content[0].text, /FOREIGN_EDGE/);
  assert.match(r.result.content[0].text, /peer:authA/, 'Fehlertext nennt den fremden origin');
  assert.match(r.result.content[0].text, /graph__endorse.*graph__propose/s, 'Fehlertext weist auf den sicheren Alternativpfad');

  // KEIN Effekt: Bonn-Edge unverändert fremd, Gewinner bleibt Bonn (kein autonomer Kipp)
  const bonnAfter = engine._getEdge(bonnHash);
  assert.equal(bonnAfter.origin_peer_id, 'peer:authA', 'Bonn-origin UNVERÄNDERT (kein Provenienz-Raub)');
  assert.equal(bonnAfter.confidence, bonnBefore.confidence, 'Bonn-confidence UNVERÄNDERT (keine Konfidenz-Inflation)');
  const after = JSON.parse(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).result.content[0].text);
  assert.equal(after.winner, 'Bonn', 'resolveBelief-Gewinner bleibt Bonn (Berlin kippt NICHT autonom)');
});

test('Origin-Guard SICHERHEITS-REGRESSION: 2-Stufen-Bypass (set_validity→store_triple) ist tot', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const bonnHash = seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 900, origin: 'peer:authA' });
  seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Berlin', confidence: 800, origin: 'peer:authB' });
  assert.equal(JSON.parse(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).result.content[0].text).winner, 'Bonn');

  // STUFE 1: set_validity auf den fremden Bonn-Edge → bereits durch R3 geblockt
  const r1 = call('graph__set_validity', { triple_hash: bonnHash, valid_to: '2019-01-01T00:00:00Z', valid_from: '2018-01-01T00:00:00Z' });
  assert.equal(r1.result.isError, true, 'STUFE 1: set_validity auf Fremd-Edge → isError (R3)');

  // STUFE 2: der Bypass — Bonn erst via store_triple zu self machen, dann set_validity sieht nur noch self.
  // Jetzt durch den neuen store_triple-Boundary-Guard ebenfalls geblockt.
  const r2 = call('graph__store_triple', { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 1000 });
  assert.equal(r2.result.isError, true, 'STUFE 2: store_triple auf Fremd-Edge → isError (Bypass-Tür zu)');
  assert.match(r2.result.content[0].text, /FOREIGN_EDGE/);

  // Bonn bleibt fremd + Gewinner — der gesamte Bypass ist tot.
  assert.equal(engine._getEdge(bonnHash).origin_peer_id, 'peer:authA', 'Bonn bleibt fremd');
  assert.equal(JSON.parse(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).result.content[0].text).winner, 'Bonn', 'Bonn bleibt Gewinner');
});

test('Origin-Guard POSITIVE CONTROL: store_triple eines NEUEN Tripels funktioniert', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const r = call('graph__store_triple', { subject: 'Neuland', predicate: 'hauptstadt', object: 'Neustadt', confidence: 700 });
  assert.equal(r.created, true, 'neues Tripel wird angelegt (kein existing → Guard greift nicht)');
  assert.equal(engine._getEdge(tripleHash('Neuland', 'hauptstadt', 'Neustadt')).origin_peer_id, engine.peerId, 'neuer Edge ist self');
});

test('Origin-Guard POSITIVE CONTROL: store_triple aktualisiert einen SELF-Edge (UPDATE-Branch, confidence max)', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  const first = call('graph__store_triple', { subject: 'Eigen', predicate: 'wert', object: 'Xx', confidence: 600 });
  assert.equal(first.created, true);
  // Re-Assert desselben SELF-Tripels mit höherer confidence → UPDATE-Branch erlaubt, confidence = max
  const upd = call('graph__store_triple', { subject: 'Eigen', predicate: 'wert', object: 'Xx', confidence: 900 });
  assert.equal(upd.created, false, 'Self-Re-Assert geht in den UPDATE-Branch (kein isError)');
  assert.equal(upd.confidence, 900, 'confidence = max(alt, neu)');
  // niedrigere confidence senkt nicht
  const upd2 = call('graph__store_triple', { subject: 'Eigen', predicate: 'wert', object: 'Xx', confidence: 500 });
  assert.equal(upd2.confidence, 900, 'confidence bleibt das Maximum');
  assert.equal(engine._getEdge(tripleHash('Eigen', 'wert', 'Xx')).origin_peer_id, engine.peerId, 'Self-Edge bleibt self');
});

test('Origin-Guard ALTERNATIVPFAD: graph__endorse auf den fremden Bonn-Edge funktioniert (Korroboration, kein Provenienz-Raub)', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } });
  const bonnHash = seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 900, origin: 'peer:authA' });
  // Der sichere Weg, dem fremden Fakt zuzustimmen: Korroboration auf der Anzahl-Achse (kein origin-Raub).
  const r = call('graph__endorse', { target_id: bonnHash, weight: 500, dedup_hash: 'corrob-bonn-1' });
  assert.equal(r.result.isError, undefined, 'graph__endorse auf Fremd-Edge funktioniert (kein isError)');
  const out = JSON.parse(r.result.content[0].text);
  assert.ok(out.event_hash, 'Korroboration erzeugt ein trust_event');
  // Provenienz UNVERÄNDERT: endorse schreibt in den Trust-Ledger, NIE in origin_peer_id des Edges.
  assert.equal(engine._getEdge(bonnHash).origin_peer_id, 'peer:authA', 'Bonn-origin UNVERÄNDERT (Korroboration raubt keine Provenienz)');
});

// ===== ADR-0019 Origin-Guard (MCP-Boundary, Final-Pass): graph__decay_pass ist dry_run-ERZWUNGEN =====
// AUDIT-🔴: graph__decay_pass rief engine.decayPass({dryRun:!!args.dry_run}) — ein echter Lauf decayt AUCH
// FREMDE Edges und setzt sie unter deleteThreshold (50) auf 'superseded'. Ein MCP-Decay-Sturm (~171× bei
// stable: 5/Periode, conf 900) eliminiert so AUTONOM einen fremden authoritative-Gewinner (KONZEPT §UC-04:
// Akteur=System). Fix: an der MCP-Boundary IMMER engine.decayPass({dryRun:true}) — das `dry_run`-Arg wird
// ignoriert/überschrieben. Echter Decay = System/Mensch-Wartung via CLI `nsai-edge decay` (engine-direkt).

test('Origin-Guard SICHERHEITS-REGRESSION: graph__decay_pass-Sturm (auch dry_run:false) eliminiert KEINEN Fremd-Gewinner', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  // Fremder authoritative-Gewinner: (Land, hauptstadt, Bonn) conf 900, stable → bei echtem Decay nach
  // 171 Pässen unter deleteThreshold (50) auf 'superseded'.
  const bonnHash = seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 900, origin: 'peer:authA' });
  const confBefore = engine._getEdge(bonnHash).confidence;
  assert.equal(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).winner, 'Bonn', 'Setup: Bonn ist Gewinner');

  // ANGRIFF: 200 MCP-decay_pass-Calls — bewusst MIT dry_run:false im Arg (Versuch, den echten Lauf zu erzwingen).
  for (let i = 0; i < 200; i++) {
    const out = call('graph__decay_pass', { dry_run: false });
    assert.equal(out.dryRun, true, `MCP-decay_pass ist dry_run-erzwungen (Iteration ${i})`);
  }

  // KEIN Effekt: Fremd-Edge unverändert aktiv, confidence unverändert, Gewinner bleibt Bonn.
  const bonnAfter = engine._getEdge(bonnHash);
  assert.equal(bonnAfter.local_status, 'active', 'Fremd-Edge bleibt active (kein autonomer superseded-Flip)');
  assert.equal(bonnAfter.confidence, confBefore, 'Fremd-Edge-confidence UNVERÄNDERT (kein echter Decay über MCP)');
  assert.equal(call('graph__resolve_belief', { subject: 'Land', predicate: 'hauptstadt' }).winner, 'Bonn', 'Gewinner bleibt Bonn nach beliebig vielen MCP-decay_pass-Calls');
});

test('Origin-Guard: graph__decay_pass auch mit dry_run:true → identische read-only Vorschau, kein State-Wechsel', () => {
  const engine = new Engine();
  const s = new McpServer({ engine });
  const call = (name, args) => JSON.parse(s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name, arguments: args } }).result.content[0].text);
  call('graph__store_triple', { subject: 'Self', predicate: 'pp', object: 'Val', confidence: 900, temporality: 'stable' });
  const out = call('graph__decay_pass', { dry_run: true });
  assert.equal(out.dryRun, true);
  assert.ok('decayed' in out && 'superseded' in out, 'Vorschau liefert decayed/superseded-Zähler');
  // self-Edge bleibt unverändert (Vorschau mutiert nicht).
  assert.equal(engine._getEdge(tripleHash('Self', 'pp', 'Val')).confidence, 900, 'Vorschau mutiert die confidence NICHT');
});

test('Origin-Guard POSITIVE CONTROL: CLI/Engine-Pfad (decayPass({dryRun:false})) decayt real — Fremd-Edge sinkt + wird superseded', () => {
  const engine = new Engine();
  // Gleicher Fremd-Edge wie oben — diesmal über den CLI/Engine-Pfad (NICHT MCP) decayt.
  const bonnHash = seedForeignAuthEdge(engine, { subject: 'Land', predicate: 'hauptstadt', object: 'Bonn', confidence: 900, origin: 'peer:authA' });
  // EIN echter Lauf senkt die confidence real (stable: -5/Periode).
  const one = engine.decayPass({ dryRun: false });
  assert.equal(one.dryRun, false, 'Engine-Pfad ist KEIN dry_run');
  assert.equal(engine._getEdge(bonnHash).confidence, 895, 'echter Decay senkt die confidence (900→895)');
  // 170 weitere Pässe → unter deleteThreshold (50) → superseded (Positive Control: die System/Mensch-Tür wirkt).
  for (let i = 0; i < 170; i++) engine.decayPass({ dryRun: false });
  assert.equal(engine._getEdge(bonnHash).local_status, 'superseded', 'nach 171 echten Pässen ist der Edge superseded (Positive Control)');
});

test('Origin-Guard: graph__decay_pass-Tool-Description deklariert die read-only/dry_run-Boundary', () => {
  const s = server();
  const tool = s.handle({ jsonrpc: '2.0', id: 1, method: 'tools/list' }).result.tools.find((t) => t.name === 'graph__decay_pass');
  assert.ok(tool, 'graph__decay_pass ist gelistet');
  assert.match(tool.description, /read-only|Vorschau/, 'Description nennt die read-only Vorschau');
  assert.match(tool.description, /CLI/, 'Description verweist auf die CLI als echte Lauf-Tür');
});
