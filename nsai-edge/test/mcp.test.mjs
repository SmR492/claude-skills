import { test } from 'node:test';
import assert from 'node:assert/strict';
import { McpServer, TOOLS } from '../src/mcp-server.mjs';
import { Engine } from '../src/engine.mjs';

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
