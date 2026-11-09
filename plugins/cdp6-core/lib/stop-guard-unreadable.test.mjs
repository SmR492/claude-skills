import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { activeStop } from './stop-guard.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

test('fires: an unreadable counters.json of an active run gives a stop reason', () => {
  const S = tempDir('cdp6-stopguard-');
  writeFileSync(join(S, 'counters.json'), '{ "x": ');
  assert.notEqual(activeStop(S), null);
});
