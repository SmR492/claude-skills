// Shared input guards for the cdp5-gates T1 skills (concept: input robustness contract).
// Contract: invalid input → exit 2 + readable message, NEVER an uncaught exception/stack trace.
// node: builtins only (CDP5 §32.9 runtime rule).

import { existsSync, lstatSync } from 'node:fs';

/**
 * Pure validator: returns an error message or `null`.
 * NEVER throws, NEVER calls process.exit — testable without side effects (UC-04 AC-1).
 * @param {*} path  path argument (string) or absent (undefined/null/'')
 * @param {'file'|'dir'} kind  expected type
 */
export function pathTypeError(path, kind) {
  if (path === undefined || path === null || path === '') return null;   // absent/optional → separate missing-arg check
  if (typeof path !== 'string') return 'argument without a value (expected a path)';
  if (!existsSync(path)) return `not found: ${path}`;
  let st;
  try { st = lstatSync(path); } catch (e) { return `not readable: ${path} (${e.code || e.message})`; }
  if (kind === 'dir' && !st.isDirectory()) return `expected a directory, but is not one: ${path}`;
  if (kind === 'file' && !st.isFile()) return `expected a file, but is not one: ${path}`;
  return null;
}

/** Not pure: writes the message to stderr and exits with code 2 (usage/input error). */
export function usage(msg) { console.error(msg); process.exit(2); }

/**
 * Convenience: checks several [path, kind] pairs; on the first error → usage() (exit 2).
 * @param {Array<[*, 'file'|'dir']>} specs
 */
export function guardPaths(specs) {
  for (const [path, kind] of specs) {
    const err = pathTypeError(path, kind);
    if (err) usage(err);
  }
}
