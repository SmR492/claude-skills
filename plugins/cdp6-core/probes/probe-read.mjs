#!/usr/bin/env node
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { home, readInput, record } from './probe-log.mjs';

export function sumUsage(path) {
  if (!path) return null;
  let text;
  try {
    text = readFileSync(path, 'utf8');
  } catch (e) {
    return { path, error: e.code || 'ERR' };
  }
  const seen = new Set();
  const sum = { path, messages: 0, input: 0, output: 0, cacheCreation: 0, cacheRead: 0 };
  for (const line of text.split('\n')) {
    let message;
    try {
      message = JSON.parse(line).message;
    } catch {
      continue;
    }
    const usage = message && message.usage;
    if (!usage || (message.id && seen.has(message.id))) continue;
    if (message.id) seen.add(message.id);
    sum.messages += 1;
    sum.input += usage.input_tokens || 0;
    sum.output += usage.output_tokens || 0;
    sum.cacheCreation += usage.cache_creation_input_tokens || 0;
    sum.cacheRead += usage.cache_read_input_tokens || 0;
  }
  return sum;
}

function teamDir(input, env) {
  const name = typeof input.team_name === 'string' && input.team_name ? input.team_name : `session-${String(input.session_id).slice(0, 8)}`;
  return join(home(env), '.claude', 'teams', name);
}

export function mailbox(input, env) {
  const dir = join(teamDir(input, env), 'inboxes');
  try {
    const files = {};
    for (const name of readdirSync(dir)) {
      const raw = readFileSync(join(dir, name), 'utf8');
      try {
        files[name] = JSON.parse(raw);
      } catch {
        files[name] = raw;
      }
    }
    return { dir, files };
  } catch (e) {
    return { dir, error: e.code || 'ERR' };
  }
}

export function team(input, env) {
  const path = join(teamDir(input, env), 'config.json');
  try {
    return { path, members: JSON.parse(readFileSync(path, 'utf8')).members };
  } catch (e) {
    return { path, error: e.code || 'ERR' };
  }
}

export function keyRead(env) {
  try {
    return { readable: true, bytes: readFileSync(join(home(env), '.config', 'cdp6-core', 'hook.key')).length };
  } catch (e) {
    return { readable: false, error: e.code || 'ERR' };
  }
}

export function markerSearch(input) {
  const token = `PROBE-MARKER-${input.session_id}`;
  try {
    const count = readFileSync(input.transcript_path, 'utf8').split(token).length - 1;
    return { token, found: count > 0, count };
  } catch (e) {
    return { token, found: false, error: e.code || 'ERR' };
  }
}

export function main(argv = process.argv.slice(2), env = process.env) {
  const { input } = readInput();
  if (!input) return 0;
  const mode = argv[0];
  if ((mode === 'key' || mode === 'marker') && env.CDP6_PROBE_ROW !== 'A-22') return 0;
  if (mode === 'team' && env.CDP6_PROBE_ROW !== 'A-16') return 0;
  const extra = {
    usage: () => ({ agent_id: input.agent_id, agent: sumUsage(input.agent_transcript_path), main: sumUsage(input.transcript_path) }),
    mailbox: () => mailbox(input, env),
    team: () => team(input, env),
    key: () => keyRead(env),
    marker: () => markerSearch(input),
  }[mode];
  if (extra) record(mode, input, extra(), env);
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
