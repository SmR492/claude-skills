import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseUCs, lintKonzept, loadPolicy, collectChecks, glossaryTerms, GATE_CHECKS, VAGUE, EVIDENCE_TYPE, DEFAULT_POLICY } from './konzept-lint.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = join(HERE, 'konzept-lint.mjs');
const DOCTRINE = join(HERE, '..', 'cdp5-reference', 'konzept-design-pattern-v6.md');
const HEAD = '**Version:** 1.0\n**Scope:** x\n';
const HEAD_V2 = '**Version:** 2.0\n**Scope:** x\n';
const ROLES = '## Rollen\n| Rolle | Aufgabe |\n';
const LIFECYCLE = '## Status-Lifecycle\n```mermaid\nstateDiagram-v2\n  A --> B\n```\n';
const ENTITIES = '## Entity Overview\n| Entity | Table | Description |\n';
const RESPONSIBILITY = '## Responsibility Matrix\n| UC | AI share | Human validator |\n';
const GLOSSAR = '## Glossar\n| a | b | c |\n';
const CHANGELOG = '## Changelog\n- v1.0 initial\n';
const uc = (n, { steps = true, errors = true, actor = true, ac = '| AC-1 | user can create | Integration | FooTest::testCreate | red |' } = {}) =>
  `## UC-0${n}: Case ${n}\n${actor ? `**Actor:** \`Admin\`\n**Route:** \`/case/${n}\`\n` : ''}${steps ? '1. Step\n1.1 Sub-step\n' : 'Prose only.\n'}${errors ? '### Fehlerfälle\n| x | y |\n' : ''}${ac ? `### Akzeptanzkriterien\n${ac}\n` : ''}`;
const APPENDIX = HEAD + ROLES + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
const complete = HEAD + ROLES + uc(1) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
const LLM_UC = '## UC-01: LLM classification\n**Actor:** `Member`\n**Route:** `/classify`\n1. Uses an LLM.\n2. Stores the result.\n### Fehlerfälle\n|a|b|\n### Akzeptanzkriterien\n| AC-1 | ok | Eval | T::t | red |\n';
const LLM_FIELDS = '## Probabilistics Statement\n| UC | Tolerance |\n## Vendor Risk Statement\n| UC | Provider |\nContext definition, Output data format, Validation strategy, Fallback behavior, Knowledge-cutoff handling.\n';

function run(args) {
  try { return { code: 0, out: execFileSync('node', [SCRIPT, ...args], { stdio: 'pipe' }).toString() }; }
  catch (e) { return { code: e.status, out: e.stdout?.toString() ?? '' }; }
}

function goldenSamples() {
  const md = readFileSync(DOCTRINE, 'utf8');
  const appendix = md.slice(md.indexOf('## Appendix B'), md.indexOf('## Appendix C'));
  const blocks = [...appendix.matchAll(/```markdown\n([\s\S]*?)```/g)].map((m) => m[1]);
  assert.equal(blocks.length, 2, 'Appendix B carries two golden samples');
  return blocks.join('\n');
}

test('default policy loads from the plugin and has gate and dimensions', () => {
  const p = loadPolicy(DEFAULT_POLICY);
  assert.equal(p.threshold, 8);
  assert.ok(p.gate.length >= 11);
  assert.ok(p.dimensions.some((d) => d.id === 'sachbearbeiter' && d.kind === 'jdg'));
  assert.ok(!('sachbearbeiter' in p.weights), 'judgment dimension is not weighted by the lint');
});

test('the lint and the policy list the same deterministic checks', () => {
  const p = loadPolicy(DEFAULT_POLICY);
  const det = p.gate.filter((g) => g.kind === 'det').map((g) => g.check).sort();
  assert.deepEqual(det, Object.keys(GATE_CHECKS).sort());
  assert.deepEqual(p.gate.map((g) => g.id), ['G1', 'G2', 'G3', 'G4', 'G5a', 'G5b', 'G6', 'G7', 'G8', 'G9', 'G10', 'G11', 'G12', 'G13', 'G14', 'G15']);
  assert.deepEqual(p.gate.filter((g) => g.kind === 'jdg').map((g) => g.id), ['G5b', 'G10', 'G11']);
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
  const r = lintKonzept(HEAD + ROLES + uc(1, { errors: false, ac: '' }) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG);
  assert.equal(r.gate.passed, false);
  assert.deepEqual(r.gate.failed, ['G3', 'G7']);
  assert.equal(r.dims.ac, 0);
  assert.equal(r.dims.fehlerfaelle, 0);
  assert.ok(r.teilScore < 8);
});

test('missing lifecycle and changelog are gate items of their own; failed struktur checks are itemised', () => {
  const r = lintKonzept(HEAD_V2 + ROLES + uc(1) + ENTITIES + RESPONSIBILITY + GLOSSAR);
  assert.deepEqual(r.gate.failed, ['G4', 'G9']);
  assert.ok(r.dims.struktur < 10);
  assert.deepEqual(r.strukturFailed, ['lifecycle']);
  assert.deepEqual(lintKonzept(complete).strukturFailed, []);
});

test('G4: the lifecycle is optional when the document says why (§3), in German or English', () => {
  const base = HEAD + ROLES + uc(1) + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
  assert.ok(lintKonzept(base).gate.failed.includes('G4'));
  assert.ok(!lintKonzept(base + '\nNo status lifecycle: no entity carries a status.\n').gate.failed.includes('G4'));
  assert.ok(!lintKonzept(base + '\nKein Status-Lebenszyklus: keine Entität hat einen Status.\n').gate.failed.includes('G4'));
});

test('G9: the changelog is mandatory from v2.0 (§6); below that, or without a parsable version, it is decided as documented', () => {
  const body = ROLES + uc(1) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR;
  assert.ok(!lintKonzept(HEAD + body).gate.failed.includes('G9'), 'v1.0 needs no changelog');
  assert.ok(lintKonzept(HEAD_V2 + body).gate.failed.includes('G9'), 'v2.0 needs a changelog');
  assert.ok(!lintKonzept(HEAD_V2 + body + CHANGELOG).gate.failed.includes('G9'));
  assert.ok(lintKonzept('**Scope:** x\n' + body).gate.failed.includes('G9'), 'no version: changelog required');
});

test('G1: a single "1." is not a flow; two steps or a sub-step are; uc_schritte is the fraction of UCs with a flow', () => {
  const one = '## UC-01: A\n**Actor:** a\n**Route:** r\n1. Only step\n### Fehlerfälle\n| x | y |\n| AC-1 | ok | Unit | T::t | red |\n';
  const two = '## UC-02: B\n**Actor:** a\n**Route:** r\n1. First\n2. Second\n### Fehlerfälle\n| x | y |\n| AC-1 | ok | Unit | T::t | red |\n';
  const r = lintKonzept(APPENDIX + one + two);
  assert.deepEqual(r.perUC.map((u) => u.stepsNumbered), [false, true]);
  assert.ok(r.gate.failed.includes('G1'));
  assert.equal(r.dims.uc_schritte, 5);
  assert.equal(lintKonzept(APPENDIX + uc(1)).dims.uc_schritte, 10, '1. followed by 1.1 counts');
});

test('G3: an error-case heading needs a table within five lines; prose does not pass', () => {
  const prose = '## UC-01: A\n**Actor:** a\n**Route:** r\n1. a\n2. b\n### Error cases\nIf the file is too large the user sees a message.\n\n### Acceptance criteria\n| AC-1 | ok | Unit | T::t | red |\n';
  const table = prose.replace('If the file is too large the user sees a message.\n\n', '\n| Case | Message |\n|---|---|\n| too large | "Max 10 MB" |\n\n');
  assert.equal(lintKonzept(APPENDIX + prose).perUC[0].hasFehlerfaelle, false);
  assert.equal(lintKonzept(APPENDIX + table).perUC[0].hasFehlerfaelle, true);
});

test('G12: every UC names Actor and Route (Akteur accepted)', () => {
  const r = lintKonzept(APPENDIX + uc(1, { actor: false }));
  assert.ok(r.gate.failed.includes('G12'));
  assert.deepEqual(r.strukturFailed, ['actor_route']);
  const de = '## UC-01: A\n**Akteur:** `Admin`\n**Route:** `/a`\n1. a\n2. b\n### Fehlerfälle\n| x | y |\n| AC-1 | ok | Unit | T::t | red |\n';
  assert.ok(!lintKonzept(APPENDIX + de).gate.failed.includes('G12'));
});

test('G5a, G14, G15: roles overview, entity overview and responsibility matrix are deterministic gate items', () => {
  assert.deepEqual(lintKonzept(HEAD + uc(1) + LIFECYCLE + GLOSSAR + CHANGELOG).gate.failed, ['G5a', 'G14', 'G15']);
  const en = HEAD + '## Roles\n| Role | Scope |\n' + uc(1) + LIFECYCLE + '## 7. Entities\n| Entity | Table |\n' + '## Verantwortungs-Matrix\n| UC | KI-Anteil |\n' + GLOSSAR + CHANGELOG;
  assert.equal(lintKonzept(en).gate.passed, true, JSON.stringify(lintKonzept(en).gate.failed));
  const tableOnly = HEAD + '| Role | Scope | Description |\n|---|---|---|\n| `Admin` | global | all |\n' + uc(1) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
  assert.ok(!lintKonzept(tableOnly).gate.failed.includes('G5a'), 'a role table without heading counts');
});

test('hedged acceptance criteria such as "typisch" or "roughly" count as vague', () => {
  const r = lintKonzept(HEAD + ROLES + uc(1, { ac: '| AC-1 | runtime < 30 s typisch | Unit | T::t | red |\n| AC-2 | roughly 100 items | Unit | T::t | red |' }) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG);
  assert.equal(r.perUC[0].vagueAC.length, 2);
  assert.equal(r.dims.ac, 6);
});

test('VAGUE: dot-terminated hedges fire, "about" as a preposition and word prefixes do not', () => {
  assert.ok(VAGUE.test('| AC-1 | lists PDF, PNG etc. | Unit | T::t | red |'));
  assert.ok(VAGUE.test('| AC-2 | dauert ca. 3 s | Unit | T::t | red |'));
  assert.ok(VAGUE.test('| AC-3 | Export o. ä. | Unit | T::t | red |'));
  assert.ok(VAGUE.test('| AC-4 | the list is sorted, roughly. | Unit | T::t | red |'));
  assert.ok(!VAGUE.test('| AC-5 | shows information about the user | Unit | T::t | red |'));
  assert.ok(!VAGUE.test('| AC-6 | typische Laufzeit wird protokolliert | Unit | T::t | red |'));
  const r = lintKonzept(HEAD + ROLES + uc(1, { ac: '| AC-1 | shows information about the user | Unit | T::t | red |\n| AC-2 | PDF, PNG etc. | Unit | T::t | red |' }) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG);
  assert.equal(r.perUC[0].vagueAC.length, 1);
});

test('a score cannot mask an open gate item', () => {
  const r = lintKonzept(HEAD_V2 + ROLES + uc(1) + uc(2) + uc(3) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR);
  assert.ok(r.teilScore >= 9, `score ${r.teilScore}`);
  assert.equal(r.gate.passed, false);
  assert.deepEqual(r.gate.failed, ['G9']);
});

test('vague AC wording lowers the ac dimension by 2 per row', () => {
  const r = lintKonzept(HEAD + ROLES + uc(1, { ac: '| AC-1 | should ideally be correct | Unit | T::t | red |' }) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG);
  assert.equal(r.perUC[0].vagueAC.length, 1);
  assert.equal(r.dims.ac, 8);
});

test('LLM UC without probabilistic and vendor-risk statement fails G6 and G13 and lowers struktur', () => {
  const r = lintKonzept(HEAD + ROLES + LLM_UC + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG);
  assert.equal(r.global.llm, true);
  assert.equal(r.global.hatProbabilistik, false);
  assert.ok(r.gate.failed.includes('G6'));
  assert.ok(r.gate.failed.includes('G13'));
  assert.ok(r.dims.struktur < 10);
  const ok = lintKonzept(HEAD + ROLES + LLM_UC + LLM_FIELDS + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG);
  assert.equal(ok.gate.passed, true, JSON.stringify(ok.gate.failed));
  assert.equal(ok.dims.struktur, 10);
});

test('G6 accepts the doctrine heading "Probabilistics Statement" and the German "Probabilistik-Statement"', () => {
  const base = HEAD + ROLES + LLM_UC + '## Vendor Risk Statement\n| UC | Provider |\nContext, Output, Validation, Fallback, Cutoff.\n' + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
  assert.ok(lintKonzept(base).gate.failed.includes('G6'));
  assert.ok(!lintKonzept(base + '## Probabilistics Statement\n| UC | Tolerance |\n').gate.failed.includes('G6'));
  assert.ok(!lintKonzept(base + '## Probabilistik-Statement\n| UC | Toleranz |\n').gate.failed.includes('G6'));
});

test('a deterministic concept with the §13.3 "No LLM" note is not classified as LLM', () => {
  const det = HEAD + ROLES + uc(1).replace('1. Step', '> **No LLM:** This UC is deterministic — no AI component (§13.3).\n1. Step') + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
  const r = lintKonzept(det);
  assert.equal(r.global.llm, false);
  assert.equal(r.gate.passed, true, JSON.stringify(r.gate.failed));
  assert.equal(lintKonzept(det.replace('No LLM:', 'Kein LLM:')).global.llm, false);
  assert.equal(collectChecks(det + '\nUC-02 calls an LLM.\n').global.llm, true, 'a real LLM mention still counts');
});

test('§13.1 and §20.3 fields are matched in English and case-insensitively', () => {
  const en = HEAD + ROLES + LLM_UC + '## Probabilistics Statement\n|a|\n## Vendor Risk\n|a|\n| Context definition | x |\n| Output data format | x |\n| Validation strategy | x |\n| Fallback behavior | x |\n| Knowledge cut-off handling | x |\n' + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
  assert.equal(collectChecks(en).global.llmFelder, true);
  assert.equal(collectChecks(en.replace('Knowledge cut-off handling', 'Knowledge handling')).global.llmFelder, false);
  const rag = en + '\nRAG UC: chunking semantic, embedding model nomic, retrieval K=3, prompt caching on, invalidation on file change.\n';
  assert.equal(collectChecks(rag).global.rag, true);
  assert.equal(collectChecks(rag).global.ragFelder, true);
  assert.equal(collectChecks(rag.replace('invalidation on file change', 'no strategy')).global.ragFelder, false);
});

test('evidence convention: obligation statements without an evidence type lower nachweis; table cells and headings are not obligations', () => {
  const typed = complete + '\nPflicht: anonymous visitors get 401 — AC-2 (Test/AC).\n';
  const untyped = complete + '\nPflicht: the service is fast.\n';
  assert.equal(lintKonzept(typed).dims.nachweis, 10);
  assert.equal(lintKonzept(untyped).dims.nachweis, 0);
  assert.equal(lintKonzept(complete).dims.nachweis, 10, 'no mandatory statements: not applicable, full score');
  const formTable = complete + '\n| Field | Type | Mandatory | Note |\n|---|---|---|---|\n| Name | Text | Yes | mandatory when public |\n### Mandatory Fields\n';
  assert.equal(collectChecks(formTable).global.mandatoryStatements, 0);
  assert.equal(collectChecks(complete + '\nStreaming is mandatory — Trace span per call.\nMUSS: 401 for anonymous (Checklist item).\n').global.mandatoryTyped, 2);
  assert.equal(collectChecks(complete + '\nStreaming is mandatory (Eval).\n').global.mandatoryTyped, 0, 'Eval is not a §10.7 evidence type');
  assert.ok(!EVIDENCE_TYPE.test('Pflicht: we test it manually.'), '"test" in prose is not an evidence type');
});

test('glossar: backticked glossary terms must occur in a UC; the dimension is the fraction that does', () => {
  const glossary = '## Glossary\n| Term | Definition |\n|---|---|\n| `Admin` | the administrator |\n| `Widget` | never used |\n';
  const r = lintKonzept(HEAD + ROLES + uc(1) + LIFECYCLE + ENTITIES + RESPONSIBILITY + glossary + CHANGELOG);
  assert.deepEqual(glossaryTerms(glossary), ['Admin', 'Widget']);
  assert.deepEqual(r.global.glossarUnused, ['Widget']);
  assert.equal(r.dims.glossar, 5);
  assert.ok(r.gate.passed, 'presence is the gate item, usage the dimension');
  assert.equal(lintKonzept(complete).dims.glossar, 10, 'glossary without backticked terms: presence only');
  assert.equal(lintKonzept(complete.replace(GLOSSAR, '')).dims.glossar, 0);
});

test('G2 head accepts Geltungsbereich and Umfang for Scope', () => {
  assert.ok(!lintKonzept(complete.replace('**Scope:**', '**Geltungsbereich:**')).gate.failed.includes('G2'));
  assert.ok(!lintKonzept(complete.replace('**Scope:**', '**Umfang:**')).gate.failed.includes('G2'));
  assert.ok(lintKonzept(complete.replace('**Scope:** x\n', '')).gate.failed.includes('G2'));
});

test('project policy overrides weights; gate stays', () => {
  const md = HEAD + ROLES + uc(1) + uc(2, { ac: '' }) + LIFECYCLE + ENTITIES + RESPONSIBILITY + GLOSSAR + CHANGELOG;
  const base = loadPolicy(DEFAULT_POLICY);
  const onlyStructure = { ...base, weights: { struktur: 1 } };
  const onlyAc = { ...base, weights: { ac: 1 } };
  assert.equal(lintKonzept(md, onlyStructure).teilScore, 10);
  assert.equal(lintKonzept(md, onlyAc).teilScore, 5);
  assert.deepEqual(lintKonzept(md, onlyAc).gate.failed, ['G7']);
});

test('CLI: exit 1 on an open gate item, exit 0 when the gate passes, exit 2 on a broken policy file; traffic-light marks', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kl-'));
  writeFileSync(join(dir, 'ok.md'), complete);
  writeFileSync(join(dir, 'gap.md'), HEAD + uc(1, { ac: '' }) + GLOSSAR);
  writeFileSync(join(dir, 'vague.md'), complete.replace('user can create', 'user can roughly create'));
  writeFileSync(join(dir, 'bad.json'), '{ broken ');
  const ok = run([`--konzept=${join(dir, 'ok.md')}`]);
  assert.equal(ok.code, 0, ok.out);
  assert.match(ok.out, /Gate: all deterministic items pass/);
  assert.match(ok.out, /🟢 G1 /);
  assert.ok(!ok.out.includes('🔴'));
  const gap = run([`--konzept=${join(dir, 'gap.md')}`]);
  assert.equal(gap.code, 1);
  assert.match(gap.out, /not ready regardless of score/);
  assert.match(gap.out, /🔴 G7 /);
  assert.match(gap.out, /🔴 UC-01: Case 1 {2}— no AC table/);
  const vague = run([`--konzept=${join(dir, 'vague.md')}`]);
  assert.equal(vague.code, 0, 'a vague AC row is a warning, not a gate item');
  assert.match(vague.out, /🟡 UC-01: Case 1\n\s+🟡 vague AC: /);
  assert.equal(run([`--konzept=${join(dir, 'ok.md')}`, `--rubric=${join(dir, 'bad.json')}`]).code, 2);
});

test('CLI runs from a directory whose name contains a space', () => {
  const dir = mkdtempSync(join(tmpdir(), 'kl space-'));
  writeFileSync(join(dir, 'golden samples.md'), APPENDIX + goldenSamples());
  const r = run([`--konzept=${join(dir, 'golden samples.md')}`, '--json']);
  assert.equal(r.code, 0, r.out);
  assert.equal(JSON.parse(r.out).gate.passed, true);
});

test('golden samples (doctrine Appendix B) pass every per-UC and LLM gate item; the §3.1 form table lowers neither struktur nor nachweis', () => {
  const samples = goldenSamples();
  const bare = lintKonzept(samples);
  assert.deepEqual(bare.perUC.map((u) => u.uc), ['UC-S1: Add Vehicle to Garage', 'UC-S2: Automatically Categorize Defect Descriptions']);
  assert.equal(bare.global.llm, true);
  assert.deepEqual(bare.gate.failed, ['G2', 'G5a', 'G8', 'G9', 'G14'], 'only the document-level sections Appendix B does not demonstrate are open');
  assert.equal(bare.dims.uc_schritte, 10);
  assert.equal(bare.dims.fehlerfaelle, 10);
  assert.equal(bare.dims.ac, 10);
  assert.equal(bare.dims.nachweis, 10, 'the §3.1 "Mandatory" column is not an obligation statement');
  const framed = lintKonzept(APPENDIX + samples);
  assert.equal(framed.gate.passed, true, JSON.stringify(framed.gate.failed));
  assert.equal(framed.dims.struktur, 10);
  assert.equal(framed.dims.nachweis, 10);
  assert.equal(framed.teilScore, 10);
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
