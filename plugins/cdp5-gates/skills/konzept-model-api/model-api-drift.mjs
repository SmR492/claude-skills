#!/usr/bin/env node
// CDP5 §32.9 T1-Skill — Modell↔API-Drift (read-only): deterministische Diffs.
//   (1) Enum-Drift: PHP-Enum-Cases ↔ OpenAPI-`enum`-Arrays gleichen Namens.
//   (2) Property-Drift: PHP-Entity-Properties ↔ OpenAPI-Schema-Properties gleichen Namens.
// Dependency-frei (kompakter Zeilen-Scanner). Die semantische „Konzept-Vokabular"-Wertung
// bleibt LLM-/Mensch-Arbeit — dieser Skill liefert nur die mechanischen Diffs.
// Exit: 0 = kein Drift · 1 = Drift gefunden · 2 = Nutzungsfehler.

import { readFileSync } from 'node:fs';
import { collectFiles } from '../../lib/scan.mjs';

const norm = (s) => s.toLowerCase().replace(/[_\s-]/g, '');

export function parsePhp(files) {
  const enums = {}, entities = {};
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    // Pro Deklaration nur den eigenen Slice (bis zur nächsten class/enum oder EOF) auswerten,
    // sonst bekäme jede Klasse die Properties der ganzen Datei.
    const decls = [...text.matchAll(/\b(class|enum)\s+(\w+)/g)];
    decls.forEach((m, i) => {
      const body = text.slice(m.index, i + 1 < decls.length ? decls[i + 1].index : text.length);
      if (m[1] === 'enum') {
        const cases = [...body.matchAll(/\bcase\s+(\w+)\s*(?:=\s*['"]([^'"]+)['"])?/g)].map((c) => c[2] ?? c[1]);
        if (cases.length) enums[m[2]] = [...new Set(cases)].sort();
      } else {
        const props = [...body.matchAll(/(?:private|protected|public)\s+(?:readonly\s+)?[\w?|\\]+\s+\$(\w+)/g)].map((p) => p[1]);
        if (props.length) entities[m[2]] = [...new Set(props)].sort();
      }
    });
  }
  return { enums, entities };
}

export function parseOpenApi(text) {
  const enums = {}, schemas = {};
  const lines = text.split('\n');
  let owner = null, collectingEnum = null;
  let curSchema = null, schemaIndent = -1, inProps = false, propsIndent = -1;
  for (const raw of lines) {
    const indent = raw.match(/^(\s*)/)[1].length;
    const keyM = raw.match(/^\s*([A-Za-z_][\w]*):\s*(.*)$/);
    // Schema-/Property-Tracking
    if (keyM) {
      const key = keyM[1];
      if (!['type', 'enum', 'properties', 'required', 'items', 'format', 'description', 'nullable', 'example', '$ref'].includes(key)) {
        owner = key;
        if (inProps && indent > propsIndent) { (schemas[curSchema] ??= []).push(key); }
        else { curSchema = key; schemaIndent = indent; inProps = false; }
      }
      if (key === 'properties') { inProps = true; propsIndent = indent; }
      if (inProps && indent <= schemaIndent && key !== 'properties') inProps = false;
    }
    // Enum (inline + Block)
    const inline = raw.match(/^\s*enum:\s*\[(.+)\]/);
    if (inline && owner) enums[owner] = inline[1].split(',').map((s) => s.trim().replace(/['"]/g, '')).sort();
    else if (/^\s*enum:\s*$/.test(raw)) { collectingEnum = owner; enums[owner] = []; }
    else if (collectingEnum) {
      const item = raw.match(/^\s*-\s*(.+?)\s*$/);
      if (item) enums[collectingEnum].push(item[1].replace(/['"]/g, ''));
      else if (keyM) { enums[collectingEnum].sort(); collectingEnum = null; }
    }
  }
  if (collectingEnum) enums[collectingEnum].sort();
  return { enums, schemas };
}

export function diff(php, api) {
  const drift = [];
  // Enum-Drift (Name-Match, normalisiert)
  for (const [name, vals] of Object.entries(php.enums)) {
    const apiKey = Object.keys(api.enums).find((k) => norm(k) === norm(name));
    if (!apiKey) { drift.push({ type: 'enum', name, issue: 'PHP-Enum ohne OpenAPI-Pendant' }); continue; }
    const a = [...api.enums[apiKey]].sort();
    if (JSON.stringify(a) !== JSON.stringify([...vals].sort()))
      drift.push({ type: 'enum', name, issue: `Werte weichen ab — PHP [${vals}] vs OpenAPI [${a}]` });
  }
  // Property-Drift (Schema-/Klassen-Name-Match)
  for (const [cls, props] of Object.entries(php.entities)) {
    const sKey = Object.keys(api.schemas).find((k) => norm(k) === norm(cls));
    if (!sKey) continue;
    const sProps = api.schemas[sKey];
    const onlyApi = sProps.filter((p) => !props.map(norm).includes(norm(p)));
    const onlyPhp = props.filter((p) => !sProps.map(norm).includes(norm(p)));
    if (onlyApi.length || onlyPhp.length)
      drift.push({ type: 'property', name: cls, issue: `nur OpenAPI: [${onlyApi}] · nur Entity: [${onlyPhp}]` });
  }
  return drift;
}

function main(argv) {
  const args = Object.fromEntries(argv.slice(2).map((a) => { const [k, v] = a.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!args.repo || !args.openapi) { console.error('Usage: model-api-drift.mjs --repo=<root> --openapi=<openapi.yaml> [--json]'); process.exit(2); }
  const php = parsePhp(collectFiles(args.repo, ['.php']));
  const api = parseOpenApi(readFileSync(args.openapi, 'utf8'));
  const d = diff(php, api);
  if (args.json) { console.log(JSON.stringify(d, null, 2)); process.exit(d.length ? 1 : 0); }
  console.log(`Modell↔API-Drift — ${Object.keys(php.enums).length} PHP-Enums, ${Object.keys(php.entities).length} Entities geprüft\n`);
  for (const x of d) console.log(`  ✗ [${x.type}] ${x.name}: ${x.issue}`);
  if (!d.length) console.log('  kein Drift.');
  process.exit(d.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
