import test from 'node:test';
import assert from 'node:assert/strict';
import { agentName, PLUGIN_PREFIXES, WRITING_WORKERS } from './agent-name.mjs';

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
