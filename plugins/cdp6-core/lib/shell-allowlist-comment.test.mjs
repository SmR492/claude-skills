import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { readOnlyCall } from './shell-allowlist.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const payload = (dir) => `ls #'\ntouch ${join(dir, 'pwned')}\n#'`;

test('positive control: bash runs the command hidden behind a comment that opens a quote', () => {
  const dir = tempDir('cdp6-comment-');
  spawnSync('bash', ['-c', payload(dir)], { cwd: dir, encoding: 'utf8' });
  assert.equal(existsSync(join(dir, 'pwned')), true);
});

test('fires: a comment hides a write from the stop allowlist', () => {
  const dir = tempDir('cdp6-comment-');
  assert.equal(readOnlyCall(payload(dir)), false);
  assert.equal(readOnlyCall("cat f #'\nrm f\n#'"), false);
  assert.equal(readOnlyCall('ls #"\ntouch p\n#"'), false);
});

test('fires: a typographic quote closes a PowerShell string the lexer reads as open', () => {
  assert.equal(readOnlyCall("cat 'a’ $(New-Item p) ‘b'"), false);
});
