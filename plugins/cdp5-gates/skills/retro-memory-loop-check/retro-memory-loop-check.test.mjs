import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkLoop } from './retro-memory-loop-check.mjs';

test('UC-02: --retro is a file instead of a directory → exit 2, no ENOTDIR crash', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-enotdir-'));
  const file = join(base, 'single.md');
  writeFileSync(file, '[[feedback_x]]');
  mkdirSync(join(base, 'mem'));
  const script = join(dirname(fileURLToPath(import.meta.url)), 'retro-memory-loop-check.mjs');
  let code = 0, err = '';
  try { execFileSync('node', [script, `--retro=${file}`, `--memory=${join(base, 'mem')}`], { stdio: 'pipe' }); }
  catch (e) { code = e.status; err = String(e.stderr); }
  assert.equal(code, 2);
  assert.doesNotMatch(err, /ENOTDIR|scandir/);   // clean contract error, no raw stack trace
});

test('detects cited slug without file/pointer, ignores complete ones', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-'));
  try {
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    writeFileSync(join(retro, 'r1.md'), 'Lesson [[feedback_good]] and feedback_ghost and [[project_done]].');
    writeFileSync(join(mem, 'feedback_good.md'), 'x');         // file + pointer → ok
    writeFileSync(join(mem, 'project_done.md'), 'x');          // file, but NO pointer → broken
    writeFileSync(join(mem, 'MEMORY.md'), '- [Good](feedback_good.md) — hook\n'); // only feedback_good linked
    const r = checkLoop(retro, mem);
    const slugs = r.findings.map((f) => f.slug).sort();
    assert.deepEqual(slugs, ['feedback_ghost', 'project_done']);   // ghost: no file; project_done: no pointer
    assert.ok(!slugs.includes('feedback_good'));
    assert.equal(r.broken, true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
