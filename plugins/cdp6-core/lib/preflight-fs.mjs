import { readdirSync, realpathSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { expand, homeOf, toRegex } from './user-settings.mjs';
import { within } from './paths.mjs';

const GLOB = /[*?[\]]/;

function entries(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
}

export function expansionCount(spec, env) {
  const abs = expand(spec, homeOf(env), { rule: false });
  if (abs === null || !GLOB.test(abs)) return 1;
  const re = toRegex(abs);
  const first = abs.search(GLOB);
  let count = 0;
  const walk = (dir) => {
    for (const e of entries(dir)) {
      const path = join(dir, e.name);
      if (re.test(path)) count += 1;
      else if (e.isDirectory()) walk(path);
    }
  };
  walk(abs.slice(0, abs.lastIndexOf('/', first)) || '/');
  return count;
}

export function gitEntries(root) {
  const found = [];
  const walk = (dir) => {
    for (const e of entries(dir)) {
      const path = join(dir, e.name);
      if (e.name === '.git') found.push(path);
      else if (e.isDirectory()) walk(path);
    }
  };
  walk(root);
  return found;
}

function real(path) {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}

export function writableRoots(candidates) {
  const roots = [...new Set(candidates.filter((c) => typeof c === 'string' && c !== '').map(real))];
  return roots.filter((r) => !roots.some((o) => o !== r && within(r, o)));
}

export function staticRoot(spec, env, { rule = false } = {}) {
  const abs = expand(spec, homeOf(env), { rule });
  if (abs === null) return null;
  const first = abs.search(GLOB);
  return first === -1 ? abs : abs.slice(0, abs.lastIndexOf('/', first)) || dirname(abs);
}

const PROFILE_KEYS = ['denyRead', 'denyWrite', 'allowRead', 'allowWrite'];

function profileSpecs(docs) {
  const specs = new Set();
  for (const doc of docs) {
    for (const key of PROFILE_KEYS) for (const s of doc?.sandbox?.filesystem?.[key] ?? []) if (typeof s === 'string') specs.add(s);
    for (const list of Object.values(doc?.sandbox?.credentials ?? {})) for (const s of Array.isArray(list) ? list : []) if (typeof s === 'string') specs.add(s);
  }
  return [...specs];
}

export function countedPaths(docs, env, gitCount) {
  const entries = profileSpecs(docs).map((spec) => ({ spec, count: expansionCount(spec, env) }));
  return { entries, git: gitCount, total: entries.reduce((sum, e) => sum + e.count, 0) + gitCount };
}
