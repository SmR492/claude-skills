import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { extractACs, scaffold, parseUCs } from './ac-to-test-scaffold.mjs';
import { parseUCs as mapperParseUCs } from '../konzept-mapper/konzept-mapper.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Copies lib + this skill into a temp directory whose path contains a space (main-guard regression). */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'ac-to-test-scaffold'), { recursive: true });
  return { root, script: join(root, 'skills', 'ac-to-test-scaffold', 'ac-to-test-scaffold.mjs') };
}

// Fixture imitates a German concept document (headings such as "Akzeptanzkriterien" stay German).
const MD = `**Scope:** x
## UC-01: Anlegen
### Akzeptanzkriterien
| AC-1 | User kann anlegen | Integration | ArticleControllerTest::testCreate | rot |
| AC-2 | Anonym → 401 | Integration | ArticleControllerTest::testAnon | rot |
## UC-02: Status
### Akzeptanzkriterien
| AC-3 | Transition admin only | Unit | StateTest::testGuard | rot |
`;

test('extractACs reads AC rows + Class::method', () => {
  const acs = extractACs(MD);
  assert.equal(acs.length, 3);
  assert.deepEqual(acs[0], { uc: 'UC-01: Anlegen', id: 'AC-1', kriterium: 'User kann anlegen', klasse: 'ArticleControllerTest', methode: 'testCreate' });
});

test('PHP scaffold groups per class + marks each method as incomplete placeholder', () => {
  const r = scaffold(MD, 'php');
  assert.equal(Object.keys(r.byClass).length, 2);             // ArticleControllerTest + StateTest
  assert.ok(r.code.includes('class ArticleControllerTest'));
  assert.ok(r.code.includes('markTestIncomplete'));            // placeholder (incomplete/todo)
  assert.ok(r.code.includes('// AC-1: User kann anlegen'));    // criterion as comment
});

test('JS scaffold emits placeholder node:test entries (throw until implemented)', () => {
  const r = scaffold(MD, 'js');
  assert.ok(r.code.includes("import { test } from 'node:test'"));
  assert.ok(r.code.includes('AC-3') && /throw new Error/.test(r.code));
});

test('without ACs: count 0', () => {
  assert.equal(scaffold('## UC-01: X\nno AC', 'php').count, 0);
});

test('extractACs recognises H3 UCs under `## N. Use Cases` (dogfood: not only H2)', () => {
  const md = '## 3. Use Cases\n### UC-01: Anlegen\n### Akzeptanzkriterien\n| AC-1 | x | Unit | FooTest::testX | rot |\n';
  const acs = extractACs(md);
  assert.equal(acs.length, 1);
  assert.equal(acs[0].klasse, 'FooTest');
});

test('scaffold and mapper share one UC parser: identical UC count for H3 UCs under a numbered section', () => {
  const md = '## 3. Use Cases\n### UC-01: A\n| AC-1 | x | Unit | FooTest::a | rot |\n### UC-02: B\n| AC-2 | y | Unit | FooTest::b | rot |\n## 4. Glossar\n';
  assert.equal(parseUCs(md).length, 2);
  assert.equal(mapperParseUCs(md).length, parseUCs(md).length);
  assert.equal(extractACs(md).length, 2);
});

test('CLI runs from a path with a space (main guard): prints the scaffold (exit 0), exit 2 without ACs or usage', () => {
  const { root, script } = cliCopy();
  try {
    const k = join(root, 'konzept.md');
    writeFileSync(k, MD);
    const r = spawnSync('node', [script, `--konzept=${k}`], { encoding: 'utf8' });
    assert.equal(r.status, 0, r.stdout + r.stderr);
    assert.match(r.stdout, /final class ArticleControllerTest extends/);
    assert.match(r.stderr, /3 AC → 2 test class\(es\)/);
    const js = spawnSync('node', [script, `--konzept=${k}`, '--lang=js'], { encoding: 'utf8' });
    assert.match(js.stdout, /import \{ test \} from 'node:test'/);
    writeFileSync(k, '## UC-01: X\nno AC table here\n');
    const none = spawnSync('node', [script, `--konzept=${k}`], { encoding: 'utf8' });
    assert.equal(none.status, 2, 'no ACs is an input state, not a finding');
    assert.match(none.stderr, /No AC tables found — run `konzept-lint` first/);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
