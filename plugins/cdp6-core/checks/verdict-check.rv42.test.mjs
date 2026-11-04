import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCapture } from './verdict-check.mjs';
import { captureText } from '../lib/capture-fixture.mjs';

test('rv42: a counter-role other than the devils-advocate with verdict b and no objection fails the capture form of §5.3', () => {
  const r = validateCapture(captureText({ verdict: 'b' }), { agentType: 'cdp6-core:adversarial-auditor', captureId: 'S-1-adversarial-auditor-a1' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
});

test('rv42: a capture with two verdict lines fails the "exactly one verdict: line" rule of §5.3', () => {
  const r = validateCapture(`${captureText({ verdict: 'a' })}verdict: a\n`, { agentType: 'cdp6-core:devils-advocate', captureId: 'D-1-devils-advocate-a1' });
  assert.equal(r.validator, 'rejected', JSON.stringify(r));
});
