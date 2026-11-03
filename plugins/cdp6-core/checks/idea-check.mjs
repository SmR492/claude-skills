#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRun } from '../lib/run-store.mjs';
import { isMainModule } from '../lib/paths.mjs';

export const REQUIRED_SECTIONS = ['Assignment', 'Problem', 'Goals', 'Non-goals', 'Constraints', 'Success measures', 'Decisions', 'Approach options'];
export const APPROACH_CHOICE = 'D-1';

function normalise(title) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function sectionsOf(text) {
  const found = new Set();
  for (const line of text.split('\n')) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) found.add(normalise(m[1]));
  }
  return found;
}

export function checkIdea(S, snapshot) {
  const run = readRun(S);
  const findings = [];
  const file = join(snapshot, 'idea', 'idea.md');
  if (!existsSync(file)) {
    findings.push('idea/idea.md is missing');
  } else {
    const have = sectionsOf(readFileSync(file, 'utf8'));
    for (const name of REQUIRED_SECTIONS) {
      if (!have.has(normalise(name))) findings.push(`missing section: ${name}`);
    }
  }
  const d = run.decisions?.[APPROACH_CHOICE];
  if (!d || d.status !== 'decided') {
    findings.push(`approach choice ${APPROACH_CHOICE} is not decided`);
  } else {
    const decided = d.stamps.find((s) => s.status === 'decided');
    const decider = decided?.decider ?? d.decider;
    if (decider !== 'owner') findings.push(`approach choice ${APPROACH_CHOICE} is decided by ${decider}, not by owner`);
  }
  return findings;
}

function main(argv) {
  const i = argv.indexOf('--run-dir');
  const j = argv.indexOf('--snapshot');
  if (i < 0 || !argv[i + 1] || j < 0 || !argv[j + 1]) {
    process.stderr.write('usage: idea-check.mjs --run-dir <state directory> --snapshot <snapshot directory>\n');
    return 2;
  }
  let findings;
  try {
    findings = checkIdea(argv[i + 1], argv[j + 1]);
  } catch (e) {
    process.stderr.write(`idea-check: ${e.code ?? 'error'}: run record not usable\n`);
    return 2;
  }
  for (const f of findings) process.stdout.write(`idea-check FAIL ${f}\n`);
  if (!findings.length) process.stdout.write('idea-check OK\n');
  return findings.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
