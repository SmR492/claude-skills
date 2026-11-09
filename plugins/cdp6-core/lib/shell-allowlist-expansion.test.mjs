import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readOnlyCall } from './shell-allowlist.mjs';
import { tempDir } from '../test-support/temp-dir.mjs';

function repo() {
  const dir = tempDir('cdp6-allow-');
  const git = (...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  git('init', '-q');
  writeFileSync(join(dir, 'a.txt'), 'a\n');
  git('add', 'a.txt');
  writeFileSync(join(dir, 'a.txt'), 'b\n');
  return dir;
}

test('fires: a git flag that writes a file, spelled through bash quoting or brace expansion, passes the stop allowlist', () => {
  const dir = repo();
  const control = join(dir, 'control.out');
  const direct = `git diff --output=${control}`;
  spawnSync('bash', ['-c', direct], { cwd: dir });
  assert.equal(existsSync(control), true, 'positive control: git diff --output writes');
  assert.equal(readOnlyCall(direct), false);
  const cases = {
    'ansi-c.out': (f) => `git diff $'--output=${f}'`,
    'locale.out': (f) => `git diff $"--output=${f}"`,
    'brace.out': (f) => `git diff {--output=${f},--stat}`,
  };
  for (const [name, make] of Object.entries(cases)) {
    const file = join(dir, name);
    const command = make(file);
    spawnSync('bash', ['-c', command], { cwd: dir });
    assert.ok(!(existsSync(file) && readOnlyCall(command)), `${command} passes the allowlist and wrote ${file}`);
  }
});

test('fires: $\'…\', $"…" and brace words are not read-only during the stop', () => {
  for (const command of ["git diff $'--output=f'", 'git diff $"--output=f"', 'git diff {--output=f,--stat}', "git log -p $'--ext-diff'", 'git show {--textconv,HEAD}']) {
    assert.equal(readOnlyCall(command), false, command);
  }
});
