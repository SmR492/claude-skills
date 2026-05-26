import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathTypeError } from './args.mjs';

const dir = mkdtempSync(join(tmpdir(), 'args-'));
const file = join(dir, 'f.txt');
writeFileSync(file, 'x');

test('pathTypeError: korrekter Typ → null', () => {
  assert.equal(pathTypeError(dir, 'dir'), null);
  assert.equal(pathTypeError(file, 'file'), null);
});

test('pathTypeError: Datei wo Verzeichnis erwartet (ENOTDIR-Klasse) → Meldung', () => {
  const e = pathTypeError(file, 'dir');
  assert.match(e, /erwartet Verzeichnis/);
});

test('pathTypeError: Verzeichnis wo Datei erwartet (EISDIR-Klasse) → Meldung', () => {
  assert.match(pathTypeError(dir, 'file'), /erwartet Datei/);
});

test('pathTypeError: nicht-existenter Pfad → "nicht gefunden"', () => {
  assert.match(pathTypeError(join(dir, 'weg.md'), 'file'), /nicht gefunden/);
});

test('pathTypeError: abwesend (undefined/leer) → null (Missing-Arg ist eigener Check)', () => {
  assert.equal(pathTypeError(undefined, 'file'), null);
  assert.equal(pathTypeError('', 'dir'), null);
});

test('pathTypeError: Flag ohne Wert (true) → Meldung, kein Crash', () => {
  assert.match(pathTypeError(true, 'file'), /ohne Wert/);
});

test('pathTypeError ist pure: wirft nie, gibt nur string|null', () => {
  for (const v of [0, {}, [], NaN, Symbol('x')]) {
    const r = pathTypeError(v, 'file');
    assert.ok(r === null || typeof r === 'string');
  }
});
