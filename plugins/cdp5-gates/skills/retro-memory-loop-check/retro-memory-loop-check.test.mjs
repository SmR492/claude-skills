import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync, copyFileSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkLoop } from './retro-memory-loop-check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

test('UC-02: --retro is a file instead of a directory → exit 2, no ENOTDIR crash', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-enotdir-'));
  const file = join(base, 'single.md');
  writeFileSync(file, '[[feedback_x]]');
  mkdirSync(join(base, 'mem'));
  const script = join(HERE, 'retro-memory-loop-check.mjs');
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
    writeFileSync(join(retro, 'r1.md'), 'Lesson [[feedback_good]] and `feedback_ghost` and [[project_done]].');
    writeFileSync(join(mem, 'feedback_good.md'), 'x');         // file + pointer → ok
    writeFileSync(join(mem, 'project_done.md'), 'x');          // file, but NO pointer → broken
    writeFileSync(join(mem, 'MEMORY.md'), '- [Good](feedback_good.md) — hook\n'); // only feedback_good linked
    const r = checkLoop(retro, mem);
    const slugs = r.findings.filter((f) => f.kind === 'slug').map((f) => f.slug).sort();
    assert.deepEqual(slugs, ['feedback_ghost', 'project_done']);   // ghost: no file; project_done: no pointer
    assert.ok(!slugs.includes('feedback_good'));
    assert.ok(r.findings.filter((f) => f.kind === 'slug').every((f) => f.sev === '🔴'));
    assert.equal(r.broken, true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('bare `project_*` identifiers in prose are not citations; backticks, [[…]] and (…slug.md) links are', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-'));
  try {
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    writeFileSync(join(retro, 'r1.md'), [
      'The project_root variable and reference_count were wrong.',          // bare words → ignored
      'See `feedback_tick` and [[project_alpha]] and [x](../memory/reference_beta.md).',
    ].join('\n'));
    for (const s of ['feedback_tick', 'project_alpha', 'reference_beta']) writeFileSync(join(mem, `${s}.md`), 'x');
    writeFileSync(join(mem, 'MEMORY.md'), '- [t](feedback_tick.md)\n- [a](./project_alpha.md)\n- [b](reference_beta.md)\n');
    const r = checkLoop(retro, mem);
    assert.equal(r.cited, 3);
    assert.deepEqual(r.findings, []);
    assert.equal(r.broken, false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('MEMORY.md pointer requires a markdown link — a bare mention is not enough', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-'));
  try {
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    writeFileSync(join(retro, 'r1.md'), 'Lesson `feedback_bare`.');
    writeFileSync(join(mem, 'feedback_bare.md'), 'x');
    writeFileSync(join(mem, 'MEMORY.md'), 'see feedback_bare for details (feedback_bare.md)\n');   // mention, no link
    const r = checkLoop(retro, mem);
    const f = r.findings.find((x) => x.slug === 'feedback_bare');
    assert.ok(f);
    assert.equal(f.fileExists, true);
    assert.equal(f.hasPointer, false);
    assert.equal(r.broken, true);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('retro without any cited slug and without `no new lesson:` → 🟡, does not gate', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-'));
  try {
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    writeFileSync(join(retro, 'empty.md'), '# Retro\nWe talked. Nothing written down.');
    writeFileSync(join(retro, 'declared.md'), '# Retro\n- no new lesson: routine sprint, nothing to promote.');
    writeFileSync(join(mem, 'MEMORY.md'), '');
    const r = checkLoop(retro, mem);
    assert.deepEqual(r.findings.map((f) => [f.sev, f.kind, f.file]), [['🟡', 'no-lesson', 'empty.md']]);
    assert.equal(r.broken, false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('two retros with the same four-digit number → 🟡 numbering finding, does not gate', () => {
  const base = mkdtempSync(join(tmpdir(), 'rm-'));
  try {
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    for (const f of ['0001-a.md', '0001-b.md', '0002-c.md']) writeFileSync(join(retro, f), '- no new lesson: fixture.');
    writeFileSync(join(mem, 'MEMORY.md'), '');
    const r = checkLoop(retro, mem);
    const n = r.findings.filter((f) => f.kind === 'numbering');
    assert.equal(n.length, 1);
    assert.equal(n[0].sev, '🟡');
    assert.match(n[0].file, /0001-a\.md, 0001-b\.md/);
    assert.equal(r.broken, false);
  } finally { rmSync(base, { recursive: true, force: true }); }
});

test('CLI: runs from a path containing a space and prints output', () => {
  const base = mkdtempSync(join(tmpdir(), 'cdp5 gates '));
  try {
    cpSync(resolve(HERE, '../../lib'), join(base, 'lib'), { recursive: true });
    const skillDir = join(base, 'skills', 'retro-memory-loop-check');
    mkdirSync(skillDir, { recursive: true });
    copyFileSync(join(HERE, 'retro-memory-loop-check.mjs'), join(skillDir, 'retro-memory-loop-check.mjs'));
    const retro = join(base, 'retro'); const mem = join(base, 'memory');
    mkdirSync(retro); mkdirSync(mem);
    writeFileSync(join(retro, 'r.md'), 'Lesson `feedback_missing`.');
    writeFileSync(join(mem, 'MEMORY.md'), '');
    const r = spawnSync('node', [join(skillDir, 'retro-memory-loop-check.mjs'), `--retro=${retro}`, `--memory=${mem}`], { encoding: 'utf8' });
    assert.match(r.stdout, /retro→memory loop — 1 cited slugs/);
    assert.match(r.stdout, /🔴 feedback_missing/);
    assert.equal(r.status, 1);
  } finally { rmSync(base, { recursive: true, force: true }); }
});
