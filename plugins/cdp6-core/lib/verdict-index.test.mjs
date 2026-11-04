import test from 'node:test';
import assert from 'node:assert/strict';
import { tempDir } from '../test-support/temp-dir.mjs';
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BLOCKING, CLASSES, IndexError, PASSING, hasItem, indexPath, isDevilsAdvocate, objectionItems, parseItem, premiseItems, readIndex, scopedObjection, scopedPremise, unclearedItems,
} from './verdict-index.mjs';

function stateWith(text) {
  const S = tempDir('cdp6-vi-');
  if (text !== undefined) {
    mkdirSync(join(S, 'verdicts'));
    writeFileSync(join(S, 'verdicts', 'index.jsonl'), text);
  }
  return S;
}

function codeOf(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof IndexError, String(e));
    return e.code;
  }
  return null;
}

test('the verdict classes and their pass and block subsets are defined once', () => {
  assert.deepEqual(CLASSES, ['a', 'a-with-conditions', 'b', 'c', 'not-decidable']);
  assert.deepEqual([...PASSING], ['a', 'a-with-conditions']);
  assert.deepEqual([...BLOCKING], ['b', 'c']);
});

test('readIndex of a missing index is empty, of a valid one the lines, of an unreadable or malformed one throws index-unreadable', () => {
  assert.deepEqual(readIndex(stateWith()), []);
  assert.deepEqual(readIndex(stateWith('{"id":"x"}\n\n{"id":"y"}')), [{ id: 'x' }, { id: 'y' }]);
  for (const text of ['not json\n', '{"a":1}\nnot json\n', '[1]\n', '3\n', 'null\n']) assert.equal(codeOf(() => readIndex(stateWith(text))), 'index-unreadable', text);
  const S = stateWith();
  mkdirSync(join(S, 'verdicts', 'index.jsonl'), { recursive: true });
  assert.equal(codeOf(() => readIndex(S)), 'index-unreadable');
  assert.equal(indexPath('/s'), join('/s', 'verdicts', 'index.jsonl'));
});

test('item ids are built and parsed in the three formats only', () => {
  assert.equal(scopedObjection('D-1-devils-advocate-a1', 'F-P2-3'), 'D-1-devils-advocate-a1:F-P2-3');
  assert.equal(scopedPremise('D-1-devils-advocate-a1', 2), 'D-1-devils-advocate-a1:premise-2');
  assert.deepEqual(parseItem('D-1-devils-advocate-a1:F-P2-3'), { captureId: 'D-1-devils-advocate-a1', kind: 'objection', local: 'F-P2-3' });
  assert.deepEqual(parseItem('D-1-devils-advocate-a1:premise-2'), { captureId: 'D-1-devils-advocate-a1', kind: 'premise', local: 2 });
  for (const bad of ['F-P1-1', 'X-1', ':F-P1-1', ':premise-1', 'a/b:F-P1-1', '../x:premise-1', 'a b:F-P1-1', 'a$b:premise-1', 'a:b:F-P1-1', 'a:b:premise-1', 'a:F-P9-1', 'a:F-P1-', 'a:F-P1-x', 'a:premise-', 'a:premise-x', 'a:F-P1-1 ', '', undefined, 5]) {
    assert.equal(parseItem(bad), null, String(bad));
  }
});

test('items of a capture are its scoped objections and its premises, and hasItem looks them up on the index lines', () => {
  const c = { id: 'D-1-devils-advocate-a1', objections: ['F-P1-1', 'F-P2-1'], premises: ['D-1-devils-advocate-a1:premise-1'] };
  assert.deepEqual(objectionItems(c), ['D-1-devils-advocate-a1:F-P1-1', 'D-1-devils-advocate-a1:F-P2-1']);
  assert.deepEqual(premiseItems(c), ['D-1-devils-advocate-a1:premise-1']);
  assert.deepEqual(objectionItems({ id: 'x' }), []);
  assert.deepEqual(premiseItems({ id: 'x' }), []);
  const index = [c, { id: 'D-2-devils-advocate-a2', objections: ['F-P1-1'], premises: [] }];
  for (const id of ['D-1-devils-advocate-a1:F-P1-1', 'D-1-devils-advocate-a1:premise-1', 'D-2-devils-advocate-a2:F-P1-1']) assert.equal(hasItem(index, id), true, id);
  for (const id of ['D-2-devils-advocate-a2:F-P2-1', 'D-1-devils-advocate-a1:premise-2', 'D-3-x:F-P1-1', 'F-P1-1', 'D-1-devils-advocate-a1:premise-0']) assert.equal(hasItem(index, id), false, id);
});

test('isDevilsAdvocate is true only for the cdp6-core devils-advocate agent type', () => {
  assert.equal(isDevilsAdvocate({ agent_type: 'cdp6-core:devils-advocate' }), true);
  for (const t of ['cdp6-core:review-verify', 'cdp5-agents:devils-advocate', undefined, 5]) assert.equal(isDevilsAdvocate({ agent_type: t }), false, String(t));
});

test('unclearedItems lists the items without an object record, and with rejectOnly those without a reject record', () => {
  const items = ['c1:F-P1-1', 'c1:premise-1', 'c2:F-P1-1'];
  const rec = (id, verdict) => ({ kind: 'object', id, verdict, why: 'x', decider: 'owner', at: 't' });
  assert.deepEqual(unclearedItems(items, []), items);
  assert.deepEqual(unclearedItems(items, undefined), items);
  assert.deepEqual(unclearedItems(items, [rec('c1:F-P1-1', 'accept'), rec('c1:premise-1', 'reject')]), ['c2:F-P1-1']);
  assert.deepEqual(unclearedItems(items, [rec('c1:F-P1-1', 'accept'), rec('c1:premise-1', 'reject')], { rejectOnly: true }), ['c1:F-P1-1', 'c2:F-P1-1']);
  assert.deepEqual(unclearedItems(items, [rec('F-P1-1', 'reject'), { kind: 'decision', id: 'c2:F-P1-1', verdict: 'reject' }]), items);
});

test('the index reader, the verdict classes and the item id patterns exist in lib/verdict-index.mjs only', () => {
  const root = dirname(dirname(fileURLToPath(import.meta.url)));
  const files = ['lib', 'checks', 'scripts', 'hooks'].flatMap((d) => readdirSync(join(root, d)).filter((n) => n.endsWith('.mjs') && !n.endsWith('.test.mjs')).map((n) => join(d, n)));
  const forbidden = [/index\.jsonl/, /'a-with-conditions'/, /new Set\(\['b'/, /F-P\[1-8\]/, /premise-\$\{/, /premise-\(/];
  const hits = [];
  for (const f of files) {
    if (f === join('lib', 'verdict-index.mjs')) continue;
    const text = readFileSync(join(root, f), 'utf8');
    for (const re of forbidden) if (re.test(text)) hits.push(`${f}: ${re}`);
  }
  assert.deepEqual(hits, []);
});
