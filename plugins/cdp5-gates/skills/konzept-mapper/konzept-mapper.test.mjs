import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseUCs, mapKonzept } from './konzept-mapper.mjs';
import { parseUCs as scaffoldParseUCs } from '../ac-to-test-scaffold/ac-to-test-scaffold.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Copies lib + this skill into a temp directory whose path contains a space (main-guard regression). */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'konzept-mapper'), { recursive: true });
  return { root, script: join(root, 'skills', 'konzept-mapper', 'konzept-mapper.mjs') };
}

test('parseUCs splits UC sections and ignores other headings', () => {
  const md = '## UC-01: Create\nText `Foo`\n## Glossar\nx\n## UC-02: Delete\n`Bar`';
  const ucs = parseUCs(md);
  assert.equal(ucs.length, 2);
  assert.match(ucs[0].title, /UC-01/);
  assert.ok(!ucs[0].body.includes('Glossar'));
});

test('mapper and scaffold see the same UCs: H3 UCs under a numbered section (shared parser)', () => {
  const md = '# Concept\n## 3. Use Cases\n### UC-01: Create\n`Article`\n### Akzeptanzkriterien\n| AC-1 | x | Unit | FooTest::testX | rot |\n### UC-02: Delete\n`Remover`\n## 4. Glossar\n### UC-99: Late addition (H3 UC after a non-UC H2 still counts)\n';
  const a = parseUCs(md);
  const b = scaffoldParseUCs(md);
  assert.equal(a.length, 3);
  assert.deepEqual(a.map((u) => u.id), b.map((u) => u.id));
  assert.deepEqual(a.map((u) => u.id), ['UC-01', 'UC-02', 'UC-99']);
});

test('mapKonzept: ✓ / partial / missing classified correctly (neutral fixtures)', () => {
  const root = mkdtempSync(join(tmpdir(), 'km-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'Article.php'), '<?php\nclass Article {}\n');
    writeFileSync(join(root, 'src', 'Routes.php'), '<?php // /api/items\n');
    const k = join(root, 'konzept.md');
    writeFileSync(k,
      '## UC-01: Create article\nEntity `Article`, Route `/api/items`\n' +   // both present → ✓
      '## UC-02: All present\n`Article`\n' +                                   // present → ✓
      '## UC-03: Nothing present\n`GhostEntity`\n' +                           // missing
      '## UC-04: Half\n`Article` and `GhostEntity`\n');                        // partial
    const rows = mapKonzept(k, root);
    assert.equal(rows.length, 4);
    assert.equal(rows.find((r) => /UC-01/.test(r.uc)).status, '✓');
    assert.equal(rows.find((r) => /UC-02/.test(r.uc)).status, '✓');
    assert.equal(rows.find((r) => /UC-03/.test(r.uc)).status, 'missing');
    assert.equal(rows.find((r) => /UC-04/.test(r.uc)).status, 'partial');
    assert.deepEqual(rows.map((r) => r.sev), ['🟢', '🟢', '🔴', '🟡']);
    assert.equal(rows[0].artefacts.find((a) => a.token === 'Article').strength, 'declaration');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('mapKonzept: an artefact found only as a bare occurrence (YAML comment) is weak → UC partial, not ✓', () => {
  const root = mkdtempSync(join(tmpdir(), 'km-'));
  try {
    mkdirSync(join(root, 'config'));
    writeFileSync(join(root, 'config', 'services.yaml'), '# PaymentGateway will be wired here\nservices: {}\n');
    const k = join(root, 'konzept.md');
    writeFileSync(k, '## UC-05: Pay\nService `PaymentGateway`\n');
    const [row] = mapKonzept(k, root);
    assert.equal(row.status, 'partial');
    assert.equal(row.sev, '🟡');
    assert.deepEqual(row.weak, ['PaymentGateway']);
    assert.deepEqual(row.missing, []);
    assert.equal(row.artefacts[0].state, 'weak');
    assert.match(row.artefacts[0].evidence, /\(occurrence\)$/);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI runs from a path with a space (main guard), prints found (decl) / weak / missing, exit 1 only on a missing UC', () => {
  const { root, script } = cliCopy();
  try {
    const repo = join(root, 'repo');
    mkdirSync(join(repo, 'src'), { recursive: true });
    writeFileSync(join(repo, 'src', 'Article.php'), '<?php\nclass Article {}\n');
    writeFileSync(join(repo, 'src', 'wiring.yaml'), '# Ghost mentioned only\n');
    const k = join(root, 'konzept.md');
    writeFileSync(k, '## UC-01: A\n`Article` `Ghost`\n## UC-02: B\n`Nowhere`\n');
    const r = spawnSync('node', [script, `--konzept=${k}`, `--repo=${repo}`], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /🟡 \[partial\] UC-01/);
    assert.match(r.stdout, /found \(decl\): Article/);
    assert.match(r.stdout, /weak: Ghost/);
    assert.match(r.stdout, /🔴 \[missing\] UC-02/);
    assert.match(r.stdout, /missing: Nowhere/);
    const j = spawnSync('node', [script, `--konzept=${k}`, `--repo=${repo}`, '--json'], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(j.stdout).map((x) => x.sev), ['🟡', '🔴']);
    writeFileSync(k, '## UC-01: A\n`Article` `Ghost`\n');
    assert.equal(spawnSync('node', [script, `--konzept=${k}`, `--repo=${repo}`], { encoding: 'utf8' }).status, 0);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
