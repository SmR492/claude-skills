import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { parseClaims, checkRoadmap, isDoneLine } from './roadmap-drift.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Copies lib + this skill into a temp directory whose path contains a space (main-guard regression). */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'roadmap-drift'), { recursive: true });
  return { root, script: join(root, 'skills', 'roadmap-drift', 'roadmap-drift.mjs') };
}

test('parseClaims takes backtick tokens only from DONE lines (German + English markers)', () => {
  // "GESCHLOSSEN" / "offen" are the German markers real roadmaps use; "DONE" is the English equivalent.
  const md = '- ✅ `Present` built\n- 🟡 offen `NotCounted`\n- GESCHLOSSEN `Foo/Bar.php`\n- DONE `Baz`\n- nicht umgesetzt `AlsoNotCounted`';
  assert.deepEqual(parseClaims(md).map((c) => c.token), ['Present', 'Foo/Bar.php', 'Baz']);
});

test('DONE markers are whole words: ABANDONED is not DONE, unimplemented is not implemented', () => {
  assert.equal(isDoneLine('- ABANDONED `Foo`'), false);
  assert.equal(isDoneLine('- unimplemented `Foo`'), false);
  assert.equal(isDoneLine('- undelivered `Foo`'), false);
  assert.equal(isDoneLine('- done: `Foo`'), true);             // case-insensitive, punctuation after the word
  assert.equal(isDoneLine('- (implemented) `Foo`'), true);
  assert.deepEqual(parseClaims('- ABANDONED `Gone`\n- unimplemented `Later`\n- DONE `Real`').map((c) => c.token), ['Real']);
});

test('negation only counts within 20 characters before the marker (not anywhere on the line)', () => {
  // "not yet documented" refers to the docs, the artefact itself is marked ✅ + implemented → claim counts
  assert.deepEqual(parseClaims('- ✅ `App\\Real` implemented, not yet documented').map((c) => c.token), ['App\\Real']);
  assert.equal(isDoneLine('- not implemented `Foo`'), false);          // negation directly before
  assert.equal(isDoneLine('- ❌ DONE `Foo`'), false);
  assert.equal(isDoneLine('- nicht umgesetzt `Foo`'), false);
  assert.equal(isDoneLine('- TODO: write docs ------------------------- DONE `Foo`'), true);   // negation farther than 20 chars away
  assert.equal(isDoneLine('- 🟡 offen `Foo`'), false);                  // no marker at all
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
    assert.deepEqual(r.results.map((x) => x.sev), ['🟢', '🔴']);
    assert.equal(r.results[0].strength, 'declaration');
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('CLI runs from a path with a space (main guard), prints findings with severity, exit 1 on drift / 0 without', () => {
  const { root, script } = cliCopy();
  try {
    mkdirSync(join(root, 'repo', 'src'), { recursive: true });
    writeFileSync(join(root, 'repo', 'src', 'Present.php'), '<?php\nclass Present {}\n');
    const rm = join(root, 'repo', 'roadmap.md');
    writeFileSync(rm, '- ✅ `Present` is built\n- ✅ `GhostClass` allegedly built\n');
    const r = spawnSync('node', [script, `--roadmap=${rm}`, `--repo=${join(root, 'repo')}`], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /Roadmap drift — 2 claimed artefacts/);
    assert.match(r.stdout, /🔴 \[MISSING\] GhostClass/);
    assert.match(r.stdout, /🟢 \[found\] Present/);
    const j = spawnSync('node', [script, `--roadmap=${rm}`, `--repo=${join(root, 'repo')}`, '--json'], { encoding: 'utf8' });
    assert.deepEqual(JSON.parse(j.stdout).results.map((x) => x.sev), ['🟢', '🔴']);
    writeFileSync(rm, '- ✅ `Present` is built\n');
    assert.equal(spawnSync('node', [script, `--roadmap=${rm}`, `--repo=${join(root, 'repo')}`], { encoding: 'utf8' }).status, 0);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
