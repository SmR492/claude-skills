import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, readdirSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeBlock, computeDiff, blockInvariantError, START, END } from './cdp5-init.mjs';

const BLOCK = 'CDP5 doctrine; cdp5-reference gate.';   // satisfies the invariant
const HERE = dirname(fileURLToPath(import.meta.url));
const script = join(HERE, 'cdp5-init.mjs');
const tmp = () => mkdtempSync(join(tmpdir(), 'ci-'));

/** Copies lib + this skill (incl. cdp5-block.md) into a temp directory whose path contains a space. */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'cdp5-init'), { recursive: true });
  return { root, script: join(root, 'skills', 'cdp5-init', 'cdp5-init.mjs') };
}

test('default block lists every cdp5-gates skill (incl. skill-lint) and every cdp5-agents agent in two groups', () => {
  const def = readFileSync(join(HERE, 'cdp5-block.md'), 'utf8');
  const gatesLine = def.split('\n').find((l) => l.startsWith('- **`cdp5-gates`**'));
  assert.ok(gatesLine, 'cdp5-gates tools line present');
  assert.match(gatesLine, /read-only — exception: `cdp5-init --write` after confirmation/);
  const skillDirs = readdirSync(join(HERE, '..')).filter((d) => !d.startsWith('.'));
  for (const s of skillDirs) assert.ok(gatesLine.includes(s), `cdp5-gates line lists ${s}`);
  assert.match(def, /\| Before installing a plugin \/ after writing a skill or agent \| `skill-lint` \|/);
  const agentFiles = readdirSync(join(HERE, '..', '..', '..', 'cdp5-agents', 'agents')).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''));
  assert.equal(agentFiles.length, 12);
  const judgment = def.split('\n').find((l) => /cdp5-agents.*judgment \(read-only\)/.test(l));
  const workers = def.split('\n').find((l) => /cdp5-agents.*implementation workers \(write in their worktree, no commit\)/.test(l));
  assert.ok(judgment && workers, 'two agent groups');
  for (const a of agentFiles) assert.ok(judgment.includes(a) || workers.includes(a), `agent ${a} listed`);
  for (const w of ['impl-uc', 'impl-debug', 'impl-refactor']) assert.ok(workers.includes(w) && !judgment.includes(w), `${w} is a worker`);
});

test('CLI runs from a path with a space (main guard): preview prints the diff and writes nothing', () => {
  const { root, script: copied } = cliCopy();
  try {
    const f = join(root, 'CLAUDE.md');
    writeFileSync(f, '# Existing\n');
    const r = spawnSync('node', [copied, `--target=${f}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /cdp5-init \(preview, append\)/);
    assert.match(r.stdout, /\+ <!-- cdp5:start -->/);
    assert.equal(readFileSync(f, 'utf8'), '# Existing\n');
    assert.equal(spawnSync('node', [copied], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

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
