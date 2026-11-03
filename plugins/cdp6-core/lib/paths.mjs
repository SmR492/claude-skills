import { existsSync, realpathSync } from 'node:fs';
import { basename, dirname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export function isMainModule(metaUrl, argv1 = process.argv[1]) {
  if (typeof argv1 !== 'string' || argv1 === '') return false;
  try {
    return realpathSync(argv1) === fileURLToPath(metaUrl);
  } catch {
    return false;
  }
}

export function realOrResolved(p) {
  let cur = resolve(p);
  const tail = [];
  while (!existsSync(cur) && dirname(cur) !== cur) {
    tail.unshift(basename(cur));
    cur = dirname(cur);
  }
  try {
    return join(realpathSync(cur), ...tail);
  } catch {
    return resolve(p);
  }
}

export function within(path, root) {
  return path === root || path.startsWith(root.endsWith(sep) ? root : root + sep);
}
