import test, { mock } from 'node:test';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, realpathSync, renameSync, linkSync, unlinkSync, truncateSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { closeInput, openInput, readInput, readProjectFile, stillSame } from './input-file.mjs';

function tree() {
  const base = realpathSync(mkdtempSync(join(tmpdir(), 'cdp6-infile-')));
  mkdirSync(join(base, 'real'));
  mkdirSync(join(base, 'other'));
  writeFileSync(join(base, 'real', 'f.txt'), 'real\n');
  writeFileSync(join(base, 'other', 'f.txt'), 'other\n');
  symlinkSync(join(base, 'real'), join(base, 'dir'));
  return base;
}

test('fires: the checked path is the path of the descriptor, not a second lookup by name', () => {
  const base = tree();
  const handle = openInput(join(base, 'dir', 'f.txt'), {
    afterOpen: () => {
      rmSync(join(base, 'dir'));
      symlinkSync(join(base, 'other'), join(base, 'dir'));
    },
  });
  try {
    assert.equal(handle.real, join(base, 'real', 'f.txt'));
    assert.equal(handle.same, true);
  } finally {
    closeInput(handle);
  }
});

test('fires: stillSame follows the descriptor and notices a rename of the file', () => {
  const base = tree();
  const handle = openInput(join(base, 'real', 'f.txt'));
  try {
    assert.equal(stillSame(handle), true);
    renameSync(join(base, 'real', 'f.txt'), join(base, 'real', 'g.txt'));
    assert.equal(stillSame(handle), false);
  } finally {
    closeInput(handle);
  }
});

test('fires: stillSame is not fooled by a name that resolves elsewhere after the open', () => {
  const base = tree();
  const handle = openInput(join(base, 'dir', 'f.txt'));
  try {
    rmSync(join(base, 'dir'));
    symlinkSync(join(base, 'other'), join(base, 'dir'));
    assert.equal(stillSame(handle), true);
  } finally {
    closeInput(handle);
  }
});

test('reports nlink of the opened file', () => {
  const base = tree();
  const handle = openInput(join(base, 'real', 'f.txt'));
  try {
    assert.equal(handle.nlink, 1);
  } finally {
    closeInput(handle);
  }
});

test('fires: a decoy named "(deleted)" does not pass for an unlinked hard link', () => {
  const base = tree();
  const outside = join(base, 'other', 'secret.txt');
  writeFileSync(outside, 'secret\n');
  const link = join(base, 'real', 'x.txt');
  linkSync(outside, link);
  writeFileSync(`${link} (deleted)`, 'decoy\n');
  const handle = openInput(link, { afterOpen: () => unlinkSync(link) });
  try {
    assert.equal(handle.nlink, 1);
    assert.equal(handle.same && stillSame(handle) && handle.real === `${link} (deleted)`, false);
  } finally {
    closeInput(handle);
  }
});

test('fires: stillSame refuses a descriptor whose link count is not 1', () => {
  const base = tree();
  const file = join(base, 'real', 'y.txt');
  writeFileSync(file, 'y\n');
  const handle = openInput(file);
  try {
    assert.equal(stillSame(handle), true);
    linkSync(file, join(base, 'other', 'y-link.txt'));
    assert.equal(stillSame(handle), false);
  } finally {
    closeInput(handle);
  }
});

test('fires: the read is bounded by the size checked at open and refuses a file that grew', () => {
  const base = tree();
  const file = join(base, 'real', 'grow.txt');
  writeFileSync(file, 'x');
  const handle = openInput(file);
  try {
    truncateSync(file, 4 * 1024 * 1024);
    const spy = mock.method(fs, 'readSync', fs.readSync);
    syncBuiltinESMExports();
    try {
      assert.throws(() => readInput(handle), (e) => e.code === 'file-grew');
    } finally {
      spy.mock.restore();
      syncBuiltinESMExports();
    }
    assert.ok(spy.mock.callCount() > 0, 'the reader did not read through readSync');
    const taken = spy.mock.calls.reduce((sum, c) => sum + c.result, 0);
    assert.ok(taken <= handle.size + 1, `the reader took ${taken} bytes from a descriptor checked at ${handle.size}`);
    assert.ok(spy.mock.calls.every((c) => c.arguments[3] <= handle.size + 1), 'a single read asked for more than the checked size plus one byte');
    assert.equal(handle.content, undefined);
  } finally {
    closeInput(handle);
  }
});

test('the read returns the content of a file of the size checked at open, also when it shrank', () => {
  const base = tree();
  const file = join(base, 'real', 'shrink.txt');
  writeFileSync(file, 'abcdef');
  const handle = openInput(file);
  try {
    assert.equal(readInput(handle).toString(), 'abcdef');
    assert.equal(readInput(handle).toString(), 'abcdef');
  } finally {
    closeInput(handle);
  }
  writeFileSync(file, 'abcdef');
  const shrunk = openInput(file);
  try {
    truncateSync(file, 2);
    assert.equal(readInput(shrunk).toString(), 'ab');
  } finally {
    closeInput(shrunk);
  }
});

test('readProjectFile returns the content of a regular file and null for a missing file, a symbolic link, a directory and a file above the limit', () => {
  const base = tree();
  assert.equal(readProjectFile(join(base, 'real', 'f.txt')).toString(), 'real\n');
  assert.equal(readProjectFile(join(base, 'real', 'absent.txt')), null);
  writeFileSync(join(base, 'real', 'link-target.txt'), 'x');
  symlinkSync(join(base, 'real', 'link-target.txt'), join(base, 'real', 'link.txt'));
  assert.equal(readProjectFile(join(base, 'real', 'link.txt')), null);
  assert.equal(readProjectFile(join(base, 'real')), null);
  assert.equal(readProjectFile(join(base, 'real', 'f.txt'), 2), null);
});
