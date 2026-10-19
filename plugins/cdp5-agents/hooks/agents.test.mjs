import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const AGENTS = join(new URL('..', import.meta.url).pathname, 'agents');
const EFFORT = new Set(['low', 'medium', 'high', 'xhigh', 'max']);
const MODELS = new Set(['sonnet', 'opus', 'haiku', 'fable', 'inherit']);
const TOOLS = new Set(['Read', 'Grep', 'Glob', 'Bash', 'Write', 'Edit', 'WebFetch', 'WebSearch']);

function parse(file) {
  const text = readFileSync(join(AGENTS, file), 'utf8');
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(m, `${file}: frontmatter missing`);
  const fm = Object.fromEntries(m[1].split('\n').map((l) => { const i = l.indexOf(':'); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
  return { fm, body: m[2], text };
}

const files = readdirSync(AGENTS).filter((f) => f.endsWith('.md'));

test('every agent file has the required frontmatter with valid values', () => {
  assert.ok(files.length >= 5);
  for (const f of files) {
    const { fm } = parse(f);
    assert.equal(fm.name, f.replace(/\.md$/, ''), `${f}: name must match the filename`);
    assert.ok(fm.description && fm.description.length <= 600, `${f}: description missing or longer than 600 characters`);
    assert.ok(MODELS.has(fm.model), `${f}: model ${fm.model}`);
    assert.ok(EFFORT.has(fm.effort), `${f}: effort must be one of ${[...EFFORT].join(', ')}`);
    const tools = fm.tools.split(',').map((t) => t.trim());
    assert.ok(tools.length > 0 && tools.every((t) => TOOLS.has(t)), `${f}: tools ${fm.tools}`);
    assert.ok(!tools.includes('Write') && !tools.includes('Edit'), `${f}: judgment agents are read-only`);
    for (const k of ['hooks', 'mcpServers', 'permissionMode', 'initialPrompt', 'skills']) assert.ok(!(k in fm), `${f}: ${k} is ignored for plugin subagents or not wanted`);
  }
});

test('no thinking phrases, no doctrine lookup via node, contract referenced, English', () => {
  for (const f of files) {
    const { body } = parse(f);
    assert.doesNotMatch(body, /think (hard|harder|deeply)/i, `${f}: thinking phrases are replaced by the effort field`);
    assert.doesNotMatch(body, /cdp5\.mjs|cdp5-reference/, `${f}: doctrine comes from the brief or the doctrine copy, not a node route`);
    assert.match(body, /worker contract/i, `${f}: must reference the worker contract`);
    assert.match(body, /acknowledgement line/i, `${f}: must name the acknowledgement line`);
    assert.match(body, /## Rights and duties/, `${f}: §5 section missing`);
    assert.match(body, /## Output/, `${f}: output section missing`);
    assert.doesNotMatch(body, /\b(Pflicht-Vorlauf|Arbeitsweise|Befund|Verdikt fällen)\b/, `${f}: German prose left over`);
  }
});

test('counter-roles state the fresh-context header; verifiers with Bash name read-only probes', () => {
  const counter = ['adversarial-auditor.md', 'review-verify.md'];
  for (const f of counter) {
    const { fm, body } = parse(f);
    assert.ok(fm.tools.includes('Bash'), `${f} needs Bash for probes`);
    assert.match(body, /read-only/i, `${f}: read-only rule missing`);
  }
  assert.match(parse('adversarial-auditor.md').body, /fresh context: yes\|no/);
  assert.match(parse('adversarial-auditor.md').body, /FREIGABE-MIT-AUFLAGEN/);
  assert.match(parse('review-verify.md').body, /nicht entscheidbar/);
  assert.match(parse('konzept-reviewer.md').body, /reife-rubrik\.policy\.md/);
  assert.match(parse('threat-modeler.md').body, /§33\.2/);
  assert.match(parse('mcp-security-reviewer.md').body, /token passthrough/i);
});
