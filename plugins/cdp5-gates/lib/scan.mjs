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

/**
 * Look up an artifact in the repo. files = code files collected beforehand.
 * Returns { kind, found, strength, evidence }:
 *   strength 'path'        — the file/directory exists (paths) or the route literal occurs in a code file (routes)
 *   strength 'declaration' — `class|interface|trait|enum|function|const <Name>` in a code file
 *   strength 'occurrence'  — the bare word occurs in a code file (weak: may be a comment, a string, composer.json …)
 *   strength null          — not found / not verifiable
 */
export function locate(token, root, files) {
  const kind = classify(token);
  if (kind === null) return { kind, found: null, strength: null, evidence: 'n/a' };
  if (kind === 'path') {
    const needle = token.replace(/^\.?\//, '');
    if (existsSync(join(root, needle))) return { kind, found: true, strength: 'path', evidence: needle };
    const hit = files.find((f) => relative(root, f).endsWith(needle));
    return { kind, found: !!hit, strength: hit ? 'path' : null, evidence: hit ? relative(root, hit) : null };
  }
  if (kind === 'route') {
    for (const f of files) {
      if (extname(f) === '.md') continue;
      if (readFileSync(f, 'utf8').includes(token)) return { kind, found: true, strength: 'path', evidence: `${relative(root, f)} (route)` };
    }
    return { kind, found: false, strength: null, evidence: null };
  }
  // symbol: declaration in a CODE file (not .md)
  const leaf = token.split('\\').pop().split('::')[0];
  const declRe = new RegExp(`\\b(class|interface|trait|enum|function|const)\\s+${leaf}\\b`);
  const wordRe = new RegExp(`\\b${leaf}\\b`);
  let weak = null;
  for (const f of files) {
    if (extname(f) === '.md') continue;
    const text = readFileSync(f, 'utf8');
    if (declRe.test(text)) return { kind, found: true, strength: 'declaration', evidence: `${relative(root, f)} (declaration)` };
    if (!weak && wordRe.test(text)) weak = `${relative(root, f)} (occurrence)`;
  }
  return { kind, found: !!weak, strength: weak ? 'occurrence' : null, evidence: weak };
}

/**
 * UC sections of a concept document. A UC heading is `## UC-…` or `### UC-…` (H3 UCs usually sit under a
 * numbered `## N. Use Cases` section). Any other H1/H2 heading ends the current UC; H3 sub-headings
 * (`### Akzeptanzkriterien`) stay inside it. Returns [{ id, title, body, line }] with a 1-based heading line.
 */
export function parseUCs(md) {
  const ucs = [];
  let cur = null;
  md.split('\n').forEach((line, i) => {
    const h = line.match(/^#{2,3}\s+(UC[-\s][^\n]*)/i);
    if (h) {
      const title = h[1].trim();
      const id = (title.match(/^UC[-\s]?[\w.]+/i) || [title])[0].replace(/\s+/g, '-').replace(/[.:]+$/, '');
      cur = { id, title, body: '', line: i + 1 };
      ucs.push(cur);
      return;
    }
    if (/^#{1,2}\s/.test(line)) cur = null;   // any other H1/H2 heading ends the UC
    if (cur) cur.body += line + '\n';
  });
  return ucs;
}

/** Backtick tokens from a block of text. */
export function backtickTokens(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
}

export { relative, basename, readFileSync };
