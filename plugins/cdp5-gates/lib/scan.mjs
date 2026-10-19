// Shared, dependency-free scan helpers for the cdp5-gates skills.
// node: builtins only — runs host-side (CDP5 §32.9 runtime rule).

import { readFileSync, readdirSync, lstatSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

export const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'var', 'cache', '.idea', 'dist', 'build', '.tmp']);

/** Collect all files with allowed extensions under root (once). */
export function collectFiles(root, exts) {
  const allow = new Set(exts);
  const out = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir); } catch { return; }
    for (const name of entries) {
      if (SKIP_DIRS.has(name)) continue;
      const full = join(dir, name);
      let st;
      try { st = lstatSync(full); } catch { continue; }
      if (st.isSymbolicLink()) continue;            // never follow symlinks (out-of-tree read / loop protection)
      if (st.isDirectory()) walk(full);
      else if (allow.has(extname(name))) out.push(full);
    }
  };
  walk(root);
  return out;
}

/** Classify a backtick token: 'path' | 'symbol' | 'route' | null (not verifiable). */
export function classify(token) {
  if (token.startsWith('/') || /\.[a-z0-9]{1,5}$/i.test(token) || token.includes('/')) {
    if (/^\/[\w/{}:.-]+$/.test(token)) return 'route';      // /path/{id}
    return 'path';
  }
  if (/^[A-Za-z_]\w*(\\[A-Za-z_]\w*)+$/.test(token)) return 'symbol';     // Foo\Bar
  if (/::/.test(token)) return 'symbol';                                   // Class::method
  if (/^[A-Z][A-Za-z0-9]+$/.test(token) && /[a-z]/.test(token)) return 'symbol';
  return null; // CLI commands (foo:bar), flags (--x), snake_case DB values
}

/** Look up an artifact in the repo. files = code files collected beforehand. */
export function locate(token, root, files) {
  const kind = classify(token);
  if (kind === null) return { kind, found: null, evidence: 'n/a' };
  if (kind === 'path') {
    const needle = token.replace(/^\.?\//, '');
    if (existsSync(join(root, needle))) return { kind, found: true, evidence: needle };
    const hit = files.find((f) => relative(root, f).endsWith(needle));
    return { kind, found: !!hit, evidence: hit ? relative(root, hit) : null };
  }
  if (kind === 'route') {
    for (const f of files) {
      if (extname(f) === '.md') continue;
      if (readFileSync(f, 'utf8').includes(token)) return { kind, found: true, evidence: `${relative(root, f)} (route)` };
    }
    return { kind, found: false, evidence: null };
  }
  // symbol: declaration in a CODE file (not .md)
  const leaf = token.split('\\').pop().split('::')[0];
  const declRe = new RegExp(`\\b(class|interface|trait|enum|function|const)\\s+${leaf}\\b`);
  const wordRe = new RegExp(`\\b${leaf}\\b`);
  let weak = null;
  for (const f of files) {
    if (extname(f) === '.md') continue;
    const text = readFileSync(f, 'utf8');
    if (declRe.test(text)) return { kind, found: true, evidence: `${relative(root, f)} (declaration)` };
    if (!weak && wordRe.test(text)) weak = `${relative(root, f)} (occurrence)`;
  }
  return { kind, found: !!weak, evidence: weak };
}

/** Backtick tokens from a block of text. */
export function backtickTokens(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
}

export { relative, basename, readFileSync };
