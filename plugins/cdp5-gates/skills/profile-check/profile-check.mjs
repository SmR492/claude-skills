#!/usr/bin/env node
// CDP5 §1.9/§22 T1 skill — profile-check (read-only): checks concept + repo against a project-profile.md
// (YAML frontmatter) that is declared ONCE. Doctrine: "set the default once, afterwards only
// conformance checks" — no re-asking at every step. Output = evidence, 0 model tokens.
// Exit: 0 = no 🔴 (conformant) · 1 = ≥1 🔴 (profile drift) · 2 = usage error.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { collectFiles } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

const unquote = (s) => s.replace(/^["']|["']$/g, '').trim();
const stripComment = (s) => s.replace(/\s+#.*$/, '');   // `node   # node | php | python` → `node`

/** Minimal YAML frontmatter parser (subset: `key: value` + `key:` + `  - item` lists, inline `# comments`). */
export function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {}; let curKey = null;
  for (const raw of m[1].split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item && curKey) { (Array.isArray(out[curKey]) ? out[curKey] : (out[curKey] = [])).push(unquote(stripComment(item[1]))); continue; }
    const kv = raw.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) { curKey = kv[1]; const v = stripComment(kv[2]).trim(); out[curKey] = v === '' ? [] : unquote(v); }
  }
  return out;
}

// EU AI Act risk-class scale (doctrine §22: Unacceptable — High — Limited — Minimal).
export const EU_AI_ACT_CLASSES = ['minimal', 'limited', 'high', 'unacceptable'];
const AI_ACT = /AI[\s-]?Act/i;
const RISK_CLASS_ROW = /^\s*\|.*\b(risk[\s-]?class|Risikoklasse)\b/i;

const RUNTIME = {
  node:   { files: ['package.json'], exts: ['.mjs', '.js', '.ts', '.cjs'] },
  php:    { files: ['composer.json'], exts: ['.php'] },
  python: { files: ['pyproject.toml', 'requirements.txt', 'setup.py'], exts: ['.py'] },
};
const FRAMEWORK = {
  'node:test': /from\s+['"]node:test['"]|require\(['"]node:test['"]\)/,
  phpunit:     /extends\s+\\?(?:\w+\\)*TestCase|PHPUnit\\\\?Framework/,
  jest:        /\b(?:describe|it|test)\s*\(|from\s+['"]@jest/,
  vitest:      /from\s+['"]vitest['"]/,
  pytest:      /import\s+pytest|^def\s+test_/m,
};

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const result = (pass, label, hint) => ({ sev: pass ? '🟢' : '🔴', pass, label, hint });

/**
 * The declared class must stand next to its context: on a line that mentions "AI Act", or in a risk-class
 * table row. A bare "high"/"minimal" somewhere in the prose is not a declaration.
 */
export function declaresAiActClass(text, cls) {
  const word = new RegExp(`(^|[^\\w])${esc(cls)}(?![\\w])`, 'i');
  return text.split('\n').some((line) => (AI_ACT.test(line) || RISK_CLASS_ROW.test(line)) && word.test(line));
}

/** Concept conformance: declared regulatory/security items + required tokens present? */
export function checkKonzept(profile, text) {
  const r = [];
  const has = (re) => (re instanceof RegExp ? re : new RegExp(esc(re), 'i')).test(text);
  if (profile.eu_ai_act_class) {
    const cls = String(profile.eu_ai_act_class);
    if (!EU_AI_ACT_CLASSES.includes(cls.toLowerCase())) {
      r.push(result(false, `eu_ai_act_class "${cls}" is not on the EU AI Act scale`, `known: ${EU_AI_ACT_CLASSES.join(' | ')}`));
    } else {
      r.push(result(declaresAiActClass(text, cls), `EU AI Act class "${cls}" declared in the concept`, 'the class must stand on a line mentioning "AI Act" or in a risk-class table row'));
    }
  }
  if (profile.security_level === 'elevated') {
    // "Bedrohungs" keeps matching German concept documents (Bedrohungsmodell/-analyse)
    r.push(result(has(/Threat[\s-]?Model|Bedrohungs|§\s?33/i), 'security_level=elevated → threat modeling in the concept', '§33.4 threat modeling section expected'));
  }
  for (const tok of profile.require_in_concept ?? []) {
    r.push(result(has(tok), `required token "${tok}" in the concept`, 'require_in_concept (profile)'));
  }
  return r;
}

/** Repo conformance: expected runtime + test framework signature present? */
export function checkRepo(profile, root) {
  const r = [];
  if (profile.runtime) {
    const rt = RUNTIME[profile.runtime];
    if (!rt) r.push(result(false, `runtime "${profile.runtime}" unknown`, `known: ${Object.keys(RUNTIME).join('/')}`));
    else {
      const hasMarker = rt.files.some((f) => existsSync(join(root, f))) || collectFiles(root, rt.exts).length > 0;
      r.push(result(hasMarker, `runtime "${profile.runtime}" in the repo`, `${rt.files.join('/')} or ${rt.exts.join('/')} expected`));
    }
  }
  if (profile.test_framework) {
    const sig = FRAMEWORK[profile.test_framework];
    if (!sig) r.push(result(false, `test_framework "${profile.test_framework}" unknown`, `known: ${Object.keys(FRAMEWORK).join('/')}`));
    else {
      const exts = (RUNTIME[profile.runtime]?.exts) ?? ['.mjs', '.js', '.ts', '.php', '.py'];
      const hit = collectFiles(root, exts).some((f) => { try { return sig.test(readFileSync(f, 'utf8')); } catch { return false; } });
      r.push(result(hit, `test framework "${profile.test_framework}" signature in the repo`, 'at least one test file with a matching signature expected'));
    }
  }
  return r;
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...v] = x.split('='); return [k.replace(/^--/, ''), v.length ? v.join('=') : true]; }));
  if (!a.profile) { console.error('Usage: profile-check.mjs --profile=<project-profile.md> [--konzept=<concept.md>] [--repo=<root>] [--json]'); process.exit(2); }
  if (!a.konzept && !a.repo) { console.error('Specify at least --konzept or --repo (the target to check against).'); process.exit(2); }
  guardPaths([[a.profile, 'file'], [a.konzept, 'file'], [a.repo, 'dir']]);
  let profile; try { profile = parseFrontmatter(readFileSync(a.profile, 'utf8')); } catch { console.error(`Profile not readable: ${a.profile}`); process.exit(2); }
  if (!Object.keys(profile).length) { console.error('No YAML frontmatter found in the profile (--- … ---).'); process.exit(2); }

  const results = [];
  if (a.konzept) { let t; try { t = readFileSync(a.konzept, 'utf8'); } catch { console.error(`Concept not readable: ${a.konzept}`); process.exit(2); } results.push(...checkKonzept(profile, t).map((x) => ({ ...x, scope: 'Concept' }))); }
  if (a.repo) results.push(...checkRepo(profile, a.repo).map((x) => ({ ...x, scope: 'Repo' })));

  const drift = results.some((x) => x.sev === '🔴');
  if (a.json) { console.log(JSON.stringify({ profile, results, drift }, null, 2)); process.exit(drift ? 1 : 0); }
  console.log(`profile-check — ${profile.project ?? '(unnamed)'} · ${results.length} checks\n`);
  for (const x of results) console.log(`  ${x.sev} (${x.scope}) ${x.label}${x.pass ? '' : '  — ' + x.hint}`);
  console.log(drift ? '\nProfile drift: declared default not met (see 🔴). Fix it or deliberately adjust the profile.' : '\nConformant to the project profile.');
  process.exit(drift ? 1 : 0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
