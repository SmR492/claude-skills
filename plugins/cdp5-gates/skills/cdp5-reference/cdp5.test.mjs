import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { bySection, byKeyword, listSections, splitBlocks } from './cdp5.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const MD = readFileSync(join(HERE, 'konzept-design-pattern-v5.md'), 'utf8');

/** Copies lib + this skill (incl. the bundled doctrine) into a temp directory whose path contains a space. */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'cdp5-reference'), { recursive: true });
  return { root, script: join(root, 'skills', 'cdp5-reference', 'cdp5.mjs') };
}

test('bySection("10") returns §10 "AI Review of the Konzept", not the combined "10.6 / 10.7 / 19" heading', () => {
  const s = bySection(MD, '10');
  assert.ok(s, 'section 10 found');
  assert.match(s.split('\n')[0], /^## 10\. AI Review of the Konzept/);
  assert.ok(/^### 10\.1 /m.test(s), 'contains its own subsections');
  assert.ok(!/^## 10\.6 \/ 10\.7 \/ 19/m.test(s), 'the verification heading is not the start block');
  // the combined heading stays reachable by its own number
  assert.match(bySection(MD, '10.6').split('\n')[0], /^#{2,3} 10\.6/);
});

test('CLI runs from a path with a space (main guard); no hit is exit 2 (input), hit exit 0, usage exit 2', () => {
  const { root, script } = cliCopy();
  try {
    const hit = spawnSync('node', [script, '--section=10'], { encoding: 'utf8' });
    assert.equal(hit.status, 0, hit.stdout + hit.stderr);
    assert.match(hit.stdout, /^## 10\. AI Review of the Konzept/);
    const kw = spawnSync('node', [script, '--keyword=lethal trifecta'], { encoding: 'utf8' });
    assert.equal(kw.status, 0);
    assert.match(kw.stdout, /§ /);
    assert.equal(spawnSync('node', [script, '--section=99.9'], { encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync('node', [script, '--keyword=zzz-no-such-term-zzz'], { encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
    assert.equal(spawnSync('node', [script, '--list'], { encoding: 'utf8' }).status, 0);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('bySection returns the section including its subsections', () => {
  const s = bySection(MD, '33');
  assert.ok(s && /^## 33\. Security/m.test(s));
  assert.ok(/33\.1/.test(s) && /Lethal-Trifecta/.test(s)); // contains the subsection
});

test('bySection for a subsection (33.1) returns exactly that one', () => {
  const s = bySection(MD, '33.1');
  assert.ok(s && /^### 33\.1 Lethal-Trifecta gate/mi.test(s));
  assert.ok(!/^### 33\.2/m.test(s), 'the next subsection is not included');
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
