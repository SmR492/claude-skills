import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { tripleHash } from '../src/canonical.mjs';
import { httpServer, httpClient, bundleAdapter } from '../src/transport.mjs';

test('HTTP-Transport: Pull über echtes Netzwerk (Node↔Node) verifiziert + merged', async () => {
  const A = new Engine(); const B = new Engine();
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Glatteis', confidence: 900 });
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  const { server, url } = await httpServer(A);
  try {
    const tally = await B.pull(httpClient(url), A.peerId);
    assert.equal(tally.accepted, 1);
    assert.equal(B._getEdge(tripleHash('Sensor', 'meldet', 'Glatteis')).local_status, 'active');
  } finally { server.close(); }
});

test('HTTP-Transport: manipuliertes Tripel über Netz wird abgewiesen', async () => {
  const A = new Engine(); const B = new Engine();
  A.storeTriple({ subject: 'Sensor', predicate: 'meldet', object: 'Wert', confidence: 900 });
  B.peerAdd(A.peerId, A.identity.publicKeyPem); B.peerTrust(A.peerId, 'full');
  const { server, url } = await httpServer(B); // B exponiert /ingest
  try {
    const batch = A.exportSince({}); batch[0].asserted_confidence = 1; // Signatur ungültig
    assert.equal((await httpClient(url).receiveIngest(batch))[0].status, 'rejected');
  } finally { server.close(); }
});

test('bundleAdapter: nutzt execFile-Argument-Array (kein Shell-String) — keine Command-Injection (AC-Sec-7)', () => {
  const a = bundleAdapter({ container: 'fp_app' });
  const args = a._exportArgs({ 'peer:x': 1 });
  assert.deepEqual(args.slice(0, 6), ['exec', '-i', 'fp_app', 'php', 'bin/console', 'nsai:graph:export']);
  assert.deepEqual(a._ingestArgs().slice(0, 6), ['exec', '-i', 'fp_app', 'php', 'bin/console', 'nsai:graph:ingest']);
});

test('bundleAdapter: lehnt unsichere Container-Namen ab (Injection-Schutz)', () => {
  assert.throws(() => bundleAdapter({ container: 'x; rm -rf /' }), /INVALID_CONTAINER/);
  assert.throws(() => bundleAdapter({ container: '$(whoami)' }), /INVALID_CONTAINER/);
});

test('bundleAdapter: nicht erreichbarer Container/kein docker → SyncSkipped statt Crash', async () => {
  const a = bundleAdapter({ container: 'nsai-edge-definitely-absent' });
  await assert.rejects(() => a.exportSince({}), (e) => e.code === 'SYNC_SKIPPED');
});
