import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bySection, byKeyword, listSections, splitBlocks } from './cdp5.mjs';

const MD = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'konzept-design-pattern-v5.md'), 'utf8');

test('bySection returns the section including its subsections', () => {
  const s = bySection(MD, '33');
  assert.ok(s && /Sicherheit/.test(s));
  assert.ok(/33\.1/.test(s) && /Lethal-Trifecta/.test(s)); // contains the subsection
});

test('bySection for a subsection (33.1) returns exactly that one', () => {
  const s = bySection(MD, '33.1');
  assert.ok(s && /Lethal-Trifecta-Gate/.test(s));
});

test('byKeyword finds blocks by keyword', () => {
  const hits = byKeyword(MD, 'lethal trifecta');
  assert.ok(hits.length >= 1);
});

test('non-existent section → null', () => {
  assert.equal(bySection(MD, '99.9'), null);
});

test('listSections returns headings, splitBlocks parses', () => {
  assert.ok(listSections(MD).length > 10);
  assert.ok(splitBlocks(MD).every((b) => b.level >= 1 && b.level <= 4));
});
