import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Engine } from '../src/engine.mjs';
import { TOOLS } from '../src/mcp-server.mjs';

// R4 Schema-Hardening — 5 Sec-Findings gebündelt.

test('R4-F1: recordEpisode source_type Regex (^[a-z_]{1,64}$) — fail-closed', () => {
  const e = new Engine();
  assert.doesNotThrow(() => e.recordEpisode({ content: 'ok', source_type: 'manual' }));
  assert.doesNotThrow(() => e.recordEpisode({ content: 'ok', source_type: 'fachquelle' }));
  for (const bad of ['UPPER', 'mit-bindestrich', 'mit zahl9', 'a'.repeat(65), '']) {
    assert.throws(() => e.recordEpisode({ content: 'ok', source_type: bad }), /INVALID_PARAMETER_FORMAT/);
  }
});

test('R4-F1: recordEpisode context_slug Regex (^[a-z0-9_-]{1,128}$) — fail-closed', () => {
  const e = new Engine();
  assert.doesNotThrow(() => e.recordEpisode({ content: 'ok', context_slug: 'ki-vo' }));
  assert.doesNotThrow(() => e.recordEpisode({ content: 'ok', context_slug: 'test_123-abc' }));
  assert.doesNotThrow(() => e.recordEpisode({ content: 'ok', context_slug: null }));
  for (const bad of ['UPPER', 'with space', 'mit/slash', 'mit:doppel', 'a'.repeat(129)]) {
    assert.throws(() => e.recordEpisode({ content: 'ok', context_slug: bad }), /INVALID_PARAMETER_FORMAT/);
  }
});

test('R4-F2: recall_episodes MCP-Schema cappt limit (min 1, max 100)', () => {
  const tool = TOOLS.find((t) => t.name === 'graph__recall_episodes');
  assert.ok(tool);
  const limitSchema = tool.inputSchema.properties.limit;
  assert.equal(limitSchema.minimum, 1);
  assert.equal(limitSchema.maximum, 100);
  const e = new Engine();
  const r = e.recallEpisodes({ limit: 99999 });
  assert.ok(r.episodes.length <= 100);
});

test('R4-F3: graph__search Description warnt vor UNTRUSTED episodes-Content', () => {
  const tool = TOOLS.find((t) => t.name === 'graph__search');
  assert.match(tool.description, /UNTRUSTED/);
  assert.match(tool.description, /episodes/);
});

test('R4-F5: learnTrustAdjustments cappt suggestions hart bei 50 (Sybil-Schwarm-Schutz)', () => {
  const e = new Engine();
  for (let i = 0; i < 60; i++) {
    const peerId = `peer:sybil-${String(i).padStart(3, '0')}`;
    e.db.prepare('INSERT OR IGNORE INTO peers (peer_id, public_key, fingerprint, endpoint, trust_level) VALUES (?,?,?,?,?)')
      .run(peerId, `pk-${i}`, `fp-${i}`, null, 'full');
    for (let j = 0; j < 10; j++) {
      const r = e.storeTriple({ subject: `Peer${i}-S${j}`, predicate: 'ist', object: `OO${j}`, confidence: 700 });
      e.db.prepare("UPDATE knowledge_edges SET origin_peer_id=? WHERE triple_hash=?").run(peerId, r.triple_hash);
      if (j < 9) e.reject(r.triple_hash);
    }
  }
  const out = e.learnTrustAdjustments({});
  assert.equal(out.suggestions.length, 50, 'hartes Cap bei 50 Vorschlägen');
  assert.equal(out.truncated, true, 'truncated-Flag gesetzt');
  assert.equal(out.suggestions[0].peer_id, 'peer:sybil-000');
  assert.equal(out.suggestions[49].peer_id, 'peer:sybil-049');
});

test('R4-F6: storeTriple Response enthält temporality (Echo-Pattern)', () => {
  const e = new Engine();
  const r1 = e.storeTriple({ subject: 'TempA', predicate: 'ist', object: 'eternal', confidence: 800, temporality: 'eternal' });
  assert.equal(r1.temporality, 'eternal');
  const r2 = e.storeTriple({ subject: 'TempB', predicate: 'ist', object: 'default', confidence: 800 });
  assert.equal(r2.temporality, 'stable');
  const r3 = e.storeTriple({ subject: 'TempA', predicate: 'ist', object: 'eternal', confidence: 800, temporality: 'ephemeral' });
  assert.equal(r3.created, false);
  assert.equal(r3.temporality, 'eternal', 'existierende temporality dominiert bei Idempotenz-Treffer');
});

test('R4-F1: MCP graph__record_episode Schema cappt content + source_type + context_slug', () => {
  const tool = TOOLS.find((t) => t.name === 'graph__record_episode');
  assert.equal(tool.inputSchema.properties.content.maxLength, 8000);
  assert.equal(tool.inputSchema.properties.content.minLength, 1);
  assert.equal(tool.inputSchema.properties.source_type.maxLength, 64);
  assert.equal(tool.inputSchema.properties.context_slug.maxLength, 128);
});
