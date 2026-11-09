import { chmodSync, existsSync, mkdirSync, readFileSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { tempDir } from './temp-dir.mjs';

export function nativeInstall(base, version) {
  const dir = join(base, 'share', 'claude', 'versions');
  mkdirSync(dir, { recursive: true });
  const file = join(dir, version);
  writeFileSync(file, `#!/bin/sh\necho "${version} (Claude Code)"\n`);
  chmodSync(file, 0o755);
  return file;
}

export function procEntry(procRoot, pid, ppid, exe, args, { cwd } = {}) {
  const dir = join(procRoot, String(pid));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'stat'), `${pid} (${exe.split('/').pop()}) S ${ppid} ${pid} ${pid} 0 -1 0 0 0 0 0\n`);
  writeFileSync(join(dir, 'cmdline'), args.join('\0'));
  symlinkSync(exe, join(dir, 'exe'));
  if (cwd) symlinkSync(cwd, join(dir, 'cwd'));
}

export function fakeHost(base, version, { self = 12 } = {}) {
  const procRoot = join(base, 'host-proc');
  const exe = nativeInstall(base, version);
  procEntry(procRoot, 1, 0, '/sbin/init', ['/sbin/init']);
  procEntry(procRoot, 10, 1, exe, ['claude']);
  procEntry(procRoot, 11, 10, '/usr/bin/bash', ['bash', '-c', 'node run.mjs']);
  procEntry(procRoot, self, 11, '/usr/bin/node', ['node', 'run.mjs']);
  return { procRoot, pid: self };
}

export function npmHost(base, version) {
  const dir = join(base, 'npm', 'node_modules', '@anthropic-ai', 'claude-code');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ name: '@anthropic-ai/claude-code', version }));
  const cli = join(dir, 'cli.js');
  writeFileSync(cli, "const { spawnSync } = require('node:child_process');\nconst [file, ...args] = process.argv.slice(2);\nconst r = spawnSync(process.execPath, [file, ...args], { stdio: 'inherit', env: process.env });\nprocess.exit(r.status ?? 1);\n");
  return { cli };
}

export function underClaude(host, file, args, options) {
  return spawnSync(process.execPath, [host.cli, file, ...args], options);
}

const quoted = (word) => `'${word.replaceAll("'", "'\\''")}'`;

export function orphaned(file, input, options) {
  const dir = tempDir('cdp6-orphan-');
  writeFileSync(join(dir, 'in'), input);
  const command = [process.execPath, file].map(quoted).join(' ');
  spawnSync('sh', ['-c', `(${command} < in > out 2> err; echo $? > status.tmp; mv status.tmp status) >/dev/null 2>&1 &`], { ...options, cwd: dir, encoding: 'utf8' });
  const end = Date.now() + 20000;
  while (!existsSync(join(dir, 'status')) && Date.now() < end) Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 25);
  const read = (name) => (existsSync(join(dir, name)) ? readFileSync(join(dir, name), 'utf8') : '');
  return { status: existsSync(join(dir, 'status')) ? Number(read('status')) : null, stdout: read('out'), stderr: read('err') };
}
