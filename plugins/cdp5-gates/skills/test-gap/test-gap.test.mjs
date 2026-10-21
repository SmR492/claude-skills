import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, cpSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { findTestGaps, isTestPath } from './test-gap.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));

/** Copies lib + this skill into a temp directory whose path contains a space (main-guard regression). */
function cliCopy() {
  const root = mkdtempSync(join(tmpdir(), 'cdp5 gates-'));
  cpSync(join(HERE, '..', '..', 'lib'), join(root, 'lib'), { recursive: true });
  cpSync(HERE, join(root, 'skills', 'test-gap'), { recursive: true });
  return { root, script: join(root, 'skills', 'test-gap', 'test-gap.mjs') };
}

test('finds untested voters, ignores tested + non-security-critical classes', () => {
  const root = mkdtempSync(join(tmpdir(), 'tg-'));
  try {
    mkdirSync(join(root, 'src/Security'), { recursive: true });
    mkdirSync(join(root, 'src/Service'), { recursive: true });
    mkdirSync(join(root, 'tests'), { recursive: true });
    writeFileSync(join(root, 'src/Security/ArticleVoter.php'), '<?php\nclass ArticleVoter extends Voter {}\n');   // tested
    writeFileSync(join(root, 'src/Security/AdminVoter.php'), '<?php\nclass AdminVoter extends Voter {}\n');       // NO test
    writeFileSync(join(root, 'src/Service/PlainService.php'), '<?php\nclass PlainService {}\n');                  // not security-critical
    writeFileSync(join(root, 'tests/ArticleVoterTest.php'), '<?php\nclass ArticleVoterTest {}\n');
    const r = findTestGaps(root);
    assert.deepEqual(r.gaps.map((g) => g.class), ['AdminVoter']);
    assert.equal(r.gaps[0].sev, '🔴');
    assert.ok(r.covered.some((c) => c.class === 'ArticleVoter' && c.sev === '🟢'));
    assert.ok(!r.gaps.some((g) => g.class === 'PlainService'));
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('API Platform ProcessorInterface is not security-critical; StateProcessor/Authenticator(Interface) are', () => {
  const root = mkdtempSync(join(tmpdir(), 'tg-'));
  try {
    mkdirSync(join(root, 'src/State'), { recursive: true });
    writeFileSync(join(root, 'src/State/ArticlePersister.php'), '<?php\nfinal class ArticlePersister implements ProcessorInterface {}\n');   // generic processor → ignored
    writeFileSync(join(root, 'src/State/Publisher.php'), '<?php\nfinal class Publisher implements Foo, StateProcessorInterface {}\n');
    writeFileSync(join(root, 'src/State/ApiKeyGuard.php'), '<?php\nclass ApiKeyGuard implements AuthenticatorInterface {}\n');
    writeFileSync(join(root, 'src/State/Transition.php'), '<?php\nclass Transition implements StateProcessor {}\n');
    const gaps = findTestGaps(root).gaps.map((g) => g.class).sort();
    assert.deepEqual(gaps, ['ApiKeyGuard', 'Publisher', 'Transition']);
  } finally { rmSync(root, { recursive: true, force: true }); }
});

test('isTestPath recognises test directories on both separators and the *Test.php suffix', () => {
  assert.equal(isTestPath('/repo/tests/Unit/FooTest.php'), true);
  assert.equal(isTestPath('C:\\repo\\Tests\\Unit\\Helper.php'), true);
  assert.equal(isTestPath('/repo/Tests/Helper.php'), true);
  assert.equal(isTestPath('/repo/src/Attestsomething/Foo.php'), false);   // "tests" inside a word is not a directory
  assert.equal(isTestPath('/repo/src/FooTest.php'), true);
  assert.equal(isTestPath('/repo/src/Foo.php'), false);
});

test('CLI runs from a path with a space (main guard), prints 🔴/🟢 findings, exit 1 on gap / 0 without', () => {
  const { root, script } = cliCopy();
  try {
    const repo = join(root, 'repo');
    mkdirSync(join(repo, 'src'), { recursive: true });
    mkdirSync(join(repo, 'tests'), { recursive: true });
    writeFileSync(join(repo, 'src', 'AdminVoter.php'), '<?php\nclass AdminVoter extends Voter {}\n');
    const r = spawnSync('node', [script, `--repo=${repo}`], { encoding: 'utf8' });
    assert.equal(r.status, 1, r.stdout + r.stderr);
    assert.match(r.stdout, /Test-gap finder — 1 PHP files/);
    assert.match(r.stdout, /🔴 AdminVoter/);
    const j = spawnSync('node', [script, `--repo=${repo}`, '--json'], { encoding: 'utf8' });
    assert.equal(JSON.parse(j.stdout).gaps[0].sev, '🔴');
    writeFileSync(join(repo, 'tests', 'AdminVoterTest.php'), '<?php\nclass AdminVoterTest {}\n');
    const ok = spawnSync('node', [script, `--repo=${repo}`], { encoding: 'utf8' });
    assert.equal(ok.status, 0, ok.stdout + ok.stderr);
    assert.match(ok.stdout, /🟢 AdminVoter/);
    assert.equal(spawnSync('node', [script], { encoding: 'utf8' }).status, 2);
  } finally { rmSync(root, { recursive: true, force: true }); }
});
