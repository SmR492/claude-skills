#!/usr/bin/env node
// CDP5 §11.7/§27.4 T1 skill — ac-to-test-scaffold (read-only): generates placeholder test skeletons
// FROM the acceptance-criteria tables of the concept (not from the code → genuine TDD-first).
// The skeletons are placeholders (incomplete/todo), not red tests — the dev turns each one into a
// real failing assertion before implementing.
// Prints to stdout only (read-only); dev/orchestrator creates the files.
// Exit: 0 = skeletons generated · 2 = usage/input error (also: no AC table found — input state, not a finding).

import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { parseUCs } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

export { parseUCs };

/** AC rows → {id, kriterium, klasse, methode}. Test class from the column containing `Class::method`. */
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
    const methods = acs.map((ac) => `    public function ${ac.methode}(): void\n    {\n        // ${ac.id}: ${ac.kriterium}\n        self::markTestIncomplete('${ac.id} not yet implemented (placeholder from concept AC — todo).');\n    }`).join('\n\n');
    return `<?php\ndeclare(strict_types=1);\n// Auto-scaffold from concept ACs — placeholders (incomplete/todo), replace with real assertions, then implement (CDP5 §11.7/§27.4).\nfinal class ${cls} extends \\PHPUnit\\Framework\\TestCase\n{\n${methods}\n}`;
  }).join('\n\n');
}

function renderJs(byClass) {
  const lines = ["import { test } from 'node:test';", "// Auto-scaffold from concept ACs — placeholders (todo), replace with real assertions, then implement (CDP5 §11.7/§27.4).", ''];
  for (const acs of Object.values(byClass)) for (const ac of acs)
    lines.push(`test('${ac.id}: ${ac.kriterium.replace(/'/g, "\\'")}', () => {\n  throw new Error('${ac.id} not yet implemented (placeholder from concept AC — todo).');\n});`);
  return lines.join('\n');
}

export function scaffold(md, lang = 'php') {
  const acs = extractACs(md);
  const byClass = {};
  for (const ac of acs) {                          // deduplicate method names per class (otherwise invalid PHP)
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
  guardPaths([[a.konzept, 'file']]);
  const r = scaffold(readFileSync(a.konzept, 'utf8'), a.lang === 'js' ? 'js' : 'php');
  if (!r.count) { console.error('No AC tables found — run `konzept-lint` first (an AC table per UC is mandatory).'); process.exit(2); }
  console.error(`// ${r.count} AC → ${Object.keys(r.byClass).length} test class(es) · read-only (copy/create the files):\n`);
  console.log(r.code);
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main(process.argv);
