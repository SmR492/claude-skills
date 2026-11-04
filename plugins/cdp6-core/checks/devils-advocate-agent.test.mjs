import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCapture } from './verdict-check.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const FILE = join(HERE, '..', 'agents', 'devils-advocate.md');
const TEXT = readFileSync(FILE, 'utf8');

function frontmatter() {
  const m = /^---\n([\s\S]*?)\n---\n/.exec(TEXT);
  assert.ok(m, 'no frontmatter');
  return Object.fromEntries(m[1].split('\n').map((l) => [l.slice(0, l.indexOf(':')), l.slice(l.indexOf(':') + 1).trim()]));
}

function form() {
  const m = /```text\n([\s\S]*?)```/.exec(TEXT);
  assert.ok(m, 'no output form block');
  return m[1];
}

test('frontmatter names the agent and limits the tools to Read, Grep and Glob', () => {
  const f = frontmatter();
  assert.equal(f.name, 'devils-advocate');
  assert.equal(f.tools, 'Read, Grep, Glob');
  assert.ok(f.description.length > 40);
});

test('the role names CDP6-CONTRACT v1, the cdp6 acknowledgement and the second answer line, and not the CDP5 contract', () => {
  assert.ok(TEXT.includes('CDP6-CONTRACT v1'));
  assert.ok(TEXT.includes('cdp6-contract: v1 <hash>'));
  assert.ok(TEXT.includes('`run: <run-id> task: <task>`'));
  assert.ok(!/WORKER-CONTRACT/.test(TEXT));
  assert.ok(!/(^|[^-])contract: v2/.test(TEXT));
});

test('no doctrine section number appears: the CDP6 concept states none for this role', () => {
  assert.ok(!/§/.test(TEXT));
});

test('the role carries O3, O4, the invalid-pass rule, step 8 and the conflict line as the concept words them', () => {
  assert.ok(TEXT.includes('"proposed, before any vote or decision on it and before it is executed"'));
  assert.ok(TEXT.includes('When the choice touches existing code or data, list the premises about their behaviour that it relies on, stated or implicit, derived from the code paths the brief names; mark each `checked` with file:line or with command output the brief supplies, or `unchecked`; otherwise write `premises: none, no existing code or data touched`.'));
  assert.match(TEXT, /\n4\. Premises and attack on the reasoning chain\. When the choice touches/);
  assert.match(TEXT, /\n8\. Consequence of `b` or `c`: execution stays blocked until the owner records acceptance or reasoned rejection per objection with `run\.mjs object`\./);
  assert.ok(!/in the ADR\./.test(TEXT.slice(TEXT.indexOf('\n8. Consequence'), TEXT.indexOf('Quotes run'))));
  assert.match(TEXT, /`fresh context: yes\|no` \(no part in the choice; `no` makes the pass invalid\)/);
  assert.match(TEXT, /`rejected alternative provided: yes\|no` \(`no` makes the pass invalid\)/);
  assert.ok(TEXT.includes('`conflict of interest: none | <what is at stake>`'));
  assert.match(TEXT, /\bnot-decidable\b/);
});

test('the output form block, with its placeholders filled, is a valid capture the checker reads as verdict a', () => {
  const filled = form()
    .replace('F-P<k>-<n>', 'F-P1-1')
    .replace('<artefact id>', 'idea/idea.md')
    .replace('<file:line>', 'idea/idea.md:12')
    .replace('<condition>', 'the section is shown')
    .replace('<hash>', 'abc')
    .replace('<run-id>', 'RUN-1')
    .replace('<task>', 'D-1');
  assert.ok(!/[<>]/.test(filled), filled);
  const r = validateCapture(filled, { agentType: 'cdp6-core:devils-advocate', captureId: 'D-1-devils-advocate-agent-7' });
  assert.deepEqual(r, { validator: 'valid', reasons: [], verdict: 'a', objections: ['F-P1-1'], premises: [], conflicted: false });
});

test('fires: the form with a premise row variant, a stake, or a missing key changes the checker result as the Output section says', () => {
  const base = form().replace('F-P<k>-<n>', 'F-P1-1').replace('<artefact id>', 'idea/idea.md').replace('<file:line>', 'idea/idea.md:12').replace('<condition>', 'x');
  const check = (text) => validateCapture(text, { agentType: 'cdp6-core:devils-advocate', captureId: 'D-1-devils-advocate-agent-7' });
  assert.equal(check(base.replace('premises: none, no existing code or data touched', 'premises:\n- the index is append only -- unchecked')).verdict, 'not-decidable');
  assert.equal(check(base.replace('conflict of interest: none', 'conflict of interest: wrote D-2')).conflicted, true);
  for (const key of ['fresh context: yes\n', 'rejected alternative provided: yes\n', 'conflict of interest: none\n', 'verdict: a\n']) assert.equal(check(base.replace(key, '')).validator, 'rejected', key);
});

test('fires: the role file names no role outside the CDP6 set of the concept, psy-grenzwaechter included, and keeps the private playbook sentence', () => {
  assert.doesNotMatch(TEXT, /psy-grenzwaechter/);
  assert.match(TEXT, /You do not work inside sensitive or private playbooks \(psy_\*, privat_\*, schwangerschaft_\*\) or running retros\. Private decisions about health, relationships, therapy or children are out of scope; private administrative, financial and legal decisions are in scope\./);
});

test('fires: the role file states every capture-form reject cause of concept §5.3 v0.5.9', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /anywhere/i, 'the objection-marker rule is not stated');
  assert.match(output, /outside the `premises:`/i, 'the premise-mark rule is not stated');
  assert.match(output, /fresh context: no/, 'fresh context no is not stated as invalidating the pass');
});

test('fires: the role file states the second verdict line, the premise mark in an objection line and that prose carries no objection', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /second `verdict:` line/i, 'the second verdict rule is not stated');
  assert.match(output, /inside an objection line/i, 'the premise mark in an objection line is not stated');
  assert.match(output, /prose carries no objection/i, 'the prose rule is not stated');
  assert.match(output, /objection id `F-P<k>-<n>` anywhere except/i, 'the objection id rule is not stated');
});

test('fires: the role file states the line grammar causes of concept §5.3 (g2 to g6)', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /objection line[^.]*exactly four fields[^.]*in this order/i, 'the four-field objection line is not stated');
  assert.match(output, /no (?:second|other) objection id and no premise mark in it/i, 'no second id or premise mark in an objection line is not stated');
  assert.match(output, /premise rows? only in the `premises:` section/i, 'premise rows only in the section is not stated');
  assert.match(output, /ends at the first line that does not start with `- `/i, 'the section end is not stated');
  assert.match(output, /`> ` quote line/i, 'the quote form is not stated');
  assert.match(output, /verbatim assignment[^.]*`> `|`> `[^.]*verbatim assignment/i, 'the quote form for the verbatim assignment is not stated');
  assert.match(output, /`disposition: <item> resolved <id or file:line> \| upheld \| withdrawn <id or file:line>/, 'the disposition line is not stated');
  assert.match(output, /`upheld` disposition rejects/i, 'the upheld rule is not stated');
  assert.match(output, /objection id or a premise mark in prose rejects/i, 'the prose rule is not stated');
});

test('rv56 F2: the role file says that " | " separates the objection fields and appears inside no field', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /` \| `[^.]*(?:inside|within|in) (?:a|any|no) field/i);
});

test('rv56 F3: step 8 of the role file asks for the owner records without an objection id in prose', () => {
  const step8 = TEXT.split('\n').find((l) => l.startsWith('8. '));
  assert.ok(step8, 'step 8 is missing');
  assert.match(step8, /without (?:an|any) objection id/i, step8);
});

test('fires: step 8 of the Output section asks for what the owner records, pointing to the objection lines without an objection id', () => {
  const step8 = TEXT.slice(TEXT.indexOf('## Output')).split('\n').find((l) => l.startsWith('8. '));
  assert.ok(step8, 'step 8 of the Output section is missing');
  assert.match(step8, /what the owner records, pointing to the objection lines above without an objection id/i, step8);
  assert.doesNotMatch(step8, /per objection\./, step8);
});

test('rv62 R1: the Output section says that only the item of a disposition line may carry an objection id', () => {
  const output = TEXT.slice(TEXT.indexOf('## Output'));
  assert.match(output, /only the `<item>` of a disposition line may carry an objection id/i);
});
