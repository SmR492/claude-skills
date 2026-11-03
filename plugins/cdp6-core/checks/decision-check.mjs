#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { readRun } from '../lib/run-store.mjs';
import { isMainModule } from '../lib/paths.mjs';

const PASSING = new Set(['a', 'a-with-conditions']);
const BLOCKING = new Set(['b', 'c']);

function readCaptures(R) {
  const file = join(R, 'verdicts', 'index.jsonl');
  if (!existsSync(file)) return [];
  return readFileSync(file, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      try {
        return JSON.parse(line);
      } catch {
        const e = new Error('verdict index is not readable');
        e.code = 'index-unreadable';
        throw e;
      }
    });
}

function isDevilsAdvocate(c) {
  return typeof c.agent_type === 'string' && c.agent_type.endsWith(':devils-advocate');
}

export function checkDecisions(R) {
  const run = readRun(R);
  const captures = readCaptures(R).filter(isDevilsAdvocate);
  const objections = new Map((run.owner_records ?? []).filter((o) => o.kind === 'object').map((o) => [o.id, o.verdict]));
  const findings = [];
  for (const [id, d] of Object.entries(run.decisions ?? {})) {
    if (d.status !== 'decided') continue;
    const decidedAt = d.stamps.find((s) => s.status === 'decided')?.at;
    const mine = captures.filter((c) => c.decision === id);
    if (!mine.length) {
      findings.push(`${id}: no devils-advocate capture before the decided stamp`);
      continue;
    }
    const before = mine.filter((c) => Date.parse(c.stamp) < Date.parse(decidedAt)).sort((x, y) => Date.parse(y.stamp) - Date.parse(x.stamp));
    if (!before.length) {
      const first = mine.map((c) => c.stamp).sort()[0];
      findings.push(`${id}: decided at ${decidedAt} before its devils-advocate capture at ${first}`);
      continue;
    }
    const last = before[0];
    const cleared = (f) => (last.verdict === 'c' ? objections.get(f) === 'reject' : objections.has(f));
    const open = (last.objections ?? []).filter((f) => !cleared(f));
    const passing = PASSING.has(last.verdict) && !last.conflicted;
    if (passing) continue;
    if (!BLOCKING.has(last.verdict) && !last.conflicted) {
      findings.push(`${id}: devils-advocate verdict ${last.verdict} is not a pass`);
      continue;
    }
    for (const f of open) findings.push(last.verdict === 'c' && objections.has(f) ? `${id}: objection ${f} of verdict c has no run.mjs object reject record in run.json` : `${id}: objection ${f} has no run.mjs object record in run.json`);
    if (!open.length && !(last.objections ?? []).length) findings.push(`${id}: verdict ${last.verdict} lists no objection to record`);
  }
  return findings;
}

function main(argv) {
  const i = argv.indexOf('--run-dir');
  if (i < 0 || !argv[i + 1]) {
    process.stderr.write('usage: decision-check.mjs --run-dir <state directory> [--snapshot <snapshot directory>]\n');
    return 2;
  }
  let findings;
  try {
    findings = checkDecisions(argv[i + 1]);
  } catch (e) {
    process.stderr.write(`decision-check: ${e.code ?? 'error'}: inputs not usable\n`);
    return 2;
  }
  for (const f of findings) process.stdout.write(`decision-check FAIL ${f}\n`);
  if (!findings.length) process.stdout.write('decision-check OK\n');
  return findings.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
