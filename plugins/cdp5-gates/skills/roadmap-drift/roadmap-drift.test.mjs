import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseClaims, checkRoadmap } from './roadmap-drift.mjs';

test('parseClaims takes backtick tokens only from DONE lines (German + English markers)', () => {
  // "GESCHLOSSEN" / "offen" are the German markers real roadmaps use; "DONE" is the English equivalent.
  const md = '- ✅ `Present` built\n- 🟡 offen `NotCounted`\n- GESCHLOSSEN `Foo/Bar.php`\n- DONE `Baz`\n- DONE but not merged `AlsoNotCounted`';
  assert.deepEqual(parseClaims(md).map((c) => c.token), ['Present', 'Foo/Bar.php', 'Baz']);
});

test('checkRoadmap reports drift for a missing artefact and ignores the roadmap file itself', () => {
  const root = mkdtempSync(join(tmpdir(), 'rd-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'Present.php'), '<?php\nclass Present {}\n');
    const rm = join(root, 'roadmap.md');
    writeFileSync(rm, '- ✅ `Present` is built\n- ✅ `GhostClass` allegedly built\n');
    const r = checkRoadmap(rm, root);
    assert.equal(r.drift, true);
    assert.deepEqual(r.missing.map((m) => m.token), ['GhostClass']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
