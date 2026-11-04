#!/usr/bin/env node
import { failWith, isStale, requireSnapshot, rereadCaptures } from './verdict-check.mjs';
import { readRun } from '../lib/run-store.mjs';
import { isMainModule } from '../lib/paths.mjs';
import { BLOCKING, PASSING, captureItem, conflictItem, isDevilsAdvocate, listsNoItem, objectionItems, parseItem, premiseItems, recordOf, unclearedItems } from '../lib/verdict-index.mjs';

function ownerRejected(c, records) {
  return c.conflicted === true && listsNoItem(c) && recordOf(records, conflictItem(c))?.verdict === 'reject';
}

function conflictFindings(id, c, records) {
  const found = [];
  const items = [...objectionItems(c), ...premiseItems(c)];
  if (!items.length && !recordOf(records, conflictItem(c))) found.push(`${id}: conflicted capture ${c.id ?? c.file ?? 'without id'} lists no objection or premise and has no run.mjs object ${conflictItem(c)} record in run.json`);
  for (const f of unclearedItems(items, records)) found.push(`${id}: ${parseItem(f)?.kind ?? 'objection'} ${f} of a conflicted capture has no run.mjs object record in run.json`);
  return found;
}

function blockFindings(id, c, records) {
  const found = [];
  const items = objectionItems(c);
  if (!items.length) found.push(`${id}: verdict ${c.verdict} lists no objection to record`);
  const unrecorded = unclearedItems(items, records);
  for (const f of c.verdict === 'c' ? unclearedItems(items, records, { rejectOnly: true }) : unrecorded) {
    found.push(unrecorded.includes(f) ? `${id}: objection ${f} has no run.mjs object record in run.json` : `${id}: objection ${f} of verdict c has no run.mjs object reject record in run.json`);
  }
  return found;
}

function captureFindings(id, c, records) {
  const found = [];
  if (c.conflicted) found.push(...conflictFindings(id, c, records));
  if (c.validator === 'rejected') {
    if (!c.conflicted && c.rejectedBlock && !recordOf(records, captureItem(c))) found.push(`${id}: capture ${c.id} is rejected by the validator and has a verdict b or c, no run.mjs object ${captureItem(c)} record in run.json`);
  } else if (BLOCKING.has(c.verdict)) {
    found.push(...blockFindings(id, c, records));
  }
  return found;
}

function blockingFindings(id, captures, records) {
  const found = [];
  for (const c of captures) for (const f of captureFindings(id, c, records)) if (!found.includes(f)) found.push(f);
  return found;
}

function settleSuperseded(id, all, records, snapshot) {
  if (snapshot === undefined && all.some((c) => (c.targets ?? []).length)) throw failWith('snapshot-missing');
  return blockingFindings(id, all, records);
}

function settle(id, d, all, records, snapshot) {
  const decidedAt = d.stamps.find((s) => s.status === 'decided')?.at;
  if (!all.length) return [`${id}: no devils-advocate capture before the decided stamp`];
  if (snapshot === undefined && all.some((c) => (c.targets ?? []).length)) throw failWith('snapshot-missing');
  const found = blockingFindings(id, all.filter((c) => Date.parse(c.stamp) < Date.parse(decidedAt)), records);
  const live = all.filter((c) => !isStale(c, snapshot));
  const fresh = live.filter((c) => !ownerRejected(c, records));
  if (!fresh.length && live.length) return [...found, `${id}: the owner rejected every conflicted devils-advocate capture that is not stale, the D-n needs another devils-advocate pass`];
  if (!fresh.length) return [...found, `${id}: every devils-advocate capture is stale, its target differs from the snapshot or is missing there`];
  const mine = fresh.filter((c) => c.validator !== 'rejected');
  if (!mine.length) return [...found, `${id}: every devils-advocate capture is rejected by the validator, the role has to be run again`];
  const before = mine.filter((c) => Date.parse(c.stamp) < Date.parse(decidedAt)).sort((x, y) => Date.parse(y.stamp) - Date.parse(x.stamp));
  if (!before.length) {
    const first = mine.map((c) => c.stamp).sort()[0];
    return [...found, `${id}: decided at ${decidedAt} before its devils-advocate capture at ${first}`];
  }
  const last = before[0];
  if (!PASSING.has(last.verdict) && !BLOCKING.has(last.verdict)) found.push(`${id}: devils-advocate verdict ${last.verdict} is not a pass`);
  return found;
}

export function checkDecisions(R, snapshot) {
  requireSnapshot(snapshot);
  const run = readRun(R);
  const reread = rereadCaptures(R);
  const captures = reread.captures.filter(isDevilsAdvocate);
  const records = run.owner_records ?? [];
  const findings = [...reread.findings];
  const decisions = run.decisions ?? {};
  const next = run.ids?.next?.D ?? 1;
  if (Number.isInteger(next) && next > 0) {
    for (let n = 1; n < next; n++) {
      if (!Object.hasOwn(decisions, `D-${n}`)) findings.push(`D-${n}: allocated below ids.next.D (${next}) without an entry in run.json`);
    }
  } else {
    findings.push(`ids.next.D is not a positive integer: ${JSON.stringify(next)}`);
  }
  for (const [id, d] of Object.entries(decisions)) {
    const mine = captures.filter((c) => c.decision === id);
    const push = (list) => {
      for (const f of list) if (!findings.includes(f)) findings.push(f);
    };
    if (d.status === 'proposed') findings.push(`${id}: still proposed, the exit needs it decided`);
    else if (d.status === 'superseded') push(settleSuperseded(id, mine, records, snapshot));
    else if (d.status === 'decided') push(settle(id, d, mine, records, snapshot));
    else findings.push(`${id}: status ${d.status === undefined ? 'none' : JSON.stringify(d.status)} is not proposed, decided or superseded`);
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
    const j = argv.indexOf('--snapshot');
    findings = checkDecisions(argv[i + 1], j >= 0 ? (argv[j + 1] ?? null) : undefined);
  } catch (e) {
    process.stderr.write(`decision-check: ${e.code ?? 'error'}: inputs not usable\n`);
    return 2;
  }
  for (const f of findings) process.stdout.write(`decision-check FAIL ${f}\n`);
  if (!findings.length) process.stdout.write('decision-check OK\n');
  return findings.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
