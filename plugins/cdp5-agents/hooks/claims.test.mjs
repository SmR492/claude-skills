import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hedgedClaims, claimReason } from '../lib/claims.mjs';
import { verify } from '../lib/contract.mjs';

const PLUGIN = fileURLToPath(new URL('..', import.meta.url)).replace(/\/$/, '');
const CHECK = join(PLUGIN, 'hooks', 'check-ack.mjs');
const GENERATE = join(PLUGIN, 'scripts', 'generate-contract.mjs');

test('hedged claims are found with line and reason', () => {
  const msg = [
    'contract: v1 abcdef123456',
    'Outcome: the fix is in place and should work now.',
    'Tests should pass after the change.',
    'Great! All done.',
    'This patch will resolve the race.',
    "I'm confident the build is fine.",
    'It seems to work in the container.',
    'The endpoint should be good to go.',
    'The tests are expected to pass on CI.',
    'That should be done.',
  ].join('\n');
  const hits = hedgedClaims(msg);
  assert.deepEqual(hits.map((h) => h.line), [2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.match(claimReason(hits), /rule 2/);
  assert.match(claimReason(hits), /line 2 \(hedged completion claim\)/);
  assert.equal(hits[6].why, 'hedged completion claim', 'be good to go');
  assert.equal(hits[7].why, 'outcome expected, not shown');
  assert.equal(hits[8].why, 'hedged completion claim', 'that should be done');
});

test('evidence lines, honest non-verification, quotes, tables and code blocks are not flagged', () => {
  const msg = [
    'contract: v1 abcdef123456',
    'Outcome: 34/34 tests pass (`npm test` → exit 0).',
    'The migration was not verified: no database in the environment. It should work once applied, but this is unverified.',
    '> author claim: "the voter should work for admins"',
    '| 3 | "tests should pass" | widerlegt | 2 failures, output below |',
    'The claim "it should work now" is refuted: see line 12.',
    '```',
    'echo "should work"',
    '```',
    'Follow-up: the cache layer probably needs the same fix; out of scope.',
    'Follow-up: this should be fixed in the next slice.',
    '- **Unverified**: the endpoint should work with the new header; no client in the worktree.',
    'Not run: the e2e suite should pass but the browser is missing here.',
    'Returned as nicht entscheidbar: whether the vendor will ship the fix.',
  ].join('\n');
  assert.deepEqual(hedgedClaims(msg), []);
});

test('subject-less and "everything" forms are claims; a hedge about a third party is not', () => {
  assert.equal(hedgedClaims('Should work now.').length, 1);
  assert.equal(hedgedClaims('Everything should be fine.').length, 1);
  assert.equal(hedgedClaims('Rebuilt the index. Should pass now.').length, 1);
  assert.equal(hedgedClaims('The reviewer should run the suite; the vendor will probably ship a fix.').length, 0);
});

test('apostrophes are not quotation marks; a quoted claim stays exempt', () => {
  assert.deepEqual(hedgedClaims("The user's endpoint should work now.").map((h) => h.line), [1]);
  assert.deepEqual(hedgedClaims("Don't worry, it should work now.").map((h) => h.line), [1]);
  assert.deepEqual(hedgedClaims("The author wrote 'it should work now' without a test run."), []);
  assert.deepEqual(hedgedClaims('The author wrote "it should work now" without a test run.'), []);
});

test('evidence on the same line exempts; a proposal about a subject is not a completion claim', () => {
  for (const line of [
    'The endpoint should work now: `curl -s localhost:8080/health` → exit 0.',
    'The fix should work now, see src/Voter.php:42.',
    'It should pass now; exit 0 from the runner.',
    'This should work now: 12/12 green.',
    'Proposal: the voter should be fixed to deny by default.',
    'The reviewer should probably run the suite again.',
  ]) assert.deepEqual(hedgedClaims(line), [], line);
});

test('follow-up exempts only the sentence it opens', () => {
  const hits = hedgedClaims('Follow-up: none. The endpoint should work now.');
  assert.equal(hits.length, 1);
  assert.equal(hits[0].why, 'hedged completion claim');
  assert.deepEqual(hedgedClaims('Not verified: the cache path. The endpoint should work now.').map((h) => h.why), ['hedged completion claim']);
  assert.deepEqual(hedgedClaims('No follow-up needed; the endpoint should work now.').map((h) => h.why), ['hedged completion claim']);
});

test('check-ack blocks once on a hedged claim after the acknowledgement passed, then logs on the clean restatement', () => {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-claims-'));
  const dir = join(root, 'skills', 'worker-contract');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), join(dir, 'SKILL.md'));
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  try {
    assert.equal(spawnSync('node', [GENERATE], { env, encoding: 'utf8' }).status, 0);
    const v = verify(root);
    assert.ok(v.ok, v.error);
    const ack = `contract: v${v.version} ${v.hash}`;
    const logFile = join(root, 'data', 'usage-log.jsonl');
    const results = () => readFileSync(logFile, 'utf8').trim().split('\n').map((l) => JSON.parse(l).result);
    const run = (message, active = false) => spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:impl-uc', stop_hook_active: active, last_assistant_message: message }) });
    const blocked = run(`${ack}\nDone! The endpoint should work now.`);
    assert.equal(blocked.status, 0);
    const out = JSON.parse(blocked.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /predict or assume an outcome/);
    assert.ok(!existsSync(logFile), 'a blocked run is not logged yet');
    const clean = run(`${ack}\nEndpoint added; \`vendor/bin/phpunit tests/Api\` → exit 0, 12/12. The cache path was not verified (no Redis in the worktree).`);
    assert.equal(clean.status, 0);
    assert.equal(clean.stdout, '');
    assert.deepEqual(results(), ['ok']);
    const second = run(`${ack}\nDone! It should work now.`, true);
    assert.equal(second.stdout, '', 'with stop_hook_active the hook never blocks twice');
    assert.deepEqual(results(), ['ok', 'hedged'], 'the restatement is checked and its result logged');
    const restated = run(`${ack}\nEndpoint added; \`npm test\` → exit 0.`, true);
    assert.equal(restated.stdout, '');
    assert.deepEqual(results(), ['ok', 'hedged', 'ok']);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
