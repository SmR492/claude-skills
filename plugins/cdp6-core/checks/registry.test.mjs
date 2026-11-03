import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const PLUGIN = dirname(HERE);
const GATES = join(PLUGIN, '..', 'cdp5-gates');
const registry = JSON.parse(readFileSync(join(HERE, 'registry.json'), 'utf8'));

const REFERENCED = ['konzept-lint', 'konzept-mapper', 'konzept-model-api', 'roadmap-drift', 'retro-memory-loop-check', 'ac-to-test-scaffold', 'secrets-scan', 'pii-scan', 'skill-lint', 'test-gap'];

function sha(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('pins the cdp5-gates version of the marketplace entry', () => {
  assert.equal(registry.pins['cdp5-gates'].version, '0.8.8');
  const gates = JSON.parse(readFileSync(join(GATES, '.claude-plugin', 'plugin.json'), 'utf8'));
  assert.equal(gates.version, registry.pins['cdp5-gates'].version);
});

test('fires: pinned script hash differs from the installed file', () => {
  const files = registry.pins['cdp5-gates'].files;
  assert.ok(Object.keys(files).length >= REFERENCED.length + 3);
  for (const [rel, hash] of Object.entries(files)) {
    assert.match(hash, /^[0-9a-f]{64}$/, rel);
    assert.equal(sha(join(GATES, rel)), hash, rel);
  }
});

test('every referenced checker, the shared modules and the policy are pinned', () => {
  const files = Object.keys(registry.pins['cdp5-gates'].files);
  for (const name of REFERENCED) assert.ok(files.includes(`skills/${name}/${name}.mjs`), name);
  for (const rel of ['lib/args.mjs', 'lib/scan.mjs', 'policy/reife-rubrik.policy.json']) assert.ok(files.includes(rel), rel);
});

test('maps each phase gate to existing own checkers', () => {
  const idea = registry.phases.idea.checkers.map((c) => c.name);
  assert.deepEqual(idea, ['idea-check', 'decision-check']);
  for (const c of registry.phases.idea.checkers) assert.ok(existsSync(join(PLUGIN, c.path)), c.path);
});
