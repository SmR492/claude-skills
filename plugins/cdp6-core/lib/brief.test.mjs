import test from 'node:test';
import assert from 'node:assert/strict';
import { parseBrief } from './brief.mjs';

const H1 = 'a'.repeat(64);
const H2 = 'b'.repeat(64);

const BASE = [
  'run: RUN-20261103-x',
  'phase: implementation',
  'task: S-1',
  'role: impl-uc',
  'round: 1',
  'brief: /r/briefs/s1.md',
  'env: /r/.worktrees/w base 960146b3f8e5884a4a9f93f1077e793cedd6e14a',
];

const text = (lines, tail = '\nRead your brief at /r/briefs/s1.md.\n') => `${lines.join('\n')}\n${tail}`;

test('parses the required fields and an env with a worktree and base', () => {
  const r = parseBrief(text(BASE));
  assert.equal(r.ok, true);
  assert.deepEqual(r.header, {
    run: 'RUN-20261103-x',
    phase: 'implementation',
    task: 'S-1',
    role: 'impl-uc',
    round: 1,
    brief: '/r/briefs/s1.md',
    env: { path: '/r/.worktrees/w', base: '960146b3f8e5884a4a9f93f1077e793cedd6e14a' },
    targets: [],
    cited: [],
    writes: [],
    clears: null,
  });
});

test('parses env none, repeated target, cited and writes lines and clears', () => {
  const lines = [...BASE.slice(0, 6), 'env: none', `target: docs/a.md@${H1}`, `target: docs/b c.md@${H2}`, 'cited: docs/adr/1.md', 'cited: docs/adr/2.md', 'writes: out/x.md', 'clears: V-3'];
  const r = parseBrief(text(lines));
  assert.equal(r.ok, true);
  assert.equal(r.header.env, 'none');
  assert.deepEqual(r.header.targets, [{ path: 'docs/a.md', sha256: H1 }, { path: 'docs/b c.md', sha256: H2 }]);
  assert.deepEqual(r.header.cited, ['docs/adr/1.md', 'docs/adr/2.md']);
  assert.deepEqual(r.header.writes, ['out/x.md']);
  assert.equal(r.header.clears, 'V-3');
});

test('a BOM or CRLF text parses like the plain one', () => {
  const plain = parseBrief(text(BASE));
  const odd = parseBrief(`﻿${text(BASE).replace(/\n/g, '\r\n')}`);
  assert.deepEqual(odd, plain);
});

test('fires: bad header returns a structured error naming the first bad line', () => {
  const cases = [
    ['not text', undefined, { code: 'no-header', line: 1 }],
    ['empty text', '', { code: 'no-header', line: 1 }],
    ['first line is prose', '# Brief SL-2\n\nrun: x\n', { code: 'bad-line', line: 1, text: '# Brief SL-2' }],
    ['unknown field', text([...BASE, 'colour: red']), { code: 'unknown-field', line: 8, text: 'colour: red' }],
    ['duplicate single field', text([...BASE, 'task: S-2']), { code: 'duplicate-field', line: 8, text: 'task: S-2' }],
    ['empty value', text([...BASE.slice(0, 2), 'task:', ...BASE.slice(3)]), { code: 'bad-line', line: 3, text: 'task:' }],
    ['round not an integer', text([...BASE.slice(0, 4), 'round: one', ...BASE.slice(5)]), { code: 'bad-value', line: 5, text: 'round: one' }],
    ['env without base', text([...BASE.slice(0, 6), 'env: /r/.worktrees/w']), { code: 'bad-value', line: 7, text: 'env: /r/.worktrees/w' }],
    ['target without hash', text([...BASE, 'target: docs/a.md']), { code: 'bad-value', line: 8, text: 'target: docs/a.md' }],
    ['target with a short hash', text([...BASE, 'target: docs/a.md@abc']), { code: 'bad-value', line: 8, text: 'target: docs/a.md@abc' }],
    ['target with uppercase hex', text([...BASE, `target: docs/a.md@${'A'.repeat(64)}`]), { code: 'bad-value', line: 8, text: `target: docs/a.md@${'A'.repeat(64)}` }],
    ['two clears lines', text([...BASE, 'clears: V-1', 'clears: V-2']), { code: 'duplicate-field', line: 9, text: 'clears: V-2' }],
    ['second bad line is not reported first', text([...BASE, 'round: 2', 'target: x']), { code: 'duplicate-field', line: 8, text: 'round: 2' }],
  ];
  for (const [name, input, want] of cases) {
    const r = parseBrief(input);
    assert.equal(r.ok, false, name);
    assert.equal(r.error.code, want.code, name);
    assert.equal(r.error.line, want.line, name);
    if (want.text) assert.equal(r.error.text, want.text, name);
    assert.equal(typeof r.error.message, 'string', name);
  }
});

test('a missing required field is named, with the line after the header', () => {
  const r = parseBrief(text(BASE.filter((l) => !l.startsWith('phase:'))));
  assert.equal(r.ok, false);
  assert.equal(r.error.code, 'missing-field');
  assert.equal(r.error.field, 'phase');
  assert.equal(r.error.line, 7);
  const all = parseBrief('');
  assert.equal(all.error.code, 'no-header');
});

test('only the opening block is the header: later lines are not read', () => {
  const r = parseBrief(text(BASE, '\ncolour: red\nround: 9\n'));
  assert.equal(r.ok, true);
  assert.equal(r.header.round, 1);
});

test('fires: a task outside [A-Za-z0-9._-] is a malformed value, one inside is read', () => {
  for (const task of ['../evil', 'a b', 'x/y', 'D-1;rm', 'a:b', 'é']) {
    const r = parseBrief(text(BASE.map((l) => (l.startsWith('task:') ? `task: ${task}` : l))));
    assert.equal(r.ok, false, task);
    assert.equal(r.error.code, 'bad-value', task);
    assert.equal(r.error.line, 3, task);
  }
  for (const task of ['S-1', 'D-12', 'P3-gate', 'a.b_c-1']) {
    assert.equal(parseBrief(text(BASE.map((l) => (l.startsWith('task:') ? `task: ${task}` : l)))).ok, true, task);
  }
});
