import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { ensureHostKey } from '../lib/hook-key.mjs';
import { readProbeRecord } from '../lib/probe-record.mjs';
import { acceptedRecord, stubClaude } from '../test-support/probe-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

test('fires: a record accepted through probe-check holds the A-12 auto calibration the preflight reads', () => {
  const base = tempDir('cdp6-cal-');
  const home = join(base, 'home');
  const bin = join(base, 'bin');
  stubClaude(bin, '2.1.318');
  ensureHostKey({ HOME: home });
  const env = { HOME: home, PATH: `${bin}:/usr/bin:/bin` };
  const data = join(home, 'data');
  acceptedRecord({ env, data });
  const rec = readProbeRecord(data, '2.1.318', env);
  assert.notEqual(rec, null);
  const cal = rec.rows['A-12']?.modes?.auto?.calibration ?? rec.rows['A-12']?.calibration;
  assert.ok(Number.isFinite(cal?.base) && Number.isFinite(cal?.per_path), 'the accepted record holds no calibration');
});
