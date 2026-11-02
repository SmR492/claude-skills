#!/usr/bin/env node
import { pathToFileURL } from 'node:url';
import { readInput, record } from './probe-log.mjs';

export async function main(argv = process.argv.slice(2), env = process.env) {
  const { input } = readInput();
  if (argv[0] === 'sleep') await new Promise((resolve) => setTimeout(resolve, Number(env.CDP6_PROBE_SLEEP_MS) || 20000));
  record('block-ran', input, { arg: argv[0] || null }, env);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main().then((code) => process.exit(code));
