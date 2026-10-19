import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, checkKonzept, checkRepo } from './profile-check.mjs';

test('parseFrontmatter reads scalars + lists', () => {
  const md = '---\nproject: Demo\neu_ai_act_class: minimal\nrequire_in_concept:\n  - Probabilistik-Statement\n  - "Vendor-Risiko"\n---\n# Body';
  const p = parseFrontmatter(md);
  assert.equal(p.project, 'Demo');
  assert.equal(p.eu_ai_act_class, 'minimal');
  assert.deepEqual(p.require_in_concept, ['Probabilistik-Statement', 'Vendor-Risiko']);
});

test('parseFrontmatter without frontmatter → {}', () => {
  assert.deepEqual(parseFrontmatter('# body only'), {});
});

test('checkKonzept: EU AI Act class must be declared', () => {
  const profile = { eu_ai_act_class: 'minimal' };
  const ok = checkKonzept(profile, 'All UCs are EU-AI-Act class minimal.');
  const fail = checkKonzept(profile, 'Concept without regulatory section.');
  assert.equal(ok[0].pass, true);
  assert.equal(fail[0].pass, false);
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
