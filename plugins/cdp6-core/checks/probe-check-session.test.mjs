import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { ensureHostKey } from '../lib/hook-key.mjs';
import { firedLine, goodRows, markdown, sha, stubClaude } from '../test-support/probe-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';
import { fakeHost } from '../test-support/claude-host.mjs';
import { acceptRecord } from './probe-check.mjs';

function world() {
  const base = tempDir('cdp6-pcheck-session-');
  const w = { home: join(base, 'home'), bin: join(base, 'bin'), data: join(base, 'data') };
  mkdirSync(w.home);
  stubClaude(w.bin, '2.1.318');
  w.host = fakeHost(base, '2.1.318');
  ensureHostKey({ HOME: w.home });
  w.env = { HOME: w.home, PATH: `${w.bin}:${process.env.PATH}` };
  firedLine(w.data);
  return w;
}

function accept(w, rows) {
  const text = markdown(rows);
  return acceptRecord(text, { dataDir: w.data, env: w.env, expect: sha(text), ...w.host });
}

test('a record with the A-12 auto calibration under a second settings file is accepted', () => {
  const w = world();
  const result = accept(w, [...goodRows(), { ...goodRows()[2], settings_sha256: 'd'.repeat(64) }]);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('a record with A-5 bypassPermissions under the second probe file and the launch-refused row under the live file is accepted', () => {
  const w = world();
  const base = goodRows()[0];
  const result = accept(w, [...goodRows(), { ...base, mode: 'bypassPermissions', verdict: 'prompt', settings_sha256: 'd'.repeat(64) }, { ...base, mode: 'bypassPermissions', verdict: 'launch-refused' }]);
  assert.equal(result.ok, true, JSON.stringify(result));
});

test('fires: the verdict refused is no launch refusal for an A-5 bypassPermissions row', () => {
  const w = world();
  const base = goodRows()[0];
  const result = accept(w, [...goodRows(), { ...base, mode: 'bypassPermissions', verdict: 'refused' }]);
  assert.equal(result.ok, false);
  assert.equal(result.error, 'row-verdict');
});
