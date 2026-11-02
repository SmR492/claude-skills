#!/usr/bin/env node
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';

export function home(env = process.env) {
  return env.HOME || env.USERPROFILE || homedir();
}

export function logPath(env = process.env) {
  return env.CDP6_PROBE_LOG || join(home(env), '.cache', 'cdp6-probe', 'probe-log.jsonl');
}

export function record(tag, input, extra = {}, env = process.env) {
  const file = logPath(env);
  mkdirSync(dirname(file), { recursive: true });
  appendFileSync(file, `${JSON.stringify({ ts: new Date().toISOString(), tag, event: input && input.hook_event_name, input, ...extra })}\n`);
}

export function readInput() {
  const raw = readFileSync(0, 'utf8').replace(/^﻿/, '');
  try {
    return { input: JSON.parse(raw || '{}') };
  } catch {
    return { input: null, raw };
  }
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const { input, raw } = readInput();
  record(argv[0] || 'all', input, raw === undefined ? {} : { raw }, env);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
