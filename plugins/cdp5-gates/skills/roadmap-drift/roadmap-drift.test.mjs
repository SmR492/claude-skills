import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseClaims, checkRoadmap } from './roadmap-drift.mjs';

test('parseClaims nimmt nur Backtick-Tokens aus FERTIG-Zeilen', () => {
  const md = '- ✅ `Present` gebaut\n- 🟡 offen `NichtGezählt`\n- GESCHLOSSEN `Foo/Bar.php`';
  assert.deepEqual(parseClaims(md).map((c) => c.token), ['Present', 'Foo/Bar.php']);
});

test('checkRoadmap meldet Drift bei fehlendem Artefakt, ignoriert sich selbst', () => {
  const root = mkdtempSync(join(tmpdir(), 'rd-'));
  try {
    mkdirSync(join(root, 'src'));
    writeFileSync(join(root, 'src', 'Present.php'), '<?php\nclass Present {}\n');
    const rm = join(root, 'roadmap.md');
    writeFileSync(rm, '- ✅ `Present` ist gebaut\n- ✅ `GhostClass` angeblich gebaut\n');
    const r = checkRoadmap(rm, root);
    assert.equal(r.drift, true);
    assert.deepEqual(r.missing.map((m) => m.token), ['GhostClass']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
