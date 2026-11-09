import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { chmodSync, mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tempDir } from '../test-support/temp-dir.mjs';
import { procEntry } from '../test-support/claude-host.mjs';
import { isClaudeProcess, readProcess } from './preflight-proc.mjs';

function npmBin(base) {
  const pkg = join(base, 'lib', 'node_modules', '@anthropic-ai', 'claude-code');
  mkdirSync(pkg, { recursive: true });
  writeFileSync(join(pkg, 'package.json'), JSON.stringify({ name: '@anthropic-ai/claude-code', version: '2.1.322' }));
  const cli = join(pkg, 'cli.js');
  writeFileSync(cli, "#!/usr/bin/env node\nconst { spawnSync } = require('node:child_process');\nconst r = spawnSync(process.execPath, process.argv.slice(2), { stdio: 'inherit' });\nprocess.exit(r.status ?? 1);\n");
  chmodSync(cli, 0o755);
  mkdirSync(join(base, 'bin'));
  const bin = join(base, 'bin', 'claude');
  symlinkSync(cli, bin);
  return bin;
}

test('fires: npm Claude Code started through its claude bin link is not the running version', () => {
  const base = tempDir('cdp6-npmbin-');
  const bin = npmBin(base);
  const probe = join(base, 'probe.mjs');
  writeFileSync(probe, `import { runningVersion } from '${join(import.meta.dirname, 'running-version.mjs')}';\nprocess.stdout.write(JSON.stringify(runningVersion()));\n`);
  const r = spawnSync(bin, [probe], { encoding: 'utf8', env: { ...process.env, PATH: `${dirname(process.execPath)}:/usr/bin:/bin` } });
  assert.equal(r.status, 0, r.stderr);
  assert.equal(JSON.parse(r.stdout).version?.text, '2.1.322');
});

test('fires: npm Claude Code not recognised', () => {
  const base = tempDir('cdp6-npmbin-');
  const bin = npmBin(base);
  const procRoot = join(base, 'proc');
  procEntry(procRoot, 60, 1, '/usr/bin/node', ['node', bin, '--resume', 'abc']);
  assert.equal(isClaudeProcess(readProcess(procRoot, 60)), true);
});
