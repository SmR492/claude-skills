// Geteilte, dependency-freie Scan-Helfer für die cdp5-gates-Skills.
// Nur node:-Builtins — läuft host-seitig (CDP5 §32.9 Runtime-Regel).

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, extname, basename } from 'node:path';

export const SKIP_DIRS = new Set(['.git', 'node_modules', 'vendor', 'var', 'cache', '.idea', 'dist', 'build', '.tmp']);

/** Alle Dateien mit erlaubten Endungen unter root einsammeln (einmalig). */
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
      try { st = statSync(full); } catch { continue; }
      if (st.isDirectory()) walk(full);
      else if (allow.has(extname(name))) out.push(full);
    }
  };
  walk(root);
  return out;
}

/** Klassifiziere ein Backtick-Token: 'path' | 'symbol' | 'route' | null (nicht verifizierbar). */
export function classify(token) {
  if (token.startsWith('/') || /\.[a-z0-9]{1,5}$/i.test(token) || token.includes('/')) {
    if (/^\/[\w/{}:.-]+$/.test(token)) return 'route';      // /pfad/{id}
    return 'path';
  }
  if (/^[A-Za-z_]\w*(\\[A-Za-z_]\w*)+$/.test(token)) return 'symbol';     // Foo\Bar
  if (/::/.test(token)) return 'symbol';                                   // Class::method
  if (/^[A-Z][A-Za-z0-9]+$/.test(token) && /[a-z]/.test(token)) return 'symbol';
  return null; // CLI-Befehle (foo:bar), Flags (--x), snake_case-DB-Werte
}

/** Suche ein Artefakt im Repo. files = vorab gesammelte Code-Dateien. */
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
      if (readFileSync(f, 'utf8').includes(token)) return { kind, found: true, evidence: `${relative(root, f)} (Route)` };
    }
    return { kind, found: false, evidence: null };
  }
  // symbol: Deklaration in CODE-Datei (nicht .md)
  const leaf = token.split('\\').pop().split('::')[0];
  const declRe = new RegExp(`\\b(class|interface|trait|enum|function|const)\\s+${leaf}\\b`);
  const wordRe = new RegExp(`\\b${leaf}\\b`);
  let weak = null;
  for (const f of files) {
    if (extname(f) === '.md') continue;
    const text = readFileSync(f, 'utf8');
    if (declRe.test(text)) return { kind, found: true, evidence: `${relative(root, f)} (Deklaration)` };
    if (!weak && wordRe.test(text)) weak = `${relative(root, f)} (Vorkommen)`;
  }
  return { kind, found: !!weak, evidence: weak };
}

/** Backtick-Tokens aus einem Textblock. */
export function backtickTokens(text) {
  return [...text.matchAll(/`([^`]+)`/g)].map((m) => m[1].trim()).filter(Boolean);
}

export { relative, basename, readFileSync };
