import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFiles } from './scan.mjs';

test('collectFiles sammelt erlaubte Endungen, ignoriert andere', () => {
  const root = mkdtempSync(join(tmpdir(), 'sc-'));
  writeFileSync(join(root, 'a.mjs'), '//');
  writeFileSync(join(root, 'b.txt'), 'x');
  const files = collectFiles(root, ['.mjs']);
  assert.equal(files.length, 1);
  assert.ok(files[0].endsWith('a.mjs'));
});

test('collectFiles folgt keinem Symlink (Out-of-tree- / Loop-Schutz)', () => {
  const outside = mkdtempSync(join(tmpdir(), 'sc-out-'));
  writeFileSync(join(outside, 'secret.mjs'), '// out of tree\n');
  const root = mkdtempSync(join(tmpdir(), 'sc-root-'));
  writeFileSync(join(root, 'in.mjs'), '// in tree\n');
  try { symlinkSync(outside, join(root, 'link')); } catch { return; }   // Symlink evtl. nicht erlaubt → skip
  const files = collectFiles(root, ['.mjs']);
  assert.equal(files.length, 1, 'nur in.mjs, nicht das Symlink-Ziel');
  assert.ok(files[0].endsWith('in.mjs'));
});
