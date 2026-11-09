import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { agentName, captureBound, PLUGIN_PREFIXES, WRITING_WORKERS } from './agent-name.mjs';
import { isDevilsAdvocate } from './verdict-index.mjs';

test('strips only the cdp6-core prefix', () => {
  assert.deepEqual(PLUGIN_PREFIXES, ['cdp6-core:']);
  assert.equal(agentName('cdp6-core:impl-uc'), 'impl-uc');
});

test('fires: cdp5 and domain agents are not cdp6 agents', () => {
  assert.equal(agentName('cdp5-agents:impl-uc'), null);
  assert.equal(agentName('domain-agents:marketing-strategist'), null);
  assert.equal(agentName(undefined), null);
});

test('writing workers', () => {
  assert.ok(WRITING_WORKERS.has('impl-uc'));
  assert.ok(!WRITING_WORKERS.has('review-verify'));
});

test('in stage 1 only the devils-advocate role of cdp6-core is capture-bound', () => {
  assert.equal(captureBound('cdp6-core:devils-advocate'), true);
  for (const t of ['cdp6-core:impl-uc', 'cdp6-core:review-verify', 'cdp5-agents:devils-advocate', 'devils-advocate', undefined, null, '']) assert.equal(captureBound(t), false, String(t));
});

test('the capture-bound role set is defined once and verdict-index imports it', () => {
  const dir = dirname(fileURLToPath(import.meta.url));
  const index = readFileSync(join(dir, 'verdict-index.mjs'), 'utf8');
  assert.match(index, /import \{[^}]*captureBound[^}]*\} from '\.\/agent-name\.mjs'/);
  assert.doesNotMatch(index, /'devils-advocate'/);
  assert.equal(isDevilsAdvocate({ agent_type: 'cdp6-core:devils-advocate' }), true);
  assert.equal(isDevilsAdvocate({ agent_type: 'cdp6-core:impl-uc' }), false);
  assert.equal(isDevilsAdvocate({ agent_type: 'cdp5-agents:devils-advocate' }), false);
  assert.equal(isDevilsAdvocate(undefined), false);
});
