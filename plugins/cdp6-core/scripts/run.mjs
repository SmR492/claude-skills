#!/usr/bin/env node
import { mkdirSync, readFileSync, readlinkSync, realpathSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { keyRead } from '../probes/probe-read.mjs';

function chain() {
  const out = [];
  let pid = process.pid;
  while (pid > 1 && out.length < 32) {
    try {
      const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
      const entry = { pid, cmdline: readFileSync(`/proc/${pid}/cmdline`, 'utf8').split('\0').join(' ').trim() };
      try {
        entry.exe = realpathSync(readlinkSync(`/proc/${pid}/exe`));
      } catch (e) {
        entry.exe = '';
      }
      out.push(entry);
      pid = Number(stat.slice(stat.lastIndexOf(')') + 2).split(' ')[1]);
    } catch {
      break;
    }
  }
  return out;
}

const argv = process.argv.slice(2);
process.stdout.write(`${JSON.stringify({ argv })}\n`);
try {
  const dir = process.env.CDP6_PROBE_R || join(process.cwd(), 'R');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'run.json'), `${JSON.stringify({ ts: new Date().toISOString(), argv, cwd: process.cwd(), key: keyRead(process.env), chain: chain() })}\n`);
} catch (e) {
  process.stderr.write(`run.json not written (${e.code || 'ERR'})\n`);
  process.exit(1);
}
