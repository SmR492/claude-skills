import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { checkLoop } from './retro-memory-loop-check.mjs';

test('erkennt zitierten Slug ohne Datei/Pointer, ignoriert vollständige', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-'));
  try {
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    writeFileSync(join(retro, 'r1.md'), 'Lehre [[feedback_good]] und feedback_ghost und [[project_done]].');
    writeFileSync(join(mem, 'feedback_good.md'), 'x');         // Datei + Pointer → ok
    writeFileSync(join(mem, 'project_done.md'), 'x');          // Datei, aber KEIN Pointer → broken
    writeFileSync(join(mem, 'MEMORY.md'), '- [Good](feedback_good.md) — hook\n'); // nur feedback_good verlinkt
    const r = checkLoop(retro, mem);
    const slugs = r.findings.map((f) => f.slug).sort();
    assert.deepEqual(slugs, ['feedback_ghost', 'project_done']);   // ghost: keine Datei; project_done: kein Pointer
    assert.ok(!slugs.includes('feedback_good'));
    assert.equal(r.broken, true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
