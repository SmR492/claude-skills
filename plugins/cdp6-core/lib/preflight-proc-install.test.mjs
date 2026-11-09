import test from 'node:test';
import assert from 'node:assert/strict';
import { chmodSync, mkdirSync, realpathSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { claudeBinaryDir, isClaudeProcess, readProcesses } from './preflight-proc.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

function fakeProc(proc, pid, name, cmdline, exe) {
  mkdirSync(join(proc, String(pid)), { recursive: true });
  writeFileSync(join(proc, String(pid), 'stat'), `${pid} (${name}) S 1 ${pid} ${pid} 0`);
  writeFileSync(join(proc, String(pid), 'cmdline'), cmdline);
  symlinkSync(exe, join(proc, String(pid), 'exe'));
}

test('fires: a Claude Code process of another install is recognised', () => {
  const base = tempDir('cdp6-proc-');
  const versions = join(base, 'share', 'claude', 'versions');
  mkdirSync(versions, { recursive: true });
  writeFileSync(join(versions, '2.1.318'), '#!/bin/sh\n');
  chmodSync(join(versions, '2.1.318'), 0o755);
  mkdirSync(join(base, 'bin'));
  symlinkSync(join(versions, '2.1.318'), join(base, 'bin', 'claude'));
  const proc = join(base, 'proc');
  fakeProc(proc, 4242, 'claude', 'claude\0', join(base, 'ide', 'anthropic.claude-code-2.1.318', 'resources', 'native-binary', 'claude'));
  fakeProc(proc, 4343, 'node', 'node\0/usr/lib/node_modules/@anthropic-ai/claude-code/cli.js\0', '/usr/bin/node');
  const table = readProcesses(proc);
  const dir = claudeBinaryDir({ PATH: join(base, 'bin') });
  assert.equal(dir, realpathSync(versions));
  assert.equal(isClaudeProcess(table.get(4242), dir), true);
  assert.equal(isClaudeProcess(table.get(4343), dir), true);
});
