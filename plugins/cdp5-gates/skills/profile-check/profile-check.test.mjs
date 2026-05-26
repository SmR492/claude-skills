import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseFrontmatter, checkKonzept, checkRepo } from './profile-check.mjs';

test('parseFrontmatter liest Skalare + Listen', () => {
  const md = '---\nproject: Demo\neu_ai_act_class: minimal\nrequire_in_concept:\n  - Probabilistik-Statement\n  - "Vendor-Risiko"\n---\n# Body';
  const p = parseFrontmatter(md);
  assert.equal(p.project, 'Demo');
  assert.equal(p.eu_ai_act_class, 'minimal');
  assert.deepEqual(p.require_in_concept, ['Probabilistik-Statement', 'Vendor-Risiko']);
});

test('parseFrontmatter ohne Frontmatter → {}', () => {
  assert.deepEqual(parseFrontmatter('# nur Body'), {});
});

test('checkKonzept: EU-AI-Act-Klasse muss deklariert sein', () => {
  const profile = { eu_ai_act_class: 'minimal' };
  const ok = checkKonzept(profile, 'Alle UCs sind EU-AI-Act-Klasse minimal.');
  const fail = checkKonzept(profile, 'Konzept ohne Regulatorik.');
  assert.equal(ok[0].pass, true);
  assert.equal(fail[0].pass, false);
});

test('checkKonzept: require_in_concept-Tokens', () => {
  const profile = { require_in_concept: ['Probabilistik-Statement', 'Glossar'] };
  const r = checkKonzept(profile, '## Probabilistik-Statement\n...\n## Glossar');
  assert.ok(r.every((x) => x.pass));
  const r2 = checkKonzept(profile, '## Glossar nur');
  assert.equal(r2.find((x) => x.label.includes('Probabilistik')).pass, false);
});

test('checkKonzept: security_level=elevated fordert Threat-Modeling', () => {
  assert.equal(checkKonzept({ security_level: 'elevated' }, 'kein Sicherheitsteil')[0].pass, false);
  assert.equal(checkKonzept({ security_level: 'elevated' }, 'Threat-Modeling nach §33.4')[0].pass, true);
  assert.equal(checkKonzept({ security_level: 'standard' }, 'egal').length, 0);  // standard → kein Check
});

test('checkRepo: Runtime + Test-Framework-Signatur', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(root, 'package.json'), '{}');
  mkdirSync(join(root, 'test'));
  writeFileSync(join(root, 'test', 'x.test.mjs'), "import { test } from 'node:test';\n");
  const r = checkRepo({ runtime: 'node', test_framework: 'node:test' }, root);
  assert.ok(r.every((x) => x.pass), JSON.stringify(r));
});

test('checkRepo: fehlende Signatur → Drift', () => {
  const root = mkdtempSync(join(tmpdir(), 'pc-'));
  writeFileSync(join(root, 'composer.json'), '{}');               // PHP-Repo …
  const r = checkRepo({ runtime: 'node', test_framework: 'node:test' }, root);  // … aber node erwartet
  assert.ok(r.some((x) => !x.pass));
});
