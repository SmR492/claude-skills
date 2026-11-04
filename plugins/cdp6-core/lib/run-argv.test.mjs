import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ArgvError, CONTROL, SESSION_ID, SHELL_TOOLS, UNQUOTED, callShape, describeCall, ownerForm, parseCall, readRunCall, stripAppended, tokenize } from './run-argv.mjs';

const P = '/opt/plugin/cdp6-core';
const RUN = `${P}/scripts/run.mjs`;

function code(fn) {
  try {
    fn();
  } catch (e) {
    assert.ok(e instanceof ArgvError, String(e));
    return e.error;
  }
  return null;
}

test('tokenize reads the unquoted charset and whole quoted values', () => {
  assert.deepEqual(tokenize(`a-b.c:d/e@f+g=h 'x y' "p q"`), [
    { text: 'a-b.c:d/e@f+g=h', quoted: false },
    { text: 'x y', quoted: true },
    { text: 'p q', quoted: true },
  ]);
  assert.deepEqual(tokenize(`''`), [{ text: '', quoted: true }]);
});

test('tokenize refuses expansion, control, escape and mixed quoting', () => {
  const bad = ['{a,b}', '$x', '`id`', 'a*', 'a?', '[a]', '~', 'a;b', 'a|b', 'a&b', 'a>b', 'a<b', '(a)', 'a\\b', "gr''ant", `a'b'`, `"a"b`, `"$(id)"`, '"a`b"', '"a\\b"', `'a`, `"a`, 'a\tb', 'a\nb', 'a\u0000b', `'a\nb'`, '!x', '#x', '%x', '^x', ',x'];
  for (const text of bad) assert.equal(code(() => tokenize(text)), 'token-rule', JSON.stringify(text));
});

test('callShape ignores a command that does not name the script or a token flag', () => {
  assert.equal(callShape('ls -la', P), null);
  assert.equal(callShape('git status', P), null);
});

test('callShape accepts exactly node, the absolute script path and table tokens', () => {
  const r = callShape(`node ${RUN} rule x --why "a b"`, P);
  assert.deepEqual(r.tokens.map((t) => t.text), ['rule', 'x', '--why', 'a b']);
});

test('callShape refuses every other shape that names run.mjs or a token flag', () => {
  const bad = [
    `FOO=1 node ${RUN} status`,
    `NODE_OPTIONS=--require=./x.cjs node ${RUN} status`,
    `timeout 5 node ${RUN} status`,
    `node --require ./x.cjs ${RUN} status`,
    'node scripts/run.mjs status',
    `node ${RUN} status\nnode ${RUN} rule --human x --why y`,
    `node ${RUN} status; echo x`,
    `echo x | node ${RUN} status`,
    `grep run.mjs notes.md`,
    `echo --hook-token`,
    `node ${P}/scripts/../scripts/run.mjs status`,
    `node '${RUN}' status`,
    `'node' ${RUN} status`,
    `node ${RUN} 'status'`,
    `node ${RUN} status '--session-id' x`,
    `node ${RUN}`,
  ];
  for (const command of bad) assert.ok(code(() => callShape(command, P)) !== null, JSON.stringify(command));
});

test('parseCall reads one table form and refuses flag=value, unknown forms and extra positionals', () => {
  const c = parseCall(['object', 'F-P1-1', 'accept', '--why', 'x', '--session-id', 'S']);
  assert.equal(c.sub, 'object');
  assert.deepEqual(c.positionals, ['F-P1-1', 'accept']);
  assert.deepEqual(c.values.get('--why'), ['x']);
  assert.equal(code(() => parseCall(['init', '--mode=team'])), 'flag-form');
  assert.equal(code(() => parseCall(['frobnicate'])), 'unknown-subcommand');
  assert.equal(code(() => parseCall(['status', 'extra'])), 'positionals');
  assert.equal(code(() => parseCall(['status', '--bogus', 'x'])), 'unknown-flag');
  assert.equal(code(() => parseCall(['object', 'F-P1-1', 'accept', '--why', 'a', '--why', 'b'])), 'duplicate-flag');
  assert.equal(code(() => parseCall(["gr'ant"])), 'unknown-subcommand');
});

test('stripAppended removes the hook flags with their values', () => {
  const argv = ['enter', 'idea', '--session-id', 'S', '--data-dir', '/d', '--expect-sha256', 'h', '--hook-token', 'T'];
  assert.deepEqual(stripAppended(argv), { bare: ['enter', 'idea'], expect: ['h'] });
});

test('ownerForm marks owner commands by subcommand and flags', () => {
  const owner = (args, mode) => ownerForm(parseCall(args), mode);
  assert.equal(owner(['approve', 'concept']), true);
  assert.equal(owner(['set-autonomy', 'A1', '--tokens', '1', '--loops', '1']), true);
  assert.equal(owner(['object', 'F-P1-1', 'accept', '--why', 'x']), true);
  assert.equal(owner(['object', 'D-1-devils-advocate-agent-7:premise-1', 'accept', '--why', 'x']), true);
  assert.equal(owner(['veto', 'exit:concept', '--why', 'x']), true);
  assert.equal(owner(['rule', 'x', '--why', 'y', '--human']), true);
  assert.equal(owner(['rule', 'x', '--why', 'y']), false);
  assert.equal(owner(['init', '--start', 'concept', '--import', 'a.md']), true);
  assert.equal(owner(['init', '--mode', 'team']), true);
  assert.equal(owner(['init', '--mode', 'single']), false);
  assert.equal(owner(['init', '--start', 'idea']), false);
  assert.equal(owner(['decision', 'D-1', 'decided', '--decider', 'owner'], 'single'), true);
  assert.equal(owner(['decision', 'D-1', 'decided', '--decider', 'orchestrator'], 'multi'), false);
  assert.equal(owner(['decision', 'D-1', 'decided', '--decider', 'orchestrator'], 'single'), true);
  assert.equal(owner(['decision', 'D-1', 'decided', '--decider', 'operator'], 'single'), false);
  assert.equal(owner(['decision', 'D-1', 'decided', '--decider', 'operator'], 'multi'), true);
  assert.equal(owner(['decision', 'D-1', 'decided'], 'single'), false);
  assert.equal(owner(['decision', 'D-1', 'decided', '--decider', 'orchestrator']), true);
  assert.equal(owner(['decision', 'D-1', 'decided'], 'unknown'), true);
  assert.equal(owner(['decision', 'D-1', 'proposed', '--decider', 'owner']), false);
  for (const args of [['enter', 'idea'], ['exit', 'idea'], ['status'], ['id', 'D']]) assert.equal(owner(args), false, args.join(' '));
});

test('describeCall is built from the parsed subcommand, positionals and flag values only', () => {
  const c = parseCall(['veto', 'exit:concept', '--why', 'a b']);
  assert.equal(describeCall(c), 'veto exit:concept --why "a b"');
});

test('tokenize refuses U+2018 to U+201F in a quoted value and allows other non-ASCII text', () => {
  for (const ch of ['‘', '’', '‚', '‛', '“', '”', '„', '‟']) {
    assert.equal(code(() => tokenize(`'a${ch}b'`)), 'token-rule', ch);
    assert.equal(code(() => tokenize(`"a${ch}b"`)), 'token-rule', ch);
  }
  assert.deepEqual(tokenize(`'café ü 中 – …'`), [{ text: 'café ü 中 – …', quoted: true }]);
  assert.deepEqual(tokenize(`'a‗b' 'a†b'`).map((t) => t.text), ['a‗b', 'a†b']);
});

test('the parser exports its token patterns, the session id pattern and the shell tool list', () => {
  assert.equal(UNQUOTED.test('a-b.c:d/e@f+g=h'), true);
  assert.equal(UNQUOTED.test('a b'), false);
  assert.equal(UNQUOTED.test('a;b'), false);
  assert.equal(CONTROL.test('a\nb'), true);
  assert.equal(CONTROL.test('ab'), false);
  assert.equal(SESSION_ID.test('sess-1'), true);
  assert.equal(SESSION_ID.test('a b'), false);
  assert.equal(SESSION_ID.test('a'.repeat(129)), false);
  assert.deepEqual(SHELL_TOOLS, ['Bash', 'PowerShell', 'Monitor']);
});

test('readRunCall returns the parsed call and its words, null for a command that names no run.mjs, and throws for a bad form', () => {
  const env = { CLAUDE_PLUGIN_ROOT: P };
  const read = readRunCall(`node ${RUN} decision D-1 proposed --decider 'a b'`, env);
  assert.equal(read.call.sub, 'decision');
  assert.deepEqual(read.words, ['decision', 'D-1', 'proposed', '--decider', 'a b']);
  assert.equal(readRunCall('ls -la', env), null);
  assert.equal(code(() => readRunCall(`node ${RUN} frobnicate`, env)), 'unknown-subcommand');
  assert.equal(code(() => readRunCall(`node ${RUN} status; ls`, env)), 'token-rule');
});

test('hooks and run.mjs keep no copy of the parser constants', () => {
  const here = new URL('../', import.meta.url);
  const files = ['hooks/guard-shell.mjs', 'hooks/guard-phase.mjs', 'scripts/run.mjs', 'lib/run-argv.mjs'];
  const needles = ['A-Za-z0-9._:-]{1,128}', "['Bash', 'PowerShell', 'Monitor']", 'u0000-\\u001f'];
  for (const file of files) {
    const text = readFileSync(new URL(file, here), 'utf8');
    const copies = needles.filter((n) => text.includes(n)).length + (text.match(/A-Za-z0-9\._:\/@\+=-/g) ?? []).length;
    assert.equal(copies, file === 'lib/run-argv.mjs' ? 4 : 0, file);
  }
});

test('auditor F2: superseding a D-n is an owner command', () => {
  assert.equal(ownerForm(parseCall(['decision', 'D-2', 'superseded']), 'single'), true);
});
