import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { parseOpenApi, parsePhp, diff } from './model-api-drift.mjs';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Copies lib + this skill into a temp directory whose path contains a space (main-guard regression). */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'konzept-model-api'), { recursive: true });
  return { root, script: join(root, 'skills', 'konzept-model-api', 'model-api-drift.mjs') };
}

test('parseOpenApi reads schema properties + enum block (neutral fixtures)', () => {
  const yaml = `
components:
  schemas:
    Article:
      type: object
      properties:
        title:
          type: string
        status:
          type: string
          enum:
            - draft
            - published
            - archived
`;
  const api = parseOpenApi(yaml);
  assert.deepEqual(api.schemas.Article.sort(), ['status', 'title']);
  assert.deepEqual(api.enums.status.sort(), ['archived', 'draft', 'published']);
});

test('parseOpenApi reads inline enum (enum: [a, b])', () => {
  const api = parseOpenApi('    state:\n      enum: [open, closed]\n');
  assert.deepEqual(api.enums.state.sort(), ['closed', 'open']);
});

test('parsePhp scopes properties per class (no cross-leak)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'php-'));
  try {
    const f = join(dir, 'M.php');
    writeFileSync(f, '<?php\nclass Foo { private string $a; }\nclass Bar { private int $b; }\n');
    const { entities } = parsePhp([f]);
    assert.deepEqual(entities.Foo, ['a']);   // NOT [a,b]
    assert.deepEqual(entities.Bar, ['b']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('parsePhp sees untyped, static and readonly properties, not method parameters', () => {
  const dir = mkdtempSync(join(tmpdir(), 'php-'));
  try {
    const f = join(dir, 'M.php');
    writeFileSync(f, [
      '<?php',
      'class Legacy {',
      '    private $untyped;',
      '    private static int $counter;',
      '    protected static $registry;',
      '    public readonly string $name;',
      '    private ?\\App\\Foo $nullable;',
      '    public function setX(string $param): void {}',
      '    public static function make(int $arg): self {}',
      '}',
    ].join('\n'));
    const { entities } = parsePhp([f]);
    assert.deepEqual(entities.Legacy, ['counter', 'name', 'nullable', 'registry', 'untyped']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('diff detects enum value drift and property drift as 🔴', () => {
  const php = { enums: { Status: ['draft', 'published'] }, entities: { Article: ['title', 'slug'] } };
  const api = { enums: { status: ['draft', 'published', 'archived'] }, schemas: { Article: ['title', 'status'] } };
  const d = diff(php, api);
  assert.ok(d.some((x) => x.type === 'enum' && x.sev === '🔴' && /values differ/.test(x.issue)));
  assert.ok(d.some((x) => x.type === 'property' && x.sev === '🔴' && x.name === 'Article'));
});

test('diff: PHP enum without OpenAPI counterpart is 🟡, with strict 🔴', () => {
  const php = { enums: { Internal: ['a', 'b'] }, entities: {} };
  const api = { enums: {}, schemas: {} };
  const lenient = diff(php, api);
  assert.equal(lenient.length, 1);
  assert.equal(lenient[0].sev, '🟡');
  assert.match(lenient[0].issue, /without OpenAPI counterpart/);
  assert.equal(diff(php, api, { strict: true })[0].sev, '🔴');
});

test('diff: no drift when PHP and OpenAPI match', () => {
  assert.equal(diff({ enums: { Status: ['a', 'b'] }, entities: {} }, { enums: { status: ['a', 'b'] }, schemas: {} }).length, 0);
});

test('CLI runs from a path with a space (main guard): missing counterpart exits 0 (🟡), --strict exits 1, value drift exits 1', () => {
  const { root, script } = cliCopy();
  try {
    const repo = join(root, 'repo');
    mkdirSync(join(repo, 'src'), { recursive: true });
    writeFileSync(join(repo, 'src', 'Internal.php'), '<?php\nenum Internal: string { case A = "a"; case B = "b"; }\n');
    const api = join(root, 'openapi.yaml');
    writeFileSync(api, 'components:\n  schemas:\n    Other:\n      type: object\n');
    const lenient = spawnSync('node', [script, `--repo=${repo}`, `--openapi=${api}`], { encoding: 'utf8' });
    assert.equal(lenient.status, 0, lenient.stdout + lenient.stderr);
    assert.match(lenient.stdout, /🟡 \[enum\] Internal: PHP enum without OpenAPI counterpart/);
    const strict = spawnSync('node', [script, `--repo=${repo}`, `--openapi=${api}`, '--strict', '--json'], { encoding: 'utf8' });
    assert.equal(strict.status, 1);
    assert.equal(JSON.parse(strict.stdout)[0].sev, '🔴');
    writeFileSync(api, 'components:\n  schemas:\n    Other:\n      properties:\n        internal:\n          enum: [a, c]\n');
    const drift = spawnSync('node', [script, `--repo=${repo}`, `--openapi=${api}`], { encoding: 'utf8' });
    assert.equal(drift.status, 1);
    assert.match(drift.stdout, /🔴 \[enum\] Internal: values differ/);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
