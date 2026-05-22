import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { lintWiki } from './wiki-lint.mjs';

const FM = '---\ntitle: X\ntype: pattern\nupdated: 2026-05-22\n---\n';

test('erkennt Broken-Link, Orphan und Frontmatter-Lücke', () => {
  const root = mkdtempSync(join(tmpdir(), 'wl-'));
  try {
    // index verlinkt good.md; good.md ist also kein Orphan. orphan.md wird nirgends verlinkt.
    writeFileSync(join(root, 'index.md'), FM + '[Good](good.md)\n[Tot](fehlt.md)\n');
    writeFileSync(join(root, 'good.md'), FM + 'ok');
    writeFileSync(join(root, 'orphan.md'), FM + 'niemand verlinkt mich');
    writeFileSync(join(root, 'nofm.md'), 'kein frontmatter');
    const r = lintWiki(root);
    assert.deepEqual(r.brokenLinks.map((b) => b.target), ['fehlt.md']);
    assert.ok(r.orphans.includes('orphan.md'));
    assert.ok(!r.orphans.includes('good.md'));        // verlinkt → kein Orphan
    assert.ok(!r.orphans.includes('index.md'));        // Entry-Point
    assert.ok(r.frontmatterIssues.some((f) => f.file === 'nofm.md'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});
