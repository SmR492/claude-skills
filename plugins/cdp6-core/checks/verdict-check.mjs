import { createHash } from 'node:crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { isAbsolute, join } from 'node:path';
import { agentName } from '../lib/agent-name.mjs';
import { isMainModule } from '../lib/paths.mjs';
import { StoreError, withLock } from '../lib/run-store.mjs';
import { BLOCKING, CLASSES, DISPOSITION, OBJECTION_ID, OBJECTION_ID_ANYWHERE, PASSING, dispositionRest, hasBlockVerdictLine, normalizeCapture, readIndex, scopedPremise } from '../lib/verdict-index.mjs';

const COUNTER_ROLES = new Set(['devils-advocate', 'pessimistic-realist', 'adversarial-auditor', 'threat-modeler']);
const EVIDENCE = /^(?:[A-Za-z0-9._/@-]+:\d+(?:-\d+)?|command: \S.*)$/;
const MAPPED = new Set(['pass', 'pass-with-conditions', 'block', 'no pass']);
const TRIAD_ROLES = new Set([...COUNTER_ROLES, 'konzept-reviewer', 'review-verify', 'review-code']);

function linesOf(text) {
  return String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
}

function fieldsOf(line) {
  const out = {};
  for (const part of line.split(' | ')) {
    const m = /^([a-z ]+):\s*(.*?)\s*$/.exec(part);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

const SINGLE_KEYS = ['fresh context', 'rejected alternative provided', 'conflict of interest', 'severity scale', 'verdict mapping'];

function headerValues(lines, key) {
  return lines.filter((l) => l.startsWith(`${key}:`)).map((l) => l.slice(key.length + 1).trim());
}

function headerValue(lines, key) {
  return headerValues(lines, key)[0];
}

function mappingProblems(lines) {
  const problems = [];
  const scale = headerValue(lines, 'severity scale');
  if (!scale || !['🔴', '🟡', '🟢'].every((m) => scale.includes(m))) problems.push('the severity scale line is missing or names not all of 🔴, 🟡 and 🟢');
  const mapping = headerValue(lines, 'verdict mapping');
  if (!mapping) {
    problems.push('the verdict mapping line is missing');
  } else {
    const pairs = new Map(mapping.split(',').map((p) => p.split('=').map((x) => x.trim())));
    if (!CLASSES.every((c) => MAPPED.has(pairs.get(c)))) problems.push('the verdict mapping line does not map each of a, a-with-conditions, b, c and not-decidable to pass, pass-with-conditions, block or no pass');
  }
  return problems;
}

const PREMISE_MARK = /--\s*(?:un)?checked/i;
const FIELD_LABELS = ['objection', 'artefact', 'evidence', 'refuted when'];

function fourFields(line) {
  const parts = line.split(' | ');
  return parts.length === 4 && parts.every((p, i) => p.startsWith(`${FIELD_LABELS[i]}: `) && p.slice(FIELD_LABELS[i].length + 2).trim() !== '') && !/\s/.test(parts[0].slice(11));
}

export function validateCapture(text, { agentType, captureId } = {}) {
  const role = agentName(agentType);
  if (!TRIAD_ROLES.has(role)) return { validator: 'not-checked', reasons: [], verdict: null, objections: [], premises: [], conflicted: false };
  const lines = linesOf(normalizeCapture(text));
  const reasons = [];
  const counter = COUNTER_ROLES.has(role);
  if (lines.every((l) => l.trim() === '')) reasons.push('the capture text is empty');
  if (!headerValue(lines, 'conflict of interest')) reasons.push('the conflict of interest line is missing');
  if (counter) reasons.push(...mappingProblems(lines));
  for (const key of SINGLE_KEYS) {
    if (new Set(headerValues(lines, key)).size > 1) reasons.push(`the ${key} line appears twice with different values`);
  }
  const stake = headerValue(lines, 'conflict of interest');
  const conflicted = stake !== undefined && stake !== '' && stake !== 'none';
  if (!counter) return { validator: reasons.length ? 'rejected' : 'valid', reasons, verdict: null, objections: [], premises: [], conflicted };
  let verdict = null;
  const objections = [];
  const unsupported = [];
  const premises = premiseRows(lines);
  const verdictLines = headerValues(lines, 'verdict');
  if (verdictLines.length > 1) reasons.push('the verdict line appears twice');
  lines.forEach((line, n) => {
    if (line.startsWith('> ')) return;
    if (line.startsWith('verdict:')) verdict = line.slice(8).trim();
    const o = /^objection: (\S+)(.*)$/.exec(line);
    const disposition = line.startsWith('disposition:');
    if (o) {
      if (!OBJECTION_ID.test(o[1])) reasons.push(`the objection id ${o[1]} is not of the form F-P<k>-<n>`);
      else if (objections.includes(o[1])) reasons.push(`the objection id ${o[1]} appears twice`);
      objections.push(o[1]);
      const fields = fieldsOf(`objection: ${o[1]}${o[2]}`);
      if (!fourFields(line)) reasons.push(`line ${n + 1} is an objection line without exactly the four fields objection, artefact, evidence and refuted when in this order`);
      for (const other of (line.slice(10 + o[1].length).match(new RegExp(OBJECTION_ID_ANYWHERE.source, 'g')) ?? []).filter((id) => id !== o[1])) {
        reasons.push(`line ${n + 1} carries the objection id ${other} in the objection line of ${o[1]}`);
      }
      if (!fields.artefact) unsupported.push(`block objection ${o[1]} cites no artefact id`);
      if (!EVIDENCE.test(fields.evidence ?? '')) unsupported.push(`block objection ${o[1]} cites no evidence of the form file:line or command: <command>`);
    } else if (disposition) {
      const d = DISPOSITION.exec(line);
      if (!d) reasons.push(`line ${n + 1} is a disposition line not of the form disposition: <item> resolved|withdrawn <id or file:line> - <why>`);
      else if (d[1] === undefined) reasons.push(`line ${n + 1} is an upheld disposition, which rejects the capture until the return cycle is built`);
      else {
        const after = OBJECTION_ID_ANYWHERE.exec(dispositionRest(line));
        if (after) reasons.push(`line ${n + 1} carries the objection id ${after[0]} after the item of a disposition line`);
      }
    } else {
      const stray = OBJECTION_ID_ANYWHERE.exec(line);
      if (stray) reasons.push(`line ${n + 1} carries the objection id ${stray[0]} outside an objection line`);
    }
    if (PREMISE_MARK.test(line) && !(n > premises.at && n <= premises.at + premises.rows.length)) {
      reasons.push(`line ${n + 1} is a premise row outside the premises section`);
    }
  });
  if (BLOCKING.has(verdict)) {
    if (!objections.length) reasons.push(`verdict ${verdict} needs at least one objection`);
    reasons.push(...unsupported);
  }
  if (verdict === null) reasons.push('the verdict line is missing');
  else if (!CLASSES.includes(verdict)) reasons.push(`the verdict class is not one of ${CLASSES.join(', ')}`);
  if (!premises.present) reasons.push('the premises section is missing');
  reasons.push(...premises.problems);
  if (headerValue(lines, 'fresh context') !== 'yes') reasons.push('the pass is invalid without "fresh context: yes"');
  if (role === 'devils-advocate') {
    if (headerValue(lines, 'rejected alternative provided') !== 'yes') reasons.push('the pass is invalid without "rejected alternative provided: yes"');
  }
  const rejected = reasons.length > 0;
  if (!rejected && PASSING.has(verdict) && premises.rows.some((p) => !p.checked)) {
    verdict = 'not-decidable';
    reasons.push('an unchecked premise: the verdict is recorded as not-decidable');
  }
  const keep = !rejected || conflicted;
  const items = rejected ? fileObjectionIds(lines) : objections.filter((id) => OBJECTION_ID.test(id));
  return { validator: rejected ? 'rejected' : 'valid', reasons, verdict: rejected ? null : verdict, objections: keep ? [...new Set(items)] : [], premises: keep ? premises.rows.map((_, n) => scopedPremise(captureId, n + 1)) : [], conflicted };
}

function fileObjectionIds(lines) {
  return lines
    .filter((l) => !l.startsWith('> '))
    .map((l) => (DISPOSITION.test(l) ? dispositionRest(l) : l))
    .flatMap((l) => l.match(new RegExp(OBJECTION_ID_ANYWHERE.source, 'g')) ?? []);
}

const NO_PREMISES = 'none, no existing code or data touched';

function premiseRows(lines) {
  const at = lines.findIndex((l) => l.startsWith('premises:'));
  if (at < 0) return { at, present: false, rows: [], problems: [] };
  const rest = lines[at].slice(9).trim();
  const rows = [];
  for (let i = at + 1; i < lines.length && lines[i].startsWith('- '); i++) rows.push(lines[i].slice(2));
  const problems = [];
  if (rest !== '' && rest !== NO_PREMISES) problems.push('the premises line is neither a list nor "premises: none, no existing code or data touched"');
  if (rest === NO_PREMISES && rows.length) problems.push('the premises line says none but premise rows follow');
  if (rest === '' && !rows.length) problems.push('the premises section has no premise row');
  const parsed = rows.map((row, n) => {
    const m = /^(.+?) -- (?:checked: (.+)|(unchecked))$/.exec(row);
    if (!m || (m[2] !== undefined && !EVIDENCE.test(m[2]))) {
      problems.push(`premise ${n + 1} is neither "checked: <file:line or command: ...>" nor "unchecked"`);
      return { checked: false };
    }
    return { checked: m[3] === undefined };
  });
  return { at, present: true, rows: parsed, problems };
}

function targetStale(target, snapshotDir) {
  const path = target?.path;
  if (typeof path !== 'string' || path === '' || isAbsolute(path) || path.split('/').includes('..')) return true;
  let buf;
  try {
    buf = readFileSync(join(snapshotDir, path));
  } catch {
    return true;
  }
  return createHash('sha256').update(buf).digest('hex') !== target.sha256;
}

export function isStale(capture, snapshotDir) {
  const targets = capture?.targets ?? [];
  if (!targets.length) return true;
  return targets.some((t) => targetStale(t, snapshotDir));
}

export function failWith(code) {
  const e = new Error(code);
  e.code = code;
  return e;
}

export function requireSnapshot(snapshot) {
  if (snapshot === undefined) return;
  let ok = false;
  try {
    ok = typeof snapshot === 'string' && statSync(snapshot).isDirectory();
  } catch {
    ok = false;
  }
  if (!ok) throw failWith('snapshot-unreadable');
}

const CAPTURE_FILE = /^[A-Za-z0-9._-]+\.md$/;

const GATE_WAIT_MS = 1000;

function readCaptures(R) {
  const dir = join(R, 'verdicts');
  const captures = [];
  const findings = [];
  const listed = new Set();
  for (const line of readIndex(R)) {
    const name = line.id ?? line.file ?? 'capture without id';
    if (typeof line.file !== 'string' || !CAPTURE_FILE.test(line.file)) {
      findings.push(`${name}: the index line names no usable capture file`);
      continue;
    }
    listed.add(line.file);
    if (line.id !== line.file.slice(0, -3)) {
      findings.push(`${name}: the index id is not the capture file name ${line.file.slice(0, -3)}`);
      continue;
    }
    let buf;
    try {
      buf = readFileSync(join(dir, line.file));
    } catch {
      findings.push(`${name}: the capture file ${line.file} is missing`);
      continue;
    }
    if (createHash('sha256').update(buf).digest('hex') !== line.sha256) {
      findings.push(`${name}: the capture file ${line.file} differs from the sha256 of its index line`);
      continue;
    }
    const body = buf.toString('utf8');
    const { validator, reasons, verdict, objections, premises, conflicted } = validateCapture(body, { agentType: line.agent_type, captureId: line.id });
    captures.push({ ...line, validator, reasons, verdict, objections, premises, conflicted, rejectedBlock: validator === 'rejected' && hasBlockVerdictLine(body) });
  }
  if (existsSync(dir)) {
    for (const file of readdirSync(dir).filter((n) => CAPTURE_FILE.test(n) && !listed.has(n)).sort()) findings.push(`${file}: capture file without an index line`);
  }
  return { captures, findings };
}

const LOCK_FINDINGS = {
  'lock-busy': 'verdicts.lock: the capture lock is held by another writer, so the captures were not read',
  'lock-error': 'verdicts.lock: the capture lock cannot be created, so the captures were not read',
};

export function rereadCaptures(R, { waitMs = GATE_WAIT_MS } = {}) {
  try {
    return withLock(join(R, 'verdicts.lock'), () => readCaptures(R), { waitMs });
  } catch (e) {
    if (!(e instanceof StoreError)) throw e;
    return { captures: [], findings: [LOCK_FINDINGS[e.code] ?? LOCK_FINDINGS['lock-error']] };
  }
}

export function checkCaptures(R, snapshot) {
  requireSnapshot(snapshot);
  const { captures, findings } = rereadCaptures(R);
  if (snapshot === undefined && captures.some((c) => (c.targets ?? []).length)) throw failWith('snapshot-missing');
  for (const c of captures) {
    const name = c.id ?? c.file ?? 'capture without id';
    if (c.validator === 'rejected') findings.push(`${name}: rejected: ${(c.reasons ?? []).join('; ')}`);
    if (isStale(c, snapshot)) findings.push(`${name}: stale, a target differs from the snapshot or is missing there`);
  }
  return findings;
}

function main(argv) {
  const i = argv.indexOf('--run-dir');
  const j = argv.indexOf('--snapshot');
  if (i < 0 || !argv[i + 1]) {
    process.stderr.write('usage: verdict-check.mjs --run-dir <state directory> [--snapshot <snapshot directory>]\n');
    return 2;
  }
  let findings;
  try {
    findings = checkCaptures(argv[i + 1], j >= 0 ? (argv[j + 1] ?? null) : undefined);
  } catch (e) {
    process.stderr.write(`verdict-check: ${e.code ?? 'error'}: inputs not usable\n`);
    return 2;
  }
  for (const f of findings) process.stdout.write(`verdict-check FAIL ${f}\n`);
  if (!findings.length) process.stdout.write('verdict-check OK\n');
  return findings.length ? 1 : 0;
}

if (isMainModule(import.meta.url)) process.exitCode = main(process.argv.slice(2));
