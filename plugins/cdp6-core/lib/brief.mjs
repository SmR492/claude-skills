const SINGLE = ['run', 'phase', 'task', 'role', 'round', 'brief', 'env', 'clears'];
const REPEATED = ['target', 'cited', 'writes'];
const REQUIRED = ['run', 'phase', 'task', 'role', 'round', 'brief', 'env'];
const LINE = /^([a-z]+):[ \t]+(\S.*?)[ \t]*$/;
const TARGET = /^(\S.*)@([0-9a-f]{64})$/;
const ENV = /^(\S.*) base ([0-9a-f]{7,64})$/;
const ROUND = /^\d+$/;
const TASK = /^[A-Za-z0-9._-]+$/;

function failure(code, line, text, message, extra = {}) {
  return { ok: false, error: { code, line, text, message, ...extra } };
}

function value(key, raw) {
  if (key === 'task') return TASK.test(raw) ? raw : undefined;
  if (key === 'round') return ROUND.test(raw) ? Number(raw) : undefined;
  if (key === 'env') {
    if (raw === 'none') return 'none';
    const m = ENV.exec(raw);
    return m ? { path: m[1], base: m[2] } : undefined;
  }
  if (key === 'target') {
    const m = TARGET.exec(raw);
    return m ? { path: m[1], sha256: m[2] } : undefined;
  }
  return raw;
}

export function parseBrief(input) {
  if (typeof input !== 'string' || input.trim() === '') return failure('no-header', 1, '', 'the brief has no header block');
  const lines = input.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split('\n');
  const header = { targets: [], cited: [], writes: [], clears: null };
  const seen = new Set();
  let end = 0;
  for (; end < lines.length && lines[end].trim() !== ''; end++) {
    const text = lines[end];
    const n = end + 1;
    const m = LINE.exec(text);
    if (!m) return failure('bad-line', n, text, `line ${n} is not a "key: value" header line`);
    const [, key, raw] = m;
    if (!SINGLE.includes(key) && !REPEATED.includes(key)) return failure('unknown-field', n, text, `line ${n} names an unknown header field`);
    if (SINGLE.includes(key) && seen.has(key)) return failure('duplicate-field', n, text, `line ${n} repeats the field ${key}`);
    const parsed = value(key, raw);
    if (parsed === undefined) return failure('bad-value', n, text, `line ${n} has a malformed ${key} value`);
    seen.add(key);
    if (key === 'target') header.targets.push(parsed);
    else if (key === 'cited') header.cited.push(parsed);
    else if (key === 'writes') header.writes.push(parsed);
    else header[key] = parsed;
  }
  if (end === 0) return failure('no-header', 1, lines[0], 'the brief has no header block');
  const absent = REQUIRED.find((k) => !seen.has(k));
  if (absent) return failure('missing-field', end + 1, '', `the header lacks the field ${absent}`, { field: absent });
  const { run, phase, task, role, round, brief, env, targets, cited, writes, clears } = header;
  return { ok: true, header: { run, phase, task, role, round, brief, env, targets, cited, writes, clears } };
}
