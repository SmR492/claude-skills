#!/usr/bin/env node
// CDP5 §11.7/§27.4 T1-Skill — ac-to-test-scaffold (read-only): erzeugt FAILING Test-Skelette
// AUS den Akzeptanzkriterien-Tabellen des Konzepts (nicht aus dem Code → echtes TDD-First).
// Druckt nur auf stdout (read-only); Dev/Orchestrator legt die Dateien an.
// Exit: 0 = Skelette erzeugt · 1 = keine AC gefunden · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';

export function parseUCs(md) {
  const ucs = []; let cur = null;
  for (const line of md.split('\n')) {
    const h = line.match(/^#{2,3}\s+(UC[-\s][^\n]*)/i);   // H2 ODER H3 (UCs oft unter `## N. Use Cases`)
    if (h) { cur = { title: h[1].trim(), body: '' }; ucs.push(cur); continue; }
    if (/^#{1,2}\s/.test(line) && !/^#{2,3}\s+UC/i.test(line)) cur = null;
    if (cur) cur.body += line + '\n';
  }
  return ucs;
}

/** AC-Zeilen → {id, kriterium, klasse, methode}. Test-Klasse aus Spalte mit `Class::method`. */
export function extractACs(md) {
  const out = [];
  for (const uc of parseUCs(md)) {
    for (const line of uc.body.split('\n')) {
      if (!/^\|\s*AC-?\d/i.test(line)) continue;
      const cols = line.split('|').map((c) => c.trim()).filter((_, i, a) => i > 0 && i < a.length - 1);
      const id = (cols[0] || '').replace(/\s+/g, '');
      const kriterium = cols[1] || '';
      const tc = (cols.find((c) => /::|Test\b/.test(c)) || '').match(/([A-Za-z_]\w*)::(\w+)|([A-Za-z_]\w*Test)/);
      if (!id) continue;
      const klasse = tc ? (tc[1] || tc[3]) : `${uc.title.replace(/[^A-Za-z0-9]/g, '')}Test`;
      const methode = tc && tc[2] ? tc[2] : `test_${id.replace(/[^A-Za-z0-9]/g, '_')}`;
      out.push({ uc: uc.title, id, kriterium, klasse, methode });
    }
  }
  return out;
}

function renderPhp(byClass) {
  return Object.entries(byClass).map(([cls, acs]) => {
    const methods = acs.map((ac) => `    public function ${ac.methode}(): void\n    {\n        // ${ac.id}: ${ac.kriterium}\n        self::markTestIncomplete('${ac.id} noch nicht implementiert (TDD-First: erst rot).');\n    }`).join('\n\n');
    return `<?php\ndeclare(strict_types=1);\n// Auto-Scaffold aus Konzept-AC — erst ROT, dann implementieren (CDP5 §11.7/§27.4).\nfinal class ${cls} extends \\PHPUnit\\Framework\\TestCase\n{\n${methods}\n}`;
  }).join('\n\n');
}

function renderJs(byClass) {
  const lines = ["import { test } from 'node:test';", "// Auto-Scaffold aus Konzept-AC — erst ROT, dann implementieren (CDP5 §11.7/§27.4).", ''];
  for (const acs of Object.values(byClass)) for (const ac of acs)
    lines.push(`test('${ac.id}: ${ac.kriterium.replace(/'/g, "\\'")}', () => {\n  throw new Error('${ac.id} noch nicht implementiert (TDD-First: erst rot).');\n});`);
  return lines.join('\n');
}

export function scaffold(md, lang = 'php') {
  const acs = extractACs(md);
  const byClass = {};
  for (const ac of acs) {                          // Methodennamen je Klasse deduplizieren (sonst invalides PHP)
    const arr = (byClass[ac.klasse] ??= []);
    let m = ac.methode, n = 1;
    while (arr.some((x) => x.methode === m)) m = `${ac.methode}_${++n}`;
    arr.push({ ...ac, methode: m });
  }
  return { count: acs.length, byClass, code: lang === 'js' ? renderJs(byClass) : renderPhp(byClass) };
}

function main(argv) {
  const a = Object.fromEntries(argv.slice(2).map((x) => { const [k, ...r] = x.split('='); return [k.replace(/^--/, ''), r.length ? r.join('=') : true]; }));
  if (!a.konzept) { console.error('Usage: ac-to-test-scaffold.mjs --konzept=<konzept.md> [--lang=php|js]'); process.exit(2); }
  const r = scaffold(readFileSync(a.konzept, 'utf8'), a.lang === 'js' ? 'js' : 'php');
  if (!r.count) { console.error('Keine AC-Tabellen gefunden — erst `konzept-lint` (AC-Tabelle je UC Pflicht).'); process.exit(1); }
  console.error(`// ${r.count} AC → ${Object.keys(r.byClass).length} Test-Klasse(n) · read-only (kopieren/anlegen):\n`);
  console.log(r.code);
  process.exit(0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
