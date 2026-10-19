import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUCs, lintKonzept, loadPolicy, DEFAULT_POLICY } from './konzept-lint.mjs';

const SCRIPT = join(dirname(fileURLToPath(import.meta.url)), 'konzept-lint.mjs');
const HEAD = '**Version:** 1.0\n**Scope:** x\n';
const ROLES = '## Rollen\n| Rolle | Aufgabe |\n';
const LIFECYCLE = '## Status-Lifecycle\n```mermaid\nstateDiagram-v2\n  A --> B\n```\n';
const GLOSSAR = '## Glossar\n| a | b | c |\n';
const CHANGELOG = '## Changelog\n- v1.0 initial\n';
const uc = (n, { steps = true, errors = true, ac = '| AC-1 | user can create | Integration | FooTest::testCreate | red |' } = {}) =>
  `## UC-0${n}: Case ${n}\n${steps ? '1. Step\n1.1 Sub-step\n' : 'Prose only.\n'}${errors ? '### Fehlerfälle\n| x | y |\n' : ''}${ac ? `### Akzeptanzkriterien\n${ac}\n` : ''}`;
const complete = HEAD + ROLES + uc(1) + LIFECYCLE + GLOSSAR + CHANGELOG;

function run(args) {
  try { return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { stdio: 'pipe' }).toString() }; }
  catch (e) { return { code: e.status, out: e.stdout?.toString() ?? '' }; }
}

test('default policy loads from the plugin and has gate and dimensions', () => {
  const p = loadPolicy(DEFAULT_POLICY);
  assert.equal(p.threshold, 8);
  assert.ok(p.gate.length >= 11);
  assert.ok(p.dimensions.some((d) => d.id === 'sachbearbeiter' && d.kind === 'jdg'));
  assert.ok(!('sachbearbeiter' in p.weights), 'judgment dimension is not weighted by the lint');
});

test('complete non-LLM concept: every deterministic gate item passes, partial score 10', () => {
  const r = lintKonzept(complete);
  assert.equal(r.gate.passed, true, JSON.stringify(r.gate.failed));
  assert.equal(r.strukturGap, false);
  assert.equal(r.teilScore, 10);
  assert.equal(r.contribution, 8);
  assert.deepEqual(r.gate.items.filter((i) => i.kind === 'jdg').map((i) => i.pass), [null, null, null]);
});

test('missing AC table and error cases: gate fails on G3 and G7, score drops', () => {
  const r = lintKonzept(HEAD + ROLES + uc(1, { errors: false, ac: '' }) + LIFECYCLE + GLOSSAR + CHANGELOG);
  assert.equal(r.gate.passed, false);
  assert.deepEqual(r.gate.failed, ['G3', 'G7']);
  assert.equal(r.dims.ac, 0);
  assert.equal(r.dims.fehlerfaelle, 0);
  assert.ok(r.teilScore < 8);
});

test('missing lifecycle and changelog are gate items of their own', () => {
  const r = lintKonzept(HEAD + ROLES + uc(1) + GLOSSAR);
  assert.deepEqual(r.gate.failed, ['G4', 'G9']);
  assert.ok(r.dims.struktur < 10);
});

test('a score cannot mask an open gate item', () => {
  const r = lintKonzept(HEAD + ROLES + uc(1) + uc(2) + uc(3) + LIFECYCLE + GLOSSAR);
  assert.ok(r.teilScore >= 9, `score ${r.teilScore}`);
  assert.equal(r.gate.passed, false);
  assert.deepEqual(r.gate.failed, ['G9']);
});

test('vague AC wording lowers the ac dimension by 2 per row', () => {
  const r = lintKonzept(HEAD + ROLES + uc(1, { ac: '| AC-1 | should ideally be correct | Unit | T::t | red |' }) + LIFECYCLE + GLOSSAR + CHANGELOG);
  assert.equal(r.perUC[0].vagueAC.length, 1);
  assert.equal(r.dims.ac, 8);
});

test('LLM UC without probabilistic statement fails G6 and lowers struktur', () => {
  const r = lintKonzept(HEAD + ROLES + '## UC-01: LLM classification\n1. Uses an LLM.\n### Fehlerfälle\n|a|b|\n### Akzeptanzkriterien\n| AC-1 | ok | Eval | T::t | red |\n' + LIFECYCLE + GLOSSAR + CHANGELOG);
  assert.equal(r.global.llm, true);
  assert.equal(r.global.hatProbabilistik, false);
  assert.ok(r.gate.failed.includes('G6'));
  assert.ok(r.dims.struktur < 10);
});

test('evidence convention: mandatory statements without an evidence type lower nachweis', () => {
  const typed = complete + '\nPflicht: anonymous visitors get 401 — AC-2 (Test).\n';
  const untyped = complete + '\nPflicht: the service is fast.\n';
  assert.equal(lintKonzept(typed).dims.nachweis, 10);
  assert.equal(lintKonzept(untyped).dims.nachweis, 0);
  assert.equal(lintKonzept(complete).dims.nachweis, 10, 'no mandatory statements: not applicable, full score');
});

test('project policy overrides weights; gate stays', () => {
  const md = HEAD + ROLES + uc(1) + uc(2, { ac: '' }) + LIFECYCLE + GLOSSAR + CHANGELOG;
  const base = loadPolicy(DEFAULT_POLICY);
  const onlyStructure = { ...base, weights: { struktur: 1 } };
  const onlyAc = { ...base, weights: { ac: 1 } };
  assert.equal(lintKonzept(md, onlyStructure).teilScore, 10);
  assert.equal(lintKonzept(md, onlyAc).teilScore, 5);
  assert.deepEqual(lintKonzept(md, onlyAc).gate.failed, ['G7']);
});

test('CLI: exit 1 on an open gate item, exit 0 when the gate passes, exit 2 on a broken policy file', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kl-'));
  writeFileSync(join(dir, 'ok.md'), complete);
  writeFileSync(join(dir, 'gap.md'), HEAD + uc(1, { ac: '' }) + GLOSSAR);
  writeFileSync(join(dir, 'bad.json'), '{ broken ');
  const ok = run([`--konzept=${join(dir, 'ok.md')}`]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /Gate: all deterministic items pass/);
  const gap = run([`--konzept=${join(dir, 'gap.md')}`]);
  assert.equal(gap.code, 1);
  assert.match(gap.out, /not ready regardless of score/);
  assert.equal(run([`--konzept=${join(dir, 'ok.md')}`, `--rubric=${join(dir, 'bad.json')}`]).code, 2);
});

test('parseUCs ignores non-UC headings and finds H3 UCs under a numbered section', () => {
  assert.equal(parseUCs('## UC-01: A\nx\n## Glossar\ny\n## UC-02: B\nz').length, 2);
  const ucs = parseUCs('## 3. Use Cases\n### UC-01: A\nx\n### Fehlerfälle\n|a|b|\n### UC-02: B\nz\n## 4. Rubrik\nkein UC');
  assert.equal(ucs.length, 2);
  assert.equal(ucs[0].title, 'UC-01: A');
});

test('numbered glossary heading is recognised (dogfood)', () => {
  assert.equal(lintKonzept(HEAD + uc(1) + '\n## 9. Glossar (§14)\n| a | b | c |\n').global.hatGlossar, true);
});
