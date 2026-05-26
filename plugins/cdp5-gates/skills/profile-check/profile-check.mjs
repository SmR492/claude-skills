#!/usr/bin/env node
// CDP5 §1.9/§22 T1-Skill — profile-check (read-only): prüft Konzept + Repo gegen ein EINMAL
// deklariertes project-profile.md (YAML-Frontmatter). Doktrin: "Default einmal setzen, danach
// nur noch Konformitäts-Checks" — kein Re-Fragen je Schritt. Output = Beleg, 0 Modell-Token.
// Exit: 0 = konform · 1 = Profil-Drift · 2 = Nutzungsfehler.

import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { collectFiles } from '../../lib/scan.mjs';

const unquote = (s) => s.replace(/^["']|["']$/g, '').trim();

/** Minimaler YAML-Frontmatter-Parser (Subset: `key: value` + `key:` + `  - item`-Listen). */
export function parseFrontmatter(md) {
  const m = md.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return {};
  const out = {}; let curKey = null;
  for (const raw of m[1].split('\n')) {
    if (!raw.trim() || raw.trim().startsWith('#')) continue;
    const item = raw.match(/^\s+-\s+(.*)$/);
    if (item && curKey) { (Array.isArray(out[curKey]) ? out[curKey] : (out[curKey] = [])).push(unquote(item[1])); continue; }
    const kv = raw.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (kv) { curKey = kv[1]; const v = kv[2].trim(); out[curKey] = v === '' ? [] : unquote(v); }
  }
  return out;
}

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

/** Konzept-Konformität: deklarierte Regulatorik/Sicherheit + Pflicht-Tokens vorhanden? */
export function checkKonzept(profile, text) {
  const r = [];
  const has = (re) => (re instanceof RegExp ? re : new RegExp(re.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')).test(text);
  if (profile.eu_ai_act_class) {
    const ok = has(/AI[\s-]?Act/) && has(profile.eu_ai_act_class);
    r.push({ pass: ok, label: `EU-AI-Act-Klasse "${profile.eu_ai_act_class}" im Konzept deklariert`, hint: 'Klasse + "AI-Act" im Konzept-Text erwartet' });
  }
  if (profile.security_level === 'elevated') {
    r.push({ pass: has(/Threat[\s-]?Model|Bedrohungs|§\s?33/i), label: 'security_level=elevated → Threat-Modeling im Konzept', hint: '§33.4 Threat-Modeling-Sektion erwartet' });
  }
  for (const tok of profile.require_in_concept ?? []) {
    r.push({ pass: has(tok), label: `Pflicht-Token "${tok}" im Konzept`, hint: 'require_in_concept (Profil)' });
  }
  return r;
}

/** Repo-Konformität: erwartete Runtime + Test-Framework-Signatur vorhanden? */
export function checkRepo(profile, root) {
  const r = [];
  if (profile.runtime) {
    const rt = RUNTIME[profile.runtime];
    if (!rt) r.push({ pass: false, label: `runtime "${profile.runtime}" unbekannt`, hint: `bekannt: ${Object.keys(RUNTIME).join('/')}` });
    else {
      const hasMarker = rt.files.some((f) => existsSync(join(root, f))) || collectFiles(root, rt.exts).length > 0;
      r.push({ pass: hasMarker, label: `Runtime "${profile.runtime}" im Repo`, hint: `${rt.files.join('/')} oder ${rt.exts.join('/')} erwartet` });
    }
  }
  if (profile.test_framework) {
    const sig = FRAMEWORK[profile.test_framework];
    if (!sig) r.push({ pass: false, label: `test_framework "${profile.test_framework}" unbekannt`, hint: `bekannt: ${Object.keys(FRAMEWORK).join('/')}` });
    else {
      const exts = (RUNTIME[profile.runtime]?.exts) ?? ['.mjs', '.js', '.ts', '.php', '.py'];
      const hit = collectFiles(root, exts).some((f) => { try { return sig.test(readFileSync(f, 'utf8')); } catch { return false; } });
      r.push({ pass: hit, label: `Test-Framework "${profile.test_framework}"-Signatur im Repo`, hint: 'mind. eine Test-Datei mit passender Signatur erwartet' });
    }
  }
  return r;
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...v] = x.split('='); return [k.replace(/^--/, ''), v.length ? v.join('=') : true]; }));
  if (!a.profile) { console.error('Usage: profile-check.mjs --profile=<project-profile.md> [--konzept=<konzept.md>] [--repo=<root>] [--json]'); process.exit(2); }
  if (!a.konzept && !a.repo) { console.error('Mindestens --konzept oder --repo angeben (gegen welches Ziel geprüft wird).'); process.exit(2); }
  let profile; try { profile = parseFrontmatter(readFileSync(a.profile, 'utf8')); } catch { console.error(`Profil nicht lesbar: ${a.profile}`); process.exit(2); }
  if (!Object.keys(profile).length) { console.error('Kein YAML-Frontmatter im Profil gefunden (--- … ---).'); process.exit(2); }

  const results = [];
  if (a.konzept) { let t; try { t = readFileSync(a.konzept, 'utf8'); } catch { console.error(`Konzept nicht lesbar: ${a.konzept}`); process.exit(2); } results.push(...checkKonzept(profile, t).map((x) => ({ ...x, scope: 'Konzept' }))); }
  if (a.repo) results.push(...checkRepo(profile, a.repo).map((x) => ({ ...x, scope: 'Repo' })));

  const drift = results.some((x) => !x.pass);
  if (a.json) { console.log(JSON.stringify({ profile, results, drift }, null, 2)); process.exit(drift ? 1 : 0); }
  console.log(`profile-check — ${profile.project ?? '(unbenannt)'} · ${results.length} Checks\n`);
  for (const x of results) console.log(`  [${x.pass ? '✓' : '✗'}] (${x.scope}) ${x.label}${x.pass ? '' : '  — ' + x.hint}`);
  console.log(drift ? '\nProfil-Drift: deklarierter Default nicht erfüllt (s. ✗). Korrigieren oder Profil bewusst anpassen.' : '\nKonform zum Projekt-Profil.');
  process.exit(drift ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
