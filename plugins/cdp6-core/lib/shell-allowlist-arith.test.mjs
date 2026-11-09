import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readOnlyCall } from './shell-allowlist.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const payload = (dir) => `cat 'a[$(touch ${join(dir, 'pwned')})]' ; cat $[_]`;

test('positive control: bash runs the command substitution hidden in $[_]', () => {
  const dir = tempDir('cdp6-arith-');
  spawnSync('bash', ['-c', payload(dir)], { cwd: dir, encoding: 'utf8' });
  assert.equal(existsSync(join(dir, 'pwned')), true);
});

test('fires: arithmetic expansion is not admitted as read-only during a stop', () => {
  const dir = tempDir('cdp6-arith-');
  assert.equal(readOnlyCall(payload(dir)), false);
  assert.equal(readOnlyCall('cat $[_]'), false);
  assert.equal(readOnlyCall('cat "$[_]"'), false);
});
