import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, symlinkSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { collectFiles, locate, parseUCs } from './scan.mjs';

test('parseUCs reads H2 and H3 UC headings, keeps H3 sub-headings inside, ends at other H1/H2 headings', () => {
  const md = '# Concept\n## 3. Use Cases\n### UC-01: Create\n### Akzeptanzkriterien\n| AC-1 | x |\n### UC-02 Delete\n`Bar`\n## 4. Glossar\nnot a UC\n## UC-03: Top level\n`Baz`\n';
  const ucs = parseUCs(md);
  assert.deepEqual(ucs.map((u) => u.id), ['UC-01', 'UC-02', 'UC-03']);
  assert.deepEqual(ucs.map((u) => u.line), [3, 6, 10]);
  assert.equal(ucs[0].title, 'UC-01: Create');
  assert.ok(ucs[0].body.includes('| AC-1 | x |'), 'H3 sub-heading content stays in the UC');
  assert.ok(!ucs[1].body.includes('not a UC'), 'H2 heading ends the UC');
  assert.equal(parseUCs('# only\n## Glossar\n').length, 0);
});

test('locate reports strength: declaration vs. bare occurrence vs. path, and found=false otherwise', () => {
  const root = mkdtempSync(join(tmpdir(), 'sc-loc-'));
  mkdirSync(join(root, 'src'));
  mkdirSync(join(root, 'config'));
  writeFileSync(join(root, 'src', 'Article.php'), '<?php\nclass Article {}\n');
  writeFileSync(join(root, 'config', 'services.yaml'), '# GhostService is wired here later\nfoo: bar\n');
  const files = collectFiles(root, ['.php', '.yaml']);
  assert.deepEqual(locate('Article', root, files), { kind: 'symbol', found: true, strength: 'declaration', evidence: join('src', 'Article.php') + ' (declaration)' });
  const weak = locate('GhostService', root, files);
  assert.equal(weak.found, true);
  assert.equal(weak.strength, 'occurrence');
  assert.match(weak.evidence, /\(occurrence\)$/);
  assert.equal(locate('src/Article.php', root, files).strength, 'path');
  assert.deepEqual(locate('Nowhere', root, files), { kind: 'symbol', found: false, strength: null, evidence: null });
  assert.equal(locate('foo:bar', root, files).strength, null);
});

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
