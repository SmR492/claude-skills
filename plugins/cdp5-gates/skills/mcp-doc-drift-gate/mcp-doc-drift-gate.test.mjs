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

test('AC-1: keine Drift — alle Input-Felder in description', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Setzt subject und predicate. Liefert verdict.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, predicate: {type:'string'} } },
    outputContract: ['verdict'],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 0, r.stdout + r.stderr);
});

test('AC-2: Input-Drift — unerwähntes Input-Feld → Exit 1', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Setzt subject. Liefert verdict.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, until: {type:'string'} } },
    outputContract: ['verdict'],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /until/);
});

test('AC-3: Output-Drift via outputContract → Exit 1', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Setzt subject. Liefert verdict.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'} } },
    outputContract: ['verdict', 'physical_status'],
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /physical_status/);
});

test('AC-4: ohne outputContract → Output-Drift NICHT geprüft + Hinweis', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Setzt subject.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'} } },
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 0);
  assert.match(r.stdout, /ohne outputContract/);
});

test('AC-5: Wortgrenze — Substring darf NICHT als Match zählen', () => {
  // description erwähnt "predicate_x", aber inputSchema fragt nach "predicate" — eigentlich KEIN Match.
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Setzt subject und predicate_x.',
    inputSchema: { type: 'object', properties: { subject: {type:'string'}, predicate: {type:'string'} } },
  }]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  // 'predicate' ist Substring von 'predicate_x', aber das Skript nutzt eine Underscore-tolerante
  // Boundary — `predicate_x` enthält 'predicate' als komplettes Wort gefolgt von '_'. Da `_` als
  // Wortbestandteil zählt, ist es KEIN Match → Drift erwartet.
  assert.equal(r.status, 1);
  assert.match(r.stdout, /predicate/);
});

test('AC-6: nicht-existenter Pfad → Exit 2', () => {
  const r = spawnSync('node', [SKILL, '--mcp=/tmp/does-not-exist-12345.mjs'], { encoding: 'utf8' });
  assert.equal(r.status, 2);
});

test('AC-7: kein --mcp → Exit 2 mit Usage', () => {
  const r = spawnSync('node', [SKILL], { encoding: 'utf8' });
  assert.equal(r.status, 2);
  assert.match(r.stderr, /Usage/);
});

test('AC-8: JSON-Modus liefert maschinelles Format', () => {
  const { dir, path } = tmpServer(`[{
    name: 'foo',
    description: 'Setzt subject.',
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

test('AC-9: TOOLS nicht exportiert → Exit 2', () => {
  const dir = mkdtempSync(join(tmpdir(), 'mdg-'));
  const path = join(dir, 'srv.mjs');
  writeFileSync(path, 'export const NOT_TOOLS = [];\n');
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 2);
});

test('AC-10: Multi-Tool — alle Tools werden geprüft', () => {
  const { dir, path } = tmpServer(`[
    { name: 'a', description: 'mit subject', inputSchema: { type: 'object', properties: { subject: {} } } },
    { name: 'b', description: 'mit subject', inputSchema: { type: 'object', properties: { subject: {}, hidden: {} } } },
  ]`);
  const r = spawnSync('node', [SKILL, `--mcp=${path}`], { encoding: 'utf8' });
  cleanup(dir);
  assert.equal(r.status, 1);
  assert.match(r.stdout, /b — Input-Feld `hidden`/);
});
