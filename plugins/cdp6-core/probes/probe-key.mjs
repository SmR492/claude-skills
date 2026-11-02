#!/usr/bin/env node
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { home } from './probe-log.mjs';

const PREFIX = 'PROBE-KEY-';

export function keyPath(env = process.env) {
  return join(home(env), '.config', 'cdp6-core', 'hook.key');
}

export function write(env) {
  if (env.CDP6_PROBE_ROW !== 'A-22') return 0;
  const file = keyPath(env);
  mkdirSync(dirname(file), { recursive: true });
  try {
    writeFileSync(file, `${PREFIX}${randomBytes(16).toString('hex')}`, { flag: 'wx', mode: 0o600 });
  } catch (e) {
    if (e.code !== 'EEXIST') throw e;
  }
  return 0;
}

export function remove(env) {
  const file = keyPath(env);
  let content;
  try {
    content = readFileSync(file, 'utf8');
  } catch {
    process.stdout.write(`absent: ${file}\n`);
    return 0;
  }
  if (!content.startsWith(PREFIX)) {
    process.stderr.write(`not a probe key, left in place: ${file}\n`);
    return 1;
  }
  rmSync(file);
  process.stdout.write(`deleted: ${file}\n`);
  return 0;
}

export function main(argv = process.argv.slice(2), env = process.env) {
  if (argv[0] === 'write') return write(env);
  if (argv[0] === 'delete') return remove(env);
  process.stderr.write('usage: probe-key.mjs write|delete\n');
  return 2;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
