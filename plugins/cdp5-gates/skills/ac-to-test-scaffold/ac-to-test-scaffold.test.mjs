import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractACs, scaffold } from './ac-to-test-scaffold.mjs';

const MD = `**Scope:** x
## UC-01: Anlegen
### Akzeptanzkriterien
| AC-1 | User kann anlegen | Integration | ArticleControllerTest::testCreate | rot |
| AC-2 | Anonym → 401 | Integration | ArticleControllerTest::testAnon | rot |
## UC-02: Status
### Akzeptanzkriterien
| AC-3 | Übergang nur Admin | Unit | StateTest::testGuard | rot |
`;

test('extractACs liest AC-Zeilen + Klasse::Methode', () => {
  const acs = extractACs(MD);
  assert.equal(acs.length, 3);
  assert.deepEqual(acs[0], { uc: 'UC-01: Anlegen', id: 'AC-1', kriterium: 'User kann anlegen', klasse: 'ArticleControllerTest', methode: 'testCreate' });
});

test('PHP-Scaffold gruppiert je Klasse + markiert failing', () => {
  const r = scaffold(MD, 'php');
  assert.equal(Object.keys(r.byClass).length, 2);             // ArticleControllerTest + StateTest
  assert.ok(r.code.includes('class ArticleControllerTest'));
  assert.ok(r.code.includes('markTestIncomplete'));            // erst rot
  assert.ok(r.code.includes('// AC-1: User kann anlegen'));    // Kriterium als Kommentar
});

test('JS-Scaffold erzeugt failing node:test', () => {
  const r = scaffold(MD, 'js');
  assert.ok(r.code.includes("import { test } from 'node:test'"));
  assert.ok(r.code.includes('AC-3') && /throw new Error/.test(r.code));
});

test('ohne AC: count 0', () => {
  assert.equal(scaffold('## UC-01: X\nkein AC', 'php').count, 0);
});

test('extractACs erkennt H3-UCs unter `## N. Use Cases` (Dogfood: nicht nur H2)', () => {
  const md = '## 3. Use Cases\n### UC-01: Anlegen\n### Akzeptanzkriterien\n| AC-1 | x | Unit | FooTest::testX | rot |\n';
  const acs = extractACs(md);
  assert.equal(acs.length, 1);
  assert.equal(acs[0].klasse, 'FooTest');
});
