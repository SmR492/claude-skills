import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { projectSettings } from './preflight-env.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

test('fires: a project settings file that turns every hook off fails the preflight', () => {
  const project = tempDir('cdp6-hooksoff-');
  mkdirSync(join(project, '.claude'));
  writeFileSync(join(project, '.claude', 'settings.json'), JSON.stringify({ disableAllHooks: true }));
  const failures = [];
  projectSettings({ args: { project } }, (check, item) => failures.push(`${check} ${item}`));
  assert.ok(failures.some((f) => /disableAllHooks/.test(f)), failures.join('; '));
});
