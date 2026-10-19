import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync, readFileSync, rmSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseFrontmatter, checkKonzept, checkRepo, declaresAiActClass, EU_AI_ACT_CLASSES } from './profile-check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const TEMPLATE = join(HERE, 'project-profile.template.md');

/** Copies lib + this skill into a temp directory whose path contains a space (main-guard regression). */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'profile-check'), { recursive: true });
  return { root, script: join(root, 'skills', 'profile-check', 'profile-check.mjs') };
}

test('parseFrontmatter reads scalars + lists', () => {
  const md = '---\nproject: Demo\neu_ai_act_class: minimal\nrequire_in_concept:\n  - Probabilistik-Statement\n  - "Vendor-Risiko"\n---\n# Body';
  const p = parseFrontmatter(md);
  assert.equal(p.project, 'Demo');
  assert.equal(p.eu_ai_act_class, 'minimal');
  assert.deepEqual(p.require_in_concept, ['Probabilistik-Statement', 'Vendor-Risiko']);
});

test('parseFrontmatter strips inline comments from values and list items', () => {
  const p = parseFrontmatter('---\nruntime: node                 # node | php | python\ntest_framework: node:test     # node:test | phpunit\nlist:\n  - Glossar   # heading\n  - "C#-Guide"\n---\n');
  assert.equal(p.runtime, 'node');
  assert.equal(p.test_framework, 'node:test');
  assert.deepEqual(p.list, ['Glossar', 'C#-Guide']);   // a `#` without leading whitespace is part of the value
});

test('the shipped project-profile.template.md parses to clean values and known runtime/framework', () => {
  const p = parseFrontmatter(readFileSync(TEMPLATE, 'utf8'));
  assert.equal(p.runtime, 'node');
  assert.equal(p.test_framework, 'node:test');
  assert.equal(p.eu_ai_act_class, 'minimal');
  assert.equal(p.security_level, 'standard');
  assert.deepEqual(p.require_in_concept, ['Probabilistik-Statement', 'Vendor-Risiko', 'Glossar']);
  assert.ok(EU_AI_ACT_CLASSES.includes(p.eu_ai_act_class));
  const root = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(root, 'package.json'), '{}');
  writeFileSync(join(root, 'x.test.mjs'), "import { test } from 'node:test';\n");
  const r = checkRepo(p, root);
  assert.ok(!r.some((x) => /unknown/.test(x.label)), JSON.stringify(r));
  assert.ok(r.every((x) => x.pass), JSON.stringify(r));
});

test('parseFrontmatter without frontmatter → {}', () => {
  assert.deepEqual(parseFrontmatter('# body only'), {});
});

test('checkKonzept: EU AI Act class must be declared', () => {
  const profile = { eu_ai_act_class: 'minimal' };
  const ok = checkKonzept(profile, 'All UCs are EU-AI-Act class minimal.');
  const fail = checkKonzept(profile, 'Concept without regulatory section.');
  assert.equal(ok[0].pass, true);
  assert.equal(ok[0].sev, '🟢');
  assert.equal(fail[0].pass, false);
  assert.equal(fail[0].sev, '🔴');
});

test('checkKonzept: the class must stand next to "AI Act" or in a risk-class table row, not anywhere in the prose', () => {
  const profile = { eu_ai_act_class: 'high' };
  // "high" occurs (high availability), "AI Act" occurs on another line → NOT a declaration
  const scattered = 'We need high availability.\n\nThe EU AI Act applies to this system.\n';
  assert.equal(checkKonzept(profile, scattered)[0].pass, false);
  assert.equal(checkKonzept(profile, 'EU AI Act risk class: **High** (HR decisions).')[0].pass, true);
  assert.equal(checkKonzept(profile, '| Risk class | high |\n')[0].pass, true);
  assert.equal(checkKonzept(profile, '| Risikoklasse | high |\n')[0].pass, true);
  assert.equal(declaresAiActClass('AI-Act: highest priority', 'high'), false);   // whole word only
  assert.equal(declaresAiActClass('| Risk class | high |', 'minimal'), false);
});

test('checkKonzept: class outside the EU AI Act scale (e.g. prohibited) is a 🔴 finding', () => {
  const r = checkKonzept({ eu_ai_act_class: 'prohibited' }, 'EU AI Act class prohibited');
  assert.equal(r[0].pass, false);
  assert.match(r[0].label, /not on the EU AI Act scale/);
  assert.match(r[0].hint, /minimal \| limited \| high \| unacceptable/);
  assert.equal(checkKonzept({ eu_ai_act_class: 'unacceptable' }, 'EU AI Act class: unacceptable — must not be built')[0].pass, true);
});

test('checkKonzept: require_in_concept tokens', () => {
  const profile = { require_in_concept: ['Probabilistik-Statement', 'Glossar'] };
  const r = checkKonzept(profile, '## Probabilistik-Statement\n...\n## Glossar');
  assert.ok(r.every((x) => x.pass));
  const r2 = checkKonzept(profile, '## Glossar only');
  assert.equal(r2.find((x) => x.label.includes('Probabilistik')).pass, false);
});

test('checkKonzept: security_level=elevated requires threat modeling', () => {
  assert.equal(checkKonzept({ security_level: 'elevated' }, 'no security section')[0].pass, false);
  assert.equal(checkKonzept({ security_level: 'elevated' }, 'Threat-Modeling per §33.4')[0].pass, true);
  assert.equal(checkKonzept({ security_level: 'standard' }, 'whatever').length, 0);  // standard → no check
});

test('checkRepo: runtime + test framework signature', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(root, 'package.json'), '{}');
  mkdirSync(join(root, 'test'));
  writeFileSync(join(root, 'test', 'x.test.mjs'), "import { test } from 'node:test';\n");
  const r = checkRepo({ runtime: 'node', test_framework: 'node:test' }, root);
  assert.ok(r.every((x) => x.pass), JSON.stringify(r));
});

test('checkRepo: missing signature → drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(root, 'composer.json'), '{}');               // PHP repo …
  const r = checkRepo({ runtime: 'node', test_framework: 'node:test' }, root);  // … but node expected
  assert.ok(r.some((x) => !x.pass));
});

test('CLI runs from a path with a space (main guard) with the shipped template: exit 0 on a conformant repo, 1 on drift, 2 on usage', () => {
  const { root, script } = cliCopy();
  try {
    const repo = join(root, 'repo');
    mkdirSync(repo);
    writeFileSync(join(repo, 'package.json'), '{}');
    writeFileSync(join(repo, 'x.test.mjs'), "import { test } from 'node:test';\n");
    const template = join(root, 'skills', 'profile-check', 'project-profile.template.md');
    const ok = spawnSync('node', [script, `--profile=${template}`, `--repo=${repo}`], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /🟢 \(Repo\) runtime "node" in the repo/);
    assert.match(ok.stdout, /Conformant/);
    const konzept = join(root, 'konzept.md');
    writeFileSync(konzept, '# Concept\nHigh availability is required.\n');
    const bad = spawnSync('node', [script, `--profile=${template}`, `--konzept=${konzept}`, '--json'], { encoding: 'utf8' });
    assert.equal(bad.status, 1);
    const j = JSON.parse(bad.stdout);
    assert.ok(j.results.some((x) => x.sev === '🔴' && /EU AI Act class/.test(x.label)));
    assert.equal(spawnSync('node', [script, `--profile=${template}`], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
