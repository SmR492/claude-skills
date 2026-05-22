import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseUCs, mapKonzept } from './konzept-mapper.mjs';

test('parseUCs trennt UC-Sektionen, ignoriert andere Überschriften', () => {
  const md = '## UC-01: Anlegen\nText `Foo`\n## Glossar\nx\n## UC-02: Löschen\n`Bar`';
  const ucs = parseUCs(md);
  assert.equal(ucs.length, 2);
  assert.match(ucs[0].title, /UC-01/);
  assert.ok(!ucs[0].body.includes('Glossar'));
});

test('mapKonzept: ✓ / teilweise / fehlt korrekt (neutrale Fixtures)', () => {
  const root = mkdtempSync(join(tmpdir(), 'km-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'Article.php'), '<?php\nclass Article {}\n');
    writeFileSync(join(root, 'src', 'Routes.php'), '<?php // /api/items\n');
    const k = join(root, 'konzept.md');
    writeFileSync(k,
      '## UC-01: Artikel anlegen\nEntity `Article`, Route `/api/items`\n' +   // beide da → ✓
      '## UC-02: Voll da\n`Article`\n' +                                       // da → ✓
      '## UC-03: Nichts da\n`GhostEntity`\n');                                 // fehlt
    const rows = mapKonzept(k, root);
    assert.equal(rows.length, 3);
    assert.equal(rows.find((r) => /UC-01/.test(r.uc)).status, '✓');
    assert.equal(rows.find((r) => /UC-02/.test(r.uc)).status, '✓');
    assert.equal(rows.find((r) => /UC-03/.test(r.uc)).status, 'fehlt');
  } finally { rmSync(root, { recursive: true, force: true }); }
});
