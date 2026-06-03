import { test } from 'node:test';
import assert from 'node:assert/strict';
import { START, END, buildBlock, findBlock, mergeBlock, computeDiff, blockInvariantError } from './nsai-init.mjs';

const VALID = '## NSAI-Edge Wissensbasis\nnsai-edge Tier-1 via graph__query_knowledge.';

test('buildBlock umschließt mit nsai-Markern', () => {
  const b = buildBlock(VALID);
  assert.ok(b.startsWith(START) && b.endsWith(END));
  assert.ok(b.includes('nsai-edge') && b.includes('graph__'));
});

test('findBlock: none / found / broken', () => {
  assert.equal(findBlock('kein marker').kind, 'none');
  assert.equal(findBlock(`x\n${START}\ninhalt\n${END}\ny`).kind, 'found');
  assert.equal(findBlock(`nur ${START} ohne ende`).kind, 'broken');
  assert.equal(findBlock(`${END} vor ${START}`).kind, 'broken');
});

test('mergeBlock: append wenn kein Marker, replace wenn vorhanden (idempotent)', () => {
  const base = '# Projekt CLAUDE\n';
  const once = mergeBlock(base, VALID);
  assert.equal(once.mode, 'append');
  assert.ok(once.md.includes(START) && once.md.includes(END));
  const twice = mergeBlock(once.md, VALID);
  assert.equal(twice.mode, 'replace');
  assert.equal(twice.md, once.md, 'idempotent — zweiter Lauf ändert nichts');
});

test('mergeBlock: cdp5-Block bleibt unberührt (eigene Marker, Koexistenz)', () => {
  const withCdp5 = '<!-- cdp5:start -->\n## CDP5 cdp5-reference\n<!-- cdp5:end -->\n';
  const merged = mergeBlock(withCdp5, VALID);
  assert.ok(merged.md.includes('<!-- cdp5:start -->'), 'cdp5-Block erhalten');
  assert.ok(merged.md.includes(START), 'nsai-Block ergänzt');
  assert.equal(merged.mode, 'append');
});

test('mergeBlock: kaputtes Marker-Paar → error, kein Write', () => {
  assert.ok(mergeBlock(`${START} ohne ende`, VALID).error);
});

test('computeDiff: noop wenn Block bereits aktuell', () => {
  const merged = mergeBlock('# x\n', VALID);
  assert.equal(computeDiff(merged.md, VALID).mode, 'noop');
});

test('blockInvariantError: nsai-edge + graph__ Pflicht', () => {
  assert.equal(blockInvariantError(VALID), null);
  assert.match(blockInvariantError('## ohne nsai\ngraph__query_knowledge'), /nsai-edge/);
  assert.match(blockInvariantError('## nsai-edge ohne tools'), /graph__/);
});
