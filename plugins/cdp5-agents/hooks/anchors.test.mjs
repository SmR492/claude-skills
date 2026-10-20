import { fileURLToPath } from 'node:url';
// Citation integrity (retro 0020, RC2): every doctrine anchor `§N(.N)*` that an agent file or a SKILL.md of this
// marketplace cites must exist in the bundled doctrine copy as a heading, or be listed in its redirect table as
// knowledge-layer-only. A dangling anchor makes a brief unanswerable; the check is decidable, so it is a test.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PLUGINS = join(fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, ''), '..');
const DOCTRINE = join(PLUGINS, 'cdp5-gates', 'skills', 'cdp5-reference', 'konzept-design-pattern-v6.md');
const ANCHOR = /§\s?(\d+(?:\.\d+)*)/g;

export function doctrineAnchors(md) {
  const known = new Set();
  const redirected = new Set();
  let inRedirect = false;
  for (const line of md.split('\n')) {
    const h = /^(#{1,4})\s+(.*)$/.exec(line);
    if (h) {
      inRedirect = /redirect/i.test(h[2]);
      // "## 10.6 / 10.7 / 19 — Verification" carries three anchors; "## 2. Mandatory Structure" carries one.
      const head = h[2].split(/\s[—–-]\s/)[0];
      for (const tok of head.split(/[\s/,+]+/)) {
        const m = /^§?(\d+(?:\.\d+)*)\.?$/.exec(tok);
        if (m) known.add(m[1]);
      }
      continue;
    }
    if (inRedirect && line.startsWith('|')) for (const m of line.matchAll(ANCHOR)) redirected.add(m[1]);
  }
  return { known, redirected };
}

function citingFiles() {
  const out = [];
  for (const plugin of readdirSync(PLUGINS)) {
    const agents = join(PLUGINS, plugin, 'agents');
    if (existsSync(agents)) for (const f of readdirSync(agents)) if (f.endsWith('.md')) out.push(join(agents, f));
    const skills = join(PLUGINS, plugin, 'skills');
    if (existsSync(skills)) for (const s of readdirSync(skills)) {
      const p = join(skills, s, 'SKILL.md');
      if (existsSync(p)) out.push(p);
    }
  }
  return out;
}

// An anchor that is only in the redirect table (knowledge layer) is not answerable from the copy either: a brief
// would have to carry an Orbit excerpt that nobody can fetch until the knowledge layer is connected, and an anchor
// number can mean something else in Orbit than a reader expects (devils-advocate pass on v6.0, O1). Agents and
// skills therefore cite only anchors the copy defines.
export function danglingAnchors(files, { known, redirected }) {
  const dangling = [];
  for (const file of files) {
    const lines = readFileSync(file, 'utf8').split('\n');
    lines.forEach((line, i) => {
      for (const m of line.matchAll(ANCHOR)) {
        const ref = m[1];
        if (known.has(ref)) continue;
        const why = redirected.has(ref) ? 'knowledge layer only' : 'not in the copy';
        dangling.push(`${file.slice(PLUGINS.length + 1)}:${i + 1} §${ref} (${why})`);
      }
    });
  }
  return dangling;
}

test('the anchor parser reads multi-anchor headings and the redirect table', () => {
  const md = '## 10.6 / 10.7 / 19 — Verification\n### 32.3 Model Choice\n## 7. Checklist\n### Anchor Moves (Redirect Table)\n| §35.2 | knowledge layer only |\n## 26. Changelog\n';
  const { known, redirected } = doctrineAnchors(md);
  for (const a of ['10.6', '10.7', '19', '32.3', '7', '26']) assert.ok(known.has(a), a);
  assert.ok(redirected.has('35.2'));
  assert.ok(!known.has('35.2'));
});

test('a fixture citing a missing paragraph is caught (red-first control)', () => {
  const anchors = doctrineAnchors(readFileSync(DOCTRINE, 'utf8'));
  assert.ok(!anchors.known.has('99.9'));
  for (const a of ['32.20', '32.21', '32.22', '32.23', '32.24', '32.25', '27.1.1', '35.1', '32.6.1', '1.11']) assert.ok(anchors.known.has(a), `v6 anchor §${a} is known`);
  for (const a of ['32.11', '32.12', '32.13', '32.14', '32.15', '32.16', '32.17', '32.19', '35.2']) {
    assert.ok(!anchors.known.has(a), `§${a} must not be redefined in the copy (it means something else in Orbit)`);
    assert.ok(anchors.redirected.has(a), `§${a} is listed in the redirect table`);
  }
});

test('every doctrine anchor cited by an agent or SKILL.md is defined in the bundled copy (not only in its redirect table)', () => {
  const anchors = doctrineAnchors(readFileSync(DOCTRINE, 'utf8'));
  const files = citingFiles();
  assert.ok(files.length >= 40, `found ${files.length} agent and skill files`);
  const dangling = danglingAnchors(files, anchors);
  assert.deepEqual(dangling, [], `dangling doctrine anchors:\n${dangling.join('\n')}`);
});
