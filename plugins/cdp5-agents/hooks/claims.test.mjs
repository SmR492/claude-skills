import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, copyFileSync, readFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { hedgedClaims, claimReason } from '../lib/claims.mjs';

const PLUGIN = new URL('..', import.meta.url).pathname.replace(/\/$/, '');
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
  ].join('\n');
  const hits = hedgedClaims(msg);
  assert.deepEqual(hits.map((h) => h.line), [2, 3, 4, 5, 6, 7]);
  assert.match(claimReason(hits), /rule 2/);
  assert.match(claimReason(hits), /line 2 \(hedged completion claim\)/);
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
    'Returned as nicht entscheidbar: whether the vendor will ship the fix.',
  ].join('\n');
  assert.deepEqual(hedgedClaims(msg), []);
});

test('check-ack blocks once on a hedged claim after the acknowledgement passed, then logs on the clean restatement', () => {
  const root = mkdtempSync(join(tmpdir(), 'cdp5-claims-'));
  const dir = join(root, 'skills', 'worker-contract');
  mkdirSync(dir, { recursive: true });
  copyFileSync(join(PLUGIN, 'skills', 'worker-contract', 'SKILL.md'), join(dir, 'SKILL.md'));
  const env = { PATH: process.env.PATH, HOME: root, CLAUDE_PLUGIN_ROOT: root, CLAUDE_PLUGIN_DATA: join(root, 'data') };
  try {
    assert.equal(spawnSync('node', [GENERATE], { env, encoding: 'utf8' }).status, 0);
    const hash = readFileSync(join(dir, 'core.md'), 'utf8').match(/sha256:([0-9a-f]{12})/)[1];
    const run = (message, active = false) => spawnSync('node', [CHECK], { env, encoding: 'utf8', input: JSON.stringify({ agent_type: 'cdp5-agents:impl-uc', stop_hook_active: active, last_assistant_message: message }) });
    const blocked = run(`contract: v1 ${hash}\nDone! The endpoint should work now.`);
    assert.equal(blocked.status, 0);
    const out = JSON.parse(blocked.stdout);
    assert.equal(out.decision, 'block');
    assert.match(out.reason, /predict or assume an outcome/);
    assert.ok(!existsSync(join(root, 'data', 'usage-log.jsonl')), 'a blocked run is not logged yet');
    const clean = run(`contract: v1 ${hash}\nEndpoint added; \`vendor/bin/phpunit tests/Api\` → exit 0, 12/12. The cache path was not verified (no Redis in the worktree).`);
    assert.equal(clean.status, 0);
    assert.equal(clean.stdout, '');
    assert.equal(readFileSync(join(root, 'data', 'usage-log.jsonl'), 'utf8').trim().split('\n').length, 1);
    const second = run(`contract: v1 ${hash}\nDone! It should work now.`, true);
    assert.equal(second.stdout, '', 'with stop_hook_active the hook never blocks twice');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
