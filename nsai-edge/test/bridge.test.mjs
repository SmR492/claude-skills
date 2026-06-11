import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Engine } from '../src/engine.mjs';
import { openDb } from '../src/db.mjs';
import { createIdentity } from '../src/identity.mjs';
import { bridgeConfig, bridgePush, bridgePull } from '../src/bridge.mjs';

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
