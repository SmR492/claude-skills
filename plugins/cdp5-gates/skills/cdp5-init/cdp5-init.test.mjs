import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeBlock, computeDiff, blockInvariantError, START, END } from './cdp5-init.mjs';

const BLOCK = 'CDP5 doctrine; cdp5-reference gate.';   // satisfies the invariant
const script = join(dirname(fileURLToPath(import.meta.url)), 'cdp5-init.mjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'ci-'));

test('mergeBlock appends when no marker is present (existing content unchanged)', () => {
  const r = mergeBlock('# CLAUDE.md\nText\n', BLOCK);
  assert.equal(r.mode, 'append');
  assert.ok(r.md.includes(START) && r.md.includes(END));
  assert.ok(r.md.startsWith('# CLAUDE.md\nText\n'));
});

test('mergeBlock replaces the block, content outside is byte-identical (UC-02 AC-1)', () => {
  const r = mergeBlock(`before\n${START}\nOLD\n${END}\nafter\n`, BLOCK);
  assert.equal(r.mode, 'replace');
  assert.ok(r.md.startsWith('before\n') && r.md.endsWith('\nafter\n'));
  assert.ok(!r.md.includes('OLD'));
});

test('mergeBlock is idempotent (UC-04 AC-1)', () => {
  const once = mergeBlock('Base\n', BLOCK).md;
  assert.equal(once, mergeBlock(once, BLOCK).md);
});

test('inconsistent marker pair → error, no merge (UC-04 AC-2)', () => {
  assert.match(mergeBlock(`x\n${START}\nno end\n`, BLOCK).error, /inconsistent/);
  assert.match(mergeBlock(`${END}\n${START}\n`, BLOCK).error, /inconsistent/);
});

test('computeDiff: noop when already up to date', () => {
  assert.equal(computeDiff(mergeBlock('b\n', BLOCK).md, BLOCK).mode, 'noop');
});

test('blockInvariantError: without gate/reference → message, otherwise null (UC-03 reject)', () => {
  assert.match(blockInvariantError('just text'), /CDP5 reference missing/);
  assert.match(blockInvariantError('CDP5 without gate'), /cdp5-reference gate missing/);
  assert.equal(blockInvariantError(BLOCK), null);
});

test('default block cdp5-block.md satisfies the invariant + contains the gate (dim-6 polish)', () => {
  const def = readFileSync(join(dirname(script), 'cdp5-block.md'), 'utf8');
  assert.equal(blockInvariantError(def), null);
  assert.match(def, /cdp5-reference/);
});

test('CLI default is read-only: --diff does not write (UC-01 AC-1)', () => {
  const f = join(tmp(), 'CLAUDE.md');
  writeFileSync(f, '# Existing\n');
  execFileSync('node', [script, `--target=${f}`], { stdio: 'pipe' });
  assert.equal(readFileSync(f, 'utf8'), '# Existing\n');
});

test('CLI --write writes + second run is idempotent (UC-02/UC-04)', () => {
  const f = join(tmp(), 'CLAUDE.md');
  writeFileSync(f, '# Existing\n');
  execFileSync('node', [script, `--target=${f}`, '--write'], { stdio: 'pipe' });
  const after1 = readFileSync(f, 'utf8');
  assert.ok(after1.includes(START) && after1.includes('cdp5-reference'));
  execFileSync('node', [script, `--target=${f}`, '--write'], { stdio: 'pipe' });
  assert.equal(readFileSync(f, 'utf8'), after1);
});

test('CLI --target=<directory> → exit 2', () => {
  let code = 0;
  try { execFileSync('node', [script, `--target=${tmp()}`], { stdio: 'pipe' }); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});

test('CLI --block with an invariant violation → exit 2 (AI reject, UC-03)', () => {
  const d = tmp(); const f = join(d, 'CLAUDE.md'); const bad = join(d, 'bad.md');
  writeFileSync(f, '# x\n'); writeFileSync(bad, 'free text without gate');
  let code = 0;
  try { execFileSync('node', [script, `--target=${f}`, `--block=${bad}`], { stdio: 'pipe' }); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});
