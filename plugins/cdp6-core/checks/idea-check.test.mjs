import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { initRun } from '../lib/run-store.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

const CHECK = join(dirname(fileURLToPath(import.meta.url)), 'idea-check.mjs');

const SECTIONS = ['Assignment', 'Problem', 'Goals', 'Non-goals', 'Constraints', 'Success measures', 'Decisions', 'Approach options'];

function ideaMd(skip = []) {
  return `# Idea\n\n${SECTIONS.filter((s) => !skip.includes(s)).map((s) => `## ${s}\n\n- content for ${s}\n`).join('\n')}`;
}

function fixture({ skip = [], decision } = {}) {
  const base = tempDir('cdp6-ic-');
  const S = join(base, 'state', 'RUN-20260101-x');
  const snapshot = join(base, 'snapshot');
  const decisions = {};
  const chosen = decision === undefined ? { status: 'decided', decider: 'owner' } : decision;
  if (chosen) {
    decisions['D-1'] = {
      status: chosen.status,
      decider: chosen.decider,
      stamps: [{ status: 'proposed', at: '2026-01-01T10:00:00.000Z', decider: 'operator' }, { status: chosen.status, at: '2026-01-01T11:00:00.000Z', decider: chosen.decider }],
    };
  }
  initRun(S, { run_id: 'RUN-20260101-x', status: 'active', ids: { next: { D: 2 } }, decisions, owner_records: [], phases: {} });
  mkdirSync(join(snapshot, 'idea'), { recursive: true });
  writeFileSync(join(snapshot, 'idea', 'idea.md'), ideaMd(skip));
  return { S, snapshot };
}

function check({ S, snapshot }) {
  const r = spawnSync(process.execPath, [CHECK, '--run-dir', S, ...(snapshot ? ['--snapshot', snapshot] : [])], { encoding: 'utf8' });
  return { status: r.status, out: `${r.stdout}${r.stderr}` };
}

test('passes a complete idea.md with an approach choice decided by the owner', () => {
  const r = check(fixture());
  assert.equal(r.status, 0, r.out);
});

test('fires: missing non-goals', () => {
  const r = check(fixture({ skip: ['Non-goals'] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /missing section: Non-goals/);
});

test('names every missing section', () => {
  const r = check(fixture({ skip: ['Goals', 'Constraints'] }));
  assert.equal(r.status, 1);
  assert.match(r.out, /missing section: Goals/);
  assert.match(r.out, /missing section: Constraints/);
  assert.doesNotMatch(r.out, /missing section: Non-goals/);
});

test('fires: approach chosen without owner', () => {
  const r = check(fixture({ decision: { status: 'decided', decider: 'operator' } }));
  assert.equal(r.status, 1);
  assert.match(r.out, /D-1/);
  assert.match(r.out, /owner/);
  assert.match(r.out, /operator/);
});

test('fires: approach choice not decided', () => {
  assert.equal(check(fixture({ decision: { status: 'proposed', decider: 'operator' } })).status, 1);
  const missing = check(fixture({ decision: null }));
  assert.equal(missing.status, 1);
  assert.match(missing.out, /D-1/);
});

test('fires: idea.md missing', () => {
  const fx = fixture();
  const other = fixture();
  rmSync(join(other.snapshot, 'idea', 'idea.md'));
  const r = check(other);
  assert.equal(r.status, 1);
  assert.match(r.out, /idea\.md/);
  assert.equal(check(fx).status, 0);
});

test('reads idea.md from the snapshot and never from a file beside run.json', () => {
  const fx = fixture({ skip: ['Non-goals'] });
  mkdirSync(join(fx.S, 'idea'), { recursive: true });
  writeFileSync(join(fx.S, 'idea', 'idea.md'), ideaMd());
  const r = check(fx);
  assert.equal(r.status, 1);
  assert.match(r.out, /missing section: Non-goals/);
});

test('usage, a missing snapshot argument and an unreadable run record exit 2', () => {
  const none = spawnSync(process.execPath, [CHECK], { encoding: 'utf8' });
  assert.equal(none.status, 2);
  const fx = fixture();
  assert.equal(check({ S: fx.S }).status, 2);
  writeFileSync(join(fx.S, 'run.json'), '{"run_id"');
  assert.equal(check(fx).status, 2);
});
