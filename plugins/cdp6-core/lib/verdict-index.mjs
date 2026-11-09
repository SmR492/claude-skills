import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { captureBound } from './agent-name.mjs';

export const PASSING = new Set(['a', 'a-with-conditions']);
export const BLOCKING = new Set(['b', 'c']);
export const CLASSES = ['a', 'a-with-conditions', 'b', 'c', 'not-decidable'];
export const OBJECTION_ID = /^F-P[1-8]-\d+$/;
export const OBJECTION_ID_ANYWHERE = /F-P[1-8]-\d+/;

export const DISPOSITION = /^disposition: (?:F-P[1-8]-\d+|[A-Za-z0-9._-]+:(?:F-P[1-8]-\d+|premise-\d+|conflict)) (?:(resolved|withdrawn) \S+|(upheld)) - \S.*$/;

export function dispositionRest(line) {
  return line.slice('disposition: '.length).replace(/^\S+/, '');
}

export function normalizeCapture(text) {
  return String(text ?? '')
    .replace(/\p{Cf}/gu, '')
    .normalize('NFKC')
    .replace(/[\p{Pd}\u2212]/gu, '-');
}

export function hasBlockVerdictLine(text) {
  return normalizeCapture(text)
    .split('\n')
    .some((l) => /^verdict:\s*[bc](?:\s|$)/i.test(l));
}

const SCOPED_OBJECTION = /^([A-Za-z0-9._-]+):(F-P[1-8]-\d+)$/;
const SCOPED_PREMISE = /^([A-Za-z0-9._-]+):premise-(\d+)$/;
const SCOPED_CONFLICT = /^([A-Za-z0-9._-]+):conflict$/;
const SCOPED_CAPTURE = /^([A-Za-z0-9._-]+):capture$/;

export class IndexError extends Error {
  constructor(message) {
    super(message);
    this.code = 'index-unreadable';
  }
}

export function indexPath(S) {
  return join(S, 'verdicts', 'index.jsonl');
}

export function readIndex(S) {
  const file = indexPath(S);
  if (!existsSync(file)) return [];
  let text;
  try {
    text = readFileSync(file, 'utf8');
  } catch {
    throw new IndexError('the verdict index is not readable');
  }
  return text
    .split('\n')
    .filter((l) => l.trim() !== '')
    .map((l) => {
      try {
        const doc = JSON.parse(l);
        if (doc && typeof doc === 'object' && !Array.isArray(doc)) return doc;
      } catch {
        throw new IndexError('the verdict index is not valid JSON');
      }
      throw new IndexError('the verdict index holds a line that is not an object');
    });
}

export function scopedObjection(captureId, id) {
  return `${captureId}:${id}`;
}

export function scopedPremise(captureId, n) {
  return `${captureId}:premise-${n}`;
}

export function parseItem(id) {
  if (typeof id !== 'string') return null;
  const o = SCOPED_OBJECTION.exec(id);
  if (o) return { captureId: o[1], kind: 'objection', local: o[2] };
  const p = SCOPED_PREMISE.exec(id);
  if (p) return { captureId: p[1], kind: 'premise', local: Number(p[2]) };
  const c = SCOPED_CONFLICT.exec(id);
  if (c) return { captureId: c[1], kind: 'conflict', local: null };
  const k = SCOPED_CAPTURE.exec(id);
  return k ? { captureId: k[1], kind: 'capture', local: null } : null;
}

export function isDevilsAdvocate(c) {
  return captureBound(c?.agent_type);
}

export function objectionItems(c) {
  return (c.objections ?? []).map((o) => scopedObjection(c.id, o));
}

export function premiseItems(c) {
  return c.premises ?? [];
}

export function conflictItem(c) {
  return `${c.id}:conflict`;
}

export function captureItem(c) {
  return `${c.id}:capture`;
}

export function listsNoItem(c) {
  return objectionItems(c).length + premiseItems(c).length === 0;
}

function rejectedBlockOnDisk(S, c) {
  if (S === undefined || c.validator !== 'rejected' || c.conflicted === true || !isDevilsAdvocate(c)) return false;
  try {
    return hasBlockVerdictLine(readFileSync(join(S, 'verdicts', `${c.id}.md`), 'utf8'));
  } catch {
    return false;
  }
}

export function hasItem(index, id, S) {
  const item = parseItem(id);
  if (!item) return false;
  return index.some((c) => {
    if (c.id !== item.captureId) return false;
    if (item.kind === 'capture') return rejectedBlockOnDisk(S, c);
    if (item.kind === 'conflict') return c.conflicted === true && listsNoItem(c);
    return (item.kind === 'objection' ? objectionItems(c) : premiseItems(c)).includes(id);
  });
}

export function recordOf(records, id) {
  return (records ?? []).find((o) => o.kind === 'object' && o.id === id);
}

export function unclearedItems(items, records, { rejectOnly = false } = {}) {
  const given = new Map();
  for (const o of records ?? []) if (o.kind === 'object' && !given.has(o.id)) given.set(o.id, o.verdict);
  return items.filter((id) => (rejectOnly ? given.get(id) !== 'reject' : !given.has(id)));
}
