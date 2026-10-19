import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const PLUGIN = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
const DOMAIN = join(PLUGIN, '..', 'domain-agents', 'agents');
const EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const MODELS = new Set(['sonnet', 'opus', 'haiku', 'fable', 'inherit']);
const TOOLS = new Set(['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch']);
const WRITERS = new Set(['impl-debug', 'impl-uc', 'impl-refactor']);

function agentFiles(dir) {
  return existsSync(dir) ? readdirSync(dir).filter((f) => f.endsWith('.md')).map((f) => join(dir, f)) : [];
}

function parse(path) {
  const text = readFileSync(path, 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${path}: frontmatter missing`);
  const fm = Object.fromEntries(m[1].split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { fm, body: m[2], file: path.split('/').pop() };
}

const files = [...agentFiles(join(PLUGIN, 'agents')), ...agentFiles(DOMAIN)];

test('every agent file has the required frontmatter with valid values', () => {
  assert.ok(files.length >= 12, `found ${files.length} agent files`);
  for (const path of files) {
    const { fm, file } = parse(path);
    assert.equal(fm.name, file.replace(/\.md$/, ''), `${file}: name must match the filename`);
    assert.ok(fm.description && fm.description.length <= 700, `${file}: description missing or longer than 700 characters`);
    assert.ok(MODELS.has(fm.model), `${file}: model ${fm.model}`);
    assert.ok(EFFORT.has(fm.effort), `${file}: effort must be one of ${[...EFFORT].join(', ')}`);
    const tools = fm.tools.split(',').map((t) => t.trim());
    assert.ok(tools.length > 0 && tools.every((t) => TOOLS.has(t)), `${file}: tools ${fm.tools}`);
    const writes = tools.includes('Write') || tools.includes('Edit');
    assert.equal(writes, WRITERS.has(fm.name), `${file}: only implementation workers get Write/Edit`);
    for (const k of ['hooks', 'mcpServers', 'permissionMode', 'initialPrompt', 'skills']) assert.ok(!(k in fm), `${file}: ${k} is ignored for plugin subagents or not wanted`);
  }
});

test('no thinking phrases, no doctrine lookup via node, contract referenced, English, sections present', () => {
  for (const path of files) {
    const { body, file } = parse(path);
    assert.doesNotMatch(body, /think (hard|harder|deeply)/i, `${file}: thinking phrases are replaced by the effort field`);
    assert.doesNotMatch(body, /cdp5\.mjs|cdp5-reference/, `${file}: doctrine comes from the brief or the doctrine copy, not a node route`);
    assert.match(body, /worker contract/i, `${file}: must reference the worker contract`);
    assert.match(body, /acknowledgement line/i, `${file}: must name the acknowledgement line`);
    assert.match(body, /## Inputs/, `${file}: inputs section missing`);
    assert.match(body, /## Rights and duties/, `${file}: §5 section missing`);
    assert.match(body, /## Output/, `${file}: output section missing`);
    assert.doesNotMatch(body, /\b(Pflicht-Vorlauf|Arbeitsweise|Verdikt fällen)\b/, `${file}: German prose left over`);
  }
});

test('role-specific anchors', () => {
  const byName = Object.fromEntries(files.map((p) => { const a = parse(p); return [a.fm.name, a]; }));
  assert.match(byName['adversarial-auditor'].body, /fresh context: yes\|no/);
  assert.match(byName['adversarial-auditor'].body, /FREIGABE-MIT-AUFLAGEN/);
  assert.match(byName['review-verify'].body, /nicht entscheidbar/);
  assert.match(byName['konzept-reviewer'].body, /reife-rubrik\.policy\.md/);
  assert.match(byName['threat-modeler'].body, /§33\.2/);
  assert.match(byName['mcp-security-reviewer'].body, /token passthrough/i);
  assert.match(byName['devils-advocate'].body, /null option/i);
  assert.match(byName['pessimistic-realist'].body, /unsupported forecast/);
  assert.match(byName['review-code'].body, /Schema C\.1/);
  assert.match(byName['impl-debug'].body, /false positive/i);
  assert.match(byName['impl-uc'].body, /placeholder/i);
  assert.match(byName['impl-refactor'].body, /mutation sample/i);
  assert.match(byName['pm-retro'].body, /carry-over/i);
  for (const w of WRITERS) assert.match(byName[w].body, /no commit, no push|neither commit nor push|do not commit/i, `${w}: must state no commit`);
});
