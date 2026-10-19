import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, cpSync, copyFileSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { lintWiki } from './wiki-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SKILL = join(HERE, 'wiki-lint.mjs');
const FM = '---\ntitle: X\ntype: pattern\nupdated: 2026-05-22\n---\n';

test('detects broken link, orphan and frontmatter gap', () => {
  const root = mkdtempSync(join(tmpdir(), 'wl-'));
  try {
    // index links good.md, so good.md is not an orphan. orphan.md is linked from nowhere.
    writeFileSync(join(root, 'index.md'), FM + '[Good](good.md)\n[Dead](missing.md)\n');
    writeFileSync(join(root, 'good.md'), FM + 'ok');
    writeFileSync(join(root, 'orphan.md'), FM + 'nobody links to me');
    writeFileSync(join(root, 'nofm.md'), 'no frontmatter');
    const r = lintWiki(root);
    assert.deepEqual(r.brokenLinks.map((b) => b.target), ['missing.md']);
    assert.ok(r.orphans.includes('orphan.md'));
    assert.ok(!r.orphans.includes('good.md'));        // linked → not an orphan
    assert.ok(!r.orphans.includes('index.md'));        // entry point
    assert.ok(r.frontmatterIssues.some((f) => f.file === 'nofm.md'));
    assert.equal(r.hasCritical, true);
    assert.deepEqual(r.findings.filter((f) => f.kind === 'orphan').map((f) => f.sev), ['🟡', '🟡']);   // orphan.md + nofm.md
    assert.ok(r.findings.filter((f) => f.kind !== 'orphan').every((f) => f.sev === '🔴'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('exit code: frontmatter issue alone → 1; orphans alone → 0', () => {
  const root = mkdtempSync(join(tmpdir(), 'wl-'));
  try {
    writeFileSync(join(root, 'index.md'), FM + '[Good](good.md)\n');
    writeFileSync(join(root, 'good.md'), 'no frontmatter, but linked');
    const r1 = spawnSync('node', [SKILL, `--wiki=${root}`], { encoding: 'utf8' });
    assert.equal(r1.status, 1, r1.stdout);
    assert.match(r1.stdout, /🔴 good\.md: no YAML frontmatter/);

    writeFileSync(join(root, 'good.md'), FM + 'fixed');
    writeFileSync(join(root, 'lonely.md'), FM + 'orphan');
    const r2 = spawnSync('node', [SKILL, `--wiki=${root}`, '--json'], { encoding: 'utf8' });
    assert.equal(r2.status, 0, r2.stdout);
    const out = JSON.parse(r2.stdout);
    assert.deepEqual(out.findings.map((f) => [f.sev, f.kind, f.file]), [['🟡', 'orphan', 'lonely.md']]);
    assert.equal(out.hasCritical, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('only .md targets are resolved — image/other links are neither broken nor inbound', () => {
  const root = mkdtempSync(join(tmpdir(), 'wl-'));
  try {
    writeFileSync(join(root, 'index.md'), FM + '![img](missing.png) [pdf](missing.pdf) [ok](good.md)\n');
    writeFileSync(join(root, 'good.md'), FM + 'ok');
    const r = lintWiki(root);
    assert.deepEqual(r.brokenLinks, []);
    assert.equal(r.hasCritical, false);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI: runs from a path containing a space and prints output', () => {
  const base = mkdtempSync(join(tmpdir(), 'cdp5 gates '));
  try {
    cpSync(resolve(HERE, '../../lib'), join(base, 'lib'), { recursive: true });
    const skillDir = join(base, 'skills', 'wiki-lint');
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(SKILL, join(skillDir, 'wiki-lint.mjs'));
    const wiki = join(base, 'wiki'); mkdirSync(wiki);
    writeFileSync(join(wiki, 'index.md'), FM + '[Dead](missing.md)\n');
    const r = spawnSync('node', [join(skillDir, 'wiki-lint.mjs'), `--wiki=${wiki}`], { encoding: 'utf8' });
    assert.match(r.stdout, /wiki-lint — 1 pages scanned/);
    assert.match(r.stdout, /🔴 index\.md → missing\.md/);
    assert.equal(r.status, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
