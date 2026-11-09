import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { tempDir } from '../test-support/temp-dir.mjs';
import { signedRecord } from '../test-support/probe-fixture.mjs';
import { ensureHostKey } from './hook-key.mjs';
import { probePassed, readProbeRecord } from './probe-record.mjs';

test('fires: signedRecord drops a row it is given', () => {
  const env = { HOME: tempDir('cdp6-fixture-home-') };
  const data = join(tempDir('cdp6-fixture-data-'), 'data');
  ensureHostKey(env);
  signedRecord({ env, data, version: '2.1.314', rows: { 'A-5': { passed: true }, 'A-11': { passed: true } } });
  const rec = readProbeRecord(data, '2.1.314', env);
  assert.equal(probePassed(rec, 'A-11'), true);
  assert.equal(probePassed(rec, 'A-5'), true);
});
