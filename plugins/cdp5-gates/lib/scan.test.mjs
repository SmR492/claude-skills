import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFiles } from './scan.mjs';

test('collectFiles collects allowed extensions, ignores others', () => {
  const root = mkdtempSync(join(tmpdir(), 'sc-'));
  writeFileSync(join(root, 'a.mjs'), '//');
  writeFileSync(join(root, 'b.txt'), 'x');
  const files = collectFiles(root, ['.mjs']);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('a.mjs'));
});

test('collectFiles does not follow symlinks (out-of-tree / loop protection)', () => {
  const outside = mkdtempSync(join(tmpdir(), 'sc-out-'));
  writeFileSync(join(outside, 'secret.mjs'), '// out of tree\n');
  const root = mkdtempSync(join(tmpdir(), 'sc-root-'));
  writeFileSync(join(root, 'in.mjs'), '// in tree\n');
  try { symlinkSync(outside, join(root, 'link')); } catch { return; }   // symlinks may not be permitted → skip
  const files = collectFiles(root, ['.mjs']);
  assert.equal(files.length, 1, 'only in.mjs, not the symlink target');
  assert.ok(files[0].endsWith('in.mjs'));
});
