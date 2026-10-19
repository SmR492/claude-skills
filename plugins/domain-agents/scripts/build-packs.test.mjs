import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseEntry, render, buildPack, redact, slugFor, applyOverrides } from './build-packs.mjs';

test('overrides replace person-specific passages per ref without naming them in the repo', () => {
  const e = parseEntry(rawEntry('PSY:modus-trennung', 'Modes', 'Rule.', ['Individual mode (to Alice: short; to Bob: factual).', 'Couple mode.']));
  const overrides = { 'PSY:modus-trennung': [['\\(to .*?\\)', '(per the private communication rule of the person)']] };
  const md = render(e, [], overrides);
  assert.doesNotMatch(md, /Alice|Bob/);
  assert.match(md, /per the private communication rule/);
  assert.match(md, /Couple mode\./);
  assert.equal(applyOverrides('x', []), 'x');
});

function rawEntry(ref, title, summary, points, source = 'business-lingo-guide Seite 24') {
  const inner = { ref, title, category: 'framework', body: { summary, points, quelle: source }, version: 1 };
  return JSON.stringify({
    art: 'dokument', id: `riedl/nsai/doktrin/${ref.replace(':', '-')}.json`, fassung: 1,
    herkunft: { quelle: `nsai-app MCP, cdp_doctrine, kb_version 1, Quelle ${source}, abgerufen 2026-09-02` },
    text: `<<<nsai:abc id="x" vertrauen="system">>>\n${JSON.stringify(inner)}\n<<<nsai:abc:ende>>>`,
  });
}

test('parseEntry strips markers and reads ref, title, summary, points, source', () => {
  const e = parseEntry(rawEntry('BL:swot-analysis', 'SWOT analysis', 'A tool.', ['Strengths', 'Weaknesses']));
  assert.equal(e.ref, 'BL:swot-analysis');
  assert.equal(e.title, 'SWOT analysis');
  assert.equal(e.summary, 'A tool.');
  assert.deepEqual(e.points, ['Strengths', 'Weaknesses']);
  assert.equal(e.source, 'business-lingo-guide Seite 24');
  assert.equal(slugFor(e.ref), 'swot-analysis');
});

test('render marks provenance as unverified and redacts names everywhere', () => {
  const e = parseEntry(rawEntry('PSY:x', 'Visit Dr Mustermann', 'Mustermann advises.', ['Call Mustermann first']));
  const md = render(e, ['Mustermann']);
  assert.match(md, /unverified/);
  assert.doesNotMatch(md, /Mustermann/);
  assert.match(md, /\[Person\]/);
  assert.equal(redact('no names here', ['Mustermann']), 'no names here');
  assert.equal(redact('MUSTERMANN and mustermann', ['Mustermann']), '[Person] and [Person]', 'case variants are redacted too');
});

test('buildPack writes one file per entry plus INDEX.md, filters by refs and reports missing', () => {
  const root = mkdtempSync(join(tmpdir(), 'packs-'));
  const src = join(root, 'raw');
  mkdirSync(src);
  writeFileSync(join(src, 'BL-a.json.json'), rawEntry('BL:a', 'A', 'sa', ['p1']));
  writeFileSync(join(src, 'BL-b.json.json'), rawEntry('BL:b', 'B', 'sb', []));
  writeFileSync(join(src, 'UX-c.json.json'), rawEntry('UX:c', 'C', 'sc', []));
  try {
    const all = buildPack({ source: src, prefix: 'BL', out: join(root, 'bl') });
    assert.equal(all.count, 2);
    assert.deepEqual(all.missing, []);
    assert.ok(existsSync(join(root, 'bl', 'a.md')));
    assert.ok(existsSync(join(root, 'bl', 'b.md')));
    assert.ok(!existsSync(join(root, 'bl', 'c.md')));
    assert.match(readFileSync(join(root, 'bl', 'INDEX.md'), 'utf8'), /\| `BL:a` \| A \| framework \| \[a\.md\]/);
    const some = buildPack({ source: src, prefix: 'BL', out: join(root, 'bl2'), refs: ['BL:a', 'BL:zzz'] });
    assert.equal(some.count, 1);
    assert.deepEqual(some.missing, ['BL:zzz']);
    const again = buildPack({ source: src, prefix: 'BL', out: join(root, 'bl') });
    assert.equal(readFileSync(join(root, 'bl', 'a.md'), 'utf8'), readFileSync(join(root, 'bl', 'a.md'), 'utf8'), 'deterministic');
    assert.equal(again.count, 2);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
