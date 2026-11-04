import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ArgvError, callShape, parseCall } from '../lib/run-argv.mjs';

const PLUGIN = dirname(dirname(fileURLToPath(import.meta.url)));
const SKILL = join(PLUGIN, 'skills', 'idea', 'SKILL.md');
const NOT_BUILT = ['ban', 'abandon'];

function body() {
  assert.ok(existsSync(SKILL), 'skills/idea/SKILL.md is missing');
  return readFileSync(SKILL, 'utf8');
}

function commands(text) {
  const out = [];
  for (const m of text.matchAll(/node \$\{CLAUDE_PLUGIN_ROOT\}\/scripts\/run\.mjs ([^`\n]+)/g)) out.push(m[1].trim());
  return out;
}

function parsed(text) {
  return commands(text).map((rest) => {
    const concrete = `node ${PLUGIN}/scripts/run.mjs ${rest}`.replace(/<[^>]+>/g, 'x');
    try {
      return { rest, call: parseCall(callShape(concrete, PLUGIN).tokens.map((t) => t.text)) };
    } catch (e) {
      if (e instanceof ArgvError) return { rest, error: e.error, sub: rest.split(' ')[0] };
      throw e;
    }
  });
}

test('the idea skill has the frontmatter of the cdp6-core:idea skill', () => {
  const text = body();
  const fm = /^---\n([\s\S]*?)\n---\n/.exec(text)?.[1] ?? '';
  assert.match(fm, /^name: idea$/m);
  assert.match(fm, /^description: .*\bUse when\b/m);
});

test('every run.mjs command of the idea skill parses with the shared parser, apart from the two not yet built', () => {
  const list = parsed(body());
  assert.ok(list.length >= 8, `${list.length} commands`);
  for (const item of list) {
    if (item.error) {
      assert.equal(item.error, 'unknown-subcommand', item.rest);
      assert.ok(NOT_BUILT.includes(item.sub), item.rest);
    } else {
      assert.ok(!item.rest.includes('--session-id') && !item.rest.includes('--data-dir') && !item.rest.includes('--hook-token'), item.rest);
    }
  }
});

test('the idea skill names the run.mjs commands of the UC-01 route and steps', () => {
  const subs = new Set(parsed(body()).map((i) => i.call?.sub ?? i.sub));
  for (const sub of ['init', 'enter', 'id', 'decision', 'set-autonomy', 'object', 'exit', 'status', 'ban', 'abandon']) assert.ok(subs.has(sub), sub);
  const text = body();
  assert.match(text, /run\.mjs enter idea/);
  assert.match(text, /decision D-1 decided --decider owner/);
  assert.match(text, /decision D-1 proposed/);
  assert.match(text, /exit idea/);
});

test('the idea skill states the steps of UC-01', () => {
  const text = body();
  for (const needle of ['Clarify-First', 'one question at a time', 'null option', 'delegated-default', 'devils-advocate', 'idea-check.mjs', 'decision-check.mjs', 'gate-pending', 'assignment.md', 'intake.md', 'idea.md']) {
    assert.ok(text.includes(needle), needle);
  }
});

function line(text, needle) {
  const found = text.split('\n').filter((l) => l.includes(needle));
  assert.equal(found.length, 1, needle);
  return found[0];
}

test('fires: the idea skill gives no wait instruction for a subcommand this release lacks', () => {
  assert.ok(!/tell the owner and wait/i.test(body()));
});

test('fires: the approach-decider check is named under idea-check.mjs and not under decision-check.mjs', () => {
  const text = body();
  assert.match(line(text, '- `idea-check.mjs`:'), /approach choice is decided with decider `owner`/);
  assert.doesNotMatch(line(text, '- `decision-check.mjs`:'), /decider `owner`/);
});

test('fires: ban and abandon are marked as not built in this release', () => {
  const text = body();
  assert.match(line(text, 'run.mjs ban`'), /not built in this release/);
  assert.match(line(text, 'run.mjs abandon --why'), /not built in this release/);
});

test('fires: the ban clause states only what UC-01 step 4.1 states, and step 5.2 states the verdict (c) rule', () => {
  const text = body();
  const ban = line(text, 'A constraint the owner wants enforced');
  assert.match(ban, /refuses it\)/);
  assert.ok(!ban.includes('so until it is built'), ban);
  assert.ok(!ban.includes('I-n` row only'), ban);
  const five = line(text, 'Verdict (b), (c) or a `conflicted` capture');
  assert.match(five, /under verdict \(c\) only `reject` clears an objection/i);
  assert.match(five, /acceptance is `run\.mjs abandon` \(not built in this release\)/);
});

test('fires: the idea skill reads the intake and the assignment from S/idea/ and names no copy of them in R', () => {
  const text = body();
  assert.match(text, /`S\/idea\/intake\.md`/);
  assert.match(text, /`S\/idea\/assignment\.md`/);
  assert.doesNotMatch(text, /R\/idea\/intake\.md/);
  assert.doesNotMatch(text, /R\/idea\/assignment\.md/);
});

test('fires: the idea skill tells the executor to create R at the printed path and to write R/idea/idea.md', () => {
  const text = body();
  const create = line(text, 'Create `R` at the path');
  assert.match(create, /run\.mjs init/);
  assert.match(create, /`R\/idea\/idea\.md`/);
  assert.match(create, /writes nothing into the project/);
});

test('fires: the idea skill states that the state directory holds the run record and is not edited', () => {
  const text = body();
  assert.match(text, /`S` is the state directory/);
  assert.match(text, /Edit nothing under `S`/);
  assert.doesNotMatch(text, /Edit `run\.json` never/);
});

test('fires: idea.md holds no D-n status and no autonomy level or budgets, the run record does', () => {
  const text = body();
  const artefact = line(text, '- `R/idea/idea.md`:');
  const [contents] = artefact.split('. The `D-n` status');
  assert.doesNotMatch(contents, /autonomy|budget|status|decider/i);
  assert.match(artefact, /Source column/);
  assert.match(artefact, /status and decider/);
  assert.match(artefact, /`run\.json` only/);
  assert.match(artefact, /run\.mjs decision/);
  assert.match(artefact, /run\.mjs set-autonomy/);
});

test('fires: the devils-advocate brief of step 3 carries task D-1 and the idea.md target, and idea.md is not edited after that spawn', () => {
  const step = line(body(), 'approach options with their costs');
  assert.match(step, /`task: D-1`/);
  assert.match(step, /`target: idea\/idea\.md@<sha256>`/);
  assert.match(step, /not edited after that spawn/);
  assert.match(step, /`stale`/);
});

test('auditor fix4 A7: the object command of the idea skill names the scoped item form of §5.3', () => {
  const t = body();
  assert.doesNotMatch(t, /run\.mjs object <objection-id>/);
  assert.match(t, /run\.mjs object <capture id>:F-P1-<n>/);
});

test('fires: the idea skill names the four owner record forms of concept §5.3', () => {
  const t = body();
  for (const form of ['<capture id>:F-P1-<n>', '<capture id>:premise-<n>', '<capture id>:conflict', '<capture id>:capture']) {
    assert.ok(t.includes(`run.mjs object ${form}`), form);
  }
});
