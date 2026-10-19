import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lintWiki } from './wiki-lint.mjs';

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
  } finally { rmSync(root, { recursive: true, force: true }); }
});
