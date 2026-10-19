import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const SKILL = new URL('./mcp-doc-drift-gate.mjs', import.meta.url).pathname;

function tmpServer(toolsLiteral) {
  const dir = mkdtempSync(join(tmpdir(), 'mdg-'));
  const path = join(dir, 'srv.mjs');
  writeFileSync(path, `export const TOOLS = ${toolsLiteral};\n`);
  return { dir, path };
}
function cleanup(dir) { try { rmSync(dir, { recursive: true, force: true }); } catch {} }

test('AC-1: no drift — all input fields in description', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Sets subject and predicate. Returns verdict.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, predicate: {type:'string'} } },
    outputContract: ['verdict'],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('AC-2: input drift — unmentioned input field → exit 1', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Sets subject. Returns verdict.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, until: {type:'string'} } },
    outputContract: ['verdict'],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /until/);
});

test('AC-3: output drift via outputContract → exit 1', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Sets subject. Returns verdict.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'} } },
    outputContract: ['verdict', 'physical_status'],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /physical_status/);
});

test('AC-4: without outputContract → output drift NOT checked + note', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Sets subject.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'} } },
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /without outputContract/);
});

test('AC-5: word boundary — a substring must NOT count as a match', () => {
  // description mentions "predicate_x", but inputSchema asks for "predicate" — actually NO match.
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Sets subject and predicate_x.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, predicate: {type:'string'} } },
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  // 'predicate' is a substring of 'predicate_x', but the script uses an underscore-aware
  // boundary — `predicate_x` contains 'predicate' as a complete word followed by '_'. Since `_`
  // counts as part of the word, it is NOT a match → drift expected.
  assert.equal(r.status, 1);
  assert.match(r.stdout, /predicate/);
});

test('AC-6: non-existent path → exit 2', () => {
  const r = spawnSync('node', [SKILL, '--mcp=/tmp/does-not-exist-12345.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('AC-7: no --mcp → exit 2 with usage', () => {
  const r = spawnSync('node', [SKILL], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});

test('AC-8: JSON mode returns machine-readable format', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Sets subject.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, missing: {type:'string'} } },
    outputContract: [],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`, '--json'], { encoding: 'utf8' });
  cleanup(dir);
  const out = JSON.parse(r.stdout);
  assert.equal(out.tools_checked, 1);
  assert.equal(out.findings.length, 1);
  assert.equal(out.findings[0].kind, 'input');
});

test('AC-9: TOOLS not exported → exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mdg-'));
  const path = join(dir, 'srv.mjs');
  writeFileSync(path, 'export const NOT_TOOLS = [];\n');
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 2);
});

test('AC-10: multi-tool — all tools are checked', () => {
  const { dir, path } = tmpServer(`[
    { name: 'a', description: 'with subject', inputSchema: { type: 'object', properties: { subject: {} } } },
    { name: 'b', description: 'with subject', inputSchema: { type: 'object', properties: { subject: {}, hidden: {} } } },
  ]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /b — Input field `hidden`/);
});
