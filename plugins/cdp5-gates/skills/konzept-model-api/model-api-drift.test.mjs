import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseOpenApi, parsePhp, diff } from './model-api-drift.mjs';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

test('parseOpenApi liest Schema-Properties + Enum-Block (neutrale Fixtures)', () => {
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

test('parseOpenApi liest Inline-Enum (enum: [a, b])', () => {
  const api = parseOpenApi('    state:\n      enum: [open, closed]\n');
  assert.deepEqual(api.enums.state.sort(), ['closed', 'open']);
});

test('parsePhp skopiert Properties pro Klasse (kein Cross-Leak)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'php-'));
  try {
    const f = join(dir, 'M.php');
    writeFileSync(f, '<?php\nclass Foo { private string $a; }\nclass Bar { private int $b; }\n');
    const { entities } = parsePhp([f]);
    assert.deepEqual(entities.Foo, ['a']);   // NICHT [a,b]
    assert.deepEqual(entities.Bar, ['b']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('diff erkennt Enum-Wert-Drift und Property-Drift', () => {
  const php = { enums: { Status: ['draft', 'published'] }, entities: { Article: ['title', 'slug'] } };
  const api = { enums: { status: ['draft', 'published', 'archived'] }, schemas: { Article: ['title', 'status'] } };
  const d = diff(php, api);
  assert.ok(d.some((x) => x.type === 'enum' && /weichen ab/.test(x.issue)));
  assert.ok(d.some((x) => x.type === 'property' && x.name === 'Article'));
});

test('diff: kein Drift bei Übereinstimmung', () => {
  assert.equal(diff({ enums: { Status: ['a', 'b'] }, entities: {} }, { enums: { status: ['a', 'b'] }, schemas: {} }).length, 0);
});
