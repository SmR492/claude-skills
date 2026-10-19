import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathTypeError } from './args.mjs';

const dir = mkdtempSync(join(tmpdir(), 'args-'));
const file = join(dir, 'f.txt');
writeFileSync(file, 'x');

test('pathTypeError: correct type → null', () => {
  assert.equal(pathTypeError(dir, 'dir'), null);
  assert.equal(pathTypeError(file, 'file'), null);
});

test('pathTypeError: file where a directory is expected (ENOTDIR class) → message', () => {
  const e = pathTypeError(file, 'dir');
  assert.match(e, /expected a directory/);
});

test('pathTypeError: directory where a file is expected (EISDIR class) → message', () => {
  assert.match(pathTypeError(dir, 'file'), /expected a file/);
});

test('pathTypeError: non-existent path → "not found"', () => {
  assert.match(pathTypeError(join(dir, 'gone.md'), 'file'), /not found/);
});

test('pathTypeError: absent (undefined/empty) → null (missing arg is a separate check)', () => {
  assert.equal(pathTypeError(undefined, 'file'), null);
  assert.equal(pathTypeError('', 'dir'), null);
});

test('pathTypeError: flag without a value (true) → message, no crash', () => {
  assert.match(pathTypeError(true, 'file'), /without a value/);
});

test('pathTypeError is pure: never throws, returns only string|null', () => {
  for (const v of [0, {}, [], NaN, Symbol('x')]) {
    const r = pathTypeError(v, 'file');
    assert.ok(r === null || typeof r === 'string');
  }
});
