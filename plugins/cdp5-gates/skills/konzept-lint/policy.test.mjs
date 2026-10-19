import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parsePolicy, generate, POLICY_MD, POLICY_JSON } from '../../scripts/generate-rubric.mjs';

const GENERATE = join(POLICY_MD, '..', '..', 'scripts', 'generate-rubric.mjs');

test('policy Markdown parses: version, threshold 8.0, 11 gate items, 7 dimensions summing to 1.0', () => {
  const p = parsePolicy(readFileSync(POLICY_MD, 'utf8'));
  assert.equal(p.version, 2);
  assert.equal(p.threshold, 8);
  assert.equal(p.gate.length, 11);
  assert.equal(p.dimensions.length, 7);
  assert.equal(p.gate.filter((g) => g.kind === 'det').length, 8);
  assert.equal(p.gate.filter((g) => g.kind === 'jdg').length, 3);
  assert.ok(Math.abs(p.dimensions.reduce((s, d) => s + d.weight, 0) - 1) < 1e-9);
  assert.ok(Math.abs(Object.values(p.weights).reduce((s, w) => s + w, 0) - 0.8) < 1e-9, 'deterministic and mixed weight is 0.80');
});

test('committed policy JSON is current (--check passes)', () => {
  const r = generate({ check: true });
  assert.equal(r.changed, false, r.reason);
});

test('mutation: a changed weight in the Markdown makes --check fail; a wrong sum is rejected', () => {
  const dir = mkdtempSync(join(tmpdir(), 'policy-'));
  const md = readFileSync(POLICY_MD, 'utf8');
  const out = join(dir, 'p.json');
  generate({ md: POLICY_MD, out });
  writeFileSync(join(dir, 'shifted.md'), md.replace('| 0.20 | det | konzept-lint |', '| 0.15 | det | konzept-lint |').replace('| 0.10 | det | konzept-lint |', '| 0.15 | det | konzept-lint |'));
  assert.equal(generate({ md: join(dir, 'shifted.md'), out, check: true }).changed, true);
  writeFileSync(join(dir, 'broken.md'), md.replace('| 0.20 | det | konzept-lint |', '| 0.50 | det | konzept-lint |'));
  assert.throws(() => parsePolicy(readFileSync(join(dir, 'broken.md'), 'utf8')), /sum to/);
});

test('CLI --check exits 0 on the committed files', () => {
  const out = execFileSync('node', [GENERATE, '--check'], { stdio: 'pipe' }).toString();
  assert.match(out, /current/);
  assert.ok(readFileSync(POLICY_JSON, 'utf8').includes('"threshold": 8'));
});
