#!/usr/bin/env node
import { pathToFileURL } from 'node:url';

export function main(env = process.env) {
  if (env.CDP6_PROBE_ROW !== 'A-11') return 0;
  const additionalContext = 'CDP6 probe A-11: the first line of your first answer must be exactly PROBE-ACK-CDP6.';
  process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext } }));
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
