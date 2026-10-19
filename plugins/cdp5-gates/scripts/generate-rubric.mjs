#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const POLICY_DIR = join(HERE, '..', 'policy');
export const POLICY_MD = join(POLICY_DIR, 'reife-rubrik.policy.md');
export const POLICY_JSON = join(POLICY_DIR, 'reife-rubrik.policy.json');

function tableAfter(md, heading) {
  const start = md.indexOf(heading);
  if (start < 0) throw new Error(`policy: heading not found: ${heading}`);
  const lines = md.slice(start).split('\n').slice(1);
  const rows = [];
  let inTable = false;
  for (const line of lines) {
    if (line.startsWith('|')) {
      inTable = true;
      const cells = line.split('|').slice(1, -1).map((c) => c.trim());
      if (cells.every((c) => /^-+$/.test(c))) continue;
      rows.push(cells);
    } else if (inTable) break;
  }
  if (rows.length < 2) throw new Error(`policy: no table under ${heading}`);
  return rows.slice(1);
}

export function parsePolicy(md) {
  const version = md.match(/<!--\s*policy-version:\s*(\d+)\s*-->/)?.[1];
  if (!version) throw new Error('policy: missing <!-- policy-version: N -->');
  const threshold = Number(md.match(/^Threshold:\s*\*\*([\d.]+)\*\*/m)?.[1]);
  if (!Number.isFinite(threshold)) throw new Error('policy: missing "Threshold: **N**" line');
  const gate = tableAfter(md, '## Layer 1: gate').map(([id, item, kind, check]) => ({ id, item, kind, check }));
  const dimensions = tableAfter(md, '## Layer 2: dimensions').map(([id, name, weight, kind, scoredBy]) => ({ id, name, weight: Number(weight), kind, scoredBy }));
  for (const g of gate) if (!/^G\d+$/.test(g.id) || !['det', 'jdg'].includes(g.kind)) throw new Error(`policy: bad gate row ${JSON.stringify(g)}`);
  for (const d of dimensions) if (!Number.isFinite(d.weight) || !['det', 'jdg', 'mixed'].includes(d.kind)) throw new Error(`policy: bad dimension row ${JSON.stringify(d)}`);
  const sum = dimensions.reduce((s, d) => s + d.weight, 0);
  if (Math.abs(sum - 1) > 0.001) throw new Error(`policy: dimension weights sum to ${sum.toFixed(3)}, expected 1.000`);
  const ids = new Set();
  for (const x of [...gate, ...dimensions]) {
    if (ids.has(x.id)) throw new Error(`policy: duplicate id ${x.id}`);
    ids.add(x.id);
  }
  const weights = Object.fromEntries(dimensions.filter((d) => d.kind !== 'jdg').map((d) => [d.id, d.weight]));
  return { version: Number(version), threshold, gate, dimensions, weights };
}

export function render(policy) {
  return JSON.stringify({ _generated: 'from reife-rubrik.policy.md by scripts/generate-rubric.mjs; do not edit', ...policy }, null, 2) + '\n';
}

export function generate({ md = POLICY_MD, out = POLICY_JSON, check = false } = {}) {
  const rendered = render(parsePolicy(readFileSync(md, 'utf8')));
  const current = existsSync(out) ? readFileSync(out, 'utf8') : null;
  if (check) return { changed: current !== rendered, path: out, reason: current === null ? 'policy JSON missing' : 'policy JSON differs from the Markdown policy' };
  if (current !== rendered) writeFileSync(out, rendered);
  return { changed: current !== rendered, path: out };
}

export function main(argv = process.argv.slice(2)) {
  const check = argv.includes('--check');
  try {
    const r = generate({ check });
    if (check && r.changed) { console.error(`reife-rubrik: ${r.reason}; run scripts/generate-rubric.mjs`); return 1; }
    console.log(check ? 'reife-rubrik: policy JSON is current' : `reife-rubrik: ${r.changed ? 'wrote' : 'unchanged'} ${r.path}`);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 2;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main());
