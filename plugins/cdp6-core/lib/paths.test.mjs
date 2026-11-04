import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, realpathSync, symlinkSync } from 'node:fs';
import { join } from 'node:path';
import { isMainModule, realOrResolved, within } from './paths.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

function tree() {
  const base = realpathSync(tempDir('cdp6-paths-'));
  mkdirSync(join(base, 'real', 'dir'), { recursive: true });
  symlinkSync(join(base, 'real'), join(base, 'link'));
  return base;
}

test('realOrResolved resolves the nearest existing parent through a symlink and keeps the missing tail', () => {
  const base = tree();
  assert.equal(realOrResolved(join(base, 'link', 'dir', 'new', 'file.txt')), join(base, 'real', 'dir', 'new', 'file.txt'));
  assert.equal(realOrResolved(join(base, 'link', 'dir')), join(base, 'real', 'dir'));
  assert.equal(realOrResolved(join(base, 'link', 'gone')), join(base, 'real', 'gone'));
});

test('within matches the root itself and its children but not a sibling with the same prefix', () => {
  assert.equal(within('/a/b', '/a/b'), true);
  assert.equal(within('/a/b/c', '/a/b'), true);
  assert.equal(within('/a/bc', '/a/b'), false);
  assert.equal(within('/a/b/c', '/'), true);
});

test('isMainModule compares the real path of argv1 with the module path', () => {
  const base = tree();
  const real = join(base, 'real', 'mod.mjs');
  const url = new URL(`file://${real}`).href;
  assert.equal(isMainModule(url, real), false);
  assert.equal(isMainModule(import.meta.url, new URL(import.meta.url).pathname), true);
  const self = new URL(import.meta.url).pathname;
  symlinkSync(self, join(base, 'self-link.mjs'));
  assert.equal(isMainModule(import.meta.url, join(base, 'self-link.mjs')), true);
  assert.equal(isMainModule(import.meta.url, null), false);
  assert.equal(isMainModule(import.meta.url, ''), false);
});
