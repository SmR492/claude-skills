import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeBlock, computeDiff, blockInvariantError, START, END } from './cdp5-init.mjs';

const BLOCK = 'CDP5-Doktrin; cdp5-reference-Gate.';   // erfüllt Invariante
const script = join(dirname(fileURLToPath(import.meta.url)), 'cdp5-init.mjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'ci-'));

test('mergeBlock hängt an, wenn kein Marker da ist (Bestand unverändert)', () => {
  const r = mergeBlock('# CLAUDE.md\nText\n', BLOCK);
  assert.equal(r.mode, 'append');
  assert.ok(r.md.includes(START) && r.md.includes(END));
  assert.ok(r.md.startsWith('# CLAUDE.md\nText\n'));
});

test('mergeBlock ersetzt Block, Inhalt außerhalb byte-identisch (UC-02 AC-1)', () => {
  const r = mergeBlock(`vorher\n${START}\nALT\n${END}\nnachher\n`, BLOCK);
  assert.equal(r.mode, 'replace');
  assert.ok(r.md.startsWith('vorher\n') && r.md.endsWith('\nnachher\n'));
  assert.ok(!r.md.includes('ALT'));
});

test('mergeBlock ist idempotent (UC-04 AC-1)', () => {
  const once = mergeBlock('Basis\n', BLOCK).md;
  assert.equal(once, mergeBlock(once, BLOCK).md);
});

test('inkonsistentes Marker-Paar → error, kein Merge (UC-04 AC-2)', () => {
  assert.match(mergeBlock(`x\n${START}\nohne ende\n`, BLOCK).error, /inkonsistent/);
  assert.match(mergeBlock(`${END}\n${START}\n`, BLOCK).error, /inkonsistent/);
});

test('computeDiff: noop wenn bereits aktuell', () => {
  assert.equal(computeDiff(mergeBlock('b\n', BLOCK).md, BLOCK).mode, 'noop');
});

test('blockInvariantError: ohne Gate/Verweis → Meldung, sonst null (UC-03 Reject)', () => {
  assert.match(blockInvariantError('nur text'), /CDP5-Verweis fehlt/);
  assert.match(blockInvariantError('CDP5 ohne gate'), /cdp5-reference-Gate fehlt/);
  assert.equal(blockInvariantError(BLOCK), null);
});

test('Default-Block cdp5-block.md erfüllt Invariante + enthält Gate (Dim-6-Polish)', () => {
  const def = readFileSync(join(dirname(script), 'cdp5-block.md'), 'utf8');
  assert.equal(blockInvariantError(def), null);
  assert.match(def, /cdp5-reference/);
});

test('CLI Default ist read-only: --diff schreibt nicht (UC-01 AC-1)', () => {
  const f = join(tmp(), 'CLAUDE.md');
  writeFileSync(f, '# Bestand\n');
  execFileSync('node', [script, `--target=${f}`], { stdio: 'pipe' });
  assert.equal(readFileSync(f, 'utf8'), '# Bestand\n');
});

test('CLI --write schreibt + zweiter Lauf idempotent (UC-02/UC-04)', () => {
  const f = join(tmp(), 'CLAUDE.md');
  writeFileSync(f, '# Bestand\n');
  execFileSync('node', [script, `--target=${f}`, '--write'], { stdio: 'pipe' });
  const after1 = readFileSync(f, 'utf8');
  assert.ok(after1.includes(START) && after1.includes('cdp5-reference'));
  execFileSync('node', [script, `--target=${f}`, '--write'], { stdio: 'pipe' });
  assert.equal(readFileSync(f, 'utf8'), after1);
});

test('CLI --target=<Verzeichnis> → Exit 2', () => {
  let code = 0;
  try { execFileSync('node', [script, `--target=${tmp()}`], { stdio: 'pipe' }); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});

test('CLI --block mit Invarianten-Verletzung → Exit 2 (KI-Reject, UC-03)', () => {
  const d = tmp(); const f = join(d, 'CLAUDE.md'); const bad = join(d, 'bad.md');
  writeFileSync(f, '# x\n'); writeFileSync(bad, 'freitext ohne gate');
  let code = 0;
  try { execFileSync('node', [script, `--target=${f}`, `--block=${bad}`], { stdio: 'pipe' }); } catch (e) { code = e.status; }
  assert.equal(code, 2);
});
