import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../src/engine.mjs';
import { openDb } from '../src/db.mjs';
import { createIdentity } from '../src/identity.mjs';
import { bridgeConfig, bridgePush, bridgePull, resolveBridgeConfig, probeKey, outboxStats, enqueueOutbox } from '../src/bridge.mjs';

function setup() {
  const dbPath = join(mkdtempSync(join(tmpdir(), 'nsai-bridge-')), 'graph.db');
  const engine = new Engine({ dbPath, identity: createIdentity() });
  return { dbPath, engine, db: openDb(dbPath) };
}

const CFG = { endpoint: 'http://app/mcp', key: 'k', configured: true };

test('bridgeConfig: Default ist der zentrale Hub mit geteiltem Extern-Key', () => {
  const d = bridgeConfig({});
  assert.equal(d.configured, true);
  assert.equal(d.endpoint, 'https://nsai.bittransit.io/mcp');
  assert.equal(d.defaultKey, true);
});

test('bridgeConfig: Env ueberschreibt Endpoint + Key (eigener Informant)', () => {
  const c = bridgeConfig({ NSAI_APP_ENDPOINT: 'http://x/mcp', NSAI_APP_KEY: 'k' });
  assert.equal(c.configured, true);
  assert.equal(c.endpoint, 'http://x/mcp');
  assert.equal(c.key, 'k');
  assert.equal(c.defaultKey, false);
});

test('bridgeConfig: NSAI_APP_ENDPOINT=off deaktiviert die Bridge (reiner Offline-Mode)', () => {
  assert.equal(bridgeConfig({ NSAI_APP_ENDPOINT: 'off' }).configured, false);
  assert.equal(bridgeConfig({ NSAI_APP_ENDPOINT: 'NONE' }).configured, false);
});

test('push sendet eigene Fakten als nsai.assert', async () => {
  const { engine, db, dbPath } = setup();
  engine.storeTriple({ subject: 'Berlin', predicate: 'ist_hauptstadt', object: 'Deutschland', confidence: 900 });

  const calls = [];
  const fetchImpl = async (_url, opts) => {
    calls.push(JSON.parse(opts.body));
    return { status: 200, json: async () => ({ result: { ok: true } }) };
  };

  const r = await bridgePush(engine, db, dbPath, CFG, { fetchImpl });
  assert.equal(r.pushed, 1);
  assert.equal(calls[0].params.name, 'nsai.assert');
  assert.equal(calls[0].params.arguments.subject, 'Berlin');
});

test('pull ergänzt fehlende App-Fakten lokal (Online-Diff), idempotent', async () => {
  const { engine, db } = setup();
  const fetchImpl = async () => ({ status: 200, json: async () => ({ result: { ok: true, results: [
    { subject: 'Paris', predicate: 'ist_hauptstadt', object: 'Frankreich', effective_confidence: 800, status: 'active' },
  ] } }) });

  const r1 = await bridgePull(engine, db, CFG, { fetchImpl });
  assert.equal(r1.added, 1);

  const r2 = await bridgePull(engine, db, CFG, { fetchImpl }); // schon lokal → kein Diff
  assert.equal(r2.added, 0);
});

test('disputed/quarantined App-Fakten werden NICHT übernommen', async () => {
  const { engine, db } = setup();
  const fetchImpl = async () => ({ status: 200, json: async () => ({ result: { ok: true, results: [
    { subject: 'Streit', predicate: 'ist', object: 'X', effective_confidence: 500, status: 'disputed' },
  ] } }) });
  const r = await bridgePull(engine, db, CFG, { fetchImpl });
  assert.equal(r.added, 0);
});

test('inaktiv ohne Konfiguration (No-op)', async () => {
  const { engine, db, dbPath } = setup();
  assert.deepEqual(await bridgePush(engine, db, dbPath, { configured: false }), { skipped: true, pushed: 0 });
  assert.deepEqual(await bridgePull(engine, db, { configured: false }), { skipped: true, added: 0 });
});

test('resolveBridgeConfig: ungueltiger eigener Key -> Fallback auf Default-Paar', async () => {
  const custom = bridgeConfig({ NSAI_APP_ENDPOINT: 'http://x/mcp', NSAI_APP_KEY: 'kaputt' });
  const fetchImpl = async () => ({ status: 401, ok: false, json: async () => ({}) });
  const eff = await resolveBridgeConfig(custom, { fetchImpl });
  assert.equal(eff.fallback, true);
  assert.equal(eff.defaultKey, true);
  assert.equal(eff.endpoint, 'https://nsai.bittransit.io/mcp');
});

test('resolveBridgeConfig: gueltiger eigener Key bleibt unangetastet', async () => {
  const custom = bridgeConfig({ NSAI_APP_ENDPOINT: 'http://x/mcp', NSAI_APP_KEY: 'gueltig' });
  const fetchImpl = async () => ({ status: 200, ok: true, json: async () => ({}) });
  const eff = await resolveBridgeConfig(custom, { fetchImpl });
  assert.equal(eff.fallback, undefined);
  assert.equal(eff.key, 'gueltig');
});

test('resolveBridgeConfig: Server nicht erreichbar -> KEIN Key-Fallback (kein Falschalarm)', async () => {
  const custom = bridgeConfig({ NSAI_APP_ENDPOINT: 'http://x/mcp', NSAI_APP_KEY: 'gueltig' });
  const fetchImpl = async () => { throw new Error('ECONNREFUSED'); };
  const eff = await resolveBridgeConfig(custom, { fetchImpl });
  assert.equal(eff.key, 'gueltig');
});

test('probeKey klassifiziert 401/200/Netzfehler', async () => {
  const cfg = { endpoint: 'http://x/mcp', key: 'k' };
  assert.equal(await probeKey(cfg, async () => ({ status: 401, ok: false })), 'invalid');
  assert.equal(await probeKey(cfg, async () => ({ status: 200, ok: true })), 'ok');
  assert.equal(await probeKey(cfg, async () => { throw new Error('x'); }), 'unreachable');
});

// ── Direktzugriff + Offline-Outbox (Write-Through → puffern → Reconnect-Replay) ──

test('offline: Tripel wird durable gepuffert (Outbox), kein Verlust', async () => {
  const { engine, db, dbPath } = setup();
  engine.storeTriple({ subject: 'Mars', predicate: 'ist_ein', object: 'Planet', confidence: 800 });
  const offline = async () => { throw new Error('ECONNREFUSED'); };

  const r = await bridgePush(engine, db, dbPath, CFG, { fetchImpl: offline });
  assert.equal(r.pushed, 0);
  assert.equal(r.pending, 1);                 // gepuffert statt verloren
  assert.equal(outboxStats(db).pending, 1);
});

test('reconnect: gepufferte Tripel werden nachgeliefert, genau einmal', async () => {
  const { engine, db, dbPath } = setup();
  engine.storeTriple({ subject: 'Mars', predicate: 'ist_ein', object: 'Planet', confidence: 800 });
  await bridgePush(engine, db, dbPath, CFG, { fetchImpl: async () => { throw new Error('down'); } }); // offline

  const calls = [];
  const online = async (_url, opts) => { calls.push(JSON.parse(opts.body)); return { status: 200, json: async () => ({ result: { ok: true } }) }; };
  const r = await bridgePush(engine, db, dbPath, CFG, { fetchImpl: online });
  assert.equal(r.pushed, 1);
  assert.equal(r.pending, 0);
  assert.equal(calls.length, 1);              // genau einmal zugestellt
  assert.equal(outboxStats(db).delivered, 1);
});

test('idempotent: zugestellte Tripel werden nie erneut gepusht', async () => {
  const { engine, db, dbPath } = setup();
  engine.storeTriple({ subject: 'Mars', predicate: 'ist_ein', object: 'Planet', confidence: 800 });
  let n = 0;
  const online = async () => { n++; return { status: 200, json: async () => ({ result: { ok: true } }) }; };

  await bridgePush(engine, db, dbPath, CFG, { fetchImpl: online }); // pushed 1
  const r = await bridgePush(engine, db, dbPath, CFG, { fetchImpl: online }); // nichts neu
  assert.equal(r.pushed, 0);
  assert.equal(n, 1);                         // nur der erste Lauf hat zugestellt
});

test('teilweiser Ausfall: erstes Tripel zugestellt, zweites bleibt gepuffert', async () => {
  const { engine, db, dbPath } = setup();
  engine.storeTriple({ subject: 'Anna', predicate: 'verbunden_mit', object: 'Bert', confidence: 700 });
  engine.storeTriple({ subject: 'Cleo', predicate: 'verbunden_mit', object: 'Dora', confidence: 700 });
  let i = 0;
  const flaky = async () => { i++; if (i === 1) return { status: 200, json: async () => ({ result: { ok: true } }) }; throw new Error('down'); };

  const r = await bridgePush(engine, db, dbPath, CFG, { fetchImpl: flaky });
  assert.equal(r.pushed, 1);
  assert.equal(r.pending, 1);                 // Rest bleibt für den nächsten Versuch
});

test('enqueue ist deterministisch idempotent (kein Doppel-Eintrag)', () => {
  const { engine, db } = setup();
  engine.storeTriple({ subject: 'Xenon', predicate: 'reagiert_mit', object: 'Yttrium', confidence: 700 });
  assert.equal(enqueueOutbox(engine, db), 1);
  assert.equal(enqueueOutbox(engine, db), 0); // schon eingereiht → nichts Neues
  assert.equal(outboxStats(db).pending, 1);
});
