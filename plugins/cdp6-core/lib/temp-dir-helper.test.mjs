import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { tempDir } from '../test-support/temp-dir.mjs';

const HELPER = pathToFileURL(join(dirname(fileURLToPath(import.meta.url)), '..', 'test-support', 'temp-dir.mjs')).href;

test('the temp-dir helper removes the directories of a failing test, a passing test and the module level', () => {
  const box = tempDir('cdp6-helper-box-');
  const tmp = join(box, 'tmp');
  mkdirSync(tmp);
  const probe = join(box, 'probe.test.mjs');
  writeFileSync(probe, [
    "import test from 'node:test';",
    `import { tempDir } from ${JSON.stringify(HELPER)};`,
    "tempDir('module-');",
    "test('red on purpose', () => { tempDir('failing-'); throw new Error('red on purpose'); });",
    "test('green', () => { tempDir('passing-'); });",
    '',
  ].join('\n'));
  const r = spawnSync(process.execPath, ['--test', probe], { encoding: 'utf8', env: { PATH: process.env.PATH, HOME: box, TMPDIR: tmp } });
  assert.equal(r.status, 1, `${r.stdout}${r.stderr}`);
  assert.match(`${r.stdout}${r.stderr}`, /red on purpose/);
  assert.deepEqual(readdirSync(tmp), []);
});
