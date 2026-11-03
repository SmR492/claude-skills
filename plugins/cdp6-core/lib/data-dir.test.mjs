import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { cacheDir, pointerPath, hostKeyDir, dataDir, writeDataDirPointer } from './data-dir.mjs';

function home() {
  return mkdtempSync(join(tmpdir(), 'cdp6-dd-'));
}

test('cache directory and host key directory use the cdp6-core names', () => {
  const h = home();
  assert.equal(cacheDir({ HOME: h }), join(h, '.cache', 'cdp6-core'));
  assert.equal(pointerPath({ HOME: h }), join(h, '.cache', 'cdp6-core', 'data-dir'));
  assert.equal(hostKeyDir({ HOME: h }), join(h, '.config', 'cdp6-core'));
});

test('resolution order: variable, pointer file, cache directory', () => {
  const h = home();
  const env = { HOME: h };
  assert.equal(dataDir(env), cacheDir(env));
  const target = join(h, 'data');
  mkdirSync(target);
  mkdirSync(cacheDir(env), { recursive: true });
  writeFileSync(pointerPath(env), `${target}\n`);
  assert.equal(dataDir(env), target);
  assert.equal(dataDir({ ...env, CLAUDE_PLUGIN_DATA: '/x/y' }), '/x/y');
});

test('writes the pointer file with the resolved directory', () => {
  const h = home();
  const r = writeDataDirPointer({ HOME: h, CLAUDE_PLUGIN_DATA: join(h, 'pd') });
  assert.equal(readFileSync(r.pointer, 'utf8'), `${join(h, 'pd')}\n`);
});

test('exports no session pointer', async () => {
  const mod = await import('./data-dir.mjs');
  assert.equal(mod.writeSessionPointer, undefined);
  assert.equal(mod.readSessionPointer, undefined);
});
