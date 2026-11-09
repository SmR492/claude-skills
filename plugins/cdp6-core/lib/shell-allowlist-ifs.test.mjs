import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readOnlyCall } from './shell-allowlist.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

test('fires: an unquoted $IFS hands date a flag outside the stop allowlist', () => {
  const dir = tempDir('cdp6-allow-ifs-');
  const direct = 'date -u +%s -d @0';
  assert.equal(spawnSync('bash', ['-c', direct], { cwd: dir, encoding: 'utf8' }).stdout.trim(), '0', 'positive control');
  assert.equal(readOnlyCall(direct), false);
  const command = 'date -u +%s$IFS-d$IFS@0';
  const r = spawnSync('bash', ['-c', command], { cwd: dir, encoding: 'utf8' });
  assert.ok(!(r.stdout.trim() === '0' && readOnlyCall(command)), `${command} passes and bash ran date -d`);
});

test('fires: unquoted parameter expansion is not read-only during the stop', () => {
  for (const c of ['date +$IFS-s$IFS@0', 'date -I$IFS--set=@0', 'ls $IFS-l', 'cat $HOME/f']) assert.equal(readOnlyCall(c), false, c);
});
