import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { writeFileSync } from 'node:fs';
import { fakeHost, npmHost, procEntry, underClaude } from '../test-support/claude-host.mjs';
import { stubClaude } from '../test-support/probe-fixture.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';
import { establishedVersion, runningVersion } from './running-version.mjs';

test('the ancestor walk finds the first ancestor recognised as Claude Code and reads its version from the executable', () => {
  const base = tempDir('cdp6-runver-');
  const host = fakeHost(base, '2.1.318');
  const res = runningVersion(host);
  assert.equal(res.version?.text, '2.1.318');
  assert.equal(res.pid, 10);
});

test('the walk reads the version of a node process running cli.js from the package.json of its package directory', () => {
  const base = tempDir('cdp6-runver-');
  const procRoot = join(base, 'proc');
  const pkg = npmHost(base, '2.1.320');
  procEntry(procRoot, 1, 0, '/sbin/init', ['/sbin/init']);
  procEntry(procRoot, 20, 1, '/usr/bin/node', ['node', pkg.cli]);
  procEntry(procRoot, 21, 20, '/usr/bin/node', ['node', 'run.mjs']);
  assert.equal(runningVersion({ procRoot, pid: 21 }).version?.text, '2.1.320');
});

test('fires: running version not established', () => {
  const base = tempDir('cdp6-runver-');
  const procRoot = join(base, 'proc');
  procEntry(procRoot, 1, 0, '/sbin/init', ['/sbin/init']);
  procEntry(procRoot, 30, 1, '/usr/bin/bash', ['bash']);
  procEntry(procRoot, 31, 30, '/usr/bin/node', ['node', 'run.mjs']);
  const res = runningVersion({ procRoot, pid: 31 });
  assert.equal(res.version, null);
  assert.match(res.error, /no ancestor/);
  const unreadable = join(base, 'proc2');
  procEntry(unreadable, 1, 0, '/sbin/init', ['/sbin/init']);
  procEntry(unreadable, 40, 1, join(base, 'missing', 'claude'), ['claude']);
  procEntry(unreadable, 41, 40, '/usr/bin/node', ['node']);
  assert.equal(runningVersion({ procRoot: unreadable, pid: 41 }).version, null);
});

test('a name that only looks like Claude Code does not make an ancestor the running process', () => {
  const base = tempDir('cdp6-runver-');
  const procRoot = join(base, 'proc');
  procEntry(procRoot, 1, 0, '/sbin/init', ['/sbin/init']);
  procEntry(procRoot, 50, 1, '/usr/bin/vim', ['claude']);
  procEntry(procRoot, 51, 50, '/usr/bin/node', ['node', '/home/u/cli.js']);
  assert.equal(runningVersion({ procRoot, pid: 51 }).version, null);
});

test('fires: PATH version differs from running version', () => {
  const base = tempDir('cdp6-runver-');
  const host = fakeHost(base, '2.1.318');
  const bin = join(base, 'bin');
  stubClaude(bin, '2.1.319');
  const res = establishedVersion({ PATH: `${bin}:/usr/bin:/bin` }, host);
  assert.equal(res.ok, false);
  assert.equal(res.error, 'path-version-differs');
  stubClaude(bin, '2.1.318');
  const same = establishedVersion({ PATH: `${bin}:/usr/bin:/bin` }, host);
  assert.equal(same.ok, true);
  assert.equal(same.version.text, '2.1.318');
});

test('fires: PATH version unreadable is a refusal, not a pass', () => {
  const base = tempDir('cdp6-runver-');
  const host = fakeHost(base, '2.1.318');
  const bin = join(base, 'bin');
  stubClaude(bin, null);
  assert.equal(establishedVersion({ PATH: `${bin}:/usr/bin:/bin` }, host).error, 'claude-version-unreadable');
});

test('the real process table of a node process run by a fake npm Claude Code install yields that install version', () => {
  const base = tempDir('cdp6-runver-');
  const host = npmHost(base, '2.1.321');
  const probe = join(base, 'probe.mjs');
  writeFileSync(probe, `import { runningVersion } from '${join(import.meta.dirname, 'running-version.mjs')}';\nprocess.stdout.write(JSON.stringify(runningVersion()));\n`);
  const r = underClaude(host, probe, [], { encoding: 'utf8' });
  assert.equal(JSON.parse(r.stdout).version.text, '2.1.321');
});
