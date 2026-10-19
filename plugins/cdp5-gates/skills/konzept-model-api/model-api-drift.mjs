#!/usr/bin/env node
// CDP5 §32.9 T1 skill — model↔API drift (read-only): deterministic diffs.
//   (1) Enum drift: PHP enum cases ↔ OpenAPI `enum` arrays of the same name.
//   (2) Property drift: PHP entity properties ↔ OpenAPI schema properties of the same name.
// Dependency-free (compact line scanner). The semantic "concept vocabulary" assessment
// remains LLM/human work — this skill only delivers the mechanical diffs.
// Exit: 0 = no drift · 1 = drift found · 2 = usage error.

import { readFileSync } from 'node:fs';
import { collectFiles } from '../../lib/scan.mjs';
import { guardPaths } from '../../lib/args.mjs';

const norm = (s) => s.toLowerCase().replace(/[_\s-]/g, '');

export function parsePhp(files) {
  const enums = {}, entities = {};
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    // Evaluate only each declaration's own slice (up to the next class/enum or EOF),
    // otherwise every class would get the properties of the whole file.
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
    // Schema/property tracking
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
    // Enum (inline + block)
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
  // Enum drift (name match, normalised)
  for (const [name, vals] of Object.entries(php.enums)) {
    const apiKey = Object.keys(api.enums).find((k) => norm(k) === norm(name));
    if (!apiKey) { drift.push({ type: 'enum', name, issue: 'PHP enum without OpenAPI counterpart' }); continue; }
    const a = [...api.enums[apiKey]].sort();
    if (JSON.stringify(a) !== JSON.stringify([...vals].sort()))
      drift.push({ type: 'enum', name, issue: `values differ — PHP [${vals}] vs OpenAPI [${a}]` });
  }
  // Property drift (schema/class name match)
  for (const [cls, props] of Object.entries(php.entities)) {
    const sKey = Object.keys(api.schemas).find((k) => norm(k) === norm(cls));
    if (!sKey) continue;
    const sProps = api.schemas[sKey];
    const onlyApi = sProps.filter((p) => !props.map(norm).includes(norm(p)));
    const onlyPhp = props.filter((p) => !sProps.map(norm).includes(norm(p)));
    if (onlyApi.length || onlyPhp.length)
      drift.push({ type: 'property', name: cls, issue: `only OpenAPI: [${onlyApi}] · only entity: [${onlyPhp}]` });
  }
  return drift;
}

function main(argv) {
  const args = Object.fromEntries(argv.slice(2).map((a) => { const [k, v] = a.split('='); return [k.replace(/^--/, ''), v ?? true]; }));
  if (!args.repo || !args.openapi) { console.error('Usage: model-api-drift.mjs --repo=<root> --openapi=<openapi.yaml> [--json]'); process.exit(2); }
  guardPaths([[args.repo, 'dir'], [args.openapi, 'file']]);
  const php = parsePhp(collectFiles(args.repo, ['.php']));
  const api = parseOpenApi(readFileSync(args.openapi, 'utf8'));
  const d = diff(php, api);
  if (args.json) { console.log(JSON.stringify(d, null, 2)); process.exit(d.length ? 1 : 0); }
  console.log(`Model↔API drift — ${Object.keys(php.enums).length} PHP enums, ${Object.keys(php.entities).length} entities checked\n`);
  for (const x of d) console.log(`  ✗ [${x.type}] ${x.name}: ${x.issue}`);
  if (!d.length) console.log('  no drift.');
  process.exit(d.length ? 1 : 0);
}

if (import.meta.url === `file://${process.argv[1]}`) main(process.argv);
